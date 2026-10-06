package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// onPatsForms makes the handler see its forms folder as Pat's.
func onPatsForms(t *testing.T) {
	t.Helper()
	old := usesPatsForms
	usesPatsForms = func(string) bool { return true }
	t.Cleanup(func() { usesPatsForms = old })
}

// On Pat's forms folder, Update forms asks Pat to update them and says
// the forms are Pat's.
func TestFormsUpdateGoesThroughPat(t *testing.T) {
	onPatsForms(t)
	var method string
	pat := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/formsUpdate" {
			http.NotFound(w, r)
			return
		}
		method = r.Method
		_, _ = w.Write([]byte(`{"newestVersion":"1.2.3","action":"update"}`))
	}))
	t.Cleanup(pat.Close)
	h, _ := newTestHandler(t)
	r, err := newPatRelay(pat.URL, h.wsHub)
	if err != nil {
		t.Fatal(err)
	}
	h.wsHub.relay = r

	rec, body := do(t, h, "POST", "/api/formsUpdate", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("POST: %d %s", rec.Code, body)
	}
	if method != http.MethodPost {
		t.Errorf("Pat got %q, want POST", method)
	}
	var got struct {
		NewestVersion string `json:"newestVersion"`
		Action        string `json:"action"`
		Owner         string `json:"owner"`
	}
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatal(err)
	}
	if got.NewestVersion != "1.2.3" || got.Action != "update" || got.Owner != "pat" {
		t.Errorf("got %+v", got)
	}
}

func TestFormsUpdateSaysWhenPatIsDown(t *testing.T) {
	onPatsForms(t)
	pat := httptest.NewServer(http.NotFoundHandler())
	url := pat.URL
	pat.Close()
	h, _ := newTestHandler(t)
	r, err := newPatRelay(url, h.wsHub)
	if err != nil {
		t.Fatal(err)
	}
	h.wsHub.relay = r

	rec, body := do(t, h, "POST", "/api/formsUpdate", nil)
	if rec.Code != http.StatusBadGateway || !strings.Contains(string(body), "Start Pat") {
		t.Errorf("got %d %s", rec.Code, body)
	}
}
