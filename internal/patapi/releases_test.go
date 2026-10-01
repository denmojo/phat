package patapi

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func serve(t *testing.T, status int, body string) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/repos/denmojo/pat/releases/latest" {
			t.Errorf("path = %q", r.URL.Path)
		}
		w.WriteHeader(status)
		w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	old := ReleasesBaseURL
	ReleasesBaseURL = srv.URL
	t.Cleanup(func() { ReleasesBaseURL = old })
}

func TestGetLatestVersionReadsGitHubRelease(t *testing.T) {
	serve(t, http.StatusOK, `{"tag_name":"v0.2.0","html_url":"https://github.com/denmojo/pat/releases/tag/v0.2.0"}`)
	r, err := GetLatestVersion(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if r == nil || r.Version != "0.2.0" || r.ReleaseURL != "https://github.com/denmojo/pat/releases/tag/v0.2.0" {
		t.Fatalf("got %+v", r)
	}
}

func TestGetLatestVersionWithNoReleases(t *testing.T) {
	serve(t, http.StatusNotFound, `{"message":"Not Found"}`)
	r, err := GetLatestVersion(context.Background())
	if err != nil || r != nil {
		t.Fatalf("got %+v, %v; want nil, nil", r, err)
	}
}
