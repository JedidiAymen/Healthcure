"""Shared test helpers: provision visibly synthetic local accounts in the test database."""
from fastapi.testclient import TestClient

from app.auth import password_record
from app.main import _db

TEST_PASSWORD = 'local-test-password-123'


def provision_user(username: str, role: str) -> str:
    user_id = f'test-{username}'
    salt, digest = password_record(TEST_PASSWORD)
    with _db() as conn:
        conn.execute('INSERT INTO users(id,display_name) VALUES(?,?)', (user_id, username.title()))
        conn.execute('INSERT INTO local_credentials(user_id,username,salt,password_hash) VALUES(?,?,?,?)', (user_id, username, salt, digest))
        conn.execute('INSERT INTO role_grants(user_id,role,scope) VALUES(?,?,?)', (user_id, role, 'platform'))
    return user_id


def auth_headers(client: TestClient, username: str, role: str) -> dict[str, str]:
    provision_user(username, role)
    session = client.post('/api/v1/auth/local-login', json={'username': username, 'password': TEST_PASSWORD}).json()
    return {'Authorization': f"Bearer {session['access_token']}"}


def authorize_research_writer(client: TestClient, username: str = 'fixture-writer') -> TestClient:
    """Send an educator token by default so research write routes accept the client's requests."""
    client.headers.update(auth_headers(client, username, 'educator'))
    return client
