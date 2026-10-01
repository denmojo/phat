package mailindex

import (
	"database/sql"
	"strings"
	"time"
)

// Row is one message as the index knows it. Body is never here; the
// message endpoint reads the file for that.
type Row struct {
	MID         string    `json:"MID"`
	Folder      string    `json:"Folder"`
	From        string    `json:"From"`
	To          string    `json:"To"`
	Cc          string    `json:"Cc"`
	Subject     string    `json:"Subject"`
	Date        time.Time `json:"Date"`
	Size        int       `json:"Size"`
	Attachments int       `json:"Attachments"`
	Unread      bool      `json:"Unread"`
	P2POnly     bool      `json:"P2POnly"`
	Starred     bool      `json:"Starred"`
	Labels      []string  `json:"Labels"`
}

// Query selects rows. Folder "all" spans every folder.
type Query struct {
	Folder  string
	Label   string
	Starred bool
	Limit   int
}

const rowSelect = `SELECT m.mid, m.folder, m.from_addr, m.to_addrs, m.cc_addrs, m.subject, m.date,
	m.size, m.attachments, m.unread, m.p2p_only, COALESCE(f.starred, 0),
	COALESCE((SELECT GROUP_CONCAT(label, char(31)) FROM message_labels ml WHERE ml.mid=m.mid), '')
	FROM messages m LEFT JOIN flags f ON f.mid=m.mid`

func scanRows(rows *sql.Rows) ([]Row, error) {
	defer rows.Close()
	out := []Row{}
	for rows.Next() {
		var r Row
		var date int64
		var unread, p2p, starred int
		var labels string
		if err := rows.Scan(&r.MID, &r.Folder, &r.From, &r.To, &r.Cc, &r.Subject, &date,
			&r.Size, &r.Attachments, &unread, &p2p, &starred, &labels); err != nil {
			return nil, err
		}
		r.Date = time.Unix(date, 0)
		r.Unread, r.P2POnly, r.Starred = unread == 1, p2p == 1, starred == 1
		r.Labels = []string{}
		if labels != "" {
			r.Labels = strings.Split(labels, "\x1f")
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// List returns rows matching q, newest first.
func (ix *Index) List(q Query) ([]Row, error) {
	defer ix.rlock()()
	var where []string
	var args []any
	if q.Folder != "" && q.Folder != "all" {
		where = append(where, "m.folder = ?")
		args = append(args, q.Folder)
	}
	if q.Label != "" {
		where = append(where, "EXISTS (SELECT 1 FROM message_labels ml WHERE ml.mid=m.mid AND ml.label=?)")
		args = append(args, q.Label)
	}
	if q.Starred {
		where = append(where, "COALESCE(f.starred,0) = 1")
	}
	sqlText := rowSelect
	if len(where) > 0 {
		sqlText += " WHERE " + strings.Join(where, " AND ")
	}
	sqlText += " ORDER BY m.date DESC"
	if q.Limit > 0 {
		sqlText += " LIMIT ?"
		args = append(args, q.Limit)
	}
	rows, err := ix.db.Query(sqlText, args...)
	if err != nil {
		return nil, err
	}
	return scanRows(rows)
}

// Get returns one row.
func (ix *Index) Get(mid string) (Row, error) {
	defer ix.rlock()()
	rows, err := ix.db.Query(rowSelect+" WHERE m.mid = ?", mid)
	if err != nil {
		return Row{}, err
	}
	out, err := scanRows(rows)
	if err != nil {
		return Row{}, err
	}
	if len(out) == 0 {
		return Row{}, ErrNotFound
	}
	return out[0], nil
}

// Search runs an FTS5 MATCH over subject, addresses and body, best match
// first. A malformed query returns the FTS error.
func (ix *Index) Search(text string, limit int) ([]Row, error) {
	defer ix.rlock()()
	if limit <= 0 {
		limit = 100
	}
	match := matchExpr(text)
	if match == "" {
		return []Row{}, nil
	}
	rows, err := ix.db.Query(rowSelect+` JOIN (
		SELECT mid, bm25(messages_fts) AS rank FROM messages_fts WHERE messages_fts MATCH ?
		ORDER BY rank LIMIT ?) s ON s.mid = m.mid
		ORDER BY s.rank`,
		match, limit)
	if err != nil {
		return nil, err
	}
	return scanRows(rows)
}

// Count is a folder's message and unread totals.
type Count struct {
	Total  int `json:"count"`
	Unread int `json:"unread"`
}

// FolderCounts returns totals per folder, from the index.
func (ix *Index) FolderCounts() (map[string]Count, error) {
	defer ix.rlock()()
	rows, err := ix.db.Query(`SELECT folder, COUNT(*), SUM(unread) FROM messages GROUP BY folder`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]Count{}
	for rows.Next() {
		var f string
		var c Count
		if err := rows.Scan(&f, &c.Total, &c.Unread); err != nil {
			return nil, err
		}
		out[f] = c
	}
	return out, rows.Err()
}

// matchExpr turns what a user typed into an FTS5 query: every word and every
// "quoted phrase" becomes a quoted string, so hyphens, plus signs, at-signs
// and bare operators like AND are searched as text. Terms are ANDed. An
// unbalanced quote runs to the end of the input.
func matchExpr(text string) string {
	var terms []string
	for len(text) > 0 {
		text = strings.TrimLeft(text, " \t\r\n")
		if text == "" {
			break
		}
		var term string
		if text[0] == '"' {
			end := strings.IndexByte(text[1:], '"')
			if end < 0 {
				term, text = text[1:], ""
			} else {
				term, text = text[1:end+1], text[end+2:]
			}
		} else {
			end := strings.IndexAny(text, " \t\r\n")
			if end < 0 {
				end = len(text)
			}
			term, text = text[:end], text[end:]
		}
		if strings.TrimSpace(term) != "" {
			terms = append(terms, `"`+strings.ReplaceAll(term, `"`, `""`)+`"`)
		}
	}
	return strings.Join(terms, " ")
}
