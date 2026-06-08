#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PIDFILE="$DIR/.server.pid"

if [[ ! -f "$PIDFILE" ]]; then
  echo "Not running."
  exit 0
fi

PID="$(cat "$PIDFILE")"
if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  echo "Stopped (pid ${PID})."
else
  echo "Stale pid file; not running."
fi
rm -f "$PIDFILE"
