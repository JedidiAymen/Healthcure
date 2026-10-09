-- Private, learner-controlled cosmetic XP preference. No public board is enabled.
CREATE TABLE IF NOT EXISTS student_learning_preferences (
  student_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  xp_enabled INTEGER NOT NULL DEFAULT 0 CHECK(xp_enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
