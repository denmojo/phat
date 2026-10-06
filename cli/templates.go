package cli

import (
	"context"
	"fmt"
	"log"
	"path/filepath"
	"strconv"

	"github.com/la5nta/pat/app"
	"github.com/la5nta/pat/internal/directories"
)

const (
	TemplatesUsage = `subcommand [option ...]

subcommands:
  update             Update standard Winlink form templates.
  from-pat           Replace Phat's form templates with a copy of Pat's.
  seqset [number]    Set the template sequence value.
`
	TemplatesExample = `
  update             Download the latest form templates.
  from-pat           Copy Pat's Standard_Forms, so Phat's forms match Pat's.
  seqset 0           Reset the current sequence value to 0.
`
)

func TemplatesHandle(ctx context.Context, app *app.App, args []string) {
	switch cmd, args := shiftArgs(args); cmd {
	case "update":
		if _, err := app.FormsManager().UpdateFormTemplates(ctx); err != nil {
			log.Printf("%v", err)
		}
	case "from-pat":
		dst := app.Options().FormsPath
		if err := directories.CopyFormsFromPat(dst); err != nil {
			log.Fatal(err)
		}
		log.Printf("Copied Pat's forms from %s to %s", filepath.Join(directories.PatDataDir(), "Standard_Forms"), dst)
	case "seqset":
		v, err := strconv.Atoi(args[0])
		if err != nil {
			log.Printf("invalid sequence number: %q", args[0])
			return
		}
		if err := app.FormsManager().SeqSet(v); err != nil {
			log.Fatal(err)
		}
	default:
		fmt.Println("Missing argument, try 'templates help'.")
	}
}
