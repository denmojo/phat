package api

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestLabelsCRUD(t *testing.T) {
	h, _ := newTestHandler(t)
	rec, body := do(t, h, "POST", "/api/labels", map[string]string{"name": "ares", "color": "#c00"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST: %d %s", rec.Code, body)
	}
	rec, _ = do(t, h, "POST", "/api/labels", map[string]string{"name": "ares"})
	if rec.Code != http.StatusConflict {
		t.Fatalf("duplicate: %d", rec.Code)
	}
	rec, _ = do(t, h, "PATCH", "/api/labels/ares", map[string]string{"name": "ARES", "color": "#0c0"})
	if rec.Code != 200 {
		t.Fatalf("PATCH: %d", rec.Code)
	}
	rec, body = do(t, h, "GET", "/api/labels", nil)
	var ls []struct {
		Name, Color string
		Count       int
	}
	json.Unmarshal(body, &ls)
	if len(ls) != 1 || ls[0].Name != "ARES" || ls[0].Color != "#0c0" {
		t.Fatalf("labels: %+v", ls)
	}
	rec, _ = do(t, h, "DELETE", "/api/labels/ARES", nil)
	if rec.Code != 200 {
		t.Fatalf("DELETE: %d", rec.Code)
	}
	rec, _ = do(t, h, "DELETE", "/api/labels/ARES", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("second delete: %d", rec.Code)
	}
}

// A label name with a space or a slash travels percent-encoded in the path
// and must reach the index intact.
func TestLabelNameWithSpaceAndSlashInPath(t *testing.T) {
	h, _ := newTestHandler(t)
	rec, body := do(t, h, "POST", "/api/labels", map[string]string{"name": "net a/b"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST: %d %s", rec.Code, body)
	}
	rec, body = do(t, h, "PATCH", "/api/labels/net%20a%2Fb", map[string]string{"color": "#00f"})
	if rec.Code != 200 {
		t.Fatalf("PATCH encoded name: %d %s", rec.Code, body)
	}
	rec, _ = do(t, h, "DELETE", "/api/labels/net%20a%2Fb", nil)
	if rec.Code != 200 {
		t.Fatalf("DELETE encoded name: %d", rec.Code)
	}
}
