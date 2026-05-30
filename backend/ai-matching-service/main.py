"""
ai-matching-service — FastAPI entry point.

Starts on port 8085 (set in Dockerfile / docker-compose).
All matching routes live under /api/ai/match/**.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.matching_router import router as matching_router

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: ARG001
    logger.info("ai-matching-service starting up …")
    yield
    logger.info("ai-matching-service shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="AI Matching Service",
    description="KNN-based mentor recommendation with Ollama French commentary.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the Angular front-end and the API gateway
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(matching_router)


# ── Root health-check ─────────────────────────────────────────────────────────
@app.get("/", tags=["health"])
async def root() -> dict:
    return {"status": "UP", "service": "ai-matching-service"}


@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "UP"}
