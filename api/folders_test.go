package api

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestFoldersListCreateRenameDelete(t *testing.T) {
	h, dir := newTestHandler(t)
	seedMsg(t, h, dir, "in", "one")

	rec, body := do(t, h, "GET", "/api/folders", nil)
	if rec.Code != 200 {
		t.Fatalf("GET: %d %s", rec.Code, body)
	}
	var folders []struct {
		Name   string `json:"name"`
		System bool   `json:"system"`
		Count  int    `json:"count"`
		Unread int    `json:"unread"`
	}
	json.Unmarshal(body, &folders)
	if len(folders) != 4 || folders[0].Name != "in" || !folders[0].System || folders[0].Count != 1 {
		t.Fatalf("folders: %+v", folders)
	}

	rec, body = do(t, h, "POST", "/api/folders", map[string]string{"name": "Radio Club"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("POST: %d %s", rec.Code, body)
	}
	rec, _ = do(t, h, "POST", "/api/folders", map[string]string{"name": "radio club"})
	if rec.Code != http.StatusConflict {
		t.Fatalf("case-insensitive duplicate: %d", rec.Code)
	}
	rec, _ = do(t, h, "POST", "/api/folders", map[string]string{"name": "../etc"})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid name: %d", rec.Code)
	}
	rec, _ = do(t, h, "PATCH", "/api/folders/Radio%20Club", map[string]string{"name": "Club"})
	if rec.Code != 200 {
		t.Fatalf("PATCH: %d", rec.Code)
	}
	rec, _ = do(t, h, "DELETE", "/api/folders/in", nil)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("delete system folder: %d", rec.Code)
	}
	rec, _ = do(t, h, "DELETE", "/api/folders/Club", nil)
	if rec.Code != 200 {
		t.Fatalf("DELETE: %d", rec.Code)
	}
	rec, _ = do(t, h, "DELETE", "/api/folders/Club", nil)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("second delete: %d", rec.Code)
	}
}

func TestDeleteFolderRefusesWhenNotEmpty(t *testing.T) {
	h, dir := newTestHandler(t)
	do(t, h, "POST", "/api/folders", map[string]string{"name": "Full"})
	seedMsg(t, h, dir, "Full", "occupant")
	rec, _ := do(t, h, "DELETE", "/api/folders/Full", nil)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", rec.Code)
	}
}
