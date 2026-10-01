package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/la5nta/pat/internal/patapi"
)

func TestNewReleaseCheckWithNoPhatRelease(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer srv.Close()
	old := patapi.ReleasesBaseURL
	patapi.ReleasesBaseURL = srv.URL
	defer func() { patapi.ReleasesBaseURL = old }()

	h, _ := newTestHandler(t)
	rec, body := do(t, h, "GET", "/api/new-release-check", nil)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status %d, body %s", rec.Code, body)
	}
}
