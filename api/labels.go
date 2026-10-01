package api

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strings"

	"github.com/gorilla/mux"

	"github.com/la5nta/pat/internal/mailindex"
)

// labelRouter serves /api/labels/{name}. It matches on the escaped path so
// a label name holding a slash ("net a/b", sent as net%20a%2Fb) stays one
// path segment; labelName unescapes it.
func (h Handler) labelRouter() http.Handler {
	r := mux.NewRouter().UseEncodedPath()
	r.HandleFunc("/api/labels/{name}", h.updateLabelHandler).Methods("PATCH")
	r.HandleFunc("/api/labels/{name}", h.deleteLabelHandler).Methods("DELETE")
	return r
}

func labelName(r *http.Request) (string, bool) {
	name, err := url.PathUnescape(mux.Vars(r)["name"])
	return name, err == nil
}

func (h Handler) labelsHandler(w http.ResponseWriter, r *http.Request) {
	ls, err := h.Index().Labels()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if ls == nil {
		ls = []mailindex.Label{}
	}
	_ = json.NewEncoder(w).Encode(ls)
}

func (h Handler) createLabelHandler(w http.ResponseWriter, r *http.Request) {
	var body struct{ Name, Color string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.Name) == "" {
		http.Error(w, "name required", http.StatusBadRequest)
		return
	}
	if err := h.Index().CreateLabel(body.Name, body.Color); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			http.Error(w, "label exists", http.StatusConflict)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(body)
}

func (h Handler) updateLabelHandler(w http.ResponseWriter, r *http.Request) {
	name, ok := labelName(r)
	if !ok {
		http.Error(w, "bad label name", http.StatusBadRequest)
		return
	}
	var body struct{ Name, Color *string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if body.Color != nil {
		if err := h.Index().SetLabelColor(name, *body.Color); err != nil {
			indexError(w, err)
			return
		}
	}
	if body.Name != nil && *body.Name != name {
		if err := h.Index().RenameLabel(name, *body.Name); err != nil {
			indexError(w, err)
			return
		}
	}
	_ = json.NewEncoder(w).Encode("OK")
}

func (h Handler) deleteLabelHandler(w http.ResponseWriter, r *http.Request) {
	name, ok := labelName(r)
	if !ok {
		http.Error(w, "bad label name", http.StatusBadRequest)
		return
	}
	if err := h.Index().DeleteLabel(name); err != nil {
		indexError(w, err)
		return
	}
	_ = json.NewEncoder(w).Encode("OK")
}
