"""Contract and local-only API tests using visibly synthetic data; not clinical validation."""
import json
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest
from app.main import create_app
from app.schemas import ViewerManifest


def _sparse(path: Path, items: list[tuple[int,float]], *, binary=False):
    path.write_text(',data\n'+''.join(f'{i},{"" if binary else value}\n' for i,value in items),encoding='utf8')


@pytest.fixture
def client(monkeypatch,tmp_path):
    case_dir=tmp_path/'test-synthetic-case'
    case_dir.mkdir()
    (case_dir/'voxel_dimensions.csv').write_text('2.0\n2.0\n2.0\n',encoding='utf8')
    _sparse(case_dir/'ct.csv',[(0,100),(1,200)])
    _sparse(case_dir/'dose.csv',[(0,12),(1,22),(3,40)])
    _sparse(case_dir/'possible_dose_mask.csv',[(0,0),(1,0),(3,0)],binary=True)
    _sparse(case_dir/'Brainstem.csv',[(0,0),(1,0)],binary=True)
    monkeypatch.setenv('MEDFORGE_OPENKBP_CASE_DIR',str(case_dir))
    monkeypatch.setenv('MEDFORGE_DB_PATH',str(tmp_path/'database.sqlite3'))
    monkeypatch.setenv('MEDFORGE_SOURCE_KIND','synthetic-test')
    return TestClient(create_app())


def test_modules_no_false_model_ready(client):
    payload=client.get('/api/v1/modules').json()
    assert len(payload)==3
    assert payload[1]['capability_state']=='ready'
    assert payload[0]['capability_state']=='unverified'
    assert payload[2]['capability_state']=='unverified'
    assert all(m['readiness']!='ready' for m in client.get('/api/v1/models').json())


def test_manifest_marked_synthetic_and_geometry_not_invented(client):
    cid=client.get('/api/v1/cases').json()[0]['id']
    r=client.get('/api/v1/cases/'+cid+'/viewer-manifest')
    assert r.status_code==200
    manifest=ViewerManifest.model_validate(r.json())
    a=manifest.artifacts[0]
    assert a.shape==(128,128,128)
    assert a.spacing_mm==(2,2,2)
    assert a.native_dicom_coordinates is False
    assert 'SYNTHETIC' in manifest.provenance_label


def test_run_is_real_calculation_of_synthetic_fixture_and_idempotent(client):
    cid=client.get('/api/v1/cases').json()[0]['id']
    payload={'case_id':cid,'operation_id':'openkbp.case_summary'}
    r1=client.post('/api/v1/runs',json=payload)
    assert r1.status_code==200,r1.text
    first=r1.json()
    assert first['source_kind']=='synthetic-test'
    assert first['results']['available_rois']['Brainstem']['dmean_gy']==17.0
    assert first['provenance']['clinical_use'].startswith('not validated')
    r2=client.post('/api/v1/runs',json=payload)
    assert r2.json()['id']==first['id']
    assert client.get('/api/v1/runs/'+first['id']).status_code==200


def test_inference_unavailable_fails_safe(client):
    cid=client.get('/api/v1/cases').json()[0]['id']
    check=client.post('/api/v1/models/cvs-adaptnet/validate',json={
        'case_id':cid,'operation_id':'cvs.inference'}).json()
    assert check['executable'] is False
    invalid=client.post('/api/v1/runs',json={'case_id':cid,'operation_id':'cvs.inference'})
    assert invalid.status_code==422


def test_unknown_case_and_extra_fields_rejected(client):
    assert client.get('/api/v1/cases/nosuchcase').status_code==404
    cid=client.get('/api/v1/cases').json()[0]['id']
    response=client.post('/api/v1/runs',json={'case_id':cid,'operation_id':'openkbp.case_summary','shell':'rm -rf /'})
    assert response.status_code==422


def test_openapi_declares_discriminated_artifact(client):
    spec=client.get('/openapi.json').json()
    assert '/api/v1/runs' in spec['paths']
    assert 'ViewerManifest' in spec['components']['schemas']
    assert '/api/v1/models/{model_id}/validate' in spec['paths']
