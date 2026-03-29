"""
app/auth.py
────────────
JWT authentication and RBAC helpers.

Roles: admin > analyst > viewer
  admin   — full access (upload, extract, ask, search, analytics, manage users)
  analyst — upload, extract, ask, search, analytics (read)
  viewer  — search and download only

Dependencies:
  pip install python-jose[cryptography] passlib[bcrypt]
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from utils.logger import logger

# ── Try to import JWT deps; degrade gracefully if not installed ────────────────
try:
    from jose import JWTError, jwt
    import bcrypt
    _JWT_AVAILABLE = True
except ImportError:
    _JWT_AVAILABLE = False
    logger.warning("python-jose / bcrypt not installed. Auth endpoints disabled.")

_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production-super-secret-key-32chars!")
_ALGORITHM = "HS256"
_ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))  # 8 hours

_bearer = HTTPBearer(auto_error=False)


# ─── Password helpers ─────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    if not _JWT_AVAILABLE:
        return password  # fallback (insecure, for dev only)
    # Use bcrypt directly to avoid passlib compatibility issues
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against a hash using bcrypt."""
    if not _JWT_AVAILABLE:
        return plain == hashed
    # Use bcrypt directly to avoid passlib compatibility issues
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


# ─── Token helpers ────────────────────────────────────────────────────────────

def create_access_token(username: str, role: str) -> str:
    if not _JWT_AVAILABLE:
        return f"dev-token-{username}"  # insecure dev stub
    expire = datetime.now(timezone.utc) + timedelta(minutes=_ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": username, "role": role, "exp": expire}
    return jwt.encode(payload, _SECRET_KEY, algorithm=_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises HTTPException on failure."""
    if not _JWT_AVAILABLE:
        return {"sub": "dev-user", "role": "admin"}
    try:
        return jwt.decode(token, _SECRET_KEY, algorithms=[_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


# ─── FastAPI dependency ───────────────────────────────────────────────────────

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> dict:
    """
    Extract and validate the Bearer token from the Authorization header.
    Returns the token payload dict (sub, role).
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return decode_token(credentials.credentials)


def require_role(*allowed_roles: str):
    """FastAPI dependency factory — restrict endpoint to specific roles."""
    def _dep(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {list(allowed_roles)}",
            )
        return current_user
    return _dep


# Convenience role deps
require_admin   = require_role("admin")
require_analyst = require_role("admin", "analyst")
require_viewer  = require_role("admin", "analyst", "viewer")
