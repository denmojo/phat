package web

import (
	"net/http/httptest"
	"testing"
)

// The appearance setting is read on every page load, so a change on the
// settings page applies on the next load without a restart.
func TestUIHandlerReadsAppearancePerRequest(t *testing.T) {
	calls := 0
	h := UIHandler("N0CALL", func() string { calls++; return "dark" })
	for _, p := range []string{"/ui", "/ui/config", "/ui/template"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", p, nil))
		if rec.Code != 200 {
			t.Fatalf("%s: %d", p, rec.Code)
		}
	}
	if calls != 3 {
		t.Fatalf("appearance read %d times for 3 page loads", calls)
	}
}
