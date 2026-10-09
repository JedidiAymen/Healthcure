"""Local-only reference API. NOT a healthcare system or production auth implementation.

Endpoints backed by real OpenKBP CSV data only when MEDFORGE_OPENKBP_CASE_DIR is configured.
With MEDFORGE_SOURCE_KIND=synthetic-test, only synthetic test data are used.
Long-running workers, web UI, RBAC and medical inference are not implemented here.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import uuid
from contextlib import contextmanager

from fastapi import FastAPI, HTTPException
from pydantic import ValidationError
import numpy as np
from .schemas import (
    ApiError, Case, Health, ModuleStatus, ModelRecord, ModelValidationRequest,
    ModelValidationResponse, RunCreateRequest, RunRecord, ViewerManifest, VoxelVolumeArtifact
)
from .openkbp import validate_case

ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT/'db'/'migrations'/'0001_init.sql'
SOURCE_URL = 'https://github.com/ababier/open-kbp'

def _case_root() -> Path | None:
    raw=os.environ.get('MEDFORGE_OPENKBP_CASE_DIR','').strip()
    return Path(raw).expanduser().resolve() if raw else None

def _source_kind() -> str:
    value=os.environ.get('MEDFORGE_SOURCE_KIND','benchmark')
    if value not in ('benchmark','synthetic-test'):
        raise RuntimeError('MEDFORGE_SOURCE_KIND must be benchmark or synthetic-test')
    return value

def _case_id() -> str | None:
    root=_case_root()
    if root is None or not root.is_dir():
        return None
    if not all((root/item).is_file() for item in ['ct.csv','dose.csv','possible_dose_mask.csv','voxel_dimensions.csv']):
        return None
    return 'openkbp:'+root.name

@contextmanager
def _db():
    # Path comes exclusively from environment, not from a client request.
    raw=os.environ.get('MEDFORGE_DB_PATH')
    path=Path(raw).expanduser().resolve() if raw else ROOT/'data'/'reference.sqlite3'
    path.parent.mkdir(parents=True,exist_ok=True)
    conn=sqlite3.connect(path)
    conn.execute('PRAGMA foreign_keys=ON')
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

def init_db():
    with _db() as c:
        c.executescript(MIGRATION.read_text(encoding='utf8'))
        if _case_id():
            c.execute('INSERT OR IGNORE INTO datasets(id,name,modality,source_url,license_label) VALUES (?,?,?,?,?)',
                ('openkbp','OpenKBP','radiotherapy-volume',SOURCE_URL,'Dataset rights require independent review'))
            c.execute('INSERT OR IGNORE INTO dataset_versions(id,dataset_id,version) VALUES (?,?,?)',
                ('openkbp-public','openkbp','public-source'))
            c.execute('INSERT OR IGNORE INTO cases(id,module,dataset_version_id,external_case_id,partition_name,reference_kind,status) VALUES (?,?,?,?,?,?,?)',
                (_case_id(),'dosetwin','openkbp-public',_case_root().name,None,_source_kind(),'ready'))

def _case_response() -> Case | None:
    cid=_case_id()
    if cid is None:return None
    return Case(id=cid,module='dosetwin',dataset_id='openkbp',source_case_id=_case_root().name,
                reference_kind=_source_kind(),status='ready',label='OpenKBP '+_case_root().name)

def _expect_case(cid:str) -> Case:
    case=_case_response()
    if case is None or case.id!=cid:
        raise HTTPException(status_code=404,detail={'code':'CASE_NOT_INSTALLED','message':'No installed case matching this ID','action':'Configure MEDFORGE_OPENKBP_CASE_DIR with authorized input files'})
    return case

def create_app() -> FastAPI:
    app=FastAPI(title='MEDFORGE reference contracts',version='0.8.0',
        description='LOCAL REFERENCE ONLY: not a clinical service; no public auth or RBAC implementation.')
    init_db()

    @app.get('/healthz',response_model=Health)
    def health() -> Health:return Health()

    @app.get('/api/v1/modules',response_model=list[ModuleStatus])
    def modules():
        ready=_case_id() is not None
        return [
            ModuleStatus(id='surgivision',capability_state='unverified',detail='Research implementations documented; no surgical cases/models installed in harness'),
            ModuleStatus(id='dosetwin',capability_state='ready' if ready else 'requires-setup',detail='OpenKBP local case summary available' if ready else 'Set MEDFORGE_OPENKBP_CASE_DIR'),
            ModuleStatus(id='fistulaguard',capability_state='unverified',detail='AVF raw recordings and classification not verified; no waveform inferred from feature-only data')]

    @app.get('/api/v1/cases',response_model=list[Case])
    def list_cases():
        case=_case_response()
        return [case] if case else []

    @app.get('/api/v1/cases/{case_id}',response_model=Case,responses={404:{'model':ApiError}})
    def get_case(case_id:str):return _expect_case(case_id)

    @app.get('/api/v1/cases/{case_id}/viewer-manifest',response_model=ViewerManifest)
    def manifest(case_id:str):
        case=_expect_case(case_id)
        shape=(128,128,128)
        # Manifest uses semantic storage keys, never a host path or public download URL.
        spacing=np.loadtxt(_case_root()/'voxel_dimensions.csv').reshape(-1)
        if len(spacing)!=3 or not np.all(np.isfinite(spacing)) or not np.all(spacing>0):
            raise HTTPException(422,detail={'code':'INVALID_SPACING','message':'Voxel spacing requires 3 positive finite mm values'})
        return ViewerManifest(case_id=case.id,modality='radiotherapy-volume',
            artifacts=[VoxelVolumeArtifact(asset_key=case.id+'/dose.csv',shape=shape,spacing_mm=tuple(float(v) for v in spacing))],
            provenance_label='OpenKBP synthetic benchmark reference dose' if _source_kind()=='benchmark' else 'SYNTHETIC TEST ONLY',
            source_url=SOURCE_URL,limitations=['No original DICOM patient orientation/origin assumed','Viewer loader and artifact URLs are not implemented in this reference harness'])

    @app.get('/api/v1/models',response_model=list[ModelRecord])
    def models():return [
       ModelRecord(id='cvs-adaptnet',module='surgivision',name='CVS-AdaptNet',operation_ids=['cvs.inference'],upstream_url='https://github.com/CAMMA-public/CVS-AdaptNet',readiness='unverified',details='External weights published; no executable GPU inference verified here'),
       ModelRecord(id='surgical-latentgraph',module='surgivision',name='SurgLatentGraph architectures',operation_ids=['surgical.detection','surgical.segmentation','surgical.phase','surgical.triplet'],upstream_url='https://github.com/CAMMA-public/SurgLatentGraph',readiness='unverified',details='Source task families documented; complete checkpoints/runtime not verified'),
       ModelRecord(id='openkbp-baseline',module='dosetwin',name='OpenKBP prediction baseline',operation_ids=['dose.prediction'],upstream_url=SOURCE_URL,readiness='unverified',details='Training/evaluation source available; model weights/runtime unverified'),
       ModelRecord(id='fistula-baseline',module='fistulaguard',name='Proposed signal features baseline',operation_ids=['acoustic.features','acoustic.classification'],upstream_url='https://www.nature.com/articles/s41597-026-08242-8',readiness='missing-dataset',details='No raw FiSaV data acquired or fitted model provided')]

    @app.post('/api/v1/models/{model_id}/validate',response_model=ModelValidationResponse)
    def validate_model(model_id:str,request:ModelValidationRequest):
        ids={m.id for m in models()}
        if model_id not in ids:raise HTTPException(404,detail={'code':'MODEL_UNKNOWN','message':'Model not registered'})
        return ModelValidationResponse(model_id=model_id,executable=False,
            blockers=['No installed and tested model adapter/checkpoint for this operation in reference harness'])

    @app.post('/api/v1/runs',response_model=RunRecord,responses={404:{'model':ApiError},422:{'model':ApiError}})
    def create_run(request:RunCreateRequest):
        case=_expect_case(request.case_id)
        root=_case_root()
        try:
            summary=validate_case(root)
        except Exception as e:
            raise HTTPException(422,detail={'code':'INVALID_RESEARCH_DATA','message':str(e)}) from e
        file_hashes=summary['files_sha256']
        inp_hash=hashlib.sha256(json.dumps(file_hashes,sort_keys=True).encode()).hexdigest()
        with _db() as c:
            existing=c.execute('SELECT id,status,result_json,output_provenance_json,failure_code FROM analysis_runs WHERE case_id=? AND operation_id=? AND input_hash=?',
                               (case.id,request.operation_id,inp_hash)).fetchone()
            if existing:
                return RunRecord(id=existing[0],case_id=case.id,operation_id=request.operation_id,status=existing[1],
                    source_kind=case.reference_kind,results=json.loads(existing[2]) if existing[2] else None,
                    provenance=json.loads(existing[3]) if existing[3] else {},failure_code=existing[4])
            run_id='run_'+uuid.uuid4().hex
            provenance={'dataset':'OpenKBP','source_url':SOURCE_URL,'input_sha256':file_hashes,
                'algorithm':'MEDFORGE reference sparse case summary v0.8',
                'reference_kind':case.reference_kind,
                'clinical_use':'not validated; research/education only',
                'metric_warning':'Exploratory dose summaries; benchmark percentile/D0.1cc definitions require official cross-check'}
            c.execute('INSERT INTO analysis_runs(id,case_id,operation_id,status,input_hash,parameters_json,result_json,output_provenance_json,started_at,completed_at) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
                (run_id,case.id,request.operation_id,'completed',inp_hash,'{}',json.dumps(summary),json.dumps(provenance)))
            return RunRecord(id=run_id,case_id=case.id,operation_id=request.operation_id,status='completed',
                             source_kind=case.reference_kind,results=summary,provenance=provenance)

    @app.get('/api/v1/runs/{run_id}',response_model=RunRecord)
    def get_run(run_id:str):
        with _db() as c:
            row=c.execute('SELECT r.id,r.case_id,r.operation_id,r.status,r.result_json,r.output_provenance_json,r.failure_code,c.reference_kind FROM analysis_runs AS r JOIN cases AS c ON c.id=r.case_id WHERE r.id=?',(run_id,)).fetchone()
        if row is None:raise HTTPException(404,detail={'code':'RUN_UNKNOWN','message':'Run not found'})
        return RunRecord(id=row[0],case_id=row[1],operation_id=row[2],status=row[3],
            source_kind=row[7],results=json.loads(row[4]) if row[4] else None,
            provenance=json.loads(row[5]) if row[5] else {},failure_code=row[6])

    return app

app=create_app()
