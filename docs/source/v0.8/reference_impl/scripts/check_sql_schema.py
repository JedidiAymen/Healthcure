"""Validate that the entire proposed SQLite schema parses and FK checks are enabled."""
from pathlib import Path
import sqlite3
root=Path(__file__).resolve().parents[1]
conn=sqlite3.connect(':memory:')
conn.executescript((root/'db'/'migrations'/'0001_init.sql').read_text())
tables={row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
expected={'users','datasets','dataset_versions','cases','assets','annotations','models',
          'model_artifacts','experiments','analysis_runs','run_artifacts','lessons',
          'lesson_versions','assignments','attempts','observations','grade_events',
          'achievement_events','reports','evidence_notes','role_grants'}
assert expected.issubset(tables),(expected-tables)
conn.execute('PRAGMA foreign_keys=ON')
assert conn.execute('PRAGMA foreign_keys').fetchone()[0]==1
print(f'SCHEMA PASS: {len(expected)} required tables and FK enforcement')
