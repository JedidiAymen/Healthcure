CREATE TABLE IF NOT EXISTS dose_artifacts (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  source_case_id TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  source_file_name TEXT NOT NULL,
  source_file_sha256 TEXT NOT NULL CHECK(length(source_file_sha256)=64),
  source_revision TEXT NOT NULL,
  shape_json TEXT NOT NULL,
  spacing_json TEXT NOT NULL,
  index_convention TEXT NOT NULL CHECK(index_convention='x-major-y-middle-z-fastest'),
  dose_unit TEXT NOT NULL CHECK(dose_unit='Gy'),
  origin TEXT NOT NULL CHECK(origin='archived_model_prediction'),
  model_revision TEXT NOT NULL,
  checkpoint_sha256 TEXT NOT NULL CHECK(length(checkpoint_sha256)=64),
  rights_basis TEXT NOT NULL,
  validation_status TEXT NOT NULL CHECK(validation_status='grid-validated-local-only'),
  size_bytes INTEGER NOT NULL CHECK(size_bytes>0 AND size_bytes<=67108864),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dose_artifacts_case_time ON dose_artifacts(case_id,created_at DESC);
