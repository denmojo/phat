package directories

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// A Pat config copied on first run keeps Pat's settings but not Pat's web
// port: Phat moves itself to 8081 so both can run side by side as installed.
func TestMigrateFromPatMovesPhatOffPatsPort(t *testing.T) {
	for _, tc := range []struct{ pat, want string }{
		{"localhost:8080", "localhost:8081"},
		{":8080", ":8081"},
		{"0.0.0.0:8080", "0.0.0.0:8081"},
		{"localhost:9000", "localhost:9000"}, // a port Pat's user chose is left alone
	} {
		t.Run(tc.pat, func(t *testing.T) {
			home := t.TempDir()
			cfgHome := filepath.Join(home, "config")
			t.Setenv("XDG_CONFIG_HOME", cfgHome)
			t.Setenv("XDG_DATA_HOME", filepath.Join(home, "data"))
			resetForTest()
			patCfg := filepath.Join(cfgHome, "pat", "config.json")
			must(t, os.MkdirAll(filepath.Dir(patCfg), 0o755))
			orig := `{"mycall":"N0CALL","http_addr":"` + tc.pat + `"}`
			must(t, os.WriteFile(patCfg, []byte(orig), 0o644))

			if err := MigrateFromPat(); err != nil {
				t.Fatal(err)
			}

			b, err := os.ReadFile(filepath.Join(ConfigDir(), "config.json"))
			must(t, err)
			var got map[string]any
			must(t, json.Unmarshal(b, &got))
			if got["http_addr"] != tc.want {
				t.Errorf("http_addr = %v, want %s", got["http_addr"], tc.want)
			}
			if got["ask_use_pat"] != true {
				t.Errorf("ask_use_pat = %v, want true so the web page asks once", got["ask_use_pat"])
			}
			if got["mycall"] != "N0CALL" {
				t.Errorf("other settings lost: %v", got)
			}
			if b, _ := os.ReadFile(patCfg); string(b) != orig {
				t.Errorf("Pat's config.json changed: %s", b)
			}
		})
	}
}
