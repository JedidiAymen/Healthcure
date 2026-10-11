"""Local learning delivery routes with separate educator and student projections."""
from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import sqlite3
import uuid
from typing import Callable

from fastapi import Depends, FastAPI, Header, HTTPException

from .auth import require_role
from .endoscapes import installed_frame
from .db_driver import INTEGRITY_ERRORS
from . import audit
from .surgivision_review import SELF_CHECK_TYPE, committed_self_checks, self_check_block_ids
from . import fisav
from .schemas import (
    EducatorAssignment,
    EducatorAssignmentCreate,
    EducatorAssignedCase,
    EducatorAttemptReview,
    EducatorCohort,
    EducatorCohortCreate,
    EducatorCohortLearner,
    EducatorCohortMembership,
    EducatorCohortRoster,
    EducatorGradeRequest,
    EducatorPublishRequest,
    EducatorStudent,
    PublishedLessonVersion,
    StudentAttemptDraftUpdate,
    StudentAttemptManifest,
    StudentAttemptStart,
    StudentAttemptSubmit,
    StudentChallengeSummary,
    StudentLearningPath,
    StudentPathLesson,
    StudentAchievementPreferencesUpdate,
    StudentDebrief,
    StudentLearningPreferencesUpdate,
    StudentNextActivity,
    StudentParticipationItem,
    StudentParticipationRecord,
    StudentProgress,
    StudentSubmissionReceipt,
)


def _not_found(code: str, message: str) -> HTTPException:
    return HTTPException(404, detail={"code": code, "message": message})


def _conflict(code: str, message: str) -> HTTPException:
    return HTTPException(409, detail={"code": code, "message": message})


def _case_terms(case) -> tuple[str, str, str]:
    if case.module == "dosetwin":
        return (
            "OpenKBP research benchmark; dataset rights require independent review",
            "blocked",
            "Dataset permission for student publication is not established.",
        )
    if case.module == "surgivision":
        return (
            "CC BY-NC-SA 4.0; non-commercial scientific research",
            "required",
            "Confirm attribution, non-commercial scope and permitted student access.",
        )
    return (
        "CC BY 4.0",
        "required",
        "Confirm attribution and appropriate educational context.",
    )


def _project_manifest(manifest_json: str) -> dict:
    """Return only author-approved learner fields; secret rubric is a separate column."""
    try:
        source = json.loads(manifest_json)
        public_fields = ("title", "module", "case_id", "case_label", "dataset_id", "reference_kind", "source_license", "blocks")
        if not isinstance(source, dict) or any(key not in source for key in public_fields):
            raise ValueError("required projection fields are missing")
        if not isinstance(source["blocks"], list):
            raise ValueError("learner blocks are invalid")
        return {
            **{key: source[key] for key in public_fields},
            "review_status": "local-unreviewed",
        }
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        raise HTTPException(409, detail={"code": "PUBLISHED_MANIFEST_INVALID", "message": "The published lesson projection is invalid"}) from error


def _assigned_case(manifest_json: str) -> EducatorAssignedCase:
    manifest = _project_manifest(manifest_json)
    return EducatorAssignedCase(module=manifest["module"], case_id=manifest["case_id"], case_label=manifest["case_label"])


_LEARNING_PATHS = (
    {
        "path_id": "surgical-evidence",
        "title": "Surgical Evidence",
        "module": "surgivision",
        "description": "Read annotated laparoscopic frames and separate visible evidence from uncertainty.",
        "objectives": [
            "Describe what is visible in a source frame before consulting its reference annotations.",
            "Use educator-released annotations to compare evidence and explain disagreement or missing context.",
            "State why one isolated frame cannot establish whole-procedure safety or clearance.",
        ],
        "prerequisites": "No prerequisites are currently configured for assigned lessons.",
        "limitation_notice": "A frame-level observation does not establish critical-view adequacy or surgical clearance.",
    },
    {
        "path_id": "radiation-physics",
        "title": "Radiation Physics",
        "module": "dosetwin",
        "description": "Inspect benchmark dose and structure evidence using source units and index-space views.",
        "objectives": [
            "Relate a benchmark dose grid to its supplied CT and structure masks.",
            "Read cumulative dose-volume values with the displayed Gy and volume conventions.",
            "Distinguish benchmark reference data from a delivered or clinically approved treatment plan.",
        ],
        "prerequisites": "No prerequisites are currently configured for assigned lessons.",
        "limitation_notice": "The installed OpenKBP case is benchmark data; it is not a deliverable treatment plan, and dataset display rights remain under review.",
    },
    {
        "path_id": "physiological-signals",
        "title": "Physiological Signals",
        "module": "fistulaguard",
        "description": "Inspect measured vascular-access signals and explain what a selected window can support.",
        "objectives": [
            "Select and describe a bounded interval from a measured source recording.",
            "Relate the displayed waveform, spectrum and feature values to the same source window.",
            "Identify missing calibration or acquisition context and avoid interpreting signal features as a diagnosis.",
        ],
        "prerequisites": "No prerequisites are currently configured for assigned lessons.",
        "limitation_notice": "FiSaV signal units are uncalibrated; measurements are descriptive and do not diagnose stenosis or another condition.",
    },
)


def _published_version(row) -> PublishedLessonVersion:
    manifest = _project_manifest(row[4])
    return PublishedLessonVersion(
        version_id=row[0], lesson_id=row[1], version=row[2], title=manifest["title"],
        module=manifest["module"], case_id=manifest["case_id"],
        case_label=manifest["case_label"], published_at=row[3],
        review_status=manifest["review_status"],
    )


def _student_observations(conn: sqlite3.Connection, attempt_id: str) -> list[dict]:
    rows = conn.execute(
        """SELECT o.block_id,o.response_json,v.student_manifest_json
           FROM observations o
           JOIN attempts t ON t.id=o.attempt_id
           JOIN assignments a ON a.id=t.assignment_id
           JOIN lesson_versions v ON v.id=a.lesson_version_id
           WHERE o.attempt_id=?""",
        (attempt_id,),
    ).fetchall()
    if not rows:
        return []
    try:
        manifest = _project_manifest(rows[0][2])
        order = {block["id"]: index for index, block in enumerate(manifest["blocks"])}
    except (KeyError, TypeError):
        order = {}
    # Keep the student's authored lesson sequence when presenting answers to
    # the educator; block IDs are opaque identifiers and carry no ordering.
    ordered_rows = sorted(rows, key=lambda row: (order.get(row[0], len(order)), row[0]))
    return [{"block_id": row[0], "response": json.loads(row[1])} for row in ordered_rows]


def _validate_viewer_evidence(evidence: dict | None, module: str, case_id: str) -> dict:
    if evidence is None:
        raise HTTPException(422, detail={"code": "VIEWER_EVIDENCE_REQUIRED", "message": "Select evidence in the assigned scientific viewer before submitting"})
    if evidence["kind"] != module or evidence["case_id"] != case_id:
        raise HTTPException(422, detail={"code": "VIEWER_EVIDENCE_CASE_MISMATCH", "message": "The viewer selection must match the case and specialty on this assignment"})
    if module == "surgivision":
        frame = installed_frame(evidence["frame_id"])
        if frame is None or frame.id != case_id or evidence["selection_x_px"] >= frame.width or evidence["selection_y_px"] >= frame.height:
            raise HTTPException(422, detail={"code": "VIEWER_EVIDENCE_OUT_OF_BOUNDS", "message": "Choose a point inside the assigned source frame"})
    elif module == "fistulaguard":
        data = fisav.record(evidence["record_id"])
        if data is None:
            raise HTTPException(422, detail={"code": "VIEWER_EVIDENCE_SOURCE_UNAVAILABLE", "message": "The selected source recording is unavailable"})
        record = fisav.record_summary(data, evidence["record_id"])
        if evidence["case_id"] != record.case_id or evidence["start_sec"] + evidence["duration_sec"] > record.duration_sec + (1 / record.sample_rate_hz):
            raise HTTPException(422, detail={"code": "VIEWER_EVIDENCE_OUT_OF_BOUNDS", "message": "Choose a time window inside the assigned source recording"})
    return evidence


def _attempt_manifest(conn: sqlite3.Connection, attempt_row) -> StudentAttemptManifest:
    challenge = _project_manifest(attempt_row[6])
    revision_row = conn.execute(
        "SELECT revision FROM learning_attempt_revisions WHERE attempt_id=?",
        (attempt_row[0],),
    ).fetchone()
    evidence_row = conn.execute(
        "SELECT evidence_json FROM attempt_viewer_evidence WHERE attempt_id=?", (attempt_row[0],)
    ).fetchone()
    return StudentAttemptManifest(
        attempt_id=attempt_row[0], assignment_id=attempt_row[1], state=attempt_row[2],
        revision=revision_row[0] if revision_row else 0, challenge=challenge,
        observations=_student_observations(conn, attempt_row[0]),
        viewer_evidence=json.loads(evidence_row[0]) if evidence_row else None,
    )


def register_learning_routes(app: FastAPI, db: Callable, list_cases: Callable[[], list]) -> None:
    educator = require_role("educator")
    student = require_role("student")

    def _draft_for_owner(conn, draft_id: str, user: dict):
        row = conn.execute(
            """SELECT d.id,d.owner_id,d.case_id,d.title,d.content_json,d.revision,c.module
               FROM educator_drafts d JOIN cases c ON c.id=d.case_id WHERE d.id=?""",
            (draft_id,),
        ).fetchone()
        if row is None or (row[1] != user["id"] and user["role"] != "admin"):
            raise _not_found("DRAFT_NOT_FOUND", "No lesson draft belongs to this account")
        return row

    def _assignment_for_student(conn, assignment_id: str, user: dict):
        row = conn.execute(
            """SELECT a.id,a.lesson_version_id,a.cohort_id,a.due_at,
                      lv.id,lv.lesson_id,lv.version,lv.case_id,lv.status,
                      lv.student_manifest_json,lv.secret_rubric_json,l.created_by
               FROM assignments a JOIN lesson_versions lv ON lv.id=a.lesson_version_id
               JOIN lessons l ON l.id=lv.lesson_id
               JOIN learning_cohort_memberships m ON m.cohort_id=a.cohort_id
               WHERE a.id=? AND m.user_id=?""",
            (assignment_id, user["id"]),
        ).fetchone()
        if row is None or row[8] != "published":
            raise _not_found("ASSIGNMENT_NOT_FOUND", "No active assignment is available to this account")
        return row

    def _student_learning_paths(user_id: str) -> list[StudentLearningPath]:
        with db() as conn:
            rows = conn.execute(
                """SELECT a.id,a.due_at,v.version,v.student_manifest_json,v.case_id,t.state
                   FROM assignments a JOIN lesson_versions v ON v.id=a.lesson_version_id
                   JOIN learning_cohort_memberships m ON m.cohort_id=a.cohort_id
                   LEFT JOIN attempts t ON t.assignment_id=a.id AND t.student_id=m.user_id
                   WHERE m.user_id=? AND v.status='published'
                   ORDER BY a.due_at IS NULL,a.due_at,v.published_at DESC,a.id""",
                (user_id,),
            ).fetchall()
        available_cases = {case.id: case for case in list_cases()}
        grouped: dict[str, list[StudentPathLesson]] = {path["module"]: [] for path in _LEARNING_PATHS}
        for row in rows:
            manifest = _project_manifest(row[3])
            if row[4] not in available_cases or manifest["module"] not in grouped:
                continue
            state = {
                None: "not_started",
                "started": "in_progress",
                "submitted": "submitted",
                "review_required": "submitted",
                "graded": "reviewed",
                "revealed": "reviewed",
            }.get(row[5], "not_started")
            grouped[manifest["module"]].append(StudentPathLesson(
                assignment_id=row[0], case_id=row[4], title=manifest["title"], version=row[2],
                case_label=available_cases[row[4]].label,
                source_license=manifest["source_license"], due_at=row[1], state=state,
            ))
        result = []
        for path in _LEARNING_PATHS:
            lessons = grouped[path["module"]]
            attribution = sorted({f"{lesson.case_label} · {lesson.source_license}" for lesson in lessons})
            result.append(StudentLearningPath(
                **path,
                assigned_count=len(lessons),
                in_progress_count=sum(lesson.state == "in_progress" for lesson in lessons),
                submitted_count=sum(lesson.state == "submitted" for lesson in lessons),
                reviewed_count=sum(lesson.state == "reviewed" for lesson in lessons),
                lessons=lessons, source_attribution=attribution,
            ))
        return result

    def _student_attempt(conn, attempt_id: str, user: dict):
        row = conn.execute(
            """SELECT t.id,t.assignment_id,t.state,t.submitted_at,t.score,t.max_score,
                      lv.student_manifest_json,lv.secret_rubric_json,a.cohort_id,lv.case_id
               FROM attempts t JOIN assignments a ON a.id=t.assignment_id
               JOIN lesson_versions lv ON lv.id=a.lesson_version_id
               JOIN learning_cohort_memberships m ON m.cohort_id=a.cohort_id
               WHERE t.id=? AND t.student_id=? AND m.user_id=?""",
            (attempt_id, user["id"], user["id"]),
        ).fetchone()
        if row is None:
            raise _not_found("ATTEMPT_NOT_FOUND", "No learning attempt belongs to this account")
        return row

    @app.get("/api/v1/educator/students", response_model=list[EducatorStudent])
    def educator_students(user: dict = Depends(educator)):
        with db() as conn:
            rows = conn.execute(
                """SELECT u.id,u.display_name FROM users u JOIN role_grants g ON g.user_id=u.id
                   WHERE g.scope='platform' AND g.role='student' ORDER BY u.display_name,u.id"""
            ).fetchall()
        return [EducatorStudent(id=row[0], display_name=row[1]) for row in rows]

    @app.get("/api/v1/educator/cohorts", response_model=list[EducatorCohort])
    def educator_cohorts(user: dict = Depends(educator)):
        with db() as conn:
            rows = conn.execute(
                """SELECT c.id,c.name,COUNT(m.user_id) FROM learning_cohorts c
                   LEFT JOIN learning_cohort_memberships m ON m.cohort_id=c.id
                   WHERE c.created_by=? GROUP BY c.id,c.name ORDER BY c.name""",
                (user["id"],),
            ).fetchall()
        return [EducatorCohort(id=row[0], name=row[1], student_count=row[2]) for row in rows]

    @app.get("/api/v1/educator/cohorts/{cohort_id}/students", response_model=EducatorCohortRoster)
    def educator_cohort_students(cohort_id: str, user: dict = Depends(educator)):
        with db() as conn:
            cohort = conn.execute(
                "SELECT id,name FROM learning_cohorts WHERE id=? AND created_by=?",
                (cohort_id, user["id"]),
            ).fetchone()
            if cohort is None:
                raise _not_found("COHORT_NOT_FOUND", "No cohort belongs to this account")
            rows = conn.execute(
                """SELECT u.id,u.display_name FROM learning_cohort_memberships m
                   JOIN users u ON u.id=m.user_id
                   JOIN role_grants g ON g.user_id=u.id AND g.role='student' AND g.scope='platform'
                   WHERE m.cohort_id=? ORDER BY u.display_name COLLATE NOCASE,u.id""",
                (cohort_id,),
            ).fetchall()
        learners = [EducatorCohortLearner(display_name=row[1]) for row in rows]
        return EducatorCohortRoster(
            cohort_id=cohort[0], cohort_name=cohort[1], student_count=len(learners), learners=learners,
        )

    @app.post("/api/v1/educator/cohorts", response_model=EducatorCohort, status_code=201)
    def educator_cohort_create(request: EducatorCohortCreate, user: dict = Depends(educator)):
        name = request.name.strip()
        if len(name) < 2:
            raise HTTPException(422, detail={"code": "COHORT_NAME_REQUIRED", "message": "Enter a cohort name"})
        cohort_id = str(uuid.uuid4())
        with db() as conn:
            try:
                conn.execute(
                    "INSERT INTO learning_cohorts(id,name,created_by) VALUES (?,?,?)",
                    (cohort_id, name, user["id"]),
                )
            except INTEGRITY_ERRORS:
                raise HTTPException(409, detail={"code": "COHORT_NAME_EXISTS", "message": "You already have a cohort with this name"})
        return EducatorCohort(id=cohort_id, name=name, student_count=0)

    @app.post("/api/v1/educator/cohorts/{cohort_id}/students", status_code=201)
    def educator_cohort_add_student(cohort_id: str, request: EducatorCohortMembership, user: dict = Depends(educator)):
        with db() as conn:
            cohort = conn.execute(
                "SELECT id FROM learning_cohorts WHERE id=? AND created_by=?",
                (cohort_id, user["id"]),
            ).fetchone()
            student_role = conn.execute(
                "SELECT 1 FROM role_grants WHERE user_id=? AND role='student' AND scope='platform'",
                (request.student_id,),
            ).fetchone()
            if cohort is None:
                raise _not_found("COHORT_NOT_FOUND", "No cohort belongs to this account")
            if student_role is None:
                raise HTTPException(422, detail={"code": "STUDENT_NOT_FOUND", "message": "Choose a provisioned student account"})
            conn.execute(
                "INSERT OR IGNORE INTO learning_cohort_memberships(user_id,cohort_id,added_by) VALUES (?,?,?)",
                (request.student_id, cohort_id, user["id"]),
            )
            count = conn.execute(
                "SELECT COUNT(*) FROM learning_cohort_memberships WHERE cohort_id=?", (cohort_id,)
            ).fetchone()[0]
        return {"cohort_id": cohort_id, "student_count": count}

    @app.get("/api/v1/educator/drafts/{draft_id}/preview")
    def educator_draft_preview(draft_id: str, user: dict = Depends(educator)):
        with db() as conn:
            draft = _draft_for_owner(conn, draft_id, user)
        case = next((item for item in list_cases() if item.id == draft[2]), None)
        if case is None:
            raise HTTPException(409, detail={"code": "SOURCE_UNAVAILABLE", "message": "The selected source is no longer installed"})
        license_label, review, _ = _case_terms(case)
        content = json.loads(draft[4])
        return {
            "title": draft[3], "module": draft[6], "case_id": case.id,
            "case_label": case.label, "dataset_id": case.dataset_id,
            "reference_kind": case.reference_kind, "source_license": license_label,
            "publication_review": review,
            "blocks": [block for block in content["blocks"] if block["type"] != "Reveal"],
        }

    @app.post("/api/v1/educator/drafts/{draft_id}/publish", response_model=PublishedLessonVersion)
    def educator_publish(draft_id: str, request: EducatorPublishRequest, user: dict = Depends(educator)):
        if not request.source_terms_confirmed:
            raise HTTPException(422, detail={"code": "SOURCE_TERMS_NOT_CONFIRMED", "message": "Confirm the displayed source terms before publishing"})
        with db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            draft = _draft_for_owner(conn, draft_id, user)
            case = next((item for item in list_cases() if item.id == draft[2]), None)
            if case is None or case.status != "ready":
                raise HTTPException(409, detail={"code": "SOURCE_UNAVAILABLE", "message": "The selected source is no longer installed"})
            license_label, review, publication_note = _case_terms(case)
            if review == "blocked":
                raise HTTPException(403, detail={"code": "PUBLICATION_RIGHTS_BLOCKED", "message": publication_note})
            existing = conn.execute(
                """SELECT v.id,v.lesson_id,v.version,v.published_at,v.student_manifest_json
                   FROM educator_published_revisions p JOIN lesson_versions v ON v.id=p.lesson_version_id
                   WHERE p.draft_id=? AND p.revision=?""",
                (draft_id, draft[5]),
            ).fetchone()
            if existing:
                return _published_version(existing)
            content = json.loads(draft[4])
            criteria = content.get("rubric_criteria", [])
            if len(criteria) < 2 or sum(item["max_points"] for item in criteria) != 100:
                raise HTTPException(422, detail={"code": "RUBRIC_INVALID", "message": "Add at least two rubric criteria whose maximum points total 100"})
            questions = [b for b in content["blocks"] if b["type"] in ("Question", SELF_CHECK_TYPE) and b["content"].strip()]
            if not questions:
                raise HTTPException(422, detail={"code": "QUESTION_REQUIRED", "message": "Add at least one learner question with a prompt"})
            if self_check_block_ids(content["blocks"]) and case.module != "surgivision":
                raise HTTPException(422, detail={"code": "CVS_SELF_CHECK_MODULE", "message": "CVS self-check blocks need an Endoscapes SurgiVision frame"})
            if not any(b["content"].strip() for b in content["blocks"] if b["type"] != "Reveal"):
                raise HTTPException(422, detail={"code": "LEARNER_CONTENT_REQUIRED", "message": "Add learner-visible instructions or questions"})
            mapping = conn.execute(
                "SELECT lesson_id FROM educator_draft_publications WHERE draft_id=?", (draft_id,)
            ).fetchone()
            lesson_id = mapping[0] if mapping else str(uuid.uuid4())
            if mapping is None:
                conn.execute(
                    "INSERT INTO lessons(id,module,created_by,title) VALUES (?,?,?,?)",
                    (lesson_id, draft[6], user["id"], draft[3]),
                )
                conn.execute(
                    "INSERT INTO educator_draft_publications(draft_id,lesson_id) VALUES (?,?)",
                    (draft_id, lesson_id),
                )
            version = conn.execute(
                "SELECT COALESCE(MAX(version),0)+1 FROM lesson_versions WHERE lesson_id=?",
                (lesson_id,),
            ).fetchone()[0]
            public_manifest = {
                "title": draft[3], "module": draft[6], "case_id": case.id,
                "case_label": case.label, "dataset_id": case.dataset_id,
                "reference_kind": case.reference_kind, "source_license": license_label,
                "source_terms_confirmed": True,
                "review_status": "local-unreviewed",
                "blocks": [b for b in content["blocks"] if b["type"] != "Reveal"],
            }
            secret_rubric = {
                "rubric": content["rubric"],
                "rubric_criteria": content["rubric_criteria"],
                "reveal_blocks": [b for b in content["blocks"] if b["type"] == "Reveal"],
                "source_review_note": request.source_review_note.strip(),
                "source_license": license_label,
                "release_policy": "after_instructor_review",
            }
            version_id = str(uuid.uuid4())
            conn.execute(
                """INSERT INTO lesson_versions(id,lesson_id,version,case_id,status,
                   student_manifest_json,secret_rubric_json,published_at)
                   VALUES (?,?,?,?, 'published',?,?,CURRENT_TIMESTAMP)""",
                (version_id, lesson_id, version, case.id,
                 json.dumps(public_manifest, ensure_ascii=False, separators=(",", ":"), sort_keys=True),
                 json.dumps(secret_rubric, ensure_ascii=False, separators=(",", ":"), sort_keys=True)),
            )
            published_at = conn.execute("SELECT published_at FROM lesson_versions WHERE id=?", (version_id,)).fetchone()[0]
            conn.execute(
                "INSERT INTO educator_published_revisions(draft_id,revision,lesson_version_id) VALUES (?,?,?)",
                (draft_id, draft[5], version_id),
            )
            audit.append(conn, action="lesson.publish", target_kind="lesson_version", target_id=version_id, actor=user,
                         owner_id=user["id"], details={"draft_id": draft_id, "case_id": case.id, "version": version})
            return PublishedLessonVersion(
                version_id=version_id, lesson_id=lesson_id, version=version,
                title=draft[3], module=draft[6], case_id=case.id,
                case_label=case.label, published_at=published_at,
            )

    @app.get("/api/v1/educator/assignments", response_model=list[EducatorAssignment])
    def educator_assignment_list(user: dict = Depends(educator)):
        with db() as conn:
            rows = conn.execute(
                """SELECT a.id,a.lesson_version_id,v.student_manifest_json,a.cohort_id,a.due_at,
                          COUNT(m.user_id) FROM assignments a
                   JOIN lesson_versions v ON v.id=a.lesson_version_id
                   JOIN lessons l ON l.id=v.lesson_id
                   LEFT JOIN learning_cohort_memberships m ON m.cohort_id=a.cohort_id
                   WHERE l.created_by=? GROUP BY a.id ORDER BY v.published_at DESC,a.id DESC""",
                (user["id"],),
            ).fetchall()
        return [EducatorAssignment(
            id=r[0], lesson_version_id=r[1], lesson_title=_project_manifest(r[2])["title"],
            cohort_id=r[3], due_at=r[4], student_count=r[5],
        ) for r in rows]

    @app.get("/api/v1/educator/versions", response_model=list[PublishedLessonVersion])
    def educator_published_versions(user: dict = Depends(educator)):
        with db() as conn:
            rows = conn.execute(
                """SELECT v.id,v.lesson_id,v.version,v.published_at,v.student_manifest_json
                   FROM lesson_versions v JOIN lessons l ON l.id=v.lesson_id
                   WHERE v.status='published' AND l.created_by=?
                   ORDER BY v.published_at DESC,v.version DESC""",
                (user["id"],),
            ).fetchall()
        return [_published_version(row) for row in rows]

    @app.post("/api/v1/educator/assignments", response_model=EducatorAssignment, status_code=201)
    def educator_assignment_create(request: EducatorAssignmentCreate, user: dict = Depends(educator)):
        if request.due_at is not None and request.due_at.tzinfo is None:
            raise HTTPException(422, detail={"code": "DUE_DATE_TIMEZONE_REQUIRED", "message": "Use a due date with an explicit timezone"})
        assignment_id = str(uuid.uuid4())
        with db() as conn:
            cohort = conn.execute(
                "SELECT id FROM learning_cohorts WHERE id=? AND created_by=?",
                (request.cohort_id, user["id"]),
            ).fetchone()
            version = conn.execute(
                """SELECT v.id,v.student_manifest_json,l.created_by FROM lesson_versions v
                   JOIN lessons l ON l.id=v.lesson_id WHERE v.id=? AND v.status='published'""",
                (request.lesson_version_id,),
            ).fetchone()
            if cohort is None:
                raise _not_found("COHORT_NOT_FOUND", "Choose a cohort created by this educator")
            if version is None or (version[2] != user["id"] and user["role"] != "admin"):
                raise _not_found("PUBLISHED_VERSION_NOT_FOUND", "Choose a published lesson version owned by this educator")
            conn.execute(
                "INSERT INTO assignments(id,lesson_version_id,cohort_id,due_at,created_by) VALUES (?,?,?,?,?)",
                (assignment_id, version[0], cohort[0], request.due_at.isoformat() if request.due_at else None, user["id"]),
            )
            count = conn.execute("SELECT COUNT(*) FROM learning_cohort_memberships WHERE cohort_id=?", (cohort[0],)).fetchone()[0]
            audit.append(conn, action="assignment.create", target_kind="assignment", target_id=assignment_id, actor=user,
                         owner_id=user["id"], details={"lesson_version_id": version[0], "cohort_id": cohort[0]})
        return EducatorAssignment(
            id=assignment_id, lesson_version_id=version[0],
            lesson_title=_project_manifest(version[1])["title"], cohort_id=cohort[0],
            due_at=request.due_at, student_count=count,
        )

    @app.get("/api/v1/academy/challenges", response_model=list[StudentChallengeSummary])
    def student_challenges(user: dict = Depends(student)):
        with db() as conn:
            rows = conn.execute(
                """SELECT a.id,v.id,v.lesson_id,v.version,v.case_id,a.due_at,v.student_manifest_json,t.state
                   FROM assignments a JOIN lesson_versions v ON v.id=a.lesson_version_id
                   JOIN learning_cohort_memberships m ON m.cohort_id=a.cohort_id
                   LEFT JOIN attempts t ON t.assignment_id=a.id AND t.student_id=m.user_id
                   WHERE v.status='published' AND m.user_id=?
                   ORDER BY a.due_at IS NULL,a.due_at,v.published_at DESC,a.id""",
                (user["id"],),
            ).fetchall()
        cases = {case.id: case for case in list_cases()}
        result = []
        for row in rows:
            manifest = _project_manifest(row[6])
            case = cases.get(row[4])
            if case is None:
                continue
            result.append(StudentChallengeSummary(
                assignment_id=row[0], version_id=row[1], lesson_id=row[2],
                title=manifest["title"], module=manifest["module"], case_id=row[4],
                case_label=case.label, version=row[3], due_at=row[5],
                state={
                    None: "not_started", "started": "in_progress",
                    "submitted": "submitted", "review_required": "submitted",
                    "graded": "reviewed", "revealed": "reviewed",
                }.get(row[7], "not_started"),
            ))
        return result

    @app.get("/api/v1/academy/paths", response_model=list[StudentLearningPath])
    def student_learning_paths(user: dict = Depends(student)):
        return _student_learning_paths(user["id"])

    @app.post("/api/v1/academy/attempts", response_model=StudentAttemptManifest, status_code=201)
    def student_attempt_start(request: StudentAttemptStart, user: dict = Depends(student)):
        with db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            assignment = _assignment_for_student(conn, request.assignment_id, user)
            if assignment[3]:
                due_at = datetime.fromisoformat(assignment[3])
                if due_at <= datetime.now(timezone.utc):
                    raise HTTPException(409, detail={"code": "ASSIGNMENT_CLOSED", "message": "The due date has passed; contact your educator"})
            attempt_id = "attempt_" + uuid.uuid4().hex
            conn.execute(
                "INSERT OR IGNORE INTO attempts(id,assignment_id,student_id,state) VALUES (?,?,?,'started')",
                (attempt_id, request.assignment_id, user["id"]),
            )
            attempt = conn.execute(
                "SELECT id FROM attempts WHERE assignment_id=? AND student_id=?",
                (request.assignment_id, user["id"]),
            ).fetchone()
            conn.execute("INSERT OR IGNORE INTO learning_attempt_revisions(attempt_id,revision) VALUES (?,0)", (attempt[0],))
            row = conn.execute(
                """SELECT t.id,t.assignment_id,t.state,t.submitted_at,t.score,t.max_score,v.student_manifest_json
                   FROM attempts t JOIN assignments a ON a.id=t.assignment_id
                   JOIN lesson_versions v ON v.id=a.lesson_version_id WHERE t.id=?""",
                (attempt[0],),
            ).fetchone()
            return _attempt_manifest(conn, row)

    @app.get("/api/v1/academy/attempts/{attempt_id}", response_model=StudentAttemptManifest)
    def student_attempt_get(attempt_id: str, user: dict = Depends(student)):
        with db() as conn:
            row = _student_attempt(conn, attempt_id, user)
            return _attempt_manifest(conn, row)

    @app.put("/api/v1/academy/attempts/{attempt_id}/draft", response_model=StudentAttemptManifest)
    def student_attempt_save(attempt_id: str, request: StudentAttemptDraftUpdate, user: dict = Depends(student)):
        ids = [observation.block_id for observation in request.observations]
        if len(ids) != len(set(ids)):
            raise HTTPException(422, detail={"code": "OBSERVATION_BLOCK_DUPLICATE", "message": "Each answer block can appear only once"})
        with db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = _student_attempt(conn, attempt_id, user)
            if row[2] != "started":
                raise _conflict("ATTEMPT_NOT_EDITABLE", "Submitted work can no longer be changed")
            revision = conn.execute("SELECT revision FROM learning_attempt_revisions WHERE attempt_id=?", (attempt_id,)).fetchone()[0]
            if revision != request.expected_revision:
                raise _conflict("ATTEMPT_REVISION_CONFLICT", "This attempt changed in another session. Reload it before saving.")
            challenge = _project_manifest(row[6])
            allowed = {block["id"] for block in challenge["blocks"]}
            if any(observation.block_id not in allowed for observation in request.observations):
                raise HTTPException(422, detail={"code": "UNKNOWN_ANSWER_BLOCK", "message": "An answer does not belong to this published lesson"})
            conn.execute("DELETE FROM observations WHERE attempt_id=?", (attempt_id,))
            conn.executemany(
                "INSERT INTO observations(attempt_id,block_id,response_json) VALUES (?,?,?)",
                [(attempt_id, observation.block_id, json.dumps(observation.response, ensure_ascii=False)) for observation in request.observations],
            )
            if request.viewer_evidence is not None:
                evidence = _validate_viewer_evidence(
                    request.viewer_evidence.model_dump(), challenge["module"], row[9]
                )
                conn.execute(
                    """INSERT INTO attempt_viewer_evidence(attempt_id,evidence_json) VALUES (?,?)
                       ON CONFLICT(attempt_id) DO UPDATE SET evidence_json=excluded.evidence_json,updated_at=CURRENT_TIMESTAMP""",
                    (attempt_id, json.dumps(evidence, ensure_ascii=False, separators=(",", ":"), sort_keys=True)),
                )
            conn.execute("UPDATE learning_attempt_revisions SET revision=revision+1 WHERE attempt_id=?", (attempt_id,))
            updated = _student_attempt(conn, attempt_id, user)
            return _attempt_manifest(conn, updated)

    @app.post("/api/v1/academy/attempts/{attempt_id}/submit", response_model=StudentSubmissionReceipt)
    def student_attempt_submit(
        attempt_id: str,
        request: StudentAttemptSubmit,
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
        user: dict = Depends(student),
    ):
        if not idempotency_key or not (8 <= len(idempotency_key) <= 128):
            raise HTTPException(422, detail={"code": "IDEMPOTENCY_KEY_REQUIRED", "message": "Submit with a client-generated Idempotency-Key header"})
        with db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = _student_attempt(conn, attempt_id, user)
            receipt = conn.execute(
                "SELECT response_json FROM learning_submission_receipts WHERE attempt_id=? AND idempotency_key=?",
                (attempt_id, idempotency_key),
            ).fetchone()
            if receipt:
                return StudentSubmissionReceipt.model_validate_json(receipt[0])
            if row[2] != "started":
                raise _conflict("ATTEMPT_ALREADY_SUBMITTED", "This attempt has already been submitted")
            revision = conn.execute("SELECT revision FROM learning_attempt_revisions WHERE attempt_id=?", (attempt_id,)).fetchone()[0]
            if revision != request.expected_revision:
                raise _conflict("ATTEMPT_REVISION_CONFLICT", "Save the latest answers before submitting")
            manifest = _project_manifest(row[6])
            questions = [block["id"] for block in manifest["blocks"] if block["type"] == "Question"]
            answers = {item[0]: json.loads(item[1]) for item in conn.execute(
                "SELECT block_id,response_json FROM observations WHERE attempt_id=?", (attempt_id,)
            ).fetchall()}
            self_checks = self_check_block_ids(manifest["blocks"])
            if not (questions or self_checks) or any(not str(answers.get(block_id, "")).strip() for block_id in questions):
                raise HTTPException(422, detail={"code": "QUESTION_RESPONSE_REQUIRED", "message": "Answer every question block before submitting"})
            committed = {item.block_id for item in committed_self_checks(conn, attempt_id)}
            if any(block_id not in committed for block_id in self_checks):
                raise HTTPException(422, detail={"code": "CVS_SELF_CHECK_REQUIRED", "message": "Commit every CVS self-check before submitting"})
            evidence_row = conn.execute(
                "SELECT evidence_json FROM attempt_viewer_evidence WHERE attempt_id=?", (attempt_id,)
            ).fetchone()
            _validate_viewer_evidence(
                json.loads(evidence_row[0]) if evidence_row else None, manifest["module"], manifest["case_id"]
            )
            submitted_at = datetime.now(timezone.utc).isoformat()
            conn.execute("UPDATE attempts SET state='review_required',submitted_at=? WHERE id=?", (submitted_at, attempt_id))
            result = StudentSubmissionReceipt(attempt_id=attempt_id, state="review_required", submitted_at=submitted_at)
            conn.execute(
                "INSERT INTO learning_submission_receipts(attempt_id,idempotency_key,response_json) VALUES (?,?,?)",
                (attempt_id, idempotency_key, result.model_dump_json()),
            )
            audit.append(conn, action="attempt.submit", target_kind="attempt", target_id=attempt_id, actor=user,
                         owner_id=audit.lesson_owner_for_attempt(conn, attempt_id))
            return result

    @app.get("/api/v1/educator/assignments/{assignment_id}/attempts", response_model=list[EducatorAttemptReview])
    def educator_assignment_attempts(assignment_id: str, user: dict = Depends(educator)):
        with db() as conn:
            assignment = conn.execute(
                """SELECT a.id FROM assignments a JOIN lessons l ON l.id=(
                   SELECT lesson_id FROM lesson_versions WHERE id=a.lesson_version_id)
                   WHERE a.id=? AND l.created_by=?""",
                (assignment_id, user["id"]),
            ).fetchone()
            if assignment is None:
                raise _not_found("ASSIGNMENT_NOT_FOUND", "No assignment belongs to this educator")
            rows = conn.execute(
                """SELECT t.id,t.student_id,u.display_name,t.state,t.submitted_at,t.score,
                          v.secret_rubric_json,v.student_manifest_json
                   FROM attempts t JOIN users u ON u.id=t.student_id
                   JOIN assignments a ON a.id=t.assignment_id
                   JOIN lesson_versions v ON v.id=a.lesson_version_id
                   WHERE t.assignment_id=? ORDER BY t.submitted_at,t.id""",
                (assignment_id,),
            ).fetchall()
            result = []
            for row in rows:
                secret = json.loads(row[6])
                latest_grade = conn.execute(
                    "SELECT metadata_json FROM grade_events WHERE attempt_id=? AND event_kind='manual-review' ORDER BY created_at DESC,rowid DESC LIMIT 1",
                    (row[0],),
                ).fetchone()
                saved_scores = json.loads(latest_grade[0]).get("criterion_scores", []) if latest_grade else []
                evidence_row = conn.execute(
                    "SELECT evidence_json FROM attempt_viewer_evidence WHERE attempt_id=?", (row[0],)
                ).fetchone()
                result.append(EducatorAttemptReview(
                    attempt_id=row[0], student_id=row[1], student_name=row[2], state=row[3],
                    submitted_at=row[4], score=row[5], observations=_student_observations(conn, row[0]),
                    rubric_criteria=secret.get("rubric_criteria", []), criterion_scores=saved_scores,
                    viewer_evidence=json.loads(evidence_row[0]) if evidence_row else None,
                    assigned_case=_assigned_case(row[7]),
                    cvs_self_checks=committed_self_checks(conn, row[0]),
                ))
        return result

    @app.post("/api/v1/educator/attempts/{attempt_id}/grade", response_model=EducatorAttemptReview)
    def educator_grade_attempt(
        attempt_id: str,
        request: EducatorGradeRequest,
        idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=8, max_length=128),
        user: dict = Depends(educator),
    ):
        request_json = json.dumps(request.model_dump(mode="json"), ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        request_digest = hashlib.sha256(request_json.encode("utf-8")).hexdigest()
        with db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute(
                """SELECT t.assignment_id,t.student_id,t.state,t.score,t.submitted_at,a.lesson_version_id,l.created_by,
                          v.secret_rubric_json,v.student_manifest_json
                   FROM attempts t JOIN assignments a ON a.id=t.assignment_id
                   JOIN lesson_versions v ON v.id=a.lesson_version_id JOIN lessons l ON l.id=v.lesson_id
                   WHERE t.id=?""",
                (attempt_id,),
            ).fetchone()
            if row is None or (row[6] != user["id"] and user["role"] != "admin"):
                raise _not_found("ATTEMPT_NOT_FOUND", "No attempt is available to this educator")
            # Verify ownership before checking whether this key has a saved receipt.
            receipt = conn.execute(
                "SELECT request_sha256,response_json FROM learning_grade_receipts WHERE attempt_id=? AND idempotency_key=?",
                (attempt_id, idempotency_key),
            ).fetchone()
            if receipt:
                if receipt[0] != request_digest:
                    raise _conflict("IDEMPOTENCY_KEY_REUSED", "This Idempotency-Key was already used for a different grading request")
                saved_response = EducatorAttemptReview.model_validate_json(receipt[1])
                return saved_response.model_copy(update={"assigned_case": _assigned_case(row[8])})
            if row[2] not in ("review_required", "graded"):
                raise _conflict("ATTEMPT_NOT_SUBMITTED", "Only submitted work can be graded")
            secret = json.loads(row[7])
            criteria = secret.get("rubric_criteria", [])
            expected = {criterion["id"]: criterion for criterion in criteria}
            supplied = {score.criterion_id: score for score in request.criterion_scores}
            if len(supplied) != len(request.criterion_scores) or set(supplied) != set(expected):
                raise HTTPException(422, detail={"code": "RUBRIC_SCORE_MISMATCH", "message": "Score every published rubric criterion exactly once"})
            scored_criteria = []
            for criterion in criteria:
                result = supplied[criterion["id"]]
                if result.earned_points > criterion["max_points"]:
                    raise HTTPException(422, detail={"code": "RUBRIC_SCORE_OUT_OF_RANGE", "message": f"{criterion['title']} can receive at most {criterion['max_points']} points"})
                scored_criteria.append({**criterion, "earned_points": result.earned_points, "note": result.note.strip()})
            total_score = sum(item["earned_points"] for item in scored_criteria)
            previous = conn.execute(
                "SELECT id FROM grade_events WHERE attempt_id=? AND event_kind='manual-review' ORDER BY created_at DESC,rowid DESC LIMIT 1",
                (attempt_id,),
            ).fetchone()
            event_id = str(uuid.uuid4())
            metadata = {"score": total_score, "criterion_scores": scored_criteria, "feedback": request.feedback.strip(),
                        "reason": request.reason.strip(), "reviewer_id": user["id"],
                        "supersedes": previous[0] if previous else None}
            conn.execute(
                "INSERT INTO grade_events(id,attempt_id,event_kind,score_delta,rubric_version,metadata_json) VALUES (?,?, 'manual-review',?,?,?)",
                (event_id, attempt_id, total_score - (row[3] or 0), row[5], json.dumps(metadata, ensure_ascii=False, sort_keys=True)),
            )
            conn.execute("UPDATE attempts SET state='graded',score=?,max_score=100 WHERE id=?", (total_score, attempt_id))
            preference = conn.execute(
                "SELECT xp_enabled FROM student_learning_preferences WHERE student_id=?", (row[1],)
            ).fetchone()
            if preference is not None and preference[0]:
                conn.execute(
                    "INSERT OR IGNORE INTO achievement_events(student_id,attempt_id,achievement_key,xp_delta,unique_event_key) VALUES (?,?, 'reviewed-learning-submission',10,?)",
                    (row[1], attempt_id, f"attempt:{attempt_id}:reviewed"),
                )
            achievement_preference = conn.execute(
                "SELECT achievements_enabled FROM student_achievement_preferences WHERE student_id=?", (row[1],)
            ).fetchone()
            if achievement_preference is not None and achievement_preference[0]:
                conn.execute(
                    "INSERT OR IGNORE INTO achievement_events(student_id,attempt_id,achievement_key,xp_delta,unique_event_key) "
                    "VALUES (?,?, 'first-evidence-investigation',0,?)",
                    (row[1], attempt_id, f"student:{row[1]}:achievement:first-evidence-investigation"),
                )
            user_row = conn.execute("SELECT display_name FROM users WHERE id=?", (row[1],)).fetchone()
            response = EducatorAttemptReview(
                attempt_id=attempt_id, student_id=row[1], student_name=user_row[0],
                state="graded", submitted_at=row[4], score=total_score,
                observations=_student_observations(conn, attempt_id),
                rubric_criteria=criteria, criterion_scores=scored_criteria,
                assigned_case=_assigned_case(row[8]),
            )
            conn.execute(
                "INSERT INTO learning_grade_receipts(attempt_id,idempotency_key,request_sha256,response_json) VALUES (?,?,?,?)",
                (attempt_id, idempotency_key, request_digest, response.model_dump_json()),
            )
            # Grading releases the debrief to the learner, so one entry covers both.
            audit.append(conn, action="attempt.grade_release", target_kind="attempt", target_id=attempt_id, actor=user,
                         owner_id=audit.lesson_owner_for_attempt(conn, attempt_id), details={"score": total_score, "grade_event_id": event_id})
            return response

    @app.get("/api/v1/academy/attempts/{attempt_id}/debrief", response_model=StudentDebrief)
    def student_attempt_debrief(attempt_id: str, user: dict = Depends(student)):
        with db() as conn:
            row = _student_attempt(conn, attempt_id, user)
            if row[2] != "graded":
                raise HTTPException(403, detail={"code": "DEBRIEF_NOT_RELEASED", "message": "Your educator must review this submission before its debrief is available"})
            grade = conn.execute(
                "SELECT metadata_json FROM grade_events WHERE attempt_id=? AND event_kind='manual-review' ORDER BY created_at DESC,rowid DESC LIMIT 1",
                (attempt_id,),
            ).fetchone()
            xp = conn.execute(
                "SELECT COALESCE(SUM(xp_delta),0) FROM achievement_events WHERE attempt_id=?",
                (attempt_id,),
            ).fetchone()[0]
            preference = conn.execute(
                "SELECT xp_enabled FROM student_learning_preferences WHERE student_id=?", (user["id"],)
            ).fetchone()
            secret = json.loads(row[7])
            metadata = json.loads(grade[0]) if grade else {}
            reference_evidence = None
            if row[9].startswith("endoscapes:"):
                frame = installed_frame(row[9].rsplit(":", 1)[-1])
                if frame is not None:
                    reference_evidence = {
                        "kind": "expert_reference",
                        "case_id": frame.id,
                        "source": "Official Endoscapes COCO annotations and image-level source values",
                        "image_sha256": frame.image_sha256,
                        "annotation_sha256": frame.annotation_sha256,
                        "annotations": [annotation.model_dump() for annotation in frame.annotations],
                        "cvs_criteria": list(frame.cvs_criteria),
                        "limitations": [
                            "Reference annotations are not model predictions.",
                            "Image-level source values do not establish surgical safety or clearance.",
                        ],
                    }
            return StudentDebrief(
                attempt_id=attempt_id, score=row[4] or 0, max_score=row[5] or 100,
                feedback=metadata.get("feedback", ""),
                rubric=secret.get("rubric", "Educator did not add rubric notes."),
                criterion_scores=metadata.get("criterion_scores", []), xp_awarded=xp if preference and preference[0] else 0,
                reveal_blocks=secret.get("reveal_blocks", []), reference_evidence=reference_evidence,
            )

    @app.put("/api/v1/academy/preferences")
    def student_learning_preferences(request: StudentLearningPreferencesUpdate, user: dict = Depends(student)):
        with db() as conn:
            conn.execute(
                "INSERT INTO student_learning_preferences(student_id,xp_enabled,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) "
                "ON CONFLICT(student_id) DO UPDATE SET xp_enabled=excluded.xp_enabled,updated_at=CURRENT_TIMESTAMP",
                (user["id"], int(request.xp_enabled)),
            )
        return {"xp_enabled": request.xp_enabled}

    @app.put("/api/v1/academy/preferences/achievements")
    def student_achievement_preferences(request: StudentAchievementPreferencesUpdate, user: dict = Depends(student)):
        with db() as conn:
            conn.execute(
                "INSERT INTO student_achievement_preferences(student_id,achievements_enabled,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) "
                "ON CONFLICT(student_id) DO UPDATE SET achievements_enabled=excluded.achievements_enabled,updated_at=CURRENT_TIMESTAMP",
                (user["id"], int(request.achievements_enabled)),
            )
        return {"achievements_enabled": request.achievements_enabled}

    @app.get("/api/v1/academy/progress", response_model=StudentProgress)
    def student_progress(user: dict = Depends(student)):
        with db() as conn:
            preference = conn.execute(
                "SELECT xp_enabled FROM student_learning_preferences WHERE student_id=?", (user["id"],)
            ).fetchone()
            achievement_preference = conn.execute(
                "SELECT achievements_enabled FROM student_achievement_preferences WHERE student_id=?", (user["id"],)
            ).fetchone()
            xp = conn.execute(
                "SELECT COALESCE(SUM(xp_delta),0) FROM achievement_events WHERE student_id=?",
                (user["id"],),
            ).fetchone()[0]
            row = conn.execute(
                "SELECT COUNT(*),AVG(score) FROM attempts WHERE student_id=? AND state='graded'",
                (user["id"],),
            ).fetchone()
            assignments = conn.execute(
                """SELECT a.id,a.due_at,v.version,v.student_manifest_json,t.state
                   FROM assignments a JOIN lesson_versions v ON v.id=a.lesson_version_id
                   JOIN learning_cohort_memberships m ON m.cohort_id=a.cohort_id
                   LEFT JOIN attempts t ON t.assignment_id=a.id AND t.student_id=m.user_id
                   WHERE m.user_id=? AND v.status='published'
                   ORDER BY a.due_at IS NULL,a.due_at,v.published_at DESC,a.id""",
                (user["id"],),
            ).fetchall()
            reviews = conn.execute(
                """WITH latest_reviews AS (
                     SELECT g.attempt_id,g.metadata_json,v.lesson_id,g.created_at,v.student_manifest_json,
                            ROW_NUMBER() OVER (PARTITION BY g.attempt_id ORDER BY g.created_at DESC,g.rowid DESC) AS rank
                     FROM grade_events g JOIN attempts a ON a.id=g.attempt_id
                     JOIN assignments ass ON ass.id=a.assignment_id
                     JOIN lesson_versions v ON v.id=ass.lesson_version_id
                     WHERE a.student_id=? AND a.state='graded' AND g.event_kind='manual-review'
                   )
                   SELECT lesson_id,metadata_json,attempt_id,created_at,student_manifest_json
                   FROM latest_reviews WHERE rank=1 ORDER BY created_at,attempt_id""",
                (user["id"],),
            ).fetchall()
            achievement_rows = conn.execute(
                "SELECT achievement_key,MIN(created_at) FROM achievement_events WHERE student_id=? AND xp_delta=0 GROUP BY achievement_key",
                (user["id"],),
            ).fetchall() if achievement_preference and achievement_preference[0] else []
        resumable = []
        available = []
        awaiting_review = []
        now = datetime.now(timezone.utc)
        for assignment in assignments:
            manifest = _project_manifest(assignment[3])
            due_at = datetime.fromisoformat(assignment[1]) if assignment[1] else None
            if due_at is not None and due_at.tzinfo is None:
                due_at = due_at.replace(tzinfo=timezone.utc)
            activity = {
                "assignment_id": assignment[0], "title": manifest["title"],
                "module": manifest["module"], "case_label": manifest["case_label"],
                "version": assignment[2], "due_at": due_at,
            }
            if assignment[4] == "started":
                resumable.append(StudentNextActivity(**activity, state="resume"))
            elif assignment[4] in ("submitted", "review_required"):
                awaiting_review.append(StudentNextActivity(**activity, state="awaiting_review"))
            elif assignment[4] is None and (due_at is None or due_at > now):
                available.append(StudentNextActivity(**activity, state="start"))
        next_activity = (resumable or available or awaiting_review)
        dimensions: dict[tuple[str, str], dict] = {}
        rubric_history = []
        for review in reviews:
            try:
                scores = json.loads(review[1]).get("criterion_scores", [])
            except (TypeError, json.JSONDecodeError):
                continue
            lesson_title = _project_manifest(review[4]).get("title", "Published lesson")
            for score in scores:
                key = (review[0], score.get("id", ""))
                if not key[1]:
                    continue
                available_points = score.get("max_points", 0)
                earned_points = score.get("earned_points", 0)
                rubric_history.append({
                    "id": f"{review[2]}:{key[1]}",
                    "attempt_id": review[2],
                    "dimension_id": f"{key[0]}:{key[1]}",
                    "dimension_title": score.get("title", "Reviewed criterion"),
                    "lesson_title": lesson_title,
                    "reviewed_at": review[3],
                    "earned_points": earned_points,
                    "available_points": available_points,
                    "percent": round(earned_points / available_points * 100, 1) if available_points else None,
                })
                item = dimensions.setdefault(key, {
                    "id": f"{key[0]}:{key[1]}", "title": score.get("title", "Reviewed criterion"),
                    "description": score.get("description", ""), "attempts": 0,
                    "earned_points": 0, "available_points": 0,
                })
                item["attempts"] += 1
                item["earned_points"] += earned_points
                item["available_points"] += available_points
        rubric_dimensions = sorted(
            (item for item in dimensions.values()),
            key=lambda item: (item["earned_points"] / item["available_points"] if item["available_points"] else 0, item["title"].lower()),
        )
        for item in rubric_dimensions:
            item["average_percent"] = round(item["earned_points"] / item["available_points"] * 100, 1) if item["available_points"] else None
        achievement_definitions = {
            "first-evidence-investigation": {
                "title": "First Evidence Investigation",
                "description": "Completed a first source-backed investigation reviewed by an educator.",
            }
        }
        achievements = [
            {"key": row[0], **achievement_definitions[row[0]], "earned_at": row[1]}
            for row in achievement_rows if row[0] in achievement_definitions
        ]
        return StudentProgress(
            xp=xp or 0, xp_enabled=bool(preference and preference[0]),
            achievements_enabled=bool(achievement_preference and achievement_preference[0]),
            graded_attempts=row[0] or 0, average_score=row[1],
            assigned_activities=len(assignments), next_activity=next_activity[0] if next_activity else None,
            rubric_dimensions=rubric_dimensions,
            rubric_history=rubric_history, achievements=achievements,
        )

    @app.get("/api/v1/academy/progress/export", response_model=StudentParticipationRecord)
    def student_progress_export(user: dict = Depends(student)):
        with db() as conn:
            rows = conn.execute(
                """SELECT t.id,v.student_manifest_json,v.version,t.state,t.submitted_at,t.score,t.max_score,
                          (SELECT MAX(g.created_at) FROM grade_events g
                           WHERE g.attempt_id=t.id AND g.event_kind='manual-review') AS reviewed_at
                   FROM attempts t JOIN assignments a ON a.id=t.assignment_id
                   JOIN lesson_versions v ON v.id=a.lesson_version_id
                   WHERE t.student_id=?
                   ORDER BY COALESCE(t.submitted_at,(SELECT MAX(g.created_at) FROM grade_events g
                             WHERE g.attempt_id=t.id AND g.event_kind='manual-review')) DESC,t.id""",
                (user["id"],),
            ).fetchall()
        activities = []
        for row in rows:
            manifest = _project_manifest(row[1])
            activities.append(StudentParticipationItem(
                attempt_id=row[0], lesson_title=manifest["title"], module=manifest["module"],
                case_label=manifest["case_label"], version=row[2],
                state=row[3], submitted_at=row[4], reviewed_at=row[7], score=row[5], max_score=row[6],
            ))
        return StudentParticipationRecord(
            exported_at=datetime.now(timezone.utc),
            notice="This local record summarizes participation and educator-reviewed coursework. Scores describe authored learning activities and are not a professional qualification or evidence of clinical competence.",
            activities=activities,
        )
