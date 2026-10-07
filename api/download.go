package api

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net/http"
	"net/textproto"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/la5nta/pat/internal/mailindex"
	"github.com/la5nta/wl2k-go/fbb"
	"github.com/la5nta/wl2k-go/mailbox"
)

// downloadFormats maps each format a message downloads as to its content
// type. b2f is the file as stored; eml and txt are built from it.
var downloadFormats = map[string]string{
	"b2f": "application/octet-stream",
	"eml": "message/rfc822",
	"txt": "text/plain; charset=utf-8",
}

// downloadHandler serves the messages named by repeated mid parameters in
// the format the format parameter names. One message comes back as its own
// file, two or more as one zip holding a file per message. Every message
// is read before anything is written, so a missing one fails the whole
// request with nothing sent.
func (h Handler) downloadHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	format, mids := q.Get("format"), q["mid"]
	ctype, ok := downloadFormats[format]
	if !ok {
		http.Error(w, "format must be b2f, eml or txt", http.StatusBadRequest)
		return
	}
	if len(mids) == 0 {
		http.Error(w, "no messages named", http.StatusBadRequest)
		return
	}

	type file struct {
		name string
		date time.Time
		data []byte
	}
	files := make([]file, 0, len(mids))
	for _, mid := range mids {
		data, date, err := h.renderDownload(mid, format)
		if errors.Is(err, mailindex.ErrNotFound) || os.IsNotExist(err) {
			http.Error(w, "no message "+mid, http.StatusNotFound)
			return
		} else if err != nil {
			http.Error(w, fmt.Sprintf("%s: %v", mid, err), http.StatusInternalServerError)
			return
		}
		files = append(files, file{mid + "." + format, date, data})
	}

	if len(files) == 1 {
		f := files[0]
		w.Header().Set("Content-Type", ctype)
		w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": f.name}))
		_, _ = w.Write(f.data)
		return
	}
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, f := range files {
		fw, err := zw.CreateHeader(&zip.FileHeader{Name: f.name, Method: zip.Deflate, Modified: f.date})
		if err == nil {
			_, err = fw.Write(f.data)
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	if err := zw.Close(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": "messages.zip"}))
	_, _ = w.Write(buf.Bytes())
}

// renderDownload reads one message through the index, which also keeps a
// mid from naming a path outside the mailbox, and renders it in format.
func (h Handler) renderDownload(mid, format string) ([]byte, time.Time, error) {
	row, err := h.Index().Get(mid)
	if err != nil {
		return nil, time.Time{}, err
	}
	p := filepath.Join(h.Index().FolderDir(row.Folder), mid+mailbox.Ext)
	if format == "b2f" {
		data, err := os.ReadFile(p)
		return data, row.Date, err
	}
	msg, err := mailbox.OpenMessage(p)
	if err != nil {
		return nil, time.Time{}, err
	}
	body, err := msg.Body()
	if err != nil {
		return nil, time.Time{}, err
	}
	// Winlink bodies end lines with CRLF; both builders start from LF.
	body = strings.ReplaceAll(body, "\r\n", "\n")
	if format == "txt" {
		return renderTXT(msg, body), msg.Date(), nil
	}
	data, err := renderEML(msg, body)
	return data, msg.Date(), err
}

// emailAddr gives a Winlink address its internet form: a bare callsign is
// a winlink.org mailbox, and an internet address stays as it is.
func emailAddr(a fbb.Address) string {
	if strings.Contains(a.Addr, "@") {
		return a.Addr
	}
	return a.Addr + "@winlink.org"
}

func joinAddrs(addrs []fbb.Address, form func(fbb.Address) string) string {
	s := make([]string, len(addrs))
	for i, a := range addrs {
		s[i] = form(a)
	}
	return strings.Join(s, ", ")
}

func plainAddr(a fbb.Address) string { return a.Addr }

// renderTXT writes the header lines, the body and the names of any
// attachments, whose contents plain text can't carry.
func renderTXT(msg *fbb.Message, body string) []byte {
	var b strings.Builder
	fmt.Fprintf(&b, "From: %s\n", msg.From().Addr)
	fmt.Fprintf(&b, "To: %s\n", joinAddrs(msg.To(), plainAddr))
	if cc := msg.Cc(); len(cc) > 0 {
		fmt.Fprintf(&b, "Cc: %s\n", joinAddrs(cc, plainAddr))
	}
	fmt.Fprintf(&b, "Date: %s\n", msg.Date().Format(time.RFC1123Z))
	fmt.Fprintf(&b, "Subject: %s\n", msg.Subject())
	fmt.Fprintf(&b, "Message-ID: %s\n\n", msg.MID())
	b.WriteString(body)
	if files := msg.Files(); len(files) > 0 {
		if !strings.HasSuffix(body, "\n") {
			b.WriteString("\n")
		}
		b.WriteString("\nAttachments:\n")
		for _, f := range files {
			fmt.Fprintf(&b, "  %s (%d bytes)\n", f.Name(), len(f.Data()))
		}
	}
	return []byte(b.String())
}

// renderEML writes an RFC 5322 message: a quoted-printable UTF-8 text body,
// wrapped in multipart/mixed with base64 parts when there are attachments.
func renderEML(msg *fbb.Message, body string) ([]byte, error) {
	var b bytes.Buffer
	hdr := func(k, v string) { fmt.Fprintf(&b, "%s: %s\r\n", k, v) }
	hdr("From", emailAddr(msg.From()))
	hdr("To", joinAddrs(msg.To(), emailAddr))
	if cc := msg.Cc(); len(cc) > 0 {
		hdr("Cc", joinAddrs(cc, emailAddr))
	}
	hdr("Date", msg.Date().Format(time.RFC1123Z))
	hdr("Subject", mime.QEncoding.Encode("utf-8", msg.Subject()))
	hdr("Message-ID", "<"+msg.MID()+"@winlink.org>")
	hdr("MIME-Version", "1.0")

	files := msg.Files()
	if len(files) == 0 {
		hdr("Content-Type", "text/plain; charset=utf-8")
		hdr("Content-Transfer-Encoding", "quoted-printable")
		b.WriteString("\r\n")
		if err := writeQP(&b, body); err != nil {
			return nil, err
		}
		return b.Bytes(), nil
	}

	mw := multipart.NewWriter(&b)
	hdr("Content-Type", mime.FormatMediaType("multipart/mixed", map[string]string{"boundary": mw.Boundary()}))
	b.WriteString("\r\n")
	pw, err := mw.CreatePart(textproto.MIMEHeader{
		"Content-Type":              {"text/plain; charset=utf-8"},
		"Content-Transfer-Encoding": {"quoted-printable"},
	})
	if err != nil {
		return nil, err
	}
	if err := writeQP(pw, body); err != nil {
		return nil, err
	}
	for _, f := range files {
		ctype := mime.TypeByExtension(filepath.Ext(f.Name()))
		if ctype == "" {
			ctype = "application/octet-stream"
		}
		pw, err := mw.CreatePart(textproto.MIMEHeader{
			"Content-Type":              {ctype},
			"Content-Disposition":       {mime.FormatMediaType("attachment", map[string]string{"filename": f.Name()})},
			"Content-Transfer-Encoding": {"base64"},
		})
		if err != nil {
			return nil, err
		}
		if err := writeBase64(pw, f.Data()); err != nil {
			return nil, err
		}
	}
	if err := mw.Close(); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}

func writeQP(w io.Writer, s string) error {
	qp := quotedprintable.NewWriter(w)
	if _, err := qp.Write([]byte(s)); err != nil {
		return err
	}
	return qp.Close()
}

// writeBase64 writes data in 76-character lines, as RFC 2045 asks.
func writeBase64(w io.Writer, data []byte) error {
	enc := base64.StdEncoding.EncodeToString(data)
	for len(enc) > 76 {
		if _, err := fmt.Fprintf(w, "%s\r\n", enc[:76]); err != nil {
			return err
		}
		enc = enc[76:]
	}
	_, err := fmt.Fprintf(w, "%s\r\n", enc)
	return err
}
