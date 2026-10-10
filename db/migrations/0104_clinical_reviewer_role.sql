-- Add the locally designated clinical_reviewer role while preserving existing grants.
-- Migrations are replayed at startup, so this table rebuild must remain safe to rerun.
PRAGMA foreign_keys=OFF;
BEGIN IMMEDIATE;

CREATE TABLE role_grants_0104 (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('student','educator','researcher','admin','clinical_reviewer')),
  scope TEXT NOT NULL DEFAULT 'platform',
  PRIMARY KEY(user_id, role, scope)
);

INSERT INTO role_grants_0104(user_id,role,scope)
SELECT user_id,role,scope FROM role_grants;

DROP TABLE role_grants;
ALTER TABLE role_grants_0104 RENAME TO role_grants;

INSERT OR IGNORE INTO schema_migrations(version) VALUES('0104');
COMMIT;
PRAGMA foreign_keys=ON;
