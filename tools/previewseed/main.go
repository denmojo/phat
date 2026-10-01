// Command previewseed fills a throwaway mailbox with test traffic for the
// preview server: messages from several stations across the system folders
// and three custom folders, unread mail, attachments, stars and labels.
//
// Usage: go run ./tools/previewseed <mailbox-root> <mycall>
package main

import (
	"bytes"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/la5nta/pat/internal/mailindex"
	"github.com/la5nta/wl2k-go/fbb"
	"github.com/la5nta/wl2k-go/mailbox"
)

type seed struct {
	folder  string
	from    string
	to      []string
	cc      []string
	subject string
	body    string
	age     time.Duration
	unread  bool
	star    bool
	labels  []string
	files   []*fbb.File
	p2p     bool
}

func main() {
	if len(os.Args) != 3 {
		log.Fatal("usage: previewseed <mailbox-root> <mycall>")
	}
	mycall := os.Args[2]
	dir := filepath.Join(os.Args[1], mycall)
	if err := mailbox.NewDirHandler(dir, false).Prepare(); err != nil {
		log.Fatal(err)
	}
	ix, err := mailindex.Open(dir)
	if err != nil {
		log.Fatal(err)
	}
	defer ix.Close()
	for _, f := range []string{"ARES", "Radio Club", "Training"} {
		if err := ix.CreateFolder(f); err != nil && err != mailindex.ErrFolderExists {
			log.Fatal(err)
		}
	}
	for _, l := range []struct{ name, color string }{
		{"net-control", "#2563eb"}, {"urgent", "#dc2626"}, {"logistics", "#16a34a"},
		{"follow up", "#d97706"}, {"personal", "#7c3aed"},
	} {
		_ = ix.CreateLabel(l.name, l.color)
	}

	now := time.Now()
	h := time.Hour
	d := 24 * h
	seeds := []seed{
		{folder: "in", from: "EOC-1", to: []string{mycall}, subject: "ICS-213: Shelter status at Central High", body: "Shelter opened 0600. 42 occupants, 6 with medical needs. Requesting 2 cots and a generator fuel run before 1800.\n\nNet control please acknowledge.\n\n73, EOC-1", age: 2 * h, unread: true, star: true, labels: []string{"urgent", "net-control"}},
		{folder: "in", from: "NETCTL", to: []string{mycall}, subject: "Re: Sunday net checklist", body: "Looks good. I added the repeater offset to the script.\n\n> Can you look over the checklist before Sunday?\n> --- N0CALL", age: 5 * h, unread: true, labels: []string{"net-control"}},
		{folder: "in", from: "SERVICE", to: []string{mycall}, subject: "Winlink system notice: CMS maintenance window", body: "The Winlink CMS will be in maintenance Saturday 0300 to 0400 UTC. Radio-only (Hybrid) forwarding continues during this time.", age: 9 * h, unread: true},
		{folder: "in", from: "N1CALL", to: []string{mycall}, cc: []string{"CLUB"}, subject: "Antenna photos from the field day site", body: "Photos of the end-fed setup attached. The tuner sat at 1.4:1 across 40m.", age: 20 * h, files: []*fbb.File{fbb.NewFile("efhw-mast.png", pngBytes(color.RGBA{37, 99, 235, 255})), fbb.NewFile("tuner-readings.txt", []byte("7.040 1.3\n7.150 1.4\n7.250 1.5\n"))}, labels: []string{"personal"}},
		{folder: "in", from: "CLUB", to: []string{mycall, "N1CALL"}, subject: "Club meeting moved to Thursday", body: "The library room is booked Tuesday, so we moved to Thursday 1900 local. Same agenda.", age: 30 * h, star: true, labels: []string{"follow up"}},
		{folder: "in", from: "EOC-1", to: []string{mycall}, subject: "Resource request: 4x 5-gallon water", body: "Please relay to logistics: four 5-gallon water containers for the North POD by 1200 tomorrow.", age: 2 * d, labels: []string{"logistics"}},
		{folder: "in", from: "N2CALL", to: []string{mycall}, subject: "VARA HF settings that worked", body: "Drive level 35%, ALC flat, 2300 Hz bandwidth to the valley gateway. Connected first try on 3.590.", age: 3 * d},
		{folder: "in", from: "N3CALL", to: []string{mycall}, subject: "P2P test from the hilltop", body: "Testing peer to peer from the ridge. Signal report 59 on your end?", age: 4 * d, p2p: true},
		{folder: "in", from: "SERVICE", to: []string{mycall}, subject: "Your Winlink password was changed", body: "This confirms the password change for your account. If you did not request it, contact Winlink support.", age: 6 * d},
		{folder: "in", from: "EOC-1", to: []string{mycall}, subject: "Damage assessment form, River Road", body: "Levee seepage observed at mile 4.2, no breach. County engineer notified. Form data attached.", age: 7 * d, files: []*fbb.File{fbb.NewFile("damage-assessment.csv", []byte("location,status,notes\nmile 4.2,seepage,no breach\nmile 5.0,ok,\n"))}, labels: []string{"urgent"}},
		{folder: "in", from: "NETCTL", to: []string{mycall}, subject: "Lunch Saturday?", body: "Swap meet runs till noon. Want to grab lunch after?", age: 8 * d, labels: []string{"personal"}},
		{folder: "in", from: "N4CALL", to: []string{mycall}, subject: "Grid square for the contest log", body: "You were FN31 in the log, I think it should be FN31pr. Can you confirm?", age: 11 * d},

		{folder: "out", from: mycall, to: []string{"EOC-1"}, subject: "ACK: Shelter status at Central High", body: "Acknowledged. Fuel run scheduled 1500. Cots from the North cache.\n\nN0CALL", age: 1 * h},
		{folder: "out", from: mycall, to: []string{"NETCTL", "CLUB"}, subject: "Draft agenda for Thursday", body: "1. Field day recap\n2. Repeater battery replacement\n3. ARES training schedule", age: 3 * h},

		{folder: "sent", from: mycall, to: []string{"EOC-1"}, subject: "Net report 09/27", body: "14 check-ins, no traffic. Net closed 1932.", age: 3 * d},
		{folder: "sent", from: mycall, to: []string{"N1CALL"}, subject: "Re: Antenna photos from the field day site", body: "Great pictures. What coax run were you using?", age: 19 * h},
		{folder: "sent", from: mycall, to: []string{"CLUB"}, subject: "Repeater battery quote", body: "Two quotes: 100Ah LiFePO4 at $289 and $315. Recommend the first.", age: 5 * d, labels: []string{"follow up"}},
		{folder: "sent", from: mycall, to: []string{"SERVICE"}, subject: "Password recovery email update", body: "Updating recovery address.", age: 6 * d},

		{folder: "archive", from: "EOC-1", to: []string{mycall}, subject: "Exercise debrief: Fall Shakeout", body: "Thanks to all 23 stations. Average message latency was 14 minutes over HF.", age: 21 * d, star: true},
		{folder: "archive", from: "CLUB", to: []string{mycall}, subject: "Dues reminder", body: "Annual dues of $25 are due by October 31.", age: 25 * d},
		{folder: "archive", from: "N2CALL", to: []string{mycall}, subject: "Pactor modem for sale", body: "Selling a P4dragon, lightly used. Make an offer.", age: 28 * d},

		{folder: "ARES", from: "EOC-1", to: []string{mycall}, subject: "Monthly ARES roster", body: "Roster attached. Please confirm your availability for October.", age: 4 * d, files: []*fbb.File{fbb.NewFile("roster-october.txt", []byte("N0CALL  available\nNETCTL  available\nN1CALL   weekends\n"))}, labels: []string{"net-control"}},
		{folder: "ARES", from: "EOC-1", to: []string{mycall}, subject: "Served agency contact list", body: "Updated contacts for county OES and the Red Cross chapter.", age: 12 * d, unread: true},
		{folder: "Radio Club", from: "CLUB", to: []string{mycall}, subject: "Field day results", body: "We placed 4th in 3A for the section. 1,212 QSOs.", age: 14 * d, star: true},
		{folder: "Radio Club", from: "N4CALL", to: []string{mycall}, subject: "Elmer night topics", body: "Proposed: digital modes on HF, Winlink basics, antenna tuning.", age: 16 * d},
		{folder: "Training", from: "NETCTL", to: []string{mycall}, subject: "Winlink drill script v2", body: "Step 1: compose ICS-213. Step 2: send via VARA HF. Step 3: confirm receipt on the net.", age: 9 * d, labels: []string{"net-control"}},
	}

	for _, s := range seeds {
		msg := fbb.NewMessage(fbb.Private, s.from)
		msg.AddTo(s.to...)
		if len(s.cc) > 0 {
			msg.AddCc(s.cc...)
		}
		msg.SetSubject(s.subject)
		if err := msg.SetBody(s.body); err != nil {
			log.Fatal(err)
		}
		msg.SetDate(now.Add(-s.age))
		for _, f := range s.files {
			msg.AddFile(f)
		}
		if s.unread {
			msg.Header.Set("X-Unread", "true")
		}
		if s.p2p {
			msg.Header.Set("X-P2POnly", "true")
		}
		data, err := msg.Bytes()
		if err != nil {
			log.Fatal(err)
		}
		p := filepath.Join(dir, s.folder, msg.MID()+mailbox.Ext)
		if err := os.WriteFile(p, data, 0o644); err != nil {
			log.Fatal(err)
		}
		if _, err := ix.Reconcile(); err != nil {
			log.Fatal(err)
		}
		if s.star {
			must(ix.SetStarred([]string{msg.MID()}, true))
		}
		if len(s.labels) > 0 {
			must(ix.AddLabels([]string{msg.MID()}, s.labels))
		}
	}
	fmt.Printf("seeded %d messages into %s\n", len(seeds), dir)
}

// pngBytes draws a small solid image so the preview shows an inline image
// attachment.
func pngBytes(c color.Color) []byte {
	img := image.NewRGBA(image.Rect(0, 0, 160, 100))
	for y := 0; y < 100; y++ {
		for x := 0; x < 160; x++ {
			img.Set(x, y, c)
		}
	}
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}

func must(err error) {
	if err != nil {
		log.Fatal(err)
	}
}
