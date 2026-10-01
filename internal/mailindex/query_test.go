package mailindex

import (
	"sync"
	"testing"
)

func TestListByFolderLabelStarredAndAll(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "Alpha", "x", true)
	b := writeMsg(t, mb, "in", "Bravo", "x", false)
	c := writeMsg(t, mb, "archive", "Charlie", "x", false)
	ix := openReconciled(t, mb)
	ix.SetStarred([]string{b, c}, true)
	ix.AddLabels([]string{a, c}, []string{"net"})

	rows, err := ix.List(Query{Folder: "in"})
	if err != nil || len(rows) != 2 {
		t.Fatalf("in: %v %d", err, len(rows))
	}
	rows, _ = ix.List(Query{Folder: "all", Label: "net"})
	if len(rows) != 2 {
		t.Fatalf("label net across all: %d", len(rows))
	}
	rows, _ = ix.List(Query{Folder: "all", Starred: true})
	if len(rows) != 2 {
		t.Fatalf("starred: %d", len(rows))
	}
	rows, _ = ix.List(Query{Folder: "in", Starred: true})
	if len(rows) != 1 || rows[0].MID != b {
		t.Fatalf("starred in inbox: %+v", rows)
	}
	counts, _ := ix.FolderCounts()
	if counts["in"].Total != 2 || counts["in"].Unread != 1 || counts["archive"].Total != 1 {
		t.Fatalf("counts %+v", counts)
	}
}

func TestListIsNewestFirst(t *testing.T) {
	mb := newMailbox(t)
	first := writeMsg(t, mb, "in", "First", "x", false)
	second := writeMsg(t, mb, "in", "Second", "x", false)
	ix := openReconciled(t, mb)
	ix.db.Exec(`UPDATE messages SET date=100 WHERE mid=?`, first)
	ix.db.Exec(`UPDATE messages SET date=200 WHERE mid=?`, second)
	rows, _ := ix.List(Query{Folder: "in"})
	if rows[0].MID != second {
		t.Fatal("newest first expected")
	}
}

func TestSearchMatchesBodyAndSubject(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "Generator status", "diesel for the genset at the fairgrounds", false)
	writeMsg(t, mb, "in", "Unrelated", "nothing here", false)
	ix := openReconciled(t, mb)
	rows, err := ix.Search("fairgrounds", 10)
	if err != nil || len(rows) != 1 || rows[0].MID != a {
		t.Fatalf("body search: %v %+v", err, rows)
	}
	rows, _ = ix.Search("generator", 10)
	if len(rows) != 1 {
		t.Fatalf("subject search: %+v", rows)
	}
	rows, _ = ix.Search(`"nothing here"`, 10)
	if len(rows) != 1 {
		t.Fatalf("phrase search: %+v", rows)
	}
	if _, err := ix.Search("bad AND", 10); err == nil {
		t.Log("FTS syntax errors should surface as an error or empty result, never a panic")
	}
}

// Search results come back best match first, not in table order.
func TestSearchIsRankedByRelevance(t *testing.T) {
	mb := newMailbox(t)
	weak := writeMsg(t, mb, "in", "Weekly net", "the repeater was busy and then the net ran long with many check-ins from all over the county", false)
	strong := writeMsg(t, mb, "in", "Repeater repeater", "repeater repeater repeater", false)
	ix := openReconciled(t, mb)
	// Make table order the opposite of relevance order.
	ix.db.Exec(`UPDATE messages SET date=200 WHERE mid=?`, weak)
	ix.db.Exec(`UPDATE messages SET date=100 WHERE mid=?`, strong)
	rows, err := ix.Search("repeater", 10)
	if err != nil || len(rows) != 2 {
		t.Fatalf("search: %v %+v", err, rows)
	}
	if rows[0].MID != strong {
		t.Fatalf("best match must come first, got %s then %s", rows[0].Subject, rows[1].Subject)
	}
}

// Reads run while a reconcile replaces a deleted index file; run with -race.
func TestReadsDuringIndexRecreationDoNotRace(t *testing.T) {
	mb := newMailbox(t)
	writeMsg(t, mb, "in", "Race", "x", false)
	ix := openReconciled(t, mb)
	var wg sync.WaitGroup
	stop := make(chan struct{})
	started := make(chan struct{})
	var readErr error
	wg.Add(1)
	go func() {
		defer wg.Done()
		close(started)
		for {
			select {
			case <-stop:
				return
			default:
				if _, err := ix.List(Query{Folder: "in"}); err != nil && readErr == nil {
					readErr = err
				}
				if _, err := ix.Labels(); err != nil && readErr == nil {
					readErr = err
				}
			}
		}
	}()
	defer func() {
		if readErr != nil {
			t.Errorf("a read failed while the index was recreated: %v", readErr)
		}
	}()
	<-started
	for i := 0; i < 20; i++ {
		removeIndexFiles(ix)
		if _, err := ix.Reconcile(); err != nil {
			close(stop)
			wg.Wait()
			t.Fatal(err)
		}
	}
	close(stop)
	wg.Wait()
}
