"""Contract and local-only API tests using visibly synthetic data; not clinical validation."""
import json
import hashlib
import os
from pathlib import Path
import sqlite3
import sys
import base64

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest
import app.main as main
from app.main import create_app, _db
from app.auth import password_record
from app.schemas import SurgicalFrameRecord, ViewerManifest

RUBRIC = [
    {'id':'evidence','title':'Evidence use','description':'Connect observations to source data.','max_points':60},
    {'id':'limits','title':'Limits and uncertainty','description':'State what the evidence cannot establish.','max_points':40},
]


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
    monkeypatch.delenv('MEDFORGE_ENDOSCAPES_ROOT',raising=False)
    monkeypatch.setenv('MEDFORGE_DB_PATH',str(tmp_path/'database.sqlite3'))
    monkeypatch.setenv('MEDFORGE_SOURCE_KIND','synthetic-test')
    return TestClient(create_app())


def test_modules_no_false_model_ready(client):
    payload=client.get('/api/v1/modules').json()
    assert len(payload)==3
    assert payload[1]['capability_state']=='ready'
    assert payload[0]['capability_state']=='requires-setup'
    assert payload[2]['capability_state']=='requires-setup'
    assert all(m['readiness']!='ready' for m in client.get('/api/v1/models').json())


def test_model_registry_exposes_source_versions_licenses_and_asset_gate(client):
    models={item['id']:item for item in client.get('/api/v1/models').json()}
    assert all(item['source_revision'] and item['source_license'] for item in models.values())
    cvs=models['cvs-adaptnet']
    assert cvs['readiness']=='blocked'
    assert '409 records' in cvs['details']
    assert '38 file names' in cvs['details']
    assert 'not clinical validation' in cvs['details']
    archived=models['openkbp-opt-archives']
    assert archived['readiness']=='blocked'
    assert 'Malware detected' in archived['details']
    assert 'data-use terms' in archived['details']
    assert models['portpy-planning']['source_license'].startswith('Apache-2.0 with Commons Clause')


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


def test_dose_artifact_import_requires_real_reference_and_preserves_source_provenance(client,monkeypatch,tmp_path):
    cid=client.get('/api/v1/cases').json()[0]['id']
    payload=b',data\n0,18\n1,25\n3,41\n'
    digest=hashlib.sha256(payload).hexdigest()
    headers={
        'Content-Type':'text/csv','X-Dose-Origin':'archived_model_prediction',
        'X-Dose-Model-Revision':'model@abc123','X-Dose-Checkpoint-SHA256':'b'*64,
        'X-Dose-Source-Revision':'prediction-dataset@def456','X-Dose-Rights-Basis':'Local research permission recorded by the operator',
        'X-Dose-Source-Case':cid,
        'X-Dose-Rights-Confirmed':'true','X-Dose-Unit':'Gy',
        'X-Dose-Index-Convention':'x-major-y-middle-z-fastest','X-Dose-Array-Shape':'128,128,128',
        'X-Dose-Spacing-MM':'2,2,2','X-Dose-File-SHA256':digest,
    }
    monkeypatch.setenv('MEDFORGE_DOSE_ARTIFACT_DIR',str(tmp_path/'dose-artifacts'))
    rejected=client.put(f'/api/v1/cases/{cid}/dose-artifacts?file_name=prediction.csv',content=payload,headers=headers)
    assert rejected.status_code==422
    assert rejected.json()['detail']['code']=='SYNTHETIC_REFERENCE_BLOCKED'

    monkeypatch.setenv('MEDFORGE_SOURCE_KIND','benchmark')
    imported=client.put(f'/api/v1/cases/{cid}/dose-artifacts?file_name=prediction.csv',content=payload,headers=headers)
    assert imported.status_code==200,imported.text
    artifact=imported.json()
    assert artifact['source_file_sha256']==digest
    assert artifact['case_id']==cid
    assert artifact['validation_status']=='grid-validated-local-only'
    assert artifact['checkpoint_sha256']=='b'*64
    assert client.get(f'/api/v1/cases/{cid}/dose-artifacts').json()[0]['id']==artifact['id']

    prediction_only_headers={key:value for key,value in headers.items() if key!='X-Dose-Checkpoint-SHA256'}
    prediction_only=client.put(f'/api/v1/cases/{cid}/dose-artifacts?file_name=published-prediction.csv',content=payload,headers=prediction_only_headers)
    assert prediction_only.status_code==200,prediction_only.text
    assert prediction_only.json()['checkpoint_sha256'] is None

    comparison=client.get(f"/api/v1/cases/{cid}/dose-artifacts/{artifact['id']}/comparison")
    assert comparison.status_code==200,comparison.text
    brainstem=comparison.json()['roi_comparisons'][0]
    assert brainstem['roi']=='Brainstem'
    assert brainstem['reference_mean_gy']==17
    assert brainstem['prediction_mean_gy']==21.5
    assert brainstem['mean_delta_gy']==4.5
    assert len(brainstem['reference_dvh'])==51

    slice_result=client.get(f"/api/v1/cases/{cid}/dose-artifacts/{artifact['id']}/slice?axis=2&index=1")
    assert slice_result.status_code==200,slice_result.text
    values=slice_result.json()
    assert values['reference_gy'][0]==22
    assert values['prediction_gy'][0]==25
    assert values['delta_gy'][0]==3

    report_payload={'case_id':cid,'artifact_id':artifact['id'],'roi':'Brainstem','axis':2,'index':1}
    report=client.post('/api/v1/reports/dosetwin-comparison',json=report_payload)
    assert report.status_code==200,report.text
    saved=report.json()
    assert saved['run_id'] is None
    assert saved['document']['schema']=='medforge.dosetwin-dose-comparison/v1'
    assert saved['document']['source']['files_sha256']['prediction:prediction.csv']==digest
    assert saved['document']['comparison']['roi_comparisons'][0]['mean_delta_gy']==4.5
    again=client.post('/api/v1/reports/dosetwin-comparison',json=report_payload)
    assert again.json()['id']==saved['id']


def test_dose_artifact_import_rejects_wrong_grid_unit_and_negative_values(client,monkeypatch,tmp_path):
    cid=client.get('/api/v1/cases').json()[0]['id']
    monkeypatch.setenv('MEDFORGE_SOURCE_KIND','benchmark')
    monkeypatch.setenv('MEDFORGE_DOSE_ARTIFACT_DIR',str(tmp_path/'dose-artifacts'))
    headers={
        'Content-Type':'text/csv','X-Dose-Origin':'archived_model_prediction',
        'X-Dose-Model-Revision':'model@abc123','X-Dose-Checkpoint-SHA256':'b'*64,
        'X-Dose-Source-Revision':'prediction-dataset@def456','X-Dose-Rights-Basis':'Operator has local research permission',
        'X-Dose-Source-Case':cid,
        'X-Dose-Rights-Confirmed':'true','X-Dose-Unit':'Gy',
        'X-Dose-Index-Convention':'x-major-y-middle-z-fastest','X-Dose-Array-Shape':'128,128,128',
        'X-Dose-Spacing-MM':'2,2,2',
    }
    negative=client.put(f'/api/v1/cases/{cid}/dose-artifacts?file_name=prediction.csv',content=b',data\n0,-1\n1,2\n',headers=headers)
    assert negative.status_code==422
    assert 'negative' in negative.json()['detail']['message']
    wrong_unit=client.put(f'/api/v1/cases/{cid}/dose-artifacts?file_name=prediction.csv',content=b',data\n0,1\n',headers={**headers,'X-Dose-Unit':'cGy'})
    assert wrong_unit.status_code==422
    assert 'Gy' in wrong_unit.json()['detail']['message']
    wrong_grid=client.put(f'/api/v1/cases/{cid}/dose-artifacts?file_name=prediction.csv',content=b',data\n0,1\n',headers={**headers,'X-Dose-Array-Shape':'64,64,64'})
    assert wrong_grid.status_code==422
    assert '128,128,128' in wrong_grid.json()['detail']['message']
    wrong_case=client.put(f'/api/v1/cases/{cid}/dose-artifacts?file_name=prediction.csv',content=b',data\n0,1\n',headers={**headers,'X-Dose-Source-Case':'openkbp:another-case'})
    assert wrong_case.status_code==422
    assert 'case identity' in wrong_case.json()['detail']['message']
    wrong_spacing=client.put(f'/api/v1/cases/{cid}/dose-artifacts?file_name=prediction.csv',content=b',data\n0,1\n',headers={**headers,'X-Dose-Spacing-MM':'1,2,2'})
    assert wrong_spacing.status_code==422
    assert 'spacing' in wrong_spacing.json()['detail']['message']
    duplicate=client.put(f'/api/v1/cases/{cid}/dose-artifacts?file_name=prediction.csv',content=b',data\n0,1\n0,2\n',headers=headers)
    assert duplicate.status_code==422
    assert 'Duplicate' in duplicate.json()['detail']['message']
    nonfinite=client.put(f'/api/v1/cases/{cid}/dose-artifacts?file_name=prediction.csv',content=b',data\n0,nan\n',headers=headers)
    assert nonfinite.status_code==422
    assert 'Nonfinite' in nonfinite.json()['detail']['message']


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


def test_inference_unavailable_fails_safe(client,monkeypatch):
    gate_blockers=[
        'The test checkpoint is intentionally unavailable.',
        'Checkpoint-specific test terms are intentionally unconfirmed.',
    ]
    monkeypatch.setattr(main,'_cvs_worker_gate',lambda:(gate_blockers.copy(),None))
    monkeypatch.setattr(main,'_endoscapes_frame',lambda _case_id:None)
    cid=client.get('/api/v1/cases').json()[0]['id']
    check=client.post('/api/v1/models/cvs-adaptnet/validate',json={
        'case_id':cid,'operation_id':'cvs.inference'}).json()
    assert check['executable'] is False
    assert all(blocker in check['blockers'] for blocker in gate_blockers)
    invalid=client.post('/api/v1/runs',json={'case_id':cid,'operation_id':'cvs.inference'})
    assert invalid.status_code==404


def test_cvs_frame_run_persists_source_hashes_and_model_output(client,monkeypatch,tmp_path):
    image_path=tmp_path/'endoscapes'/'val'/'125_13175.jpg'
    image_path.parent.mkdir(parents=True)
    image_path.write_bytes(b'validated-source-frame')
    image_hash=hashlib.sha256(image_path.read_bytes()).hexdigest()
    annotation_hash='b'*64
    case_id='endoscapes:val:125_13175'
    frame=SurgicalFrameRecord(
        id=case_id,dataset_id='Endoscapes-BBox201',split='val',video_id=125,frame_number=13175,
        file_name='125_13175.jpg',width=854,height=480,image_sha256=image_hash,
        annotation_sha256=annotation_hash,annotations=[],cvs_criteria=(1.0,0.0,1.0),image_path=str(image_path),
    )
    monkeypatch.setenv('MEDFORGE_ENDOSCAPES_ROOT',str(image_path.parent.parent))
    monkeypatch.setattr(main,'_endoscapes_frame',lambda selected: frame if selected==case_id else None)
    monkeypatch.setattr(main,'_cvs_worker_gate',lambda: ([], 'c'*64))

    def fake_worker(command,**kwargs):
        assert command[command.index('--case-id')+1]==case_id
        output_path=Path(command[command.index('--output')+1])
        output_path.write_text(json.dumps({
            'case_scoped_run':True,'case_id':case_id,'annotation_count':1,
            'checkpoint_sha256':'c'*64,'annotation_sha256':annotation_hash,'prompt_sha256':main.sha256(main.ROOT/'references/upstream/CVS-AdaptNet/class_prompts/class_prompt_endoscapes_manual.txt'),
            'source_revision':main.ENDOSCAPES_SOURCE_REVISION,'model_revision':main.CVS_MODEL_REVISION,
            'text_preprocessing':{'upstream_process_text_tensor_parity':True},
            'labels_and_scores':[{'case_id':case_id,'scores':[0.55,0.44,0.51],
                'ds_reference':[1.0,0.0,1.0],'image_sha256':image_hash,'image_is_all_black_pixels':False}],
        }),encoding='utf8')
        return type('Completed',(),{'returncode':0,'stdout':'','stderr':''})()

    monkeypatch.setattr(main.subprocess,'run',fake_worker)
    response=client.post('/api/v1/runs',json={'case_id':case_id,'operation_id':'cvs.inference'})
    assert response.status_code==200,response.text
    first=response.json()
    assert first['status']=='completed'
    assert first['source_kind']=='research'
    assert first['results']['scores']==[0.55,0.44,0.51]
    assert first['provenance']['input_sha256']['image_sha256']==image_hash
    assert first['provenance']['input_sha256']['annotation_sha256']==annotation_hash
    assert first['provenance']['input_sha256']['checkpoint_sha256']=='c'*64
    assert first['provenance']['output_sha256']
    assert client.get('/api/v1/runs/'+first['id']).json()['results']==first['results']
    assert client.post('/api/v1/runs',json={'case_id':case_id,'operation_id':'cvs.inference'}).json()['id']==first['id']
    with _db() as conn:
        row=conn.execute('SELECT model_id,status FROM analysis_runs WHERE id=?',(first['id'],)).fetchone()
    assert row==('cvs-adaptnet','completed')


def test_unknown_case_and_extra_fields_rejected(client):
    assert client.get('/api/v1/cases/nosuchcase').status_code==404
    cid=client.get('/api/v1/cases').json()[0]['id']
    response=client.post('/api/v1/runs',json={'case_id':cid,'operation_id':'openkbp.case_summary','shell':'rm -rf /'})
    assert response.status_code==422


def test_openapi_declares_discriminated_artifact(client):
    spec=client.get('/openapi.json').json()
    assert '/api/v1/runs' in spec['paths']
    assert '/api/v1/reports' in spec['paths']
    assert 'ViewerManifest' in spec['components']['schemas']
    assert '/api/v1/models/{model_id}/validate' in spec['paths']
    assert '/api/v1/comparisons' in spec['paths']
    assert '/api/v1/comparisons/{comparison_id}' in spec['paths']
    grade_operation=spec['paths']['/api/v1/educator/attempts/{attempt_id}/grade']['post']
    idempotency_header=next(param for param in grade_operation['parameters'] if param['name']=='Idempotency-Key')
    assert idempotency_header['in']=='header' and idempotency_header['required'] is True
    assert idempotency_header['schema']['minLength']==8 and idempotency_header['schema']['maxLength']==128


def test_local_learning_sessions_enforce_provisioned_roles_and_revocation(client):
    for username,role in [('teacher','educator'),('learner','student')]:
        user_id=f'test-{username}'
        salt,digest=password_record('local-test-password-123')
        with _db() as conn:
            conn.execute('INSERT INTO users(id,display_name) VALUES(?,?)',(user_id,username.title()))
            conn.execute('INSERT INTO local_credentials(user_id,username,salt,password_hash) VALUES(?,?,?,?)',(user_id,username,salt,digest))
            conn.execute('INSERT INTO role_grants(user_id,role,scope) VALUES(?,?,?)',(user_id,role,'platform'))
    assert client.get('/api/v1/educator/evidence').status_code==401
    bad=client.post('/api/v1/auth/local-login',json={'username':'teacher','password':'wrong-password'})
    assert bad.status_code==401
    teacher=client.post('/api/v1/auth/local-login',json={'username':'teacher','password':'local-test-password-123'}).json()
    educator_headers={'Authorization':f"Bearer {teacher['access_token']}"}
    assert client.get('/api/v1/auth/me',headers=educator_headers).json()['role']=='educator'
    evidence=client.get('/api/v1/educator/evidence',headers=educator_headers)
    assert evidence.status_code==200 and len(evidence.json())==1
    assert evidence.json()[0]['license_label'].startswith('OpenKBP')
    assert evidence.json()[0]['publication_review']=='blocked'
    assert client.get('/api/v1/academy/challenges',headers=educator_headers).status_code==403

    student=client.post('/api/v1/auth/local-login',json={'username':'learner','password':'local-test-password-123'}).json()
    student_headers={'Authorization':f"Bearer {student['access_token']}"}
    assert client.get('/api/v1/educator/evidence',headers=student_headers).status_code==403
    assert client.get('/api/v1/academy/challenges',headers=student_headers).json()==[]
    assert client.get('/api/v1/academy/paths',headers=student_headers).status_code==200
    assert client.get('/api/v1/comparisons',headers=student_headers).status_code==403
    assert client.post('/api/v1/comparisons',headers=student_headers,json={
        'case_id':'fisav:pat001','channel':'raw PZT1','selected_start_sec':0,
        'reference_start_sec':1,'duration_sec':0.5}).status_code==403
    assert client.post('/api/v1/auth/logout',headers=student_headers).status_code==200
    assert client.get('/api/v1/academy/challenges',headers=student_headers).status_code==401


def test_educator_drafts_are_server_owned_revisioned_and_hidden_from_students(client):
    credentials='local-test-password-123'
    with _db() as conn:
        for user_id,username,role in [('teacher-a','teacher-a','educator'),('teacher-b','teacher-b','educator'),('learner-a','learner-a','student')]:
            salt,digest=password_record(credentials)
            conn.execute('INSERT INTO users(id,display_name) VALUES(?,?)',(user_id,username))
            conn.execute('INSERT INTO local_credentials(user_id,username,salt,password_hash) VALUES(?,?,?,?)',(user_id,username,salt,digest))
            conn.execute('INSERT INTO role_grants(user_id,role,scope) VALUES(?,?,?)',(user_id,role,'platform'))
    def auth(username):
        token=client.post('/api/v1/auth/local-login',json={'username':username,'password':credentials}).json()['access_token']
        return {'Authorization':f'Bearer {token}'}
    educator=auth('teacher-a');other_educator=auth('teacher-b');student=auth('learner-a')
    case_id=client.get('/api/v1/cases').json()[0]['id']
    request={'title':'Source review','case_id':case_id,'content':{'rubric':'PRIVATE: answer key','rubric_criteria':RUBRIC,'blocks':[{'id':'b1','type':'Question','title':'Inspect the source','content':'Explain the visible evidence.'}]}}
    created=client.post('/api/v1/educator/drafts',json=request,headers=educator)
    assert created.status_code==201,created.text
    draft=created.json();draft_id=draft['id']
    assert draft['revision']==1 and draft['content']['rubric']=='PRIVATE: answer key'
    assert client.get('/api/v1/educator/drafts/'+draft_id,headers=other_educator).status_code==404
    assert client.get('/api/v1/educator/drafts/'+draft_id,headers=student).status_code==403
    changed={**request,'title':'Revised source review','expected_revision':1}
    saved=client.put('/api/v1/educator/drafts/'+draft_id,json=changed,headers=educator)
    assert saved.status_code==200 and saved.json()['revision']==2
    stale=client.put('/api/v1/educator/drafts/'+draft_id,json=changed,headers=educator)
    assert stale.status_code==409
    assert client.get('/api/v1/educator/drafts',headers=educator).json()[0]['id']==draft_id
    academy=client.get('/api/v1/academy/challenges',headers=student)
    assert academy.status_code==200 and academy.json()==[]
    assert 'PRIVATE: answer key' not in academy.text and draft_id not in academy.text


def test_student_challenges_require_published_version_and_matching_cohort(client):
    credentials='local-test-password-123'
    with _db() as conn:
        salt,digest=password_record(credentials)
        conn.execute('INSERT INTO users(id,display_name) VALUES(?,?)',('student-member','Member'))
        conn.execute('INSERT INTO local_credentials(user_id,username,salt,password_hash) VALUES(?,?,?,?)',('student-member','member',salt,digest))
        conn.execute("INSERT INTO role_grants(user_id,role,scope) VALUES('student-member','student','platform')")
    token=client.post('/api/v1/auth/local-login',json={'username':'member','password':credentials}).json()['access_token']
    headers={'Authorization':f'Bearer {token}'}
    teacher_id='test-teacher'
    with _db() as conn:
        salt,digest=password_record(credentials)
        conn.execute('INSERT INTO users(id,display_name) VALUES(?,?)',(teacher_id,'Teacher'))
        conn.execute('INSERT INTO local_credentials(user_id,username,salt,password_hash) VALUES(?,?,?,?)',(teacher_id,'testteacher',salt,digest))
        conn.execute("INSERT INTO role_grants(user_id,role,scope) VALUES(?,'educator','platform')",(teacher_id,))
    teacher_token=client.post('/api/v1/auth/local-login',json={'username':'testteacher','password':credentials}).json()['access_token']
    case_id=client.get('/api/v1/cases').json()[0]['id']
    draft=client.post('/api/v1/educator/drafts',headers={'Authorization':f'Bearer {teacher_token}'},json={
        'title':'Assigned lesson','case_id':case_id,
        'content':{'rubric':'hidden rubric','rubric_criteria':RUBRIC,'blocks':[{'id':'q','type':'Question','title':'Prompt','content':'Observe the reference.'}]}})
    assert draft.status_code==201,draft.text
    lesson_id='lesson-assignment-test'
    with _db() as conn:
        conn.execute('INSERT INTO lessons(id,module,created_by,title) VALUES(?,?,?,?)',(lesson_id,draft.json()['module'],teacher_id,'Assigned lesson'))
        conn.execute("INSERT INTO lesson_versions(id,lesson_id,version,case_id,status,student_manifest_json,secret_rubric_json,published_at) VALUES(?,?,1,?,'published',?,?,CURRENT_TIMESTAMP)",
            ('version-assigned',lesson_id,case_id,json.dumps({'title':'Visible prompt','module':'dosetwin','case_id':case_id,'case_label':'Local test case','dataset_id':'OpenKBP','reference_kind':'benchmark','source_license':'Test only','blocks':[{'id':'q','type':'Question','title':'Prompt','content':'Observe the reference.'}]}),'{"answer":"private"}'))
        conn.execute("INSERT INTO lesson_versions(id,lesson_id,version,case_id,status,student_manifest_json,secret_rubric_json) VALUES(?,?,2,?,'draft',?,?)",
            ('version-unpublished',lesson_id,case_id,json.dumps({'title':'Draft prompt','module':'dosetwin','case_id':case_id,'case_label':'Local test case','dataset_id':'OpenKBP','reference_kind':'benchmark','source_license':'Test only','blocks':[{'id':'q','type':'Question','title':'Prompt','content':'Observe the reference.'}]}),'{"answer":"draft secret"}'))
        conn.execute('INSERT INTO assignments(id,lesson_version_id,cohort_id) VALUES(?,?,?)',('assignment-member','version-assigned','cohort-a'))
        conn.execute('INSERT INTO assignments(id,lesson_version_id,cohort_id) VALUES(?,?,?)',('assignment-outside','version-assigned','cohort-b'))
        conn.execute('INSERT INTO assignments(id,lesson_version_id,cohort_id) VALUES(?,?,?)',('assignment-draft','version-unpublished','cohort-a'))
        conn.execute("INSERT INTO learning_cohort_memberships(user_id,cohort_id) VALUES('student-member','cohort-a')")
    response=client.get('/api/v1/academy/challenges',headers=headers)
    assert response.status_code==200
    assert [challenge['version_id'] for challenge in response.json()]==['version-assigned']
    assert response.json()[0]['state']=='not_started'
    assert 'private' not in response.text and 'rubric' not in response.text and 'assignment-outside' not in response.text
    paths=client.get('/api/v1/academy/paths',headers=headers)
    assert paths.status_code==200,paths.text
    radiation_path=next(path for path in paths.json() if path['path_id']=='radiation-physics')
    assert radiation_path['assigned_count']==1
    assert radiation_path['lessons'][0]['assignment_id']=='assignment-member'
    assert radiation_path['lessons'][0]['case_id']==case_id
    assert radiation_path['lessons'][0]['state']=='not_started'
    assert radiation_path['source_attribution']==['OpenKBP test-synthetic-case · Test only']
    assert 'hidden rubric' not in paths.text and 'assignment-outside' not in paths.text


def test_authentic_fisav_learning_delivery_with_delayed_reference_release(client,monkeypatch):
    # Publication uses a locally installed, source-manifested FiSaV case. The
    # test never invents a source license or depends on synthetic fixture data.
    fisav_root=Path(__file__).resolve().parents[3]/'data'/'fisav'
    if not (fisav_root/'medforge-source-manifest.json').is_file():
        pytest.skip('The authentic local FiSaV source manifest is not installed')
    monkeypatch.setenv('MEDFORGE_FISAV_ROOT',str(fisav_root))
    endo_root=Path(__file__).resolve().parents[3]/'data'/'endoscapes'
    if (endo_root/'medforge-source-manifest.json').is_file():
        monkeypatch.setenv('MEDFORGE_ENDOSCAPES_ROOT',str(endo_root))
    password='local-test-password-123'
    with _db() as conn:
        for user_id,username,name,role in [
            ('learning-teacher','learningteacher','Learning Teacher','educator'),
            ('learning-outsider','learningoutsider','Other Educator','educator'),
            ('learning-student','learningstudent','Learning Student','student'),
        ]:
            salt,digest=password_record(password)
            conn.execute('INSERT INTO users(id,display_name) VALUES(?,?)',(user_id,name))
            conn.execute('INSERT INTO local_credentials(user_id,username,salt,password_hash) VALUES(?,?,?,?)',(user_id,username,salt,digest))
            conn.execute('INSERT INTO role_grants(user_id,role,scope) VALUES(?,?,\'platform\')',(user_id,role))
    def auth(username):
        token=client.post('/api/v1/auth/local-login',json={'username':username,'password':password}).json()['access_token']
        return {'Authorization':f'Bearer {token}'}
    educator=auth('learningteacher');outsider=auth('learningoutsider');student=auth('learningstudent')
    case=next(item for item in client.get('/api/v1/cases').json() if item['module']=='fistulaguard')
    draft=client.post('/api/v1/educator/drafts',headers=educator,json={
        'title':'Read a measured source signal','case_id':case['id'],
        'content':{'rubric':'Compare the trace with the provided metadata.','rubric_criteria':RUBRIC,'blocks':[
            {'id':'instructions','type':'Instruction','title':'Inspect the record','content':'Use the source recording and its timebase.'},
            {'id':'z-question','type':'Question','title':'What does the trace support?','content':'Describe one observation.'},
            {'id':'a-question','type':'Question','title':'What are its limits?','content':'Describe one limitation.'},
            {'id':'reference','type':'Reveal','title':'Educator reference','content':'The trace alone does not establish a diagnosis.'},
        ]}})
    assert draft.status_code==201,draft.text
    draft_id=draft.json()['id']
    preview=client.get(f'/api/v1/educator/drafts/{draft_id}/preview',headers=educator)
    assert preview.status_code==200 and preview.json()['source_license']=='CC BY 4.0'
    assert [block['id'] for block in preview.json()['blocks']]==['instructions','z-question','a-question']
    assert client.post(f'/api/v1/educator/drafts/{draft_id}/publish',headers=educator,json={
        'source_terms_confirmed':False,'source_review_note':'Reviewed local source terms.'}).status_code==422
    invalid_content={**draft.json()['content'],'rubric_criteria':[
        {'id':'evidence','title':'Evidence use','description':'Use source data.','max_points':60},
        {'id':'limits','title':'Limits','description':'State uncertainty.','max_points':30},
    ]}
    invalid_draft=client.put(f'/api/v1/educator/drafts/{draft_id}',headers=educator,json={
        'title':draft.json()['title'],'case_id':draft.json()['case_id'],'content':invalid_content,'expected_revision':1})
    assert invalid_draft.status_code==200
    invalid_publish=client.post(f'/api/v1/educator/drafts/{draft_id}/publish',headers=educator,json={
        'source_terms_confirmed':True,'source_review_note':'Source terms reviewed for local education.'})
    assert invalid_publish.status_code==422 and invalid_publish.json()['detail']['code']=='RUBRIC_INVALID'
    corrected=client.put(f'/api/v1/educator/drafts/{draft_id}',headers=educator,json={
        'title':draft.json()['title'],'case_id':draft.json()['case_id'],'content':draft.json()['content'],'expected_revision':2})
    assert corrected.status_code==200
    publish_request={'source_terms_confirmed':True,'source_review_note':'CC BY 4.0 attribution reviewed for this local learning use.'}
    published=client.post(f'/api/v1/educator/drafts/{draft_id}/publish',headers=educator,json=publish_request)
    assert published.status_code==200,published.text
    version=published.json()
    repeated=client.post(f'/api/v1/educator/drafts/{draft_id}/publish',headers=educator,json=publish_request)
    assert repeated.json()['version_id']==version['version_id']
    with _db() as conn:
        with pytest.raises(sqlite3.IntegrityError,match='immutable'):
            conn.execute('UPDATE lesson_versions SET version=version+1 WHERE id=?',(version['version_id'],))
        with pytest.raises(sqlite3.IntegrityError,match='cannot be deleted'):
            conn.execute('DELETE FROM lesson_versions WHERE id=?',(version['version_id'],))

    cohort=client.post('/api/v1/educator/cohorts',headers=educator,json={'name':'Signal seminar'})
    assert cohort.status_code==201,cohort.text
    cohort_id=cohort.json()['id']
    added=client.post(f'/api/v1/educator/cohorts/{cohort_id}/students',headers=educator,json={'student_id':'learning-student'})
    assert added.status_code==201
    assignment=client.post('/api/v1/educator/assignments',headers=educator,json={
        'lesson_version_id':version['version_id'],'cohort_id':cohort_id})
    assert assignment.status_code==201,assignment.text
    assignment_id=assignment.json()['id']
    educator_assignments=client.get('/api/v1/educator/assignments',headers=educator)
    assert educator_assignments.status_code==200,educator_assignments.text
    assert any(item['id']==assignment_id and item['student_count']==1 for item in educator_assignments.json())
    challenges=client.get('/api/v1/academy/challenges',headers=student)
    assert challenges.status_code==200 and any(item['assignment_id']==assignment_id for item in challenges.json())
    paths=client.get('/api/v1/academy/paths',headers=student)
    assert paths.status_code==200,paths.text
    signal_path=next(path for path in paths.json() if path['path_id']=='physiological-signals')
    assert signal_path['assigned_count']==1 and signal_path['lessons'][0]['assignment_id']==assignment_id
    assert signal_path['lessons'][0]['case_id']==case['id']
    assert signal_path['source_attribution']==[f"{case['label']} · CC BY 4.0"]
    assert signal_path['lessons'][0]['state']=='not_started'
    assert 'Educator reference' not in paths.text and 'The trace alone does not establish a diagnosis.' not in paths.text
    default_progress=client.get('/api/v1/academy/progress',headers=student)
    assert default_progress.status_code==200 and default_progress.json()['xp_enabled'] is False
    assert default_progress.json()['achievements_enabled'] is False and default_progress.json()['achievements']==[]
    assert default_progress.json()['xp']==0
    assert default_progress.json()['assigned_activities']==1
    assert default_progress.json()['next_activity']['assignment_id']==assignment_id
    assert default_progress.json()['next_activity']['state']=='start'
    opt_in=client.put('/api/v1/academy/preferences',headers=student,json={'xp_enabled':True})
    assert opt_in.status_code==200 and opt_in.json()['xp_enabled'] is True
    assert client.get('/api/v1/cases',headers=student).status_code==403
    assert client.get('/api/v1/models',headers=student).status_code==403
    assert client.get('/api/v1/fistulaguard/records/pat001',headers=student).status_code==200
    assert client.get('/api/v1/fistulaguard/records/pat002',headers=student).status_code==403
    attempt=client.post('/api/v1/academy/attempts',headers=student,json={'assignment_id':assignment_id})
    assert attempt.status_code==201,attempt.text
    signal_path=next(path for path in client.get('/api/v1/academy/paths',headers=student).json() if path['path_id']=='physiological-signals')
    assert signal_path['in_progress_count']==1 and signal_path['lessons'][0]['state']=='in_progress'
    attempt_id=attempt.json()['attempt_id']
    assert client.get('/api/v1/academy/progress',headers=student).json()['next_activity']['state']=='resume'
    assert attempt.json()['viewer_evidence'] is None
    assert 'rubric_criteria' not in attempt.json()['challenge'] and 'PRIVATE: answer key' not in attempt.text
    assert 'Educator reference' not in attempt.text and 'The trace alone does not establish a diagnosis.' not in attempt.text
    assert client.get(f'/api/v1/academy/attempts/{attempt_id}/debrief',headers=student).status_code==403
    saved=client.put(f'/api/v1/academy/attempts/{attempt_id}/draft',headers=student,json={
        'expected_revision':0,'observations':[
            {'block_id':'a-question','response':'This recording has uncalibrated units and cannot establish a diagnosis.'},
            {'block_id':'z-question','response':'The measured record varies over time.'},
        ]})
    assert saved.status_code==200 and saved.json()['revision']==1
    no_evidence_submit=client.post(f'/api/v1/academy/attempts/{attempt_id}/submit',headers={**student,'Idempotency-Key':'submit-learning-no-evidence'},json={'expected_revision':1})
    assert no_evidence_submit.status_code==422 and no_evidence_submit.json()['detail']['code']=='VIEWER_EVIDENCE_REQUIRED'
    stale=client.put(f'/api/v1/academy/attempts/{attempt_id}/draft',headers=student,json={'expected_revision':0,'observations':[]})
    assert stale.status_code==409
    source_evidence={'kind':'fistulaguard','case_id':case['id'],'record_id':case['source_case_id'],'channel':'raw PZT1','start_sec':2.5,'duration_sec':5}
    wrong_source=client.put(f'/api/v1/academy/attempts/{attempt_id}/draft',headers=student,json={'expected_revision':1,'observations':saved.json()['observations'],'viewer_evidence':{**source_evidence,'case_id':'fisav:pat002'}})
    assert wrong_source.status_code==422 and wrong_source.json()['detail']['code']=='VIEWER_EVIDENCE_CASE_MISMATCH'
    saved=client.put(f'/api/v1/academy/attempts/{attempt_id}/draft',headers=student,json={'expected_revision':1,'observations':saved.json()['observations'],'viewer_evidence':source_evidence})
    assert saved.status_code==200 and saved.json()['viewer_evidence']['start_sec']==2.5
    submit_headers={**student,'Idempotency-Key':'submit-learning-attempt-001'}
    receipt=client.post(f'/api/v1/academy/attempts/{attempt_id}/submit',headers=submit_headers,json={'expected_revision':2})
    assert receipt.status_code==200 and receipt.json()['state']=='review_required'
    signal_path=next(path for path in client.get('/api/v1/academy/paths',headers=student).json() if path['path_id']=='physiological-signals')
    assert signal_path['submitted_count']==1 and signal_path['lessons'][0]['state']=='submitted'
    assert client.get('/api/v1/academy/progress',headers=student).json()['next_activity']['state']=='awaiting_review'
    assert client.post(f'/api/v1/academy/attempts/{attempt_id}/submit',headers=submit_headers,json={'expected_revision':2}).json()==receipt.json()
    review=client.get(f'/api/v1/educator/assignments/{assignment_id}/attempts',headers=educator)
    assert review.status_code==200
    assert [observation['block_id'] for observation in review.json()[0]['observations']]==['z-question','a-question']
    assert review.json()[0]['observations'][0]['response']=='The measured record varies over time.'
    assert review.json()[0]['viewer_evidence']['case_id']==case['id']
    assert review.json()[0]['assigned_case']=={'module':'fistulaguard','case_id':case['id'],'case_label':case['label']}
    grade_payload={'criterion_scores':[{'criterion_id':'evidence','earned_points':52,'note':'Clear links to the trace.'},{'criterion_id':'limits','earned_points':36,'note':'A relevant limitation is identified.'}],'feedback':'Good source-grounded observation and a clear limitation.','reason':'Reviewed against the lesson rubric.'}
    invalid_grade=client.post(f'/api/v1/educator/attempts/{attempt_id}/grade',headers=educator,json={**grade_payload,'criterion_scores':[{'criterion_id':'evidence','earned_points':61,'note':''},{'criterion_id':'limits','earned_points':36,'note':''}]})
    assert invalid_grade.status_code==422 and any(error['loc']==['header','Idempotency-Key'] for error in invalid_grade.json()['detail'])
    invalid_grade=client.post(f'/api/v1/educator/attempts/{attempt_id}/grade',headers={**educator,'Idempotency-Key':'grade-invalid-001'},json={**grade_payload,'criterion_scores':[{'criterion_id':'evidence','earned_points':61,'note':''},{'criterion_id':'limits','earned_points':36,'note':''}]})
    assert invalid_grade.status_code==422 and invalid_grade.json()['detail']['code']=='RUBRIC_SCORE_OUT_OF_RANGE'
    grade_headers={**educator,'Idempotency-Key':'grade-original-001'}
    grade=client.post(f'/api/v1/educator/attempts/{attempt_id}/grade',headers=grade_headers,json=grade_payload)
    assert grade.status_code==200 and grade.json()['state']=='graded'
    assert grade.json()['assigned_case']==review.json()[0]['assigned_case']
    replay=client.post(f'/api/v1/educator/attempts/{attempt_id}/grade',headers=grade_headers,json=grade_payload)
    assert replay.status_code==200 and replay.json()==grade.json()
    changed_replay=client.post(f'/api/v1/educator/attempts/{attempt_id}/grade',headers=grade_headers,json={**grade_payload,'feedback':'A changed review with the same key.'})
    assert changed_replay.status_code==409 and changed_replay.json()['detail']['code']=='IDEMPOTENCY_KEY_REUSED'
    unauthorized_receipt=client.post(f'/api/v1/educator/attempts/{attempt_id}/grade',headers={**outsider,'Idempotency-Key':'grade-original-001'},json=grade_payload)
    assert unauthorized_receipt.status_code==404 and unauthorized_receipt.json()['detail']['code']=='ATTEMPT_NOT_FOUND'
    with _db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM grade_events WHERE attempt_id=? AND event_kind='manual-review'",(attempt_id,)).fetchone()[0]==1
    signal_path=next(path for path in client.get('/api/v1/academy/paths',headers=student).json() if path['path_id']=='physiological-signals')
    assert signal_path['reviewed_count']==1 and signal_path['lessons'][0]['state']=='reviewed'
    debrief=client.get(f'/api/v1/academy/attempts/{attempt_id}/debrief',headers=student)
    assert debrief.status_code==200
    assert debrief.json()['rubric']=='Compare the trace with the provided metadata.'
    assert debrief.json()['score']==88 and [item['earned_points'] for item in debrief.json()['criterion_scores']]==[52,36]
    assert debrief.json()['reveal_blocks'][0]['content']=='The trace alone does not establish a diagnosis.'
    assert debrief.json()['xp_awarded']==10
    revised_payload={**grade_payload,'criterion_scores':[{'criterion_id':'evidence','earned_points':54,'note':'Clear links to the trace.'},{'criterion_id':'limits','earned_points':36,'note':'A relevant limitation is identified.'}]}
    revised_grade=client.post(f'/api/v1/educator/attempts/{attempt_id}/grade',headers={**educator,'Idempotency-Key':'grade-correction-001'},json=revised_payload)
    assert revised_grade.status_code==200 and revised_grade.json()['score']==90
    assert client.post(f'/api/v1/educator/attempts/{attempt_id}/grade',headers=grade_headers,json=grade_payload).json()==grade.json()
    with _db() as conn:
        assert conn.execute("SELECT COUNT(*) FROM grade_events WHERE attempt_id=? AND event_kind='manual-review'",(attempt_id,)).fetchone()[0]==2
    final_progress=client.get('/api/v1/academy/progress',headers=student).json()
    assert final_progress['xp']==10 and final_progress['xp_enabled'] is True
    assert final_progress['graded_attempts']==1 and final_progress['average_score']==90.0
    assert {item['title']:item['average_percent'] for item in final_progress['rubric_dimensions']}=={'Evidence use':90.0,'Limits and uncertainty':90.0}
    assert len(final_progress['rubric_history'])==2
    assert {item['dimension_title']:item['earned_points'] for item in final_progress['rubric_history']}=={'Evidence use':54,'Limits and uncertainty':36}
    assert all(item['attempt_id']==attempt_id and item['lesson_title'] and item['percent'] is not None for item in final_progress['rubric_history'])
    assert final_progress['next_activity'] is None
    participation=client.get('/api/v1/academy/progress/export',headers=student)
    assert participation.status_code==200
    assert participation.json()['schema']=='medforge.education-participation/v1'
    assert len(participation.json()['activities'])==1
    assert participation.json()['activities'][0]['attempt_id']==attempt_id
    assert participation.json()['activities'][0]['state']=='graded'
    assert participation.json()['activities'][0]['score']==90.0
    assert 'observations' not in participation.json()['activities'][0]
    opt_out=client.put('/api/v1/academy/preferences',headers=student,json={'xp_enabled':False})
    assert opt_out.status_code==200 and client.get('/api/v1/academy/progress',headers=student).json()['xp_enabled'] is False
    assert client.get(f'/api/v1/academy/attempts/{attempt_id}/debrief',headers=student).json()['xp_awarded']==0
    assert client.get('/api/v1/academy/progress',headers=student).json()['achievements_enabled'] is False
    with _db() as conn:
        event=conn.execute('SELECT id FROM grade_events WHERE attempt_id=?',(attempt_id,)).fetchone()[0]
        with pytest.raises(sqlite3.IntegrityError,match='append-only'):
            conn.execute('UPDATE grade_events SET score_delta=0 WHERE id=?',(event,))

    if (endo_root/'medforge-source-manifest.json').is_file():
        endo_case=next(item for item in client.get('/api/v1/cases').json() if item['module']=='surgivision')
        endo_draft=client.post('/api/v1/educator/drafts',headers=educator,json={
            'title':'Observe an annotated surgical frame','case_id':endo_case['id'],
            'content':{'rubric':'Explain the visible evidence and its limits.','rubric_criteria':RUBRIC,'blocks':[{'id':'question','type':'Question','title':'What can you support?','content':'Describe visible evidence without claiming surgical clearance.'},{'id':'reference','type':'Reveal','title':'Reference annotations','content':'Compare your observations with the source labels after review.'}]}})
        assert endo_draft.status_code==201,endo_draft.text
        endo_publish=client.post(f"/api/v1/educator/drafts/{endo_draft.json()['id']}/publish",headers=educator,json={
            'source_terms_confirmed':True,'source_review_note':'Non-commercial research attribution and permitted classroom access reviewed.'})
        assert endo_publish.status_code==200,endo_publish.text
        endo_assignment=client.post('/api/v1/educator/assignments',headers=educator,json={
            'lesson_version_id':endo_publish.json()['version_id'],'cohort_id':cohort_id})
        assert endo_assignment.status_code==201,endo_assignment.text
        endo_attempt=client.post('/api/v1/academy/attempts',headers=student,json={'assignment_id':endo_assignment.json()['id']})
        assert endo_attempt.status_code==201,endo_attempt.text
        endo_attempt_id=endo_attempt.json()['attempt_id']
        assert 'annotations' not in endo_attempt.text and 'Reference annotations' not in endo_attempt.text
        assert client.get(f'/api/v1/academy/attempts/{endo_attempt_id}/debrief',headers=student).status_code==403
        endo_evidence={'kind':'surgivision','case_id':endo_case['id'],'frame_id':endo_case['id'].rsplit(':',1)[-1],'selection_x_px':120,'selection_y_px':210}
        out_of_frame=client.put(f'/api/v1/academy/attempts/{endo_attempt_id}/draft',headers=student,json={'expected_revision':0,'observations':[],'viewer_evidence':{**endo_evidence,'selection_x_px':900}})
        assert out_of_frame.status_code==422 and out_of_frame.json()['detail']['code']=='VIEWER_EVIDENCE_OUT_OF_BOUNDS'
        endo_save=client.put(f'/api/v1/academy/attempts/{endo_attempt_id}/draft',headers=student,json={
            'expected_revision':0,'observations':[{'block_id':'question','response':'The visible frame supports a limited observation; it cannot establish surgical safety.'}],'viewer_evidence':endo_evidence})
        assert endo_save.status_code==200
        endo_receipt=client.post(f'/api/v1/academy/attempts/{endo_attempt_id}/submit',headers={**student,'Idempotency-Key':'submit-endoscapes-attempt-001'},json={'expected_revision':1})
        assert endo_receipt.status_code==200
        achievement_opt_in=client.put('/api/v1/academy/preferences/achievements',headers=student,json={'achievements_enabled':True})
        assert achievement_opt_in.status_code==200 and achievement_opt_in.json()['achievements_enabled'] is True
        endo_review=client.post(f'/api/v1/educator/attempts/{endo_attempt_id}/grade',headers=educator,json={
            'criterion_scores':[{'criterion_id':'evidence','earned_points':55,'note':'Good frame-specific observation.'},{'criterion_id':'limits','earned_points':37,'note':'No clearance claim.'}],
            'feedback':'You described the visible evidence and its limits.','reason':'Reviewed against the written evidence rubric.'})
        assert endo_review.status_code==422 and any(error['loc']==['header','Idempotency-Key'] for error in endo_review.json()['detail'])
        endo_review=client.post(f'/api/v1/educator/attempts/{endo_attempt_id}/grade',headers={**educator,'Idempotency-Key':'grade-endoscapes-001'},json={
            'criterion_scores':[{'criterion_id':'evidence','earned_points':55,'note':'Good frame-specific observation.'},{'criterion_id':'limits','earned_points':37,'note':'No clearance claim.'}],
            'feedback':'You described the visible evidence and its limits.','reason':'Reviewed against the written evidence rubric.'})
        assert endo_review.status_code==200
        opted_out_progress=client.get('/api/v1/academy/progress',headers=student).json()
        assert opted_out_progress['xp']==10 and opted_out_progress['xp_enabled'] is False
        assert opted_out_progress['achievements_enabled'] is True
        assert [award['key'] for award in opted_out_progress['achievements']]==['first-evidence-investigation']
        assert opted_out_progress['graded_attempts']==2 and opted_out_progress['average_score']==91.0
        released=client.get(f'/api/v1/academy/attempts/{endo_attempt_id}/debrief',headers=student)
        assert released.status_code==200 and released.json()['reference_evidence']['kind']=='expert_reference'
        assert released.json()['xp_awarded']==0
        assert released.json()['reference_evidence']['annotations']
        assert len(released.json()['reference_evidence']['image_sha256'])==64
        achievement_opt_out=client.put('/api/v1/academy/preferences/achievements',headers=student,json={'achievements_enabled':False})
        assert achievement_opt_out.status_code==200
        hidden_achievements=client.get('/api/v1/academy/progress',headers=student).json()
        assert hidden_achievements['achievements_enabled'] is False and hidden_achievements['achievements']==[]
        with _db() as conn:
            assert conn.execute("SELECT COUNT(*) FROM achievement_events WHERE student_id='learning-student' AND achievement_key='first-evidence-investigation'").fetchone()[0]==1
        frame_id=endo_case['id'].rsplit(':',1)[-1]
        scoped_frame=client.get(f'/api/v1/surgivision/frames/{frame_id}',headers=student)
        assert scoped_frame.status_code==200,scoped_frame.text
        assert scoped_frame.json()['annotations']==[] and scoped_frame.json()['cvs_criteria']==[]
        all_frames=client.get('/api/v1/cases').json()
        other_frame=next(item for item in all_frames if item['module']=='surgivision' and item['id']!=endo_case['id'])
        assert client.get(f"/api/v1/surgivision/frames/{other_frame['id'].rsplit(':',1)[-1]}",headers=student).status_code==403
        image=client.get(f'/api/v1/surgivision/frames/{frame_id}/image',headers=student)
        assert image.status_code==200 and image.headers['content-type'].startswith('image/jpeg')
        assert client.get(f'/api/v1/surgivision/frames/{frame_id}').json()['annotations']

    openkbp=next(item for item in client.get('/api/v1/cases').json() if item['module']=='dosetwin')
    blocked=client.post('/api/v1/educator/drafts',headers=educator,json={
        'title':'Blocked benchmark lesson','case_id':openkbp['id'],
        'content':{'rubric':'Private grading criteria.','rubric_criteria':RUBRIC,'blocks':[{'id':'question','type':'Question','title':'Question','content':'Review the benchmark.'}]}})
    assert blocked.status_code==201
    blocked_result=client.post(f"/api/v1/educator/drafts/{blocked.json()['id']}/publish",headers=educator,json=publish_request)
    assert blocked_result.status_code==403 and blocked_result.json()['detail']['code']=='PUBLICATION_RIGHTS_BLOCKED'


def test_report_is_saved_idempotently_with_run_provenance_and_limitations(client):
    cid=client.get('/api/v1/cases').json()[0]['id']
    run=client.post('/api/v1/runs',json={'case_id':cid,'operation_id':'openkbp.case_summary'}).json()
    assert client.get('/api/v1/runs').json()[0]['id']==run['id']
    viewer={'case_id':cid,'voxel':[11,22,33],'axis':1,'roi':'Brainstem','dose_overlay':True,'roi_overlay':False,'dose_opacity':0.55}
    created=client.post('/api/v1/reports',json={'run_id':run['id'],'viewer_state':viewer})
    assert created.status_code==200,created.text
    report=created.json()
    assert report['status']=='generated'
    assert report['document']['analysis']['run_id']==run['id']
    assert report['document']['source']['files_sha256']['dose.csv']==run['provenance']['input_sha256']['dose.csv']
    assert report['document']['results']['available_rois']['Brainstem']['dmean_gy']==17.0
    assert report['document']['viewer_state']['voxel']==[11,22,33]
    assert report['document']['viewer_state']['axis']==1
    assert any('not for diagnosis' in item for item in report['document']['limitations'])
    repeated=client.post('/api/v1/reports',json={'run_id':run['id'],'viewer_state':viewer})
    assert repeated.json()['id']==report['id']
    another_view=client.post('/api/v1/reports',json={'run_id':run['id'],'viewer_state':{**viewer,'voxel':[12,22,33]}})
    assert another_view.status_code==200 and another_view.json()['id']!=report['id']
    assert client.post('/api/v1/reports',json={'run_id':run['id'],'viewer_state':{**viewer,'case_id':'other-case'}}).status_code==422
    assert len(client.get('/api/v1/reports').json())==2
    assert client.get('/api/v1/reports/'+report['id']).json()['document']==report['document']
    assert client.post('/api/v1/reports',json={'run_id':'unknown'}).status_code==404


def test_slice_endpoint_returns_real_fixture_values_hash_and_index_limits(client):
    cid=client.get('/api/v1/cases').json()[0]['id']
    response=client.get(f'/api/v1/cases/{cid}/viewer/slice?axis=2&index=0&layer=dose')
    assert response.status_code==200,response.text
    payload=response.json()
    assert payload['origin']=='synthetic-test-fixture'
    assert payload['source_kind']=='synthetic-test'
    assert payload['unit']=='Gy'
    assert payload['values'][0]==12
    assert len(payload['source_sha256'])==64
    assert client.get(f'/api/v1/cases/{cid}/viewer/slice?axis=3&index=0').status_code==422
    assert client.get(f'/api/v1/cases/{cid}/viewer/slice?axis=2&index=128').status_code==422

def test_roi_volume_endpoint_preserves_source_c_order_spacing_and_provenance(client):
    cid=client.get('/api/v1/cases').json()[0]['id']
    response=client.get(f'/api/v1/cases/{cid}/viewer/roi-volume?roi=Brainstem')
    assert response.status_code==200,response.text
    payload=response.json()
    assert payload['shape']==[128,128,128]
    assert payload['spacing_mm']==[2.0,2.0,2.0]
    assert payload['voxel_count']==2
    assert payload['voxel_indices_c_order']==[0,1]
    assert payload['index_convention']=='x-major-y-middle-z-fastest'
    assert payload['coordinate_frame']=='openkbp-processed-voxel-grid'
    assert payload['origin']=='computed-from-synthetic-test-fixture'
    assert len(payload['source_sha256'])==64
    assert client.get(f'/api/v1/cases/{cid}/viewer/roi-volume?roi=../../dose').status_code==422


def test_dvh_endpoint_calculates_fixture_curve_and_provenance(client):
    cid=client.get('/api/v1/cases').json()[0]['id']
    response=client.get(f'/api/v1/cases/{cid}/viewer/dvh?roi=Brainstem')
    assert response.status_code==200,response.text
    result=response.json()
    assert result['voxel_count']==2
    assert result['mean_dose_gy']==17
    assert result['curve'][0]['volume_percent']==100
    assert result['curve'][-1]['volume_percent']==0
    assert result['dose_display_max_gy']==40
    assert result['curve'][-1]['dose_gy']==result['dose_display_max_gy']
    assert result['official_metrics']['d95_gy_interpolated']==12.5
    assert result['official_metrics']['dmean_gy']==17.0
    assert result['origin']=='computed-from-synthetic-test-fixture'
    assert result['source_kind']=='synthetic-test'


def test_endoscapes_frame_requires_matching_local_hashes_and_keeps_identity(monkeypatch,tmp_path):
    root=tmp_path/'endoscapes'; split=root/'train'; split.mkdir(parents=True)
    image=b'\xff\xd8\xff\xd9'
    (split/'8_14775.jpg').write_bytes(image)
    image_hash=hashlib.sha256(image).hexdigest()
    coco={
      'images':[{'id':8014775,'file_name':'8_14775.jpg','width':854,'height':480,'video_id':8,'ds':[1/3,1/3,0]}],
      'categories':[{'id':6,'name':'tool'}],
      'annotations':[{'id':80147750,'image_id':8014775,'category_id':6,'bbox':[2,4,20,30]}],
    }
    raw=json.dumps(coco).encode(); (split/'annotation_coco.json').write_bytes(raw)
    manifest={'dataset':'Endoscapes-BBox201','split':'train','image':{'file_name':'8_14775.jpg','image_id':8014775,'video_id':8,'width':854,'height':480,'sha256':image_hash,'annotation_sha256':hashlib.sha256(raw).hexdigest()}}
    (root/'medforge-source-manifest.json').write_text(json.dumps(manifest),encoding='utf8')
    monkeypatch.setenv('MEDFORGE_ENDOSCAPES_ROOT',str(root))
    monkeypatch.delenv('MEDFORGE_OPENKBP_CASE_DIR',raising=False)
    monkeypatch.setenv('MEDFORGE_DB_PATH',str(tmp_path/'endoscapes.sqlite3'))
    client=TestClient(create_app())
    cases=client.get('/api/v1/cases').json()
    assert len(cases)==1 and cases[0]['module']=='surgivision'
    assert cases[0]['reference_kind']=='research'
    assert cases[0]['source_case_id']=='video-8:frame-14775'
    frame=client.get('/api/v1/surgivision/frames/8_14775').json()
    assert frame['width']==854 and frame['height']==480
    assert frame['annotations'][0]['category_name']=='tool'
    assert frame['cvs_criteria']==[1/3,1/3,0]
    assert 'image_path' not in frame
    report_input={'frame_id':frame['id'],'show_annotations':True,'selected_annotation_id':80147750}
    created=client.post('/api/v1/reports/surgivision-frame',json=report_input)
    assert created.status_code==200,created.text
    report=created.json()
    assert report['run_id'] is None and report['case_id']==frame['id']
    assert report['document']['schema']=='medforge.surgivision-source-frame-evidence/v1'
    assert report['document']['source']['image_sha256']==image_hash
    assert report['document']['source']['annotation_sha256']==hashlib.sha256(raw).hexdigest()
    assert report['document']['evidence']['reference_annotations'][0]['id']==80147750
    assert report['document']['evidence']['cvs_source_values']==[1/3,1/3,0]
    assert report['document']['display_state']=={'show_annotations':True,'selected_annotation_id':80147750}
    assert any('not model predictions' in item for item in report['document']['limitations'])
    repeated=client.post('/api/v1/reports/surgivision-frame',json=report_input)
    assert repeated.json()['id']==report['id']
    alternate=client.post('/api/v1/reports/surgivision-frame',json={**report_input,'show_annotations':False})
    assert alternate.status_code==200 and alternate.json()['id']!=report['id']
    assert client.post('/api/v1/reports/surgivision-frame',json={**report_input,'selected_annotation_id':999}).status_code==422
    assert client.post('/api/v1/reports/surgivision-frame',json={**report_input,'frame_id':'unknown'}).status_code==404
    assert len(client.get('/api/v1/reports').json())==2
    assert client.get('/api/v1/reports/'+report['id']).json()['document']==report['document']
    viewer=client.get(f"/api/v1/cases/{cases[0]['id']}/viewer-manifest").json()
    assert viewer['modality']=='surgical-video'
    assert viewer['artifacts'][0]['has_real_video'] is False
    assert client.get('/api/v1/surgivision/frames/8_14775/image').content==image
    manifest['image']['sha256']='0'*64
    (root/'medforge-source-manifest.json').write_text(json.dumps(manifest),encoding='utf8')
    assert client.get('/api/v1/surgivision/frames/8_14775').status_code==404


def test_endoscapes_manifest_exposes_only_verified_sampled_frames(monkeypatch,tmp_path):
    root=tmp_path/'endoscapes';split=root/'train';split.mkdir(parents=True)
    payloads={'4_26200.jpg':b'frame-four','13_46850.jpg':b'frame-thirteen'}
    images=[];manifest_images=[]
    for index,(name,payload) in enumerate(payloads.items(),start=1):
        image_id=index*100
        (split/name).write_bytes(payload)
        images.append({'id':image_id,'file_name':name,'width':854,'height':480,'video_id':index*4,'ds':[1/3,1,0]})
        manifest_images.append({'file_name':name,'image_id':image_id,'video_id':index*4,'width':854,'height':480,'sha256':hashlib.sha256(payload).hexdigest()})
    coco={'images':images,'categories':[{'id':1,'name':'gallbladder'}],'annotations':[
      {'id':1001,'image_id':100,'category_id':1,'bbox':[10,20,80,90],'segmentation':{'size':[480,854],'counts':'abc'}},
      {'id':2001,'image_id':200,'category_id':1,'bbox':[11,21,81,91],'segmentation':{'size':[480,854],'counts':'def'}},
    ]}
    raw=json.dumps(coco).encode();(split/'annotation_coco.json').write_bytes(raw)
    manifest={'dataset':'Endoscapes-BBox201','split':'train','annotation_sha256':hashlib.sha256(raw).hexdigest(),'images':manifest_images}
    (root/'medforge-source-manifest.json').write_text(json.dumps(manifest),encoding='utf8')
    monkeypatch.setenv('MEDFORGE_ENDOSCAPES_ROOT',str(root))
    monkeypatch.delenv('MEDFORGE_OPENKBP_CASE_DIR',raising=False)
    monkeypatch.setenv('MEDFORGE_DB_PATH',str(tmp_path/'endoscapes-multi.sqlite3'))
    client=TestClient(create_app())
    cases=client.get('/api/v1/cases').json()
    assert len(cases)==2
    capability=next(item for item in client.get('/api/v1/modules').json() if item['id']=='surgivision')
    assert '2 annotated Endoscapes frames' in capability['detail']
    assert '1 fps sampled sequences' in capability['detail']
    response=client.get('/api/v1/surgivision/frames/13_46850')
    assert response.status_code==200
    assert response.json()['annotations'][0]['segmentation']=={'size':[480,854],'counts':'def'}
    (split/'4_26200.jpg').write_bytes(b'altered')
    cases=client.get('/api/v1/cases').json()
    assert len(cases)==1 and cases[0]['id']=='endoscapes:train:13_46850'


def test_endoscapes_v3_manifest_supports_all_bbox_splits_and_split_qualified_frames(monkeypatch,tmp_path):
    root=tmp_path/'endoscapes'; split_manifests={}
    for split,payload in [('train',b'train-frame'),('val',b'val-frame')]:
        split_dir=root/split;split_dir.mkdir(parents=True)
        name='8_14775.jpg'
        (split_dir/name).write_bytes(payload)
        image={'id':8014775,'file_name':name,'width':854,'height':480,'video_id':8,'ds':[1/3,1/3,0]}
        coco={'images':[image],'categories':[{'id':1,'name':'tool'}],'annotations':[]}
        raw=json.dumps(coco).encode();(split_dir/'annotation_coco.json').write_bytes(raw)
        split_manifests[split]={
          'annotation_sha256':hashlib.sha256(raw).hexdigest(),
          'images':[{'file_name':name,'image_id':image['id'],'video_id':image['video_id'],
            'width':image['width'],'height':image['height'],'size_bytes':len(payload),
            'sha256':hashlib.sha256(payload).hexdigest()}],
        }
    (root/'medforge-source-manifest.json').write_text(json.dumps({
      'schema':'medforge.source-manifest.endoscapes.v3','dataset':'Endoscapes-BBox201','splits':split_manifests,
    }),encoding='utf8')
    monkeypatch.setenv('MEDFORGE_ENDOSCAPES_ROOT',str(root))
    monkeypatch.delenv('MEDFORGE_OPENKBP_CASE_DIR',raising=False)
    monkeypatch.setenv('MEDFORGE_DB_PATH',str(tmp_path/'endoscapes-v3.sqlite3'))
    client=TestClient(create_app())
    cases=client.get('/api/v1/cases').json()
    assert {item['id'] for item in cases}=={'endoscapes:train:8_14775','endoscapes:val:8_14775'}
    frame=client.get('/api/v1/surgivision/frames/val%3A8_14775').json()
    assert frame['id']=='endoscapes:val:8_14775'
    assert client.get('/api/v1/surgivision/frames/val%3A8_14775/image').content==b'val-frame'


def test_fisav_sample_exposes_real_signal_contract_and_calculated_spectrum(monkeypatch,tmp_path):
    root=tmp_path/'fisav'; root.mkdir()
    rows=['Time,ECG,raw PZT1,raw PZT2,raw PZT3,raw PZT4,Occlusion']
    for index in range(20000):
        time=index/10000
        rows.append(f'{time:.4f},{time:.6f},{index%7/10:.1f},0.1,0.2,0.3,0')
    payload=('\n'.join(rows)+'\n').encode()
    jitter_rows=['Time,ECG,raw PZT1,raw PZT2,raw PZT3,raw PZT4,Occlusion']
    for index in range(20000):
        time=index/10000-(index//5000)*0.000001
        jitter_rows.append(f'{time:.8f},{time:.6f},{index%7/10:.1f},0.1,0.2,0.3,0')
    jitter_payload=('\n'.join(jitter_rows)+'\n').encode()
    (root/'pat001.csv').write_bytes(payload)
    (root/'pat002.csv').write_bytes(jitter_payload)
    records=[{'file_name':f'pat00{n}.csv','uncompressed_bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()} for n,content in ((1,payload),(2,jitter_payload))]
    manifest={'dataset_doi':'10.17605/OSF.IO/HYPFR','license':'CC BY 4.0','sample_file':records[0],'records':records}
    (root/'medforge-source-manifest.json').write_text(json.dumps(manifest),encoding='utf8')
    monkeypatch.delenv('MEDFORGE_OPENKBP_CASE_DIR',raising=False)
    monkeypatch.delenv('MEDFORGE_ENDOSCAPES_ROOT',raising=False)
    monkeypatch.setenv('MEDFORGE_FISAV_ROOT',str(root))
    monkeypatch.setenv('MEDFORGE_DB_PATH',str(tmp_path/'fisav.sqlite3'))
    client=TestClient(create_app())
    cases=client.get('/api/v1/cases').json()
    assert [row['id'] for row in cases]==['fisav:pat001','fisav:pat002']
    assert client.get('/api/v1/cases/fisav:pat002').json()['source_case_id']=='pat002'
    record=client.get('/api/v1/fistulaguard/records/pat001').json()
    assert record['sample_count']==20000
    assert record['sample_rate_hz']==10000
    assert record['duration_sec']==1.9999
    assert record['channel_units']['raw PZT1'].startswith('source-value')
    waveform=client.get('/api/v1/fistulaguard/records/pat001/waveform?channel=raw%20PZT1&start_sec=0&duration_sec=1').json()
    assert waveform['original_sample_count']==10000 and len(waveform['samples'])<=2000
    assert waveform['samples'][0]['time_sec']==0
    spectrum=client.get('/api/v1/fistulaguard/records/pat001/spectrum?channel=raw%20PZT1&start_sec=0&duration_sec=1').json()
    assert len(spectrum['frequencies_hz'])==len(spectrum['power_per_hz'])
    assert max(spectrum['power_per_hz'])>0
    assert 'Welch' in spectrum['method']
    spectrogram=client.get('/api/v1/fistulaguard/records/pat001/spectrogram?channel=raw%20PZT1&start_sec=0&duration_sec=1').json()
    assert spectrogram['case_id']=='fisav:pat001'
    assert spectrogram['channel']=='raw PZT1' and spectrogram['source_sha256']==record['source_sha256']
    assert 1<=len(spectrogram['frequencies_hz'])<=128 and 1<=len(spectrogram['times_sec'])<=160
    assert len(spectrogram['power_per_hz'])==len(spectrogram['frequencies_hz'])
    assert all(len(row)==len(spectrogram['times_sec']) for row in spectrogram['power_per_hz'])
    assert min(min(row) for row in spectrogram['power_per_hz'])>=0
    assert 'uncalibrated' not in spectrogram['unit'] and 'unspecified' in spectrogram['unit']
    assert 'frequency bins are averaged' in spectrogram['method']
    spectrogram_peak_row=max(range(len(spectrogram['frequencies_hz'])),key=lambda row:max(spectrogram['power_per_hz'][row]))
    assert abs(spectrogram['frequencies_hz'][spectrogram_peak_row]-(10000/7))<80
    outside_spectrogram=client.get('/api/v1/fistulaguard/records/pat001/spectrogram?channel=raw%20PZT1&start_sec=1&duration_sec=2')
    assert outside_spectrogram.status_code==422
    features=client.get('/api/v1/fistulaguard/records/pat001/features?channel=raw%20PZT1&start_sec=0&duration_sec=1').json()
    assert features['sample_count']==10000 and features['rms']>0
    assert features['zero_fraction']>0 and features['peak_to_peak']>0
    assert features['finite_sample_count']==10000 and features['nonfinite_sample_count']==0
    assert features['timestamp_interval_count']==9999
    assert features['timestamp_interval_deviation_count']==0
    assert features['timestamp_interval_tolerance_fraction']==0.001
    precise_start=0.2345
    precise_duration=0.5
    precise_window=client.get(f'/api/v1/fistulaguard/records/pat001/waveform?channel=raw%20PZT1&start_sec={precise_start}&duration_sec={precise_duration}').json()
    precise_spectrum=client.get(f'/api/v1/fistulaguard/records/pat001/spectrum?channel=raw%20PZT1&start_sec={precise_start}&duration_sec={precise_duration}').json()
    precise_spectrogram=client.get(f'/api/v1/fistulaguard/records/pat001/spectrogram?channel=raw%20PZT1&start_sec={precise_start}&duration_sec={precise_duration}').json()
    precise_features=client.get(f'/api/v1/fistulaguard/records/pat001/features?channel=raw%20PZT1&start_sec={precise_start}&duration_sec={precise_duration}').json()
    assert precise_window['start_sec']==precise_start and precise_window['original_sample_count']==5000
    assert all(precise_start<=point['time_sec']<precise_start+precise_duration for point in precise_window['samples'])
    assert precise_spectrum['start_sec']==precise_start and precise_spectrum['duration_sec']==pytest.approx(0.4999)
    assert precise_spectrogram['start_sec']==precise_start and all(precise_start<=time<precise_start+precise_duration for time in precise_spectrogram['times_sec'])
    assert precise_features['start_sec']==precise_start and precise_features['sample_count']==5000
    expected_mean=sum((index%7)/10 for index in range(2345,7345))/5000
    assert precise_features['mean']==pytest.approx(expected_mean)
    constant=client.get('/api/v1/fistulaguard/records/pat001/features?channel=raw%20PZT2&start_sec=0&duration_sec=1').json()
    assert constant['constant_signal'] is True
    assert 'no quality threshold' in features['method']
    compare_request={'case_id':'fisav:pat001','channel':'raw PZT1','selected_start_sec':0,
        'reference_start_sec':1,'duration_sec':0.5}
    comparison=client.post('/api/v1/comparisons',json=compare_request)
    assert comparison.status_code==200,comparison.text
    saved_comparison=comparison.json()
    assert saved_comparison['kind']=='fistulaguard.window-feature-comparison'
    assert saved_comparison['compatible'] is True
    assert saved_comparison['source_sha256']==features['source_sha256']
    assert saved_comparison['duration_sec']==0.5
    assert saved_comparison['selected_window']['sample_count']==5000
    assert saved_comparison['reference_window']['sample_count']==5000
    assert saved_comparison['feature_differences'][0]['name']=='mean'
    assert saved_comparison['feature_differences'][0]['difference']==pytest.approx(
        saved_comparison['selected_window']['mean']-saved_comparison['reference_window']['mean'])
    zero_difference=next(item for item in saved_comparison['feature_differences'] if item['name']=='zero_fraction')
    assert zero_difference['unit']=='percentage points'
    assert zero_difference['difference']==pytest.approx(
        (saved_comparison['selected_window']['zero_fraction']-saved_comparison['reference_window']['zero_fraction'])*100)
    retry=client.post('/api/v1/comparisons',json=compare_request)
    assert retry.status_code==200 and retry.json()['id']==saved_comparison['id']
    assert client.get('/api/v1/comparisons?case_id=fisav:pat001').json()==[saved_comparison]
    assert client.get('/api/v1/comparisons/'+saved_comparison['id']).json()==saved_comparison
    second_compare=client.post('/api/v1/comparisons',json={**compare_request,'selected_start_sec':0.25,'reference_start_sec':1.25})
    assert second_compare.status_code==200
    all_comparisons=client.get('/api/v1/comparisons?case_id=fisav:pat001&limit=100&offset=0').json()
    comparison_page_one=client.get('/api/v1/comparisons?case_id=fisav:pat001&limit=1&offset=0').json()
    comparison_page_two=client.get('/api/v1/comparisons?case_id=fisav:pat001&limit=1&offset=1').json()
    assert len(all_comparisons)==2
    assert {item['id'] for item in all_comparisons}=={comparison_page_one[0]['id'],comparison_page_two[0]['id']}
    assert client.get('/api/v1/comparisons?case_id=fisav:pat001&limit=1&offset=2').json()==[]
    invalid=client.post('/api/v1/comparisons',json={**compare_request,'reference_start_sec':0})
    assert invalid.status_code==422
    out_of_range=client.post('/api/v1/comparisons',json={**compare_request,'reference_start_sec':2})
    assert out_of_range.status_code==422
    manifest_payload=client.get('/api/v1/cases/fisav:pat001/viewer-manifest').json()
    assert manifest_payload['artifacts'][0]['kind']=='signal'
    assert manifest_payload['artifacts'][0]['sample_rate_hz']==10000
    second_record=client.get('/api/v1/fistulaguard/records/pat002').json()
    second_trace=client.get('/api/v1/fistulaguard/records/pat002/waveform?channel=ECG&start_sec=0&duration_sec=1').json()
    assert second_record['source_case_id']=='pat002' and second_trace['case_id']=='fisav:pat002'
    assert second_record['sample_rate_hz']==10000 and second_record['sample_count']==20000
    assert second_record['duration_sec']==pytest.approx(1.999898)
    jitter_features=client.get('/api/v1/fistulaguard/records/pat002/features?channel=ECG&start_sec=0&duration_sec=0.6').json()
    assert jitter_features['sample_count']>0 and jitter_features['source_sample_rate_hz']==10000
    assert jitter_features['timestamp_interval_deviation_count']>0
    assert client.get('/api/v1/fistulaguard/records/pat001/waveform?channel=raw%20PZT9').status_code==422
    (root/'pat001.csv').write_bytes(payload+b'bad')
    assert client.get('/api/v1/fistulaguard/records/pat001').status_code==404
