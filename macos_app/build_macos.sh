#!/usr/bin/env bash
# Build a macOS .app and .dmg for Hydro Point Calculator.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
CALC_ROOT="$(cd "$ROOT/.." && pwd)"
SRC="$CALC_ROOT/python_app"
BUILD="$ROOT/build"
DIST="$ROOT/dist"
APP_NAME="Hydro Point Calculator"
ICON="$CALC_ROOT/favicon-32.png"

rm -rf "$BUILD" "$DIST"
mkdir -p "$BUILD/web"

cp "$SRC/app.py" "$BUILD/"
bash "$SRC/sync_web.sh" "$CALC_ROOT" "$BUILD/web"

python3 -m pip install --quiet --upgrade pyinstaller pywebview pillow

PY_ARGS=(
  --noconfirm
  --clean
  --windowed
  --name "$APP_NAME"
  --distpath "$DIST"
  --workpath "$BUILD/pyinstaller-work"
  --specpath "$BUILD"
  --add-data "$BUILD/web:web"
  --hidden-import webview
)

if [[ -f "$ICON" ]]; then
  PY_ARGS+=(--icon "$ICON")
fi

python3 -m PyInstaller "${PY_ARGS[@]}" "$BUILD/app.py"

APP_PATH="$DIST/$APP_NAME.app"
DMG_PATH="$ROOT/Hydro-Point-Calculator.dmg"
STAGING="$BUILD/dmg-staging"

rm -f "$DMG_PATH"
mkdir -p "$STAGING"
cp -R "$APP_PATH" "$STAGING/"
ln -s /Applications "$STAGING/Applications"

hdiutil create \
  -volname "$APP_NAME" \
  -srcfolder "$STAGING" \
  -ov \
  -format UDZO \
  "$DMG_PATH"

echo "Built: $APP_PATH"
echo "DMG:   $DMG_PATH"
