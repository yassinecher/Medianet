"""
MentorMatchingService — KNN-based mentor recommendation.

Implements the class diagram exactly:
  - algorithm      : "KNN"
  - featureVector  : List[float]  — last project feature vector
  - similarityThreshold : float
  - topK           : int
  - lastTrainedAt  : datetime

Feature space — 20 dimensions shared by project and mentor vectors:
  [0]  FinTech          [1]  HealthTech      [2]  EdTech
  [3]  CleanTech        [4]  AI/ML           [5]  E-commerce
  [6]  IoT              [7]  AgriTech        [8]  Frontend
  [9]  Backend          [10] Mobile          [11] AI-Engineering
  [12] Cloud/DevOps     [13] Blockchain      [14] Stage maturity
  [15] Team depth       [16] Availability    [17] B2B orientation
  [18] B2C orientation  [19] Quality signal
"""

import uuid
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np
from sklearn.neighbors import NearestNeighbors

logger = logging.getLogger(__name__)

FEATURE_DIM = 20

FEATURE_NAMES = [
    "FinTech", "HealthTech", "EdTech", "CleanTech", "AI/ML",
    "E-commerce", "IoT", "AgriTech",
    "Frontend", "Backend", "Mobile", "AI-Engineering", "Cloud/DevOps", "Blockchain",
    "Maturité projet", "Profondeur équipe", "Disponibilité", "B2B", "B2C", "Qualité",
]

FEATURE_KEYWORDS: dict[int, list[str]] = {
    0:  ["fintech", "finance", "banking", "banque", "payment", "paiement", "assurance", "insurance"],
    1:  ["health", "santé", "médical", "medical", "biotech", "pharma", "clinique", "e-santé"],
    2:  ["edtech", "education", "formation", "apprentissage", "e-learning", "université", "école"],
    3:  ["cleantech", "green", "renewable", "environnement", "énergie", "solaire", "recyclage"],
    4:  ["ai", "intelligence artificielle", "machine learning", "ml", "deep learning", "nlp", "data science"],
    5:  ["e-commerce", "marketplace", "retail", "vente en ligne", "boutique", "shop"],
    6:  ["iot", "internet of things", "capteur", "embedded", "hardware", "arduino", "raspberry"],
    7:  ["agri", "agriculture", "farming", "food", "agroalimentaire", "ferme", "irrigation"],
    8:  ["react", "angular", "vue", "frontend", "html", "css", "javascript", "typescript", "ui", "ux"],
    9:  ["java", "spring", "python", "django", "node", "backend", "api", "microservices", "php"],
    10: ["flutter", "swift", "kotlin", "react native", "mobile", "ios", "android"],
    11: ["tensorflow", "pytorch", "keras", "scikit", "huggingface", "llm", "neural", "computer vision"],
    12: ["aws", "azure", "gcp", "cloud", "kubernetes", "docker", "devops", "ci/cd", "terraform"],
    13: ["blockchain", "ethereum", "solidity", "web3", "crypto", "nft", "defi", "smart contract"],
}

MODEL_PATH = Path("knn_model.pkl")


class MentorMatchingService:
    """
    KNN mentor matcher using scikit-learn NearestNeighbors with cosine metric.
    """

    def __init__(self, top_k: int = 5, similarity_threshold: float = 0.25):
        self.id: str = str(uuid.uuid4())
        self.algorithm: str = "KNN"
        self.feature_vector: list[float] = []          # last project vector
        self.similarity_threshold: float = similarity_threshold
        self.top_k: int = top_k
        self.last_trained_at: datetime = datetime.now()

        # sklearn model — loaded from disk if available
        self._knn: NearestNeighbors | None = self._load_model()

    # ── Class-diagram public methods ──────────────────────────────────────────

    def extract_project_features(self, project: dict) -> np.ndarray:
        """Build a 20-dim float64 vector from candidature fields."""
        text = self._project_text(project)
        v = self._keyword_features(text)

        # dim 14: stage maturity
        v[14] = self._encode_stage(project.get("currentStage"))
        # dim 15: team depth
        team_size = project.get("teamSize") or 0
        v[15] = min(team_size, 10) / 10.0
        # dim 16: availability neutral
        v[16] = 1.0
        # dim 17-18: B2B / B2C
        v[17] = 1.0 if any(k in text for k in ["b2b", "enterprise", "entreprise", "saas"]) else 0.0
        v[18] = 1.0 if any(k in text for k in ["b2c", "consumer", "consommateur", "grand public"]) else 0.0
        # dim 19: neutral quality at match time
        v[19] = 0.5

        self.feature_vector = v.tolist()
        logger.debug("Project vector '%s': %s", project.get("projectName"), v)
        return v

    def extract_mentor_features(self, mentor: dict) -> np.ndarray:
        """Build a 20-dim float64 vector from mentor profile fields."""
        profile: dict = mentor.get("mentorProfile") or {}
        text = self._mentor_text(profile)
        v = self._keyword_features(text)

        years = profile.get("yearsOfExperience") or 0
        # dim 14: experience → stage-maturity proxy
        v[14] = min(years, 20) / 20.0
        # dim 15: team depth proxy
        v[15] = min(years, 20) / 20.0
        # dim 16: availability
        v[16] = self._encode_availability(profile.get("availability"))
        # dim 17-18: B2B / B2C orientation
        v[17] = 1.0 if any(k in text for k in ["b2b", "enterprise", "entreprise", "corporate", "saas"]) else 0.0
        v[18] = 1.0 if any(k in text for k in ["b2c", "consumer", "marketing", "growth", "brand"]) else 0.0
        # dim 19: quality from rating
        rating = profile.get("rating") or 0.0
        v[19] = rating / 5.0

        return v

    def compute_similarity(self, v1: np.ndarray, v2: np.ndarray) -> float:
        """Cosine similarity in [0.0, 1.0]."""
        n1 = np.linalg.norm(v1)
        n2 = np.linalg.norm(v2)
        if n1 == 0.0 or n2 == 0.0:
            return 0.0
        return float(np.dot(v1, v2) / (n1 * n2))

    def recommend_mentors(self, project: dict, mentors: list[dict]) -> list[dict]:
        """
        Fit a KNN model on the mentor feature matrix, query with the project
        vector, and return the top-K matches above similarity_threshold.

        Raw cosine similarity is adjusted by a profile-completeness multiplier
        so that mentors with empty profiles cannot score spuriously high due to
        sparse-vector cosine artefacts.
        """
        active = [m for m in mentors if m.get("active", True)]
        if not active:
            return []

        # Filter out mentors whose profile is essentially empty
        active = [m for m in active if self._profile_completeness(m) >= 0.1]
        if not active:
            return []

        # Build feature matrix  (n_mentors × FEATURE_DIM)
        mentor_vecs = np.array([self.extract_mentor_features(m) for m in active])

        # Project query vector
        project_vec = self.extract_project_features(project)

        # Fit KNN with cosine metric
        n_neighbors = min(self.top_k, len(active))
        knn = NearestNeighbors(
            n_neighbors=n_neighbors,
            metric="cosine",
            algorithm="brute",
        )
        knn.fit(mentor_vecs)
        self._knn = knn   # keep for updateModel persistence

        # Query — returns distances (cosine distance = 1 – similarity)
        distances, indices = knn.kneighbors([project_vec])

        results = []
        for dist, idx in zip(distances[0], indices[0]):
            similarity = float(1.0 - dist)          # convert distance → similarity

            mentor = active[idx]

            # Penalise incomplete profiles:
            #   adjusted = cosine × (0.30 + 0.70 × completeness)
            # A fully filled profile (completeness=1) is unaffected.
            # A half-filled profile (completeness=0.5) has its score scaled to ~65%.
            completeness = self._profile_completeness(mentor)
            adjusted_similarity = similarity * (0.30 + 0.70 * completeness)
            score = round(adjusted_similarity * 100, 1)   # 0 – 100

            if adjusted_similarity < self.similarity_threshold:
                continue

            profile = mentor.get("mentorProfile") or {}
            results.append({
                "mentorId":         mentor.get("id"),
                "email":            mentor.get("email"),
                "fullName":         f"{mentor.get('firstName', '')} {mentor.get('lastName', '')}".strip(),
                "title":            profile.get("title"),
                "expertise":        profile.get("expertise") or [],
                "rating":           profile.get("rating") or 0.0,
                "availability":     profile.get("availability") or "UNKNOWN",
                "yearsOfExperience":profile.get("yearsOfExperience") or 0,
                "ruleScore":        score,
                "aiScore":          score,
                "matchReasoning":   f"Similarité cosinus KNN : {score:.1f}% (complétude profil : {round(completeness*100)}%)",
                "suggestedFocus":   "Analyse Ollama en attente.",
            })

        return sorted(results, key=lambda x: x["ruleScore"], reverse=True)

    def explain_match(self, project: dict, mentor: dict) -> dict:
        """
        Return a structured explanation of a project–mentor pair
        (which feature dimensions overlap, which don't).
        Used to build a richer Ollama prompt.
        """
        pv = self.extract_project_features(project)
        mv = self.extract_mentor_features(mentor)
        sim = self.compute_similarity(pv, mv)

        matching, proj_only, mentor_only = [], [], []
        for i, name in enumerate(FEATURE_NAMES):
            p_active = pv[i] > 0.4
            m_active = mv[i] > 0.4
            if p_active and m_active:
                matching.append(name)
            elif p_active:
                proj_only.append(name)
            elif m_active:
                mentor_only.append(name)

        profile = mentor.get("mentorProfile") or {}
        return {
            "projectName":       project.get("projectName"),
            "mentorName":        f"{mentor.get('firstName', '')} {mentor.get('lastName', '')}".strip(),
            "similarityScore":   round(sim, 4),
            "matchingFeatures":  matching,
            "projectOnlyFeatures": proj_only,
            "mentorOnlyFeatures":  mentor_only,
        }

    def update_model(self) -> None:
        """
        Persist the current KNN model to disk and refresh lastTrainedAt.
        In production: retrain on new candidature/outcome data here.
        """
        self.last_trained_at = datetime.now()
        if self._knn is not None:
            joblib.dump(self._knn, MODEL_PATH)
            logger.info("KNN model saved to %s", MODEL_PATH)

    def model_info(self) -> dict[str, Any]:
        return {
            "id":                  self.id,
            "algorithm":           self.algorithm,
            "topK":                self.top_k,
            "similarityThreshold": self.similarity_threshold,
            "featureDimensions":   FEATURE_DIM,
            "featureNames":        FEATURE_NAMES,
            "lastTrainedAt":       self.last_trained_at.isoformat(),
            "featureVector":       self.feature_vector,
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _keyword_features(self, text: str) -> np.ndarray:
        """Dims 0-13: binary flags based on keyword presence."""
        v = np.zeros(FEATURE_DIM, dtype=np.float64)
        for idx, keywords in FEATURE_KEYWORDS.items():
            v[idx] = 1.0 if any(kw in text for kw in keywords) else 0.0
        return v

    @staticmethod
    def _project_text(p: dict) -> str:
        parts = [
            p.get("domain") or "",
            p.get("techStack") or "",
            p.get("projectDescription") or "",
            p.get("problemStatement") or "",
            p.get("solutionDescription") or "",
            p.get("targetMarket") or "",
            p.get("businessModel") or "",
            p.get("teamBackground") or "",
        ]
        return " ".join(parts).lower()

    @staticmethod
    def _mentor_text(profile: dict) -> str:
        exp  = " ".join(profile.get("expertise") or [])
        spec = " ".join(profile.get("specializations") or [])
        bio  = profile.get("bio") or ""
        title = profile.get("title") or ""
        return " ".join([exp, spec, bio, title]).lower()

    @staticmethod
    def _encode_stage(stage: str | None) -> float:
        if not stage:
            return 0.2
        s = stage.lower()
        if any(k in s for k in ["product", "live", "lancé"]):  return 1.0
        if any(k in s for k in ["pilot", "beta", "test"]):     return 0.8
        if "mvp" in s:                                           return 0.6
        if "proto" in s:                                         return 0.5
        if any(k in s for k in ["idée", "idea", "concept"]):   return 0.2
        return 0.3

    @staticmethod
    def _encode_availability(avail: str | None) -> float:
        match (avail or "").upper():
            case "FULL_TIME": return 1.0
            case "PART_TIME": return 0.7
            case "WEEKENDS":  return 0.5
            case _:           return 0.3

    @staticmethod
    def _profile_completeness(mentor: dict) -> float:
        """
        Returns 0.0–1.0 reflecting how complete the mentor's profile is.

        Prevents the cosine-similarity algorithm from awarding high scores to
        mentors whose feature vectors are almost all zeros (i.e. who never
        filled in their profile). The weights reflect how much each field
        contributes to the KNN feature space:

          expertise (dims 0-13) — 40 % of score
          yearsOfExperience     — 25 %
          bio                   — 15 %
          title                 — 10 %
          specializations       — 10 %
        """
        profile: dict = mentor.get("mentorProfile") or {}

        completeness = 0.0

        expertise = profile.get("expertise") or []
        if len(expertise) >= 3:
            completeness += 0.40
        elif len(expertise) >= 1:
            completeness += 0.22

        years = profile.get("yearsOfExperience") or 0
        if years >= 5:
            completeness += 0.25
        elif years >= 1:
            completeness += 0.14

        bio = profile.get("bio") or ""
        if len(bio) >= 50:
            completeness += 0.15
        elif len(bio) >= 10:
            completeness += 0.08

        title = profile.get("title") or ""
        if title.strip():
            completeness += 0.10

        specs = profile.get("specializations") or []
        if specs:
            completeness += 0.10

        return min(completeness, 1.0)

    @staticmethod
    def _load_model() -> NearestNeighbors | None:
        if MODEL_PATH.exists():
            try:
                model = joblib.load(MODEL_PATH)
                logger.info("KNN model loaded from %s", MODEL_PATH)
                return model
            except Exception as e:
                logger.warning("Could not load KNN model: %s", e)
        return None
