"""Hash-chained audit log: append-only triggers, tamper detection, coverage of sensitive actions, educator view."""
from pathlib import Path
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import pytest

from app import audit
from app.main import _db, create_app
from helpers import auth_headers
from test_signal_tools import _synthetic_record

RUBRIC = [{'id': 'evidence', 'title': 'Evidence', 'description': 'Uses the window.', 'max_points': 60},
          {'id': 'limits', 'title': 'Limits', 'description': 'States limits.', 'max_points': 40}]


@pytest.fixture
def client(monkeypatch, tmp_path):
    root = tmp_path / 'fisav'
    root.mkdir()
    _synthetic_record(root)
    monkeypatch.setenv('MEDFORGE_FISAV_ROOT', str(root))
    monkeypatch.delenv('MEDFORGE_OPENKBP_CASE_DIR', raising=False)
    monkeypatch.delenv('MEDFORGE_ENDOSCAPES_ROOT', raising=False)
    monkeypatch.setenv('MEDFORGE_DB_PATH', str(tmp_path / 'audit.sqlite3'))
    return TestClient(create_app())


def _actions(conn):
    return [row[0] for row in conn.execute('SELECT action FROM audit_log ORDER BY id')]


def test_entries_chain_and_verify(client):
    with _db() as conn:
        for index in range(3):
            audit.append(conn, action='report.save', target_kind='report', target_id=f'r{index}', actor={'id': 'u1', 'role': 'educator'})
    with _db() as conn:
        result = audit.verify(conn)
        rows = conn.execute('SELECT prev_hash,row_hash FROM audit_log ORDER BY id').fetchall()
    assert result['ok'] and result['entries'] == 3
    assert rows[0][0] == audit.GENESIS and rows[1][0] == rows[0][1] and rows[2][0] == rows[1][1]


def test_update_and_delete_are_blocked_by_triggers(client):
    with _db() as conn:
        audit.append(conn, action='report.save', target_kind='report', target_id='r1')
    for statement in ("UPDATE audit_log SET target_id='forged'", 'DELETE FROM audit_log'):
        with pytest.raises(sqlite3.DatabaseError, match='append-only'):
            with _db() as conn:
                conn.execute(statement)


def test_tampering_is_detected_even_if_triggers_are_bypassed(client):
    with _db() as conn:
        for index in range(4):
            audit.append(conn, action='report.save', target_kind='report', target_id=f'r{index}')
    with _db() as conn:
        conn.execute('DROP TRIGGER audit_log_no_update')
        conn.execute("UPDATE audit_log SET target_id='forged' WHERE id=2")
    with _db() as conn:
        broken = audit.verify(conn)
    assert broken == {'ok': False, 'entries': 2, 'first_broken_id': 2, 'reason': 'row content does not match its hash'}
    with _db() as conn:
        conn.execute('DROP TRIGGER audit_log_no_delete')
        conn.execute("UPDATE audit_log SET target_id='r1' WHERE id=2")
        conn.execute('DELETE FROM audit_log WHERE id=3')
    with _db() as conn:
        removed = audit.verify(conn)
    assert removed['ok'] is False and removed['first_broken_id'] == 4 and removed['reason'] == 'previous-hash link broken'


def test_unknown_actions_are_refused(client):
    with _db() as conn:
        with pytest.raises(ValueError):
            audit.append(conn, action='made.up', target_kind='x', target_id='y')


def test_sensitive_flows_write_entries_and_educators_see_their_own_content(client):
    bad = client.post('/api/v1/auth/local-login', json={'username': 'nobody', 'password': 'wrong-password-123'})
    assert bad.status_code == 401
    educator = auth_headers(client, 'teacher', 'educator')
    student = auth_headers(client, 'learner', 'student')
    draft = client.post('/api/v1/educator/drafts', headers=educator, json={'title': 'Audit lesson', 'case_id': 'fisav:pat001',
        'content': {'rubric': 'Manual.', 'rubric_criteria': RUBRIC, 'blocks': [{'id': 'q', 'type': 'Question', 'title': 'Q', 'content': 'Describe the window.'}]}}).json()
    assert client.get(f"/api/v1/educator/drafts/{draft['id']}/preview", headers=educator).status_code == 200
    version = client.post(f"/api/v1/educator/drafts/{draft['id']}/publish", headers=educator,
                          json={'source_terms_confirmed': True, 'source_review_note': 'Synthetic test source reviewed.'}).json()
    cohort = client.post('/api/v1/educator/cohorts', headers=educator, json={'name': 'Audit cohort'}).json()
    client.post(f"/api/v1/educator/cohorts/{cohort['id']}/students", headers=educator, json={'student_id': 'test-learner'})
    assignment = client.post('/api/v1/educator/assignments', headers=educator, json={'lesson_version_id': version['version_id'], 'cohort_id': cohort['id']}).json()
    attempt = client.post('/api/v1/academy/attempts', headers=student, json={'assignment_id': assignment['id']}).json()
    saved = client.put(f"/api/v1/academy/attempts/{attempt['attempt_id']}/draft", headers=student, json={
        'expected_revision': 0, 'observations': [{'block_id': 'q', 'response': 'A regular pulse pattern.'}],
        'viewer_evidence': {'kind': 'fistulaguard', 'case_id': 'fisav:pat001', 'record_id': 'pat001', 'channel': 'raw PZT1', 'start_sec': 0, 'duration_sec': 5}}).json()
    assert client.post(f"/api/v1/academy/attempts/{attempt['attempt_id']}/submit", headers={**student, 'Idempotency-Key': 'audit-submit-1'},
                       json={'expected_revision': saved['revision']}).status_code == 200
    graded = client.post(f"/api/v1/educator/attempts/{attempt['attempt_id']}/grade", headers={**educator, 'Idempotency-Key': 'audit-grade-1'}, json={
        'criterion_scores': [{'criterion_id': 'evidence', 'earned_points': 50}, {'criterion_id': 'limits', 'earned_points': 30}],
        'feedback': 'Good use of the window.', 'reason': 'First review of this attempt.'})
    assert graded.status_code == 200, graded.text
    annotation = client.post('/api/v1/fistulaguard/records/pat001/annotations', headers=educator,
                             json={'channel': 'raw PZT1', 'start_sec': 1, 'end_sec': 2, 'label': 'Steady pattern'}).json()
    client.delete(f"/api/v1/fistulaguard/annotations/{annotation['id']}", headers=educator)
    client.post('/api/v1/auth/logout', headers=student)

    with _db() as conn:
        actions = _actions(conn)
        assert audit.verify(conn)['ok']
    for expected in ['auth.login_failed', 'auth.login', 'lesson.publish', 'assignment.create', 'attempt.submit',
                     'attempt.grade_release', 'signal_annotation.create', 'signal_annotation.delete', 'auth.logout']:
        assert expected in actions, expected

    mine = client.get('/api/v1/audit/mine', headers=educator).json()
    mine_actions = {entry['action'] for entry in mine}
    # The educator sees their own actions and the learner's submission to their lesson.
    assert {'lesson.publish', 'assignment.create', 'attempt.grade_release', 'attempt.submit'} <= mine_actions
    assert 'auth.logout' not in mine_actions
    other = auth_headers(client, 'other-teacher', 'educator')
    assert {entry['action'] for entry in client.get('/api/v1/audit/mine', headers=other).json()} == {'auth.login'}
    # The first student signed out above; a revoked token gets 401, another student's token 403.
    assert client.get('/api/v1/audit/mine', headers=student).status_code == 401
    assert client.get('/api/v1/audit/mine', headers=auth_headers(client, 'learner-two', 'student')).status_code == 403
    assert client.get('/api/v1/audit/verify', headers=educator).json()['ok'] is True
