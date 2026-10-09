-- MEDFORGE v0.8 conceptual SQLite schema and local MVP migration.
-- Prototype is NOT production-hardened. Role/access controls below are modeled but not yet wired.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, external_auth_subject TEXT UNIQUE,
  display_name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS role_grants (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('student','educator','researcher','admin')),
  scope TEXT NOT NULL DEFAULT 'platform',
  PRIMARY KEY(user_id, role, scope)
);
CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, modality TEXT NOT NULL
    CHECK(modality IN ('surgical-video','radiotherapy-volume','vascular-signal')),
  source_url TEXT NOT NULL, upstream_revision TEXT,
  license_label TEXT NOT NULL, redistribution_allowed INTEGER NOT NULL DEFAULT 0
    CHECK(redistribution_allowed IN (0,1)),
  access_policy TEXT NOT NULL DEFAULT 'restricted',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS dataset_versions (
  id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL REFERENCES datasets(id),
  version TEXT NOT NULL, source_manifest_sha256 TEXT,
  acquired_at TEXT, UNIQUE(dataset_id,version)
);
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY, module TEXT NOT NULL CHECK(module IN ('surgivision','dosetwin','fistulaguard')),
  dataset_version_id TEXT NOT NULL REFERENCES dataset_versions(id),
  external_case_id TEXT NOT NULL, partition_name TEXT,
  reference_kind TEXT NOT NULL CHECK(reference_kind IN ('research','benchmark','synthetic-test')),
  status TEXT NOT NULL DEFAULT 'not-installed'
    CHECK(status IN ('not-installed','ready','blocked','invalid')),
  patient_identity_present INTEGER NOT NULL DEFAULT 0 CHECK(patient_identity_present IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dataset_version_id,external_case_id)
);
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('image-sequence','bbox','segmentation','volume','mask','signal','ecg','report','plot','model-weights')),
  relative_storage_key TEXT NOT NULL, sha256 TEXT NOT NULL CHECK(length(sha256)=64),
  media_type TEXT NOT NULL, size_bytes INTEGER NOT NULL CHECK(size_bytes >=0),
  unit TEXT, coordinate_frame TEXT, metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(case_id,relative_storage_key)
);
CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
  asset_id TEXT REFERENCES assets(id), annotation_type TEXT NOT NULL,
  creator_type TEXT NOT NULL CHECK(creator_type IN ('expert','model','educator','synthetic-test')),
  reference_source TEXT, metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY, module TEXT NOT NULL CHECK(module IN ('surgivision','dosetwin','fistulaguard')),
  name TEXT NOT NULL, version TEXT NOT NULL,
  upstream_url TEXT NOT NULL, upstream_commit TEXT,
  adapter_id TEXT NOT NULL, input_schema_id TEXT NOT NULL,
  output_schema_id TEXT NOT NULL, license_label TEXT NOT NULL,
  requires_gpu INTEGER NOT NULL DEFAULT 0 CHECK(requires_gpu IN (0,1)),
  min_vram_mb INTEGER, requires_solver TEXT, metadata_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(id,version)
);
CREATE TABLE IF NOT EXISTS model_artifacts (
  id TEXT PRIMARY KEY, model_id TEXT NOT NULL REFERENCES models(id),
  storage_key TEXT NOT NULL, sha256 TEXT NOT NULL CHECK(length(sha256)=64),
  artifact_kind TEXT NOT NULL, installed INTEGER NOT NULL DEFAULT 0 CHECK(installed IN (0,1))
);
CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY, created_by TEXT REFERENCES users(id),
  module TEXT NOT NULL CHECK(module IN ('surgivision','dosetwin','fistulaguard')),
  operation_id TEXT NOT NULL, spec_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS analysis_runs (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
  experiment_id TEXT REFERENCES experiments(id),
  model_id TEXT REFERENCES models(id),
  operation_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed','cancelled')),
  input_hash TEXT, parameters_json TEXT NOT NULL DEFAULT '{}', result_json TEXT,
  failure_code TEXT, source_revision TEXT, output_provenance_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT, completed_at TEXT,
  UNIQUE(case_id,operation_id,input_hash)
);
CREATE INDEX IF NOT EXISTS idx_runs_case_time ON analysis_runs(case_id,created_at DESC);
CREATE TABLE IF NOT EXISTS run_artifacts (
  run_id TEXT NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id), role TEXT NOT NULL,
  PRIMARY KEY(run_id,asset_id,role)
);
CREATE TABLE IF NOT EXISTS evidence_notes (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
  run_id TEXT REFERENCES analysis_runs(id), created_by TEXT REFERENCES users(id),
  anchor_json TEXT NOT NULL, content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY, module TEXT NOT NULL CHECK(module IN ('surgivision','dosetwin','fistulaguard')),
  created_by TEXT REFERENCES users(id), title TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lesson_versions (
  id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id),
  version INTEGER NOT NULL CHECK(version>=1),
  case_id TEXT NOT NULL REFERENCES cases(id), status TEXT NOT NULL
    CHECK(status IN ('draft','review','published','retired')),
  student_manifest_json TEXT NOT NULL,
  secret_rubric_json TEXT NOT NULL,
  published_at TEXT, UNIQUE(lesson_id,version)
);
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY, lesson_version_id TEXT NOT NULL REFERENCES lesson_versions(id),
  cohort_id TEXT NOT NULL, due_at TEXT, created_by TEXT REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS attempts (
  id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id),
  student_id TEXT NOT NULL REFERENCES users(id),
  state TEXT NOT NULL CHECK(state IN ('started','submitted','graded','review_required','revealed')),
  submitted_at TEXT, score REAL, max_score REAL,
  UNIQUE(assignment_id,student_id)
);
CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id),
  block_id TEXT NOT NULL, response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(attempt_id,block_id)
);
CREATE TABLE IF NOT EXISTS grade_events (
  id TEXT PRIMARY KEY, attempt_id TEXT NOT NULL REFERENCES attempts(id),
  event_kind TEXT NOT NULL, score_delta REAL NOT NULL DEFAULT 0,
  rubric_version TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS achievement_events (
  id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES users(id),
  attempt_id TEXT REFERENCES attempts(id),
  achievement_key TEXT NOT NULL, xp_delta INTEGER NOT NULL CHECK(xp_delta>=0),
  unique_event_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
  run_id TEXT REFERENCES analysis_runs(id), created_by TEXT REFERENCES users(id),
  status TEXT NOT NULL CHECK(status IN ('draft','generated','failed')),
  provenance_json TEXT NOT NULL, storage_key TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO schema_migrations(version) VALUES('0001');
