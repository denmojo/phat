// Copyright 2016 Martin Hebnes Pedersen (LA5NTA). All rights reserved.
// Use of this source code is governed by the MIT-license that can be
// found in the LICENSE file.

package api

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/gorilla/websocket"

	"github.com/la5nta/pat/api/types"
	"github.com/la5nta/pat/app"
	"github.com/la5nta/pat/internal/debug"
	"github.com/la5nta/pat/internal/mailindex"
	"github.com/la5nta/pat/internal/osutil"
	"github.com/la5nta/wl2k-go/mailbox"
)

const KeepaliveInterval = 4 * time.Minute

// WSConn represent one connection in the WSHub pool
type WSConn struct {
	conn *websocket.Conn
	out  chan interface{}
}

// WSHub is a hub for broadcasting data to several websocket connections
type WSHub struct {
	*app.App

	mu   sync.Mutex
	pool map[*WSConn]struct{}

	relay *patRelay // set when connect_via hands sessions to Pat
}

func NewWSHub(app *app.App) *WSHub {
	return &WSHub{App: app, pool: map[*WSConn]struct{}{}}
}

func (w *WSHub) UpdateStatus() {
	w.WriteJSON(struct{ Status types.Status }{w.status()})
}

// status is the app's status, with Pat's session in it when connects go
// through Pat.
func (w *WSHub) status() types.Status {
	s := w.GetStatus()
	if w.relay != nil {
		w.relay.overlay(&s)
	}
	return s
}

func (w *WSHub) WriteProgress(p types.Progress) { w.WriteJSON(struct{ Progress types.Progress }{p}) }
func (w *WSHub) WriteNotification(n types.Notification) {
	w.WriteJSON(struct{ Notification types.Notification }{n})
}

func (w *WSHub) Prompt(p app.Prompt) {
	w.WriteJSON(struct{ Prompt types.Prompt }{p.Prompt})
	go func() { <-p.Done(); w.WriteJSON(struct{ PromptAbort types.Prompt }{p.Prompt}) }()
}

func (w *WSHub) WriteJSON(v interface{}) {
	w.mu.Lock()
	defer w.mu.Unlock()
	for c := range w.pool {
		select {
		case c.out <- v:
		case <-time.After(3 * time.Second):
			debug.Printf("Closing one unresponsive web socket")
			c.conn.Close()
			delete(w.pool, c)
		}
	}
}

// Close closes all active WebSocket connections in the hub.
//
// The hub should not be used after calling Close.
func (w *WSHub) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.pool == nil {
		return nil
	}
	for conn, _ := range w.pool {
		// Closing the connection should trigger the deferred cleanup in the Handle method for that client,
		// which includes removing it from the pool.
		err := conn.conn.Close()
		if err != nil {
			debug.Printf("Error closing WebSocket connection %s: %v", conn.conn.RemoteAddr(), err)
		}
	}
	w.pool = nil
	return nil
}

func (w *WSHub) NumClients() int { return len(w.ClientAddrs()) }

func (w *WSHub) ClientAddrs() []string {
	w.mu.Lock()
	defer w.mu.Unlock()
	addrs := make([]string, 0, len(w.pool))
	for c := range w.pool {
		addrs = append(addrs, c.conn.RemoteAddr().String())
	}
	return addrs
}

func (w *WSHub) WatchMBox(ctx context.Context, mbox *mailbox.DirHandler) {
	w.watch(ctx, mbox, w.Index())
}

// isIndexFile reports whether p is the mailbox index or one of SQLite's
// companion files beside it. Those change on every index write and say
// nothing about the mailbox.
func isIndexFile(p string) bool {
	return strings.HasPrefix(filepath.Base(p), mailindex.FileName)
}

// watch reconciles the index and broadcasts UpdateMailbox on every change
// under the mailbox. Custom folder directories are added as they appear.
func (w *WSHub) watch(ctx context.Context, mbox *mailbox.DirHandler, ix *mailindex.Index) {
	// Maximise ulimit -n:
	//   fsnotify opens a file descriptor for every file in the directories it watches, which
	//   may more files than the current soft limit. The is especially a problem on macOS which
	//   has a default soft limit of only 256 files. Windows does not have a such a limit.
	if runtime.GOOS != "windows" {
		if err := osutil.RaiseOpenFileLimit(4096); err != nil {
			log.Printf("Unable to raise open file limit: %v", err)
		}
	}

	fsWatcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Println("Unable to start fs watcher: ", err)
		return
	}
	defer fsWatcher.Close()

	addAll := func() {
		// The root, so new folder directories are seen, plus every folder.
		_ = fsWatcher.Add(mbox.MBoxPath)
		folders, err := ix.Folders()
		if err != nil {
			log.Printf("mailindex folders: %v", err)
			return
		}
		for _, f := range folders {
			p := ix.FolderDir(f)
			debug.Printf("Adding '%s' to fs watcher", p)
			if err := fsWatcher.Add(p); err != nil {
				log.Printf("Unable to add path '%s' to fs watcher: %v", p, err)
			}
		}
	}
	addAll()

	// Listen for filesystem events, level the index and broadcast updates to all clients
	for {
		select {
		case <-ctx.Done():
			return
		case e := <-fsWatcher.Events:
			if e.Op == fsnotify.Chmod || isIndexFile(e.Name) {
				continue
			}
			// Make sure we don't send many of these events over a short period.
			drainUntilSilence(fsWatcher, 100*time.Millisecond)
			// A new folder directory may be anywhere in the drained burst,
			// so register directories again; re-adding a watched path is a no-op.
			addAll()
			if _, err := ix.Reconcile(); err != nil {
				log.Printf("mailindex reconcile: %v", err)
			}
			w.WriteJSON(struct {
				UpdateMailbox bool
			}{true})
		case err := <-fsWatcher.Errors:
			log.Println(err)
		}
	}
}

// Handle adds a new websocket to the hub
//
// It will block until the client either stops responding or closes the connection.
func (w *WSHub) Handle(conn *websocket.Conn) {
	debug.Printf("ws[%s] subscribed", conn.RemoteAddr())
	c := &WSConn{
		conn: conn,
		out:  make(chan interface{}, 1),
	}

	w.mu.Lock()
	w.pool[c] = struct{}{}
	w.mu.Unlock()

	// Initial status update
	// (broadcasted as it includes info to other clients about this new one)
	w.UpdateStatus()

	quit := w.wsReadLoop(conn)

	// Disconnect and remove client when this handler returns.
	defer func() {
		debug.Printf("ws[%s] unsubscribing...", conn.RemoteAddr())
		c.conn.Close()
		w.mu.Lock()
		delete(w.pool, c)
		w.mu.Unlock()
		w.UpdateStatus()
		debug.Printf("ws[%s] unsubscribed", conn.RemoteAddr())
	}()

	lines, done, err := tailFile(w.Options().LogPath)
	if err != nil {
		log.Println(err)
		return
	}
	defer close(done)
	ticker := time.NewTicker(KeepaliveInterval)
	defer ticker.Stop()
	for {
		var err error
		c.conn.SetWriteDeadline(time.Time{})
		select {
		case <-ticker.C:
			debug.Printf("ws[%s] ping", conn.RemoteAddr())
			c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			err = c.conn.WriteJSON(struct {
				Ping bool
			}{true})
		case line := <-lines:
			c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			err = c.conn.WriteJSON(struct {
				LogLine string
			}{string(line)})
		case v := <-c.out:
			c.conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
			err = c.conn.WriteJSON(v)
		case <-quit:
			// The read loop failed/disconnected. Abort.
			return
		}
		if err != nil {
			debug.Printf("ws[%s] write error: %v", conn.RemoteAddr(), err)
			return
		}
	}
}

// drainEvents reads from w.Events and blocks until the channel has been silent for at least 50 ms.
func drainUntilSilence(w *fsnotify.Watcher, silenceDur time.Duration) {
	timer := time.NewTimer(silenceDur)
	defer timer.Stop()
	for {
		select {
		case <-w.Events:
			if !timer.Stop() {
				<-timer.C
			}
			timer.Reset(silenceDur)
		case <-timer.C:
			return
		}
	}
}

// Expects the file to never get renamed/truncated or deleted
func tailFile(path string) (<-chan []byte, chan<- struct{}, error) {
	lines := make(chan []byte)
	done := make(chan struct{})
	file, err := os.Open(path)
	if err != nil {
		return nil, nil, err
	}

	go func() {
		rd := bufio.NewReader(file)
		for {
			data, _, err := rd.ReadLine()
			if errors.Is(err, io.EOF) {
				time.Sleep(time.Millisecond * 100)
				continue
			}

			select {
			case <-done:
				file.Close()
				return
			case lines <- data:
			}
		}
	}()

	return lines, done, nil
}

func (w *WSHub) handleWSMessage(v map[string]json.RawMessage) {
	raw, ok := v["prompt_response"]
	if !ok {
		return
	}
	if w.relay != nil && w.relay.respond(raw) {
		return
	}
	var resp app.PromptResponse
	json.Unmarshal(raw, &resp)
	w.PromptHub().Respond(resp.ID, resp.Value, resp.Err)
}

func (w *WSHub) wsReadLoop(c *websocket.Conn) <-chan struct{} {
	quit := make(chan struct{})
	go func() {
		for {
			v := map[string]json.RawMessage{}
			// We should at least get a ping response once per KeepaliveInterval.
			c.SetReadDeadline(time.Now().Add(KeepaliveInterval + 10*time.Second))
			err := c.ReadJSON(&v)
			if err != nil {
				debug.Printf("ws[%s] read error: %v", c.RemoteAddr(), err)
				close(quit)
				return
			}
			if _, ok := v["Pong"]; ok {
				// That's the Ping response.
				debug.Printf("ws[%s] pong", c.RemoteAddr())
				continue
			}
			go w.handleWSMessage(v)
		}
	}()
	return quit
}
