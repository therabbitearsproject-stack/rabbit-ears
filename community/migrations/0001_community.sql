CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT,
  csrf TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE TABLE channels (
  number INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  discord_id TEXT NOT NULL UNIQUE
);
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  channel INTEGER NOT NULL REFERENCES channels(number),
  media_key TEXT NOT NULL,
  media_id TEXT NOT NULL,
  media_file TEXT NOT NULL,
  title TEXT NOT NULL,
  position REAL NOT NULL CHECK(position >= 0),
  kind TEXT NOT NULL CHECK(kind IN ('comment', 'emoji')),
  body TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER,
  discord_message_id TEXT,
  UNIQUE(user_id, request_id)
);
CREATE INDEX events_playback ON events(channel,media_key,position) WHERE deleted_at IS NULL;
CREATE INDEX events_rate ON events(user_id,created_at);
CREATE TABLE outbox (
  event_id TEXT PRIMARY KEY REFERENCES events(id),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX outbox_due ON outbox(done,next_attempt,lease_until);
