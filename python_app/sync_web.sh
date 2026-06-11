#!/usr/bin/env bash
# Copy calculator web assets into a target web/ folder (for PyInstaller bundles).
set -euo pipefail

SRC="${1:-}"
DEST="${2:-}"

if [[ -z "$SRC" || -z "$DEST" ]]; then
  echo "Usage: sync_web.sh <calculator-root> <dest-web-dir>" >&2
  exit 1
fi

mkdir -p "$DEST"
for name in index.html app.js incubation_calc.js nutrient_alloc_data.js styles.css hydro_combos_data.js pet_mutations_data.js \
  favicon.ico favicon-16.png favicon-32.png; do
  if [[ -f "$SRC/$name" ]]; then
    cp "$SRC/$name" "$DEST/"
  fi
done
if [[ -d "$SRC/assets/pet-images" ]]; then
  mkdir -p "$DEST/assets/pet-images"
  cp -R "$SRC/assets/pet-images/." "$DEST/assets/pet-images/"
fi
