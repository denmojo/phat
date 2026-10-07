package api

import (
	"archive/zip"
	"bytes"
	"io"
	"mime"
	"mime/multipart"
	"net/mail"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/la5nta/wl2k-go/fbb"
	"github.com/la5nta/wl2k-go/mailbox"
)

// seedRich writes a message with a non-ASCII subject, a Cc and an
// attachment, the parts a plain seedMsg leaves out.
func seedRich(t *testing.T, h *Handler, dir string) string {
	t.Helper()
	msg := fbb.NewMessage(fbb.Private, "N0CALL")
	msg.AddTo("N8CALL", "someone@example.com")
	msg.AddCc("W1AW")
	msg.SetSubject("Grüße from the field")
	msg.SetBody("Line one\r\nLine two, café\r\n")
	msg.AddFile(fbb.NewFile("report.txt", []byte("attached text")))
	data, _ := msg.Bytes()
	if err := os.WriteFile(filepath.Join(dir, "in", msg.MID()+mailbox.Ext), data, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := h.Index().Reconcile(); err != nil {
		t.Fatal(err)
	}
	return msg.MID()
}

func dispositionName(t *testing.T, cd string) string {
	t.Helper()
	typ, params, err := mime.ParseMediaType(cd)
	if err != nil || typ != "attachment" {
		t.Fatalf("Content-Disposition %q: %v", cd, err)
	}
	return params["filename"]
}

func TestDownloadB2FIsTheRawFile(t *testing.T) {
	h, dir := newTestHandler(t)
	mid := seedMsg(t, h, dir, "in", "raw")
	want, _ := os.ReadFile(filepath.Join(dir, "in", mid+mailbox.Ext))

	rec, body := do(t, h, "GET", "/api/messages/download?format=b2f&mid="+mid, nil)
	if rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, body)
	}
	if !bytes.Equal(body, want) {
		t.Errorf("body differs from the file on disk")
	}
	if got := dispositionName(t, rec.Header().Get("Content-Disposition")); got != mid+".b2f" {
		t.Errorf("filename %q", got)
	}
}

func TestDownloadEMLCarriesHeadersBodyAndAttachment(t *testing.T) {
	h, dir := newTestHandler(t)
	mid := seedRich(t, h, dir)

	rec, body := do(t, h, "GET", "/api/messages/download?format=eml&mid="+mid, nil)
	if rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, body)
	}
	if got := dispositionName(t, rec.Header().Get("Content-Disposition")); got != mid+".eml" {
		t.Errorf("filename %q", got)
	}
	m, err := mail.ReadMessage(bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	dec := new(mime.WordDecoder)
	if s, _ := dec.DecodeHeader(m.Header.Get("Subject")); s != "Grüße from the field" {
		t.Errorf("Subject %q", s)
	}
	if got := m.Header.Get("From"); got != "N0CALL@winlink.org" {
		t.Errorf("From %q", got)
	}
	if got := m.Header.Get("To"); got != "N8CALL@winlink.org, someone@example.com" {
		t.Errorf("To %q", got)
	}
	if got := m.Header.Get("Cc"); got != "W1AW@winlink.org" {
		t.Errorf("Cc %q", got)
	}
	if got := m.Header.Get("Message-ID"); got != "<"+mid+"@winlink.org>" {
		t.Errorf("Message-ID %q", got)
	}
	if _, err := m.Header.Date(); err != nil {
		t.Errorf("Date: %v", err)
	}

	typ, params, err := mime.ParseMediaType(m.Header.Get("Content-Type"))
	if err != nil || typ != "multipart/mixed" {
		t.Fatalf("Content-Type %q: %v", m.Header.Get("Content-Type"), err)
	}
	mr := multipart.NewReader(m.Body, params["boundary"])
	text, err := mr.NextPart()
	if err != nil {
		t.Fatal(err)
	}
	if ct := text.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/plain") || !strings.Contains(ct, "utf-8") {
		t.Errorf("body part Content-Type %q", ct)
	}
	b, _ := io.ReadAll(text) // multipart decodes quoted-printable itself
	if !strings.Contains(string(b), "Line two, café") {
		t.Errorf("body %q", b)
	}
	att, err := mr.NextPart()
	if err != nil {
		t.Fatal(err)
	}
	if att.FileName() != "report.txt" {
		t.Errorf("attachment name %q", att.FileName())
	}
	if att.Header.Get("Content-Transfer-Encoding") != "base64" {
		t.Errorf("attachment encoding %q", att.Header.Get("Content-Transfer-Encoding"))
	}
}

func TestDownloadEMLWithoutAttachmentsIsSinglePart(t *testing.T) {
	h, dir := newTestHandler(t)
	mid := seedMsg(t, h, dir, "in", "plain")
	_, body := do(t, h, "GET", "/api/messages/download?format=eml&mid="+mid, nil)
	m, err := mail.ReadMessage(bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if ct := m.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/plain") {
		t.Errorf("Content-Type %q", ct)
	}
	b, _ := io.ReadAll(m.Body)
	if !strings.Contains(string(b), "body of plain") {
		t.Errorf("body %q", b)
	}
}

func TestDownloadTXTListsAttachmentNames(t *testing.T) {
	h, dir := newTestHandler(t)
	mid := seedRich(t, h, dir)
	rec, body := do(t, h, "GET", "/api/messages/download?format=txt&mid="+mid, nil)
	if rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, body)
	}
	if got := dispositionName(t, rec.Header().Get("Content-Disposition")); got != mid+".txt" {
		t.Errorf("filename %q", got)
	}
	s := string(body)
	for _, want := range []string{
		"From: N0CALL\n", "To: N8CALL, someone@example.com\n", "Cc: W1AW\n",
		"Subject: Grüße from the field\n", "Message-ID: " + mid + "\n",
		"Line two, café", "Attachments:\n  report.txt (13 bytes)\n",
	} {
		if !strings.Contains(s, want) {
			t.Errorf("missing %q in\n%s", want, s)
		}
	}
	if strings.Contains(s, "attached text") {
		t.Errorf("attachment contents leaked into the text file")
	}
	if strings.Contains(s, "\r") {
		t.Errorf("carriage returns left in the text file")
	}
}

func TestDownloadSeveralIsOneZip(t *testing.T) {
	h, dir := newTestHandler(t)
	do(t, h, "POST", "/api/folders", map[string]string{"name": "Club"})
	a := seedMsg(t, h, dir, "in", "one")
	b := seedMsg(t, h, dir, "Club", "two")
	rec, body := do(t, h, "GET", "/api/messages/download?format=eml&mid="+a+"&mid="+b, nil)
	if rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, body)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/zip" {
		t.Errorf("Content-Type %q", ct)
	}
	if got := dispositionName(t, rec.Header().Get("Content-Disposition")); got != "messages.zip" {
		t.Errorf("filename %q", got)
	}
	zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		t.Fatal(err)
	}
	names := map[string]bool{}
	for _, f := range zr.File {
		names[f.Name] = true
	}
	if len(names) != 2 || !names[a+".eml"] || !names[b+".eml"] {
		t.Errorf("zip holds %v", names)
	}
}

func TestDownloadRefusesBadRequests(t *testing.T) {
	h, dir := newTestHandler(t)
	mid := seedMsg(t, h, dir, "in", "x")
	for _, c := range []struct {
		query string
		code  int
	}{
		{"format=msg&mid=" + mid, 400},
		{"mid=" + mid, 400},
		{"format=eml", 400},
		{"format=eml&mid=NOSUCHMID", 404},
		{"format=eml&mid=" + mid + "&mid=NOSUCHMID", 404},
		{"format=b2f&mid=..%2Fconfig.json", 404},
	} {
		if rec, body := do(t, h, "GET", "/api/messages/download?"+c.query, nil); rec.Code != c.code {
			t.Errorf("%s: got %d want %d (%s)", c.query, rec.Code, c.code, body)
		}
	}
}
