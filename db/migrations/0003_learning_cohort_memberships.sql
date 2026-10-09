-- Explicit local cohort membership for assignment-scoped student access.
CREATE TABLE IF NOT EXISTS learning_cohort_memberships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cohort_id TEXT NOT NULL,
  added_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,cohort_id)
);
CREATE INDEX IF NOT EXISTS idx_learning_cohort_memberships_cohort
  ON learning_cohort_memberships(cohort_id,user_id);
