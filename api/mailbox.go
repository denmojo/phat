package api

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/la5nta/pat/app"
	"github.com/la5nta/pat/internal/debug"
	"github.com/la5nta/pat/internal/mailindex"
	"github.com/la5nta/wl2k-go/fbb"
	"github.com/la5nta/wl2k-go/mailbox"

	"github.com/gorilla/mux"
	"github.com/microcosm-cc/bluemonday"
)

// mailboxHandler lists a folder from the index. box may be any folder
// name or "all"; ?label=X narrows to messages carrying that label.
func (h Handler) mailboxHandler(w http.ResponseWriter, r *http.Request) {
	box := mux.Vars(r)["box"]
	if box != "all" {
		if !mailindex.IsSystemFolder(box) && !mailindex.ValidFolderName(box) {
			http.NotFound(w, r)
			return
		}
		if _, err := os.Stat(h.Index().FolderDir(box)); err != nil {
			http.NotFound(w, r)
			return
		}
	}
	rows, err := h.Index().List(mailindex.Query{Folder: box, Label: r.URL.Query().Get("label")})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(rows)
}

func (h Handler) starredHandler(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Index().List(mailindex.Query{Folder: "all", Starred: true})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_ = json.NewEncoder(w).Encode(rows)
}

func (h Handler) searchHandler(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		http.Error(w, "q required", http.StatusBadRequest)
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	rows, err := h.Index().Search(q, limit)
	if err != nil {
		// FTS5 reports a malformed query as an error; that is the caller's fault.
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	_ = json.NewEncoder(w).Encode(rows)
}

type JSONMessage struct {
	*fbb.Message
	inclBody bool
	starred  bool
	labels   []string
}

func (m JSONMessage) MarshalJSON() ([]byte, error) {
	msg := struct {
		MID      string
		Date     time.Time
		From     fbb.Address
		To       []fbb.Address
		Cc       []fbb.Address
		Subject  string
		Body     string
		BodyHTML string
		Files    []*fbb.File
		P2POnly  bool
		Unread   bool
		Starred  bool
		Labels   []string
	}{
		MID:     m.MID(),
		Date:    m.Date(),
		From:    m.From(),
		To:      m.To(),
		Cc:      m.Cc(),
		Subject: m.Subject(),
		Files:   m.Files(),
		P2POnly: m.Header.Get("X-P2POnly") == "true",
		Unread:  mailbox.IsUnread(m.Message),
		Starred: m.starred,
		Labels:  m.labels,
	}
	if msg.Labels == nil {
		msg.Labels = []string{}
	}

	if m.inclBody {
		msg.Body, _ = m.Body()
		unsafe := toHTML([]byte(msg.Body))
		msg.BodyHTML = string(bluemonday.UGCPolicy().SanitizeBytes(unsafe))
	}
	return json.Marshal(msg)
}

func (h Handler) messageHandler(w http.ResponseWriter, r *http.Request) {
	box, mid := mux.Vars(r)["box"], mux.Vars(r)["mid"]

	msg, err := mailbox.OpenMessage(path.Join(h.Mailbox().MBoxPath, box, mid+mailbox.Ext))
	if os.IsNotExist(err) {
		http.NotFound(w, r)
		return
	} else if err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jm := JSONMessage{Message: msg, inclBody: true}
	if row, err := h.Index().Get(mid); err == nil {
		jm.starred, jm.labels = row.Starred, row.Labels
	}
	_ = json.NewEncoder(w).Encode(jm)
}

func (h Handler) attachmentHandler(w http.ResponseWriter, r *http.Request) {
	// Attachments are potentially unsanitized HTML and/or javascript.
	// To avoid XSS, we enable the CSP sandbox directive so that these
	// attachments can't call other parts of the API (deny same origin).
	w.Header().Set("Content-Security-Policy", "sandbox allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-scripts")

	// Allow different sandboxed attachments to refer to each other.
	// This can be useful to provide rich HTML content as attachments,
	// without having to bundle it all up in one big file.
	w.Header().Set("Access-Control-Allow-Origin", "null")

	box, mid, attachment := mux.Vars(r)["box"], mux.Vars(r)["mid"], mux.Vars(r)["attachment"]
	inReplyTo := r.URL.Query().Get("in-reply-to")
	renderToHtml, _ := strconv.ParseBool(r.URL.Query().Get("rendertohtml"))

	if inReplyTo != "" || renderToHtml {
		// no-store is needed for displaying and replying to Winlink form-based messages
		w.Header().Set("Cache-Control", "no-store")
	}

	msg, err := mailbox.OpenMessage(path.Join(h.Mailbox().MBoxPath, box, mid+mailbox.Ext))
	if os.IsNotExist(err) {
		http.NotFound(w, r)
		return
	} else if err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Find and write attachment
	var found bool
	for _, f := range msg.Files() {
		if f.Name() != attachment {
			continue
		}
		found = true

		if !renderToHtml {
			http.ServeContent(w, r, f.Name(), msg.Date(), bytes.NewReader(f.Data()))
			return
		}

		var inReplyToMsg *fbb.Message
		if inReplyTo != "" {
			var err error
			inReplyToMsg, err = mailbox.OpenMessage(path.Join(h.Mailbox().MBoxPath, inReplyTo+mailbox.Ext))
			if err != nil {
				err = fmt.Errorf("Failed to load in-reply-to message (%q): %v", inReplyTo, err)
				log.Println(err)
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
		}
		formRendered, err := h.FormsManager().RenderForm(f.Data(), inReplyToMsg, inReplyTo)
		if err != nil {
			log.Println(err)
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		http.ServeContent(w, r, f.Name()+".html", msg.Date(), bytes.NewReader([]byte(formRendered)))
	}

	if !found {
		http.NotFound(w, r)
	}
}

func (h Handler) postMessageHandler(w http.ResponseWriter, r *http.Request) {
	if mux.Vars(r)["box"] != "out" {
		http.Error(w, "Not implemented", http.StatusNotImplemented)
		return
	}
	h.postOutboundMessageHandler(w, r)
}

func (h Handler) postOutboundMessageHandler(w http.ResponseWriter, r *http.Request) {
	err := r.ParseMultipartForm(10 * (1024 ^ 2)) // 10Mb
	if err != nil {
		if err := r.ParseForm(); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	msg := fbb.NewMessage(fbb.Private, h.Options().MyCall)

	// files
	if r.MultipartForm != nil {
		files := r.MultipartForm.File["files"]
		for _, f := range files {
			err := addAttachmentFromMultipartFile(msg, f)
			switch err := err.(type) {
			case nil:
				// No problem
			case HTTPError:
				http.Error(w, err.Error(), err.StatusCode)
			default:
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}
		}
	}

	if cookie, err := r.Cookie("forminstance"); err == nil {
		// We must add the attachment files here because it is impossible
		// for the frontend to dynamically add form files due to legacy
		// security vulnerabilities in older HTML specs.
		// The rest of the form data (to, subject, body etc) is added by
		// the frontend.
		formData, ok := h.FormsManager().GetPostedFormData(cookie.Value)
		if !ok {
			debug.Printf("form instance key (%q) not valid", cookie.Value)
			http.Error(w, "form instance key not valid", http.StatusBadRequest)
			return
		}
		for _, f := range formData.Attachments {
			msg.AddFile(f)
		}
	}

	// Other fields
	if v := r.Form["to"]; len(v) == 1 {
		addrs := strings.FieldsFunc(v[0], app.SplitFunc)
		msg.AddTo(addrs...)
	}
	if v := r.Form["cc"]; len(v) == 1 {
		addrs := strings.FieldsFunc(v[0], app.SplitFunc)
		msg.AddCc(addrs...)
	}
	if v := r.Form["subject"]; len(v) == 1 {
		msg.SetSubject(v[0])
	}
	if v := r.Form["body"]; len(v) == 1 {
		_ = msg.SetBody(v[0])
	}
	if v := r.Form["p2ponly"]; len(v) == 1 && v[0] != "" {
		msg.Header.Set("X-P2POnly", "true")
	}
	if v := r.Form["date"]; len(v) == 1 {
		t, err := time.Parse(time.RFC3339, v[0])
		if err != nil {
			log.Printf("Unable to parse message date: %s", err)
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		msg.SetDate(t)
	} else {
		log.Printf("Missing date value")
		http.Error(w, "Missing date value", http.StatusBadRequest)
		return
	}

	if err := msg.Validate(); err != nil {
		http.Error(w, "Validation error: "+err.Error(), http.StatusBadRequest)
		return
	}

	// Post to outbox
	if err := h.Mailbox().AddOut(msg); err != nil {
		log.Println(err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	var buf bytes.Buffer
	_ = msg.Write(&buf)
	_, _ = fmt.Fprintf(w, "Message posted (%.2f kB)", float64(buf.Len())/1024)
}

func addAttachmentFromMultipartFile(msg *fbb.Message, f *multipart.FileHeader) error {
	// For some unknown reason, we receive this empty unnamed file when no
	// attachment is provided. Prior to Go 1.10, this was filtered by
	// multipart.Reader.
	if f.Size == 0 && f.Filename == "" {
		return nil
	}

	if f.Filename == "" {
		err := errors.New("missing attachment name")
		return HTTPError{err, http.StatusBadRequest}
	}
	file, err := f.Open()
	if err != nil {
		return HTTPError{err, http.StatusInternalServerError}
	}
	defer file.Close()
	if err := app.AddAttachment(msg, f.Filename, f.Header.Get("Content-Type"), file); err != nil {
		return HTTPError{err, http.StatusInternalServerError}
	}
	return nil
}

// toHTML takes the given body and turns it into proper html with
// paragraphs, blockquote, and <br /> line breaks.
func toHTML(body []byte) []byte {
	buf := bytes.NewBuffer(body)
	var out bytes.Buffer

	_, _ = fmt.Fprint(&out, "<p>")

	scanner := bufio.NewScanner(buf)

	var blockquote int
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) == 0 {
			_, _ = fmt.Fprint(&out, "</p><p>")
			continue
		}

		depth := blockquoteDepth(line)
		for depth != blockquote {
			if depth > blockquote {
				_, _ = fmt.Fprintf(&out, "</p><blockquote><p>")
				blockquote++
			} else {
				_, _ = fmt.Fprintf(&out, "</p></blockquote><p>")
				blockquote--
			}
		}
		line = line[depth:]

		line = htmlEncode(line)
		line = linkify(line)

		_, _ = fmt.Fprint(&out, line+"\n")
	}

	for ; blockquote > 0; blockquote-- {
		_, _ = fmt.Fprintf(&out, "</p></blockquote>")
	}

	_, _ = fmt.Fprint(&out, "</p>")
	return out.Bytes()
}

// blcokquoteDepth counts the number of '>' at the beginning of the string.
func blockquoteDepth(str string) (n int) {
	for _, c := range str {
		if c != '>' {
			break
		}
		n++
	}
	return
}

// htmlEncode encodes html characters
func htmlEncode(str string) string {
	str = strings.ReplaceAll(str, ">", "&gt;")
	str = strings.ReplaceAll(str, "<", "&lt;")
	return str
}

// linkify detects url's in the given string and adds <a href tag.
//
// It is recursive.
func linkify(str string) string {
	start := strings.Index(str, "http")

	var needScheme bool
	if start < 0 {
		start = strings.Index(str, "www.")
		needScheme = true
	}

	if start < 0 {
		return str
	}

	end := strings.IndexAny(str[start:], " ,()[]")
	if end < 0 {
		end = len(str)
	} else {
		end += start
	}

	link := str[start:end]
	if needScheme {
		link = "http://" + link
	}

	return fmt.Sprintf(`%s<a href='%s' target='_blank'>%s</a>%s`, str[:start], link, str[start:end], linkify(str[end:]))
}
