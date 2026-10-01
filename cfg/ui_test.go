package cfg

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestUIAppearanceRoundTrip(t *testing.T) {
	var c Config
	if err := json.Unmarshal([]byte(`{"mycall":"N0CALL","ui":{"appearance":"dark"}}`), &c); err != nil {
		t.Fatal(err)
	}
	if c.UI.Appearance != "dark" {
		t.Fatalf("appearance = %q", c.UI.Appearance)
	}
	if DefaultConfig.UI.Appearance != "system" {
		t.Fatalf("default appearance = %q", DefaultConfig.UI.Appearance)
	}
	b, _ := json.Marshal(c)
	if !strings.Contains(string(b), `"ui":{"appearance":"dark"}`) {
		t.Fatalf("serialized: %s", b)
	}
}
