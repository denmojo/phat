package directories

import (
	"os"
	"path/filepath"
	"testing"
)

// migration copies Pat's config, mailbox and forms into Phat's directories
// when Phat's are empty, and leaves Pat's untouched.
func TestMigrateFromPat(t *testing.T) {
	home := t.TempDir()
	cfgHome := filepath.Join(home, "config")
	dataHome := filepath.Join(home, "data")
	t.Setenv("XDG_CONFIG_HOME", cfgHome)
	t.Setenv("XDG_DATA_HOME", dataHome)
	resetForTest()

	patCfg := filepath.Join(cfgHome, "pat")
	patData := filepath.Join(dataHome, "pat")
	must(t, os.MkdirAll(filepath.Join(patData, "mailbox", "N0CALL", "in"), 0o755))
	must(t, os.MkdirAll(filepath.Join(patData, "Standard_Forms"), 0o755))
	must(t, os.MkdirAll(patCfg, 0o755))
	must(t, os.WriteFile(filepath.Join(patCfg, "config.json"), []byte(`{"mycall":"N0CALL"}`), 0o644))
	must(t, os.WriteFile(filepath.Join(patData, "mailbox", "N0CALL", "in", "ABC.b2f"), []byte("x"), 0o644))

	if err := MigrateFromPat(); err != nil {
		t.Fatal(err)
	}

	for _, p := range []string{
		filepath.Join(ConfigDir(), "config.json"),
		filepath.Join(DataDir(), "mailbox", "N0CALL", "in", "ABC.b2f"),
		filepath.Join(DataDir(), "Standard_Forms"),
	} {
		if _, err := os.Stat(p); err != nil {
			t.Errorf("expected %s after migration: %v", p, err)
		}
	}
	if _, err := os.Stat(filepath.Join(patCfg, "config.json")); err != nil {
		t.Errorf("Pat's config.json must be left in place: %v", err)
	}
	// Second run is a no-op and must not error.
	if err := MigrateFromPat(); err != nil {
		t.Fatal(err)
	}
}

func TestMigrateFromPatSkipsWhenPhatHasConfig(t *testing.T) {
	home := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, "config"))
	t.Setenv("XDG_DATA_HOME", filepath.Join(home, "data"))
	resetForTest()
	must(t, os.MkdirAll(filepath.Join(home, "config", "pat"), 0o755))
	must(t, os.WriteFile(filepath.Join(home, "config", "pat", "config.json"), []byte(`{"mycall":"OLD"}`), 0o644))
	must(t, os.MkdirAll(ConfigDir(), 0o755))
	must(t, os.WriteFile(filepath.Join(ConfigDir(), "config.json"), []byte(`{"mycall":"NEW"}`), 0o644))

	if err := MigrateFromPat(); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(filepath.Join(ConfigDir(), "config.json"))
	if string(b) != `{"mycall":"NEW"}` {
		t.Fatalf("Phat's config was overwritten: %s", b)
	}
}

// A user who deletes Phat's config.json to start over must not get Pat's
// older mailbox copied over the mail Phat already holds.
func TestMigrateFromPatNeverOverwritesPhatMail(t *testing.T) {
	home := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, "config"))
	t.Setenv("XDG_DATA_HOME", filepath.Join(home, "data"))
	resetForTest()
	patCfg := filepath.Join(home, "config", "pat")
	patIn := filepath.Join(home, "data", "pat", "mailbox", "N0CALL", "in")
	must(t, os.MkdirAll(patCfg, 0o755))
	must(t, os.MkdirAll(patIn, 0o755))
	must(t, os.WriteFile(filepath.Join(patCfg, "config.json"), []byte(`{"mycall":"N0CALL"}`), 0o644))
	must(t, os.WriteFile(filepath.Join(patIn, "ABC.b2f"), []byte("pat copy"), 0o644))
	must(t, os.WriteFile(filepath.Join(patIn, "DEL.b2f"), []byte("deleted in phat"), 0o644))

	phatIn := filepath.Join(DataDir(), "mailbox", "N0CALL", "in")
	must(t, os.MkdirAll(phatIn, 0o755))
	must(t, os.WriteFile(filepath.Join(phatIn, "ABC.b2f"), []byte("phat copy"), 0o644))

	if err := MigrateFromPat(); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(filepath.Join(phatIn, "ABC.b2f"))
	if string(b) != "phat copy" {
		t.Fatalf("Phat's message was overwritten: %q", b)
	}
	if _, err := os.Stat(filepath.Join(phatIn, "DEL.b2f")); err == nil {
		t.Fatal("a message deleted in Phat came back from Pat's mailbox")
	}
}

func must(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}
