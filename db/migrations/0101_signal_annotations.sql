-- Educator annotations on measured FiSaV windows, bound to the exact source file hash.
CREATE TABLE IF NOT EXISTS signal_annotations (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  source_sha256 TEXT NOT NULL CHECK(length(source_sha256)=64),
  channel TEXT NOT NULL,
  start_sec REAL NOT NULL CHECK(start_sec>=0),
  end_sec REAL NOT NULL,
  label TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(end_sec>start_sec)
);
CREATE INDEX IF NOT EXISTS idx_signal_annotations_owner_record
  ON signal_annotations(created_by, record_id);
