"""Append-only, hash-chained audit log.

Every entry hashes the previous entry's hash together with its own canonical fields, so
removing, reordering or editing any row breaks the chain from that point. Database triggers
block UPDATE and DELETE; the chain makes tampering detectable even if they were bypassed.
Entries are appended inside the action's own transaction, after its write, so the SQLite write
lock is already held and two writers cannot fork the chain.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from typing import Any, Callable

from fastapi import Depends, FastAPI, Query
from pydantic import BaseModel, ConfigDict

from .auth import require_any_role

GENESIS = '0' * 64
ACTIONS = {
    'auth.login', 'auth.login_failed', 'auth.logout',
    'lesson.publish', 'assignment.create', 'attempt.submit', 'attempt.grade_release', 'cvs_self_check.commit',
    'report.save', 'comparison.save', 'dose_prediction.import',
    'signal_annotation.create', 'signal_annotation.delete',
    'model_output.review', 'expert_review.record',
    'account.export', 'account.erase',
}
FIELDS = ('created_at', 'actor_id', 'actor_role', 'action', 'target_kind', 'target_id', 'owner_id', 'details_json', 'prev_hash')


def _row_hash(values: dict[str, Any]) -> str:
    canonical = json.dumps({key: values[key] for key in FIELDS}, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


def append(conn, *, action: str, target_kind: str, target_id: str, actor: dict | None = None,
           owner_id: str | None = None, details: dict | None = None) -> str:
    """Append one entry using the caller's connection and transaction. Returns the row hash."""
    if action not in ACTIONS:
        raise ValueError(f'Unknown audit action {action}')
    if not conn.in_transaction:
        # Take the write lock before reading the chain head.
        conn.execute('BEGIN IMMEDIATE')
    head = conn.execute('SELECT row_hash FROM audit_log ORDER BY id DESC LIMIT 1').fetchone()
    values = {
        'created_at': datetime.now(timezone.utc).isoformat(), 'actor_id': actor['id'] if actor else None,
        'actor_role': actor.get('role') if actor else None, 'action': action, 'target_kind': target_kind,
        'target_id': str(target_id), 'owner_id': owner_id,
        'details_json': json.dumps(details or {}, sort_keys=True, separators=(',', ':'), ensure_ascii=False),
        'prev_hash': head[0] if head else GENESIS,
    }
    values['row_hash'] = _row_hash(values)
    conn.execute(f"INSERT INTO audit_log({','.join(values)}) VALUES ({','.join('?' for _ in values)})", tuple(values.values()))
    return values['row_hash']


def verify(conn) -> dict[str, Any]:
    """Walk the whole chain in id order and report the first broken link, if any."""
    expected_prev = GENESIS
    count = 0
    for row in conn.execute(f"SELECT id,{','.join(FIELDS)},row_hash FROM audit_log ORDER BY id"):
        values = dict(zip(('id', *FIELDS, 'row_hash'), row))
        count += 1
        if values['prev_hash'] != expected_prev:
            return {'ok': False, 'entries': count, 'first_broken_id': values['id'], 'reason': 'previous-hash link broken'}
        if _row_hash(values) != values['row_hash']:
            return {'ok': False, 'entries': count, 'first_broken_id': values['id'], 'reason': 'row content does not match its hash'}
        expected_prev = values['row_hash']
    return {'ok': True, 'entries': count, 'first_broken_id': None, 'reason': None, 'head_hash': expected_prev}


def lesson_owner_for_attempt(conn, attempt_id: str) -> str | None:
    row = conn.execute('''SELECT l.created_by FROM attempts t JOIN assignments a ON a.id=t.assignment_id
        JOIN lesson_versions v ON v.id=a.lesson_version_id JOIN lessons l ON l.id=v.lesson_id WHERE t.id=?''', (attempt_id,)).fetchone()
    return row[0] if row else None


class AuditEntry(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id: int
    created_at: str
    actor_id: str | None
    actor_role: str | None
    action: str
    target_kind: str
    target_id: str
    owner_id: str | None
    details: dict
    row_hash: str


class AuditVerification(BaseModel):
    model_config = ConfigDict(extra='forbid')
    ok: bool
    entries: int
    first_broken_id: int | None
    reason: str | None
    head_hash: str | None = None


def register_audit_routes(app: FastAPI, db: Callable) -> None:
    staff = require_any_role('educator')

    @app.get('/api/v1/audit/mine', response_model=list[AuditEntry])
    def audit_mine(limit: int = Query(100, ge=1, le=500), user: dict = Depends(staff)):
        """Entries this account performed, plus actions on content it owns (for example submissions to its lessons)."""
        with db() as conn:
            rows = conn.execute('''SELECT id,created_at,actor_id,actor_role,action,target_kind,target_id,owner_id,details_json,row_hash
                FROM audit_log WHERE actor_id=? OR owner_id=? ORDER BY id DESC LIMIT ?''', (user['id'], user['id'], limit)).fetchall()
        return [AuditEntry(id=r[0], created_at=r[1], actor_id=r[2], actor_role=r[3], action=r[4], target_kind=r[5], target_id=r[6],
                           owner_id=r[7], details=json.loads(r[8]), row_hash=r[9]) for r in rows]

    @app.get('/api/v1/audit/verify', response_model=AuditVerification)
    def audit_verify(user: dict = Depends(staff)):
        with db() as conn:
            return AuditVerification(**verify(conn))
