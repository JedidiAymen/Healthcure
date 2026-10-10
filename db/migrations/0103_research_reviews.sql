-- DoseTwin research reviews: frozen reviewer decisions on a reference vs archived prediction.
-- Immutable: a later review supersedes an earlier one instead of editing it.
CREATE TABLE IF NOT EXISTS research_reviews (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK(decision IN ('accept_for_further_expert_assessment','request_revision','reject_research_candidate')),
  supersedes_id TEXT REFERENCES research_reviews(id),
  review_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_research_reviews_case ON research_reviews(case_id, artifact_id, created_at);
CREATE TRIGGER IF NOT EXISTS research_reviews_no_update BEFORE UPDATE ON research_reviews
BEGIN SELECT RAISE(ABORT, 'research reviews are immutable; record a superseding review'); END;
CREATE TRIGGER IF NOT EXISTS research_reviews_no_delete BEFORE DELETE ON research_reviews
BEGIN SELECT RAISE(ABORT, 'research reviews are immutable; record a superseding review'); END;
