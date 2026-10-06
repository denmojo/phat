package api

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/la5nta/pat/internal/directories"
	"github.com/la5nta/pat/internal/forms"
)

// usesPatsForms reports whether Phat's forms folder is Pat's. Tests swap it.
var usesPatsForms = directories.IsPatsForms

// formsUpdateHandler updates the forms. When Phat uses Pat's forms folder
// and connects through Pat, Pat runs the update, so only Pat writes into
// its own folder, and the answer says the forms are Pat's.
func (h Handler) formsUpdateHandler(w http.ResponseWriter, r *http.Request) {
	if relay := h.wsHub.relay; relay != nil && usesPatsForms(h.Options().FormsPath) {
		relay.updateForms(w, r)
		return
	}
	h.FormsManager().UpdateFormTemplatesHandler(w, r)
}

// updateForms asks Pat to update its forms and passes Pat's answer on,
// marked as Pat's.
func (r *patRelay) updateForms(w http.ResponseWriter, req *http.Request) {
	if req.Header.Get(relayHeader) != "" {
		http.Error(w, "connect_via points back at this Phat", http.StatusLoopDetected)
		return
	}
	out, err := http.NewRequestWithContext(req.Context(), http.MethodPost, r.endpoint("/api/formsUpdate", nil), nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	out.Header.Set(relayHeader, "1")
	log.Printf("Updating forms through Pat at %s", r.base)
	resp, err := r.client.Do(out)
	if err != nil {
		http.Error(w, fmt.Sprintf("These forms belong to Pat, and Pat isn't running at %s. Start Pat, then update forms again.", r.base), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	var v struct {
		forms.UpdateResponse
		Owner string `json:"owner"`
	}
	if resp.StatusCode != http.StatusOK || json.NewDecoder(resp.Body).Decode(&v.UpdateResponse) != nil {
		http.Error(w, fmt.Sprintf("Pat couldn't update its forms (%s). Try Update forms in Pat.", resp.Status), http.StatusBadGateway)
		return
	}
	v.Owner = "pat"
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
