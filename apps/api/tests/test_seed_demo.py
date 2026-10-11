"""seed_demo.py is idempotent, local-only and builds drafts only from installed sources."""
import os
from pathlib import Path
import sqlite3
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
SEED = ROOT / 'scripts' / 'seed_demo.py'


def _env(tmp_path: Path, db: Path) -> dict:
    case = tmp_path / 'test-synthetic-case'
    case.mkdir(exist_ok=True)
    (case / 'voxel_dimensions.csv').write_text('2.0\n2.0\n2.0\n', encoding='utf8')
    for name, rows in [('ct.csv', '0,100\n'), ('dose.csv', '0,12\n'), ('possible_dose_mask.csv', '0,\n')]:
        (case / name).write_text(',data\n' + rows, encoding='utf8')
    empty = tmp_path / 'no-source'
    empty.mkdir(exist_ok=True)
    return {**os.environ, 'MEDFORGE_DB_PATH': str(db), 'MEDFORGE_SOURCE_KIND': 'synthetic-test',
            'MEDFORGE_OPENKBP_CASE_DIR': str(case), 'MEDFORGE_ENDOSCAPES_ROOT': str(empty),
            'MEDFORGE_FISAV_ROOT': str(empty), 'MEDFORGE_APPENDIX300_ROOT': str(empty)}


def _run(env: dict, *args: str):
    return subprocess.run([sys.executable, str(SEED), *args], env=env, capture_output=True, text=True, timeout=120)


def test_seed_is_idempotent_and_prints_passwords_once(tmp_path):
    db = tmp_path / 'seed.sqlite3'
    env = _env(tmp_path, db)
    first = _run(env)
    assert first.returncode == 0, first.stderr
    assert 'demo-educator' in first.stdout and 'demo-student' in first.stdout and 'demo-reviewer' in first.stdout
    assert 'created DRAFT: Reading a dose-volume histogram' in first.stdout
    assert 'skipped fistulaguard' in first.stdout and 'skipped surgivision' in first.stdout

    second = _run(env)
    assert second.returncode == 0, second.stderr
    assert 'passwords were not changed or shown' in second.stdout
    assert 'kept DRAFT: Reading a dose-volume histogram' in second.stdout

    with sqlite3.connect(db) as conn:
        assert conn.execute('SELECT count(*) FROM local_credentials').fetchone()[0] == 3
        assert conn.execute("SELECT count(*) FROM role_grants WHERE role='clinical_reviewer'").fetchone()[0] == 1
        assert conn.execute('SELECT count(*) FROM learning_cohorts').fetchone()[0] == 1
        assert conn.execute('SELECT count(*) FROM learning_cohort_memberships').fetchone()[0] == 1
        assert conn.execute('SELECT count(*) FROM educator_drafts').fetchone()[0] == 1


def test_seed_refuses_databases_outside_local_folders(tmp_path):
    outside = ROOT.parent / 'not-a-medforge-db.sqlite3'
    result = _run(_env(tmp_path, tmp_path / 'unused.sqlite3'), '--db', str(outside))
    assert result.returncode != 0
    assert 'Refusing to seed' in result.stderr
    assert not outside.exists()


def test_seed_accepts_an_explicit_local_database_folder(tmp_path):
    folder = ROOT.parent / '.medforge-seed-test-volume'
    env = {**_env(tmp_path, tmp_path / 'unused.sqlite3'), 'MEDFORGE_LOCAL_DB_DIR': str(folder)}
    try:
        result = _run(env, '--db', str(folder / 'state.sqlite3'))
        assert result.returncode == 0, result.stderr
        assert (folder / 'state.sqlite3').exists()
    finally:
        for item in folder.glob('*'):
            item.unlink()
        folder.rmdir() if folder.exists() else None
