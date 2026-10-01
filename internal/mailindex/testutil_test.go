package mailindex

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/la5nta/wl2k-go/fbb"
	"github.com/la5nta/wl2k-go/mailbox"
)

// newMailbox makes a temp callsign directory with the four system folders
// and returns its path.
func newMailbox(t *testing.T) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "N0CALL")
	h := mailbox.NewDirHandler(dir, false)
	if err := h.Prepare(); err != nil {
		t.Fatal(err)
	}
	return dir
}

// writeMsg writes a .b2f into folder and returns its MID.
func writeMsg(t *testing.T, mboxPath, folder, subject, body string, unread bool) string {
	t.Helper()
	msg := fbb.NewMessage(fbb.Private, "N0CALL")
	msg.AddTo("K6XYZ")
	msg.SetSubject(subject)
	if err := msg.SetBody(body); err != nil {
		t.Fatal(err)
	}
	if unread {
		msg.Header.Set("X-Unread", "true")
	}
	data, err := msg.Bytes()
	if err != nil {
		t.Fatal(err)
	}
	p := filepath.Join(mboxPath, folder, msg.MID()+mailbox.Ext)
	if err := os.WriteFile(p, data, 0o644); err != nil {
		t.Fatal(err)
	}
	return msg.MID()
}

func countRows(t *testing.T, ix *Index, where string, args ...any) int {
	t.Helper()
	var n int
	if err := ix.db.QueryRow(`SELECT COUNT(*) FROM messages WHERE `+where, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}
