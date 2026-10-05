package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"github.com/la5nta/pat/api/types"
	"github.com/la5nta/pat/internal/debug"
)

// relayHeader marks a request the relay sent, so a connect_via that points
// back at this Phat is refused instead of calling itself forever.
const relayHeader = "X-Phat-Relay"

// patRelay hands a Connect the page sends with via=pat to a running Pat,
// set by connect_via, and its Abort and Disconnect after it. Winlink's production servers turn away a client named Phat
// until Winlink admits it, while Pat sharing the same mailbox is admitted.
// Pat runs the session under its own name; the relay carries its status,
// log, progress and prompts back to Phat's page. Mail needs no relay:
// Pat writes to the mailbox Phat watches.
type patRelay struct {
	base   *url.URL
	hub    *WSHub
	client *http.Client

	mu      sync.Mutex
	status  *types.Status // Pat's last status; nil while its socket is down
	prompts map[string]struct{}

	wmu  sync.Mutex // gorilla allows one writer at a time
	conn *websocket.Conn
}

func newPatRelay(raw string, hub *WSHub) (*patRelay, error) {
	u, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("connect_via: %w", err)
	}
	if (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return nil, fmt.Errorf("connect_via %q: want an address like http://localhost:8080", raw)
	}
	u.Path = strings.TrimSuffix(u.Path, "/")
	return &patRelay{base: u, hub: hub, client: &http.Client{}, prompts: map[string]struct{}{}}, nil
}

func (r *patRelay) endpoint(path string, q url.Values) string {
	u := *r.base
	u.Path += path
	u.RawQuery = q.Encode()
	return u.String()
}

// connect asks Pat to run the session and passes its answer through. Pat
// holds the request open until the session ends.
func (r *patRelay) connect(w http.ResponseWriter, req *http.Request) {
	log.Printf("Connecting through Pat at %s", r.base)
	r.forward(w, req, "/api/connect", url.Values{"url": {req.FormValue("url")}})
}

func (r *patRelay) disconnect(w http.ResponseWriter, req *http.Request) {
	r.forward(w, req, "/api/disconnect", url.Values{"dirty": {req.FormValue("dirty")}})
}

func (r *patRelay) forward(w http.ResponseWriter, req *http.Request, path string, q url.Values) {
	if req.Header.Get(relayHeader) != "" {
		http.Error(w, "connect_via points back at this Phat", http.StatusLoopDetected)
		return
	}
	out, err := http.NewRequestWithContext(req.Context(), http.MethodGet, r.endpoint(path, q), nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	out.Header.Set(relayHeader, "1")
	resp, err := r.client.Do(out)
	if err != nil {
		http.Error(w, fmt.Sprintf("Pat isn't reachable at %s: %v", r.base, err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	if ct := resp.Header.Get("Content-Type"); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

// busy reports whether Pat is dialing or holds a session.
func (r *patRelay) busy() bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.status != nil && (r.status.Connected || r.status.Dialing)
}

// overlay puts Pat's session state into Phat's status while Pat is
// reachable and Phat has no session of its own, so the page shows the
// session Pat is running.
func (r *patRelay) overlay(s *types.Status) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.status == nil || s.Connected || s.Dialing {
		return
	}
	s.Connected = r.status.Connected
	s.Dialing = r.status.Dialing
	s.RemoteAddr = r.status.RemoteAddr
}

// respond sends a prompt answer to Pat when the prompt came from Pat, and
// reports whether it did.
func (r *patRelay) respond(raw json.RawMessage) bool {
	var resp struct {
		ID string `json:"id"`
	}
	if json.Unmarshal(raw, &resp) != nil {
		return false
	}
	r.mu.Lock()
	_, ours := r.prompts[resp.ID]
	delete(r.prompts, resp.ID)
	r.mu.Unlock()
	if ours {
		r.write(map[string]json.RawMessage{"prompt_response": raw})
	}
	return ours
}

func (r *patRelay) write(v interface{}) {
	r.wmu.Lock()
	defer r.wmu.Unlock()
	if r.conn == nil {
		return
	}
	r.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
	if err := r.conn.WriteJSON(v); err != nil {
		debug.Printf("pat relay write: %v", err)
	}
}

// run keeps a socket open to Pat until ctx ends, reconnecting after a drop.
func (r *patRelay) run(ctx context.Context) {
	u := *r.base
	u.Scheme = map[string]string{"http": "ws", "https": "wss"}[u.Scheme]
	u.Path += "/ws"
	hdr := http.Header{relayHeader: {"1"}}
	warned := false
	for ctx.Err() == nil {
		conn, _, err := websocket.DefaultDialer.DialContext(ctx, u.String(), hdr)
		if err != nil {
			if !warned {
				log.Printf("Pat isn't reachable at %s; retrying: %v", r.base, err)
				warned = true
			}
		} else {
			warned = false
			r.serve(ctx, conn)
		}
		select {
		case <-ctx.Done():
		case <-time.After(5 * time.Second):
		}
	}
}

func (r *patRelay) serve(ctx context.Context, conn *websocket.Conn) {
	since := time.Now().Truncate(time.Second)
	r.wmu.Lock()
	r.conn = conn
	r.wmu.Unlock()
	stop := context.AfterFunc(ctx, func() { conn.Close() })
	defer func() {
		stop()
		conn.Close()
		r.wmu.Lock()
		r.conn = nil
		r.wmu.Unlock()
		r.mu.Lock()
		r.status = nil
		r.prompts = map[string]struct{}{}
		r.mu.Unlock()
		r.hub.UpdateStatus()
	}()

	keep := false // whether untimestamped log lines are past Pat's backlog
	for {
		v := map[string]json.RawMessage{}
		if err := conn.ReadJSON(&v); err != nil {
			debug.Printf("pat relay read: %v", err)
			return
		}
		for key, raw := range v {
			switch key {
			case "Ping":
				r.write(map[string]bool{"Pong": true})
			case "Status":
				var s types.Status
				if json.Unmarshal(raw, &s) == nil {
					r.mu.Lock()
					r.status = &s
					r.mu.Unlock()
					r.hub.UpdateStatus()
				}
			case "Prompt":
				var p struct {
					ID string `json:"id"`
				}
				_ = json.Unmarshal(raw, &p)
				r.mu.Lock()
				r.prompts[p.ID] = struct{}{}
				r.mu.Unlock()
				r.hub.WriteJSON(map[string]json.RawMessage{key: raw})
			case "PromptAbort":
				var p struct {
					ID string `json:"id"`
				}
				_ = json.Unmarshal(raw, &p)
				r.mu.Lock()
				delete(r.prompts, p.ID)
				r.mu.Unlock()
				r.hub.WriteJSON(map[string]json.RawMessage{key: raw})
			case "Progress", "Notification":
				r.hub.WriteJSON(map[string]json.RawMessage{key: raw})
			case "LogLine":
				var line string
				_ = json.Unmarshal(raw, &line)
				// Pat replays its whole log to a new socket. Lines from
				// before this socket opened are history Phat's page never
				// asked for; a line without a timestamp belongs with the
				// line above it.
				if t, err := time.ParseInLocation("2006/01/02 15:04:05", prefix(line, 19), time.Local); err == nil {
					keep = !t.Before(since)
				}
				if keep {
					r.hub.WriteJSON(struct{ LogLine string }{"[pat] " + line})
				}
			}
		}
	}
}

func prefix(s string, n int) string {
	if len(s) < n {
		return s
	}
	return s[:n]
}
