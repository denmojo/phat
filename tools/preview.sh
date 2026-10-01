#!/usr/bin/env bash
# Preview server: builds Phat and serves a seeded test mailbox on localhost,
# from throwaway directories under .preview/, so the web client can be
# reviewed with realistic mail and nothing touches a real Pat or Phat setup.
#
# Usage: tools/preview.sh start|stop|restart|reset|status
#   start    build, seed on first run, serve in the background
#   stop     stop the server
#   restart  rebuild and restart, keeping the mailbox (stars, labels, moves)
#   reset    stop, wipe .preview, reseed, start
#   status   show whether it runs and where
#
# PREVIEW_ADDR overrides the listen address (default 127.0.0.1:8090), for
# example the tailnet address to review from another device.
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$PWD/.preview"
# A PREVIEW_ADDR given once is remembered in .preview/addr for later runs.
if [[ -n "${PREVIEW_ADDR:-}" ]]; then
	ADDR="$PREVIEW_ADDR"
elif [[ -f "$ROOT/addr" ]]; then
	ADDR="$(cat "$ROOT/addr")"
else
	ADDR="127.0.0.1:8090"
fi
CALL="N0CALL"
PIDFILE="$ROOT/phat.pid"

running() { [[ -f "$PIDFILE" ]] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; }

stop() {
	if running; then
		kill "$(cat "$PIDFILE")"
		for _ in 1 2 3 4 5 6 7 8 9 10; do running || break; sleep 0.3; done
	fi
	rm -f "$PIDFILE"
}

start() {
	if running; then
		echo "already running: http://$ADDR/ui"
		return
	fi
	mkdir -p "$ROOT/xdg" "$ROOT/mailbox"
	echo "$ADDR" >"$ROOT/addr"
	go build -o "$ROOT/phat" .
	if [[ ! -f "$ROOT/config.json" ]]; then
		printf '{"mycall":"%s","locator":"CM98","http_addr":"%s","version_reporting_disabled":true}\n' "$CALL" "$ADDR" >"$ROOT/config.json"
	fi
	if [[ ! -d "$ROOT/mailbox/$CALL" ]]; then
		go run ./tools/previewseed "$ROOT/mailbox" "$CALL"
	fi
	XDG_CONFIG_HOME="$ROOT/xdg" XDG_DATA_HOME="$ROOT/xdg" XDG_STATE_HOME="$ROOT/xdg" \
		nohup "$ROOT/phat" --mycall "$CALL" --config "$ROOT/config.json" \
		--mbox "$ROOT/mailbox" --log "$ROOT/phat.log" http -a "$ADDR" \
		>"$ROOT/server.out" 2>&1 &
	echo $! >"$PIDFILE"
	for _ in $(seq 1 30); do
		curl -sf "http://$ADDR/api/folders" >/dev/null 2>&1 && break
		sleep 0.3
	done
	if curl -sf "http://$ADDR/api/folders" >/dev/null 2>&1; then
		echo "serving: http://$ADDR/ui"
	else
		echo "server did not answer; see $ROOT/server.out" >&2
		exit 1
	fi
}

case "${1:-}" in
start) start ;;
stop) stop ;;
restart) stop; start ;;
reset) stop; rm -rf "$ROOT"; start ;;
status)
	if running; then echo "running (pid $(cat "$PIDFILE")): http://$ADDR/ui"; else echo "stopped"; fi
	;;
*)
	echo "usage: $0 start|stop|restart|reset|status" >&2
	exit 2
	;;
esac
