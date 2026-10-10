"""Regression coverage for the forward clinical reviewer role migration."""
from pathlib import Path
import sqlite3


ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = ROOT / 'db' / 'migrations'


def _run_script(conn: sqlite3.Connection, path: Path) -> None:
    conn.executescript(path.read_text(encoding='utf8'))


def test_clinical_reviewer_migration_preserves_legacy_grants_and_is_idempotent():
    conn = sqlite3.connect(':memory:')
    conn.execute('PRAGMA foreign_keys=ON')
    _run_script(conn, MIGRATIONS / '0001_init.sql')

    legacy_grants = [
        ('student-user', 'student', 'platform'),
        ('educator-user', 'educator', 'platform'),
        ('researcher-user', 'researcher', 'platform'),
        ('admin-user', 'admin', 'platform'),
    ]
    conn.executemany(
        'INSERT INTO users(id,display_name) VALUES(?,?)',
        [(user_id, user_id) for user_id, _, _ in legacy_grants],
    )
    conn.executemany(
        'INSERT INTO role_grants(user_id,role,scope) VALUES(?,?,?)', legacy_grants
    )
    conn.commit()

    migration = MIGRATIONS / '0104_clinical_reviewer_role.sql'
    _run_script(conn, migration)
    # Startup replays every SQL migration. Reapplying this migration must keep all rows.
    _run_script(conn, migration)

    actual = conn.execute(
        'SELECT user_id,role,scope FROM role_grants ORDER BY user_id,role,scope'
    ).fetchall()
    assert actual == sorted(legacy_grants)
    assert conn.execute(
        "SELECT COUNT(*) FROM schema_migrations WHERE version='0104'"
    ).fetchone()[0] == 1

    conn.execute(
        "INSERT INTO users(id,display_name) VALUES('reviewer-user','Reviewer')"
    )
    conn.execute(
        "INSERT INTO role_grants(user_id,role,scope) VALUES('reviewer-user','clinical_reviewer','platform')"
    )
    assert conn.execute(
        "SELECT role FROM role_grants WHERE user_id='reviewer-user'"
    ).fetchone()[0] == 'clinical_reviewer'
    assert conn.execute('PRAGMA foreign_key_check').fetchall() == []

    conn.close()


def test_clinical_reviewer_migration_keeps_role_constraint():
    conn = sqlite3.connect(':memory:')
    conn.execute('PRAGMA foreign_keys=ON')
    _run_script(conn, MIGRATIONS / '0001_init.sql')
    _run_script(conn, MIGRATIONS / '0104_clinical_reviewer_role.sql')
    conn.execute("INSERT INTO users(id,display_name) VALUES('known-user','Known')")

    try:
        conn.execute(
            "INSERT INTO role_grants(user_id,role,scope) VALUES('known-user','unverified_doctor','platform')"
        )
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError('the role constraint must reject unrecognized role labels')
    finally:
        conn.close()
