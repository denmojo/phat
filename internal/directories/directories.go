package directories

import (
	"errors"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/la5nta/pat/internal/buildinfo"
	"github.com/la5nta/pat/internal/debug"

	"github.com/adrg/xdg"
)

var (
	lock       = &sync.Mutex{}
	dataPath   string
	configPath string
	statePath  string
)

// IsInPath returns true if sub is a sub-path of parent.
//
// Both paths must be either absolute or relative.
func IsInPath(parent, sub string) bool {
	parent, sub = filepath.Clean(parent), filepath.Clean(sub)
	if filepath.IsAbs(parent) != filepath.IsAbs(sub) {
		panic("mix of rel and abs paths")
	}
	root, err := os.OpenRoot(parent)
	if err != nil {
		return false
	}
	defer root.Close()
	// Make sub relative to parent
	relSub, err := filepath.Rel(parent, sub)
	if err != nil {
		return false
	}
	switch _, err = root.Stat(relSub); {
	case err == nil:
		return true
	case errors.Is(err, os.ErrNotExist):
		return true // Path is within root, just not present
	default:
		return false
	}
}

func DataDir() string {
	return getDir(&dataPath, xdg.DataHome, "DataDir")
}

func ConfigDir() string {
	return getDir(&configPath, xdg.ConfigHome, "ConfigDir")
}

func StateDir() string {
	return getDir(&statePath, xdg.StateHome, "StateDir")
}

func getDir(dir *string, basePath string, methodName string) string {
	lock.Lock()
	defer lock.Unlock()
	if *dir == "" {
		initDir(dir, basePath, methodName)
	}
	return *dir
}

func initDir(dir *string, basePath string, methodName string) {
	*dir = filepath.Join(basePath, strings.ToLower(buildinfo.AppName))
	if _, err := os.Stat(*dir); os.IsNotExist(err) {
		err := os.MkdirAll(*dir, os.ModeDir|0o755)
		if err != nil {
			log.Fatalf("unable to create or open %s %s: %v", methodName, *dir, err)
		}
	}
}

func MigrateLegacyDataDir() {
	if f, err := os.Stat(ConfigDir()); err == nil && f.IsDir() {
		debug.Printf("new config directory %s already exists, we have already migrated", ConfigDir())
		return
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal(err)
	}
	legacyDataDir := filepath.Join(homeDir, ".wl2k")

	switch f, err := os.Stat(legacyDataDir); {
	case os.IsNotExist(err):
		debug.Printf("tried to migrate from %s but it doesn't exist; nothing to do", legacyDataDir)
		return
	case err != nil:
		log.Fatal(err)
	case !f.IsDir():
		log.Printf("tried to migrate from %s but it's not a directory, that's weird; ignoring", legacyDataDir)
		return
	}

	log.Printf("Migrating your Pat files from %s to new locations", legacyDataDir)
	if err = migrateFile("config.json", legacyDataDir, ConfigDir()); err != nil {
		log.Fatal(err)
	}
	if err = migrateFile("mailbox", legacyDataDir, DataDir()); err != nil {
		log.Fatal(err)
	}
	if err = migrateFile("Standard_Forms", legacyDataDir, DataDir()); err != nil {
		log.Fatal(err)
	}

	matches, err := filepath.Glob(filepath.Join(legacyDataDir, "rmslist*.json"))
	if err != nil {
		log.Fatal(err)
	}
	for _, match := range matches {
		_, f := filepath.Split(match)
		if err = migrateFile(f, legacyDataDir, DataDir()); err != nil {
			log.Fatal(err)
		}
	}

	debug.Printf("migration from %s finished, renaming it", legacyDataDir)
	err = os.Rename(legacyDataDir, legacyDataDir+"-old")
	if err != nil {
		log.Fatal(err)
	}
}

// MigrateFromPat copies config.json, the mailbox tree and the forms
// directory from Pat's XDG directories into Phat's on first run. It runs
// only when Phat has no config.json yet, copies rather than moves so Pat
// keeps working beside Phat, and is a no-op on every later start.
func MigrateFromPat() error {
	if _, err := os.Stat(filepath.Join(ConfigDir(), "config.json")); err == nil {
		return nil
	}
	patCfg := filepath.Join(xdg.ConfigHome, "pat")
	patData := filepath.Join(xdg.DataHome, "pat")
	if _, err := os.Stat(filepath.Join(patCfg, "config.json")); err != nil {
		return nil // no Pat install to migrate from
	}
	log.Printf("First run: copying Pat's files from %s and %s", patCfg, patData)
	if err := copyFile(filepath.Join(patCfg, "config.json"), filepath.Join(ConfigDir(), "config.json")); err != nil {
		return err
	}
	for _, name := range []string{"mailbox", "Standard_Forms"} {
		src := filepath.Join(patData, name)
		if _, err := os.Stat(src); err != nil {
			continue
		}
		if err := copyTree(src, filepath.Join(DataDir(), name)); err != nil {
			return err
		}
	}
	return nil
}

func copyFile(src, dst string) error {
	b, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	return os.WriteFile(dst, b, 0o644)
}

func copyTree(src, dst string) error {
	return filepath.WalkDir(src, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(src, p)
		target := filepath.Join(dst, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		return copyFile(p, target)
	})
}

func migrateFile(fileName string, fromDir string, toDir string) error {
	// make sure the old file is there
	fromFile := filepath.Join(fromDir, fileName)
	if _, err := os.Stat(fromFile); errors.Is(err, os.ErrNotExist) {
		// no legacy file, nothing to do
		debug.Printf("File %s doesn't exist, not migrating it", fromFile)
		return nil
	} else if err != nil {
		return err
	}

	// touch the new file to make sure it's not there, and we can write to it
	toFile := filepath.Join(toDir, fileName)
	switch f, err := os.OpenFile(toFile, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0o666); {
	case errors.Is(err, os.ErrExist):
		// new file already exists, don't clobber it
		debug.Printf("new file %s already exists; ignoring %s", toFile, fromFile)
		return nil
	case err != nil:
		return err
	default:
		if err := f.Close(); err != nil {
			return err
		}
		if err := os.Remove(toFile); err != nil {
			return err
		}
	}

	debug.Printf("Migrating %s from %s to %s", fileName, fromDir, toDir)
	return os.Rename(fromFile, toFile)
}
