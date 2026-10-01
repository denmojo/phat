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

## Installing

Phat has no packaged releases yet. Build it from source (see Building), then run `phat http` and open http://localhost:8080/ui.

On first run, Phat looks for a Pat installation and copies its config, mailbox and forms into Phat's own directories: `~/.config/phat` and `~/.local/share/phat` on Linux, `~/Library/Application Support/phat` on macOS. It copies rather than moves, so Pat keeps working, and it never copies into a mailbox Phat already has. Without a Pat installation, Phat opens Settings first; enter your callsign, locator and Winlink password, and Save.

There's no Docker image for Phat yet. Pat's Dockerfile and compose file are still in the repository, but they build and run Pat's names and paths, so if you ran Pat in Docker, run Phat from a built binary for now.

### Running Phat beside Pat

Phat and Pat install side by side: different binaries, different directories, different config files. The copy from Pat happens once, while Phat has no config of its own. After that the two mailboxes are separate copies, and mail fetched in one doesn't appear in the other.

Both default to port 8080, and the copied config keeps Pat's `http_addr`. To run them at the same time, give Phat its own port, either with `phat http -a localhost:8081` or by changing `http_addr` in Phat's config file.

For setting up ARDOP, VARA, AX.25 and rig control, [Pat's wiki](https://github.com/la5nta/pat/wiki) applies to Phat unchanged.

## Winlink CMS access

Phat names itself in the session handshake as `Phat-<version>`. The production Winlink Common Message Server (CMS) only accepts client names it knows, and it refuses Phat with:

```
Unknown client types are not allowed on production servers -- use cms-z.winlink.org
```

Until Phat is on that list, connect over telnet to the test server instead. In Settings > Connect aliases, add an alias named `cms-z` (or change the built-in `telnet` alias, which points at the production CMS) to:

```
telnet://{mycall}:CMSTelnet@cms-z.winlink.org:8772/wl2k
```

cms-z is a full Winlink server: mail sent through it reaches its recipients, and mail waiting for you is delivered. Radio gateways relay to the CMS, so expect the same refusal over RF until the name is approved. Peer-to-peer sessions don't involve the CMS and work as they do in Pat.

Phat also uses services set up for Pat. It calls the Winlink API with the access key the Winlink Development Team issued to Pat, for the RMS gateway list, account creation and password recovery. It fetches form template updates from Pat's server, api.getpat.io. And its default greeting to peer-to-peer stations is Pat's, "Open source Winlink client - getpat.io"; you can change it with `motd` in the config file.

## The mailbox

**Folders.** Inbox, Outbox, Sent and Archive, plus folders of your own. The + beside Folders adds one; hover a folder (or right-click it) for Rename and Delete. A folder that still holds mail can't be deleted.

**Labels and stars.** The + beside Labels creates a label with a name and a color, picked from a palette or a custom color picker. A label's ⋯ menu (or a right-click) edits its name and color or deletes it, and deleting says how many messages it comes off. A message can wear several labels. Select messages and use the tag button to add or remove them; a dash means some of the selection has that label, a check means all of it does. Hover a label chip in the list and click its x to take that one label off that one message. The Starred view collects starred mail from every folder.

**Selecting and acting.** Click the checkboxes, or Shift-click for a range. The toolbar then archives, deletes, marks read or unread, stars, labels or moves the whole selection. Delete asks first: Phat keeps no trash, so deleted mail is gone. If part of a bulk action fails, the failed messages stay selected and a toast says why. The sort button orders the list by date, correspondent or subject.

**Drag and drop.** Drag a message onto a folder to move it, onto a label to apply it, or onto Starred to star it. Grab a selected row and the whole selection goes with it.

**Search.** Press `/` to jump to the search box. Results appear as you pause typing, each tagged with the folder it lives in, and typed words match the start of longer words. Escape returns to the folder you came from.

**On a phone.** Rows show two lines with a callsign avatar, and ☰ opens the folder list. Hold a row for half a second to select it; after that, taps add or remove rows until the selection is empty. Phones don't drag.

## Reading and writing

Opening a message shows quoted text as an indented block and previews image attachments inline; click an image for full size. Reply, Reply all and Forward sit on the toolbar, with Edit as new under the ⋯ menu. On an archived message, the archive button becomes Move to Inbox.

New message opens the composer. Type callsigns or addresses into To and Cc, separated by commas, semicolons or spaces, or press Enter after each. Attach adds files, and images show a thumbnail. On sending, Phat re-encodes an image as a JPEG no wider than 600 pixels whenever that makes it smaller, as Pat does. P2P only keeps a message off the CMS. Clicking outside the composer leaves it open. Escape, the X and Cancel close it, and if you've typed anything Phat asks before throwing the draft away.

<p align="center">
  <img src="docs/screenshot-compose.png" alt="The composer over the inbox: an EOC-1 token in To, a subject, a message body, and Attach, Forms, P2P only, Cancel and Send along the bottom" width="100%">
  <br><em>Compose</em>
</p>

**Winlink forms.** In the composer, Forms opens the catalog of standard templates; type to filter (for example "213" for ICS-213). Update forms downloads the latest templates. Picking one opens the form in a new tab. Submit it there, and back in Phat the subject, body and form files fill into the composer, ready to address and send.

**Position reports.** Position report, at the foot of the sidebar, posts your location to Winlink. Phat fills in the position from a GPS on the machine running it, falls back to the browser's location, or takes latitude and longitude typed by hand, with an optional comment.

## Connecting

Connect opens the connection dialog. Pick a transport (telnet, ARDOP, VARA HF and FM, PACTOR, AX.25), a gateway from the RMS list or by callsign, and the transport's options. A frequency is given in kHz. If Phat can't tune the radio to it (no rig control configured, or the rig refused), it strikes the frequency through and leaves it out of the connect URL. The + button saves the current settings as an alias, and the trash button beside an alias deletes it.

<p align="center">
  <img src="docs/screenshot-connect.png" alt="The Connect dialog set for ARDOP to N0GATE-10 on 3594.5 kHz, with bandwidth, tries, and the resulting connect URL" width="100%">
  <br><em>Connect</em>
</p>

While a session is dialing, the Connect button becomes Abort; once connected it becomes Disconnect. While a disconnect is under way, the button turns into Force disconnect, which cuts the link without waiting. The status pill in the top bar shows the connection state; click it for details. Transfers show their progress, and prompts from the server, such as a password request or account activation, appear as dialogs. Session log, Position report and Settings sit at the foot of the sidebar.

## Settings

Settings has sections for General (callsign, locator, Winlink password, auxiliary addresses), Connect aliases, Transports, Rig control, GPSd, Schedule and Interface. Appearance, under Interface, switches between System, Light and Dark as you click. Save writes the config, and Restart now restarts Phat to apply it and reports when it's back.

If your callsign has no Winlink account yet, General says so and offers Create one, which walks you through registering it.

<p align="center">
  <img src="docs/screenshot-settings.png" alt="The Settings page: a section list on the left and the General section with callsign, locator, password, auxiliary addresses and download limit" width="100%">
  <br><em>Settings</em>
</p>

When the web client opens, Phat checks this repository's releases on GitHub and offers a download when a newer Phat is published.

## Differences from Pat

Phat stores the same `.b2f` message files Pat does, so the mail itself moves freely between them. Stars, labels and custom folders are Phat's own and live in the index described below. The command line works as Pat's does, under the name `phat`.

Environment variables use the `PHAT_` prefix where Pat's use `PAT_`. That covers config overrides (`PHAT_HTTPADDR`, `PHAT_HAMLIB_RIGS_rig1`), the variables Phat passes to connect scripts and prehooks (`PHAT_DIAL_URL`, `PHAT_REMOTE_ADDR`, `PHAT_MYCALL`), and `PHAT_DEBUG`. `phat env` lists them. A script or service written for Pat needs its variable names changed.

The HTTP API keeps Pat's routes except two per-message ones the new client replaced with bulk endpoints: `DELETE /api/mailbox/{box}/{mid}` and `POST /api/mailbox/{box}/{mid}/read` are gone, and posting a message is only allowed into the outbox.

## Building

Phat needs Go 1.26 or later. The Go binary embeds the web client from `web/dist`, which is committed, so a plain build needs no Node:

```
go build -o phat
```

After changing anything under `web/src`, rebuild the client first. It's built with Node 24 and Vite:

```
cd web && npm ci && npm run build && cd ..
go build -o phat
```

Without Node on the machine, `bash web/make.bash` runs the same client build in Docker. `./make.bash` is the full build: it runs the Go tests and then builds `phat`, linking libax25 for AX.25 on Linux (run `./make.bash libax25` once first). In `web/`, `npm test` runs the client's tests; `go test ./...` at the top covers the rest.

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
> connect cms-z
> connect ardop:///LA3F?freq=3594
```

`connect cms-z` assumes the alias from Winlink CMS access above. `phat help` lists the commands.

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
* W6IPA - JC Martin
* W7AYU - Marc Thomson
* WY2K - Benjamin Seidenberg

## Thanks to

LA5NTA and the Pat contributors, for the engine Phat runs on.

The JNOS developers for the properly maintained lzhuf implementation, as well as the original author Haruyasu Yoshizaki.

The paclink-unix team (Nicholas S. Castellano N2QZ and others) - reference implementation

Amateur Radio Safety Foundation, Inc. - The Winlink 2000 project

F6FBB Jean-Paul ROUBELAT - the FBB forwarding protocol

_Phat, Pat and wl2k-go are not affiliated with The Winlink Development Team nor the Winlink 2000 project [http://winlink.org]._
