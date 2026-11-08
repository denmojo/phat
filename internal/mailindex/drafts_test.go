package mailindex

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

// Open makes the drafts directory, since wl2k-go's Prepare only knows the
// four folders it writes to, and a missing system folder would log an
// unreadable-folder line on every reconcile.
func TestOpenCreatesDrafts(t *testing.T) {
	mb := newMailbox(t)
	ix, err := Open(mb)
	if err != nil {
		t.Fatal(err)
	}
	defer ix.Close()
	if fi, err := os.Stat(filepath.Join(mb, "drafts")); err != nil || !fi.IsDir() {
		t.Fatalf("drafts directory missing: %v", err)
	}
}

func TestDraftsIsASystemFolder(t *testing.T) {
	if !IsSystemFolder("drafts") {
		t.Fatal("drafts should be a system folder")
	}
	for _, n := range []string{"drafts", "Drafts", "DRAFTS"} {
		if ValidFolderName(n) {
			t.Fatalf("%q must not be accepted as a custom folder name", n)
		}
	}
}

func TestDraftsIsIndexed(t *testing.T) {
	mb := newMailbox(t)
	ix := openReconciled(t, mb)
	a := writeMsg(t, mb, "drafts", "Half written", "so far", false)
	if _, err := ix.Reconcile(); err != nil {
		t.Fatal(err)
	}
	if countRows(t, ix, "mid=? AND folder='drafts'", a) != 1 {
		t.Fatal("draft not indexed")
	}
}

// A draft leaves Drafts only by being sent from the composer or deleted.
// Moving one into the Outbox would queue a message nobody validated, and
// moving mail into Drafts would make a received message editable as if
// it were mine.
func TestMovesIntoOrOutOfDraftsAreRefused(t *testing.T) {
	mb := newMailbox(t)
	ix := openReconciled(t, mb)
	d := writeMsg(t, mb, "drafts", "Draft", "x", false)
	in := writeMsg(t, mb, "in", "Received", "x", false)
	if _, err := ix.Reconcile(); err != nil {
		t.Fatal(err)
	}
	for _, to := range []string{"out", "archive", "in"} {
		if err := ix.Move(d, to); !errors.Is(err, ErrDraftsMove) {
			t.Fatalf("draft to %s: want ErrDraftsMove, got %v", to, err)
		}
	}
	if err := ix.Move(in, "drafts"); !errors.Is(err, ErrDraftsMove) {
		t.Fatalf("inbox to drafts: want ErrDraftsMove, got %v", err)
	}
	if countRows(t, ix, "mid=? AND folder='drafts'", d) != 1 || countRows(t, ix, "mid=? AND folder='in'", in) != 1 {
		t.Fatal("a refused move changed a row")
	}
	if err := ix.Delete(d); err != nil {
		t.Fatalf("deleting a draft: %v", err)
	}
}
