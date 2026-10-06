package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// fakePat stands in for a running Pat: it records connect and disconnect
// calls and lets a test script what its /ws socket sends.
type fakePat struct {
	srv *httptest.Server

	mu         sync.Mutex
	connectURL string
	dirty      string
	received   []map[string]json.RawMessage
	sock       chan *websocket.Conn
}

func newFakePat(t *testing.T) *fakePat {
	t.Helper()
	p := &fakePat{sock: make(chan *websocket.Conn, 1)}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/connect", func(w http.ResponseWriter, r *http.Request) {
		p.mu.Lock()
		p.connectURL = r.FormValue("url")
		p.mu.Unlock()
		_, _ = w.Write([]byte(`{"NumReceived":2}`))
	})
	mux.HandleFunc("/api/disconnect", func(w http.ResponseWriter, r *http.Request) {
		p.mu.Lock()
		p.dirty = r.FormValue("dirty")
		p.mu.Unlock()
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{}`))
	})
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		c, err := (&websocket.Upgrader{}).Upgrade(w, r, nil)
		if err != nil {
			return
		}
		_ = c.WriteJSON(map[string]string{"MyCall": "N0CALL"})
		p.sock <- c
		for {
			v := map[string]json.RawMessage{}
			if err := c.ReadJSON(&v); err != nil {
				return
			}
			p.mu.Lock()
			p.received = append(p.received, v)
			p.mu.Unlock()
		}
	})
	p.srv = httptest.NewServer(mux)
	t.Cleanup(p.srv.Close)
	return p
}

func (p *fakePat) gotFromRelay(key string) []json.RawMessage {
	p.mu.Lock()
	defer p.mu.Unlock()
	var out []json.RawMessage
	for _, v := range p.received {
		if raw, ok := v[key]; ok {
			out = append(out, raw)
		}
	}
	return out
}

// relayed starts a relay to p and a hub listener that collects every
// message the hub broadcasts. It returns the handler, Pat's end of the
// relay socket, and the collected broadcasts.
func relayed(t *testing.T, p *fakePat) (*Handler, *websocket.Conn, chan interface{}) {
	t.Helper()
	h, _ := newTestHandler(t)
	r, err := newPatRelay(p.srv.URL, h.wsHub)
	if err != nil {
		t.Fatal(err)
	}
	h.wsHub.relay = r
	out := make(chan interface{}, 64)
	h.wsHub.mu.Lock()
	h.wsHub.pool[&WSConn{out: out}] = struct{}{}
	h.wsHub.mu.Unlock()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go r.run(ctx)
	select {
	case c := <-p.sock:
		return h, c, out
	case <-time.After(5 * time.Second):
		t.Fatal("relay never opened Pat's socket")
		return nil, nil, nil
	}
}

// next returns the first broadcast whose JSON carries key.
func next(t *testing.T, out chan interface{}, key string) json.RawMessage {
	t.Helper()
	deadline := time.After(5 * time.Second)
	for {
		select {
		case v := <-out:
			b, _ := json.Marshal(v)
			m := map[string]json.RawMessage{}
			_ = json.Unmarshal(b, &m)
			if raw, ok := m[key]; ok {
				return raw
			}
		case <-deadline:
			t.Fatalf("no %s broadcast", key)
			return nil
		}
	}
}

func eventually(t *testing.T, what string, ok func() bool) {
	t.Helper()
	for i := 0; i < 250; i++ {
		if ok() {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", what)
}

func TestRelayConnectGoesToPat(t *testing.T) {
	p := newFakePat(t)
	h, _ := newTestHandler(t)
	r, err := newPatRelay(p.srv.URL, h.wsHub)
	if err != nil {
		t.Fatal(err)
	}
	h.wsHub.relay = r

	rec, body := do(t, h, "GET", "/api/connect?via=pat&url="+"telnet%3A%2F%2FN0CALL%3ACMSTelnet%40cms.example%3A8772%2Fwl2k", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, body)
	}
	if got := strings.TrimSpace(string(body)); got != `{"NumReceived":2}` {
		t.Fatalf("body %q, want Pat's", got)
	}
	if p.connectURL != "telnet://N0CALL:CMSTelnet@cms.example:8772/wl2k" {
		t.Fatalf("Pat got url %q", p.connectURL)
	}
}

func TestRelayDisconnectGoesToPat(t *testing.T) {
	p := newFakePat(t)
	h, pat, out := relayed(t, p)
	_ = pat.WriteJSON(map[string]any{"Status": map[string]any{"connected": true}})
	next(t, out, "Status")

	rec, _ := do(t, h, "POST", "/api/disconnect?dirty=true", nil)
	if p.dirty != "true" {
		t.Fatalf("Pat got dirty=%q", p.dirty)
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want Pat's 400 passed through", rec.Code)
	}
}

func TestConnectWithoutViaStaysDirect(t *testing.T) {
	p := newFakePat(t)
	h, _ := newTestHandler(t)
	r, _ := newPatRelay(p.srv.URL, h.wsHub)
	h.wsHub.relay = r

	do(t, h, "GET", "/api/connect?url=", nil) // empty returns before any prompt
	if p.connectURL != "" {
		t.Fatalf("a direct connect reached Pat with %q", p.connectURL)
	}
}

func TestConnectViaPatWithoutConnectVia(t *testing.T) {
	h, _ := newTestHandler(t)

	rec, body := do(t, h, "GET", "/api/connect?via=pat&url=x", nil)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want 400", rec.Code)
	}
	if !strings.Contains(string(body), "connect_via") {
		t.Fatalf("error %q should name the setting", body)
	}
}

func TestDisconnectStaysDirectWhilePatIsIdle(t *testing.T) {
	p := newFakePat(t)
	h, pat, out := relayed(t, p)
	_ = pat.WriteJSON(map[string]any{"Status": map[string]any{"connected": false}})
	next(t, out, "Status")

	rec, _ := do(t, h, "POST", "/api/disconnect?dirty=false", nil)
	if p.dirty != "" {
		t.Fatal("a disconnect with no Pat session reached Pat")
	}
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status %d, want Phat's own 400 for no session", rec.Code)
	}
}

func TestRelayConnectWithPatDown(t *testing.T) {
	p := newFakePat(t)
	addr := p.srv.URL
	p.srv.Close()
	h, _ := newTestHandler(t)
	r, _ := newPatRelay(addr, h.wsHub)
	h.wsHub.relay = r

	rec, body := do(t, h, "GET", "/api/connect?via=pat&url=x", nil)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status %d, want 502", rec.Code)
	}
	if !strings.Contains(string(body), addr) {
		t.Fatalf("error %q should name Pat's address", body)
	}
}

func TestRelayRefusesALoop(t *testing.T) {
	p := newFakePat(t)
	h, _ := newTestHandler(t)
	r, _ := newPatRelay(p.srv.URL, h.wsHub)
	h.wsHub.relay = r

	req := httptest.NewRequest("GET", "/api/connect?via=pat&url=x", nil)
	req.Header.Set(relayHeader, "1")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusLoopDetected {
		t.Fatalf("status %d, want 508", rec.Code)
	}
	if p.connectURL != "" {
		t.Fatal("a looped request reached Pat")
	}
}

func TestNewPatRelayRejectsBadAddress(t *testing.T) {
	h, _ := newTestHandler(t)
	for _, raw := range []string{"localhost:8080", "ftp://host", "http://", "::"} {
		if _, err := newPatRelay(raw, h.wsHub); err == nil {
			t.Errorf("%q accepted", raw)
		}
	}
}

func TestRelayStatusOverlaysPhats(t *testing.T) {
	p := newFakePat(t)
	h, pat, out := relayed(t, p)

	_ = pat.WriteJSON(map[string]any{"Status": map[string]any{"connected": true, "dialing": false, "remote_addr": "tcp:192.0.2.1:8772"}})
	raw := next(t, out, "Status")
	var s struct {
		Connected  bool   `json:"connected"`
		RemoteAddr string `json:"remote_addr"`
	}
	_ = json.Unmarshal(raw, &s)
	if !s.Connected || s.RemoteAddr != "tcp:192.0.2.1:8772" {
		t.Fatalf("broadcast status %s, want Pat's session", raw)
	}
	_, body := do(t, h, "GET", "/api/status", nil)
	if !strings.Contains(string(body), `"connected":true`) {
		t.Fatalf("/api/status %s, want Pat's session", body)
	}
}

func TestRelayDropsPatsBacklogAndTagsNewLines(t *testing.T) {
	p := newFakePat(t)
	_, pat, out := relayed(t, p)

	old := time.Now().Add(-time.Hour).Format("2006/01/02 15:04:05")
	now := time.Now().Add(time.Second).Format("2006/01/02 15:04:05")
	for _, l := range []string{old + " Starting HTTP service", "[WL2K-5.0-B2FWIHJM$]", now + " Connecting to WL2K (telnet)...", "CMS>"} {
		_ = pat.WriteJSON(map[string]string{"LogLine": l})
	}
	var first, second string
	_ = json.Unmarshal(next(t, out, "LogLine"), &first)
	_ = json.Unmarshal(next(t, out, "LogLine"), &second)
	if first != "[pat] "+now+" Connecting to WL2K (telnet)..." || second != "[pat] CMS>" {
		t.Fatalf("relayed %q, %q", first, second)
	}
}

func TestRelayPassesPromptsBothWays(t *testing.T) {
	p := newFakePat(t)
	h, pat, out := relayed(t, p)

	_ = pat.WriteJSON(map[string]any{"Prompt": map[string]any{"id": "42", "kind": "password", "message": "Password for N0CALL"}})
	if raw := next(t, out, "Prompt"); !strings.Contains(string(raw), `"42"`) {
		t.Fatalf("prompt broadcast %s", raw)
	}
	h.wsHub.handleWSMessage(map[string]json.RawMessage{"prompt_response": json.RawMessage(`{"id":"7","value":"not Pat's"}`)})
	h.wsHub.handleWSMessage(map[string]json.RawMessage{"prompt_response": json.RawMessage(`{"id":"42","value":"secret"}`)})
	eventually(t, "Pat to get the answer", func() bool { return len(p.gotFromRelay("prompt_response")) == 1 })
	if got := string(p.gotFromRelay("prompt_response")[0]); !strings.Contains(got, `"secret"`) {
		t.Fatalf("Pat got %s", got)
	}

	_ = pat.WriteJSON(map[string]any{"PromptAbort": map[string]any{"id": "42"}})
	next(t, out, "PromptAbort")
}

func TestRelayAnswersPatsPing(t *testing.T) {
	p := newFakePat(t)
	_, pat, _ := relayed(t, p)

	_ = pat.WriteJSON(map[string]bool{"Ping": true})
	eventually(t, "a Pong", func() bool { return len(p.gotFromRelay("Pong")) == 1 })
}
