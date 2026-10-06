package forms

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/adrg/xdg"
)

// Pointed at Pat's forms folder, Phat leaves updating it to Pat: an update
// is refused before anything is downloaded or written.
func TestUpdateRefusesPatsFormsFolder(t *testing.T) {
	data := t.TempDir()
	t.Setenv("XDG_DATA_HOME", data)
	xdg.Reload()
	t.Cleanup(xdg.Reload)
	pats := filepath.Join(data, "pat", "Standard_Forms")
	if err := os.MkdirAll(pats, 0o755); err != nil {
		t.Fatal(err)
	}

	m := NewManager(Config{FormsPath: pats})
	if _, err := m.UpdateFormTemplates(context.Background()); !errors.Is(err, ErrPatsForms) {
		t.Fatalf("err = %v, want ErrPatsForms", err)
	}
	if entries, _ := os.ReadDir(pats); len(entries) != 0 {
		t.Errorf("Pat's forms folder changed: %v", entries)
	}
}
