package api

import (
	"bytes"
	"mime/multipart"
	"net/http/httptest"
	"regexp"
	"strconv"
	"testing"
)

// Posting a message reports its size in kB; a message under 1 kB must not
// read as 0.00 kB.
func TestPostOutboundReportsSize(t *testing.T) {
	h, _ := newTestHandler(t)
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	for k, v := range map[string]string{"to": "EOC-1", "subject": "Size check", "body": "Short body.", "date": "2026-09-30T22:00:00Z"} {
		_ = mw.WriteField(k, v)
	}
	mw.Close()
	req := httptest.NewRequest("POST", "/api/mailbox/out", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != 201 {
		t.Fatalf("%d %s", rec.Code, rec.Body.String())
	}
	m := regexp.MustCompile(`^Message posted \((\d+\.\d\d) kB\)$`).FindStringSubmatch(rec.Body.String())
	if m == nil {
		t.Fatalf("response %q", rec.Body.String())
	}
	if kb, _ := strconv.ParseFloat(m[1], 64); kb <= 0 {
		t.Fatalf("size reads %s kB", m[1])
	}
}
