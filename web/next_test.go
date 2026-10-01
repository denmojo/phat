package web

import (
	"net/http/httptest"
	"strings"
	"testing"
)

// The new mailbox page is served at /ui/next during development, with the
// template placeholders filled.
func TestUINextServesNewMailboxPage(t *testing.T) {
	h := UIHandler("N0CALL", func() string { return "dark" })
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/ui/next", nil))
	if rec.Code != 200 {
		t.Fatalf("/ui/next: %d", rec.Code)
	}
	body := rec.Body.String()
	for _, want := range []string{`data-mycall="N0CALL"`, `data-appearance="dark"`, `/dist/js/mailbox.js`} {
		if !strings.Contains(body, want) {
			t.Errorf("page lacks %s", want)
		}
	}
}
