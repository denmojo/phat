package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/la5nta/pat/internal/mailindex"
)

type bulkResult struct {
	OK     []string          `json:"ok"`
	Failed map[string]string `json:"failed"`
}

// runBulk applies op to each MID and reports per-MID outcomes. 200 when
// anything succeeded. When nothing did, the status follows the failures:
// 404 when every one was not-found, 409 when every one was a conflict
// (the destination already holds the message), 500 otherwise.
func runBulk(w http.ResponseWriter, mids []string, op func(mid string) error) {
	res := bulkResult{OK: []string{}, Failed: map[string]string{}}
	allNotFound, allConflict := true, true
	for _, mid := range mids {
		if err := op(mid); err != nil {
			res.Failed[mid] = err.Error()
			if !errors.Is(err, mailindex.ErrNotFound) {
				allNotFound = false
			}
			if !errors.Is(err, mailindex.ErrDestinationExists) {
				allConflict = false
			}
			continue
		}
		res.OK = append(res.OK, mid)
	}
	switch {
	case len(res.OK) > 0:
	case len(res.Failed) > 0 && allNotFound:
		w.WriteHeader(http.StatusNotFound)
	case len(res.Failed) > 0 && allConflict:
		w.WriteHeader(http.StatusConflict)
	case len(res.Failed) > 0:
		w.WriteHeader(http.StatusInternalServerError)
	}
	_ = json.NewEncoder(w).Encode(res)
}

func decodeMids(w http.ResponseWriter, r *http.Request, into any) bool {
	if err := json.NewDecoder(r.Body).Decode(into); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return false
	}
	return true
}

func (h Handler) bulkMoveHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Mids []string
		To   string
	}
	if !decodeMids(w, r, &body) {
		return
	}
	runBulk(w, body.Mids, func(mid string) error { return h.Index().Move(mid, body.To) })
}

func (h Handler) bulkReadHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Mids []string
		Read bool
	}
	if !decodeMids(w, r, &body) {
		return
	}
	runBulk(w, body.Mids, func(mid string) error { return h.Index().SetUnread(mid, !body.Read) })
}

func (h Handler) bulkStarHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Mids    []string
		Starred bool
	}
	if !decodeMids(w, r, &body) {
		return
	}
	runBulk(w, body.Mids, func(mid string) error {
		if _, err := h.Index().Get(mid); err != nil {
			return err
		}
		return h.Index().SetStarred([]string{mid}, body.Starred)
	})
}

func (h Handler) bulkLabelsHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Mids   []string
		Add    []string
		Remove []string
	}
	if !decodeMids(w, r, &body) {
		return
	}
	runBulk(w, body.Mids, func(mid string) error {
		if _, err := h.Index().Get(mid); err != nil {
			return err
		}
		if len(body.Add) > 0 {
			if err := h.Index().AddLabels([]string{mid}, body.Add); err != nil {
				return err
			}
		}
		if len(body.Remove) > 0 {
			return h.Index().RemoveLabels([]string{mid}, body.Remove)
		}
		return nil
	})
}

func (h Handler) bulkDeleteHandler(w http.ResponseWriter, r *http.Request) {
	var body struct{ Mids []string }
	if !decodeMids(w, r, &body) {
		return
	}
	runBulk(w, body.Mids, func(mid string) error { return h.Index().Delete(mid) })
}
