"""DoseTwin research review: a frozen, human research assessment of a reference vs archived prediction.

The operator-designated local clinical reviewer (or admin) inspects a same-case reference dose and an imported
archived prediction, then records one of three research decisions with a required rationale.
The server recomputes the selected ROI comparison and freezes it with every source hash, so the
saved review reopens exactly. This is a research assessment for further expert review, never a
treatment plan approval, and the archived prediction is never presented as our inference.
"""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Callable, Literal
import uuid

import numpy as np
from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

from . import audit
from .auth import require_any_role

ROIS = ('Brainstem', 'SpinalCord', 'RightParotid', 'LeftParotid', 'Esophagus', 'Larynx', 'Mandible', 'PTV56', 'PTV63', 'PTV70')
Decision = Literal['accept_for_further_expert_assessment', 'request_revision', 'reject_research_candidate']
ProvenanceKind = Literal['SOURCE_BENCHMARK', 'ARCHIVED_PREDICTION', 'RULE_BASED_METHOD', 'IN_APP_MODEL_INFERENCE']
METHOD_VERSION = 'dosetwin-research-review/1'
BOUNDARY = 'For further expert review, not for patient treatment.'
DOES_NOT_MEAN = [
    'An accepted research candidate is not an approved, deliverable radiotherapy plan.',
    'The archived prediction was produced by a published research model, not by MEDFORGE.',
    'Benchmark arrays are processed voxel grids, not native DICOM with patient orientation.',
    'One ROI comparison or DVH does not establish clinical safety.',
]
DECISION_LABELS = {
    'accept_for_further_expert_assessment': 'Accept for further expert assessment',
    'request_revision': 'Request revision',
    'reject_research_candidate': 'Reject research candidate',
}


class _Model(BaseModel):
    model_config = ConfigDict(extra='forbid')


class VoxelDifference(_Model):
    case_id: str
    artifact_id: str
    voxel: tuple[int, int, int]
    reference_gy: float
    prediction_gy: float
    delta_gy: float = Field(description='prediction minus reference')
    roi_memberships: list[str]
    reference_dose_sha256: str
    prediction_sha256: str
    provenance_kind: ProvenanceKind = 'ARCHIVED_PREDICTION'
    coordinate_frame: str = 'openkbp-processed-voxel-grid'


class ResearchReviewCreate(_Model):
    case_id: str = Field(min_length=1, max_length=180)
    artifact_id: str = Field(pattern=r'^dose_[0-9a-f]{32}$')
    roi: Literal['Brainstem', 'SpinalCord', 'RightParotid', 'LeftParotid', 'Esophagus', 'Larynx', 'Mandible', 'PTV56', 'PTV63', 'PTV70']
    decision: Decision
    rationale: str = Field(min_length=10, max_length=2000)
    axis: int = Field(default=2, ge=0, le=2)
    index: int = Field(default=64, ge=0, lt=128)
    voxel: tuple[int, int, int] | None = None
    supersedes_id: str | None = Field(default=None, pattern=r'^rev_[0-9a-f]{32}$')


class ResearchReviewEvidence(_Model):
    roi: str
    voxel_count: int
    reference_mean_gy: float
    prediction_mean_gy: float
    mean_delta_gy: float
    mean_absolute_delta_gy: float
    maximum_absolute_delta_gy: float
    reference_metrics: dict
    prediction_metrics: dict
    voxel: VoxelDifference | None
    view: dict


class ResearchReviewProvenance(_Model):
    provenance_kind: ProvenanceKind
    reference_kind: ProvenanceKind
    case_source_revision: str | None
    reference_dose_sha256: str
    prediction_file_name: str
    prediction_sha256: str
    prediction_model_revision: str
    prediction_checkpoint_sha256: str
    prediction_rights_basis: str
    method_version: str
    method_code_sha256: str


class ResearchReview(_Model):
    id: str
    case_id: str
    artifact_id: str
    decision: Decision
    decision_label: str
    rationale: str
    reviewer_id: str
    reviewer_name: str
    reviewer_role: str
    supersedes_id: str | None
    created_at: str
    evidence: ResearchReviewEvidence
    provenance: ResearchReviewProvenance
    boundary: str = BOUNDARY
    does_not_mean: list[str] = Field(default_factory=lambda: list(DOES_NOT_MEAN))
    audit_row_hash: str | None = None


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _load_pair(case_id: str, artifact_id: str):
    """Reuse DoseTwin's own loaders and validation for the reference and the archived prediction."""
    from .main import _dose_artifact_root, _expect_enabled_case, _read_cached_volume, _stored_dose_artifact
    from .dose_artifacts import validate_prediction
    case, case_root = _expect_enabled_case(case_id)
    row = _stored_dose_artifact(artifact_id)
    if row is None or row[1] != case.id:
        raise HTTPException(404, detail={'code': 'DOSE_ARTIFACT_UNKNOWN', 'message': 'No imported dose artifact belongs to this case'})
    reference_path = case_root / 'dose.csv'
    artifact_path = (_dose_artifact_root() / row[17]).resolve()
    if artifact_path.parent != _dose_artifact_root() or not artifact_path.is_file():
        raise HTTPException(404, detail={'code': 'DOSE_ARTIFACT_MISSING', 'message': 'The local dose artifact is no longer installed'})
    stat = reference_path.stat()
    reference = _read_cached_volume(str(case_root), 'dose.csv', stat.st_size, stat.st_mtime_ns)
    prediction = validate_prediction(artifact_path)

    def mask(roi: str):
        path = case_root / f'{roi}.csv'
        if not path.is_file():
            return None
        return _read_cached_volume(str(case_root), path.name, path.stat().st_size, path.stat().st_mtime_ns).astype(bool, copy=False)

    return case, case_root, row, reference, prediction, mask, _sha256_file(reference_path)


def _voxel(case_id, artifact_id, voxel, reference, prediction, mask, reference_sha, row) -> VoxelDifference:
    x, y, z = voxel
    if not all(0 <= value < size for value, size in zip(voxel, reference.shape)):
        raise HTTPException(422, detail={'code': 'VOXEL_OUT_OF_RANGE', 'message': f'Voxel must lie inside the {reference.shape} grid'})
    ref, pred = float(reference[x, y, z]), float(prediction[x, y, z])
    members = [roi for roi in ROIS if (m := mask(roi)) is not None and bool(m[x, y, z])]
    return VoxelDifference(case_id=case_id, artifact_id=artifact_id, voxel=(x, y, z), reference_gy=ref, prediction_gy=pred,
                           delta_gy=pred - ref, roi_memberships=members, reference_dose_sha256=reference_sha, prediction_sha256=row[4])


def _review_from_row(conn, row) -> ResearchReview:
    review = ResearchReview.model_validate_json(row[0])
    audit_row = conn.execute("SELECT row_hash FROM audit_log WHERE action='research_review.decision' AND target_id=?", (review.id,)).fetchone()
    return review.model_copy(update={'audit_row_hash': audit_row[0] if audit_row else None})


def _require_review_owner(review: ResearchReview, user: dict) -> ResearchReview:
    if user['role'] != 'admin' and review.reviewer_id != user['id']:
        raise HTTPException(404, detail={'code': 'REVIEW_NOT_FOUND', 'message': 'No research review matches this ID'})
    return review


def register_research_review_routes(app: FastAPI, db: Callable) -> None:
    reviewer = require_any_role('clinical_reviewer')

    @app.get('/api/v1/cases/{case_id}/dose-artifacts/{artifact_id}/voxel', response_model=VoxelDifference)
    def dose_voxel_difference(case_id: str, artifact_id: str, x: int = Query(ge=0, lt=128), y: int = Query(ge=0, lt=128),
                              z: int = Query(ge=0, lt=128), user: dict = Depends(reviewer)):
        case, _, row, reference, prediction, mask, reference_sha = _load_pair(case_id, artifact_id)
        return _voxel(case.id, artifact_id, (x, y, z), reference, prediction, mask, reference_sha, row)

    @app.post('/api/v1/research-reviews', response_model=ResearchReview, status_code=201)
    def research_review_create(request: ResearchReviewCreate, user: dict = Depends(reviewer)):
        from .dose_artifacts import comparison_for_roi
        case, case_root, row, reference, prediction, mask, reference_sha = _load_pair(request.case_id, request.artifact_id)
        roi_mask = mask(request.roi)
        if roi_mask is None or not np.any(roi_mask):
            raise HTTPException(422, detail={'code': 'ROI_NOT_AVAILABLE', 'message': f'{request.roi} has no installed voxels in this case'})
        spacing = np.loadtxt(case_root / 'voxel_dimensions.csv', dtype=np.float64).reshape(-1)
        try:
            summary = comparison_for_roi(reference, prediction, roi_mask, spacing)
        except ValueError as error:
            raise HTTPException(422, detail={'code': 'COMPARISON_INVALID', 'message': str(error)}) from error
        voxel = _voxel(case.id, request.artifact_id, request.voxel, reference, prediction, mask, reference_sha, row) if request.voxel else None
        evidence = ResearchReviewEvidence(
            roi=request.roi, voxel=voxel, view={'axis': request.axis, 'index': request.index},
            **{key: summary[key] for key in ('voxel_count', 'reference_mean_gy', 'prediction_mean_gy', 'mean_delta_gy',
                                             'mean_absolute_delta_gy', 'maximum_absolute_delta_gy', 'reference_metrics', 'prediction_metrics')})
        provenance = ResearchReviewProvenance(
            provenance_kind='ARCHIVED_PREDICTION' if row[10] == 'archived_model_prediction' else 'SOURCE_BENCHMARK',
            reference_kind='SOURCE_BENCHMARK', case_source_revision=row[5], reference_dose_sha256=reference_sha,
            prediction_file_name=row[3], prediction_sha256=row[4], prediction_model_revision=row[11],
            prediction_checkpoint_sha256=row[12] or 'absent', prediction_rights_basis=row[13], method_version=METHOD_VERSION,
            method_code_sha256=_sha256_file(Path(__file__).with_name('dose_artifacts.py')))
        with db() as conn:
            if request.supersedes_id:
                previous = conn.execute('SELECT case_id,artifact_id,reviewer_id FROM research_reviews WHERE id=?', (request.supersedes_id,)).fetchone()
                if (previous is None or previous[:2] != (case.id, request.artifact_id)
                        or (user['role'] != 'admin' and previous[2] != user['id'])):
                    raise HTTPException(404, detail={'code': 'REVIEW_NOT_FOUND', 'message': 'The superseded review does not belong to this case and artifact'})
            name = conn.execute('SELECT display_name FROM users WHERE id=?', (user['id'],)).fetchone()
            review = ResearchReview(
                id=f'rev_{uuid.uuid4().hex}', case_id=case.id, artifact_id=request.artifact_id, decision=request.decision,
                decision_label=DECISION_LABELS[request.decision], rationale=request.rationale.strip(), reviewer_id=user['id'],
                reviewer_name=name[0] if name else user['id'], reviewer_role=user['role'], supersedes_id=request.supersedes_id,
                created_at=datetime.now(timezone.utc).isoformat(), evidence=evidence, provenance=provenance)
            conn.execute('''INSERT INTO research_reviews(id,case_id,artifact_id,reviewer_id,decision,supersedes_id,review_json,created_at)
                VALUES (?,?,?,?,?,?,?,?)''', (review.id, review.case_id, review.artifact_id, review.reviewer_id, review.decision,
                                             review.supersedes_id, review.model_dump_json(), review.created_at))
            row_hash = audit.append(conn, action='research_review.decision', target_kind='research_review', target_id=review.id,
                                    actor=user, owner_id=user['id'],
                                    details={'case_id': review.case_id, 'artifact_id': review.artifact_id, 'roi': request.roi,
                                             'decision': review.decision, 'prediction_sha256': row[4], 'reference_dose_sha256': reference_sha})
        return review.model_copy(update={'audit_row_hash': row_hash})

    @app.get('/api/v1/research-reviews', response_model=list[ResearchReview])
    def research_review_list(case_id: str | None = None, artifact_id: str | None = None, user: dict = Depends(reviewer)):
        clauses, params = [], []
        if user['role'] != 'admin':
            clauses.append('reviewer_id=?')
            params.append(user['id'])
        for column, value in (('case_id', case_id), ('artifact_id', artifact_id)):
            if value:
                clauses.append(f'{column}=?')
                params.append(value)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ''
        with db() as conn:
            rows = conn.execute(f'SELECT review_json FROM research_reviews {where} ORDER BY created_at DESC', params).fetchall()
            return [_review_from_row(conn, row) for row in rows]

    @app.get('/api/v1/research-reviews/{review_id}', response_model=ResearchReview)
    def research_review_get(review_id: str, user: dict = Depends(reviewer)):
        with db() as conn:
            row = conn.execute('SELECT review_json FROM research_reviews WHERE id=?', (review_id,)).fetchone()
            if row is None:
                raise HTTPException(404, detail={'code': 'REVIEW_NOT_FOUND', 'message': 'No research review matches this ID'})
            return _require_review_owner(_review_from_row(conn, row), user)

    @app.get('/api/v1/research-reviews/{review_id}/export')
    def research_review_export(review_id: str, user: dict = Depends(reviewer)):
        """Auditable JSON report: the frozen review, its provenance, and the audit-chain entry that recorded it."""
        review = research_review_get(review_id, user)
        with db() as conn:
            chain = audit.verify(conn)
        return {'schema': 'medforge.research-review-report/v1', 'exported_at': datetime.now(timezone.utc).isoformat(),
                'review': json.loads(review.model_dump_json()), 'audit_chain_verified': chain['ok'],
                'boundary': BOUNDARY, 'does_not_mean': DOES_NOT_MEAN}


def register_research_review_fhir_route(app: FastAPI, db: Callable) -> None:
    from .fhir_export import review_bundle
    reviewer = require_any_role('clinical_reviewer')

    @app.get('/api/v1/research-reviews/{review_id}/fhir')
    def research_review_fhir(review_id: str, user: dict = Depends(reviewer)):
        """Minimal FHIR R4 Bundle of one review, tagged educational and test data (not a clinical record)."""
        with db() as conn:
            row = conn.execute('SELECT review_json FROM research_reviews WHERE id=?', (review_id,)).fetchone()
            if row is None:
                raise HTTPException(404, detail={'code': 'REVIEW_NOT_FOUND', 'message': 'No research review matches this ID'})
            return review_bundle(_require_review_owner(_review_from_row(conn, row), user))
