# Contributing to Phat

Phat is a personal project, maintained in spare time. Issues and pull requests are welcome and get read, but there's no promise of support, a reply, or a fix on any schedule.

## Where a bug belongs

Phat runs Pat's engine unchanged: the B2F session, wl2k-go, and every transport (telnet, ARDOP, VARA, PACTOR, AX.25). If a bug also happens in [Pat](https://github.com/la5nta/pat), report it there, so it's fixed for everyone and comes back to Phat with the next merge from upstream.

Report it here when it only happens in Phat: the web client, the mailbox index, folders, labels, stars, search, or the settings page.

## Reporting a bug

Include the output of `phat version`, your operating system, what you did, what you expected, and what happened instead, with any error message or log lines.

## Pull requests

Base them on `main`. Before opening one, run `go test ./...` at the top and `npm test` in `web/`, and build the client with `npm run build` so `web/dist` matches the source. One change per pull request, with a commit subject in the imperative ("Fix label colors in dark mode").
