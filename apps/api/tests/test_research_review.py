"""DoseTwin research review on a visibly synthetic case and synthetic archived prediction."""
import hashlib
from pathlib import Path
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
import pytest

from app.main import _db, create_app
from helpers import auth_headers

PREDICTION = b',data\n0,18\n1,25\n3,41\n'


def _sparse(path: Path, items, binary=False):
    path.write_text(',data\n' + ''.join(f'{i},{"" if binary else value}\n' for i, value in items), encoding='utf8')


@pytest.fixture
def setup(monkeypatch, tmp_path):
    case = tmp_path / 'test-synthetic-case'
    case.mkdir()
    (case / 'voxel_dimensions.csv').write_text('2.0\n2.0\n2.0\n', encoding='utf8')
    _sparse(case / 'ct.csv', [(0, 100), (1, 200)])
    _sparse(case / 'dose.csv', [(0, 12), (1, 22), (3, 40)])
    _sparse(case / 'possible_dose_mask.csv', [(0, 0), (1, 0), (3, 0)], binary=True)
    _sparse(case / 'Brainstem.csv', [(0, 0), (1, 0)], binary=True)
    monkeypatch.setenv('MEDFORGE_OPENKBP_CASE_DIR', str(case))
    monkeypatch.delenv('MEDFORGE_ENDOSCAPES_ROOT', raising=False)
    monkeypatch.delenv('MEDFORGE_FISAV_ROOT', raising=False)
    monkeypatch.setenv('MEDFORGE_DB_PATH', str(tmp_path / 'review.sqlite3'))
    monkeypatch.setenv('MEDFORGE_DOSE_ARTIFACT_DIR', str(tmp_path / 'dose-artifacts'))
    # Imports are blocked for synthetic references; the benchmark kind lets the test reach the review flow.
    monkeypatch.setenv('MEDFORGE_SOURCE_KIND', 'benchmark')
    client = TestClient(create_app())
    educator = auth_headers(client, 'reviewer', 'educator')
    case_id = 'openkbp:test-synthetic-case'
    imported = client.put(f'/api/v1/cases/{case_id}/dose-artifacts?file_name=prediction.csv', content=PREDICTION, headers={
        **educator, 'Content-Type': 'text/csv', 'X-Dose-Origin': 'archived_model_prediction', 'X-Dose-Model-Revision': 'synthetic-model@test',
        'X-Dose-Source-Revision': 'synthetic-archive@test', 'X-Dose-Rights-Basis': 'Synthetic test fixture', 'X-Dose-Source-Case': case_id,
        'X-Dose-Rights-Confirmed': 'true', 'X-Dose-Unit': 'Gy', 'X-Dose-Index-Convention': 'x-major-y-middle-z-fastest',
        'X-Dose-Array-Shape': '128,128,128', 'X-Dose-Spacing-MM': '2,2,2', 'X-Dose-File-SHA256': hashlib.sha256(PREDICTION).hexdigest()})
    assert imported.status_code == 200, imported.text
    return client, educator, case_id, imported.json()['id']


def _create(client, headers, case_id, artifact_id, **extra):
    body = {'case_id': case_id, 'artifact_id': artifact_id, 'roi': 'Brainstem', 'decision': 'request_revision',
            'rationale': 'Brainstem mean dose differs from the reference.', 'voxel': [0, 0, 1], **extra}
    return client.post('/api/v1/research-reviews', json=body, headers=headers)


def test_voxel_inspector_reports_reference_prediction_and_signed_delta(setup):
    client, educator, case_id, artifact_id = setup
    voxel = client.get(f'/api/v1/cases/{case_id}/dose-artifacts/{artifact_id}/voxel?x=0&y=0&z=1', headers=educator).json()
    assert (voxel['reference_gy'], voxel['prediction_gy'], voxel['delta_gy']) == (22.0, 25.0, 3.0)
    assert voxel['roi_memberships'] == ['Brainstem'] and voxel['provenance_kind'] == 'ARCHIVED_PREDICTION'
    assert client.get(f'/api/v1/cases/{case_id}/dose-artifacts/{artifact_id}/voxel?x=0&y=0&z=1').status_code == 401


def test_review_freezes_server_computed_evidence_and_provenance(setup):
    client, educator, case_id, artifact_id = setup
    created = _create(client, educator, case_id, artifact_id)
    assert created.status_code == 201, created.text
    review = created.json()
    comparison = next(row for row in client.get(f'/api/v1/cases/{case_id}/dose-artifacts/{artifact_id}/comparison', headers=educator).json()['roi_comparisons'] if row['roi'] == 'Brainstem')
    assert review['evidence']['reference_mean_gy'] == comparison['reference_mean_gy'] == 17.0
    assert review['evidence']['prediction_mean_gy'] == comparison['prediction_mean_gy'] == 21.5
    assert review['evidence']['voxel']['delta_gy'] == 3.0
    assert review['decision_label'] == 'Request revision'
    assert review['provenance']['provenance_kind'] == 'ARCHIVED_PREDICTION'
    assert review['provenance']['prediction_sha256'] == hashlib.sha256(PREDICTION).hexdigest()
    assert review['provenance']['prediction_checkpoint_sha256'] == 'absent'
    assert review['boundary'] == 'For further expert review, not for patient treatment.'
    assert review['audit_row_hash'] and len(review['audit_row_hash']) == 64
    assert client.get(f"/api/v1/research-reviews/{review['id']}", headers=educator).json()['evidence'] == review['evidence']


def test_students_and_anonymous_users_cannot_record_reviews(setup):
    client, _, case_id, artifact_id = setup
    assert _create(client, {}, case_id, artifact_id).status_code == 401
    assert _create(client, auth_headers(client, 'learner', 'student'), case_id, artifact_id).status_code == 403


def test_every_research_review_route_enforces_the_documented_role_matrix(setup):
    client, educator, case_id, artifact_id = setup
    review = _create(client, educator, case_id, artifact_id).json()
    routes = {
        'voxel': lambda headers: client.get(
            f'/api/v1/cases/{case_id}/dose-artifacts/{artifact_id}/voxel?x=0&y=0&z=1', headers=headers),
        'create': lambda headers: _create(client, headers, case_id, artifact_id),
        'history': lambda headers: client.get(
            f'/api/v1/research-reviews?case_id={case_id}&artifact_id={artifact_id}', headers=headers),
        'detail': lambda headers: client.get(f"/api/v1/research-reviews/{review['id']}", headers=headers),
        'export': lambda headers: client.get(f"/api/v1/research-reviews/{review['id']}/export", headers=headers),
        'fhir': lambda headers: client.get(f"/api/v1/research-reviews/{review['id']}/fhir", headers=headers),
    }
    success_status = {'create': 201, **{name: 200 for name in routes if name != 'create'}}

    for route, request in routes.items():
        assert request({}).status_code == 401, f'{route} must require a local session'
        assert request(educator).status_code == success_status[route], f'educator must be allowed on {route}'

    admin = auth_headers(client, 'review-admin', 'admin')
    for route, request in routes.items():
        assert request(admin).status_code == success_status[route], f'admin must be allowed on {route}'

    for role in ('student', 'researcher'):
        headers = auth_headers(client, f'review-{role}', role)
        for route, request in routes.items():
            assert request(headers).status_code == 403, f'{role} must be denied on {route}'


def test_rationale_and_decision_are_validated(setup):
    client, educator, case_id, artifact_id = setup
    assert _create(client, educator, case_id, artifact_id, rationale='too short').status_code == 422
    assert _create(client, educator, case_id, artifact_id, decision='approve_for_treatment').status_code == 422
    assert _create(client, educator, case_id, artifact_id, roi='Larynx').status_code == 422


def test_reviews_are_immutable_and_revisions_supersede(setup):
    client, educator, case_id, artifact_id = setup
    first = _create(client, educator, case_id, artifact_id).json()
    second = _create(client, educator, case_id, artifact_id, decision='accept_for_further_expert_assessment',
                     rationale='Revision reviewed; acceptable for further expert assessment.', supersedes_id=first['id'])
    assert second.status_code == 201 and second.json()['supersedes_id'] == first['id']
    assert _create(client, educator, case_id, artifact_id, supersedes_id='rev_' + '0' * 32).status_code == 404
    for statement in ("UPDATE research_reviews SET decision='reject_research_candidate'", 'DELETE FROM research_reviews'):
        with pytest.raises(sqlite3.DatabaseError, match='immutable'):
            with _db() as conn:
                conn.execute(statement)
    listed = client.get(f'/api/v1/research-reviews?case_id={case_id}&artifact_id={artifact_id}', headers=educator).json()
    assert [item['id'] for item in listed] == [second.json()['id'], first['id']]


def test_export_is_auditable(setup):
    client, educator, case_id, artifact_id = setup
    review = _create(client, educator, case_id, artifact_id).json()
    report = client.get(f"/api/v1/research-reviews/{review['id']}/export", headers=educator).json()
    assert report['schema'] == 'medforge.research-review-report/v1'
    assert report['audit_chain_verified'] is True
    assert report['review']['audit_row_hash'] == review['audit_row_hash']
    actions = {entry['action'] for entry in client.get('/api/v1/audit/mine', headers=educator).json()}
    assert 'research_review.decision' in actions


def test_fhir_export_validates_against_the_r4_schema_and_is_tagged_test_data(setup):
    import json
    import zipfile
    import jsonschema
    client, educator, case_id, artifact_id = setup
    review = _create(client, educator, case_id, artifact_id).json()
    bundle = client.get(f"/api/v1/research-reviews/{review['id']}/fhir", headers=educator).json()
    with zipfile.ZipFile(Path(__file__).with_name('fixtures') / 'fhir-r4.schema.json.zip') as archive:
        schema = json.loads(archive.read('fhir.schema.json'))
    jsonschema.Draft6Validator(schema).validate(bundle)
    kinds = [entry['resource']['resourceType'] for entry in bundle['entry']]
    assert kinds == ['Patient', 'Observation', 'Observation', 'Observation', 'DiagnosticReport', 'Provenance']
    patient = bundle['entry'][0]['resource']
    assert set(patient) == {'resourceType', 'identifier', 'meta'}, 'no demographics'
    assert all(entry['resource']['meta']['security'][0]['code'] == 'HTEST' for entry in bundle['entry'])
    report = bundle['entry'][4]['resource']
    assert report['status'] == 'preliminary' and 'not for patient treatment' in report['conclusion']
    assert 'not MEDFORGE inference' in bundle['entry'][2]['resource']['code']['text']
    # The schema check is real: a resource with an invalid status fails.
    broken = json.loads(json.dumps(bundle))
    broken['entry'][1]['resource']['status'] = 'definitely-final'
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.Draft6Validator(schema).validate(broken)
