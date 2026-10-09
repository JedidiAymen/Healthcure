-- Persist the learner's case-scoped viewer selection with the resumable attempt.
CREATE TABLE IF NOT EXISTS attempt_viewer_evidence (
  attempt_id TEXT PRIMARY KEY REFERENCES attempts(id) ON DELETE CASCADE,
  evidence_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
