-- Optional, private activity badges are separate from cosmetic XP.
CREATE TABLE IF NOT EXISTS student_achievement_preferences (
  student_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  achievements_enabled INTEGER NOT NULL DEFAULT 0 CHECK(achievements_enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
