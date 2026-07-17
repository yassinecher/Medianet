"""
Pitch media analysis service.

Self-hosted pipeline that turns a pitch video into structured observations the
LLM can reason over:

  video  --ffmpeg-->  audio (wav 16k mono)   --faster-whisper-->  transcript + timing
         --ffmpeg-->  sampled keyframes (jpg) --Ollama vision-->  visual observations

Everything degrades gracefully: if Whisper or the vision model is unavailable,
the endpoint still returns what it could produce, with warnings.
"""
import base64
import os
import re
import subprocess
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

import requests
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="pitch-media-service")

# ── Config ───────────────────────────────────────────────────────────────────
MINIO_PUBLIC_URL   = os.getenv("MINIO_PUBLIC_URL", "http://localhost:9000").rstrip("/")
MINIO_INTERNAL_URL = os.getenv("MINIO_INTERNAL_URL", "http://minio:9000").rstrip("/")
OLLAMA_URL         = os.getenv("OLLAMA_URL", "http://ollama:11434").rstrip("/")
WHISPER_MODEL      = os.getenv("WHISPER_MODEL", "base")
WHISPER_DEVICE     = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_COMPUTE    = os.getenv("WHISPER_COMPUTE", "int8")
VISION_MODEL       = os.getenv("VISION_MODEL", "")          # e.g. "moondream" / "llava" — empty disables vision
# Fallback when duration is unknown; real count scales with length (_frame_count_for).
FRAME_COUNT        = int(os.getenv("FRAME_COUNT", "4"))
FRAME_MAX          = int(os.getenv("FRAME_MAX", "10"))
# beam_size=1 (greedy) is markedly faster than the default 5 with little loss
# on clear pitch audio.
WHISPER_BEAM       = int(os.getenv("WHISPER_BEAM", "1"))
# Transcribe hesitations instead of letting Whisper tidy them away. Set to 0 to
# get clean prose back (at the cost of losing all filler detection).
WHISPER_VERBATIM   = os.getenv("WHISPER_VERBATIM", "1") == "1"

# A deliberately disfluent context sample, per language — Whisper continues in
# the register it is primed with, so this is what keeps the "euh"/"um" in.
VERBATIM_PROMPTS = {
    "en": "Um, uh, so... like, you know, hmm. Er, I mean, uhh, basically.",
    "fr": "Euh, hum... bah, voilà, enfin, je veux dire. Euh, du coup, genre.",
}

# French + English filler expressions used to gauge delivery.
FILLERS = ["euh", "heu", "hum", "ben", "bah", "genre", "voilà", "du coup",
           "en fait", "en gros", "quoi", "tu vois", "um", "uh", "like", "you know"]

_whisper_model = None


def get_whisper():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel(
            WHISPER_MODEL, device=WHISPER_DEVICE, compute_type=WHISPER_COMPUTE,
            download_root="/models",
        )
    return _whisper_model


class AnalyzeRequest(BaseModel):
    videoUrl: str
    transcribe: bool = True
    vision: bool = True


@app.get("/health")
def health():
    return {"status": "ok", "whisperModel": WHISPER_MODEL,
            "visionModel": VISION_MODEL or None, "ollama": OLLAMA_URL}


def _internal_url(url: str) -> str:
    """Make a stored (public) MinIO URL fetchable from inside the docker network."""
    if url.startswith(MINIO_PUBLIC_URL):
        return MINIO_INTERNAL_URL + url[len(MINIO_PUBLIC_URL):]
    return url


def _run(cmd: list) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, timeout=600)


def _duration(path: str) -> Optional[float]:
    try:
        r = _run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                  "-of", "default=noprint_wrappers=1:nokey=1", path])
        return round(float(r.stdout.decode().strip()), 1)
    except Exception:
        return None


def _extract_audio(video: str, out_wav: str) -> bool:
    r = _run(["ffmpeg", "-y", "-i", video, "-vn", "-ac", "1", "-ar", "16000",
              "-f", "wav", out_wav])
    return r.returncode == 0 and os.path.exists(out_wav) and os.path.getsize(out_wav) > 0


def _frame_count_for(duration: Optional[float]) -> int:
    """
    Scale coverage with length: ~1 frame per 40s, min 4, max FRAME_MAX.
    A fixed 3 frames meant a 7-minute talk was judged on one image every 2.5
    minutes — nowhere near enough to say anything about body language.
    """
    if not duration or duration <= 0:
        return FRAME_COUNT
    return max(4, min(FRAME_MAX, int(round(duration / 40.0))))


def _sample_frames(video: str, out_dir: str, n: int, duration: Optional[float]) -> tuple:
    """Grab n evenly-spaced keyframes; return (paths, timestamps)."""
    paths, stamps = [], []
    dur = duration or 0
    if dur and dur > 1:
        step = dur / (n + 1)
        for i in range(1, n + 1):
            ts = round(step * i, 2)
            p = os.path.join(out_dir, f"frame_{i}.jpg")
            r = _run(["ffmpeg", "-y", "-ss", str(ts), "-i", video, "-frames:v", "1",
                      "-vf", "scale=640:-1", p])
            if r.returncode == 0 and os.path.exists(p):
                paths.append(p); stamps.append(ts)
    else:  # unknown duration → fps sampling fallback
        r = _run(["ffmpeg", "-y", "-i", video, "-vf", "fps=1/3,scale=640:-1",
                  "-frames:v", str(n), os.path.join(out_dir, "frame_%02d.jpg")])
        if r.returncode == 0:
            paths = sorted(os.path.join(out_dir, f) for f in os.listdir(out_dir) if f.startswith("frame_"))
            stamps = [i * 3.0 for i in range(len(paths))]
    return paths[:n], stamps[:n]


def _prosody(wav: str, duration: Optional[float]) -> dict:
    """
    Measure how the voice actually SOUNDS, straight from the waveform.

    Whisper's VAD strips silence, so pauses can't be derived from segment gaps
    (they always come out as 0). These come from ffmpeg on the raw audio:
      - ebur128  → integrated loudness (is the voice loud enough?) and LRA,
                   the loudness range: a low LRA means a flat/monotone delivery.
      - silencedetect → real pauses, and how much of the time is actual speech.
    """
    out: dict = {}
    try:
        r = _run(["ffmpeg", "-nostats", "-i", wav, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"])
        err = r.stderr.decode(errors="ignore")
        # ebur128 prints a live line every 100ms that STARTS at "I: -70.0 LUFS
        # LRA: 0.0 LU" (its initial state). Only the trailing "Summary:" block
        # holds the real figures — parsing the first match reported every video
        # as silent and monotone.
        summary = err.rsplit("Summary:", 1)[-1] if "Summary:" in err else ""
        if summary:
            mi = re.search(r"I:\s*(-?\d+\.?\d*)\s*LUFS", summary)
            ml = re.search(r"LRA:\s*(-?\d+\.?\d*)\s*LU", summary)
            mp = re.search(r"Peak:\s*(-?\d+\.?\d*)\s*dBFS", summary)
            if mi: out["integratedLoudnessLufs"] = float(mi.group(1))
            if ml: out["loudnessRangeLu"] = float(ml.group(1))
            if mp: out["truePeakDbfs"] = float(mp.group(1))
        else:
            out["prosodyWarning"] = "loudness summary not found"
    except Exception as e:
        out["prosodyWarning"] = f"loudness failed: {e}"

    try:
        # d=0.2 (not 0.7) so we also capture the SHORT gaps. They are not pauses
        # worth reporting, but Whisper bills a word's trailing gap to the word
        # itself, so _disfluency needs them to tell a truly drawn-out "annnd"
        # apart from "and" + a breath. Pause metrics below still filter to >=0.7
        # so the reported figures keep their original meaning.
        r = _run(["ffmpeg", "-nostats", "-i", wav, "-af", "silencedetect=noise=-32dB:d=0.2", "-f", "null", "-"])
        err = r.stderr.decode(errors="ignore")
        starts = [float(x) for x in re.findall(r"silence_start:\s*(-?\d+\.?\d*)", err)]
        ends = [float(x) for x in re.findall(r"silence_end:\s*(-?\d+\.?\d*)", err)]
        out["silences"] = [{"start": s, "end": e} for s, e in zip(starts, ends) if e > s]

        durs = [float(x) for x in re.findall(r"silence_duration:\s*(\d+\.?\d*)", err)]
        pauses = [d for d in durs if d >= 0.7]
        out["pauseCount"] = len(pauses)
        out["longPauses"] = sum(1 for d in pauses if d >= 1.5)
        out["totalSilenceSec"] = round(sum(durs), 1)
        out["longestPauseSec"] = round(max(durs), 1) if durs else 0.0
        if duration and duration > 0:
            speaking = max(0.0, duration - sum(durs))
            out["speakingRatio"] = round(speaking / duration, 2)
    except Exception as e:
        out["prosodyWarning"] = f"silence failed: {e}"
    return out


def _detect_language(wav: str) -> Optional[str]:
    """
    Detect the language from the first 30s, WITHOUT a prompt (~1.6s).

    Needed because _transcribe passes a filler-seeded initial_prompt, and Whisper
    treats that prompt as prior context — an English seed on a French pitch would
    drag detection to English. Detecting first lets us pin `language=` explicitly
    so the prompt can only influence style, never the language.
    """
    probe = wav + ".probe.wav"
    try:
        _run(["ffmpeg", "-y", "-nostats", "-loglevel", "error", "-i", wav, "-t", "30", probe])
        _, info = get_whisper().transcribe(probe, vad_filter=True, beam_size=1)
        return getattr(info, "language", None)
    except Exception:
        return None
    finally:
        try: os.remove(probe)
        except OSError: pass


def _transcribe(wav: str) -> dict:
    model = get_whisper()
    lang = _detect_language(wav) if WHISPER_VERBATIM else None
    # Whisper is trained to emit CLEAN prose: it silently deletes every "um"/"uh"
    # (measured — with no prompt this audio yielded 0 filler tokens, whether or
    # not the VAD ran). Seeding the context with a disfluent sample makes it
    # transcribe verbatim instead: same audio -> 59 fillers, content preserved
    # (0.94 word-level similarity) at no extra time cost.
    prompt = VERBATIM_PROMPTS.get(lang or "", VERBATIM_PROMPTS["en"]) if WHISPER_VERBATIM else None
    # word_timestamps gives per-word start/end + confidence, which is what makes
    # drawn-out "aaaa/ummm", stutters and mumbling detectable.
    segments, info = model.transcribe(wav, vad_filter=True, beam_size=WHISPER_BEAM,
                                      word_timestamps=True, language=lang,
                                      initial_prompt=prompt)
    seg_list, text_parts, words = [], [], []
    for s in segments:
        seg_list.append({"start": s.start, "end": s.end, "text": s.text})
        text_parts.append(s.text)
        for w in (getattr(s, "words", None) or []):
            words.append({"w": w.word.strip(), "start": w.start, "end": w.end,
                          "p": getattr(w, "probability", None)})
    transcript = " ".join(t.strip() for t in text_parts).strip()
    return {"transcript": transcript, "segments": seg_list, "words": words,
            "language": getattr(info, "language", None)}


# Hedges / uncertainty markers — "giving information in a question form".
HEDGES = [
    # FR
    "je pense", "je crois", "peut-être", "je dirais", "on va dire", "en quelque sorte",
    "un peu", "j'espère", "si vous voulez", "vous voyez", "je sais pas", "je ne sais pas",
    "en fait", "disons", "à peu près", "plus ou moins",
    # EN
    "i think", "i guess", "i believe", "maybe", "sort of", "kind of", "probably",
    "hopefully", "you know", "i'm not sure", "i mean", "a little bit", "somewhat",
    "or something", "i hope", "we hope",
]
# Tag questions / uptalk proxies — statements delivered as questions.
TAG_QUESTIONS = ["right?", "ok?", "okay?", "you know?", "yeah?", "n'est-ce pas", "non ?", "d'accord ?", "vous voyez ?"]


def _voiced_sec(w: dict, silences: list) -> float:
    """
    How long the word was actually VOICED — its span minus any silence inside it.

    Whisper ends a word where the next one starts, so a trailing breath or pause
    is charged to the preceding word. Without this correction every function word
    before a pause ("and", "the", "to") looked like a drawn-out "annnd", and on a
    hesitant speaker that false-positived into the dozens.
    """
    s, e = w["start"], w["end"]
    held = e - s
    for sil in silences:
        overlap = min(e, sil["end"]) - max(s, sil["start"])
        if overlap > 0:
            held -= overlap
    return max(0.0, held)


# Sounds that are pure hesitation, not words. Whisper normalises "ummmm" -> "um",
# so these are matched as tokens rather than by looking for repeated letters.
FILLER_TOKENS = {"euh", "heu", "hum", "heum", "hmm", "mmm", "um", "umm", "uh", "uhh",
                 "er", "erm", "ah", "ahh", "eh"}


def _disfluency(words: list, transcript: str, duration: Optional[float],
                silences: Optional[list] = None) -> dict:
    """
    Detect the unconscious tics that make a speaker sound unsure:
      - fillers      : "euh", "um", "uh" — with the timestamp of each one
      - elongations  : a sound genuinely held too long ("aaaa", "sooo", "annnd")
      - repetitions  : stutters / restarts ("the the", "we we")
      - mumbling     : words the ASR itself was unsure about (low probability)
      - hedging      : "I think", "sort of", "maybe" — undermines authority
      - uptalk       : information delivered as a question
    """
    out: dict = {}
    low = (transcript or "").lower()
    sils = silences or []

    # ── Filler sounds, with the moment each was uttered ────────────────────
    # Priming Whisper to keep hesitations also tempts it to invent one in a gap,
    # so a filler is only counted if there is actually voiced sound under it.
    fillers_at = []
    for w in words:
        tok = re.sub(r"[^\w']", "", w["w"]).lower()
        if tok not in FILLER_TOKENS or w.get("start") is None or w.get("end") is None:
            continue
        if _voiced_sec(w, sils) < 0.05:
            continue
        fillers_at.append({"word": tok, "atSec": round(w["start"], 1)})
    out["fillerMoments"] = fillers_at[:25]
    out["fillerSoundCount"] = len(fillers_at)

    # ── Elongations: a sound stretched well past its natural length ────────
    elong = []
    for w in words:
        tok = re.sub(r"[^\w']", "", w["w"]).lower()
        if not tok or w.get("start") is None or w.get("end") is None:
            continue
        # Repeated letters survived the ASR ("uhhh", "aaaa") — always a tic.
        if re.search(r"(.)\1{2,}", tok):
            elong.append({"word": tok, "atSec": round(w["start"], 1),
                          "heldSec": round(w["end"] - w["start"], 2)})
            continue
        # Otherwise judge on VOICED time only: a short word takes ~0.2-0.4s to
        # say, so >0.7s of actual sound means it was dragged out.
        voiced = _voiced_sec(w, sils)
        if len(tok) <= 5 and voiced >= 0.7:
            elong.append({"word": tok, "atSec": round(w["start"], 1), "heldSec": round(voiced, 2)})
    out["elongations"] = elong[:25]
    out["elongationCount"] = len(elong)

    # ── Repetitions / stutters ─────────────────────────────────────────────
    reps = []
    for a, b in zip(words, words[1:]):
        ta = re.sub(r"[^\w']", "", a["w"]).lower()
        tb = re.sub(r"[^\w']", "", b["w"]).lower()
        if ta and ta == tb and len(ta) > 1:
            reps.append({"word": ta, "atSec": round(b.get("start") or 0, 1)})
    out["repetitions"] = reps[:25]
    out["repetitionCount"] = len(reps)

    # ── Mumbling: the ASR's own confidence ─────────────────────────────────
    probs = [w["p"] for w in words if w.get("p") is not None]
    if probs:
        out["lowConfidenceWordPct"] = round(100 * sum(1 for p in probs if p < 0.5) / len(probs), 1)
        out["asrMeanConfidence"] = round(sum(probs) / len(probs), 3)

    # ── Hedging + uptalk ───────────────────────────────────────────────────
    hedges = {h: len(re.findall(r"\b" + re.escape(h) + r"\b", low)) for h in HEDGES}
    hedges = {k: v for k, v in hedges.items() if v > 0}
    out["hedgePhrases"] = hedges
    out["hedgeCount"] = sum(hedges.values())
    out["tagQuestionCount"] = sum(low.count(t) for t in TAG_QUESTIONS)
    out["questionMarks"] = (transcript or "").count("?")
    if duration and duration > 0:
        m = duration / 60.0
        out["elongationsPerMin"] = round(len(elong) / m, 1)
        out["hedgesPerMin"] = round(out["hedgeCount"] / m, 1)
        out["fillerSoundsPerMin"] = round(len(fillers_at) / m, 1)
    return out


def _delivery_metrics(transcript: str, segments: list, duration: Optional[float]) -> dict:
    words = re.findall(r"\w+", transcript.lower())
    wc = len(words)
    wpm = round(wc / (duration / 60), 1) if duration and duration > 0 else None
    low = transcript.lower()
    filler_hits = {f: len(re.findall(r"\b" + re.escape(f) + r"\b", low)) for f in FILLERS}
    filler_hits = {k: v for k, v in filler_hits.items() if v > 0}
    filler_total = sum(filler_hits.values())
    # Long pauses = gaps > 2.5s between consecutive spoken segments.
    long_pauses = 0
    for a, b in zip(segments, segments[1:]):
        if b["start"] - a["end"] > 2.5:
            long_pauses += 1
    return {"wordCount": wc, "wordsPerMinute": wpm,
            "fillerCount": filler_total, "fillerWords": filler_hits,
            "longPauses": long_pauses}


def _vision(frame_paths: list, stamps: list) -> dict:
    """
    Describe body language from sampled frames using a local Ollama vision model.

    Each frame is captioned INDIVIDUALLY and tagged with its timestamp: batching
    them into one call made the model emit a single vague line for the whole
    video (e.g. "woman at podium"), which is far too thin to judge presence.
    Best-effort — any failure degrades to fewer/no observations.
    """
    if not VISION_MODEL or not frame_paths:
        return {"observations": [], "warning": None if VISION_MODEL else "vision disabled (no VISION_MODEL)"}

    # moondream is a small captioner, not an instruction-follower: multi-part or
    # constrained prompts make it return an EMPTY string (measured). A single
    # natural question works, and asking about hands+gaze is what actually
    # surfaces posture and eye contact — e.g. "holding her hands together while
    # she looks down".
    prompt = "What is the person doing with their hands and where are they looking?"
    observations, failures = [], 0
    for p, ts in zip(frame_paths, stamps):
        try:
            with open(p, "rb") as f:
                img = base64.b64encode(f.read()).decode()
            r = requests.post(f"{OLLAMA_URL}/api/chat", json={
                "model": VISION_MODEL,
                "messages": [{"role": "user", "content": prompt, "images": [img]}],
                "stream": False,
                # Pinned, not just "low". At 0.1 the same frame flip-flopped
                # between "one hand raised" and "arms crossed" across runs, and a
                # sampled misread became confident coaching ("stop crossing your
                # arms" for a speaker who never did). Body language must at least
                # be reproducible: same frame, same answer, every run.
                "options": {"temperature": 0, "seed": 42, "top_p": 1},
            }, timeout=180)
            if r.status_code != 200:
                failures += 1
                continue
            content = r.json().get("message", {}).get("content", "").strip()
            content = " ".join(content.split())
            # Guard against empty/parroted replies — feeding those to the scoring
            # model is worse than having no visual data at all.
            if len(content) < 30 or content.lower().startswith(("(a)", "(b)", "1.", "a)")):
                failures += 1
                continue
            content = content[:320]  # keep the prompt compact across ~10 frames
            mm, ss = int(ts) // 60, int(ts) % 60
            observations.append(f"[{mm}:{ss:02d}] {content}")
        except Exception:
            failures += 1
    warn = f"vision: {failures}/{len(frame_paths)} frame(s) failed" if failures else None
    return {"observations": observations, "warning": warn}


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    started = time.time()
    warnings = []
    out = {"transcript": "", "segments": [], "language": None, "durationSeconds": None,
           "frames": 0, "visualObservations": [], "warnings": warnings,
           "engine": {"whisper": WHISPER_MODEL, "vision": VISION_MODEL or None}}

    src = _internal_url(req.videoUrl)
    with tempfile.TemporaryDirectory() as tmp:
        video = os.path.join(tmp, "video.bin")
        try:
            with requests.get(src, stream=True, timeout=120) as resp:
                resp.raise_for_status()
                with open(video, "wb") as f:
                    for chunk in resp.iter_content(1 << 20):
                        f.write(chunk)
        except Exception as e:
            warnings.append(f"download failed: {e}")
            return out

        dur = _duration(video)
        out["durationSeconds"] = dur

        # ffmpeg prep (cheap): audio track + keyframes.
        wav = os.path.join(tmp, "audio.wav")
        have_audio = _extract_audio(video, wav) if req.transcribe else False
        if req.transcribe and not have_audio:
            warnings.append("audio extraction failed (no audio track?)")

        frames, stamps = [], []
        if req.vision:
            frame_dir = os.path.join(tmp, "frames")
            os.makedirs(frame_dir, exist_ok=True)
            frames, stamps = _sample_frames(video, frame_dir, _frame_count_for(dur), dur)
            out["frames"] = len(frames)

        # Whisper (CPU-bound) and the vision model (network-bound, on Ollama) are
        # independent — run them concurrently instead of back to back.
        with ThreadPoolExecutor(max_workers=3) as pool:
            f_tr = pool.submit(_transcribe, wav) if have_audio else None
            f_pr = pool.submit(_prosody, wav, dur) if have_audio else None
            f_vi = pool.submit(_vision, frames, stamps) if req.vision else None

            # Collected first because _disfluency needs the silence intervals to
            # avoid charging a word for the pause that follows it. Both futures
            # are already in flight, so this costs no parallelism.
            prosody: dict = {}
            if f_pr:
                try:
                    prosody = f_pr.result()
                except Exception as e:
                    warnings.append(f"prosody failed: {e}")

            if f_tr:
                try:
                    tr = f_tr.result()
                    out.update(transcript=tr["transcript"], segments=tr["segments"], language=tr["language"])
                    out.update(_delivery_metrics(tr["transcript"], tr["segments"], dur))
                    # Unconscious tics + uncertainty markers (needs word timings).
                    out.update(_disfluency(tr.get("words", []), tr["transcript"], dur,
                                           prosody.get("silences")))
                except Exception as e:
                    warnings.append(f"transcription failed: {e}")

            # Applied last so the waveform-measured pauses/loudness override the
            # segment-gap guess (Whisper's VAD removes silence → gaps are ~0).
            # `silences` is an internal working detail, not part of the payload.
            out.update({k: v for k, v in prosody.items() if k != "silences"})
            if f_vi:
                try:
                    v = f_vi.result()
                    out["visualObservations"] = v["observations"]
                    if v["warning"]:
                        warnings.append(v["warning"])
                except Exception as e:
                    warnings.append(f"vision failed: {e}")

    out["elapsedSeconds"] = round(time.time() - started, 1)
    return out
