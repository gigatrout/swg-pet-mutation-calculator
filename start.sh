#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$DIR/.server.pid"
PORT="${PORT:-8766}"
URL="http://localhost:${PORT}/"

if [[ -f "$PIDFILE" ]]; then
  PID="$(cat "$PIDFILE")"
  if kill -0 "$PID" 2>/dev/null; then
    echo "Already running (pid ${PID})."
    echo "Open: ${URL}"
    exit 0
  fi
  rm -f "$PIDFILE"
fi

cd "$DIR"
python3 -m http.server "$PORT" >/dev/null 2>&1 &
echo $! >"$PIDFILE"
echo "Hydro point calculator started on port ${PORT}."
echo "Open: ${URL}"
if command -v open >/dev/null 2>&1; then
  open "$URL" || true
fi
