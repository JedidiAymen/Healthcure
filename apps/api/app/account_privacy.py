"""Data-subject requests for local accounts: export your own data, or erase (pseudonymise) your account.

Erasure removes credentials, sessions and role grants and replaces the display name with a
pseudonym. Learning records (attempts, answers, grades) and audit entries stay linked to the same
random user ID, which no longer identifies a person in this system; educators' grade history stays
consistent. See docs/DATA_INVENTORY.md for what is held and for how long.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
from typing import Callable

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from . import audit
from .auth import current_user, verify_password


class _Model(BaseModel):
    model_config = ConfigDict(extra='forbid')


class AccountEraseRequest(_Model):
    password: str = Field(min_length=1, max_length=256)
    confirm: str = Field(pattern='^ERASE MY ACCOUNT$')


def learner_code(user_id: str) -> str:
    """Stable pseudonymous code for exports and cohort views."""
    return 'L-' + hashlib.sha256(user_id.encode()).hexdigest()[:8].upper()


def register_account_privacy_routes(app: FastAPI, db: Callable) -> None:
    def signed_in(authorization: str | None = Header(default=None)) -> dict:
        with db() as conn:
            user = current_user(conn, authorization)
        if user is None:
            raise HTTPException(401, detail={'code': 'AUTH_REQUIRED', 'message': 'Sign in with a provisioned local account'})
        return user

    @app.get('/api/v1/account/export')
    def account_export(user: dict = Depends(signed_in)):
        with db() as conn:
            profile = conn.execute('SELECT id,display_name,created_at FROM users WHERE id=?', (user['id'],)).fetchone()
            credential = conn.execute('SELECT username FROM local_credentials WHERE user_id=?', (user['id'],)).fetchone()
            roles = [row[0] for row in conn.execute('SELECT role FROM role_grants WHERE user_id=?', (user['id'],))]
            sessions = conn.execute('SELECT count(*), sum(revoked_at IS NULL) FROM local_sessions WHERE user_id=?', (user['id'],)).fetchone()
            attempts = [dict(zip(('attempt_id', 'state', 'submitted_at', 'score'), row)) for row in conn.execute(
                'SELECT id,state,submitted_at,score FROM attempts WHERE student_id=? ORDER BY submitted_at', (user['id'],))]
            answers = [dict(zip(('attempt_id', 'block_id', 'response_json'), row)) for row in conn.execute(
                'SELECT o.attempt_id,o.block_id,o.response_json FROM observations o JOIN attempts t ON t.id=o.attempt_id WHERE t.student_id=?', (user['id'],))]
            entries = [dict(zip(('created_at', 'action', 'target_kind', 'target_id'), row)) for row in conn.execute(
                'SELECT created_at,action,target_kind,target_id FROM audit_log WHERE actor_id=? ORDER BY id', (user['id'],))]
            audit.append(conn, action='account.export', target_kind='user', target_id=user['id'], actor=user, owner_id=user['id'])
        return {
            'schema': 'medforge.account-export/v1', 'exported_at': datetime.now(timezone.utc).isoformat(),
            'account': {'user_id': profile[0], 'learner_code': learner_code(profile[0]), 'display_name': profile[1],
                        'username': credential[0] if credential else None, 'roles': roles, 'created_at': profile[2]},
            'sessions': {'total': sessions[0] or 0, 'active': sessions[1] or 0, 'note': 'Session tokens are stored only as hashes and are not exported.'},
            'learning_attempts': attempts, 'answers': answers, 'audit_entries_you_performed': entries,
            'note': 'Passwords are stored only as salted PBKDF2 hashes and are never exported.',
        }

    @app.post('/api/v1/account/erase')
    def account_erase(request: AccountEraseRequest, user: dict = Depends(signed_in)):
        with db() as conn:
            row = conn.execute('SELECT salt,password_hash FROM local_credentials WHERE user_id=?', (user['id'],)).fetchone()
            if row is None or not verify_password(request.password, bytes(row[0]), bytes(row[1])):
                raise HTTPException(403, detail={'code': 'PASSWORD_CONFIRMATION_FAILED', 'message': 'Re-enter your current password to erase this account'})
            pseudonym = f'Erased account {learner_code(user["id"])}'
            conn.execute('UPDATE users SET display_name=? WHERE id=?', (pseudonym, user['id']))
            conn.execute('DELETE FROM local_sessions WHERE user_id=?', (user['id'],))
            conn.execute('DELETE FROM local_credentials WHERE user_id=?', (user['id'],))
            conn.execute('DELETE FROM role_grants WHERE user_id=?', (user['id'],))
            audit.append(conn, action='account.erase', target_kind='user', target_id=user['id'], actor={'id': user['id'], 'role': user['role']},
                         owner_id=user['id'], details={'retained': 'learning records and audit entries under the pseudonymous user ID'})
        return {'status': 'erased', 'learner_code': learner_code(user['id']), 'display_name': pseudonym}
