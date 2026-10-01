package mailindex

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	_ "modernc.org/sqlite"
)

const FileName = "index.db"

var systemFolders = map[string]bool{"in": true, "out": true, "sent": true, "archive": true}

// IsSystemFolder reports whether name is one of the four folders wl2k-go
// and the exchange code write to. Exact match; system names are lowercase.
func IsSystemFolder(name string) bool { return systemFolders[name] }

// Index is the SQLite index beside one callsign's mailbox directory.
type Index struct {
	mboxPath string
	db       *sql.DB
	mu       sync.Mutex // serializes reconcile and mutations

	// dbMu guards the db handle itself. ensureSchema replaces the handle
	// when index.db was deleted; readers that do not hold mu take dbMu.RLock
	// so they never use a handle that is being closed.
	dbMu sync.RWMutex
}

// rlock holds the handle steady for a read that does not take mu.
func (ix *Index) rlock() func() {
	ix.dbMu.RLock()
	return ix.dbMu.RUnlock
}

// Open opens or creates <mboxPath>/index.db and applies the schema.
func Open(mboxPath string) (*Index, error) {
	db, err := openDB(filepath.Join(mboxPath, FileName))
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("mailindex: apply schema: %w", err)
	}
	return &Index{mboxPath: mboxPath, db: db}, nil
}

func openDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)")
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	return db, nil
}

func (ix *Index) Close() error {
	ix.dbMu.Lock()
	defer ix.dbMu.Unlock()
	return ix.db.Close()
}

// Path is the index file's location.
func (ix *Index) Path() string { return filepath.Join(ix.mboxPath, FileName) }

// ensureSchema re-applies the schema; used when a query fails because the
// file was deleted under a running process (Review Focus 5).
//
// A connection keeps a deleted file's inode open, so a missing file means
// the handle is reopened first to create a fresh one on disk.
func (ix *Index) ensureSchema() error {
	if _, err := os.Stat(ix.Path()); errors.Is(err, os.ErrNotExist) {
		ix.dbMu.Lock()
		ix.db.Close()
		db, err := openDB(ix.Path())
		if err != nil {
			ix.dbMu.Unlock()
			return err
		}
		ix.db = db
		ix.dbMu.Unlock()
	}
	_, err := ix.db.Exec(schema)
	return err
}
