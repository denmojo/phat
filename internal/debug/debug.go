package debug

import (
	"log"
	"os"
	"strconv"

	"github.com/la5nta/pat/internal/buildinfo"
)

const Prefix = "[DEBUG] "

var EnvVar = buildinfo.EnvVar("DEBUG")

var enabled bool

func init() {
	enabled, _ = strconv.ParseBool(os.Getenv(EnvVar))
}

func Enabled() bool { return enabled }

func Printf(format string, v ...interface{}) {
	if !enabled {
		return
	}
	log.Printf(Prefix+format, v...)
}
