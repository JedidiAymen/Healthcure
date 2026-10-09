-- Durable idempotency receipts for educator grading requests.
CREATE TABLE IF NOT EXISTS learning_grade_receipts (
  attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL CHECK(length(idempotency_key) BETWEEN 8 AND 128),
  request_sha256 TEXT NOT NULL CHECK(length(request_sha256) = 64),
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(attempt_id, idempotency_key)
);
