package directories

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/adrg/xdg"
)

// Pat keeps working beside Phat with its own key, so a working Pat holds
// what Phat can't fetch for itself: a current RMS gateway list. These
// helpers copy from Pat's folders into Phat's and never write to Pat's.

var (
	ErrNoPatRMSList = errors.New("Pat has no saved RMS list yet: open the RMS list in Pat once (or run `pat rmslist`) so Pat downloads one")
	ErrNoPatForms   = errors.New("no Standard_Forms folder in Pat's data folder")
	ErrFormsArePats = errors.New("Phat already uses Pat's forms folder; there is nothing to copy")
)

// PatConfigDir and PatDataDir are where an installed Pat keeps its config
// and its data (mailbox, forms, RMS lists).
func PatConfigDir() string { return filepath.Join(xdg.ConfigHome, "pat") }
func PatDataDir() string   { return filepath.Join(xdg.DataHome, "pat") }

func patRMSLists() ([]string, error) {
	return filepath.Glob(filepath.Join(PatDataDir(), "rmslist*.json"))
}

// CopyRMSListFromPat replaces Phat's saved RMS lists with Pat's current
// ones and returns the files it wrote.
func CopyRMSListFromPat() ([]string, error) {
	srcs, err := patRMSLists()
	if err != nil {
		return nil, err
	}
	if len(srcs) == 0 {
		return nil, ErrNoPatRMSList
	}
	if err := os.MkdirAll(DataDir(), 0o755); err != nil {
		return nil, err
	}
	var wrote []string
	for _, src := range srcs {
		dst := filepath.Join(DataDir(), filepath.Base(src))
		b, err := os.ReadFile(src)
		if err != nil {
			return wrote, err
		}
		tmp := dst + ".copying"
		if err := os.WriteFile(tmp, b, 0o644); err != nil {
			return wrote, err
		}
		if err := os.Rename(tmp, dst); err != nil {
			os.Remove(tmp)
			return wrote, err
		}
		wrote = append(wrote, dst)
	}
	return wrote, nil
}

// CopyFormsFromPat replaces the forms folder dst with a copy of Pat's
// Standard_Forms. The old folder is swapped out only once the copy is
// complete, so a failed copy leaves Phat's forms as they were.
func CopyFormsFromPat(dst string) error {
	src := filepath.Join(PatDataDir(), "Standard_Forms")
	if st, err := os.Stat(src); err != nil || !st.IsDir() {
		return ErrNoPatForms
	}
	if same, _ := sameDir(src, dst); same {
		return ErrFormsArePats
	}
	staging, old := dst+".copying", dst+".old"
	if err := os.RemoveAll(staging); err != nil {
		return err
	}
	if err := copyTree(src, staging); err != nil {
		os.RemoveAll(staging)
		return fmt.Errorf("copying Pat's forms: %w", err)
	}
	os.RemoveAll(old)
	if err := os.Rename(dst, old); err != nil && !os.IsNotExist(err) {
		os.RemoveAll(staging)
		return err
	}
	if err := os.Rename(staging, dst); err != nil {
		os.Rename(old, dst)
		return err
	}
	return os.RemoveAll(old)
}

func sameDir(a, b string) (bool, error) {
	sa, err := os.Stat(a)
	if err != nil {
		return false, err
	}
	sb, err := os.Stat(b)
	if err != nil {
		return false, err
	}
	return os.SameFile(sa, sb), nil
}
