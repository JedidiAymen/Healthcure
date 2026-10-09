CREATE TABLE IF NOT EXISTS signal_comparisons (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  comparison_key TEXT NOT NULL UNIQUE,
  source_sha256 TEXT NOT NULL CHECK(length(source_sha256)=64),
  parameters_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_signal_comparisons_case_time
  ON signal_comparisons(case_id, created_at DESC, id DESC);
