package app

import (
	"strings"
	"testing"
)

// Every variable Phat hands to hooks and prints from `phat env` carries
// the PHAT_ prefix, the same prefix its config overrides use.
func TestEnvUsesPhatPrefix(t *testing.T) {
	var a App
	a.options.MyCall = "N0CALL"
	env := a.Env()
	want := map[string]bool{"PHAT_MYCALL": false, "PHAT_CONFIG_PATH": false, "PHAT_DEBUG": false, "PHAT_WEB_DEV_ADDR": false}
	for _, kv := range env {
		name, _, _ := strings.Cut(kv, "=")
		if strings.HasPrefix(name, "PAT_") {
			t.Errorf("%s still uses Pat's prefix", name)
		}
		if _, ok := want[name]; ok {
			want[name] = true
		}
	}
	for name, seen := range want {
		if !seen {
			t.Errorf("%s missing from Env()", name)
		}
	}
}
