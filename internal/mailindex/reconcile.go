package mailindex

import (
	"errors"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/la5nta/wl2k-go/fbb"
	"github.com/la5nta/wl2k-go/mailbox"
)

// Stats reports what one Reconcile changed.
type Stats struct{ Added, Updated, Removed, Skipped int }

// Folders returns the four system folders in their fixed order, then every
// custom folder directory sorted by name. Only directories count; a stray
// file in the mailbox root is ignored, as is index.db.
func (ix *Index) Folders() ([]string, error) {
	entries, err := os.ReadDir(ix.mboxPath)
	if err != nil {
		return nil, err
	}
	var custom []string
	for _, e := range entries {
		if !e.IsDir() || IsSystemFolder(e.Name()) || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		custom = append(custom, e.Name())
	}
	sort.Strings(custom)
	return append([]string{"in", "out", "sent", "archive"}, custom...), nil
}

// FolderDir is the directory holding a folder's files.
func (ix *Index) FolderDir(name string) string { return filepath.Join(ix.mboxPath, name) }

// Reconcile levels the index with the files. Files decide existence,
// folder and read state. A row whose file is gone is removed with its
// flags and labels. Unchanged files (same mtime and size) are not reparsed.
func (ix *Index) Reconcile() (Stats, error) {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	var st Stats
	if err := ix.ensureSchema(); err != nil {
		return st, err
	}
	folders, err := ix.Folders()
	if err != nil {
		return st, err
	}

	// Snapshot of what the index believes.
	type knownRow struct {
		folder string
		mtime  int64
		size   int64
	}
	known := map[string]knownRow{}
	rows, err := ix.db.Query(`SELECT mid, folder, file_mtime, file_size FROM messages`)
	if err != nil {
		return st, err
	}
	for rows.Next() {
		var mid, folder string
		var mtime, size int64
		if err := rows.Scan(&mid, &folder, &mtime, &size); err != nil {
			rows.Close()
			return st, err
		}
		known[mid] = knownRow{folder, mtime, size}
	}
	rows.Close()

	// Newest file per MID wins when a MID appears in two folders.
	type seen struct {
		path   string
		folder string
		info   fs.FileInfo
	}
	newest := map[string]seen{}
	for _, folder := range folders {
		entries, err := os.ReadDir(ix.FolderDir(folder))
		if err != nil {
			continue
		}
		for _, e := range entries {
			if e.IsDir() || !strings.EqualFold(filepath.Ext(e.Name()), mailbox.Ext) {
				continue
			}
			info, err := e.Info()
			if err != nil {
				continue
			}
			mid := strings.TrimSuffix(e.Name(), filepath.Ext(e.Name()))
			p := filepath.Join(ix.FolderDir(folder), e.Name())
			if prev, ok := newest[mid]; ok {
				log.Printf("mailindex: MID %s exists in %s and %s; indexing the newer file", mid, prev.folder, folder)
				if !info.ModTime().After(prev.info.ModTime()) {
					continue
				}
			}
			newest[mid] = seen{p, folder, info}
		}
	}

	present := map[string]bool{}
	for mid, s := range newest {
		present[mid] = true
		k, ok := known[mid]
		if ok && k.folder == s.folder && k.mtime == s.info.ModTime().UnixNano() && k.size == s.info.Size() {
			continue
		}
		if err := ix.upsertFromFile(s.folder, s.path, s.info); err != nil {
			log.Printf("mailindex: skipping %s: %v", s.path, err)
			st.Skipped++
			continue
		}
		if ok {
			st.Updated++
		} else {
			st.Added++
		}
	}
	for mid := range known {
		if present[mid] {
			continue
		}
		if err := ix.deleteRow(mid); err != nil {
			return st, err
		}
		st.Removed++
	}
	return st, nil
}

// upsertFromFile parses one .b2f and writes its row and FTS entry.
func (ix *Index) upsertFromFile(folder, path string, info fs.FileInfo) error {
	msg, err := mailbox.OpenMessage(path)
	if err != nil {
		return err
	}
	if msg.MID() == "" {
		return errors.New("message has no MID")
	}
	body, _ := msg.Body()
	tx, err := ix.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	_, err = tx.Exec(`INSERT INTO messages
		(mid, folder, from_addr, to_addrs, cc_addrs, subject, date, size, unread, p2p_only, attachments, file_mtime, file_size, indexed_at)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
		ON CONFLICT(mid) DO UPDATE SET
		folder=excluded.folder, from_addr=excluded.from_addr, to_addrs=excluded.to_addrs,
		cc_addrs=excluded.cc_addrs, subject=excluded.subject, date=excluded.date, size=excluded.size,
		unread=excluded.unread, p2p_only=excluded.p2p_only, attachments=excluded.attachments,
		file_mtime=excluded.file_mtime, file_size=excluded.file_size, indexed_at=excluded.indexed_at`,
		msg.MID(), folder, msg.From().String(), joinAddrs(msg.To()), joinAddrs(msg.Cc()),
		msg.Subject(), msg.Date().Unix(), info.Size(), b2i(mailbox.IsUnread(msg)),
		b2i(msg.Header.Get("X-P2POnly") == "true"), len(msg.Files()),
		info.ModTime().UnixNano(), info.Size(), time.Now().Unix())
	if err != nil {
		return err
	}
	if _, err := tx.Exec(`DELETE FROM messages_fts WHERE mid=?`, msg.MID()); err != nil {
		return err
	}
	if _, err := tx.Exec(`INSERT INTO messages_fts(mid, subject, from_addr, to_addrs, body) VALUES (?,?,?,?,?)`,
		msg.MID(), msg.Subject(), msg.From().String(), joinAddrs(msg.To()), body); err != nil {
		return err
	}
	return tx.Commit()
}

// deleteRow removes a message and everything hanging off it.
func (ix *Index) deleteRow(mid string) error {
	tx, err := ix.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, q := range []string{
		`DELETE FROM messages WHERE mid=?`,
		`DELETE FROM messages_fts WHERE mid=?`,
		`DELETE FROM flags WHERE mid=?`,
		`DELETE FROM message_labels WHERE mid=?`,
	} {
		if _, err := tx.Exec(q, mid); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func joinAddrs(as []fbb.Address) string {
	s := make([]string, len(as))
	for i, a := range as {
		s[i] = a.String()
	}
	return strings.Join(s, ", ")
}

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}
