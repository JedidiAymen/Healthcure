"""Research write routes require an educator or admin token; research reads stay open on loopback."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import pytest

from app.main import create_app
from helpers import auth_headers

CASE = 'openkbp:test-synthetic-case'

# Every research POST/PUT route. Bodies are minimal: auth must be decided before validation.
WRITE_ROUTES = [
    ('post', '/api/v1/comparisons', {'case_id': 'fisav:pat001', 'channel': 'raw PZT1', 'selected_start_sec': 0, 'reference_start_sec': 1, 'duration_sec': 0.5}),
    ('put', f'/api/v1/cases/{CASE}/dose-artifacts?file_name=prediction.csv', None),
    ('post', '/api/v1/models/cvs-adaptnet/validate', {}),
    ('post', '/api/v1/runs', {'case_id': CASE, 'operation_id': 'openkbp.case_summary'}),
    ('post', '/api/v1/reports', {'run_id': 'unknown'}),
    ('post', '/api/v1/reports/dosetwin-comparison', {}),
    ('post', '/api/v1/reports/surgivision-frame', {}),
]


@pytest.fixture
def client(monkeypatch, tmp_path):
    case_dir = tmp_path / 'test-synthetic-case'
    case_dir.mkdir()
    (case_dir / 'voxel_dimensions.csv').write_text('2.0\n2.0\n2.0\n', encoding='utf8')
    for name, rows in [('ct.csv', '0,100\n'), ('dose.csv', '0,12\n'), ('possible_dose_mask.csv', '0,\n')]:
        (case_dir / name).write_text(',data\n' + rows, encoding='utf8')
    monkeypatch.setenv('MEDFORGE_OPENKBP_CASE_DIR', str(case_dir))
    monkeypatch.delenv('MEDFORGE_ENDOSCAPES_ROOT', raising=False)
    monkeypatch.delenv('MEDFORGE_FISAV_ROOT', raising=False)
    monkeypatch.setenv('MEDFORGE_DB_PATH', str(tmp_path / 'database.sqlite3'))
    monkeypatch.setenv('MEDFORGE_SOURCE_KIND', 'synthetic-test')
    return TestClient(create_app())


def _send(client, method, path, body, headers=None):
    if method == 'put':
        return client.put(path, content=b',data\n0,1\n', headers=headers or {})
    return client.post(path, json=body, headers=headers or {})


@pytest.mark.parametrize('method,path,body', WRITE_ROUTES)
def test_anonymous_research_write_is_rejected(client, method, path, body):
    response = _send(client, method, path, body)
    assert response.status_code == 401
    assert response.json()['detail']['code'] == 'AUTH_REQUIRED'


@pytest.mark.parametrize('method,path,body', WRITE_ROUTES)
def test_student_research_write_is_rejected(client, method, path, body):
    headers = auth_headers(client, 'learner', 'student')
    assert _send(client, method, path, body, headers).status_code == 403


@pytest.mark.parametrize('method,path,body', WRITE_ROUTES)
def test_clinical_reviewer_cannot_use_general_research_write_routes(client, method, path, body):
    headers = auth_headers(client, 'clinical-reviewer', 'clinical_reviewer')
    assert _send(client, method, path, body, headers).status_code == 403


@pytest.mark.parametrize('role', ['educator', 'admin'])
@pytest.mark.parametrize('method,path,body', WRITE_ROUTES)
def test_educator_and_admin_pass_the_write_gate(client, method, path, body, role):
    headers = auth_headers(client, f'writer-{role}', role)
    response = _send(client, method, path, body, headers)
    # The request may still fail on its own validation, but never on authorization.
    assert response.status_code not in (401, 403)


def test_research_reads_stay_open_without_a_token(client):
    for path in ['/api/v1/modules', '/api/v1/cases', '/api/v1/models', '/api/v1/runs', '/api/v1/reports', '/api/v1/comparisons']:
        assert client.get(path).status_code == 200, path
