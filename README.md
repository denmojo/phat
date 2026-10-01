# Phat

*Polished Ham Airmail Tool*

Phat is a Winlink client forked from [Pat](https://github.com/la5nta/pat) by Martin Hebnes Pedersen, LA5NTA. It keeps Pat's radio and protocol core (the B2F session code, wl2k-go, and every transport) and merges upstream fixes into it. What it replaces is the web client: Phat's is a mail program, with folders down the left, a toolbar across the top, stars, labels, drag and drop, search over a SQLite index, and light and dark themes that also work on a phone.

Phat is a separate project. It isn't affiliated with Pat or its maintainers, nor with the Winlink Development Team. Report Phat bugs and send Phat pull requests here, never to la5nta/pat.

<p align="center">
  <img src="docs/screenshot-desktop.png" alt="Phat's inbox in a desktop browser, dark theme: folders and labels in the sidebar, a starred and labeled message list" width="100%">
  <br><em>Desktop view</em>
</p>

<p align="center">
  <img src="docs/screenshot-phone.png" alt="The same inbox at phone width, with callsign avatars and two-line rows" width="35%">
  <br><em>Phone view</em>
</p>

## Winlink CMS access

Phat names itself in the session handshake as `Phat-<version>`. The production Winlink Common Message Server (CMS) only accepts client names it knows, and it refuses Phat with:

```
Unknown client types are not allowed on production servers -- use cms-z.winlink.org
```

Until Phat is on that list, connect over telnet to the test server instead. Add an alias under Settings > Connect aliases:

```
telnet://{mycall}:CMSTelnet@cms-z.winlink.org:8772/wl2k
```

cms-z is a full Winlink server, so mail sent and received there is real mail. Radio gateways relay to the CMS, so expect the same refusal over RF until the name is approved.

## The mailbox

**Folders.** Inbox, Outbox, Sent and Archive, plus folders of your own. The + beside Folders adds one; hover a folder (or right-click it) for Rename and Delete. A folder that still holds mail can't be deleted.

**Labels and stars.** Labels carry a name and a color, and a message can wear several. Select messages and use the tag button to add or remove labels; a dash means some of the selection has that label, a check means all of it does. Hover a label chip in the list and click its x to take that one label off that one message. The Starred view collects starred mail from every folder.

**Selecting and acting.** Click the checkboxes, or Shift-click for a range. The toolbar then archives, deletes, marks read or unread, stars, labels or moves the whole selection. Delete asks first: Phat keeps no trash, so deleted mail is gone. If part of a bulk action fails, the failed messages stay selected and a toast says why.

**Drag and drop.** Drag a message onto a folder to move it, onto a label to apply it, or onto Starred to star it. Grab a selected row and the whole selection goes with it.

**Search.** Type in the search box and results appear as you pause, each tagged with the folder it lives in. Typed words match the start of longer words. Escape returns to the folder you came from.

**On a phone.** Rows show two lines with a callsign avatar, and ☰ opens the folder list. Hold a row for half a second to select it; after that, taps add or remove rows until the selection is empty. Phones don't drag.

## Reading and writing

Opening a message shows quoted text as an indented block and previews image attachments inline; click an image for full size. Reply, Reply all and Forward sit on the toolbar, with Edit as new under the ⋯ menu. In Archive, the archive button becomes Move to Inbox.

New message opens the composer. Type callsigns or addresses into To and Cc, separated by commas or spaces. Attach adds files, and images show a thumbnail. On sending, Phat re-encodes an image as a JPEG no wider than 600 pixels whenever that makes it smaller, as Pat does. P2P only keeps a message off the CMS. Clicking outside the composer leaves it open. Escape, the X and Cancel close it, and if you've typed anything Phat asks before throwing the draft away.

<p align="center">
  <img src="docs/screenshot-compose.png" alt="The composer over the inbox: an EOC-1 token in To, a subject, a message body, and Attach, Forms, P2P only, Cancel and Send along the bottom" width="100%">
  <br><em>Compose</em>
</p>

**Winlink forms.** In the composer, Forms opens the catalog of standard templates; type to filter (for example "213" for ICS-213). Picking one opens the form in a new tab. Submit it there, and back in Phat the subject, body and form files fill into the composer, ready to address and send.

## Connecting

Connect opens the connection dialog. Pick a transport (telnet, ARDOP, VARA HF and FM, PACTOR, AX.25), a gateway from the RMS list or by callsign, and the transport's options. A frequency is given in kHz; without rig control configured, Phat strikes it through and leaves it out of the connect URL, since it can't tune the radio. The + button saves the current settings as an alias, and the trash button beside an alias deletes it.

<p align="center">
  <img src="docs/screenshot-connect.png" alt="The Connect dialog set for ARDOP to N0GATE-10 on 3594.5 kHz, with bandwidth, tries, and the resulting connect URL" width="100%">
  <br><em>Connect</em>
</p>

The status pill in the top bar shows the connection state; click it for details. Transfers show their progress, and prompts from the server, such as a password request or account activation, appear as dialogs. Session log and Settings sit under Tools at the foot of the sidebar.

## Settings

Settings covers your callsign and locator, Winlink account and password, auxiliary addresses, connect aliases, each transport, rig control, GPS, scheduled commands and appearance. Appearance (System, Light or Dark) changes the page as you click. Save writes the config, and Restart now restarts Phat to apply it and reports when it's back.

<p align="center">
  <img src="docs/screenshot-settings.png" alt="The Settings page: a section list on the left and the General section with callsign, locator, password, auxiliary addresses and download limit" width="100%">
  <br><em>Settings</em>
</p>

At startup Phat checks this repository's releases and offers a download when a newer Phat is published.

## Installing

Phat has no packaged releases yet. Build it from source (see Building), then run `phat http` and open http://localhost:8080/ui.

On first run, Phat looks for a Pat installation and copies its config, mailbox and forms into Phat's own directories: `~/.config/phat` and `~/.local/share/phat` on Linux, `~/Library/Application Support/phat` on macOS. It copies rather than moves, so Pat keeps working beside it, and it never copies into a mailbox Phat already has.

## Differences from Pat

Phat stores the same `.b2f` message files Pat does, so the mail itself moves freely between them. Stars, labels and custom folders are Phat's own and live in the index described below. The command line works as Pat's does, under the name `phat`.

The HTTP API keeps Pat's routes except two per-message ones the new client replaced with bulk endpoints: `DELETE /api/mailbox/{box}/{mid}` and `POST /api/mailbox/{box}/{mid}/read` are gone, and posting a message is only allowed into the outbox.

## Building

The web client in `web/` is built with Node 24 and Vite, and the Go binary embeds the result from `web/dist`, so build the client first:

```
cd web && npm ci && npm run build && cd ..
go build
```

Without Node on the machine, `bash web/make.bash` runs the same client build in Docker. In `web/`, `npm test` runs the client's tests; `go test ./...` at the top covers the rest.

## Querying your mail with SQL

Phat keeps a SQLite index of every message beside the mail, at `mailbox/<CALL>/index.db` in its data directory. Any SQLite tool can read it. The `emails` view has one row per message:

| column | meaning |
|---|---|
| `mid` | Winlink message ID, also the file name (`<folder>/<mid>.b2f`) |
| `folder` | `in`, `out`, `sent`, `archive` or a folder you made |
| `sender`, `recipients`, `cc` | addresses; several are comma-separated |
| `subject`, `body` | the message text (attachments are not included) |
| `sent_at` | `YYYY-MM-DD HH:MM:SS`, UTC |
| `unread`, `starred`, `p2p_only` | 1 or 0 |
| `labels` | comma-separated label names |
| `attachments` | how many files are attached |

```
sqlite3 -readonly ~/.local/share/phat/mailbox/N0CALL/index.db
sqlite> SELECT sent_at, subject FROM emails WHERE sender = 'EOC-1' ORDER BY sent_at DESC;
sqlite> SELECT sender, subject FROM emails WHERE labels LIKE '%follow up%';
sqlite> SELECT sender, subject FROM emails WHERE body LIKE '%generator%';
```

Open it read-only (`-readonly`) while Phat runs, and make changes in Phat. The `.b2f` files are the mail itself and the index is rebuilt from them if deleted; only stars and labels live nowhere else. If the index is locked by another program at startup, Phat reports the error and leaves the file alone; it rebuilds only an index SQLite reports as damaged.

## Command line

Everything Pat does from the command line, Phat does too:

```
$ phat interactive
> listen ardop,telnet-p2p,ax25
> connect telnet
> connect ardop:///LA3F?freq=3594
```

`phat help` lists the commands.

## Gzip experiment

Gzip message compression is an experimental B2F extension, implemented as a backwards compatible alternative to the ancient LZHUF compression. It's on by default, and sessions between two nodes that support it (Pat, Phat, or other software with the extension) use gzip when transferring messages. See <https://github.com/la5nta/wl2k-go#gzip-experiment>.

## Copyright/License

Copyright (c) 2020 Martin Hebnes Pedersen LA5NTA

Phat's changes are copyright Dennis Mojado (denmojo) and released under the same MIT license.

### Pat contributors (alphabetical)

* AB3E - Justin Overfelt
* DL1THM - Torsten Harenberg
* HB9GPA - Matthias Renner
* K0RET - Ryan Turner
* K0SWE - Chris Keller
* KD8DRX - Will Davidson
* KE8HMG - Andrew Huebner
* KI7RMJ - Rainer Grosskopf
* KM6LBU - Robert Hernandez
* LA3QMA - Kai Günter Brandt
* LA4TTA - Erlend Grimseid
* LA5NTA - Martin Hebnes Pedersen
* N2YGK - Alan Crosswell
* VE7GNU - Doug Collinge
* W6IPA  - JC Martin
* W7AYU - Marc Thomson
* WY2K - Benjamin Seidenberg

## Thanks to

LA5NTA and the Pat contributors, for the engine Phat runs on.

The JNOS developers for the properly maintained lzhuf implementation, as well as the original author Haruyasu Yoshizaki.

The paclink-unix team (Nicholas S. Castellano N2QZ and others) - reference implementation

Amateur Radio Safety Foundation, Inc. - The Winlink 2000 project

F6FBB Jean-Paul ROUBELAT - the FBB forwarding protocol

_Phat, Pat and wl2k-go are not affiliated with The Winlink Development Team nor the Winlink 2000 project [http://winlink.org]._
