package web

import (
	"io/fs"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
)

var pages = []string{"/ui", "/ui/config", "/ui/template"}

// Each page is the Vite build's: an app root, template placeholders filled.
func TestUIPagesServeTheNewClient(t *testing.T) {
	h := UIHandler("N0CALL", func() string { return "dark" })
	for _, p := range pages {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", p, nil))
		if rec.Code != 200 {
			t.Fatalf("%s: %d", p, rec.Code)
		}
		body := rec.Body.String()
		for _, want := range []string{`<div id="app">`, `data-mycall="N0CALL"`, `data-appearance="dark"`} {
			if !strings.Contains(body, want) {
				t.Errorf("%s lacks %s", p, want)
			}
		}
	}
}

// The pages' scripts and styles carry a content hash in their names, so a
// browser holding an old build always fetches the new files, and every
// file a page names is in the embedded tree.
func TestUIPagesLoadHashedAssetsThatExist(t *testing.T) {
	h := UIHandler("N0CALL", func() string { return "dark" })
	hashed := regexp.MustCompile(`-[A-Za-z0-9_-]{8}\.(js|css)$`)
	for _, p := range pages {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", p, nil))
		refs := regexp.MustCompile(`(?:src|href)="/dist/((?:js|css)/[^"]+)"`).FindAllStringSubmatch(rec.Body.String(), -1)
		if len(refs) == 0 {
			t.Fatalf("%s references no scripts or styles", p)
		}
		for _, m := range refs {
			if !hashed.MatchString(m[1]) {
				t.Errorf("%s: %s has no content hash", p, m[1])
			}
			if _, err := fs.Stat(embeddedFS, "dist/"+m[1]); err != nil {
				t.Errorf("%s: %s is not embedded: %v", p, m[1], err)
			}
		}
	}
}

// Pages are never cached, so a reload always sees the newest asset names.
func TestUIPagesAreNotCached(t *testing.T) {
	h := UIHandler("N0CALL", func() string { return "system" })
	for _, p := range pages {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", p, nil))
		if got := rec.Header().Get("Cache-Control"); got != "no-cache" {
			t.Errorf("%s Cache-Control = %q", p, got)
		}
	}
}

// The development routes for the new pages are gone after the swap.
func TestUINextRoutesAreGone(t *testing.T) {
	h := UIHandler("N0CALL", func() string { return "system" })
	for _, p := range []string{"/ui/next", "/ui/config-next", "/ui/template-next"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", p, nil))
		if rec.Code != 404 {
			t.Errorf("%s: %d, want 404", p, rec.Code)
		}
	}
}

// Without a callsign every page but settings sends you to settings.
func TestUIWithoutCallsignGoesToSettings(t *testing.T) {
	h := UIHandler("", func() string { return "system" })
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/ui", nil))
	if rec.Code != 302 || rec.Header().Get("Location") != "/ui/config" {
		t.Errorf("/ui: %d to %q", rec.Code, rec.Header().Get("Location"))
	}
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/ui/config", nil))
	if rec.Code != 200 {
		t.Errorf("/ui/config: %d", rec.Code)
	}
}

// The webpack build's files are not shipped.
func TestOldClientIsNotEmbedded(t *testing.T) {
	for _, f := range []string{"dist/js/app.js", "dist/js/config.js", "dist/js/template.js", "dist/css/style.css", "dist/fonts"} {
		if _, err := fs.Stat(embeddedFS, f); err == nil {
			t.Errorf("%s is still embedded", f)
		}
	}
}
