# Phat

*Polished Ham Airmail Tool*

Phat is a Winlink client forked from [Pat](https://github.com/la5nta/pat) by LA5NTA. It keeps Pat's radio and protocol core and tracks upstream for it, and replaces the web client with a mail layout: folders on the left, a toolbar on top, stars, labels, drag and drop between folders, keyword search over a SQLite index, and light and dark themes.

Phat reads a Pat installation on first run and copies its config, mailbox and forms into its own directories (`~/.config/phat`, `~/.local/share/phat`), leaving Pat's untouched.

#### Features
* Message composer/reader (basic mailbox functionality).
* Auto-shrink image attachments.
* Post position reports with location from local GPS, browser location or manual entry.
* Rig control (using hamlib).
* CRON-like syntax for execution of scheduled commands (e.g. QSY or connect).
* Built in http-server with web interface (mobile friendly).
* Git style command line interface.
* Listen for P2P connections using multiple modes concurrently.
* AX.25, telnet, PACTOR and ARDOP support.
* Experimental gzip message compression (See "Gzip experiment" below).

##### Example
```
martinhpedersen@duo:~$ pat interactive
> listen winmor,telnet-p2p,ax25
2015/02/03 10:33:10 Listening for incoming traffic (winmor,telnet-p2p,ax25)...
> connect winmor:///LA3F
2015/02/03 10:34:28 Connecting to winmor:LA3F...
2015/02/03 10:34:33 Connected to WINMOR:LA3F
RMS Trimode 1.3.3.0 Follo.SE Oslo. Pactor & Winmor Hybrid Gateway
LA5NTA has 117 minutes remaining with LA3F
[WL2K-2.8.4.8-B2FWIHJM$]
Wien CMS via LA3F >
>FF
FC EM FOYNU8AKXX59 260 221 0
F> 68
1 proposal(s) received
Accepting FOYNU8AKXX59
Receiving [//WL2K test til linux] [offset 0]
>FF
FQ
Waiting for remote node to close the connection...
> _
```

### Querying your mail with SQL

Phat keeps a SQLite index of every message beside the mail, at `mailbox/<CALL>/index.db` in its data directory (`~/.local/share/phat` on Linux, `~/Library/Application Support/phat` on macOS). Any SQLite tool can read it. The `emails` view has one row per message:

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
sqlite3 -readonly ~/.local/share/phat/mailbox/AD6DM/index.db
sqlite> SELECT sent_at, subject FROM emails WHERE sender = 'W6EOC' ORDER BY sent_at DESC;
sqlite> SELECT sender, subject FROM emails WHERE labels LIKE '%follow up%';
sqlite> SELECT sender, subject FROM emails WHERE body LIKE '%generator%';
```

Open it read-only (`-readonly`) while Phat runs, and make changes in Phat. The `.b2f` files are the mail itself; the index is rebuilt from them if deleted, and only stars and labels live nowhere else.

### Gzip experiment

Gzip message compression has been added as an experimental B2F extension. The extension is implemented as a backwards compatible alternative to the ancient LZHUF compression.

This experiment is enabled by default and sessions between two Pat nodes (or other software supporting this B2F extension) will use gzip compression when transferring messages.

For more information, see <https://github.com/la5nta/wl2k-go#gzip-experiment>.

## Copyright/License

Copyright (c) 2020 Martin Hebnes Pedersen LA5NTA

Phat's changes are copyright Dennis M (denmojo) and released under the same MIT license.

### Contributors (alphabetical)

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

The JNOS developers for the properly maintained lzhuf implementation, as well as the original author Haruyasu Yoshizaki.

The paclink-unix team (Nicholas S. Castellano N2QZ and others) - reference implementation

Amateur Radio Safety Foundation, Inc. - The Winlink 2000 project

F6FBB Jean-Paul ROUBELAT - the FBB forwarding protocol

_Pat/wl2k-go is not affiliated with The Winlink Development Team nor the Winlink 2000 project [http://winlink.org]._
