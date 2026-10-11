-- Records which draft revision the educator last opened in the learner-safe preview,
-- so the server can refuse to publish a revision nobody previewed. Safe to replay at startup.
CREATE TABLE IF NOT EXISTS educator_draft_previews (
  draft_id TEXT PRIMARY KEY REFERENCES educator_drafts(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  previewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
