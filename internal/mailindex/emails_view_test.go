package mailindex

import "testing"

// The emails view gives an outside user one flat row per message, so plain
// SQL works without knowing how the index splits its tables.
func TestEmailsViewIsPlainSQL(t *testing.T) {
	mb := newMailbox(t)
	a := writeMsg(t, mb, "in", "Generator fuel", "Need 5 gallons by 1800", true)
	writeMsg(t, mb, "archive", "Old news", "nothing here", false)
	ix := openReconciled(t, mb)
	if err := ix.SetStarred([]string{a}, true); err != nil {
		t.Fatal(err)
	}
	if err := ix.AddLabels([]string{a}, []string{"logistics", "urgent"}); err != nil {
		t.Fatal(err)
	}

	var mid, folder, sender, recipients, subject, sentAt, body, labels string
	var unread, starred, attachments int
	err := ix.db.QueryRow(`SELECT mid, folder, sender, recipients, subject, sent_at, body, unread, starred, labels, attachments
		FROM emails WHERE sender = 'N0CALL' AND body LIKE '%gallons%'`).
		Scan(&mid, &folder, &sender, &recipients, &subject, &sentAt, &body, &unread, &starred, &labels, &attachments)
	if err != nil {
		t.Fatal(err)
	}
	if mid != a || folder != "in" || recipients != "N8CALL" || subject != "Generator fuel" || body != "Need 5 gallons by 1800\n" ||
		unread != 1 || starred != 1 || labels != "logistics, urgent" || attachments != 0 || len(sentAt) != len("2006-01-02 15:04:05") {
		t.Fatalf("row: %q %q %q %q %q %q %d %d %q %d", mid, folder, recipients, subject, sentAt, body, unread, starred, labels, attachments)
	}

	var n int
	if err := ix.db.QueryRow(`SELECT count(*) FROM emails`).Scan(&n); err != nil || n != 2 {
		t.Fatalf("count %d, %v", n, err)
	}
}
