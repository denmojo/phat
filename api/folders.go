package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gorilla/mux"

	"github.com/la5nta/pat/internal/mailindex"
)

type folderJSON struct {
	Name   string `json:"name"`
	System bool   `json:"system"`
	Count  int    `json:"count"`
	Unread int    `json:"unread"`
}

// indexError maps mailindex sentinels onto HTTP statuses.
func indexError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, mailindex.ErrNotFound):
		http.Error(w, err.Error(), http.StatusNotFound)
	case errors.Is(err, mailindex.ErrInvalidFolderName):
		http.Error(w, err.Error(), http.StatusBadRequest)
	case errors.Is(err, mailindex.ErrFolderExists), errors.Is(err, mailindex.ErrFolderNotEmpty):
		http.Error(w, err.Error(), http.StatusConflict)
	case errors.Is(err, mailindex.ErrSystemFolder):
		http.Error(w, err.Error(), http.StatusForbidden)
	default:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (h Handler) foldersHandler(w http.ResponseWriter, r *http.Request) {
	names, err := h.Index().Folders()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	counts, err := h.Index().FolderCounts()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	out := make([]folderJSON, 0, len(names))
	for _, n := range names {
		c := counts[n]
		out = append(out, folderJSON{n, mailindex.IsSystemFolder(n), c.Total, c.Unread})
	}
	_ = json.NewEncoder(w).Encode(out)
}

func (h Handler) createFolderHandler(w http.ResponseWriter, r *http.Request) {
	var body struct{ Name string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.Index().CreateFolder(body.Name); err != nil {
		indexError(w, err)
		return
	}
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(folderJSON{Name: body.Name})
}

func (h Handler) renameFolderHandler(w http.ResponseWriter, r *http.Request) {
	var body struct{ Name string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := h.Index().RenameFolder(mux.Vars(r)["name"], body.Name); err != nil {
		indexError(w, err)
		return
	}
	_ = json.NewEncoder(w).Encode("OK")
}

func (h Handler) deleteFolderHandler(w http.ResponseWriter, r *http.Request) {
	if err := h.Index().DeleteFolder(mux.Vars(r)["name"]); err != nil {
		indexError(w, err)
		return
	}
	_ = json.NewEncoder(w).Encode("OK")
}
