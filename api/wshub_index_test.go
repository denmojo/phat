package api

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/la5nta/pat/internal/mailindex"
	"github.com/la5nta/wl2k-go/fbb"
	"github.com/la5nta/wl2k-go/mailbox"
)

// A file dropped into a custom folder while the watcher runs must reach
// the index without any API call.
func TestWatchMBoxReconcilesCustomFolder(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "N0CALL")
	h := mailbox.NewDirHandler(dir, false)
	if err := h.Prepare(); err != nil {
		t.Fatal(err)
	}
	ix, err := mailindex.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer ix.Close()
	if err := ix.CreateFolder("Club"); err != nil {
		t.Fatal(err)
	}

	hub := &WSHub{pool: map[*WSConn]struct{}{}}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go hub.watch(ctx, h, ix)
	time.Sleep(200 * time.Millisecond) // let the watcher register directories

	msg := fbb.NewMessage(fbb.Private, "N0CALL")
	msg.SetSubject("dropped in")
	msg.SetBody("x")
	data, _ := msg.Bytes()
	os.WriteFile(filepath.Join(dir, "Club", msg.MID()+mailbox.Ext), data, 0o644)

	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if r, err := ix.Get(msg.MID()); err == nil && r.Folder == "Club" {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatal("message in custom folder never reached the index")
}

// The index lives in the watched mailbox root; its own writes must not
// wake the watcher, or every reconcile would trigger the next one.
func TestIndexFilesAreNotMailboxEvents(t *testing.T) {
	for _, name := range []string{"index.db", "index.db-wal", "index.db-shm", "index.db-journal"} {
		if !isIndexFile(filepath.Join("/mb/N0CALL", name)) {
			t.Errorf("%s should be ignored", name)
		}
	}
	for _, name := range []string{"in", "Club", "in/ABC.b2f"} {
		if isIndexFile(filepath.Join("/mb/N0CALL", name)) {
			t.Errorf("%s is a mailbox path", name)
		}
	}
}
