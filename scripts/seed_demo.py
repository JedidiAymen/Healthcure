"""Seed a local demo: one educator, one student, one clinical reviewer, one cohort and starter lesson drafts.

Idempotent: existing accounts, the cohort and drafts with the same title are left
unchanged, and passwords are printed only when an account is first created.
Starter drafts come from content/lessons/*.json, are built only from datasets
installed on this computer, and are marked DRAFT pending review by a domain expert. Refuses any database outside the
project data/ folder, the system temp folder or MEDFORGE_LOCAL_DB_DIR.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import secrets
import sys
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]
EDUCATOR = ('demo-educator', 'Demo Educator', 'educator')
STUDENT = ('demo-student', 'Demo Student', 'student')
# Operator-designated reviewer for the DoseTwin research review; it does not verify medical credentials.
REVIEWER = ('demo-reviewer', 'Demo Reviewer', 'clinical_reviewer')
COHORT = 'Demo cohort'

LESSONS_DIR = ROOT / 'content' / 'lessons'


def load_lessons() -> list[dict]:
    """Starter lessons authored as data under content/lessons, all marked DRAFT."""
    return [json.loads(path.read_text(encoding='utf8')) for path in sorted(LESSONS_DIR.glob('*.json'))]


def choose_case(lesson: dict, cases: list) -> object | None:
    candidates = [case for case in cases if case.module == lesson['module']]
    preferred = next((case for case in candidates if case.id == lesson.get('preferred_case_id')), None)
    if preferred or not candidates:
        return preferred
    if lesson.get('prefer_disputed_frame'):
        from app.endoscapes import installed_frame
        from app.surgivision_review import agreement
        for case in candidates:
            frame = installed_frame(case.id)
            if frame and agreement(frame.cvs_criteria)[1] == 'disputed':
                return case
    return candidates[0]


def _allowed_database(path: Path) -> bool:
    bases = [ROOT / 'data', Path(tempfile.gettempdir())]
    if os.environ.get('MEDFORGE_LOCAL_DB_DIR'):
        # Explicit local database folder, for example the Docker state volume.
        bases.append(Path(os.environ['MEDFORGE_LOCAL_DB_DIR']))
    for base in bases:
        try:
            path.relative_to(base.resolve())
            return True
        except ValueError:
            continue
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--db', type=Path, help='SQLite path (default: MEDFORGE_DB_PATH or data/local.sqlite3)')
    args = parser.parse_args()
    raw = args.db or Path(os.environ.get('MEDFORGE_DB_PATH') or ROOT / 'data' / 'local.sqlite3')
    db_path = raw.expanduser().resolve()
    if not _allowed_database(db_path):
        raise SystemExit(f'Refusing to seed {db_path}: only databases under {ROOT / "data"} or the system temp folder are allowed.')
    os.environ['MEDFORGE_DB_PATH'] = str(db_path)
    for name, folder in [('MEDFORGE_ENDOSCAPES_ROOT', 'endoscapes'), ('MEDFORGE_FISAV_ROOT', 'fisav')]:
        if name not in os.environ and (ROOT / 'data' / folder).is_dir():
            os.environ[name] = str(ROOT / 'data' / folder)
    if 'MEDFORGE_OPENKBP_CASE_DIR' not in os.environ and (ROOT / 'data/openkbp/pt_201/dose.csv').is_file():
        os.environ['MEDFORGE_OPENKBP_CASE_DIR'] = str(ROOT / 'data/openkbp/pt_201')

    sys.path.insert(0, str(ROOT / 'apps' / 'api'))
    from app.auth import password_record
    from app.main import _db, _ensure_learning_case, create_app
    from app.schemas import EducatorDraftContent

    app = create_app()
    list_cases = next(route.endpoint for route in app.routes if getattr(route, 'path', '') == '/api/v1/cases')
    cases = [case for case in list_cases() if case.status == 'ready']

    created: list[tuple[str, str, str]] = []
    with _db() as conn:
        ids = {}
        for username, display_name, role in (EDUCATOR, STUDENT, REVIEWER):
            row = conn.execute('SELECT user_id FROM local_credentials WHERE username=? COLLATE NOCASE', (username,)).fetchone()
            if row:
                ids[role] = row[0]
                continue
            password = secrets.token_urlsafe(12)
            salt, digest = password_record(password)
            user_id = str(uuid.uuid4())
            conn.execute('INSERT INTO users(id,display_name) VALUES(?,?)', (user_id, display_name))
            conn.execute('INSERT INTO local_credentials(user_id,username,salt,password_hash) VALUES(?,?,?,?)', (user_id, username, salt, digest))
            conn.execute('INSERT INTO role_grants(user_id,role,scope) VALUES(?,?,?)', (user_id, role, 'platform'))
            ids[role] = user_id
            created.append((role, username, password))

        cohort = conn.execute('SELECT id FROM learning_cohorts WHERE created_by=? AND name=?', (ids['educator'], COHORT)).fetchone()
        cohort_id = cohort[0] if cohort else str(uuid.uuid4())
        if not cohort:
            conn.execute('INSERT INTO learning_cohorts(id,name,created_by) VALUES (?,?,?)', (cohort_id, COHORT, ids['educator']))
        conn.execute('INSERT OR IGNORE INTO learning_cohort_memberships(user_id,cohort_id,added_by) VALUES (?,?,?)',
                     (ids['student'], cohort_id, ids['educator']))

        drafts = []
        for lesson in load_lessons():
            title = lesson['title']
            case = choose_case(lesson, cases)
            if case is None:
                drafts.append(f"skipped {lesson['module']}: no installed source case for {lesson['id']}")
                continue
            if conn.execute('SELECT 1 FROM educator_drafts WHERE owner_id=? AND title=?', (ids['educator'], title)).fetchone():
                drafts.append(f'kept {title}')
                continue
            content = EducatorDraftContent.model_validate({
                'rubric': lesson['rubric'], 'rubric_criteria': lesson['rubric_criteria'], 'blocks': lesson['blocks'],
            })
            _ensure_learning_case(conn, case)
            conn.execute('INSERT INTO educator_drafts(id,owner_id,case_id,title,content_json) VALUES (?,?,?,?,?)',
                         (str(uuid.uuid4()), ids['educator'], case.id, title,
                          json.dumps(content.model_dump(), ensure_ascii=False, separators=(',', ':'), sort_keys=True)))
            drafts.append(f'created {title} on {case.id}')

    print(f'Database: {db_path}')
    print(f'Cohort: {COHORT} (student added)')
    for line in drafts:
        print(f'Draft: {line}')
    if created:
        print('\nNew local accounts (shown once, store them safely):')
        for role, username, password in created:
            print(f'  {role:8} {username}  {password}')
    else:
        print('\nAccounts already existed; passwords were not changed or shown.')


if __name__ == '__main__':
    main()
