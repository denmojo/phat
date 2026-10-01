package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/la5nta/pat/internal/mailindex"
)

type bulkResp struct {
	OK     []string          `json:"ok"`
	Failed map[string]string `json:"failed"`
}

func TestMailboxListsAnyFolderWithFlags(t *testing.T) {
	h, dir := newTestHandler(t)
	do(t, h, "POST", "/api/folders", map[string]string{"name": "Club"})
	a := seedMsg(t, h, dir, "Club", "clubby")
	h.Index().SetStarred([]string{a}, true)
	h.Index().AddLabels([]string{a}, []string{"net"})

	rec, body := do(t, h, "GET", "/api/mailbox/Club", nil)
	if rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, body)
	}
	var rows []mailindex.Row
	json.Unmarshal(body, &rows)
	if len(rows) != 1 || !rows[0].Starred || rows[0].Labels[0] != "net" || rows[0].Folder != "Club" {
		t.Fatalf("rows %+v", rows)
	}
	rec, body = do(t, h, "GET", "/api/mailbox/all?label=net", nil)
	json.Unmarshal(body, &rows)
	if len(rows) != 1 {
		t.Fatalf("label filter across all: %s", body)
	}
	rec, body = do(t, h, "GET", "/api/starred", nil)
	json.Unmarshal(body, &rows)
	if len(rows) != 1 {
		t.Fatalf("starred: %s", body)
	}
	rec, _ = do(t, h, "GET", "/api/mailbox/nope", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("unknown folder: %d", rec.Code)
	}
	// mux redirects a dot-dot path to its cleaned form (301); anything but
	// a success is safe here.
	rec, _ = do(t, h, "GET", "/api/mailbox/..%2F..", nil)
	if rec.Code < 300 {
		t.Fatalf("path escape: %d", rec.Code)
	}
}

func TestBulkMoveReportsPartialFailure(t *testing.T) {
	h, dir := newTestHandler(t)
	a := seedMsg(t, h, dir, "in", "a")
	b := seedMsg(t, h, dir, "in", "b")
	do(t, h, "POST", "/api/folders", map[string]string{"name": "Club"})
	rec, body := do(t, h, "POST", "/api/messages/move", map[string]any{"mids": []string{a, "GHOST", b}, "to": "Club"})
	if rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, body)
	}
	var br bulkResp
	json.Unmarshal(body, &br)
	if len(br.OK) != 2 || br.Failed["GHOST"] == "" {
		t.Fatalf("bulk response %+v", br)
	}
	ra, _ := h.Index().Get(a)
	rb, _ := h.Index().Get(b)
	if ra.Folder != "Club" || rb.Folder != "Club" {
		t.Fatal("the good MIDs must move even when one fails")
	}
	rec, _ = do(t, h, "POST", "/api/messages/move", map[string]any{"mids": []string{"GHOST"}, "to": "Club"})
	if rec.Code != http.StatusNotFound {
		t.Fatalf("all-missing should be 404, got %d", rec.Code)
	}
}

func TestBulkReadStarLabelsDelete(t *testing.T) {
	h, dir := newTestHandler(t)
	a := seedMsg(t, h, dir, "in", "a")
	b := seedMsg(t, h, dir, "in", "b")
	mids := []string{a, b}

	do(t, h, "POST", "/api/messages/read", map[string]any{"mids": mids, "read": false})
	if r, _ := h.Index().Get(a); !r.Unread {
		t.Fatal("read=false should set unread")
	}
	do(t, h, "POST", "/api/messages/star", map[string]any{"mids": mids, "starred": true})
	do(t, h, "POST", "/api/messages/labels", map[string]any{"mids": mids, "add": []string{"x", "y"}})
	do(t, h, "POST", "/api/messages/labels", map[string]any{"mids": mids, "remove": []string{"x"}})
	r, _ := h.Index().Get(b)
	if !r.Starred || len(r.Labels) != 1 || r.Labels[0] != "y" {
		t.Fatalf("after star and labels: %+v", r)
	}
	rec, body := do(t, h, "POST", "/api/messages/delete", map[string]any{"mids": mids})
	if rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, body)
	}
	if _, err := h.Index().Get(a); err == nil {
		t.Fatal("deleted message still in index")
	}
}

func TestSearchEndpoint(t *testing.T) {
	h, dir := newTestHandler(t)
	a := seedMsg(t, h, dir, "in", "Generator fuel")
	seedMsg(t, h, dir, "in", "Meeting minutes")
	rec, body := do(t, h, "GET", "/api/search?q=generator", nil)
	if rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, body)
	}
	var rows []mailindex.Row
	json.Unmarshal(body, &rows)
	if len(rows) != 1 || rows[0].MID != a {
		t.Fatalf("search: %s", body)
	}
	rec, _ = do(t, h, "GET", "/api/search", nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("empty q: %d", rec.Code)
	}
	// Typed text is searched as words: an unbalanced quote and hyphenated
	// terms are ordinary queries, not errors.
	for _, q := range []string{"%22unbalanced", "ICS-213", "net-control"} {
		rec, body = do(t, h, "GET", "/api/search?q="+q, nil)
		if rec.Code != 200 {
			t.Fatalf("q=%s: %d %s", q, rec.Code, body)
		}
	}
}

func TestLegacyEndpointsKeepIndexLevel(t *testing.T) {
	h, dir := newTestHandler(t)
	a := seedMsg(t, h, dir, "in", "legacy")
	rec, _ := do(t, h, "POST", "/api/mailbox/in/"+a+"/read", map[string]bool{"read": true})
	if rec.Code != 200 {
		t.Fatalf("legacy read: %d", rec.Code)
	}
	if r, _ := h.Index().Get(a); r.Unread {
		t.Fatal("legacy read did not update the index")
	}
	rec, _ = do(t, h, "DELETE", "/api/mailbox/in/"+a, nil)
	if rec.Code != 200 {
		t.Fatalf("legacy delete: %d", rec.Code)
	}
	if _, err := h.Index().Get(a); err == nil {
		t.Fatal("legacy delete did not remove the row")
	}
}

// The single-message endpoint carries the index's star and labels so the
// reading pane can show them.
func TestMessageCarriesStarAndLabels(t *testing.T) {
	h, dir := newTestHandler(t)
	a := seedMsg(t, h, dir, "in", "flagged")
	h.Index().SetStarred([]string{a}, true)
	h.Index().AddLabels([]string{a}, []string{"net"})
	rec, body := do(t, h, "GET", "/api/mailbox/in/"+a, nil)
	if rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, body)
	}
	var m struct {
		Starred bool
		Labels  []string
	}
	json.Unmarshal(body, &m)
	if !m.Starred || len(m.Labels) != 1 || m.Labels[0] != "net" {
		t.Fatalf("message JSON: %s", body)
	}
}

// Moving onto a folder that already holds a file with the same MID is a
// conflict, reported per MID, and nothing is overwritten.
func TestBulkMoveConflictIsReported(t *testing.T) {
	h, dir := newTestHandler(t)
	a := seedMsg(t, h, dir, "in", "twin")
	if err := os.WriteFile(filepath.Join(dir, "archive", a+".b2f"), []byte("other"), 0o644); err != nil {
		t.Fatal(err)
	}
	rec, body := do(t, h, "POST", "/api/messages/move", map[string]any{"mids": []string{a}, "to": "archive"})
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d %s", rec.Code, body)
	}
}
