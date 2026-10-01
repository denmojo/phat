package mailindex

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/la5nta/wl2k-go/mailbox"
)

// A .b2f whose Body header is negative makes wl2k-go panic while parsing.
// The walk must skip it, not crash the process.
func TestReconcileSkipsFileThatPanicsTheParser(t *testing.T) {
	mb := newMailbox(t)
	good := writeMsg(t, mb, "in", "Good", "x", false)
	bad := "Mid: BADBODY\r\nDate: 2026/09/30 10:00\r\nBody: -1\r\n\r\nhello"
	os.WriteFile(filepath.Join(mb, "in", "BADBODY.b2f"), []byte(bad), 0o644)
	ix, _ := Open(mb)
	defer ix.Close()
	st, err := ix.Reconcile()
	if err != nil {
		t.Fatal(err)
	}
	if st.Skipped != 1 || countRows(t, ix, "mid=?", good) != 1 {
		t.Fatalf("stats %+v", st)
	}
}

// A hand copy named differently from its MID ("X copy.b2f") must not take
// over the row for X.
func TestReconcileSkipsFileNamedDifferentlyFromItsMID(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "Original", "x", false)
	b, _ := os.ReadFile(filepath.Join(mb, "in", a+mailbox.Ext))
	os.WriteFile(filepath.Join(mb, "archive", a+" copy.b2f"), b, 0o644)
	ix := openReconciled(t, mb)
	if countRows(t, ix, "mid=? AND folder='in'", a) != 1 {
		t.Fatal("the copy took over the original's row")
	}
}

// When a message's file has vanished, Move reports not-found and leaves the
// row, star and labels for the walk to settle.
func TestMoveKeepsFlagsWhenFileIsMissing(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "Flagged", "x", false)
	ix := openReconciled(t, mb)
	ix.SetStarred([]string{a}, true)
	os.Remove(filepath.Join(mb, "in", a+mailbox.Ext))
	if err := ix.Move(a, "archive"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("got %v", err)
	}
	var n int
	ix.db.QueryRow(`SELECT COUNT(*) FROM flags WHERE mid=? AND starred=1`, a).Scan(&n)
	if n != 1 {
		t.Fatal("Move deleted the star")
	}
}

// Move never overwrites a file already in the destination folder.
func TestMoveRefusesToOverwrite(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "Twin", "x", false)
	ix := openReconciled(t, mb)
	other := []byte("different content")
	os.WriteFile(filepath.Join(mb, "archive", a+mailbox.Ext), other, 0o644)
	if err := ix.Move(a, "archive"); !errors.Is(err, ErrDestinationExists) {
		t.Fatalf("got %v", err)
	}
	got, _ := os.ReadFile(filepath.Join(mb, "archive", a+mailbox.Ext))
	if string(got) != string(other) {
		t.Fatal("destination file was overwritten")
	}
}

// Search takes what a user types: hyphens, plus signs and at-signs are
// words, not FTS5 syntax. Quoted phrases still work.
func TestSearchAcceptsOrdinaryText(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "ICS-213 shelter status", "contact k6rcx@winlink.org about C++ net-control", false)
	ix := openReconciled(t, mb)
	for _, q := range []string{"ICS-213", "net-control", "C++", "k6rcx@winlink.org", "AND", `"shelter status"`, `"unbalanced`} {
		rows, err := ix.Search(q, 10)
		if err != nil {
			t.Errorf("Search(%q): %v", q, err)
			continue
		}
		if q != "AND" && q != `"unbalanced` && (len(rows) != 1 || rows[0].MID != a) {
			t.Errorf("Search(%q) found %d rows", q, len(rows))
		}
	}
}

// DeleteFolder removes only an empty directory; nested content refuses.
func TestDeleteFolderRefusesNestedContent(t *testing.T) {
	mb := newMailbox(t)
	ix := openReconciled(t, mb)
	ix.CreateFolder("Club")
	os.MkdirAll(filepath.Join(mb, "Club", "photos"), 0o755)
	os.WriteFile(filepath.Join(mb, "Club", "photos", "keep.jpg"), []byte("x"), 0o644)
	if err := ix.DeleteFolder("Club"); !errors.Is(err, ErrFolderNotEmpty) {
		t.Fatalf("got %v", err)
	}
	if _, err := os.Stat(filepath.Join(mb, "Club", "photos", "keep.jpg")); err != nil {
		t.Fatal("nested file was deleted")
	}
}

// "all" and "starred" are views, so no folder may take those names.
func TestViewNamesAreNotFolderNames(t *testing.T) {
	for _, n := range []string{"all", "ALL", "starred", "Starred"} {
		if ValidFolderName(n) {
			t.Errorf("%q must not be a valid folder name", n)
		}
	}
}

// A folder that cannot be read keeps its rows, stars and labels.
func TestUnreadableFolderKeepsItsRows(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("root reads any directory")
	}
	mb := newMailbox(t)
	ix := openReconciled(t, mb)
	ix.CreateFolder("Club")
	a := writeMsg(t, mb, "Club", "Locked away", "x", false)
	ix.Reconcile()
	ix.SetStarred([]string{a}, true)
	dir := filepath.Join(mb, "Club")
	os.Chmod(dir, 0o000)
	defer os.Chmod(dir, 0o755)
	if _, err := ix.Reconcile(); err != nil {
		t.Fatal(err)
	}
	var n int
	ix.db.QueryRow(`SELECT COUNT(*) FROM flags WHERE mid=? AND starred=1`, a).Scan(&n)
	if countRows(t, ix, "mid=?", a) != 1 || n != 1 {
		t.Fatal("an unreadable folder lost its rows or stars")
	}
}

// A corrupt index.db is moved aside and rebuilt so Phat still starts.
func TestOpenRebuildsCorruptIndex(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "Survivor", "x", false)
	os.WriteFile(filepath.Join(mb, FileName), []byte("this is not a database at all, not even close"), 0o644)
	ix, err := Open(mb)
	if err != nil {
		t.Fatalf("Open on a corrupt index: %v", err)
	}
	defer ix.Close()
	ix.Reconcile()
	if countRows(t, ix, "mid=?", a) != 1 {
		t.Fatal("index not rebuilt")
	}
	matches, _ := filepath.Glob(filepath.Join(mb, FileName+".corrupt-*"))
	if len(matches) != 1 {
		t.Fatalf("corrupt file not kept aside: %v", matches)
	}
}

// A typed word matches words that start with it, so search-as-you-type
// finds mail mid-word; a quoted phrase stays exact.
func TestSearchMatchesWordPrefixes(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "Generator fuel at the shelter", "Need 5 gallons by 1800", false)
	ix := openReconciled(t, mb)
	for _, q := range []string{"gen", "Gen", "shel", "gen fu", "N0C", "k6x"} {
		rows, err := ix.Search(q, 10)
		if err != nil || len(rows) != 1 || rows[0].MID != a {
			t.Errorf("Search(%q) = %d rows, %v", q, len(rows), err)
		}
	}
	for _, q := range []string{"-", "+", "gen -", "@"} {
		if _, err := ix.Search(q, 10); err != nil {
			t.Errorf("Search(%q): %v", q, err)
		}
	}
	for _, q := range []string{"rator", `"gen"`, "gen zzz"} {
		rows, err := ix.Search(q, 10)
		if err != nil || len(rows) != 0 {
			t.Errorf("Search(%q) = %d rows, %v; want none", q, len(rows), err)
		}
	}
}
