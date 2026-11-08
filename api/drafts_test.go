package api

import (
	"bytes"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/la5nta/wl2k-go/mailbox"
)

func postForm(t *testing.T, h *Handler, path string, fields map[string]string, files map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	for k, v := range fields {
		_ = mw.WriteField(k, v)
	}
	for name, content := range files {
		fw, _ := mw.CreateFormFile("files", name)
		_, _ = fw.Write([]byte(content))
	}
	mw.Close()
	req := httptest.NewRequest("POST", path, &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func draftFiles(t *testing.T, dir string) []string {
	t.Helper()
	entries, err := os.ReadDir(filepath.Join(dir, "drafts"))
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for _, e := range entries {
		out = append(out, e.Name())
	}
	return out
}

// A draft is unfinished by definition: no recipient, no subject and no body
// are all fine, and it lands in drafts, never in the Outbox.
func TestSaveDraftNeedsNothing(t *testing.T) {
	h, dir := newTestHandler(t)
	rec := postForm(t, h, "/api/mailbox/drafts", map[string]string{"date": "2026-11-08T19:00:00Z"}, nil)
	if rec.Code != 201 {
		t.Fatalf("%d %s", rec.Code, rec.Body.String())
	}
	if got := draftFiles(t, dir); len(got) != 1 {
		t.Fatalf("drafts holds %v", got)
	}
	if out, _ := os.ReadDir(filepath.Join(dir, "out")); len(out) != 0 {
		t.Fatalf("a draft reached the Outbox: %v", out)
	}
}

// What the composer held comes back from the saved file: recipients,
// subject, body, attachments and P2P only. The row is indexed at once, so
// the list the client fetches next already shows it.
func TestSaveDraftKeepsEverything(t *testing.T) {
	h, dir := newTestHandler(t)
	rec := postForm(t, h, "/api/mailbox/drafts", map[string]string{
		"to": "EOC-1, N8CALL", "cc": "CLUB", "subject": "Net report", "body": "Line one\nLine two",
		"p2ponly": "on", "date": "2026-11-08T19:00:00Z",
	}, map[string]string{"notes.txt": "attached text"})
	if rec.Code != 201 {
		t.Fatalf("%d %s", rec.Code, rec.Body.String())
	}
	files := draftFiles(t, dir)
	if len(files) != 1 {
		t.Fatalf("drafts holds %v", files)
	}
	msg, err := mailbox.OpenMessage(filepath.Join(dir, "drafts", files[0]))
	if err != nil {
		t.Fatal(err)
	}
	if len(msg.To()) != 2 || len(msg.Cc()) != 1 || msg.Subject() != "Net report" {
		t.Fatalf("to %v cc %v subject %q", msg.To(), msg.Cc(), msg.Subject())
	}
	if body, _ := msg.Body(); !strings.Contains(body, "Line two") {
		t.Fatalf("body %q", body)
	}
	if msg.Header.Get("X-P2POnly") != "true" {
		t.Fatal("P2P only lost")
	}
	if len(msg.Files()) != 1 || msg.Files()[0].Name() != "notes.txt" {
		t.Fatalf("files %v", msg.Files())
	}
	if mailbox.IsUnread(msg) {
		t.Fatal("a draft should not read as unread mail")
	}
	row, err := h.Index().Get(msg.MID())
	if err != nil || row.Folder != "drafts" {
		t.Fatalf("row %+v err %v", row, err)
	}
}

// The Outbox keeps its validation: the CMS refuses a message with no
// recipient, so the drafts route must not loosen the send route.
func TestOutboxStillValidates(t *testing.T) {
	h, _ := newTestHandler(t)
	rec := postForm(t, h, "/api/mailbox/out", map[string]string{"subject": "x", "body": "y", "date": "2026-11-08T19:00:00Z"}, nil)
	if rec.Code != 400 {
		t.Fatalf("want 400 for no recipient, got %d %s", rec.Code, rec.Body.String())
	}
}

func TestPostToOtherFoldersIsRefused(t *testing.T) {
	h, _ := newTestHandler(t)
	rec := postForm(t, h, "/api/mailbox/sent", map[string]string{"to": "EOC-1", "date": "2026-11-08T19:00:00Z"}, nil)
	if rec.Code != 501 {
		t.Fatalf("want 501, got %d", rec.Code)
	}
}
