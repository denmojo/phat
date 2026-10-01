package mailindex

import (
	"database/sql"
	"path/filepath"
	"testing"
)

func TestOpenCreatesSchema(t *testing.T) {
	dir := t.TempDir()
	ix, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer ix.Close()
	if ix.Path() != filepath.Join(dir, "index.db") {
		t.Fatalf("path = %s", ix.Path())
	}
	var v string
	if err := ix.db.QueryRow(`SELECT value FROM meta WHERE key='schema_version'`).Scan(&v); err != nil {
		t.Fatal(err)
	}
	if v != "1" {
		t.Fatalf("schema_version = %s", v)
	}
	for _, table := range []string{"messages", "flags", "labels", "message_labels", "messages_fts", "meta"} {
		var name string
		err := ix.db.QueryRow(`SELECT name FROM sqlite_master WHERE name=?`, table).Scan(&name)
		if err == sql.ErrNoRows {
			t.Errorf("table %s missing", table)
		}
	}
}

func TestOpenTwiceIsIdempotent(t *testing.T) {
	dir := t.TempDir()
	ix, err := Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	ix.Close()
	ix, err = Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	ix.Close()
}

func TestIsSystemFolder(t *testing.T) {
	for _, n := range []string{"in", "out", "sent", "archive"} {
		if !IsSystemFolder(n) {
			t.Errorf("%s should be system", n)
		}
	}
	if IsSystemFolder("radio") || IsSystemFolder("In") {
		t.Error("custom or differently cased names are not system folders")
	}
}
