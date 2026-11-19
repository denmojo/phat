# Changelog

What changed in each Phat release, newest first, kept to what a user would
notice or needs to act on. Longer notes for each version are on the
[releases page](https://github.com/denmojo/phat/releases). Phat is a fork of
[Pat](https://github.com/la5nta/pat); Pat's own history is in
`debian/changelog`.

## 0.1.7 (2026-11-18)

A security release. By default Phat's web port answers only on the machine it
runs on. If you set `http_addr` so other devices can reach it, update now.

- Fixed: a request to the web port could read a message file from outside
  the mailbox. The attachment route and both form routes took the
  `in-reply-to` value as a path under the mailbox without checking it, so a
  value containing `../` reached other folders. Each route now refuses a path
  that leaves the mailbox. Ported from Pat v1.0.1.
- Changed: the routes that serve HTML forms and attachments send a
  `Content-Security-Policy: sandbox` header, so a form or an attached HTML
  file can't act as Phat's own page in the browser. Ported from Pat v1.0.1.
- Changed: Go libraries updated to the versions Pat v1.0.1 uses.
- Checked, with no change needed: Pat v1.0.1 also sandboxed its template
  editor, which placed template text into the page as HTML. Phat's editor
  writes that text as text. A test now holds it to that.

## 0.1.6 (2026-11-08)

- Added: a Drafts folder. Save draft keeps unfinished mail where nothing
  ever sends it.
- Added: the composer minimizes to a bar so you can read the mailbox behind
  it.

## 0.1.5 (2026-10-19)

- Added: capital `C` connects again with the last connection, same mode and
  same route. Lowercase `c` still opens Connect.
- Changed: the macOS downloads are signed, notarized disk images.
- Fixed: typing a position by hand in Position report sent the cursor to
  Close after every keystroke, and a browser location that arrived late
  overwrote what you typed.
- Fixed: Caps Lock turned `c` into a quick connect and `r` into Reply all.
- Security: `golang.org/x/net` updated and the release built with current
  Go, which fixed 13 known vulnerabilities the 0.1.4 builds carried.

## 0.1.4 (2026-10-07)

- Added: download a message as B2F, EML or plain text, from the toolbar or
  with `d`. Several selected messages download as one zip.
- Added: the first downloadable builds. Linux on amd64 and arm64, Windows on
  amd64, macOS on Apple silicon and Intel, and a Docker image at
  `ghcr.io/denmojo/phat`.
- Added: Phat's own logo, in the browser tab and in notifications.

## 0.1.3 (2026-10-06)

- Removed: Pat's Winlink API key, at the request of Pat's maintainer. Until
  Phat has a key of its own it can't download the RMS gateway list, create a
  Winlink account or set a password recovery email. The README says what to
  use instead.
- Added: connect through a running Pat, with Pat's session shown in Phat's
  own page. On first run beside a Pat install, Phat asks whether to do so.
- Added: `phat templates from-pat` and `phat rmslist --from-pat` copy Pat's
  current forms and RMS list.
- Changed: the web port is 8081, so Phat starts beside Pat with no flags.
- Changed: Update forms runs in Pat when Phat uses Pat's forms.

## 0.1.2 (2026-10-05)

- Added: an Edit button on a message waiting in the Outbox. Send replaces
  the queued copy, and a refused send or a Discard leaves the original as it
  was.
- Added: `n` starts a new message from an open message, as it did from the
  list.

## 0.1.1 (2026-10-01)

- Added: keyboard shortcuts across the mailbox. Press `?` for the list.
- Added: the up and down arrows in an open message step to the previous and
  next message.

## 0.1.0 (2026-10-01)

- First release.
