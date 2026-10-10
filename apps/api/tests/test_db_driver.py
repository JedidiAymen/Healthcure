"""Database driver selection and key validation; encryption itself is verified in the API container."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest

from app import db_driver


def test_without_a_key_the_standard_driver_is_used(monkeypatch, tmp_path):
    monkeypatch.delenv('MEDFORGE_DB_KEY_FILE', raising=False)
    assert db_driver.storage_encryption() == 'none'
    conn = db_driver.connect(tmp_path / 'plain.sqlite3')
    conn.execute('CREATE TABLE t(x)')
    conn.close()
    assert (tmp_path / 'plain.sqlite3').read_bytes().startswith(b'SQLite format 3')


@pytest.mark.parametrize('content', ['short', 'z' * 64, ''])
def test_malformed_keys_are_refused(monkeypatch, tmp_path, content):
    key_file = tmp_path / 'key'
    key_file.write_text(content, encoding='ascii')
    monkeypatch.setenv('MEDFORGE_DB_KEY_FILE', str(key_file))
    with pytest.raises(db_driver.DatabaseKeyError):
        db_driver.configured_key()


def test_missing_key_file_is_refused(monkeypatch, tmp_path):
    monkeypatch.setenv('MEDFORGE_DB_KEY_FILE', str(tmp_path / 'absent'))
    with pytest.raises(db_driver.DatabaseKeyError):
        db_driver.connect(tmp_path / 'db.sqlite3')


@pytest.mark.skipif(db_driver._sqlcipher is None, reason='SQLCipher is installed in the API container only')
def test_sqlcipher_file_is_unreadable_without_the_key(monkeypatch, tmp_path):
    key_file = tmp_path / 'key'
    key_file.write_text('ab' * 32, encoding='ascii')
    monkeypatch.setenv('MEDFORGE_DB_KEY_FILE', str(key_file))
    conn = db_driver.connect(tmp_path / 'secret.sqlite3')
    conn.execute("CREATE TABLE t(x)"); conn.execute("INSERT INTO t VALUES ('learner answer')"); conn.commit(); conn.close()
    raw = (tmp_path / 'secret.sqlite3').read_bytes()
    assert not raw.startswith(b'SQLite format 3') and b'learner answer' not in raw
    key_file.write_text('cd' * 32, encoding='ascii')
    with pytest.raises(db_driver.DatabaseKeyError):
        db_driver.connect(tmp_path / 'secret.sqlite3')
