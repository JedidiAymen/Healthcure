"""Local-only educator/student/research-review session helpers.

Passwords and bearer tokens are never stored in plaintext. Accounts and grants
are provisioned by an operator, not by an unauthenticated HTTP request.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
import sqlite3
from typing import Callable

from fastapi import Header, HTTPException

PASSWORD_ITERATIONS = 420_000
SESSION_HOURS = 8


def password_digest(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)


def password_record(password: str) -> tuple[bytes, bytes]:
    salt = secrets.token_bytes(16)
    return salt, password_digest(password, salt)


def verify_password(password: str, salt: bytes, expected: bytes) -> bool:
    return hmac.compare_digest(password_digest(password, salt), expected)


def issue_session(conn: sqlite3.Connection, user_id: str) -> tuple[str, str]:
    token = secrets.token_urlsafe(36)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)).isoformat()
    conn.execute(
        "INSERT INTO local_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
        (hashlib.sha256(token.encode()).hexdigest(), user_id, expires_at),
    )
    return token, expires_at


def _authorization_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, separator, token = authorization.partition(" ")
    if not separator or scheme.lower() != "bearer" or not token or len(token) > 256:
        return None
    return token


def current_user(conn: sqlite3.Connection, authorization: str | None) -> dict | None:
    token = _authorization_token(authorization)
    if token is None:
        return None
    row = conn.execute(
        """SELECT u.id,u.display_name,g.role,s.expires_at
           FROM local_sessions s JOIN users u ON u.id=s.user_id
           JOIN role_grants g ON g.user_id=u.id AND g.scope='platform'
           WHERE s.token_hash=? AND s.revoked_at IS NULL
           ORDER BY CASE g.role WHEN 'admin' THEN 0 WHEN 'educator' THEN 1
             WHEN 'student' THEN 2 WHEN 'clinical_reviewer' THEN 3 ELSE 4 END""",
        (hashlib.sha256(token.encode()).hexdigest(),),
    ).fetchone()
    if row is None or row[3] <= datetime.now(timezone.utc).isoformat():
        return None
    return {"id": row[0], "display_name": row[1], "role": row[2], "expires_at": row[3]}


def require_role(role: str) -> Callable:
    def dependency(authorization: str | None = Header(default=None)) -> dict:
        # The database accessor is injected by create_app to keep tests isolated.
        from .main import _db
        with _db() as conn:
            user = current_user(conn, authorization)
        if user is None:
            raise HTTPException(status_code=401, detail={"code": "AUTH_REQUIRED", "message": "Sign in with a provisioned local account"}, headers={"WWW-Authenticate": "Bearer"})
        if user["role"] != role and user["role"] != "admin":
            raise HTTPException(status_code=403, detail={"code": "ROLE_REQUIRED", "message": f"This action requires the {role} role"})
        return user
    return dependency


def require_any_role(*roles: str) -> Callable:
    def dependency(authorization: str | None = Header(default=None)) -> dict:
        from .main import _db
        with _db() as conn:
            user = current_user(conn, authorization)
        if user is None:
            raise HTTPException(status_code=401, detail={"code": "AUTH_REQUIRED", "message": "Sign in with a provisioned local account"}, headers={"WWW-Authenticate": "Bearer"})
        if user["role"] not in roles and user["role"] != "admin":
            raise HTTPException(status_code=403, detail={"code": "ROLE_REQUIRED", "message": "This action is unavailable for this role"})
        return user
    return dependency
