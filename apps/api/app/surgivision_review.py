"""SurgiVision review tools: annotated-frame browsing filters and the CVS self-check block.

Each Endoscapes CVS value is the mean of three annotators, so values strictly between 0 and
1 mean the annotators disagreed. Nothing here predicts or grades surgical safety.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Callable, Literal

from fastapi import Depends, FastAPI, HTTPException, Query

from .auth import require_role
from .endoscapes import CVS_CRITERIA, installed_frame, installed_frames
from .schemas import (CvsCriterionId, CvsSelfCheckCommit, CvsSelfCheckCriterion, CvsSelfCheckResult,
                      SurgicalFrameBrowse, SurgicalFrameFacets, SurgicalFrameRecord, SurgicalFrameSummary)

SELF_CHECK_TYPE = 'CVS self-check'
_EPSILON = 1e-6
BROWSE_LIMITATIONS = [
    'CVS values are means of three annotators; fractional values show disagreement, not uncertainty in the image.',
    'Filters describe expert annotations only. They are not model output and do not assess surgical safety.',
]
SELF_CHECK_LIMITATIONS = [
    'Each reference value is the mean of three annotators, so a fractional value means they disagreed.',
    'Matching the annotator majority is a learning signal, not a competency or safety assessment.',
]


def _is_unanimous(value: float) -> bool:
    return abs(value) < _EPSILON or abs(value - 1) < _EPSILON


def agreement(cvs: tuple[float, ...]) -> tuple[int, Literal['unanimous', 'disputed', 'unlabelled']]:
    if len(cvs) != len(CVS_CRITERIA):
        return 0, 'unlabelled'
    disputed = sum(0 if _is_unanimous(value) else 1 for value in cvs)
    return disputed, 'disputed' if disputed else 'unanimous'


def summarize(frame: SurgicalFrameRecord) -> SurgicalFrameSummary:
    disputed, label = agreement(frame.cvs_criteria)
    return SurgicalFrameSummary(
        id=frame.id, split=frame.split, video_id=frame.video_id, frame_number=frame.frame_number,
        cvs_criteria=frame.cvs_criteria, categories=sorted({item.category_name for item in frame.annotations}),
        annotation_count=len(frame.annotations), disputed_criteria=disputed, agreement=label,
    )


def filter_frames(frames: list[SurgicalFrameSummary], *, split: str | None = None, category: str | None = None,
                  criterion: str | None = None, min_value: float | None = None, max_value: float | None = None,
                  agreement_filter: str | None = None) -> list[SurgicalFrameSummary]:
    criterion_index = next((index for index, (key, _) in enumerate(CVS_CRITERIA) if key == criterion), None)
    result = []
    for frame in frames:
        if split and frame.split != split:
            continue
        if category and category not in frame.categories:
            continue
        if agreement_filter and frame.agreement != agreement_filter:
            continue
        if criterion_index is not None:
            if len(frame.cvs_criteria) != len(CVS_CRITERIA):
                continue
            value = frame.cvs_criteria[criterion_index]
            if min_value is not None and value < min_value - _EPSILON:
                continue
            if max_value is not None and value > max_value + _EPSILON:
                continue
        result.append(frame)
    return result


def self_check_result(frame: SurgicalFrameRecord, block_id: str, judgements: tuple[int, int, int], committed_at: str) -> CvsSelfCheckResult:
    criteria = []
    for (key, label), judgement, mean in zip(CVS_CRITERIA, judgements, frame.cvs_criteria):
        majority = 1 if mean > 0.5 else 0
        criteria.append(CvsSelfCheckCriterion(
            criterion_id=key, label=label, judgement=judgement, annotator_mean=mean,
            annotators_disagreed=not _is_unanimous(mean), matches_majority=judgement == majority,
        ))
    return CvsSelfCheckResult(
        block_id=block_id, frame_id=frame.id, judgements=judgements, criteria=criteria,
        matches=sum(item.matches_majority for item in criteria), committed_at=committed_at,
        source=f'Endoscapes-BBox201 {frame.split} frame {frame.file_name}; image SHA-256 {frame.image_sha256}',
        limitations=SELF_CHECK_LIMITATIONS,
    )


def committed_self_checks(conn, attempt_id: str) -> list[CvsSelfCheckResult]:
    rows = conn.execute('SELECT result_json FROM cvs_self_checks WHERE attempt_id=? ORDER BY committed_at, block_id', (attempt_id,)).fetchall()
    return [CvsSelfCheckResult.model_validate_json(row[0]) for row in rows]


def self_check_block_ids(blocks: list[dict]) -> list[str]:
    return [block['id'] for block in blocks if block.get('type') == SELF_CHECK_TYPE]


def register_surgivision_review_routes(app: FastAPI, db: Callable) -> None:
    student = require_role('student')

    @app.get('/api/v1/surgivision/frames', response_model=SurgicalFrameBrowse)
    def surgical_frame_browse(
        split: Literal['train', 'val', 'test'] | None = None,
        category: str | None = Query(default=None, max_length=120),
        criterion: CvsCriterionId | None = None,
        min_value: float | None = Query(default=None, ge=0, le=1),
        max_value: float | None = Query(default=None, ge=0, le=1),
        agreement_filter: Literal['unanimous', 'disputed'] | None = Query(default=None, alias='agreement'),
        limit: int = Query(default=100, ge=1, le=500),
        offset: int = Query(default=0, ge=0),
    ) -> SurgicalFrameBrowse:
        if min_value is not None and max_value is not None and min_value > max_value:
            raise HTTPException(422, detail={'code': 'CVS_RANGE_INVALID', 'message': 'The minimum CVS value must not exceed the maximum'})
        summaries = [summarize(frame) for frame in installed_frames()]
        matched = filter_frames(summaries, split=split, category=category, criterion=criterion,
                                min_value=min_value, max_value=max_value, agreement_filter=agreement_filter)
        splits: dict[str, int] = {}
        for frame in summaries:
            splits[frame.split] = splits.get(frame.split, 0) + 1
        return SurgicalFrameBrowse(
            total=len(matched), limit=limit, offset=offset, frames=matched[offset:offset + limit],
            facets=SurgicalFrameFacets(categories=sorted({name for frame in summaries for name in frame.categories}),
                                       splits=dict(sorted(splits.items()))),
            limitations=BROWSE_LIMITATIONS,
        )

    def _attempt_block(conn, attempt_id: str, block_id: str, user: dict):
        row = conn.execute(
            """SELECT t.state, lv.student_manifest_json, lv.case_id
               FROM attempts t JOIN assignments a ON a.id=t.assignment_id
               JOIN lesson_versions lv ON lv.id=a.lesson_version_id
               JOIN learning_cohort_memberships m ON m.cohort_id=a.cohort_id
               WHERE t.id=? AND t.student_id=? AND m.user_id=?""",
            (attempt_id, user['id'], user['id']),
        ).fetchone()
        if row is None:
            raise HTTPException(404, detail={'code': 'ATTEMPT_NOT_FOUND', 'message': 'No learning attempt belongs to this account'})
        blocks = json.loads(row[1]).get('blocks', [])
        if block_id not in self_check_block_ids(blocks):
            raise HTTPException(404, detail={'code': 'CVS_SELF_CHECK_NOT_FOUND', 'message': 'This lesson has no CVS self-check with that ID'})
        return row

    @app.get('/api/v1/academy/attempts/{attempt_id}/cvs-self-check/{block_id}', response_model=CvsSelfCheckResult)
    def cvs_self_check_get(attempt_id: str, block_id: str, user: dict = Depends(student)):
        with db() as conn:
            _attempt_block(conn, attempt_id, block_id, user)
            row = conn.execute('SELECT result_json FROM cvs_self_checks WHERE attempt_id=? AND block_id=?', (attempt_id, block_id)).fetchone()
        if row is None:
            raise HTTPException(404, detail={'code': 'CVS_SELF_CHECK_NOT_COMMITTED', 'message': 'Commit your own judgement before the annotator values are shown'})
        return CvsSelfCheckResult.model_validate_json(row[0])

    @app.post('/api/v1/academy/attempts/{attempt_id}/cvs-self-check/{block_id}', response_model=CvsSelfCheckResult)
    def cvs_self_check_commit(attempt_id: str, block_id: str, request: CvsSelfCheckCommit, user: dict = Depends(student)):
        with db() as conn:
            conn.execute('BEGIN IMMEDIATE')
            state, _, case_id = _attempt_block(conn, attempt_id, block_id, user)
            existing = conn.execute('SELECT judgements_json,result_json FROM cvs_self_checks WHERE attempt_id=? AND block_id=?',
                                    (attempt_id, block_id)).fetchone()
            if existing:
                if tuple(json.loads(existing[0])) != tuple(request.judgements):
                    raise HTTPException(409, detail={'code': 'CVS_SELF_CHECK_ALREADY_COMMITTED', 'message': 'This judgement is already committed and cannot be changed'})
                return CvsSelfCheckResult.model_validate_json(existing[1])
            if state != 'started':
                raise HTTPException(409, detail={'code': 'ATTEMPT_ALREADY_SUBMITTED', 'message': 'This attempt has already been submitted'})
            frame = installed_frame(case_id)
            if frame is None or frame.id != case_id or len(frame.cvs_criteria) != len(CVS_CRITERIA):
                raise HTTPException(409, detail={'code': 'CVS_REFERENCE_UNAVAILABLE', 'message': 'The source frame or its CVS annotations are not installed'})
            result = self_check_result(frame, block_id, tuple(request.judgements), datetime.now(timezone.utc).isoformat())
            conn.execute('INSERT INTO cvs_self_checks(attempt_id,block_id,frame_id,judgements_json,result_json,committed_at) VALUES (?,?,?,?,?,?)',
                         (attempt_id, block_id, frame.id, json.dumps(list(request.judgements)), result.model_dump_json(), result.committed_at))
            return result
