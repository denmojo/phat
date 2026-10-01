package app

import (
	"os"
	"runtime"

	"github.com/la5nta/pat/internal/buildinfo"
)

func (a *App) Env() []string {
	v := func(name, value string) string { return buildinfo.EnvVar(name) + `="` + value + `"` }
	passthrough := func(name string) string { return name + `="` + os.Getenv(name) + `"` }
	return []string{
		v("MYCALL", a.options.MyCall),
		v("LOCATOR", a.config.Locator),
		v("VERSION", buildinfo.Version),
		v("ARCH", runtime.GOARCH),
		v("OS", runtime.GOOS),
		v("MAILBOX_PATH", a.options.MailboxPath),
		v("CONFIG_PATH", a.options.ConfigPath),
		v("LOG_PATH", a.options.LogPath),
		v("EVENTLOG_PATH", a.options.EventLogPath),
		v("FORMS_PATH", a.options.FormsPath),
		passthrough(buildinfo.EnvVar("DEBUG")),
		passthrough(buildinfo.EnvVar("WEB_DEV_ADDR")),

		passthrough("ARDOP_DEBUG"),
		passthrough("PACTOR_DEBUG"),
		passthrough("AGWPE_DEBUG"),
		passthrough("VARA_DEBUG"),

		passthrough("GZIP_EXPERIMENT"),
		passthrough("ARDOP_FSKONLY_EXPERIMENT"),
	}
}
