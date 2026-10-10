"""Validate that the entire proposed SQLite schema parses and FK checks are enabled."""
import argparse
from pathlib import Path
import sqlite3


def main() -> None:
    argparse.ArgumentParser(description=__doc__).parse_args()
    root=Path(__file__).resolve().parents[1]
    conn=sqlite3.connect(':memory:')
    for migration in sorted((root/'db'/'migrations').glob('*.sql')):
        conn.executescript(migration.read_text())
    tables={row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    expected={'users','datasets','dataset_versions','cases','assets','annotations','models',
              'model_artifacts','experiments','analysis_runs','run_artifacts','lessons',
              'lesson_versions','assignments','attempts','observations','grade_events',
              'achievement_events','reports','evidence_notes','role_grants','local_credentials',
              'local_sessions','learning_submission_receipts','learning_cohort_memberships',
              'educator_drafts','learning_cohorts','educator_draft_publications',
              'educator_published_revisions','learning_attempt_revisions','attempt_viewer_evidence',
              'student_learning_preferences','student_achievement_preferences','signal_comparisons',
              'learning_grade_receipts'}
    assert expected.issubset(tables),(expected-tables)
    conn.execute('PRAGMA foreign_keys=ON')
    assert conn.execute('PRAGMA foreign_keys').fetchone()[0]==1
    print(f'SCHEMA PASS: {len(expected)} required tables and FK enforcement')


if __name__ == '__main__':
    main()
