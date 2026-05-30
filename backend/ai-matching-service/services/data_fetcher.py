"""
DataFetcher — async HTTP client for fetching data from sibling microservices.

  • candidature-service  →  GET /api/candidatures/{id}
  • auth-service         →  GET /api/auth/mentors
"""

import logging

import httpx
from fastapi import HTTPException

from config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 15.0


class DataFetcher:
    """
    Thin async wrapper around httpx for inter-service calls.
    The caller's JWT is forwarded so downstream services can authorise the request.
    """

    def __init__(self) -> None:
        self._candidature_base: str = settings.candidature_service_url.rstrip("/")
        self._auth_base: str = settings.auth_service_url.rstrip("/")

    # ── Public methods ────────────────────────────────────────────────────────

    async def get_candidature(self, candidature_id: int, token: str) -> dict:
        """
        Fetch a single candidature from candidature-service.
        Raises HTTPException(404) when not found, (502) on other errors.
        """
        url = f"{self._candidature_base}/api/candidatures/{candidature_id}"
        return await self._get_json(url, token, entity="candidature")

    async def get_mentors(self, token: str) -> list[dict]:
        """
        Fetch the list of active mentors from auth-service.
        Returns an empty list if the service is unavailable (non-fatal).
        """
        url = f"{self._auth_base}/api/auth/mentors"
        try:
            result = await self._get_json(url, token, entity="mentors")
            # The endpoint may return a list directly or {"content": [...]}
            if isinstance(result, list):
                return result
            if isinstance(result, dict):
                return result.get("content") or result.get("data") or []
            return []
        except HTTPException:
            logger.warning("Could not fetch mentors — returning empty list")
            return []

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _get_json(self, url: str, token: str, *, entity: str) -> dict | list:
        headers = {"Authorization": f"Bearer {token}"}
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
                resp = await client.get(url, headers=headers)
        except httpx.TimeoutException:
            logger.error("Timeout fetching %s from %s", entity, url)
            raise HTTPException(
                status_code=504,
                detail=f"Upstream service timeout while fetching {entity}",
            )
        except httpx.RequestError as exc:
            logger.error("Request error fetching %s: %s", entity, exc)
            raise HTTPException(
                status_code=502,
                detail=f"Could not reach upstream service for {entity}",
            )

        if resp.status_code == 404:
            raise HTTPException(
                status_code=404,
                detail=f"{entity.capitalize()} not found",
            )
        if not resp.is_success:
            logger.error(
                "Upstream returned %s for %s: %s",
                resp.status_code,
                entity,
                resp.text[:200],
            )
            raise HTTPException(
                status_code=502,
                detail=f"Upstream error ({resp.status_code}) fetching {entity}",
            )

        return resp.json()
