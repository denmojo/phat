package mailindex

const SchemaVersion = 1

// schema is applied on every Open; every statement is idempotent.
const schema = `
CREATE TABLE IF NOT EXISTS messages (
	mid         TEXT PRIMARY KEY,
	folder      TEXT NOT NULL,
	from_addr   TEXT NOT NULL DEFAULT '',
	to_addrs    TEXT NOT NULL DEFAULT '',
	cc_addrs    TEXT NOT NULL DEFAULT '',
	subject     TEXT NOT NULL DEFAULT '',
	date        INTEGER NOT NULL DEFAULT 0,
	size        INTEGER NOT NULL DEFAULT 0,
	unread      INTEGER NOT NULL DEFAULT 0,
	p2p_only    INTEGER NOT NULL DEFAULT 0,
	attachments INTEGER NOT NULL DEFAULT 0,
	file_mtime  INTEGER NOT NULL DEFAULT 0,
	file_size   INTEGER NOT NULL DEFAULT 0,
	indexed_at  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS messages_folder_date ON messages(folder, date DESC);

CREATE TABLE IF NOT EXISTS flags (
	mid        TEXT PRIMARY KEY,
	starred    INTEGER NOT NULL DEFAULT 0,
	starred_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS labels (
	name     TEXT PRIMARY KEY,
	color    TEXT NOT NULL DEFAULT '',
	position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS message_labels (
	mid   TEXT NOT NULL,
	label TEXT NOT NULL,
	PRIMARY KEY (mid, label)
);
CREATE INDEX IF NOT EXISTS message_labels_label ON message_labels(label);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
	mid UNINDEXED, subject, from_addr, to_addrs, body
);

CREATE TABLE IF NOT EXISTS meta (
	key   TEXT PRIMARY KEY,
	value TEXT NOT NULL
);
INSERT OR IGNORE INTO meta(key, value) VALUES ('schema_version', '1');
`
