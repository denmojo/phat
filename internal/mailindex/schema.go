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

-- emails is the table for people querying index.db by hand: one row per
-- message, with its body, star and labels, so plain SQL such as
--   SELECT * FROM emails WHERE sender = 'W6EOC'
-- works without knowing how the tables above divide the data. It holds
-- nothing of its own and is recreated on every open, so it always matches
-- the tables. Dates are UTC; bodies use plain newlines instead of Winlink's
-- CRLF.
DROP VIEW IF EXISTS emails;
CREATE VIEW emails AS
SELECT m.mid,
       m.folder,
       m.from_addr                       AS sender,
       m.to_addrs                        AS recipients,
       m.cc_addrs                        AS cc,
       m.subject,
       datetime(m.date, 'unixepoch')     AS sent_at,
       replace(f.body, char(13) || char(10), char(10)) AS body,
       m.unread,
       coalesce(fl.starred, 0)           AS starred,
       coalesce((SELECT group_concat(label, ', ')
                 FROM (SELECT label FROM message_labels l WHERE l.mid = m.mid ORDER BY label)), '') AS labels,
       m.attachments,
       m.p2p_only
FROM messages m
JOIN messages_fts f ON f.mid = m.mid
LEFT JOIN flags fl ON fl.mid = m.mid;
`
