package directories

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

// patHome sets up empty XDG homes and returns Pat's config and data folders.
func patHome(t *testing.T) (patCfg, patData string) {
	t.Helper()
	home := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(home, "config"))
	t.Setenv("XDG_DATA_HOME", filepath.Join(home, "data"))
	resetForTest()
	patCfg = filepath.Join(home, "config", "pat")
	patData = filepath.Join(home, "data", "pat")
	must(t, os.MkdirAll(patCfg, 0o755))
	must(t, os.MkdirAll(patData, 0o755))
	return patCfg, patData
}

func read(t *testing.T, p string) string {
	t.Helper()
	b, err := os.ReadFile(p)
	must(t, err)
	return string(b)
}

// First run brings Pat's saved RMS lists along with the mailbox and forms.
func TestMigrateFromPatCopiesRMSList(t *testing.T) {
	patCfg, patData := patHome(t)
	must(t, os.WriteFile(filepath.Join(patCfg, "config.json"), []byte(`{"mycall":"N0CALL"}`), 0o644))
	must(t, os.WriteFile(filepath.Join(patData, "rmslist.json"), []byte("public"), 0o644))
	must(t, os.WriteFile(filepath.Join(patData, "rmslist-PUBLIC-EMCOMM.json"), []byte("emcomm"), 0o644))

	must(t, MigrateFromPat())

	if got := read(t, filepath.Join(DataDir(), "rmslist.json")); got != "public" {
		t.Errorf("rmslist.json = %q", got)
	}
	if got := read(t, filepath.Join(DataDir(), "rmslist-PUBLIC-EMCOMM.json")); got != "emcomm" {
		t.Errorf("rmslist-PUBLIC-EMCOMM.json = %q", got)
	}
}

func TestCopyRMSListFromPatReplacesPhats(t *testing.T) {
	_, patData := patHome(t)
	must(t, os.MkdirAll(DataDir(), 0o755))
	must(t, os.WriteFile(filepath.Join(DataDir(), "rmslist.json"), []byte("old"), 0o644))
	must(t, os.WriteFile(filepath.Join(patData, "rmslist.json"), []byte("new"), 0o644))

	got, err := CopyRMSListFromPat()
	must(t, err)
	if len(got) != 1 || filepath.Base(got[0]) != "rmslist.json" {
		t.Errorf("copied %v", got)
	}
	if s := read(t, filepath.Join(DataDir(), "rmslist.json")); s != "new" {
		t.Errorf("Phat's rmslist.json = %q, want Pat's", s)
	}
	if s := read(t, filepath.Join(patData, "rmslist.json")); s != "new" {
		t.Errorf("Pat's rmslist.json changed: %q", s)
	}
}

func TestCopyRMSListFromPatWithoutPatList(t *testing.T) {
	patHome(t)
	if _, err := CopyRMSListFromPat(); !errors.Is(err, ErrNoPatRMSList) {
		t.Errorf("got %v, want ErrNoPatRMSList", err)
	}
}

func TestCopyFormsFromPatReplacesPhats(t *testing.T) {
	_, patData := patHome(t)
	must(t, os.MkdirAll(filepath.Join(patData, "Standard_Forms", "ICS"), 0o755))
	must(t, os.WriteFile(filepath.Join(patData, "Standard_Forms", "ICS", "ICS213.txt"), []byte("pat"), 0o644))
	dst := filepath.Join(DataDir(), "Standard_Forms")
	must(t, os.MkdirAll(filepath.Join(dst, "Stale"), 0o755))
	must(t, os.WriteFile(filepath.Join(dst, "Stale", "old.txt"), []byte("old"), 0o644))

	must(t, CopyFormsFromPat(dst))

	if s := read(t, filepath.Join(dst, "ICS", "ICS213.txt")); s != "pat" {
		t.Errorf("ICS213.txt = %q", s)
	}
	if _, err := os.Stat(filepath.Join(dst, "Stale")); !os.IsNotExist(err) {
		t.Errorf("Phat's old forms should be replaced, Stale still there: %v", err)
	}
	if s := read(t, filepath.Join(patData, "Standard_Forms", "ICS", "ICS213.txt")); s != "pat" {
		t.Errorf("Pat's forms changed: %q", s)
	}
	for _, leftover := range []string{dst + ".copying", dst + ".old"} {
		if _, err := os.Stat(leftover); !os.IsNotExist(err) {
			t.Errorf("leftover %s", leftover)
		}
	}
}

func TestCopyFormsFromPatRefusesPatsOwnFolder(t *testing.T) {
	_, patData := patHome(t)
	src := filepath.Join(patData, "Standard_Forms")
	must(t, os.MkdirAll(src, 0o755))
	if err := CopyFormsFromPat(src); !errors.Is(err, ErrFormsArePats) {
		t.Errorf("got %v, want ErrFormsArePats", err)
	}
}

func TestCopyFormsFromPatWithoutPatForms(t *testing.T) {
	patHome(t)
	if err := CopyFormsFromPat(filepath.Join(DataDir(), "Standard_Forms")); !errors.Is(err, ErrNoPatForms) {
		t.Errorf("got %v, want ErrNoPatForms", err)
	}
}
