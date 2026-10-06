package app

import (
	"testing"

	"github.com/la5nta/pat/cfg"
)

func TestConfigFoldersApplyUnlessFlagged(t *testing.T) {
	c := cfg.Config{MailboxPath: "/pat/mailbox", FormsPath: "/pat/Standard_Forms"}
	def := Options{MailboxPath: "/phat/mailbox", FormsPath: "/phat/Standard_Forms"}

	got := applyConfigFolders(def, c)
	if got.MailboxPath != "/pat/mailbox" || got.FormsPath != "/pat/Standard_Forms" {
		t.Errorf("config folders not applied: %+v", got)
	}

	flagged := def
	flagged.MailboxPathSet, flagged.FormsPathSet = true, true
	got = applyConfigFolders(flagged, c)
	if got.MailboxPath != "/phat/mailbox" || got.FormsPath != "/phat/Standard_Forms" {
		t.Errorf("flags must win over the config: %+v", got)
	}

	got = applyConfigFolders(def, cfg.Config{})
	if got.MailboxPath != "/phat/mailbox" || got.FormsPath != "/phat/Standard_Forms" {
		t.Errorf("empty config settings must keep the defaults: %+v", got)
	}
}
