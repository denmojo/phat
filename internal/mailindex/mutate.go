package mailindex

import (
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/la5nta/wl2k-go/mailbox"
)

var (
	ErrNotFound          = errors.New("mailindex: not found")
	ErrInvalidFolderName = errors.New("mailindex: invalid folder name")
	ErrFolderExists      = errors.New("mailindex: folder exists")
	ErrFolderNotEmpty    = errors.New("mailindex: folder not empty")
	ErrSystemFolder      = errors.New("mailindex: system folder")
	ErrDestinationExists = errors.New("mailindex: destination already holds this message")
)

var folderNameRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9 _-]{0,31}$`)

// viewNames are the virtual views the API serves beside folders.
var viewNames = map[string]bool{"all": true, "starred": true}

// ValidFolderName accepts one to thirty-two characters of letters, digits,
// space, underscore and hyphen, not starting with a dot, and rejects a
// system or view name in any case.
func ValidFolderName(name string) bool {
	if !folderNameRe.MatchString(name) {
		return false
	}
	lower := strings.ToLower(name)
	return !IsSystemFolder(lower) && !viewNames[lower]
}

// filePath locates a message's file from its row.
func (ix *Index) filePath(mid string) (string, string, error) {
	var folder string
	err := ix.db.QueryRow(`SELECT folder FROM messages WHERE mid=?`, mid).Scan(&folder)
	if err != nil {
		return "", "", ErrNotFound
	}
	return folder, filepath.Join(ix.FolderDir(folder), mid+mailbox.Ext), nil
}

// existingFolder returns the on-disk name of a folder matched without
// regard to case, or "" when none exists.
func (ix *Index) existingFolder(name string) string {
	folders, err := ix.Folders()
	if err != nil {
		return ""
	}
	for _, f := range folders {
		if strings.EqualFold(f, name) {
			return f
		}
	}
	return ""
}

// Move renames the message's file into folder to, then updates the row.
func (ix *Index) Move(mid, to string) error {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	target := ix.existingFolder(to)
	if target == "" {
		return ErrNotFound
	}
	from, src, err := ix.filePath(mid)
	if err != nil {
		return err
	}
	if from == target {
		return nil
	}
	dst := filepath.Join(ix.FolderDir(target), mid+mailbox.Ext)
	if _, err := os.Stat(dst); err == nil {
		return ErrDestinationExists
	}
	if err := os.Rename(src, dst); err != nil {
		if os.IsNotExist(err) {
			// The walk owns row deletion; a vanished file is settled there.
			return ErrNotFound
		}
		return err
	}
	info, err := os.Stat(dst)
	if err != nil {
		return err
	}
	_, err = ix.db.Exec(`UPDATE messages SET folder=?, file_mtime=?, file_size=? WHERE mid=?`,
		target, info.ModTime().UnixNano(), info.Size(), mid)
	return err
}

// Delete removes the file and every row about it.
func (ix *Index) Delete(mid string) error {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	_, p, err := ix.filePath(mid)
	if err != nil {
		return err
	}
	if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
		return err
	}
	return ix.deleteRow(mid)
}

// SetUnread rewrites the X-Unread header in the file, then the row.
func (ix *Index) SetUnread(mid string, unread bool) error {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	folder, p, err := ix.filePath(mid)
	if err != nil {
		return err
	}
	msg, err := mailbox.OpenMessage(p)
	if err != nil {
		return err
	}
	if err := mailbox.SetUnread(msg, unread); err != nil {
		return err
	}
	info, err := os.Stat(p)
	if err != nil {
		return err
	}
	return ix.upsertFromFile(folder, p, info)
}

// SetStarred sets the star on each MID. Unknown MIDs are ignored.
func (ix *Index) SetStarred(mids []string, starred bool) error {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	tx, err := ix.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	now := time.Now().Unix()
	for _, mid := range mids {
		if _, err := tx.Exec(`INSERT INTO flags(mid, starred, starred_at) VALUES (?,?,?)
			ON CONFLICT(mid) DO UPDATE SET starred=excluded.starred, starred_at=excluded.starred_at`,
			mid, b2i(starred), now); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// AddLabels attaches labels to each MID, creating label rows as needed.
func (ix *Index) AddLabels(mids []string, labels []string) error {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	tx, err := ix.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, l := range labels {
		l = strings.TrimSpace(l)
		if l == "" {
			continue
		}
		if _, err := tx.Exec(`INSERT OR IGNORE INTO labels(name) VALUES (?)`, l); err != nil {
			return err
		}
		for _, mid := range mids {
			if _, err := tx.Exec(`INSERT OR IGNORE INTO message_labels(mid, label) VALUES (?,?)`, mid, l); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}

// RemoveLabels detaches labels from each MID; the label rows stay.
func (ix *Index) RemoveLabels(mids []string, labels []string) error {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	tx, err := ix.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, l := range labels {
		for _, mid := range mids {
			if _, err := tx.Exec(`DELETE FROM message_labels WHERE mid=? AND label=?`, mid, l); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}

// Label is one label and how many messages carry it.
type Label struct {
	Name  string `json:"name"`
	Color string `json:"color"`
	Count int    `json:"count"`
}

func (ix *Index) Labels() ([]Label, error) {
	defer ix.rlock()()
	rows, err := ix.db.Query(`SELECT l.name, l.color,
		(SELECT COUNT(*) FROM message_labels ml WHERE ml.label=l.name)
		FROM labels l ORDER BY l.position, l.name COLLATE NOCASE`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Label
	for rows.Next() {
		var l Label
		if err := rows.Scan(&l.Name, &l.Color, &l.Count); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func (ix *Index) CreateLabel(name, color string) error {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	name = strings.TrimSpace(name)
	if name == "" {
		return ErrNotFound
	}
	_, err := ix.db.Exec(`INSERT INTO labels(name, color) VALUES (?,?)`, name, color)
	return err
}

func (ix *Index) SetLabelColor(name, color string) error {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	res, err := ix.db.Exec(`UPDATE labels SET color=? WHERE name=?`, color, name)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// RenameLabel renames the label and follows it onto every message.
func (ix *Index) RenameLabel(old, new string) error {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	new = strings.TrimSpace(new)
	if new == "" {
		return ErrNotFound
	}
	tx, err := ix.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	res, err := tx.Exec(`UPDATE labels SET name=? WHERE name=?`, new, old)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	if _, err := tx.Exec(`UPDATE message_labels SET label=? WHERE label=?`, new, old); err != nil {
		return err
	}
	return tx.Commit()
}

// DeleteLabel removes the label from every message and drops it.
func (ix *Index) DeleteLabel(name string) error {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	tx, err := ix.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM message_labels WHERE label=?`, name); err != nil {
		return err
	}
	res, err := tx.Exec(`DELETE FROM labels WHERE name=?`, name)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return tx.Commit()
}

// CreateFolder makes the directory. The name must be valid and unused in
// any case.
func (ix *Index) CreateFolder(name string) error {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	if !ValidFolderName(name) {
		return ErrInvalidFolderName
	}
	if ix.existingFolder(name) != "" {
		return ErrFolderExists
	}
	return os.Mkdir(ix.FolderDir(name), 0o755)
}

// RenameFolder renames the directory and re-points every row in it.
func (ix *Index) RenameFolder(old, new string) error {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	if IsSystemFolder(strings.ToLower(old)) {
		return ErrSystemFolder
	}
	if !ValidFolderName(new) {
		return ErrInvalidFolderName
	}
	cur := ix.existingFolder(old)
	if cur == "" {
		return ErrNotFound
	}
	if other := ix.existingFolder(new); other != "" && other != cur {
		return ErrFolderExists
	}
	if err := os.Rename(ix.FolderDir(cur), ix.FolderDir(new)); err != nil {
		return err
	}
	_, err := ix.db.Exec(`UPDATE messages SET folder=? WHERE folder=?`, new, cur)
	return err
}

// DeleteFolder removes an empty custom folder directory.
func (ix *Index) DeleteFolder(name string) error {
	ix.mu.Lock()
	defer ix.mu.Unlock()
	if IsSystemFolder(strings.ToLower(name)) {
		return ErrSystemFolder
	}
	cur := ix.existingFolder(name)
	if cur == "" {
		return ErrNotFound
	}
	entries, err := os.ReadDir(ix.FolderDir(cur))
	if err != nil {
		return err
	}
	for _, e := range entries {
		if strings.EqualFold(filepath.Ext(e.Name()), mailbox.Ext) {
			return ErrFolderNotEmpty
		}
	}
	// os.Remove only deletes an empty directory, so nothing the check above
	// did not look at (a subdirectory, a stray file) is ever removed.
	if err := os.Remove(ix.FolderDir(cur)); err != nil {
		if _, statErr := os.Stat(ix.FolderDir(cur)); statErr == nil {
			return ErrFolderNotEmpty
		}
		return err
	}
	_, err = ix.db.Exec(`DELETE FROM messages WHERE folder=?`, cur)
	return err
}
