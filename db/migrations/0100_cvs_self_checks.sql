-- Learner CVS self-check judgements, committed once before annotator means are revealed.
-- Numbered from 0100 so new migrations never collide with parallel 00xx work.
CREATE TABLE IF NOT EXISTS cvs_self_checks (
  attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  block_id TEXT NOT NULL,
  frame_id TEXT NOT NULL,
  judgements_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  committed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(attempt_id, block_id)
);
CREATE TRIGGER IF NOT EXISTS cvs_self_checks_immutable
BEFORE UPDATE ON cvs_self_checks
BEGIN
  SELECT RAISE(ABORT, 'CVS self-check commitments are immutable');
END;
