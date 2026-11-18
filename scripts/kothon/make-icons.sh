#!/usr/bin/env bash
# Regenerate all Kothon icons from the branding folder.
# Usage: make-icons.sh [BRANDING_DIR] [PYTHON_WITH_PILLOW]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BRANDING="${1:-$HOME/Desktop/kothon-mac/branding}"
PY="${2:-python3}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

"$PY" "$ROOT/scripts/kothon/make_icons.py" "$BRANDING" "$WORK" "$ROOT/src-tauri/resources"

# All platform sizes from the large master.
(cd "$ROOT" && bunx tauri icon "$WORK/icon-master.png" -o src-tauri/icons >/dev/null)

# The ক-only version reads better at the smallest sizes.
sips -z 32 32 "$WORK/icon-master-small.png" --out "$ROOT/src-tauri/icons/32x32.png" >/dev/null

# macOS .icns with the small version at 16 and 32 pt.
SET="$WORK/icon.iconset"
mkdir -p "$SET"
for s in 16 32; do
  sips -z $s $s "$WORK/icon-master-small.png" --out "$SET/icon_${s}x${s}.png" >/dev/null
done
sips -z 32 32 "$WORK/icon-master-small.png" --out "$SET/icon_16x16@2x.png" >/dev/null
sips -z 64 64 "$WORK/icon-master.png" --out "$SET/icon_32x32@2x.png" >/dev/null
for s in 128 256 512; do
  sips -z $s $s "$WORK/icon-master.png" --out "$SET/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) "$WORK/icon-master.png" --out "$SET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o "$ROOT/src-tauri/icons/icon.icns"
echo "icons written to src-tauri/icons and src-tauri/resources"
