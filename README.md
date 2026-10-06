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

## Winlink approval is pending

Winlink hasn't approved Phat, in two ways: its client name and an API key. Phat asked the Winlink Development Team to accept its client name in October 2026. The team replied that it is holding new client requests while it writes rules for third-party clients, so the request waits on that backlog and on the new documentation. Phat will ask for an API key once that documentation is out. Approval may come late or never, so this README describes how to use Phat without it.

**Winlink's servers refuse Phat by name.** The production Common Message Server (CMS) only accepts client programs it knows. To send and receive Winlink mail, [connect through Pat](#connecting-through-pat), set up just below. Telnet to Winlink's test server also works (see [Winlink CMS access](#winlink-cms-access)), and peer-to-peer sessions don't involve the CMS at all.

**Phat has no Winlink API key.** Some features call the Winlink API at api.winlink.org, which needs an access key issued by the Winlink Development Team to each client program. The key issued to Pat belongs to Pat, and Pat's maintainer asked that Phat not use it (see [Pat's maintainer's agreement](#pats-maintainers-agreement)). Until Phat has its own key, these three don't work:

- **RMS gateway list.** Phat can't download a fresh list. The Connect dialog still shows the list compiled into Phat itself, a snapshot that came with the source code Phat was forked from, so it's there whether or not you have Pat installed. Gateways added or changed since then won't appear, and Update cache reports the missing key.
- **Account creation.** Phat can't register a new Winlink account, from Settings or from `phat init`.
- **Password recovery.** Phat can't read or set your account's password recovery email.

Use other means for these: Pat or another Winlink client, or your account settings at [winlink.org](https://winlink.org/).

The same key also sits behind a few smaller checks, which are skipped for now: whether your callsign has an account, whether your password is correct, the Message Pickup Station commands (`phat mps`), and the daily version report Pat sends to Winlink. Settings shows a warning mark beside your callsign instead of the account's status. Sending and receiving mail don't use the Winlink API and are unaffected.

## Getting connected

New to Winlink? Install Pat and get it sending and receiving mail on its own first ([Pat's releases](https://github.com/la5nta/pat/releases), [Pat's wiki](https://github.com/la5nta/pat/wiki)). Then install Phat. There are two ways to connect with it.

### Connecting through Pat

Phat works on Pat's mailbox and hands its connects to your running Pat. Pat stays exactly as you installed it: its own config, its own port, started however you start it now. It runs each session under its own client name, which the CMS accepts, and the mail goes into the mailbox Phat is showing.

1. Leave Pat running as usual, on its default port 8080.
2. Start Phat on Pat's mailbox. Phat uses port 8081, so the two don't collide:

   ```
   # macOS
   phat --mbox "$HOME/Library/Application Support/pat/mailbox" http
   # Linux
   phat --mbox ~/.local/share/pat/mailbox http
   ```

3. Open http://localhost:8081/ui, go to Settings > General and set Connect through Pat to Pat's address, `http://localhost:8080`. Click Save, and in the Restart required dialog that opens, click Restart now so Phat picks up the setting.

Start Phat with the same `--mbox` every time, whether from a terminal or a service.

Pat and Phat now show the same mail, with two exceptions. Messages you move into folders you made in Phat stay on disk, but Pat doesn't show them, because Pat has no folders of your own, only Inbox, Outbox, Sent and Archive. Move one back to Inbox or Archive and Pat shows it again. Stars and labels are Phat's alone, so Pat never shows them.

The Connect dialog then offers Direct or Through Pat. It starts on Through Pat and remembers your choice in each browser. Through Pat, the Connect, Abort and Disconnect buttons go to Pat, and Pat's status, session log, transfer progress and prompts appear in Phat's page as they would for a session of Phat's own. Direct runs the session in Phat as before, so peer-to-peer and the test server still work without Pat. Clear the setting to remove the choice. An address that points back at Phat itself is refused.

### Connecting to Winlink's test server

Without Pat, Phat can connect over telnet to cms-z, Winlink's test server, which accepts Phat by name and delivers mail like the production server. Add the alias described under [Winlink CMS access](#winlink-cms-access). Radio gateways relay to the production server, so over RF they refuse Phat until Winlink approves it.

## Pat's maintainer's agreement

Phat uses services set up for Pat. In October 2026, Pat's maintainer, Martin Hebnes Pedersen (LA5NTA), agreed to Phat fetching form template updates from Pat's server, api.getpat.io, and to Phat connecting through Pat as described above. He asked one thing in return: that Phat not use the Winlink API access key issued to Pat, which is why the features listed under [Winlink approval is pending](#winlink-approval-is-pending) are off until Phat has its own key.

Phat's default greeting to peer-to-peer stations is also Pat's, "Open source Winlink client - getpat.io"; you can change it with `motd` in the config file.

## Installing

Phat has no packaged releases yet. Build it from source (see Building), then run `phat http` and open http://localhost:8081/ui.

On first run, Phat looks for a Pat installation and copies its config, mailbox and forms into Phat's own directories: `~/.config/phat` and `~/.local/share/phat` on Linux, `~/Library/Application Support/phat` on macOS. It copies rather than moves, so Pat keeps working, and it never copies into a mailbox Phat already has. Without a Pat installation, Phat opens Settings first; enter your callsign, locator and Winlink password, and Save.

There's no Docker image for Phat yet. Pat's Dockerfile and compose file are still in the repository, but they build and run Pat's names and paths, so if you ran Pat in Docker, run Phat from a built binary for now.

### Running Phat beside Pat

Phat and Pat install side by side: different binaries, different directories, different config files. The copy from Pat happens once, while Phat has no config of its own. After that the two mailboxes are separate copies, and mail fetched in one doesn't appear in the other, unless you start Phat on Pat's mailbox as [Connecting through Pat](#connecting-through-pat) describes.

Pat uses port 8080 and Phat uses 8081, so both run at the same time with no extra steps. When the first-run copy brings over a Pat config set to 8080, Phat's copy moves to 8081; Pat's own config isn't touched. To use a different port, run `phat http -a localhost:<port>` or change `http_addr` in Phat's config file.

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

cms-z is a full Winlink server: mail sent through it reaches its recipients, and mail waiting for you is delivered. Radio gateways relay to the CMS, so expect the same refusal over RF until the name is approved. Peer-to-peer sessions don't involve the CMS and work as they do in Pat. To reach the production CMS, and through it the radio gateways, [connect through Pat](#connecting-through-pat).

## The mailbox

**Folders.** Inbox, Outbox, Sent and Archive, plus folders of your own. The + beside Folders adds one; hover a folder (or right-click it) for Rename and Delete. A folder that still holds mail can't be deleted.

**Labels and stars.** The + beside Labels creates a label with a name and a color, picked from a palette or a custom color picker. A label's ⋯ menu (or a right-click) edits its name and color or deletes it, and deleting says how many messages it comes off. A message can wear several labels. Select messages and use the tag button to add or remove them; a dash means some of the selection has that label, a check means all of it does. Hover a label chip in the list and click its x to take that one label off that one message. The Starred view collects starred mail from every folder.

**Selecting and acting.** Click the checkboxes, or Shift-click for a range. The toolbar then archives, deletes, marks read or unread, stars, labels or moves the whole selection. Delete asks first: Phat keeps no trash, so deleted mail is gone. If part of a bulk action fails, the failed messages stay selected and a toast says why. The sort button orders the list by date, correspondent or subject.

**Drag and drop.** Drag a message onto a folder to move it, onto a label to apply it, or onto Starred to star it. Grab a selected row and the whole selection goes with it.

**Search.** Press `/` to jump to the search box. Results appear as you pause typing, each tagged with the folder it lives in, and typed words match the start of longer words. Escape returns to the folder you came from.

**On a phone.** Rows show two lines with a callsign avatar, and ☰ opens the folder list. Hold a row for half a second to select it; after that, taps add or remove rows until the selection is empty. Phones don't drag.

## Reading and writing

Opening a message shows quoted text as an indented block and previews image attachments inline; click an image for full size. Reply, Reply all and Forward sit on the toolbar, with Edit as new under the ⋯ menu. On an archived message, the archive button becomes Move to Inbox. The up and down arrows beside Back step to the previous and next message in the order the list shows, without going back to it.

New message opens the composer. Type callsigns or addresses into To and Cc, separated by commas, semicolons or spaces, or press Enter after each. Attach adds files, and images show a thumbnail. On sending, Phat re-encodes an image as a JPEG no wider than 600 pixels whenever that makes it smaller, as Pat does. P2P only keeps a message off the CMS. Clicking outside the composer leaves it open. Escape, the X and Cancel close it, and if you've typed anything Phat asks before throwing the draft away.

<p align="center">
  <img src="docs/screenshot-compose.png" alt="The composer over the inbox: an EOC-1 token in To, a subject, a message body, and Attach, Forms, P2P only, Cancel and Send along the bottom" width="100%">
  <br><em>Compose</em>
</p>

**Winlink forms.** In the composer, Forms opens the catalog of standard templates; type to filter (for example "213" for ICS-213). Update forms downloads the latest templates. Picking one opens the form in a new tab. Submit it there, and back in Phat the subject, body and form files fill into the composer, ready to address and send.

**Position reports.** Position report, at the foot of the sidebar, posts your location to Winlink. Phat fills in the position from a GPS on the machine running it, falls back to the browser's location, or takes latitude and longitude typed by hand, with an optional comment.

## Keyboard shortcuts

Single keys act on the mail while no text field has focus and no dialog or menu is open. Press `?`, or the circled ? in the top bar or the sidebar, for the keys that work on the current screen. A key held with Ctrl, Alt or Command stays with the browser, so Ctrl-R and Cmd-R still reload.

| key | in the message list | in an open message |
|---|---|---|
| `n` | new message | |
| `Enter` | open the message, when exactly one is ticked | |
| `j` / `k` | | next / previous message |
| `h` | | back to the list |
| `r` / `R` | | reply / reply all |
| `f` | | forward |
| `a` | archive the selection (in Archive, move it to the Inbox) | archive (in Archive, move to the Inbox) |
| `t` | delete the selection | delete |
| `u` | all unread: mark read; otherwise mark unread | mark unread and go back to the list |
| `s` | all starred: unstar; otherwise star | star or unstar |
| `l` | label menu | label menu |
| `m` | move menu | move menu |

Anywhere, `c` opens Connect, `/` jumps to the search box and `?` lists the keys. Delete still asks first, with Delete focused, so Enter confirms it.

After Enter opens a ticked message, going back puts focus on that row's checkbox, so Space unticks it. The tick stays if you come back from the same message; if `j` or `k` took you to another, the tick clears and focus goes to the row of the message you left.

On a phone the keys need a hardware keyboard, Bluetooth or USB. The on-screen keyboard only appears for a text field, and keys typed there go to the field. At phone width the top bar's ? button is hidden to make room; the sidebar entry stays.

<p align="center">
  <img src="docs/screenshot-keys.png" alt="The Keyboard shortcuts sheet open over the inbox, listing the message list keys and the keys that work anywhere" width="100%">
  <br><em>Pressing ? over the message list</em>
</p>

## Connecting

Connect opens the connection dialog. Pick a transport (telnet, ARDOP, VARA HF and FM, PACTOR, AX.25), a gateway from the RMS list or by callsign, and the transport's options. A frequency is given in kHz. If Phat can't tune the radio to it (no rig control configured, or the rig refused), it strikes the frequency through and leaves it out of the connect URL. The + button saves the current settings as an alias, and the trash button beside an alias deletes it.

<p align="center">
  <img src="docs/screenshot-connect.png" alt="The Connect dialog set for ARDOP to N0GATE-10 on 3594.5 kHz, with bandwidth, tries, and the resulting connect URL" width="100%">
  <br><em>Connect</em>
</p>

While a session is dialing, the Connect button becomes Abort; once connected it becomes Disconnect. While a disconnect is under way, the button turns into Force disconnect, which cuts the link without waiting. The status pill in the top bar shows the connection state; click it for details. Transfers show their progress, and prompts from the server, such as a password request or account activation, appear as dialogs. Session log, Position report and Settings sit at the foot of the sidebar.

## Settings

Settings has sections for General (callsign, locator, Winlink password, auxiliary addresses), Connect aliases, Transports, Rig control, GPSd, Schedule and Interface. Appearance, under Interface, switches between System, Light and Dark as you click. Save writes the config, and Restart now restarts Phat to apply it and reports when it's back.

General checks whether your callsign has a Winlink account and offers to create one. Both need a Winlink API key, so for now General shows a warning mark instead; see [Winlink approval is pending](#winlink-approval-is-pending).

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
