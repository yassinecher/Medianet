FROM python:3.11-slim

# ffmpeg (+ ffprobe) for audio extraction and frame sampling.
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
# faster-whisper pulls ~200-300 MB of wheels (ctranslate2, onnxruntime, av, tokenizers).
# Upgrade pip and add retries/timeout so a single dropped download doesn't fail the build.
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir --retries 5 --timeout 120 -r requirements.txt

COPY app.py .

# Whisper models are cached here (mount a volume to persist across restarts).
RUN mkdir -p /models
ENV WHISPER_MODEL=base

EXPOSE 8087
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8087"]
