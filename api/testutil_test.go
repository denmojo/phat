package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/la5nta/pat/app"
	"github.com/la5nta/pat/internal/mailindex"
	"github.com/la5nta/wl2k-go/fbb"
	"github.com/la5nta/wl2k-go/mailbox"
)

// newTestHandler builds a Handler over a temp mailbox with an open,
// reconciled index. It does not start the exchange loop or listeners.
func newTestHandler(t *testing.T) (*Handler, string) {
	t.Helper()
	root := t.TempDir()
	cfgPath := filepath.Join(root, "config.json")
	if err := os.WriteFile(cfgPath, []byte(`{"mycall":"N0CALL","http_addr":"127.0.0.1:0"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	mboxRoot := filepath.Join(root, "mailbox")
	dir := filepath.Join(mboxRoot, "N0CALL")
	dh := mailbox.NewDirHandler(dir, false)
	if err := dh.Prepare(); err != nil {
		t.Fatal(err)
	}
	ix, err := mailindex.Open(dir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ix.Close() })
	a := app.NewForTest(app.Options{MyCall: "N0CALL", MailboxPath: mboxRoot, ConfigPath: cfgPath}, dh, ix)
	h := NewHandler(a)
	return h, dir
}

func seedMsg(t *testing.T, h *Handler, dir, folder, subject string) string {
	t.Helper()
	msg := fbb.NewMessage(fbb.Private, "N0CALL")
	msg.AddTo("K6XYZ")
	msg.SetSubject(subject)
	msg.SetBody("body of " + subject)
	data, _ := msg.Bytes()
	if err := os.WriteFile(filepath.Join(dir, folder, msg.MID()+mailbox.Ext), data, 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := h.Index().Reconcile(); err != nil {
		t.Fatal(err)
	}
	return msg.MID()
}

func do(t *testing.T, h http.Handler, method, path string, body any) (*httptest.ResponseRecorder, []byte) {
	t.Helper()
	var rd io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rd = bytes.NewReader(b)
	}
	req := httptest.NewRequest(method, path, rd)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec, rec.Body.Bytes()
}
