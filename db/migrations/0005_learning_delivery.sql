-- Local cohort delivery, immutable publish bindings and optimistic attempt revisions.
CREATE TABLE IF NOT EXISTS learning_cohorts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(created_by,name)
);
CREATE TABLE IF NOT EXISTS educator_draft_publications (
  draft_id TEXT PRIMARY KEY REFERENCES educator_drafts(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS educator_published_revisions (
  draft_id TEXT NOT NULL REFERENCES educator_drafts(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK(revision >= 1),
  lesson_version_id TEXT NOT NULL UNIQUE REFERENCES lesson_versions(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(draft_id,revision)
);
CREATE TABLE IF NOT EXISTS learning_attempt_revisions (
  attempt_id TEXT PRIMARY KEY REFERENCES attempts(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0)
);

CREATE TRIGGER IF NOT EXISTS published_lesson_versions_are_immutable
BEFORE UPDATE ON lesson_versions
WHEN OLD.status='published'
BEGIN
  SELECT RAISE(ABORT,'published lesson versions are immutable');
END;
CREATE TRIGGER IF NOT EXISTS published_lesson_versions_cannot_be_deleted
BEFORE DELETE ON lesson_versions
WHEN OLD.status='published'
BEGIN
  SELECT RAISE(ABORT,'published lesson versions cannot be deleted');
END;
CREATE TRIGGER IF NOT EXISTS grade_events_are_immutable_update
BEFORE UPDATE ON grade_events
BEGIN
  SELECT RAISE(ABORT,'grade events are append-only');
END;
CREATE TRIGGER IF NOT EXISTS grade_events_are_immutable_delete
BEFORE DELETE ON grade_events
BEGIN
  SELECT RAISE(ABORT,'grade events are append-only');
END;
CREATE TRIGGER IF NOT EXISTS achievement_events_are_immutable_update
BEFORE UPDATE ON achievement_events
BEGIN
  SELECT RAISE(ABORT,'achievement events are append-only');
END;
CREATE TRIGGER IF NOT EXISTS achievement_events_are_immutable_delete
BEFORE DELETE ON achievement_events
BEGIN
  SELECT RAISE(ABORT,'achievement events are append-only');
END;
