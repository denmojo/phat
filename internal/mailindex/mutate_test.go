package mailindex

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/la5nta/wl2k-go/mailbox"
)

func openReconciled(t *testing.T, mb string) *Index {
	t.Helper()
	ix, err := Open(mb)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ix.Close() })
	if _, err := ix.Reconcile(); err != nil {
		t.Fatal(err)
	}
	return ix
}

func TestMoveRenamesFileAndUpdatesRow(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "Move me", "x", true)
	ix := openReconciled(t, mb)
	if err := ix.CreateFolder("Radio"); err != nil {
		t.Fatal(err)
	}
	if err := ix.Move(a, "Radio"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(mb, "Radio", a+mailbox.Ext)); err != nil {
		t.Fatal("file not moved")
	}
	if countRows(t, ix, "mid=? AND folder='Radio'", a) != 1 {
		t.Fatal("row not updated")
	}
	if err := ix.Move("NOPE", "in"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing MID should be ErrNotFound, got %v", err)
	}
	if err := ix.Move(a, "Missing"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing folder should be ErrNotFound, got %v", err)
	}
}

func TestStarAndLabelsSurviveMoveAndDieWithDelete(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "Flagged", "x", false)
	ix := openReconciled(t, mb)
	if err := ix.SetStarred([]string{a}, true); err != nil {
		t.Fatal(err)
	}
	if err := ix.AddLabels([]string{a}, []string{"ares", "urgent"}); err != nil {
		t.Fatal(err)
	}
	if err := ix.Move(a, "archive"); err != nil {
		t.Fatal(err)
	}
	r, err := ix.Get(a)
	if err != nil {
		t.Fatal(err)
	}
	if !r.Starred || len(r.Labels) != 2 || r.Folder != "archive" {
		t.Fatalf("after move: %+v", r)
	}
	if err := ix.Delete(a); err != nil {
		t.Fatal(err)
	}
	var n int
	ix.db.QueryRow(`SELECT COUNT(*) FROM flags WHERE mid=?`, a).Scan(&n)
	if n != 0 {
		t.Error("flags row survived delete")
	}
	ix.db.QueryRow(`SELECT COUNT(*) FROM message_labels WHERE mid=?`, a).Scan(&n)
	if n != 0 {
		t.Error("label rows survived delete")
	}
	if _, err := os.Stat(filepath.Join(mb, "archive", a+mailbox.Ext)); !os.IsNotExist(err) {
		t.Error("file survived delete")
	}
}

func TestSetUnreadRewritesHeader(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "Read me", "x", true)
	ix := openReconciled(t, mb)
	if err := ix.SetUnread(a, false); err != nil {
		t.Fatal(err)
	}
	msg, _ := mailbox.OpenMessage(filepath.Join(mb, "in", a+mailbox.Ext))
	if mailbox.IsUnread(msg) {
		t.Fatal("file still says unread")
	}
	if countRows(t, ix, "mid=? AND unread=0", a) != 1 {
		t.Fatal("row still says unread")
	}
}

func TestFolderLifecycle(t *testing.T) {
	mb := newMailbox(t)
	ix := openReconciled(t, mb)
	for _, bad := range []string{"", ".hidden", "in", "Archive", "a/b", "way too long a folder name for the limit yes"} {
		if err := ix.CreateFolder(bad); err == nil {
			t.Errorf("CreateFolder(%q) should fail", bad)
		}
	}
	if err := ix.CreateFolder("Radio Club"); err != nil {
		t.Fatal(err)
	}
	if err := ix.CreateFolder("radio club"); !errors.Is(err, ErrFolderExists) {
		t.Fatalf("case-insensitive duplicate should be ErrFolderExists, got %v", err)
	}
	a := writeMsg(t, mb, "Radio Club", "In custom", "x", false)
	ix.Reconcile()
	if err := ix.DeleteFolder("Radio Club"); !errors.Is(err, ErrFolderNotEmpty) {
		t.Fatalf("non-empty delete should be ErrFolderNotEmpty, got %v", err)
	}
	if err := ix.RenameFolder("Radio Club", "Club"); err != nil {
		t.Fatal(err)
	}
	if countRows(t, ix, "mid=? AND folder='Club'", a) != 1 {
		t.Fatal("rows not re-pointed after rename")
	}
	if err := ix.DeleteFolder("in"); !errors.Is(err, ErrSystemFolder) {
		t.Fatalf("system delete should be ErrSystemFolder, got %v", err)
	}
	ix.Delete(a)
	if err := ix.DeleteFolder("Club"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(mb, "Club")); !os.IsNotExist(err) {
		t.Fatal("directory survived delete")
	}
}

func TestLabelLifecycle(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "L", "x", false)
	ix := openReconciled(t, mb)
	if err := ix.CreateLabel("ares", "#c00"); err != nil {
		t.Fatal(err)
	}
	if err := ix.AddLabels([]string{a}, []string{"ares", "new-one"}); err != nil {
		t.Fatal(err)
	}
	ls, _ := ix.Labels()
	if len(ls) != 2 {
		t.Fatalf("labels = %+v", ls)
	}
	if err := ix.RenameLabel("ares", "ARES"); err != nil {
		t.Fatal(err)
	}
	r, _ := ix.Get(a)
	if r.Labels[0] != "ARES" && r.Labels[1] != "ARES" {
		t.Fatalf("rename did not follow to messages: %v", r.Labels)
	}
	if err := ix.RemoveLabels([]string{a}, []string{"new-one"}); err != nil {
		t.Fatal(err)
	}
	if err := ix.DeleteLabel("ARES"); err != nil {
		t.Fatal(err)
	}
	r, _ = ix.Get(a)
	if len(r.Labels) != 0 {
		t.Fatalf("labels after delete: %v", r.Labels)
	}
}
