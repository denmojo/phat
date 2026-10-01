package buildinfo

import "strings"

// EnvVar names an environment variable with the app's prefix, so
// EnvVar("DEBUG") is PHAT_DEBUG.
func EnvVar(name string) string { return strings.ToUpper(AppName) + "_" + name }
