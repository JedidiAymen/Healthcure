-- Append-only, hash-chained audit log for non-repudiation of sensitive actions.
-- Each row stores the previous row's hash and its own SHA-256 over a canonical form of its fields.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  actor_id TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  owner_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  prev_hash TEXT NOT NULL CHECK(length(prev_hash)=64),
  row_hash TEXT NOT NULL UNIQUE CHECK(length(row_hash)=64)
);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id, id);
CREATE INDEX IF NOT EXISTS idx_audit_log_owner ON audit_log(owner_id, id);
CREATE TRIGGER IF NOT EXISTS audit_log_no_update
BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only');
END;
CREATE TRIGGER IF NOT EXISTS audit_log_no_delete
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is append-only');
END;
