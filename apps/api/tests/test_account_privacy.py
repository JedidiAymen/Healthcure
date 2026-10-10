"""Account export and erasure (pseudonymisation) for local accounts."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import pytest

from app.account_privacy import learner_code
from app.main import _db, create_app
from helpers import TEST_PASSWORD, auth_headers


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.delenv('MEDFORGE_OPENKBP_CASE_DIR', raising=False)
    monkeypatch.setenv('MEDFORGE_DB_PATH', str(tmp_path / 'privacy.sqlite3'))
    return TestClient(create_app())


def test_export_returns_own_data_without_secrets(client):
    headers = auth_headers(client, 'learner', 'student')
    export = client.get('/api/v1/account/export', headers=headers)
    assert export.status_code == 200
    body = export.json()
    assert body['account']['username'] == 'learner' and body['account']['learner_code'] == learner_code('test-learner')
    assert 'password' not in str(body['account']) and 'token' not in str(body['sessions']).lower().replace('session tokens', '')
    assert any(entry['action'] == 'auth.login' for entry in body['audit_entries_you_performed'])
    assert client.get('/api/v1/account/export').status_code == 401


def test_erase_requires_password_and_confirmation_then_pseudonymises(client):
    headers = auth_headers(client, 'learner', 'student')
    assert client.post('/api/v1/account/erase', headers=headers, json={'password': TEST_PASSWORD, 'confirm': 'yes'}).status_code == 422
    assert client.post('/api/v1/account/erase', headers=headers, json={'password': 'wrong-password', 'confirm': 'ERASE MY ACCOUNT'}).status_code == 403
    erased = client.post('/api/v1/account/erase', headers=headers, json={'password': TEST_PASSWORD, 'confirm': 'ERASE MY ACCOUNT'})
    assert erased.status_code == 200 and erased.json()['display_name'].startswith('Erased account L-')
    # The session is gone and the credentials no longer work.
    assert client.get('/api/v1/auth/me', headers=headers).status_code == 401
    assert client.post('/api/v1/auth/local-login', json={'username': 'learner', 'password': TEST_PASSWORD}).status_code == 401
    with _db() as conn:
        assert conn.execute("SELECT display_name FROM users WHERE id='test-learner'").fetchone()[0].startswith('Erased account')
        assert conn.execute("SELECT count(*) FROM local_credentials WHERE user_id='test-learner'").fetchone()[0] == 0
        assert conn.execute("SELECT count(*) FROM audit_log WHERE action='account.erase'").fetchone()[0] == 1
