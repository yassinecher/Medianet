"""
OllamaCommentService — enriches KNN match results with French reasoning via Ollama.

Ollama is only used for generating human-readable French commentary.
Scores (ruleScore / aiScore) are NEVER changed here.
"""

import json
import logging
import re
from typing import Any

import httpx

from config import settings

logger = logging.getLogger(__name__)

_PROMPT_TEMPLATE = """\
Tu es un expert en incubation de startups. Analyse la compatibilité entre ce projet et ce mentor.

PROJET : {project_name}
MENTOR : {mentor_name}
SCORE DE COMPATIBILITÉ : {score:.1f}%

POINTS COMMUNS (projet + mentor) : {matching}
BESOINS DU PROJET NON COUVERTS : {proj_only}
EXPERTISES DU MENTOR NON REQUISES : {mentor_only}

Réponds UNIQUEMENT avec un objet JSON valide (pas de markdown, pas d'explication hors du JSON) :
{{
  "matchReasoning": "<2-3 phrases expliquant pourquoi ce mentor correspond à ce projet>",
  "suggestedFocus": "<1 phrase concrète : sur quoi le mentor devrait concentrer son accompagnement>"
}}"""


class OllamaCommentService:
    """
    Calls the local Ollama instance to generate French reasoning for a match.
    Falls back gracefully when Ollama is unavailable.
    """

    def __init__(self) -> None:
        self._url: str = settings.ollama_url.rstrip("/")
        self._model: str = settings.ollama_model
        self._timeout: float = 60.0

    # ── Public API ────────────────────────────────────────────────────────────

    async def enrich_match(self, match: dict, explain: dict) -> dict:
        """
        Add `matchReasoning` and `suggestedFocus` to a match dict.
        The dict is returned (a new copy) with those two keys updated.
        Original score keys are preserved unchanged.
        """
        prompt = self._build_prompt(match, explain)
        commentary = await self._call_ollama(prompt)

        return {
            **match,
            "matchReasoning": commentary.get(
                "matchReasoning",
                match.get("matchReasoning", "Analyse Ollama indisponible."),
            ),
            "suggestedFocus": commentary.get(
                "suggestedFocus",
                match.get("suggestedFocus", ""),
            ),
        }

    async def enrich_matches(
        self, matches: list[dict], explain_map: dict[str, dict]
    ) -> list[dict]:
        """
        Enrich a list of match dicts using a map of mentorId → explain dict.
        Runs sequentially (Ollama is not thread-safe with a single model loaded).
        """
        enriched = []
        for m in matches:
            mid = m.get("mentorId", "")
            explain = explain_map.get(mid, {})
            enriched.append(await self.enrich_match(m, explain))
        return enriched

    # ── Private helpers ───────────────────────────────────────────────────────

    def _build_prompt(self, match: dict, explain: dict) -> str:
        def _fmt(lst: list[str]) -> str:
            return ", ".join(lst) if lst else "aucun"

        return _PROMPT_TEMPLATE.format(
            project_name=explain.get("projectName") or "Projet inconnu",
            mentor_name=match.get("fullName") or "Mentor inconnu",
            score=match.get("ruleScore", 0.0),
            matching=_fmt(explain.get("matchingFeatures", [])),
            proj_only=_fmt(explain.get("projectOnlyFeatures", [])),
            mentor_only=_fmt(explain.get("mentorOnlyFeatures", [])),
        )

    async def _call_ollama(self, prompt: str) -> dict[str, Any]:
        payload = {
            "model": self._model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    f"{self._url}/api/generate",
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()
                raw = data.get("response", "")
                return self._extract_json(raw)
        except httpx.TimeoutException:
            logger.warning("Ollama timed out after %.0fs", self._timeout)
        except httpx.HTTPStatusError as exc:
            logger.warning("Ollama HTTP error %s: %s", exc.response.status_code, exc)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Ollama call failed: %s", exc)
        return {}

    @staticmethod
    def _extract_json(text: str) -> dict[str, Any]:
        """Strip markdown fences and extract the first JSON object."""
        # Remove ```json ... ``` fences
        text = re.sub(r"```(?:json)?", "", text).strip()
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {}
