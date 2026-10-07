package web

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDistHandler(t *testing.T) {
	tests := []struct {
		name       string
		path       string
		wantStatus int
	}{
		{
			name:       "valid asset",
			path:       "/dist/static/phat_logo.png",
			wantStatus: http.StatusOK,
		},
		{
			name:       "non-existent asset",
			path:       "/dist/foobar",
			wantStatus: http.StatusNotFound,
		},
	}
	handler := DistHandler()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", rec.Code, tt.wantStatus)
			}
		})
	}
}

func TestUIHandler(t *testing.T) {
	tests := []struct {
		name       string
		path       string
		wantStatus int
	}{
		{
			name:       "main UI",
			path:       "/ui",
			wantStatus: http.StatusOK,
		},
		{
			name:       "config UI",
			path:       "/ui/config",
			wantStatus: http.StatusOK,
		},
		{
			name:       "template UI",
			path:       "/ui/template",
			wantStatus: http.StatusOK,
		},
		{
			name:       "non-existent UI page",
			path:       "/ui/foobar",
			wantStatus: http.StatusNotFound,
		},
	}
	handler := UIHandler("N0CALL", func() string { return "system" })
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tt.path, nil)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", rec.Code, tt.wantStatus)
			}
		})
	}
}
