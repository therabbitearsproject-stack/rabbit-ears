CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 0 CHECK(version >= 0),
  preferences_json TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(preferences_json)),
  updated_at INTEGER NOT NULL
);
