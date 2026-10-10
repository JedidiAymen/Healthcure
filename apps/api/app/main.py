"""Local-only reference API. NOT a healthcare system or production auth implementation.

Endpoints backed by real OpenKBP CSV data only when a trusted local case directory is configured.
With MEDFORGE_SOURCE_KIND=synthetic-test, only synthetic test data are used.
Provisioned local educator/student sessions protect selected learning endpoints. General
research API authorization and production identity are not implemented. Research model execution
is local-only and stays disabled until its checkpoint source hash and terms are verified.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import re
from urllib.parse import unquote
import sqlite3
import subprocess
import tempfile
import uuid
from functools import lru_cache
from contextlib import contextmanager

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi import Header, Depends
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
import numpy as np
from .schemas import (
    ApiError, Case, Health, ModuleStatus, ModelRecord, ModelValidationRequest,
    DvhPoint, DvhMetrics, DvhSummary, DoseArtifact, DoseArtifactSlice, DoseArtifactComparison, ModelValidationResponse, RunCreateRequest, RunRecord, ViewerManifest, VoxelSlice, RoiMaskVolume, VoxelVolumeArtifact,
    SurgicalFrameArtifact, SurgicalFrameRecord, SurgicalMediaRecord, SurgicalSequenceFrame, SurgicalClipRecord, CvsCoverage, SignalArtifact, SignalRecord, SignalWindow, SignalSpectrum, SignalSpectrogram, SignalFeatures
)
from .schemas import ReportCreateRequest, ReportRecord, SurgicalFrameReportCreateRequest, DoseTwinComparisonReportCreateRequest
from .schemas import (LocalLoginRequest, LocalSession, LocalUser, EducatorEvidenceItem,
    StudentChallengeSummary, EducatorDraftCreate, EducatorDraftUpdate, EducatorDraft,
    EducatorDraftSummary, SignalWindowComparisonCreate, SignalWindowComparison,
    SignalFeatureDifference)
from .auth import password_digest, issue_session, verify_password, current_user as _current_user, require_role
from .learning import register_learning_routes
from .openkbp import dose_statistics, sha256, validate_case
from .dose_artifacts import (INDEX_CONVENTION, MAX_UPLOAD_BYTES, SHAPE as DOSE_SHAPE,
    comparison_for_roi, file_name as validate_dose_file_name, parse_spacing,
    validate_prediction, validate_sparse_csv_bytes)
from .endoscapes import SOURCE_URL as ENDOSCAPES_URL, case_record as _endoscapes_case_record, installed_cases as _endoscapes_cases, installed_frame as _endoscapes_frame
from . import endoscapes as _endoscapes
from . import fisav as _fisav
from . import appendix300 as _appendix300

ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = ROOT/'db'/'migrations'
SOURCE_URL = 'https://github.com/ababier/open-kbp'
CVS_MODEL_REVISION = 'bb21ffbd781b6f943be0daaeeccf1567c21e691d'
CVS_MODEL_ID = 'cvs-adaptnet'
ENDOSCAPES_SOURCE_REVISION = 'a8bd4f9b783308f783cca5943c31ff95317b8256'

@lru_cache(maxsize=4)
def _cached_file_sha256(path_string:str,size:int,modified_ns:int)->str:
    del size,modified_ns
    return sha256(Path(path_string))

def _cvs_worker_gate()->tuple[list[str],str|None]:
    checkpoint=ROOT/'data/models/cvs-adaptnet/CVSAdaptNet.pth'
    manifest_path=checkpoint.parent/'medforge-checkpoint-manifest.json'
    worker=ROOT/'workers/.venvs/cvs-adaptnet/bin/python'
    blockers=[]
    checkpoint_hash=None
    if not worker.is_file():
        blockers.append('The isolated Python 3.10 CVS-AdaptNet worker is not installed.')
    if not checkpoint.is_file() or not manifest_path.is_file():
        blockers.append('The pinned CVS-AdaptNet checkpoint or its acquisition manifest is missing.')
    else:
        try:
            manifest=json.loads(manifest_path.read_text(encoding='utf8'))
            stat=checkpoint.stat()
            checkpoint_hash=manifest.get('sha256')
            if manifest.get('source_revision')!=CVS_MODEL_REVISION or manifest.get('checkpoint')!=checkpoint.name:
                blockers.append('The checkpoint manifest does not match the pinned CVS-AdaptNet source.')
            if manifest.get('size_bytes')!=stat.st_size or not isinstance(checkpoint_hash,str):
                blockers.append('The installed checkpoint differs from its acquisition manifest.')
            expected=os.environ.get('MEDFORGE_CVS_ADAPNET_CHECKPOINT_SHA256','').strip().lower()
            if not re.fullmatch(r'[0-9a-f]{64}',expected):
                blockers.append('An independently verified publisher or maintainer checkpoint SHA-256 is required.')
            else:
                actual=_cached_file_sha256(str(checkpoint),stat.st_size,stat.st_mtime_ns)
                if actual!=checkpoint_hash:
                    blockers.append('The installed checkpoint differs from its acquisition manifest.')
                if expected!=actual:
                    blockers.append('The independently verified checkpoint SHA-256 does not match the installed file.')
        except (OSError,ValueError,TypeError):
            blockers.append('Checkpoint integrity could not be verified against its acquisition manifest.')
    if not (ROOT/'data/models/bioclinicalbert/pytorch_model.bin').is_file():
        blockers.append('The pinned Bio_ClinicalBERT files are missing.')
    if os.environ.get('MEDFORGE_CVS_ADAPNET_TERMS_CONFIRMED')!='1':
        blockers.append('Checkpoint-specific terms have not been independently reviewed and confirmed for local research use.')
    return blockers,checkpoint_hash

def _case_root() -> Path | None:
    raw=os.environ.get('MEDFORGE_OPENKBP_CASE_DIR','').strip()
    return Path(raw).expanduser().resolve() if raw else None

def _configured_openkbp_roots(env_name:str) -> dict[str,Path]:
    """Parse a trusted local case map; request identifiers are never filesystem paths."""
    raw=os.environ.get(env_name,'').strip()
    if not raw:
        return {}
    try:
        configured=json.loads(raw)
    except (TypeError,ValueError):
        return {}
    if not isinstance(configured,dict):
        return {}
    roots={}
    default_root=_case_root()
    default_id=_case_id()
    for case_id,directory in configured.items():
        if (not isinstance(case_id,str) or
            not re.fullmatch(r'openkbp:[A-Za-z0-9][A-Za-z0-9_.-]{0,79}',case_id) or
            case_id==default_id or
            not isinstance(directory,str) or not directory.strip()):
            continue
        try:
            root=Path(directory).expanduser().resolve()
        except (OSError,RuntimeError):
            continue
        if default_root is not None and root==default_root:
            continue
        if root.is_dir() and all((root/name).is_file() for name in ('ct.csv','dose.csv','possible_dose_mask.csv','voxel_dimensions.csv')):
            roots[case_id]=root
    return roots

def _configured_case_roots() -> dict[str,Path]:
    """Trusted local profiles limited to read-only scientific viewing."""
    return _configured_openkbp_roots('MEDFORGE_OPENKBP_CASES_JSON')

def _configured_full_case_roots() -> dict[str,Path]:
    """Trusted local profiles enabled for case-bound runs and dose comparisons."""
    return _configured_openkbp_roots('MEDFORGE_OPENKBP_FULL_CASES_JSON')

def _case_entry(case_id:str) -> tuple[Path,str,bool] | None:
    """Return (root, stable ID, full case capability) for a configured source."""
    legacy_id=_case_id()
    legacy_root=_case_root()
    if legacy_id==case_id and legacy_root is not None:
        return legacy_root,legacy_id,True
    full_root=_configured_full_case_roots().get(case_id)
    if full_root is not None:
        return full_root,case_id,True
    viewer_root=_configured_case_roots().get(case_id)
    if viewer_root is not None:
        return viewer_root,case_id,False
    return None

def _all_openkbp_case_entries() -> dict[str,tuple[Path,str,bool]]:
    entries={}
    default_id=_case_id()
    default_root=_case_root()
    if default_id is not None and default_root is not None:
        entries[default_id]=(default_root,default_id,True)
    for mapping,fully_enabled in ((_configured_full_case_roots(),True),(_configured_case_roots(),False)):
        for case_id,root in mapping.items():
            if case_id not in entries:
                entries[case_id]=(root,case_id,fully_enabled)
    return entries

def _case_record(case_id:str,root:Path,*,fully_enabled:bool) -> Case:
    status='ready' if fully_enabled else 'blocked'
    suffix='' if fully_enabled else ' — viewer only; analysis/import/report operations disabled'
    return Case(id=case_id,module='dosetwin',dataset_id='openkbp',source_case_id=root.name,
                reference_kind=_source_kind(),status=status,label='OpenKBP '+root.name+suffix)

def _expect_viewer_case(case_id:str) -> tuple[Case,Path]:
    entry=_case_entry(case_id)
    if entry is None:
        raise HTTPException(status_code=404,detail={'code':'CASE_NOT_INSTALLED','message':'No installed case matching this ID','action':'Configure MEDFORGE_OPENKBP_CASE_DIR or the trusted MEDFORGE_OPENKBP_CASES_JSON allowlist'})
    root,stable_id,fully_enabled=entry
    return _case_record(stable_id,root,fully_enabled=fully_enabled),root

def _expect_enabled_case(case_id:str) -> tuple[Case,Path]:
    entry=_case_entry(case_id)
    if entry is None or not entry[2]:
        raise HTTPException(status_code=404,detail={'code':'CASE_NOT_ENABLED','message':'This case is not enabled for runs, prediction import, comparison, and evidence reports','action':'Configure the case in MEDFORGE_OPENKBP_FULL_CASES_JSON after verifying its data and use basis'})
    root,stable_id,_=entry
    return _case_record(stable_id,root,fully_enabled=True),root

def _source_kind() -> str:
    value=os.environ.get('MEDFORGE_SOURCE_KIND','benchmark')
    if value not in ('benchmark','synthetic-test'):
        raise RuntimeError('MEDFORGE_SOURCE_KIND must be benchmark or synthetic-test')
    return value

def _source_revision() -> str:
    root=_case_root()
    return _source_revision_for_root(root)

def _source_revision_for_root(root:Path|None) -> str:
    manifest=(root/'medforge-source-manifest.json') if root else None
    if manifest and manifest.is_file():
        try:
            data=json.loads(manifest.read_text(encoding='utf8'))
            revision=data.get('upstream_commit')
            if isinstance(revision,str) and len(revision)==40 and all(c in '0123456789abcdef' for c in revision):
                return revision
        except (OSError,ValueError):
            pass
    return 'unrecorded-local-source'

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
        for migration in sorted(MIGRATIONS.glob('*.sql')):
            c.executescript(migration.read_text(encoding='utf8'))
        dose_artifact_schema=c.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='dose_artifacts'").fetchone()
        if dose_artifact_schema:
            dose_artifact_columns={row[1] for row in c.execute('PRAGMA table_info(dose_artifacts)').fetchall()}
            if 'checkpoint_sha256 TEXT NOT NULL' in dose_artifact_schema[0] or 'source_case_id' not in dose_artifact_columns:
                c.execute('DROP TABLE IF EXISTS dose_artifacts_rebuilt')
                c.execute('''CREATE TABLE dose_artifacts_rebuilt (
                  id TEXT PRIMARY KEY, case_id TEXT NOT NULL, source_case_id TEXT NOT NULL,
                  storage_key TEXT NOT NULL UNIQUE, source_file_name TEXT NOT NULL,
                  source_file_sha256 TEXT NOT NULL CHECK(length(source_file_sha256)=64),
                  source_revision TEXT NOT NULL, shape_json TEXT NOT NULL, spacing_json TEXT NOT NULL,
                  index_convention TEXT NOT NULL CHECK(index_convention='x-major-y-middle-z-fastest'),
                  dose_unit TEXT NOT NULL CHECK(dose_unit='Gy'),
                  origin TEXT NOT NULL CHECK(origin='archived_model_prediction'), model_revision TEXT NOT NULL,
                  checkpoint_sha256 TEXT CHECK(checkpoint_sha256 IS NULL OR length(checkpoint_sha256)=64),
                  rights_basis TEXT NOT NULL,
                  validation_status TEXT NOT NULL CHECK(validation_status='grid-validated-local-only'),
                  size_bytes INTEGER NOT NULL CHECK(size_bytes>0 AND size_bytes<=67108864),
                  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )''')
                legacy_source_case='source_case_id' if 'source_case_id' in dose_artifact_columns else 'case_id'
                c.execute(f'''INSERT INTO dose_artifacts_rebuilt
                    (id,case_id,source_case_id,storage_key,source_file_name,source_file_sha256,source_revision,
                     shape_json,spacing_json,index_convention,dose_unit,origin,model_revision,checkpoint_sha256,
                     rights_basis,validation_status,size_bytes,created_at)
                    SELECT id,case_id,{legacy_source_case},storage_key,source_file_name,source_file_sha256,source_revision,
                     shape_json,spacing_json,index_convention,dose_unit,origin,model_revision,checkpoint_sha256,
                     rights_basis,validation_status,size_bytes,created_at FROM dose_artifacts''')
                c.execute('DROP TABLE dose_artifacts')
                c.execute('ALTER TABLE dose_artifacts_rebuilt RENAME TO dose_artifacts')
                c.execute('CREATE INDEX idx_dose_artifacts_case_time ON dose_artifacts(case_id,created_at DESC)')
        c.execute('''INSERT OR IGNORE INTO models(id,module,name,version,upstream_url,upstream_commit,adapter_id,
            input_schema_id,output_schema_id,license_label,requires_gpu,min_vram_mb,metadata_json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (CVS_MODEL_ID,'surgivision','CVS-AdaptNet',CVS_MODEL_REVISION,
             'https://github.com/CAMMA-public/CVS-AdaptNet',CVS_MODEL_REVISION,
             'cvs-adaptnet/local-frame-v1','surgical-frame/v1','cvs-criterion-similarity/v1',
             'Code: CC BY-NC-SA 4.0; checkpoint-specific terms require review',1,6000,
             json.dumps({'execution_default':'blocked','source_model_check':'isolated 409-frame validation complete'})))
        checkpoint_manifest=ROOT/'data/models/cvs-adaptnet/medforge-checkpoint-manifest.json'
        if checkpoint_manifest.is_file():
            try:
                artifact=json.loads(checkpoint_manifest.read_text(encoding='utf8'))
                if artifact.get('checkpoint')=='CVSAdaptNet.pth' and isinstance(artifact.get('sha256'),str):
                    c.execute('''INSERT OR IGNORE INTO model_artifacts(id,model_id,storage_key,sha256,artifact_kind,installed)
                        VALUES (?,?,?,?,?,?)''',
                        ('cvs-adaptnet-checkpoint-v1',CVS_MODEL_ID,'models/cvs-adaptnet/CVSAdaptNet.pth',artifact['sha256'],'checkpoint',1))
            except (OSError,ValueError,TypeError):
                pass
        openkbp_cases=_all_openkbp_case_entries()
        if openkbp_cases:
            c.execute('INSERT OR IGNORE INTO datasets(id,name,modality,source_url,license_label) VALUES (?,?,?,?,?)',
                ('openkbp','OpenKBP','radiotherapy-volume',SOURCE_URL,'Dataset rights require independent review'))
            c.execute('INSERT OR IGNORE INTO dataset_versions(id,dataset_id,version) VALUES (?,?,?)',
                ('openkbp-public','openkbp','public-source'))
            for case_id,(case_root,_,fully_enabled) in openkbp_cases.items():
                c.execute('''INSERT INTO cases(id,module,dataset_version_id,external_case_id,partition_name,reference_kind,status) VALUES (?,?,?,?,?,?,?)
                    ON CONFLICT(id) DO UPDATE SET module=excluded.module,dataset_version_id=excluded.dataset_version_id,
                        external_case_id=excluded.external_case_id,reference_kind=excluded.reference_kind,status=excluded.status''',
                    (case_id,'dosetwin','openkbp-public',case_root.name,None,_source_kind(),'ready' if fully_enabled else 'blocked'))

def _case_response() -> Case | None:
    cid=_case_id()
    if cid is None:return None
    return Case(id=cid,module='dosetwin',dataset_id='openkbp',source_case_id=_case_root().name,
                reference_kind=_source_kind(),status='ready',label='OpenKBP '+_case_root().name)

def _expect_case(cid:str) -> Case:
    return _expect_enabled_case(cid)[0]

def _ensure_learning_case(conn:sqlite3.Connection, case:Case) -> None:
    dataset_id=''.join(ch.lower() if ch.isalnum() else '-' for ch in case.dataset_id).strip('-')
    dataset_id='-'.join(part for part in dataset_id.split('-') if part)
    dataset_version_id=f'{dataset_id}-local-verified'
    modalities={'surgivision':'surgical-video','dosetwin':'radiotherapy-volume','fistulaguard':'vascular-signal'}
    sources={
        'surgivision':('https://github.com/CAMMA-public/Endoscapes','CC BY-NC-SA 4.0; non-commercial scientific research'),
        'dosetwin':(SOURCE_URL,'OpenKBP research benchmark; dataset rights require independent review'),
        'fistulaguard':('https://osf.io/hypfr/','CC BY 4.0'),
    }
    source_url,license_label=sources[case.module]
    conn.execute('INSERT OR IGNORE INTO datasets(id,name,modality,source_url,license_label,redistribution_allowed,access_policy) VALUES (?,?,?,?,?,?,?)',
        (dataset_id,case.dataset_id,modalities[case.module],source_url,license_label,0,'restricted'))
    conn.execute('INSERT OR IGNORE INTO dataset_versions(id,dataset_id,version) VALUES (?,?,?)',
        (dataset_version_id,dataset_id,'local-verified-sample'))
    conn.execute('INSERT OR IGNORE INTO cases(id,module,dataset_version_id,external_case_id,reference_kind,status) VALUES (?,?,?,?,?,?)',
        (case.id,case.module,dataset_version_id,case.source_case_id,case.reference_kind,case.status))

@lru_cache(maxsize=12)
def _read_cached_slice(case_dir: str, file_name: str, axis: int, index: int, modified_ns: int) -> tuple[list[float], tuple[int, int]]:
    # A fixed whitelist below prevents request paths from becoming filesystem paths.
    root=Path(case_dir).resolve()
    path=(root/file_name).resolve()
    if path.parent != root or not path.is_file():
        raise FileNotFoundError(file_name)
    volume=_read_cached_volume(str(root),file_name,path.stat().st_size,modified_ns)
    plane=np.take(volume, index, axis=axis)
    return plane.astype(np.float32,copy=False).ravel().tolist(), (int(plane.shape[0]),int(plane.shape[1]))

@lru_cache(maxsize=10)
def _read_cached_volume(case_dir: str, file_name: str, size_bytes: int, modified_ns: int) -> np.ndarray:
    del size_bytes,modified_ns
    root=Path(case_dir).resolve()
    if file_name not in {'ct.csv','dose.csv','possible_dose_mask.csv'} and not re.fullmatch(r'(Brainstem|SpinalCord|RightParotid|LeftParotid|Esophagus|Larynx|Mandible|PTV56|PTV63|PTV70)\.csv',file_name):
        raise FileNotFoundError(file_name)
    path=(root/file_name).resolve()
    if path.parent!=root or not path.is_file():
        raise FileNotFoundError(file_name)
    return validate_sparse_volume(path)

def validate_sparse_volume(path: Path) -> np.ndarray:
    from .openkbp import read_sparse_csv
    return read_sparse_csv(path,(128,128,128),binary=path.name.endswith('.csv') and path.name not in ('ct.csv','dose.csv'))

def _dose_artifact_root() -> Path:
    raw=os.environ.get('MEDFORGE_DOSE_ARTIFACT_DIR','').strip()
    return Path(raw).expanduser().resolve() if raw else (ROOT/'data'/'dose-artifacts').resolve()

def _dose_artifact_record(row) -> DoseArtifact:
    return DoseArtifact(id=row[0],case_id=row[1],source_case_id=row[2],source_file_name=row[3],source_file_sha256=row[4],
        source_revision=row[5],shape=tuple(json.loads(row[6])),spacing_mm=tuple(json.loads(row[7])),
        index_convention=row[8],dose_unit=row[9],origin=row[10],model_revision=row[11],
        checkpoint_sha256=row[12] or None,rights_basis=row[13],validation_status=row[14],size_bytes=row[15],created_at=row[16])

def _stored_dose_artifact(artifact_id:str):
    if not re.fullmatch(r'dose_[0-9a-f]{32}',artifact_id):
        return None
    with _db() as conn:
        return conn.execute('''SELECT id,case_id,source_case_id,source_file_name,source_file_sha256,source_revision,shape_json,
            spacing_json,index_convention,dose_unit,origin,model_revision,checkpoint_sha256,rights_basis,
            validation_status,size_bytes,created_at,storage_key FROM dose_artifacts WHERE id=?''',(artifact_id,)).fetchone()

def _reject_student_dose_prediction_access(authorization:str|None) -> None:
    with _db() as conn:
        user=_current_user(conn,authorization)
    if user and user['role']=='student':
        raise HTTPException(status_code=403,detail={'code':'DOSE_PREDICTION_RESEARCH_ONLY','message':'Imported dose predictions and comparisons are not available in student viewer sessions'})

def create_app() -> FastAPI:
    app=FastAPI(title='MEDFORGE local research API',version='0.1.0',
        description='Loopback-only research and education API. Local educator/student access tokens are not production identity or public RBAC.')
    app.add_middleware(CORSMiddleware,allow_origin_regex=r'^https?://(127\.0\.0\.1|localhost)(:\d+)?$',
        allow_credentials=False,allow_methods=['GET','POST','PATCH','PUT'],allow_headers=['Content-Type','Authorization','Idempotency-Key','X-Dose-Array-Shape','X-Dose-Checkpoint-SHA256','X-Dose-File-SHA256','X-Dose-Index-Convention','X-Dose-Model-Revision','X-Dose-Origin','X-Dose-Rights-Basis','X-Dose-Rights-Confirmed','X-Dose-Source-Case','X-Dose-Source-Revision','X-Dose-Spacing-MM','X-Dose-Unit'])
    init_db()

    def _student_has_assigned_case(user_id:str,case_id:str)->bool:
        with _db() as conn:
            return conn.execute('''SELECT 1 FROM assignments a
                JOIN lesson_versions v ON v.id=a.lesson_version_id
                JOIN learning_cohort_memberships m ON m.cohort_id=a.cohort_id
                WHERE m.user_id=? AND v.case_id=? AND v.status='published' LIMIT 1''',
                (user_id,case_id)).fetchone() is not None

    @app.middleware('http')
    async def student_research_scope(request,call_next):
        if request.method=='OPTIONS':
            return await call_next(request)
        path=request.url.path
        if not path.startswith('/api/v1/'):
            return await call_next(request)
        with _db() as conn:
            user=_current_user(conn,request.headers.get('authorization'))
        if user is None or user['role']!='student':
            return await call_next(request)
        if path.startswith(('/api/v1/academy/','/api/v1/auth/')) or path=='/api/v1/modules':
            return await call_next(request)
        parts=unquote(path).split('/')
        case_id=None
        if len(parts)>4 and parts[3]=='cases':
            case_id=parts[4]
        elif len(parts)>5 and parts[3]=='surgivision' and parts[4]=='frames':
            frame_id=parts[5]
            if re.fullmatch(r'[A-Za-z0-9_:-]{1,120}',frame_id):
                installed=_endoscapes_frame(frame_id)
                case_id=installed.id if installed else None
        elif len(parts)>5 and parts[3]=='fistulaguard' and parts[4]=='records':
            record_id=parts[5]
            if re.fullmatch(r'pat[0-9]{3}',record_id):
                case_id=f'fisav:{record_id}'
        if case_id and _student_has_assigned_case(user['id'],case_id):
            return await call_next(request)
        return JSONResponse(status_code=403,content={'detail':{
            'code':'STUDENT_CASE_SCOPE_REQUIRED',
            'message':'Student research access is limited to cases attached to your published cohort assignments.'}})

    @app.get('/healthz',response_model=Health)
    def health() -> Health:return Health()

    @app.post('/api/v1/auth/local-login',response_model=LocalSession)
    def local_login(request:LocalLoginRequest):
        with _db() as c:
            row=c.execute('''SELECT u.id,u.display_name,lc.salt,lc.password_hash
                FROM local_credentials lc JOIN users u ON u.id=lc.user_id
                WHERE lc.username=? COLLATE NOCASE''',(request.username,)).fetchone()
            if row is None or not verify_password(request.password,bytes(row[2]),bytes(row[3])):
                raise HTTPException(401,detail={'code':'INVALID_CREDENTIALS','message':'The username or password is incorrect'})
            role=c.execute("SELECT role FROM role_grants WHERE user_id=? AND scope='platform' ORDER BY CASE role WHEN 'educator' THEN 1 WHEN 'student' THEN 2 ELSE 3 END LIMIT 1",(row[0],)).fetchone()
            if role is None:
                raise HTTPException(403,detail={'code':'ROLE_NOT_CONFIGURED','message':'This account has no local platform role'})
            token,expires_at=issue_session(c,row[0])
        user=LocalUser(id=row[0],display_name=row[1],role=role[0])
        return LocalSession(access_token=token,expires_at=expires_at,user=user)

    @app.get('/api/v1/auth/me',response_model=LocalUser)
    def local_me(authorization:str|None=Header(default=None)):
        with _db() as c:user=_current_user(c,authorization)
        if user is None:
            raise HTTPException(401,detail={'code':'AUTH_REQUIRED','message':'Sign in with a provisioned local account'},headers={'WWW-Authenticate':'Bearer'})
        return LocalUser(**{key:user[key] for key in ('id','display_name','role')})

    @app.post('/api/v1/auth/logout')
    def local_logout(authorization:str|None=Header(default=None)):
        if not authorization or not authorization.lower().startswith('bearer '):
            raise HTTPException(401,detail={'code':'AUTH_REQUIRED','message':'No active local session'})
        token=authorization[7:].strip()
        if not token or len(token)>256:
            raise HTTPException(401,detail={'code':'AUTH_REQUIRED','message':'No active local session'})
        with _db() as c:
            user=_current_user(c,authorization)
            if user is None:raise HTTPException(401,detail={'code':'AUTH_REQUIRED','message':'No active local session'})
            c.execute('UPDATE local_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE token_hash=?',(hashlib.sha256(token.encode()).hexdigest(),))
        return {'status':'signed-out'}

    @app.get('/api/v1/educator/evidence',response_model=list[EducatorEvidenceItem])
    def educator_evidence(user:dict=Depends(require_role('educator'))):
        rows=[]
        for case in list_cases():
            if case.module=='dosetwin':
                license_label='OpenKBP research benchmark; dataset terms require independent review'
                publication_review='blocked'
                note='Dataset permission for publishing is not established in this local record.'
            elif case.module=='surgivision':
                license_label='CC BY-NC-SA 4.0; non-commercial scientific research'
                publication_review='required'
                note='Confirm attribution, non-commercial scope and permitted student access before publishing.'
            else:
                license_label='CC BY 4.0'
                publication_review='required'
                note='Confirm attribution and appropriate educational context before publishing.'
            rows.append(EducatorEvidenceItem(case=case,license_label=license_label,
                publication_review=publication_review,publication_note=note))
        return rows

    @app.get('/api/v1/educator/drafts',response_model=list[EducatorDraftSummary])
    def educator_draft_list(user:dict=Depends(require_role('educator'))):
        with _db() as c:
            rows=c.execute('''SELECT d.id,d.title,d.case_id,c.module,d.revision,d.updated_at
                FROM educator_drafts d JOIN cases c ON c.id=d.case_id
                WHERE d.owner_id=? ORDER BY d.updated_at DESC,d.id''',(user['id'],)).fetchall()
        return [EducatorDraftSummary(id=row[0],title=row[1],case_id=row[2],module=row[3],revision=row[4],updated_at=row[5]) for row in rows]

    @app.post('/api/v1/educator/drafts',response_model=EducatorDraft,status_code=201)
    def educator_draft_create(request:EducatorDraftCreate,user:dict=Depends(require_role('educator'))):
        if not request.title.strip():
            raise HTTPException(422,detail={'code':'TITLE_REQUIRED','message':'Add a lesson title before saving'})
        case=next((item for item in list_cases() if item.id==request.case_id),None)
        if case is None or case.status!='ready':
            raise HTTPException(422,detail={'code':'CASE_NOT_AVAILABLE','message':'Choose a source case that is installed and ready'})
        draft_id=str(uuid.uuid4())
        content_json=json.dumps(request.content.model_dump(),ensure_ascii=False,separators=(',',':'),sort_keys=True)
        with _db() as c:
            _ensure_learning_case(c,case)
            c.execute('''INSERT INTO educator_drafts(id,owner_id,case_id,title,content_json)
                VALUES (?,?,?,?,?)''',(draft_id,user['id'],case.id,request.title.strip(),content_json))
            row=c.execute('''SELECT d.id,d.title,d.case_id,c.module,d.revision,d.updated_at,d.content_json
                FROM educator_drafts d JOIN cases c ON c.id=d.case_id WHERE d.id=?''',(draft_id,)).fetchone()
        return EducatorDraft(id=row[0],title=row[1],case_id=row[2],module=row[3],revision=row[4],updated_at=row[5],content=json.loads(row[6]))

    @app.get('/api/v1/educator/drafts/{draft_id}',response_model=EducatorDraft)
    def educator_draft_get(draft_id:str,user:dict=Depends(require_role('educator'))):
        with _db() as c:
            row=c.execute('''SELECT d.id,d.title,d.case_id,c.module,d.revision,d.updated_at,d.content_json
                FROM educator_drafts d JOIN cases c ON c.id=d.case_id
                WHERE d.id=? AND d.owner_id=?''',(draft_id,user['id'])).fetchone()
        if row is None:
            raise HTTPException(404,detail={'code':'DRAFT_NOT_FOUND','message':'No lesson draft belongs to this account'})
        return EducatorDraft(id=row[0],title=row[1],case_id=row[2],module=row[3],revision=row[4],updated_at=row[5],content=json.loads(row[6]))

    @app.put('/api/v1/educator/drafts/{draft_id}',response_model=EducatorDraft)
    def educator_draft_update(draft_id:str,request:EducatorDraftUpdate,user:dict=Depends(require_role('educator'))):
        if not request.title.strip():
            raise HTTPException(422,detail={'code':'TITLE_REQUIRED','message':'Add a lesson title before saving'})
        case=next((item for item in list_cases() if item.id==request.case_id),None)
        if case is None or case.status!='ready':
            raise HTTPException(422,detail={'code':'CASE_NOT_AVAILABLE','message':'Choose a source case that is installed and ready'})
        content_json=json.dumps(request.content.model_dump(),ensure_ascii=False,separators=(',',':'),sort_keys=True)
        with _db() as c:
            c.execute('BEGIN IMMEDIATE')
            current=c.execute('SELECT revision FROM educator_drafts WHERE id=? AND owner_id=?',(draft_id,user['id'])).fetchone()
            if current is None:
                raise HTTPException(404,detail={'code':'DRAFT_NOT_FOUND','message':'No lesson draft belongs to this account'})
            if current[0]!=request.expected_revision:
                raise HTTPException(409,detail={'code':'DRAFT_REVISION_CONFLICT','message':'This draft changed in another session. Reload it before saving.'})
            _ensure_learning_case(c,case)
            updated=c.execute('''UPDATE educator_drafts SET case_id=?,title=?,content_json=?,revision=revision+1,
                updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND revision=?''',
                (case.id,request.title.strip(),content_json,draft_id,user['id'],request.expected_revision)).rowcount
            if not updated:
                raise HTTPException(409,detail={'code':'DRAFT_REVISION_CONFLICT','message':'This draft changed in another session. Reload it before saving.'})
            row=c.execute('''SELECT d.id,d.title,d.case_id,c.module,d.revision,d.updated_at,d.content_json
                FROM educator_drafts d JOIN cases c ON c.id=d.case_id WHERE d.id=?''',(draft_id,)).fetchone()
        return EducatorDraft(id=row[0],title=row[1],case_id=row[2],module=row[3],revision=row[4],updated_at=row[5],content=json.loads(row[6]))

    @app.get('/api/v1/modules',response_model=list[ModuleStatus])
    def modules():
        openkbp_cases=_all_openkbp_case_entries()
        ready=bool(openkbp_cases)
        surgical_cases=_endoscapes_cases()
        surgical_ready=bool(surgical_cases)
        fistula_records=_fisav.installed_records()
        fistula_ready=bool(fistula_records)
        return [
            ModuleStatus(id='surgivision',capability_state='ready' if surgical_ready else 'requires-setup',detail=f'{len(surgical_cases)} annotated Endoscapes frames and 1 fps sampled sequences; {"a separately licensed Appendix300 excerpt is installed" if _appendix300.clip_record() else "no continuous surgical clip is installed"}' if surgical_ready else 'Set MEDFORGE_ENDOSCAPES_ROOT to a verified local research sample'),
            ModuleStatus(id='dosetwin',capability_state='ready' if ready else 'requires-setup',detail=('OpenKBP local case summary available' if ready else 'Set MEDFORGE_OPENKBP_CASE_DIR') + (f'; {sum(1 for _,_,enabled in openkbp_cases.values() if enabled)} case(s) fully enabled, {sum(1 for _,_,enabled in openkbp_cases.values() if not enabled)} viewer-only case(s)' if openkbp_cases else '')),
            ModuleStatus(id='fistulaguard',capability_state='ready' if fistula_ready else 'requires-setup',detail=f'Source-verified FiSaV CSV cohort available ({len(fistula_records)} recordings); no classifier is enabled' if fistula_ready else 'Set MEDFORGE_FISAV_ROOT to a verified local FiSaV research sample')]

    @app.get('/api/v1/cases',response_model=list[Case])
    def list_cases():
        rows=[_case_record(case_id,root,fully_enabled=enabled) for case_id,(root,_,enabled) in sorted(_all_openkbp_case_entries().items())]
        rows.extend(_endoscapes_cases())
        rows.extend(_fisav.installed_records())
        return rows

    @app.get('/api/v1/cases/{case_id}',response_model=Case,responses={404:{'model':ApiError}})
    def get_case(case_id:str):
        frame=_endoscapes_frame(case_id)
        if frame:
            return _endoscapes_case_record(frame)
        if case_id.startswith('fisav:'):
            record_id=case_id.split(':',1)[1]
            case=next((item for item in _fisav.installed_records() if item.source_case_id==record_id),None)
            if case:
                return case
        entry=_case_entry(case_id)
        if entry is not None:
            root,stable_id,fully_enabled=entry
            return _case_record(stable_id,root,fully_enabled=fully_enabled)
        raise HTTPException(status_code=404,detail={'code':'CASE_NOT_INSTALLED','message':'No installed case matching this ID','action':'Configure MEDFORGE_OPENKBP_CASE_DIR or the trusted MEDFORGE_OPENKBP_CASES_JSON allowlist'})

    @app.get('/api/v1/cases/{case_id}/viewer-manifest',response_model=ViewerManifest)
    def manifest(case_id:str):
        frame=_endoscapes_frame(case_id)
        if frame:
            sampled=frame.dataset_id=='Endoscapes2023'
            return ViewerManifest(
                case_id=frame.id,modality='surgical-video',
                artifacts=[SurgicalFrameArtifact(asset_key=f'endoscapes/{frame.split}/{frame.file_name}',frame_count=1,has_real_video=False)],
                provenance_label='Endoscapes 1 fps sampled source frame; no model output' if sampled else 'Endoscapes reference frame and official research annotations; no model output',
                source_url=ENDOSCAPES_URL,
                limitations=['This is one still from the 1 fps Endoscapes sequence; it is not continuous video or a timestamped playback track','COCO boxes and CVS values are present only where the official BBox201 annotations provide them','Critical View of Safety values are image-level source labels, not a surgical clearance'],
            )
        if case_id.startswith('fisav:'):
            record_id=case_id.split(':',1)[1]
            signal=_fisav.record(record_id)
            if signal:
                summary=_fisav.record_summary(signal,record_id)
                return ViewerManifest(
                    case_id=summary.case_id,modality='vascular-signal',
                    artifacts=[SignalArtifact(asset_key=f'fisav/{record_id}.csv',sample_rate_hz=summary.sample_rate_hz,
                        channel_units=summary.channel_units,duration_sec=summary.duration_sec)],
                    provenance_label='Measured research recording from the FiSaV AVF dataset; no stenosis classification',
                    source_url=summary.source_url,limitations=summary.limitations,
                )
        case,case_root=_expect_viewer_case(case_id)
        shape=(128,128,128)
        # Manifest uses semantic storage keys, never a host path or public download URL.
        spacing=np.loadtxt(case_root/'voxel_dimensions.csv').reshape(-1)
        if len(spacing)!=3 or not np.all(np.isfinite(spacing)) or not np.all(spacing>0):
            raise HTTPException(422,detail={'code':'INVALID_SPACING','message':'Voxel spacing requires 3 positive finite mm values'})
        return ViewerManifest(case_id=case.id,modality='radiotherapy-volume',
            artifacts=[VoxelVolumeArtifact(asset_key=case.id+'/dose.csv',shape=shape,spacing_mm=tuple(float(v) for v in spacing))],
            provenance_label=('OpenKBP synthetic benchmark reference dose' if _source_kind()=='benchmark' else 'SYNTHETIC TEST ONLY') + ('; viewer-only profile' if case.status=='blocked' else ''),
            source_url=SOURCE_URL,limitations=['No original DICOM patient orientation/origin assumed','Slices are presented in benchmark array index space'])

    @app.get('/api/v1/surgivision/media',response_model=list[SurgicalMediaRecord])
    def surgivision_media():
        """List verified source modes without exposing local paths or implying continuous video."""
        grouped: dict[tuple[str,int],list[Case]]={}
        for case in _endoscapes_cases():
            match=re.fullmatch(r'endoscapes:(train|val|test):\d+_\d+',case.id)
            source=re.fullmatch(r'video-(\d+):frame-(\d+)',case.source_case_id)
            if match is None or source is None:
                continue
            grouped.setdefault((match.group(1),int(source.group(1))),[]).append(case)
        records=[]
        sampled = {
            (item['split'], item['video_id']): item
            for item in _endoscapes.sampled_video_catalog()
        }
        limitations=[
            'The 1 fps sequence contains sampled still images, not continuous video playback.',
            'Official BBox annotations apply only to their original keyframes; other sampled frames have no overlays.',
            'No temporal phase or instrument-triplet labels are available for this source split.',
        ]
        for split,video_id in sorted(set(grouped) | set(sampled)):
            cases=grouped.get((split,video_id),[])
            frame_ids=sorted((case.id for case in cases),key=lambda value:int(value.rsplit('_',1)[1]))
            sequence=sampled.get((split,video_id))
            if not sequence and not frame_ids:
                continue
            first_frame=sequence['first_frame_id'] if sequence else frame_ids[0]
            last_frame=sequence['last_frame_id'] if sequence else frame_ids[-1]
            capabilities=[]
            if sequence:
                capabilities.append('browse_sampled_sequence')
            if frame_ids:
                capabilities.append('browse_annotated_frames')
            records.append(SurgicalMediaRecord(
                media_id=f'endoscapes-bbox201:{split}:video-{video_id}',
                dataset_id='Endoscapes2023' if sequence else 'Endoscapes-BBox201',
                source_video_id=video_id,split=split,media_kind='sampled_sequence' if sequence else 'annotated_stills',
                sampling_fps=sequence['sampling_fps'] if sequence else None,
                sampled_frame_count=sequence['frame_count'] if sequence else 0,
                annotated_frame_count=len(frame_ids),first_frame_id=first_frame,last_frame_id=last_frame,
                source_url=ENDOSCAPES_URL,license_label='CC BY-NC-SA 4.0',
                allowed_use='Non-commercial research and education with attribution; review the source license before reuse.',
                source_revision=ENDOSCAPES_SOURCE_REVISION,metadata_validation_status='validated',
                capabilities=capabilities,limitations=limitations,
            ))
        return records

    @app.get('/api/v1/surgivision/media/{media_id}',response_model=SurgicalMediaRecord)
    def surgivision_media_detail(media_id:str):
        if not re.fullmatch(r'endoscapes-bbox201:(train|val|test):video-\d+',media_id):
            raise HTTPException(status_code=404,detail={'code':'SURGICAL_MEDIA_NOT_INSTALLED','message':'No authorized local surgical media record matches this ID'})
        record=next((item for item in surgivision_media() if item.media_id==media_id),None)
        if record is None:
            raise HTTPException(status_code=404,detail={'code':'SURGICAL_MEDIA_NOT_INSTALLED','message':'No authorized local surgical media record matches this ID'})
        return record

    @app.get('/api/v1/surgivision/media/{media_id}/sampled-frames',response_model=list[SurgicalSequenceFrame])
    def surgivision_sampled_frames(media_id:str):
        match=re.fullmatch(r'endoscapes-bbox201:(train|val|test):video-(\d+)',media_id)
        if match is None:
            raise HTTPException(status_code=404,detail={'code':'SURGICAL_SEQUENCE_NOT_INSTALLED','message':'No verified sampled sequence matches this ID'})
        split,video_id=match.group(1),int(match.group(2))
        record=next((item for item in surgivision_media() if item.media_id==media_id),None)
        if record is None or 'browse_sampled_sequence' not in record.capabilities:
            raise HTTPException(status_code=404,detail={'code':'SURGICAL_SEQUENCE_NOT_INSTALLED','message':'No verified sampled sequence matches this ID'})
        return _endoscapes.sampled_sequence_frames(split,video_id)

    @app.get('/api/v1/surgivision/clips',response_model=list[SurgicalClipRecord])
    def surgivision_clips():
        record=_appendix300.clip_record()
        return [record] if record else []

    @app.get('/api/v1/surgivision/clips/{clip_id}/video')
    def surgivision_clip_video(clip_id:str,range_header:str|None=Header(default=None,alias='Range')):
        if not re.fullmatch(r'appendix300-[a-z0-9-]+',clip_id):
            raise HTTPException(status_code=404,detail={'code':'SURGICAL_CLIP_NOT_INSTALLED','message':'No verified licensed surgical clip matches this ID'})
        path=_appendix300.video_path(clip_id)
        if path is None:
            raise HTTPException(status_code=404,detail={'code':'SURGICAL_CLIP_NOT_INSTALLED','message':'No verified licensed surgical clip matches this ID'})
        size=path.stat().st_size
        headers={'Accept-Ranges':'bytes','Content-Type':'video/mp4','Cache-Control':'private, max-age=300'}
        if range_header is None:
            return FileResponse(path,media_type='video/mp4',headers=headers)
        unit,separator,value=range_header.partition('=')
        if not separator or unit.strip().lower()!='bytes' or ',' in value:
            raise HTTPException(status_code=416,detail='Only one byte range is supported',headers={'Content-Range':f'bytes */{size}'})
        start_text,end_text=value.strip().split('-',1)
        try:
            if not start_text:
                suffix=int(end_text)
                if suffix<=0:raise ValueError
                start=max(0,size-suffix);end=size-1
            else:
                start=int(start_text);end=min(int(end_text),size-1) if end_text else size-1
        except ValueError as error:
            raise HTTPException(status_code=416,detail='Invalid byte range',headers={'Content-Range':f'bytes */{size}'}) from error
        if start<0 or end<start or start>=size:
            raise HTTPException(status_code=416,detail='Requested byte range is unsatisfiable',headers={'Content-Range':f'bytes */{size}'})
        length=end-start+1
        def content():
            with path.open('rb') as stream:
                stream.seek(start)
                remaining=length
                while remaining:
                    chunk=stream.read(min(64*1024,remaining))
                    if not chunk:break
                    remaining-=len(chunk)
                    yield chunk
        headers.update({'Content-Range':f'bytes {start}-{end}/{size}','Content-Length':str(length)})
        return StreamingResponse(content(),status_code=206,media_type='video/mp4',headers=headers)

    @app.get('/api/v1/surgivision/frames/{frame_id}',response_model=SurgicalFrameRecord)
    def surgical_frame(frame_id:str,authorization:str|None=Header(default=None)):
        frame=_endoscapes_frame(frame_id)
        if frame is None:
            raise HTTPException(status_code=404,detail={'code':'SURGICAL_FRAME_NOT_INSTALLED','message':'No verified local Endoscapes frame matches this ID','action':'Configure an authorized local Endoscapes sample'})
        with _db() as conn:
            user=_current_user(conn,authorization)
        if user and user['role']=='student':
            return frame.model_copy(update={'annotations':[],'cvs_criteria':tuple()})
        return frame

    @app.get('/api/v1/surgivision/cvs-coverage',response_model=CvsCoverage)
    def surgivision_cvs_coverage(authorization:str|None=Header(default=None)):
        with _db() as conn:
            user=_current_user(conn,authorization)
        if user and user['role']=='student':
            raise HTTPException(status_code=403,detail={'code':'CVS_REFERENCE_RESTRICTED','message':'Aggregate source CVS labels are available after educator review, not in the student viewer'})
        coverage=_endoscapes.cvs_label_coverage()
        if coverage is None:
            raise HTTPException(status_code=404,detail={'code':'CVS_COVERAGE_UNAVAILABLE','message':'No checksum-verified Endoscapes-BBox201 label coverage is installed'})
        return coverage

    @app.get('/api/v1/surgivision/frames/{frame_id}/image')
    def surgical_frame_image(frame_id:str):
        frame=_endoscapes_frame(frame_id)
        if frame is None:
            raise HTTPException(status_code=404,detail={'code':'SURGICAL_FRAME_NOT_INSTALLED','message':'No verified local Endoscapes frame matches this ID'})
        return FileResponse(frame.image_path,media_type='image/jpeg',headers={'ETag':f'"{frame.image_sha256}"','Cache-Control':'private, max-age=3600'})

    @app.get('/api/v1/fistulaguard/records/{record_id}',response_model=SignalRecord)
    def fistulaguard_record(record_id:str):
        loaded=_fisav.record(record_id)
        if loaded is None:
            raise HTTPException(status_code=404,detail={'code':'FISAV_RECORD_NOT_INSTALLED','message':'No verified local FiSaV recording matches this ID','action':'Configure an authorized local FiSaV sample'})
        return _fisav.record_summary(loaded,record_id)

    @app.get('/api/v1/fistulaguard/records/{record_id}/waveform',response_model=SignalWindow)
    def fistulaguard_waveform(record_id:str,channel:str=Query('raw PZT1',pattern='^(ECG|raw PZT1|raw PZT2|raw PZT3|raw PZT4)$'),
                              start_sec:float=Query(0,ge=0),duration_sec:float=Query(5,ge=0.5,le=30)):
        loaded=_fisav.record(record_id)
        if loaded is None:
            raise HTTPException(status_code=404,detail={'code':'FISAV_RECORD_NOT_INSTALLED','message':'No verified local FiSaV recording matches this ID'})
        duration=float(loaded[0][-1,0]-loaded[0][0,0])
        if start_sec+duration_sec>duration:
            raise HTTPException(status_code=422,detail={'code':'WINDOW_OUT_OF_RANGE','message':f'Requested window exceeds the {duration:.2f} second source recording'})
        return _fisav.waveform(loaded,channel,start_sec,duration_sec,record_id)

    @app.get('/api/v1/fistulaguard/records/{record_id}/spectrum',response_model=SignalSpectrum)
    def fistulaguard_spectrum(record_id:str,channel:str=Query('raw PZT1',pattern='^(ECG|raw PZT1|raw PZT2|raw PZT3|raw PZT4)$'),
                              start_sec:float=Query(0,ge=0),duration_sec:float=Query(5,ge=0.5,le=30)):
        loaded=_fisav.record(record_id)
        if loaded is None:
            raise HTTPException(status_code=404,detail={'code':'FISAV_RECORD_NOT_INSTALLED','message':'No verified local FiSaV recording matches this ID'})
        duration=float(loaded[0][-1,0]-loaded[0][0,0])
        if start_sec+duration_sec>duration:
            raise HTTPException(status_code=422,detail={'code':'WINDOW_OUT_OF_RANGE','message':f'Requested window exceeds the {duration:.2f} second source recording'})
        return _fisav.spectrum(loaded,channel,start_sec,duration_sec,record_id)

    @app.get('/api/v1/fistulaguard/records/{record_id}/spectrogram',response_model=SignalSpectrogram)
    def fistulaguard_spectrogram(record_id:str,channel:str=Query('raw PZT1',pattern='^(ECG|raw PZT1|raw PZT2|raw PZT3|raw PZT4)$'),
                                 start_sec:float=Query(0,ge=0),duration_sec:float=Query(5,ge=0.5,le=30)):
        loaded=_fisav.record(record_id)
        if loaded is None:
            raise HTTPException(status_code=404,detail={'code':'FISAV_RECORD_NOT_INSTALLED','message':'No verified local FiSaV recording matches this ID'})
        duration=float(loaded[0][-1,0]-loaded[0][0,0])
        if start_sec+duration_sec>duration:
            raise HTTPException(status_code=422,detail={'code':'WINDOW_OUT_OF_RANGE','message':f'Requested window exceeds the {duration:.2f} second source recording'})
        return _fisav.spectrogram(loaded,channel,start_sec,duration_sec,record_id)

    @app.get('/api/v1/fistulaguard/records/{record_id}/features',response_model=SignalFeatures)
    def fistulaguard_features(record_id:str,channel:str=Query('raw PZT1',pattern='^(ECG|raw PZT1|raw PZT2|raw PZT3|raw PZT4)$'),
                              start_sec:float=Query(0,ge=0),duration_sec:float=Query(5,ge=0.5,le=30)):
        loaded=_fisav.record(record_id)
        if loaded is None:
            raise HTTPException(status_code=404,detail={'code':'FISAV_RECORD_NOT_INSTALLED','message':'No verified local FiSaV recording matches this ID'})
        duration=float(loaded[0][-1,0]-loaded[0][0,0])
        if start_sec+duration_sec>duration:
            raise HTTPException(status_code=422,detail={'code':'WINDOW_OUT_OF_RANGE','message':f'Requested window exceeds the {duration:.2f} second source recording'})
        return _fisav.features(loaded,channel,start_sec,duration_sec,record_id)

    @app.post('/api/v1/comparisons',response_model=SignalWindowComparison,
              responses={404:{'model':ApiError},422:{'model':ApiError}})
    def create_signal_comparison(request:SignalWindowComparisonCreate):
        case=get_case(request.case_id)
        if case.module!='fistulaguard':
            raise HTTPException(status_code=422,detail={'code':'INCOMPATIBLE_INPUT','message':'This comparison accepts only one checksum-verified FiSaV recording and channel.'})
        loaded=_fisav.record(case.source_case_id)
        if loaded is None:
            raise HTTPException(status_code=404,detail={'code':'FISAV_RECORD_NOT_INSTALLED','message':'No verified local FiSaV recording matches this case.'})
        try:
            selected=_fisav.features(loaded,request.channel,request.selected_start_sec,request.duration_sec,case.source_case_id)
            reference=_fisav.features(loaded,request.channel,request.reference_start_sec,request.duration_sec,case.source_case_id)
        except ValueError as exc:
            raise HTTPException(status_code=422,detail={'code':'WINDOW_OUT_OF_RANGE','message':str(exc)}) from exc
        if (selected.source_sha256!=reference.source_sha256 or selected.channel!=reference.channel
                or selected.sample_count!=reference.sample_count
                or selected.source_sample_rate_hz!=reference.source_sample_rate_hz):
            raise HTTPException(status_code=422,detail={'code':'INCOMPATIBLE_INPUT','message':'Comparison windows must share the verified source, channel, sample rate and sample count.'})
        metrics=('mean','median','standard_deviation','rms','peak_to_peak','zero_fraction','adjacent_repeat_fraction')
        differences=[SignalFeatureDifference(name=name,selected=getattr(selected,name),reference=getattr(reference,name),
            difference=(getattr(selected,name)-getattr(reference,name))*100 if name.endswith('_fraction') else getattr(selected,name)-getattr(reference,name),
            unit='percentage points' if name.endswith('_fraction') else selected.unit) for name in metrics]
        parameters={'case_id':case.id,'source_sha256':selected.source_sha256,'channel':request.channel,
            'selected_start_sec':request.selected_start_sec,'reference_start_sec':request.reference_start_sec,
            'duration_sec':request.duration_sec,'operation':'same-record-window-feature-comparison-v1'}
        comparison_key=hashlib.sha256(json.dumps(parameters,sort_keys=True,separators=(',',':')).encode()).hexdigest()
        with _db() as conn:
            _ensure_learning_case(conn,case)
            existing=conn.execute('SELECT id,result_json FROM signal_comparisons WHERE comparison_key=?',(comparison_key,)).fetchone()
            if existing and existing[1]:
                return SignalWindowComparison.model_validate_json(existing[1])
            comparison_id='cmp_'+uuid.uuid4().hex
            conn.execute('INSERT OR IGNORE INTO signal_comparisons(id,case_id,comparison_key,source_sha256,parameters_json,result_json) VALUES (?,?,?,?,?,?)',
                (comparison_id,case.id,comparison_key,selected.source_sha256,json.dumps(parameters,sort_keys=True),'{}'))
            saved=conn.execute('SELECT id,created_at,result_json FROM signal_comparisons WHERE comparison_key=?',(comparison_key,)).fetchone()
            if saved[2]:
                try:
                    return SignalWindowComparison.model_validate_json(saved[2])
                except ValueError:
                    pass
            result=SignalWindowComparison(id=saved[0],kind='fistulaguard.window-feature-comparison',case_id=case.id,
                channel=request.channel,source_sha256=selected.source_sha256,duration_sec=request.duration_sec,selected_window=selected,
                reference_window=reference,feature_differences=differences,compatible=True,
                limitations=['Same-record, same-channel descriptive comparison only.','Physical sensor units and calibration are unspecified.','Differences do not indicate signal adequacy, improvement, disease severity or clinical significance.'],
                created_at=saved[1])
            conn.execute('UPDATE signal_comparisons SET result_json=? WHERE id=?',(result.model_dump_json(),saved[0]))
            return result

    @app.get('/api/v1/comparisons',response_model=list[SignalWindowComparison])
    def list_signal_comparisons(case_id:str|None=Query(default=None,pattern=r'^fisav:pat\d{3}$'),limit:int=Query(default=20,ge=1,le=100),offset:int=Query(default=0,ge=0)):
        with _db() as conn:
            if case_id:
                rows=conn.execute('SELECT result_json FROM signal_comparisons WHERE case_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?',(case_id,limit,offset)).fetchall()
            else:
                rows=conn.execute('SELECT result_json FROM signal_comparisons ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?',(limit,offset)).fetchall()
        return [SignalWindowComparison.model_validate_json(row[0]) for row in rows if row[0] and row[0]!='{}']

    @app.get('/api/v1/comparisons/{comparison_id}',response_model=SignalWindowComparison,
             responses={404:{'model':ApiError}})
    def get_signal_comparison(comparison_id:str):
        if not re.fullmatch(r'cmp_[0-9a-f]{32}',comparison_id):
            raise HTTPException(status_code=404,detail={'code':'COMPARISON_UNKNOWN','message':'Saved comparison not found'})
        with _db() as conn:
            row=conn.execute('SELECT result_json FROM signal_comparisons WHERE id=?',(comparison_id,)).fetchone()
        if row is None or not row[0] or row[0]=='{}':
            raise HTTPException(status_code=404,detail={'code':'COMPARISON_UNKNOWN','message':'Saved comparison not found'})
        return SignalWindowComparison.model_validate_json(row[0])

    @app.get('/api/v1/cases/{case_id}/viewer/slice',response_model=VoxelSlice)
    def viewer_slice(case_id:str,axis:int=Query(2,ge=0,le=2),index:int=Query(64,ge=0,lt=128),
                     layer:str=Query('dose',pattern='^(ct|dose|roi)$'),roi:str=Query('Brainstem',pattern='^(Brainstem|SpinalCord|RightParotid|LeftParotid|Esophagus|Larynx|Mandible|PTV56|PTV63|PTV70)$')):
        case,case_root=_expect_viewer_case(case_id)
        file_name={'ct':'ct.csv','dose':'dose.csv','roi':f'{roi}.csv'}[layer]
        path=case_root/file_name
        if not path.is_file():
            raise HTTPException(404,detail={'code':'ASSET_NOT_INSTALLED','message':f'Required source asset {file_name} is missing','action':'Install a complete permitted OpenKBP case'})
        try:
            values,shape=_read_cached_slice(str(case_root),file_name,axis,index,path.stat().st_mtime_ns)
        except (ValueError,OSError) as e:
            raise HTTPException(422,detail={'code':'INVALID_RESEARCH_DATA','message':str(e)}) from e
        return VoxelSlice(case_id=case.id,source_revision=_source_revision_for_root(case_root),source_file=file_name,source_sha256=sha256(path),axis=axis,index=index,
            shape=shape,values=values,unit={'ct':'benchmark-value','dose':'Gy','roi':'binary-mask'}[layer],source_kind=_source_kind(),
            origin='synthetic-test-fixture' if _source_kind()=='synthetic-test' else ('benchmark-reference' if layer=='dose' else 'computed-from-benchmark-array'),coordinate_frame='openkbp-processed-voxel-grid')

    @app.get('/api/v1/cases/{case_id}/viewer/roi-volume',response_model=RoiMaskVolume)
    def viewer_roi_volume(case_id:str,roi:str=Query('Brainstem',pattern='^(Brainstem|SpinalCord|RightParotid|LeftParotid|Esophagus|Larynx|Mandible|PTV56|PTV63|PTV70)$')):
        """Return a sparse, source-indexed ROI mask for the optional vtk.js surface viewer."""
        case,case_root=_expect_viewer_case(case_id)
        path=case_root/f'{roi}.csv'
        if not path.is_file():
            raise HTTPException(404,detail={'code':'ASSET_NOT_INSTALLED','message':f'Required source mask {roi}.csv is missing','action':'Install the complete permitted OpenKBP case'})
        spacing_path=case_root/'voxel_dimensions.csv'
        try:
            spacing=np.loadtxt(spacing_path,dtype=np.float64).reshape(-1)
            if spacing.shape!=(3,) or not np.all(np.isfinite(spacing)) or not np.all(spacing>0):
                raise ValueError('Voxel spacing requires 3 positive finite mm values')
            mask=_read_cached_volume(str(case_root),path.name,path.stat().st_size,path.stat().st_mtime_ns).astype(bool,copy=False)
            indices=np.flatnonzero(mask).astype(np.uint32,copy=False)
            if not indices.size:
                raise ValueError(f'{roi} contains no voxels in this case')
        except (ValueError,OSError) as e:
            raise HTTPException(422,detail={'code':'INVALID_RESEARCH_DATA','message':str(e)}) from e
        return RoiMaskVolume(case_id=case.id,source_revision=_source_revision_for_root(case_root),source_file=path.name,source_sha256=sha256(path),
            shape=(128,128,128),spacing_mm=tuple(float(value) for value in spacing),voxel_count=int(indices.size),voxel_indices_c_order=indices.tolist(),
            source_kind=_source_kind(),origin='computed-from-synthetic-test-fixture' if _source_kind()=='synthetic-test' else 'computed-from-benchmark-array',
            coordinate_frame='openkbp-processed-voxel-grid',index_convention='x-major-y-middle-z-fastest')

    @app.get('/api/v1/cases/{case_id}/viewer/dvh',response_model=DvhSummary)
    def viewer_dvh(case_id:str,roi:str=Query('Brainstem',pattern='^(Brainstem|SpinalCord|RightParotid|LeftParotid|Esophagus|Larynx|Mandible|PTV56|PTV63|PTV70)$')):
        case,case_root=_expect_viewer_case(case_id)
        dose_path=case_root/'dose.csv'; roi_path=case_root/f'{roi}.csv'; ct_path=case_root/'ct.csv'; spacing_path=case_root/'voxel_dimensions.csv'
        if not dose_path.is_file() or not roi_path.is_file() or not ct_path.is_file() or not spacing_path.is_file():
            raise HTTPException(404,detail={'code':'ASSET_NOT_INSTALLED','message':f'Dose or ROI source for {roi} is missing','action':'Install the complete permitted OpenKBP case'})
        try:
            case_dir=str(case_root.resolve())
            dose=_read_cached_volume(case_dir,'dose.csv',dose_path.stat().st_size,dose_path.stat().st_mtime_ns)
            mask=_read_cached_volume(case_dir,roi_path.name,roi_path.stat().st_size,roi_path.stat().st_mtime_ns).astype(bool)
            ct=_read_cached_volume(case_dir,'ct.csv',ct_path.stat().st_size,ct_path.stat().st_mtime_ns)
            spacing=np.loadtxt(spacing_path,dtype=np.float64).reshape(-1)
            if spacing.shape!=(3,) or not np.all(np.isfinite(spacing)) or not np.all(spacing>0):
                raise ValueError('Voxel spacing requires 3 positive finite mm values')
        except (ValueError,OSError) as e:
            raise HTTPException(422,detail={'code':'INVALID_RESEARCH_DATA','message':str(e)}) from e
        values=dose[mask].astype(np.float64)
        if not values.size:
            raise HTTPException(422,detail={'code':'EMPTY_ROI','message':f'{roi} contains no voxels in this case'})
        display_max=float(np.max(dose))
        if not np.isfinite(display_max) or display_max<=0:
            raise HTTPException(422,detail={'code':'INVALID_RESEARCH_DATA','message':'A positive finite case-wide dose display range is unavailable'})
        thresholds=np.linspace(0,display_max,51)
        curve=[DvhPoint(dose_gy=float(t),volume_percent=float(100*np.mean(values>=t))) for t in thresholds]
        ct_range=np.percentile(ct.astype(np.float64),[2,98])
        if not np.all(np.isfinite(ct_range)) or ct_range[1]<=ct_range[0]:
            ct_min=float(np.min(ct));ct_max=float(np.max(ct))
            ct_range=np.array([ct_min,ct_max if ct_max>ct_min else ct_min+1.0])
        official_metrics=dose_statistics(dose,mask,spacing)
        official_metrics={key:official_metrics.get(key) for key in ('volume_cc','dmean_gy','dmax_voxel_gy','d95_gy_interpolated','d0_1cc_gy_openkbp','d99_gy_openkbp','d1_gy_openkbp','v20gy_percent','note')}
        return DvhSummary(case_id=case.id,source_revision=_source_revision_for_root(case_root),roi=roi,dose_sha256=sha256(dose_path),roi_sha256=sha256(roi_path),
            voxel_count=int(values.size),mean_dose_gy=float(np.mean(values)),dose_display_max_gy=display_max,spacing_mm=tuple(float(value) for value in spacing),
            ct_display_range=(float(ct_range[0]),float(ct_range[1])),ct_display_note='Global 2nd–98th percentile of this case’s processed CT benchmark values; not HU. Adjust locally for display.',
            official_metrics=DvhMetrics.model_validate(official_metrics),curve=curve,
            method='Exploratory cumulative voxel DVH: percentage of ROI voxels at or above each dose threshold; not official benchmark metric validation.',
            source_kind=_source_kind(),origin='computed-from-synthetic-test-fixture' if _source_kind()=='synthetic-test' else 'computed-from-benchmark-arrays')

    @app.put('/api/v1/cases/{case_id}/dose-artifacts',response_model=DoseArtifact,
              responses={404:{'model':ApiError},413:{'model':ApiError},422:{'model':ApiError}})
    async def import_dose_artifact(case_id:str,request:Request,file_name:str=Query(...,min_length=1,max_length=200)):
        """Install a user-supplied, same-grid prediction CSV for local research comparison."""
        _reject_student_dose_prediction_access(request.headers.get('authorization'))
        case,case_root=_expect_enabled_case(case_id)
        if _source_kind()=='synthetic-test':
            raise HTTPException(422,detail={'code':'SYNTHETIC_REFERENCE_BLOCKED','message':'A synthetic test fixture cannot receive a research dose prediction'})
        if request.headers.get('content-type','').split(';',1)[0].strip().lower() not in ('text/csv','application/csv','application/octet-stream'):
            raise HTTPException(415,detail={'code':'DOSE_CSV_REQUIRED','message':'Upload the authentic sparse dose CSV as text/csv'})
        try:
            safe_name=validate_dose_file_name(file_name)
            origin=request.headers.get('x-dose-origin','').strip()
            model_revision=request.headers.get('x-dose-model-revision','').strip()
            checkpoint_hash=request.headers.get('x-dose-checkpoint-sha256','').strip().lower()
            source_revision=request.headers.get('x-dose-source-revision','').strip()
            rights_basis=request.headers.get('x-dose-rights-basis','').strip()
            source_case_id=request.headers.get('x-dose-source-case','').strip()
            if origin!='archived_model_prediction':
                raise ValueError('Only a genuine archived model prediction is accepted by this comparison import')
            if source_case_id!=case.id:
                raise ValueError('Prediction source case identity must exactly match the installed case ID')
            if not model_revision or len(model_revision)>200:
                raise ValueError('Enter the prediction model revision or checkpoint identifier')
            if checkpoint_hash and not re.fullmatch(r'[0-9a-f]{64}',checkpoint_hash):
                raise ValueError('Checkpoint SHA-256 must be 64 lowercase hexadecimal characters when published')
            if not source_revision or len(source_revision)>200:
                raise ValueError('Enter the source revision associated with the prediction')
            if len(rights_basis)<10 or len(rights_basis)>1000:
                raise ValueError('Describe the local research-use rights basis in 10–1000 characters')
            if request.headers.get('x-dose-rights-confirmed','').lower()!='true':
                raise ValueError('Confirm you have a rights basis for this local research import')
            if request.headers.get('x-dose-unit','').strip()!='Gy':
                raise ValueError('Dose units must be explicitly Gy')
            if request.headers.get('x-dose-index-convention','').strip()!=INDEX_CONVENTION:
                raise ValueError(f'Index convention must be {INDEX_CONVENTION}')
            if request.headers.get('x-dose-array-shape','').strip()!='128,128,128':
                raise ValueError('Dose array shape must match the installed OpenKBP grid: 128,128,128')
            spacing=parse_spacing(request.headers.get('x-dose-spacing-mm',''))
            reference_spacing=np.loadtxt(case_root/'voxel_dimensions.csv',dtype=np.float64).reshape(-1)
            if reference_spacing.shape!=(3,) or not np.allclose(spacing,reference_spacing,rtol=0,atol=1e-6):
                raise ValueError('Dose spacing does not match the installed case spacing')
            content_length=request.headers.get('content-length')
            if content_length and int(content_length)>MAX_UPLOAD_BYTES:
                raise HTTPException(413,detail={'code':'DOSE_ARTIFACT_TOO_LARGE','message':'Dose CSV is larger than the 64 MiB local-import limit'})
            payload_buffer=bytearray()
            async for chunk in request.stream():
                if len(payload_buffer)+len(chunk)>MAX_UPLOAD_BYTES:
                    raise HTTPException(413,detail={'code':'DOSE_ARTIFACT_TOO_LARGE','message':'Dose CSV is larger than the 64 MiB local-import limit'})
                payload_buffer.extend(chunk)
            payload=bytes(payload_buffer)
            validate_sparse_csv_bytes(payload)
            content_hash=hashlib.sha256(payload).hexdigest()
            declared_hash=request.headers.get('x-dose-file-sha256','').strip().lower()
            if declared_hash and declared_hash!=content_hash:
                raise ValueError('Uploaded bytes do not match the declared file SHA-256')
            artifact_id='dose_'+uuid.uuid4().hex
            root=_dose_artifact_root();root.mkdir(parents=True,exist_ok=True)
            target=(root/f'{artifact_id}.csv').resolve()
            if target.parent!=root:
                raise ValueError('Invalid local artifact storage key')
            target.write_bytes(payload)
            try:
                prediction=validate_prediction(target)
                if prediction.shape!=DOSE_SHAPE:
                    raise ValueError('Prediction shape does not match the required grid')
                with _db() as conn:
                    conn.execute('''INSERT INTO dose_artifacts(id,case_id,source_case_id,storage_key,source_file_name,source_file_sha256,
                        source_revision,shape_json,spacing_json,index_convention,dose_unit,origin,model_revision,
                        checkpoint_sha256,rights_basis,validation_status,size_bytes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                        (artifact_id,case.id,source_case_id,target.name,safe_name,content_hash,source_revision,json.dumps(DOSE_SHAPE),
                         json.dumps(spacing),INDEX_CONVENTION,'Gy',origin,model_revision,checkpoint_hash or None,rights_basis,
                         'grid-validated-local-only',len(payload)))
            except Exception:
                target.unlink(missing_ok=True)
                raise
            stored=_stored_dose_artifact(artifact_id)
            return _dose_artifact_record(stored)
        except HTTPException:
            raise
        except (ValueError,OSError,TypeError) as exc:
            raise HTTPException(422,detail={'code':'DOSE_ARTIFACT_INVALID','message':str(exc)}) from exc

    @app.get('/api/v1/cases/{case_id}/dose-artifacts',response_model=list[DoseArtifact])
    def list_dose_artifacts(case_id:str,authorization:str|None=Header(default=None)):
        _reject_student_dose_prediction_access(authorization)
        case=_expect_case(case_id)
        with _db() as conn:
            rows=conn.execute('''SELECT id,case_id,source_case_id,source_file_name,source_file_sha256,source_revision,shape_json,
                spacing_json,index_convention,dose_unit,origin,model_revision,checkpoint_sha256,rights_basis,
                validation_status,size_bytes,created_at,storage_key FROM dose_artifacts WHERE case_id=? ORDER BY created_at DESC,id DESC LIMIT 50''',(case.id,)).fetchall()
        return [_dose_artifact_record(row) for row in rows]

    @app.get('/api/v1/cases/{case_id}/dose-artifacts/{artifact_id}/slice',response_model=DoseArtifactSlice,
             responses={404:{'model':ApiError},422:{'model':ApiError}})
    def dose_artifact_slice(case_id:str,artifact_id:str,axis:int=Query(2,ge=0,le=2),index:int=Query(64,ge=0,lt=128),authorization:str|None=Header(default=None)):
        _reject_student_dose_prediction_access(authorization)
        case,case_root=_expect_enabled_case(case_id);row=_stored_dose_artifact(artifact_id)
        if row is None or row[1]!=case.id:
            raise HTTPException(404,detail={'code':'DOSE_ARTIFACT_UNKNOWN','message':'No imported dose artifact belongs to this case'})
        reference_path=case_root/'dose.csv';artifact_path=(_dose_artifact_root()/row[17]).resolve()
        if artifact_path.parent!=_dose_artifact_root() or not artifact_path.is_file():
            raise HTTPException(404,detail={'code':'DOSE_ARTIFACT_MISSING','message':'The local dose artifact is no longer installed'})
        try:
            reference=_read_cached_volume(str(case_root),'dose.csv',reference_path.stat().st_size,reference_path.stat().st_mtime_ns)
            prediction=validate_prediction(artifact_path)
            reference_plane=np.take(reference,index,axis=axis)
            prediction_plane=np.take(prediction,index,axis=axis)
            delta_volume=prediction.astype(np.float64)-reference.astype(np.float64)
            delta=prediction_plane.astype(np.float64)-reference_plane.astype(np.float64)
            shared_display_max=max(float(np.max(reference)),float(np.max(prediction)))
            delta_display_max=float(np.max(np.abs(delta_volume)))
            return DoseArtifactSlice(artifact=_dose_artifact_record(row),case_id=case.id,axis=axis,index=index,
                shape=tuple(int(value) for value in reference_plane.shape),reference_gy=reference_plane.astype(np.float32).ravel().tolist(),
                prediction_gy=prediction_plane.astype(np.float32).ravel().tolist(),delta_gy=delta.astype(np.float32).ravel().tolist(),
                shared_display_max_gy=shared_display_max,delta_display_max_gy=delta_display_max,
                unit='Gy',coordinate_frame='openkbp-processed-voxel-grid')
        except (ValueError,OSError) as exc:
            raise HTTPException(422,detail={'code':'DOSE_ARTIFACT_INVALID','message':str(exc)}) from exc

    @app.get('/api/v1/cases/{case_id}/dose-artifacts/{artifact_id}/comparison',response_model=DoseArtifactComparison,
             responses={404:{'model':ApiError},422:{'model':ApiError}})
    def dose_artifact_comparison(case_id:str,artifact_id:str,authorization:str|None=Header(default=None)):
        _reject_student_dose_prediction_access(authorization)
        case,case_root=_expect_enabled_case(case_id);row=_stored_dose_artifact(artifact_id)
        if row is None or row[1]!=case.id:
            raise HTTPException(404,detail={'code':'DOSE_ARTIFACT_UNKNOWN','message':'No imported dose artifact belongs to this case'})
        reference_path=case_root/'dose.csv';artifact_path=(_dose_artifact_root()/row[17]).resolve()
        if artifact_path.parent!=_dose_artifact_root() or not artifact_path.is_file():
            raise HTTPException(404,detail={'code':'DOSE_ARTIFACT_MISSING','message':'The local dose artifact is no longer installed'})
        try:
            reference=_read_cached_volume(str(case_root),'dose.csv',reference_path.stat().st_size,reference_path.stat().st_mtime_ns)
            prediction=validate_prediction(artifact_path)
            spacing=np.loadtxt(case_root/'voxel_dimensions.csv',dtype=np.float64).reshape(-1)
            rows=[]
            for roi in ('Brainstem','SpinalCord','RightParotid','LeftParotid','Esophagus','Larynx','Mandible','PTV56','PTV63','PTV70'):
                mask_path=case_root/f'{roi}.csv'
                if not mask_path.is_file():
                    continue
                mask=_read_cached_volume(str(case_root),mask_path.name,mask_path.stat().st_size,mask_path.stat().st_mtime_ns).astype(bool,copy=False)
                if not np.any(mask):
                    continue
                rows.append({'roi':roi,**comparison_for_roi(reference,prediction,mask,spacing)})
            if not rows:
                raise ValueError('No installed ROI masks are available for comparison')
            return DoseArtifactComparison(artifact=_dose_artifact_record(row),case_id=case.id,reference_dose_sha256=sha256(reference_path),
                roi_comparisons=rows,limitations=['Research comparison only; no clinical-plan interpretation.','The uploaded prediction is user-supplied and its model provenance and rights basis are user-declared, not independently verified.','Grid matching confirms processed array shape, spacing and index convention only; patient orientation and DICOM alignment are not asserted.'])
        except (ValueError,OSError) as exc:
            raise HTTPException(422,detail={'code':'DOSE_ARTIFACT_INVALID','message':str(exc)}) from exc

    @app.get('/api/v1/models',response_model=list[ModelRecord])
    def models():
       cvs_blockers,_=_cvs_worker_gate()
       return [
       ModelRecord(id='cvs-adaptnet',module='surgivision',name='CVS-AdaptNet',operation_ids=['cvs.inference'],upstream_url='https://github.com/CAMMA-public/CVS-AdaptNet',source_revision=CVS_MODEL_REVISION,source_license='CVS-AdaptNet code: CC BY-NC-SA 4.0; checkpoint-specific terms require review',readiness='ready' if not cvs_blockers else 'blocked',details='Pinned CUDA worker completed authentic Endoscapes val inference on 409 records (AP C1/C2/C3: 0.4964/0.5024/0.5005). A source-bound frame inference and persisted-run adapter is integrated. It remains blocked until an independently verified checkpoint SHA-256 and checkpoint-specific research-use terms are supplied. The val split includes 38 file names with identical all-black content; this is not clinical validation.'),
       ModelRecord(id='surgical-latentgraph',module='surgivision',name='SurgLatentGraph architectures',operation_ids=['surgical.detection','surgical.segmentation','surgical.phase','surgical.triplet'],upstream_url='https://github.com/CAMMA-public/SurgLatentGraph',source_revision='8e521f07ffe431926ae00f273dce649ebf0cdbfa',source_license='Not verified; review repository and checkpoint terms',readiness='unverified',details='Detection, segmentation, CVS, phase and triplet source families are inventoried; complete checkpoints and runtime are not verified.'),
       ModelRecord(id='openkbp-baseline',module='dosetwin',name='OpenKBP prediction baseline',operation_ids=['dose.prediction'],upstream_url=SOURCE_URL,source_revision='ce625e62f3b04203f22bd9d1634f3e8fb0245e46',source_license='MIT for repository code; dataset terms require separate review',readiness='unverified',details='Training/evaluation source is available; prediction weights and runtime are not verified.'),
       ModelRecord(id='openkbp-opt-archives',module='dosetwin',name='OpenKBP-Opt archived predictions',operation_ids=['dose.comparison'],upstream_url='https://github.com/ababier/open-kbp-opt',source_revision='16fbe0dbc64c94ed4b7e8378a090b47c6596bbd7',source_license='MIT for repository code; archive data terms not established',readiness='blocked',details='A selected pt_241 reference/prediction pair was ETag-range-extracted and verified by source ZIP CRC/size, Git blob metadata and SHA-256; the 10.19 GB archive was not retained. Its set_1 array is installed locally for the authentic pt_241 same-grid comparison workflow, with a user-declared rights basis. No prediction checkpoint/hash or separate clinical-array license was published; this archived output is not an executable model.'),
       ModelRecord(id='openkbp-opt-optimizer',module='dosetwin',name='OpenKBP-Opt planning optimizer',operation_ids=['dose.optimization'],upstream_url='https://github.com/ababier/open-kbp-opt',source_revision='16fbe0dbc64c94ed4b7e8378a090b47c6596bbd7',source_license='MIT for repository code; data and solver terms require review',readiness='missing-dataset',details='Reference inputs are not installed; upstream scripts require a compatible OR-Tools solver and were tested with licensed Gurobi. No optimization run is available.'),
       ModelRecord(id='portpy-planning',module='dosetwin',name='PortPy planning research',operation_ids=['dose.imrt','dose.vmat','dose.evaluation'],upstream_url='https://github.com/PortPy-Project/PortPy',source_revision='bd4d881917164e5929326598c6b4795ce6510132',source_license='Apache-2.0 with Commons Clause; review before use',readiness='blocked',details='PortPy data adapters, influence matrices and solver worker are not installed. Its license restricts commercial use; compatibility and permitted deployment need review.'),
       ModelRecord(id='fistula-baseline',module='fistulaguard',name='Research signal-analysis utilities',operation_ids=['acoustic.features','acoustic.classification'],upstream_url='https://www.nature.com/articles/s41597-026-08242-8',source_revision='Not a model checkpoint; MEDFORGE signal methods are local',source_license='FiSaV source data: CC BY 4.0; no classifier weights',readiness='unverified',details='The complete 59-recording CSV cohort supports measured waveform and PSD review; no stenosis classifier or patient-disjoint validation is implemented.')]

    @app.post('/api/v1/models/{model_id}/validate',response_model=ModelValidationResponse)
    def validate_model(model_id:str,request:ModelValidationRequest):
        ids={m.id for m in models()}
        if model_id not in ids:raise HTTPException(404,detail={'code':'MODEL_UNKNOWN','message':'Model not registered'})
        if model_id=='cvs-adaptnet':
            blockers,_=_cvs_worker_gate()
            if request.operation_id!='cvs.inference':
                blockers.append('The requested operation is not supported by this model adapter.')
            if _endoscapes_frame(request.case_id) is None:
                blockers.append('The requested Endoscapes frame is not installed and hash-verified.')
            return ModelValidationResponse(model_id=model_id,executable=not blockers,blockers=blockers)
        return ModelValidationResponse(model_id=model_id,executable=False,
            blockers=['No installed and tested model adapter/checkpoint for this operation in reference harness'])

    @app.post('/api/v1/runs',response_model=RunRecord,responses={404:{'model':ApiError},422:{'model':ApiError}})
    def create_run(request:RunCreateRequest):
        if request.operation_id=='cvs.inference':
            frame=_endoscapes_frame(request.case_id)
            if frame is None:
                raise HTTPException(status_code=404,detail={'code':'SURGICAL_FRAME_NOT_INSTALLED','message':'No source-verified Endoscapes frame matches this case ID'})
            blockers,checkpoint_hash=_cvs_worker_gate()
            if blockers:
                raise HTTPException(status_code=409,detail={'code':'MODEL_EXECUTION_BLOCKED','message':'CVS-AdaptNet is not cleared for execution.','blockers':blockers})
            case=_endoscapes_case_record(frame)
            worker=ROOT/'workers/.venvs/cvs-adaptnet/bin/python'
            evaluator=ROOT/'workers/cvs-adaptnet/evaluate_endoscapes.py'
            prompt_path=ROOT/'references/upstream/CVS-AdaptNet/class_prompts/class_prompt_endoscapes_manual.txt'
            prompt_hash=sha256(prompt_path)
            parameters={'split':frame.split,'attempt':request.attempt,'case_id':frame.id}
            input_identity={
                'case_id':frame.id,'image_sha256':frame.image_sha256,
                'annotation_sha256':frame.annotation_sha256,'checkpoint_sha256':checkpoint_hash,
                'prompt_sha256':prompt_hash,'model_revision':CVS_MODEL_REVISION,
                'dataset_revision':ENDOSCAPES_SOURCE_REVISION,
                'parameters':parameters,
            }
            input_hash=hashlib.sha256(json.dumps(input_identity,sort_keys=True,separators=(',',':')).encode()).hexdigest()
            with _db() as c:
                _ensure_learning_case(c,case)
                existing=c.execute('SELECT id,status,result_json,output_provenance_json,failure_code FROM analysis_runs WHERE case_id=? AND operation_id=? AND input_hash=?',
                                   (case.id,request.operation_id,input_hash)).fetchone()
                if existing:
                    return RunRecord(id=existing[0],case_id=case.id,operation_id=request.operation_id,status=existing[1],
                        source_kind=case.reference_kind,results=json.loads(existing[2]) if existing[2] else None,
                        provenance=json.loads(existing[3]) if existing[3] else {},failure_code=existing[4])
                run_id='run_'+uuid.uuid4().hex
                provenance={
                    'dataset':'Endoscapes-BBox201','source_url':ENDOSCAPES_URL,
                    'source_revision':ENDOSCAPES_SOURCE_REVISION,'model_id':CVS_MODEL_ID,
                    'model_revision':CVS_MODEL_REVISION,'algorithm':'CVS-AdaptNet upstream zero-shot frame inference',
                    'input_sha256':input_identity,'reference_kind':'research',
                    'clinical_use':'research/education only; not clinical validation or surgical clearance',
                    'score_warning':'Sigmoid cosine-similarity scores are not calibrated probabilities or a surgical decision.',
                    'limitations':['One annotated keyframe only; no temporal/video context','Upstream validation AP is approximately 0.5 per criterion','Checkpoint execution requires independent terms and source-hash clearance'],
                }
                c.execute('INSERT INTO analysis_runs(id,case_id,model_id,operation_id,status,input_hash,parameters_json,output_provenance_json,source_revision,started_at) VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)',
                    (run_id,case.id,CVS_MODEL_ID,request.operation_id,'running',input_hash,json.dumps(parameters),json.dumps(provenance),CVS_MODEL_REVISION))

            result=None
            failure_code=None
            env={'PATH':os.environ.get('PATH',''),'PYTHONUNBUFFERED':'1',
                 'MEDFORGE_ENDOSCAPES_ROOT':str(Path(frame.image_path).resolve().parent.parent)}
            if os.environ.get('CUDA_VISIBLE_DEVICES') is not None:
                env['CUDA_VISIBLE_DEVICES']=os.environ['CUDA_VISIBLE_DEVICES']
            try:
                with tempfile.TemporaryDirectory(prefix='medforge-cvs-run-') as temporary_dir:
                    output_path=Path(temporary_dir)/'result.json'
                    completed=subprocess.run(
                        [str(worker),str(evaluator),'--split',frame.split,'--case-id',frame.id,'--output',str(output_path)],
                        cwd=ROOT,env=env,capture_output=True,text=True,timeout=180,check=False,
                    )
                    if completed.returncode!=0:
                        failure_code='CVS_WORKER_FAILED'
                    else:
                        report=json.loads(output_path.read_text(encoding='utf8'))
                        rows=report.get('labels_and_scores')
                        text_preprocessing=report.get('text_preprocessing')
                        if (report.get('case_scoped_run') is not True or report.get('case_id')!=frame.id
                                or report.get('annotation_count')!=1 or not isinstance(rows,list) or len(rows)!=1
                                or rows[0].get('case_id')!=frame.id or not isinstance(rows[0].get('scores'),list)
                                or len(rows[0]['scores'])!=3 or report.get('checkpoint_sha256')!=checkpoint_hash
                                or report.get('annotation_sha256')!=frame.annotation_sha256
                                or report.get('prompt_sha256')!=prompt_hash
                                or report.get('source_revision')!=ENDOSCAPES_SOURCE_REVISION
                                or report.get('model_revision')!=CVS_MODEL_REVISION
                                or not isinstance(text_preprocessing,dict)
                                or text_preprocessing.get('upstream_process_text_tensor_parity') is not True):
                            raise ValueError('Worker output did not match the selected source frame and three criteria')
                        if rows[0].get('image_sha256')!=frame.image_sha256:
                            raise ValueError('Worker image hash did not match the API-verified source frame')
                        if (rows[0].get('ds_reference')!=list(frame.cvs_criteria)
                                or not np.isfinite(np.asarray(rows[0]['scores'],dtype=float)).all()
                                or any(float(score)<0 or float(score)>1 for score in rows[0]['scores'])):
                            raise ValueError('Worker output scores or source labels failed validation')
                        result={
                            'case_id':frame.id,'scores':rows[0]['scores'],
                            'reference_labels':rows[0]['ds_reference'],
                            'image_is_all_black_pixels':rows[0]['image_is_all_black_pixels'],
                            'score_semantics':'Sigmoid of normalized image/text cosine similarity; not calibrated probability.',
                            'text_preprocessing':text_preprocessing,
                        }
                        provenance['output_sha256']=hashlib.sha256(json.dumps(result,sort_keys=True,separators=(',',':')).encode()).hexdigest()
            except subprocess.TimeoutExpired:
                failure_code='CVS_WORKER_TIMEOUT'
            except (OSError,ValueError,KeyError,TypeError,json.JSONDecodeError):
                failure_code='CVS_WORKER_INVALID_OUTPUT'

            status='completed' if result is not None and failure_code is None else 'failed'
            if status=='failed':
                result={'message':'The local CVS-AdaptNet worker failed; no model result was produced.'}
            with _db() as c:
                c.execute('UPDATE analysis_runs SET status=?,result_json=?,failure_code=?,output_provenance_json=?,completed_at=CURRENT_TIMESTAMP WHERE id=?',
                    (status,json.dumps(result),failure_code,json.dumps(provenance),run_id))
            return RunRecord(id=run_id,case_id=case.id,operation_id=request.operation_id,status=status,
                source_kind=case.reference_kind,results=result,provenance=provenance,failure_code=failure_code)

        case,root=_expect_enabled_case(request.case_id)
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
                'source_revision':_source_revision_for_root(root),
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

    @app.get('/api/v1/runs',response_model=list[RunRecord])
    def list_runs():
        with _db() as c:
            rows=c.execute('SELECT r.id,r.case_id,r.operation_id,r.status,r.result_json,r.output_provenance_json,r.failure_code,c.reference_kind FROM analysis_runs AS r JOIN cases AS c ON c.id=r.case_id ORDER BY r.created_at DESC,r.id DESC').fetchall()
        return [RunRecord(id=row[0],case_id=row[1],operation_id=row[2],status=row[3],
            source_kind=row[7],results=json.loads(row[4]) if row[4] else None,
            provenance=json.loads(row[5]) if row[5] else {},failure_code=row[6]) for row in rows]

    def _report(row) -> ReportRecord:
        return ReportRecord(id=row[0],run_id=row[1],case_id=row[2],status=row[3],
            created_at=row[4],document=json.loads(row[5]))

    @app.get('/api/v1/reports',response_model=list[ReportRecord])
    def list_reports():
        with _db() as c:
            rows=c.execute('SELECT id,run_id,case_id,status,created_at,provenance_json FROM reports ORDER BY created_at DESC,id DESC').fetchall()
        return [_report(row) for row in rows]

    @app.post('/api/v1/reports',response_model=ReportRecord,responses={404:{'model':ApiError},422:{'model':ApiError}})
    def create_report(request:ReportCreateRequest):
        with _db() as c:
            existing_reports=c.execute('SELECT id,run_id,case_id,status,created_at,provenance_json FROM reports WHERE run_id=? AND status=? ORDER BY created_at DESC',(request.run_id,'generated')).fetchall()
            row=c.execute('SELECT r.id,r.case_id,r.operation_id,r.status,r.result_json,r.output_provenance_json,r.failure_code,c.reference_kind FROM analysis_runs AS r JOIN cases AS c ON c.id=r.case_id WHERE r.id=?',(request.run_id,)).fetchone()
            if row is None:raise HTTPException(status_code=404,detail={'code':'RUN_UNKNOWN','message':'Completed analysis run not found'})
            if row[3]!='completed' or not row[4] or not row[5]:
                raise HTTPException(status_code=422,detail={'code':'RUN_NOT_REPORTABLE','message':'Only completed runs with saved results and provenance can be reported'})
            run=RunRecord(id=row[0],case_id=row[1],operation_id=row[2],status=row[3],source_kind=row[7],
                results=json.loads(row[4]),provenance=json.loads(row[5]),failure_code=row[6])
            case=_expect_case(run.case_id)
            document={
                'schema':'medforge.evidence-report/v1',
                'title':f"OpenKBP case summary — {case.source_case_id}",
                'generated_at_utc':None,
                'case':{'id':case.id,'dataset_id':case.dataset_id,'source_case_id':case.source_case_id,'reference_kind':case.reference_kind},
                'analysis':{'run_id':run.id,'operation_id':run.operation_id,'status':run.status,'method':run.provenance.get('algorithm')},
                'source':{'repository':SOURCE_URL,'revision':run.provenance.get('source_revision'),'files_sha256':run.provenance.get('input_sha256')},
                'results':run.results,
                'limitations':['Research and education only; not for diagnosis, treatment planning or clinical decisions.','The dose array is an OpenKBP benchmark reference dose, not a delivered clinical plan.','Metrics use the processed voxel grid; native DICOM origin and orientation are not asserted.','Percentile outputs follow the pinned OpenKBP evaluator and do not establish prediction quality or clinical validity.']
            }
            if request.viewer_state is not None:
                if request.viewer_state.case_id!=case.id:
                    raise HTTPException(status_code=422,detail={'code':'VIEWER_CASE_MISMATCH','message':'Selected viewer state belongs to a different source case'})
            viewer_state=request.viewer_state.model_dump(mode='json') if request.viewer_state is not None else None
            if viewer_state is not None:document['viewer_state']=viewer_state
            for existing in existing_reports:
                existing_document=json.loads(existing[5])
                if existing_document.get('viewer_state')==viewer_state:
                    return _report(existing)
            report_id='report_'+uuid.uuid4().hex
            c.execute('INSERT INTO reports(id,case_id,run_id,status,provenance_json) VALUES (?,?,?,?,?)',
                (report_id,case.id,run.id,'generated',json.dumps(document,sort_keys=True)))
            created=c.execute('SELECT created_at FROM reports WHERE id=?',(report_id,)).fetchone()[0]
            document['generated_at_utc']=created
            c.execute('UPDATE reports SET provenance_json=? WHERE id=?',(json.dumps(document,sort_keys=True),report_id))
            return ReportRecord(id=report_id,run_id=run.id,case_id=case.id,status='generated',created_at=created,document=document)

    @app.post('/api/v1/reports/dosetwin-comparison',response_model=ReportRecord,
              responses={404:{'model':ApiError},422:{'model':ApiError}})
    def create_dose_comparison_report(request:DoseTwinComparisonReportCreateRequest):
        case,case_root=_expect_enabled_case(request.case_id)
        row=_stored_dose_artifact(request.artifact_id)
        if row is None or row[1]!=case.id:
            raise HTTPException(status_code=404,detail={'code':'DOSE_ARTIFACT_UNKNOWN','message':'No imported dose artifact belongs to this case'})
        comparison=dose_artifact_comparison(case.id,request.artifact_id,authorization=None)
        document={
            'schema':'medforge.dosetwin-dose-comparison/v1',
            'title':f"Dose prediction comparison — {case.source_case_id}",
            'generated_at_utc':None,
            'case':{'id':case.id,'dataset_id':case.dataset_id,'source_case_id':case.source_case_id,'reference_kind':case.reference_kind},
            'analysis':{'operation_id':'dose.comparison','status':'completed','method':'Voxelwise same-grid comparison with per-ROI dose-volume summaries'},
            'source':{'repository':SOURCE_URL,'revision':_source_revision_for_root(case_root),'files_sha256':{'reference:dose.csv':comparison.reference_dose_sha256,
                f'prediction:{comparison.artifact.source_file_name}':comparison.artifact.source_file_sha256},
                'prediction_source_revision':comparison.artifact.source_revision,
                'model_revision':comparison.artifact.model_revision,'checkpoint_sha256':comparison.artifact.checkpoint_sha256,
                'rights_basis':comparison.artifact.rights_basis},
            'comparison':comparison.model_dump(mode='json'),
            'selection':{'roi':request.roi,'axis':request.axis,'index':request.index,'coordinate_frame':'openkbp-processed-voxel-grid'},
            'limitations':comparison.limitations,
        }
        with _db() as conn:
            existing=conn.execute('SELECT id,run_id,case_id,status,created_at,provenance_json FROM reports WHERE case_id=? AND run_id IS NULL AND status=? ORDER BY created_at DESC,id DESC',(case.id,'generated')).fetchall()
            for record in existing:
                prior=json.loads(record[5])
                if prior.get('schema')==document['schema'] and prior.get('source')==document['source'] and prior.get('selection')==document['selection']:
                    return _report(record)
            report_id='report_'+uuid.uuid4().hex
            conn.execute('INSERT INTO reports(id,case_id,run_id,status,provenance_json) VALUES (?,?,NULL,?,?)',
                (report_id,case.id,'generated',json.dumps(document,sort_keys=True)))
            created=conn.execute('SELECT created_at FROM reports WHERE id=?',(report_id,)).fetchone()[0]
            document['generated_at_utc']=created
            conn.execute('UPDATE reports SET provenance_json=? WHERE id=?',(json.dumps(document,sort_keys=True),report_id))
            return ReportRecord(id=report_id,run_id=None,case_id=case.id,status='generated',created_at=created,document=document)

    @app.post('/api/v1/reports/surgivision-frame',response_model=ReportRecord,responses={404:{'model':ApiError},422:{'model':ApiError}})
    def create_surgical_frame_report(request:SurgicalFrameReportCreateRequest):
        frame=_endoscapes_frame(request.frame_id)
        if frame is None:
            raise HTTPException(status_code=404,detail={'code':'SURGICAL_FRAME_NOT_INSTALLED','message':'No source-verified Endoscapes frame matches this ID'})
        if request.selected_annotation_id is not None and not any(item.id==request.selected_annotation_id for item in frame.annotations):
            raise HTTPException(status_code=422,detail={'code':'ANNOTATION_NOT_IN_FRAME','message':'Selected annotation does not belong to this verified frame'})
        display_state={'show_annotations':request.show_annotations,'selected_annotation_id':request.selected_annotation_id}
        document={
            'schema':'medforge.surgivision-source-frame-evidence/v1',
            'title':f'Endoscapes source-frame evidence · {frame.split} · video {frame.video_id} · frame {frame.frame_number}',
            'generated_at_utc':None,
            'case':{'id':frame.id,'dataset_id':frame.dataset_id,'split':frame.split,'video_id':frame.video_id,
                'frame_number':frame.frame_number,'file_name':frame.file_name,'width_px':frame.width,'height_px':frame.height},
            'source':{'repository':ENDOSCAPES_URL,'revision':ENDOSCAPES_SOURCE_REVISION,
                'citation':'Murali et al. (2023), arXiv:2312.12429',
                'license':'CC BY-NC-SA 4.0; non-commercial scientific research',
                'image_sha256':frame.image_sha256,'annotation_sha256':frame.annotation_sha256},
            'analysis':{'method':'Source annotation and image-level label selection; no model inference'},
            'evidence':{'reference_annotations':[item.model_dump(mode='json') for item in frame.annotations],
                'cvs_source_values':list(frame.cvs_criteria),
                'cvs_value_interpretation':'Endoscapes ds values are means of three annotators; fractional means indicate disagreement. Individual annotator votes are unavailable.'},
            'display_state':display_state,
            'limitations':['This export contains annotation and label data, not the source image.',
                'COCO annotations and CVS values are expert reference data, not model predictions.',
                'Labels do not indicate surgical safety, clearance, or clinical guidance.',
                'Preserve source attribution and CC BY-NC-SA 4.0 terms; non-commercial scientific research only.'],
        }
        case=_endoscapes_case_record(frame)
        with _db() as c:
            _ensure_learning_case(c,case)
            existing_reports=c.execute('SELECT id,run_id,case_id,status,created_at,provenance_json FROM reports WHERE case_id=? AND run_id IS NULL AND status=? ORDER BY created_at DESC,id DESC',(case.id,'generated')).fetchall()
            for existing in existing_reports:
                prior=json.loads(existing[5])
                if (prior.get('schema')==document['schema'] and prior.get('source',{}).get('image_sha256')==frame.image_sha256
                        and prior.get('source',{}).get('annotation_sha256')==frame.annotation_sha256
                        and prior.get('display_state')==display_state):
                    return _report(existing)
            report_id='report_'+uuid.uuid4().hex
            c.execute('INSERT INTO reports(id,case_id,run_id,status,provenance_json) VALUES (?,?,NULL,?,?)',
                (report_id,case.id,'generated',json.dumps(document,sort_keys=True)))
            created=c.execute('SELECT created_at FROM reports WHERE id=?',(report_id,)).fetchone()[0]
            document['generated_at_utc']=created.replace(' ','T')+'Z'
            c.execute('UPDATE reports SET provenance_json=? WHERE id=?',(json.dumps(document,sort_keys=True),report_id))
            return ReportRecord(id=report_id,run_id=None,case_id=case.id,status='generated',created_at=created,document=document)

    @app.get('/api/v1/reports/{report_id}',response_model=ReportRecord,responses={404:{'model':ApiError}})
    def get_report(report_id:str):
        with _db() as c:
            row=c.execute('SELECT id,run_id,case_id,status,created_at,provenance_json FROM reports WHERE id=?',(report_id,)).fetchone()
        if row is None:raise HTTPException(status_code=404,detail={'code':'REPORT_UNKNOWN','message':'Evidence report not found'})
        return _report(row)

    register_learning_routes(app, _db, list_cases)
    return app

app=create_app()
