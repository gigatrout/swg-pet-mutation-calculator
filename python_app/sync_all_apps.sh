#!/usr/bin/env bash
# Copy root web assets into every app bundle staging folder.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CALC_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

targets=(
  "$CALC_ROOT/python_app/web"
  "$CALC_ROOT/windows_app/web"
  "$CALC_ROOT/macos_app/build/web"
)

for dest in "${targets[@]}"; do
  bash "$SCRIPT_DIR/sync_web.sh" "$CALC_ROOT" "$dest"
done

echo "Synced web assets to:"
for dest in "${targets[@]}"; do
  echo "  $dest"
done
