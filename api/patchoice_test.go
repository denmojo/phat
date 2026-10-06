package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/la5nta/pat/app"
	"github.com/la5nta/pat/cfg"
)

// fakePatInstall points patDirs at a temp Pat install whose config.json
// holds patCfg, and returns Pat's data folder.
func fakePatInstall(t *testing.T, patCfg string) string {
	t.Helper()
	root := t.TempDir()
	cfgDir, dataDir := filepath.Join(root, "config", "pat"), filepath.Join(root, "data", "pat")
	must := func(err error) {
		if err != nil {
			t.Fatal(err)
		}
	}
	must(os.MkdirAll(cfgDir, 0o755))
	must(os.MkdirAll(dataDir, 0o755))
	if patCfg != "" {
		must(os.WriteFile(filepath.Join(cfgDir, "config.json"), []byte(patCfg), 0o644))
	}
	old := patDirs
	patDirs = func() (string, string) { return cfgDir, dataDir }
	t.Cleanup(func() { patDirs = old })
	return dataDir
}

func askUsePat(t *testing.T, h *Handler) {
	t.Helper()
	c, err := app.LoadConfig(h.Options().ConfigPath, cfg.DefaultConfig)
	if err != nil {
		t.Fatal(err)
	}
	c.AskUsePat = true
	if err := app.WriteConfig(c, h.Options().ConfigPath); err != nil {
		t.Fatal(err)
	}
}

func savedConfig(t *testing.T, h *Handler) cfg.Config {
	t.Helper()
	c, err := app.ReadConfig(h.Options().ConfigPath)
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestPatChoiceOffersPatsSetup(t *testing.T) {
	data := fakePatInstall(t, `{"mycall":"N0CALL","http_addr":"0.0.0.0:8080"}`)
	h, _ := newTestHandler(t)
	askUsePat(t, h)

	rec, body := do(t, h, "GET", "/api/pat-choice", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET: %d %s", rec.Code, body)
	}
	var got patChoice
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatal(err)
	}
	want := patChoice{Ask: true, PatURL: "http://localhost:8080",
		Mailbox: filepath.Join(data, "mailbox"), Forms: filepath.Join(data, "Standard_Forms")}
	if got != want {
		t.Errorf("got %+v, want %+v", got, want)
	}
}

func TestPatChoiceNotAskedWithoutFlag(t *testing.T) {
	fakePatInstall(t, `{"mycall":"N0CALL"}`)
	h, _ := newTestHandler(t)
	_, body := do(t, h, "GET", "/api/pat-choice", nil)
	var got patChoice
	json.Unmarshal(body, &got)
	if got.Ask {
		t.Error("asked without ask_use_pat in the config")
	}
}

func TestPatChoiceNotAskedWithoutPat(t *testing.T) {
	fakePatInstall(t, "") // Pat's folders exist but there's no config.json
	h, _ := newTestHandler(t)
	askUsePat(t, h)
	_, body := do(t, h, "GET", "/api/pat-choice", nil)
	var got patChoice
	json.Unmarshal(body, &got)
	if got.Ask {
		t.Error("asked with no Pat installed")
	}
}

func TestPatChoiceYesUsesPatsFolders(t *testing.T) {
	data := fakePatInstall(t, `{"mycall":"N0CALL"}`) // no http_addr: Pat's default
	h, _ := newTestHandler(t)
	askUsePat(t, h)

	if rec, body := do(t, h, "POST", "/api/pat-choice", map[string]bool{"use": true}); rec.Code != http.StatusOK {
		t.Fatalf("POST: %d %s", rec.Code, body)
	}
	c := savedConfig(t, h)
	if c.AskUsePat {
		t.Error("ask_use_pat still set")
	}
	if c.MailboxPath != filepath.Join(data, "mailbox") || c.FormsPath != filepath.Join(data, "Standard_Forms") {
		t.Errorf("folders = %q, %q", c.MailboxPath, c.FormsPath)
	}
	if c.ConnectVia != "http://localhost:8080" {
		t.Errorf("connect_via = %q", c.ConnectVia)
	}
	if c.MyCall != "N0CALL" {
		t.Errorf("other settings lost: mycall %q", c.MyCall)
	}
}

func TestPatChoiceNoKeepsPhatOnItsOwn(t *testing.T) {
	fakePatInstall(t, `{"mycall":"N0CALL"}`)
	h, _ := newTestHandler(t)
	askUsePat(t, h)

	if rec, body := do(t, h, "POST", "/api/pat-choice", map[string]bool{"use": false}); rec.Code != http.StatusOK {
		t.Fatalf("POST: %d %s", rec.Code, body)
	}
	c := savedConfig(t, h)
	if c.AskUsePat || c.MailboxPath != "" || c.FormsPath != "" || c.ConnectVia != "" {
		t.Errorf("No changed more than the question: %+v", c)
	}
}

// Only a Phat that was asked takes an answer: a POST from anywhere else
// must not repoint an existing install at Pat.
func TestPatChoiceRefusesAnswerWhenNotAsked(t *testing.T) {
	fakePatInstall(t, `{"mycall":"N0CALL"}`)
	h, _ := newTestHandler(t)

	rec, _ := do(t, h, "POST", "/api/pat-choice", map[string]bool{"use": true})
	if rec.Code != http.StatusConflict {
		t.Errorf("POST without the question: %d, want 409", rec.Code)
	}
	if c := savedConfig(t, h); c.MailboxPath != "" || c.ConnectVia != "" {
		t.Errorf("config changed: %+v", c)
	}
}

// A cross-site form or text/plain POST skips the browser's preflight, so
// the answer must arrive as JSON.
func TestPatChoiceRequiresJSON(t *testing.T) {
	fakePatInstall(t, `{"mycall":"N0CALL"}`)
	h, _ := newTestHandler(t)
	askUsePat(t, h)

	req := httptest.NewRequest("POST", "/api/pat-choice", strings.NewReader(`{"use":true}`))
	req.Header.Set("Content-Type", "text/plain")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnsupportedMediaType {
		t.Errorf("text/plain POST: %d, want 415", rec.Code)
	}
	if c := savedConfig(t, h); c.MailboxPath != "" || !c.AskUsePat {
		t.Errorf("config changed: %+v", c)
	}
}
