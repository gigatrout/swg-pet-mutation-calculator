#!/usr/bin/env bash
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"

bash "$DIR/sync_web.sh" "$ROOT" "$DIR/web"

if ! python3 -c "import webview" 2>/dev/null; then
  python3 -m pip install --quiet -r "$DIR/requirements.txt"
fi

exec python3 "$DIR/app.py"
