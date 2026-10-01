package mailindex

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/la5nta/wl2k-go/mailbox"
)

func TestReconcileInitialWalk(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "Alpha", "first body", true)
	b := writeMsg(t, mb, "archive", "Bravo", "second body", false)
	ix, err := Open(mb)
	if err != nil {
		t.Fatal(err)
	}
	defer ix.Close()

	st, err := ix.Reconcile()
	if err != nil {
		t.Fatal(err)
	}
	if st.Added != 2 {
		t.Fatalf("added = %d, want 2", st.Added)
	}
	if countRows(t, ix, "mid=? AND folder='in' AND unread=1 AND subject='Alpha'", a) != 1 {
		t.Error("row for a is wrong")
	}
	if countRows(t, ix, "mid=? AND folder='archive' AND unread=0", b) != 1 {
		t.Error("row for b is wrong")
	}
	var n int
	ix.db.QueryRow(`SELECT COUNT(*) FROM messages_fts WHERE messages_fts MATCH 'second'`).Scan(&n)
	if n != 1 {
		t.Errorf("fts rows matching 'second' = %d, want 1", n)
	}
}

func TestReconcileOutOfBandAddRemove(t *testing.T) {
	mb := newMailbox(t)
	ix, _ := Open(mb)
	defer ix.Close()
	ix.Reconcile()

	a := writeMsg(t, mb, "in", "Added later", "x", true)
	st, _ := ix.Reconcile()
	if st.Added != 1 || countRows(t, ix, "mid=?", a) != 1 {
		t.Fatalf("out-of-band add not indexed: %+v", st)
	}

	os.Remove(filepath.Join(mb, "in", a+mailbox.Ext))
	st, _ = ix.Reconcile()
	if st.Removed != 1 || countRows(t, ix, "mid=?", a) != 0 {
		t.Fatalf("out-of-band remove not applied: %+v", st)
	}
}

func TestReconcileDetectsFolderMoveAndReadToggle(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "Moves", "x", true)
	ix, _ := Open(mb)
	defer ix.Close()
	ix.Reconcile()

	src := filepath.Join(mb, "in", a+mailbox.Ext)
	dst := filepath.Join(mb, "archive", a+mailbox.Ext)
	if err := os.Rename(src, dst); err != nil {
		t.Fatal(err)
	}
	st, _ := ix.Reconcile()
	if st.Updated != 1 || countRows(t, ix, "mid=? AND folder='archive'", a) != 1 {
		t.Fatalf("move not reflected: %+v", st)
	}

	msg, _ := mailbox.OpenMessage(dst)
	if err := mailbox.SetUnread(msg, false); err != nil {
		t.Fatal(err)
	}
	// Force a distinct mtime on filesystems with coarse resolution.
	future := time.Now().Add(2 * time.Second)
	os.Chtimes(dst, future, future)
	st, _ = ix.Reconcile()
	if countRows(t, ix, "mid=? AND unread=0", a) != 1 {
		t.Fatal("read toggle not reflected")
	}
}

func TestReconcileSkipsCorruptFile(t *testing.T) {
	mb := newMailbox(t)
	good := writeMsg(t, mb, "in", "Good", "x", false)
	os.WriteFile(filepath.Join(mb, "in", "BROKEN.b2f"), []byte("not a message"), 0o644)
	ix, _ := Open(mb)
	defer ix.Close()
	st, err := ix.Reconcile()
	if err != nil {
		t.Fatalf("a corrupt file must not abort the walk: %v", err)
	}
	if st.Skipped != 1 || countRows(t, ix, "mid=?", good) != 1 {
		t.Fatalf("stats %+v", st)
	}
}

func TestReconcileDuplicateMIDKeepsNewest(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "Dup", "x", false)
	src := filepath.Join(mb, "in", a+mailbox.Ext)
	dup := filepath.Join(mb, "archive", a+mailbox.Ext)
	b, _ := os.ReadFile(src)
	os.WriteFile(dup, b, 0o644)
	later := time.Now().Add(5 * time.Second)
	os.Chtimes(dup, later, later)
	ix, _ := Open(mb)
	defer ix.Close()
	if _, err := ix.Reconcile(); err != nil {
		t.Fatal(err)
	}
	if countRows(t, ix, "mid=?", a) != 1 || countRows(t, ix, "mid=? AND folder='archive'", a) != 1 {
		t.Fatal("duplicate MID: exactly one row, the newest file, must win")
	}
}

func TestReconcileRecreatesDeletedIndex(t *testing.T) {
	mb := newMailbox(t)
	writeMsg(t, mb, "in", "Survives", "x", false)
	ix, _ := Open(mb)
	defer ix.Close()
	ix.Reconcile()
	os.Remove(ix.Path())
	os.Remove(ix.Path() + "-wal")
	os.Remove(ix.Path() + "-shm")
	st, err := ix.Reconcile()
	if err != nil {
		t.Fatalf("reconcile after index deletion: %v", err)
	}
	if st.Added != 1 {
		t.Fatalf("expected the index to be rebuilt, stats %+v", st)
	}
}

func TestFoldersListsSystemThenCustom(t *testing.T) {
	mb := newMailbox(t)
	os.Mkdir(filepath.Join(mb, "Radio Club"), 0o755)
	os.Mkdir(filepath.Join(mb, "ares"), 0o755)
	os.WriteFile(filepath.Join(mb, "stray.txt"), nil, 0o644)
	ix, _ := Open(mb)
	defer ix.Close()
	got, err := ix.Folders()
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"in", "out", "sent", "archive", "Radio Club", "ares"}
	if len(got) != len(want) {
		t.Fatalf("got %v want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("got %v want %v", got, want)
		}
	}
}
