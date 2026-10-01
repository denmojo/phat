package directories

import "github.com/adrg/xdg"

// resetForTest clears the cached directories and re-reads XDG env, so a
// test can point the package at a temp home.
func resetForTest() {
	lock.Lock()
	dataPath, configPath, statePath = "", "", ""
	lock.Unlock()
	xdg.Reload()
}
