"""
Matching router — all /api/ai/match/** endpoints.

Endpoints
---------
POST  /api/ai/match/{candidatureId}   → run KNN + Ollama enrichment
GET   /api/ai/match/model/info        → model metadata
POST  /api/ai/match/model/update      → persist model to disk  (ADMIN only)
GET   /api/ai/match/info              → service health/info
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Request

from security.jwt_handler import require_admin, verify_token
from services.data_fetcher import DataFetcher
from services.mentor_matching_service import MentorMatchingService
from services.ollama_comment_service import OllamaCommentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai/match", tags=["mentor-matching"])

# ── Singleton service instances (created once at import time) ─────────────────
_matcher = MentorMatchingService()
_ollama = OllamaCommentService()
_fetcher = DataFetcher()


# ── Helper ────────────────────────────────────────────────────────────────────

def _bearer_token(request: Request) -> str:
    """Extract the raw JWT string from the Authorization header."""
    auth = request.headers.get("Authorization", "")
    return auth.removeprefix("Bearer ").strip()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/{candidature_id}", summary="Run KNN mentor matching for a candidature")
async def match_mentors(
    candidature_id: Annotated[int, Path(ge=1)],
    request: Request,
    _claims: Annotated[dict, Depends(verify_token)],
) -> dict:
    """
    1. Fetch the candidature and the mentor list from upstream services.
    2. Run scikit-learn KNN to find the top-K closest mentors.
    3. Enrich each match with French reasoning from Ollama.
    4. Return the ranked list.
    """
    token = _bearer_token(request)

    # 1 – fetch data
    candidature = await _fetcher.get_candidature(candidature_id, token)
    mentors = await _fetcher.get_mentors(token)

    logger.info(
        "Matching candidature %d against %d active mentors",
        candidature_id,
        len(mentors),
    )

    # 2 – KNN matching
    matches = _matcher.recommend_mentors(candidature, mentors)

    if not matches:
        return {
            "candidatureId": candidature_id,
            "projectName": candidature.get("projectName"),
            "totalMentors": len(mentors),
            "matches": [],
            "message": "Aucun mentor suffisamment compatible trouvé.",
        }

    # 3 – Build explain map (mentorId → explain dict) for Ollama prompt
    explain_map: dict[str, dict] = {}
    for match in matches:
        mid = match.get("mentorId")
        # Find the raw mentor object
        mentor_obj = next(
            (m for m in mentors if str(m.get("id")) == str(mid)), None
        )
        if mentor_obj:
            explain_map[str(mid)] = _matcher.explain_match(candidature, mentor_obj)

    # 4 – Ollama enrichment (non-blocking fallback if Ollama is down)
    enriched = await _ollama.enrich_matches(matches, explain_map)

    return {
        "candidatureId": candidature_id,
        "projectName": candidature.get("projectName"),
        "totalMentors": len(mentors),
        "matches": enriched,
    }


@router.get("/model/info", summary="KNN model metadata")
async def model_info(
    _claims: Annotated[dict, Depends(verify_token)],
) -> dict:
    """Return current model parameters, feature names, and training timestamp."""
    return _matcher.model_info()


@router.post("/model/update", summary="Persist KNN model to disk (ADMIN only)")
async def update_model(
    _claims: Annotated[dict, Depends(require_admin)],
) -> dict:
    """Save the current KNN model to knn_model.pkl and refresh lastTrainedAt."""
    _matcher.update_model()
    return {
        "status": "ok",
        "message": "Modèle KNN sauvegardé.",
        "lastTrainedAt": _matcher.last_trained_at.isoformat(),
    }


@router.get("/info", summary="Service health & configuration")
async def service_info() -> dict:
    """Public endpoint — returns service name, version, and model summary."""
    info = _matcher.model_info()
    return {
        "service": "ai-matching-service",
        "version": "1.0.0",
        "algorithm": info["algorithm"],
        "featureDimensions": info["featureDimensions"],
        "topK": info["topK"],
        "similarityThreshold": info["similarityThreshold"],
        "lastTrainedAt": info["lastTrainedAt"],
        "status": "UP",
    }
