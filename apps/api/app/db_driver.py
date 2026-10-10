"""Database driver selection.

When MEDFORGE_DB_KEY_FILE names a file holding a 64-character hex key, the app database is
opened with SQLCipher (AES-256 page encryption, SQLCipher 4 defaults). Otherwise the standard
library sqlite3 driver is used and the file is not encrypted. Research datasets are separate
read-only files and are never encrypted by this module.
"""
from __future__ import annotations

import os
from pathlib import Path
import re
import sqlite3
from typing import Any

try:  # Present in the API container only.
    import sqlcipher3.dbapi2 as _sqlcipher
except ImportError:  # pragma: no cover - depends on the environment
    _sqlcipher = None

INTEGRITY_ERRORS: tuple[type[BaseException], ...] = (sqlite3.IntegrityError,) + ((_sqlcipher.IntegrityError,) if _sqlcipher else ())


class DatabaseKeyError(RuntimeError):
    pass


def configured_key() -> str | None:
    key_file = os.environ.get('MEDFORGE_DB_KEY_FILE', '').strip()
    if not key_file:
        return None
    try:
        key = Path(key_file).read_text(encoding='ascii').strip().lower()
    except OSError as error:
        raise DatabaseKeyError(f'The database key file {key_file} cannot be read') from error
    if not re.fullmatch(r'[0-9a-f]{64}', key):
        raise DatabaseKeyError('The database key must be 64 hexadecimal characters (256 bits)')
    return key


def storage_encryption() -> str:
    return 'sqlcipher-aes-256' if configured_key() else 'none'


def connect(path: str | Path) -> Any:
    key = configured_key()
    if key is None:
        return sqlite3.connect(path)
    if _sqlcipher is None:
        raise DatabaseKeyError('A database key is configured but SQLCipher is not installed in this environment')
    conn = _sqlcipher.connect(str(path))
    conn.execute(f"PRAGMA key = \"x'{key}'\"")
    try:
        # Fails here, not later, when the key does not match the file.
        conn.execute('SELECT count(*) FROM sqlite_master').fetchone()
    except _sqlcipher.DatabaseError as error:
        conn.close()
        raise DatabaseKeyError('The database key does not open this database file') from error
    return conn
