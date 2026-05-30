import jwt
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings

bearer_scheme = HTTPBearer()


def verify_token(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> dict:
    """Validate the JWT and return its claims.

    Accepts HS256 / HS384 / HS512 because JJWT 0.12.x auto-selects the
    algorithm based on key bit-length when no algorithm is specified
    explicitly in signWith().  The Java side now pins HS256, but we keep
    all three here as a safety net.
    """
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=["HS256", "HS384", "HS512"],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")


def require_admin(payload: dict = Depends(verify_token)) -> dict:
    """Raise 403 if the caller is not ADMIN."""
    role = payload.get("role") or ""
    roles = payload.get("roles") or []
    if role != "ADMIN" and "ADMIN" not in roles:
        raise HTTPException(status_code=403, detail="Admin role required")
    return payload
