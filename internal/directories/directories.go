package directories

import (
	"encoding/json"
	"errors"
	"io/fs"
	"log"
	"net"
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

// UsesDefaultPaths reports whether Phat runs on its default config file,
// mailbox and forms directory, the only case where Pat's are copied in.
func UsesDefaultPaths(configPath, mboxPath, formsPath string) bool {
	return filepath.Clean(configPath) == filepath.Join(ConfigDir(), "config.json") &&
		filepath.Clean(mboxPath) == filepath.Join(DataDir(), "mailbox") &&
		filepath.Clean(formsPath) == filepath.Join(DataDir(), "Standard_Forms")
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
	for _, name := range []string{"mailbox", "Standard_Forms"} {
		src := filepath.Join(patData, name)
		if _, err := os.Stat(src); err != nil {
			continue
		}
		dst := filepath.Join(DataDir(), name)
		// A tree Phat already holds is Phat's: copying into it would bring
		// back messages deleted in Phat.
		if entries, err := os.ReadDir(dst); err == nil && len(entries) > 0 {
			log.Printf("Phat already has %s; not copying Pat's", name)
			continue
		}
		// Copy beside the destination and rename into place, so a copy
		// that fails or is killed partway never looks like Phat's own.
		staging := dst + ".copying"
		if err := os.RemoveAll(staging); err != nil {
			return err
		}
		if err := copyTree(src, staging); err != nil {
			os.RemoveAll(staging)
			return err
		}
		os.Remove(dst) // an empty directory left by an earlier start
		if err := os.Rename(staging, dst); err != nil {
			return err
		}
	}
	// config.json goes last: once it exists, later starts skip the copy.
	dst := filepath.Join(ConfigDir(), "config.json")
	if err := copyFile(filepath.Join(patCfg, "config.json"), dst); err != nil {
		return err
	}
	return movePhatOffPatsPort(dst)
}

// movePhatOffPatsPort rewrites http_addr in Phat's copy of Pat's config from
// port 8080, Pat's default, to 8081, Phat's, keeping the host. Pat keeps
// running on 8080 as installed and Phat starts beside it with no flags. A
// port the user chose for Pat is left as it is.
func movePhatOffPatsPort(path string) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var cfg map[string]json.RawMessage
	if err := json.Unmarshal(b, &cfg); err != nil {
		return nil // not ours to repair; config loading reports it
	}
	var addr string
	if raw, ok := cfg["http_addr"]; !ok || json.Unmarshal(raw, &addr) != nil {
		return nil
	}
	host, port, err := net.SplitHostPort(addr)
	if err != nil || port != "8080" {
		return nil
	}
	cfg["http_addr"], _ = json.Marshal(net.JoinHostPort(host, "8081"))
	out, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	log.Printf("Phat's web port is 8081 (Pat keeps 8080): http_addr %s -> %s", addr, net.JoinHostPort(host, "8081"))
	return os.WriteFile(path, append(out, '\n'), 0o644)
}

// copyFile copies src to dst and never overwrites: a dst that already
// exists is left as it is, the same rule migrateFile follows.
func copyFile(src, dst string) error {
	b, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	f, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if errors.Is(err, os.ErrExist) {
		debug.Printf("%s already exists; not copying %s", dst, src)
		return nil
	} else if err != nil {
		return err
	}
	if _, err := f.Write(b); err != nil {
		f.Close()
		return err
	}
	return f.Close()
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
