package api

import (
	"encoding/json"
	"mime"
	"net"
	"net/http"
	"os"
	"path/filepath"

	"github.com/la5nta/pat/app"
	"github.com/la5nta/pat/cfg"
	"github.com/la5nta/pat/internal/directories"
)

// patDirs returns an installed Pat's config and data folders. Tests
// point it at a temp install.
var patDirs = func() (string, string) { return directories.PatConfigDir(), directories.PatDataDir() }

// patChoice is the first-run question "Connect through your Pat?" and
// what a Yes would set. Ask is false once answered, or with no Pat.
type patChoice struct {
	Ask     bool   `json:"ask"`
	PatURL  string `json:"pat_url,omitempty"`
	Mailbox string `json:"mailbox,omitempty"`
	Forms   string `json:"forms,omitempty"`
}

// readPatSetup reads Pat's own config for its web address and returns
// the folders Phat would use. ok is false when no Pat is installed.
func readPatSetup() (p patChoice, ok bool) {
	cfgDir, dataDir := patDirs()
	b, err := os.ReadFile(filepath.Join(cfgDir, "config.json"))
	if err != nil {
		return p, false
	}
	var pc struct {
		HTTPAddr string `json:"http_addr"`
	}
	_ = json.Unmarshal(b, &pc)
	return patChoice{
		PatURL:  patURL(pc.HTTPAddr),
		Mailbox: filepath.Join(dataDir, "mailbox"),
		Forms:   filepath.Join(dataDir, "Standard_Forms"),
	}, true
}

// patURL turns Pat's http_addr into an address Phat can reach on the same
// machine. Pat's own default is localhost:8080.
func patURL(addr string) string {
	if addr == "" {
		addr = "localhost:8080"
	}
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return "http://localhost:8080"
	}
	switch host {
	case "", "0.0.0.0", "::":
		host = "localhost"
	}
	return "http://" + net.JoinHostPort(host, port)
}

func (h Handler) patChoiceHandler(w http.ResponseWriter, r *http.Request) {
	path := h.Options().ConfigPath
	c, err := app.LoadConfig(path, cfg.DefaultConfig)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	pat, havePat := readPatSetup()

	if r.Method == http.MethodGet {
		if c.AskUsePat && havePat {
			pat.Ask = true
		} else {
			pat = patChoice{}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(pat)
		return
	}

	// Only JSON, so a cross-site page can't send the answer without the
	// browser's preflight, and only while the question is open.
	if mt, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type")); mt != "application/json" {
		http.Error(w, "send the answer as application/json", http.StatusUnsupportedMediaType)
		return
	}
	if !c.AskUsePat || !havePat {
		http.Error(w, "Phat isn't asking about Pat", http.StatusConflict)
		return
	}
	var v struct {
		Use bool `json:"use"`
	}
	if err := json.NewDecoder(r.Body).Decode(&v); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if v.Use {
		c.MailboxPath, c.FormsPath, c.ConnectVia = pat.Mailbox, pat.Forms, pat.PatURL
	}
	c.AskUsePat = false
	if err := app.WriteConfig(c, path); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode("OK")
}
