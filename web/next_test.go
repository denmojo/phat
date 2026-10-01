package web

import (
	"io/fs"
	"net/http/httptest"
	"regexp"
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
	for _, want := range []string{`data-mycall="N0CALL"`, `data-appearance="dark"`} {
		if !strings.Contains(body, want) {
			t.Errorf("page lacks %s", want)
		}
	}
}

// The new client's scripts and styles carry a content hash in their names,
// so a browser holding an old build always fetches the new files, and every
// file the page names is in the embedded tree.
func TestUINextLoadsHashedAssetsThatExist(t *testing.T) {
	h := UIHandler("N0CALL", func() string { return "dark" })
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/ui/next", nil))
	refs := regexp.MustCompile(`(?:src|href)="/dist/((?:js|css)/[^"]+)"`).FindAllStringSubmatch(rec.Body.String(), -1)
	if len(refs) == 0 {
		t.Fatal("page references no scripts or styles")
	}
	hashed := regexp.MustCompile(`-[A-Za-z0-9_-]{8}\.(js|css)$`)
	for _, m := range refs {
		if !hashed.MatchString(m[1]) {
			t.Errorf("%s has no content hash", m[1])
		}
		if _, err := fs.Stat(embeddedFS, "dist/"+m[1]); err != nil {
			t.Errorf("%s is not embedded: %v", m[1], err)
		}
	}
}

// Pages are never cached, so a reload always sees the newest asset names.
func TestUIPagesAreNotCached(t *testing.T) {
	h := UIHandler("N0CALL", func() string { return "system" })
	for _, p := range []string{"/ui", "/ui/next"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", p, nil))
		if got := rec.Header().Get("Cache-Control"); got != "no-cache" {
			t.Errorf("%s Cache-Control = %q", p, got)
		}
	}
}

// The new settings page is served at /ui/config-next during development,
// and it stays reachable before a callsign is set, like /ui/config.
func TestUIConfigNextServesNewSettingsPage(t *testing.T) {
	for _, call := range []string{"N0CALL", ""} {
		h := UIHandler(call, func() string { return "light" })
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", "/ui/config-next", nil))
		if rec.Code != 200 {
			t.Fatalf("mycall %q: /ui/config-next: %d", call, rec.Code)
		}
		if !strings.Contains(rec.Body.String(), `data-appearance="light"`) {
			t.Errorf("mycall %q: page lacks its template data", call)
		}
	}
}
