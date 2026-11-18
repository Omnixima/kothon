#!/usr/bin/env bash
# Build a signed, notarized Kothon release for Apple Silicon, plus the
# updater feed (latest.json) the app checks on GitHub Releases.
#
# Needs, on this Mac:
#   - a "Developer ID Application" certificate in the keychain
#   - notarytool credentials: xcrun notarytool store-credentials kothon ...
#   - the updater key: ~/.tauri/kothon-updater.key (back it up! losing it
#     means existing installs can never update again)
#
# Usage: scripts/kothon/release.sh            # version from tauri.conf.json
# Output: release/<version>/ with Kothon_<v>_aarch64.dmg,
#         Kothon_<v>_aarch64.app.tar.gz(.sig) and latest.json.
# Then: gh release create v<version> release/<version>/* --title "Kothon <version>"
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

IDENTITY="${APPLE_SIGNING_IDENTITY:-$(security find-identity -v -p codesigning | sed -n 's/.*"\(Developer ID Application:[^"]*\)".*/\1/p' | head -1)}"
PROFILE="${NOTARY_PROFILE:-kothon}"
KEY="${TAURI_SIGNING_PRIVATE_KEY_PATH:-$HOME/.tauri/kothon-updater.key}"
VERSION="$(python3 -c 'import json;print(json.load(open("src-tauri/tauri.conf.json"))["version"])')"
REPO="Omnixima/kothon"
OUT="release/$VERSION"
BUNDLE="src-tauri/target/release/bundle"

[ -n "$IDENTITY" ] || { echo "No Developer ID Application certificate found" >&2; exit 1; }
[ -f "$KEY" ] || { echo "Updater key missing: $KEY" >&2; exit 1; }
echo "Kothon $VERSION, signing as: $IDENTITY"

# 1. Signed build (app + dmg + updater tarball).
APPLE_SIGNING_IDENTITY="$IDENTITY" \
TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY")" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
CMAKE_POLICY_VERSION_MINIMUM=3.5 \
  bun run tauri build --bundles app,dmg

APP="$BUNDLE/macos/Kothon.app"
DMG="$(ls "$BUNDLE"/dmg/Kothon_"$VERSION"_*.dmg | head -1)"

# 2. Notarize and staple the app, then rebuild the updater tarball from it.
ZIP="$(mktemp -d)/Kothon.zip"
ditto -c -k --keepParent "$APP" "$ZIP"
xcrun notarytool submit "$ZIP" --keychain-profile "$PROFILE" --wait
xcrun stapler staple "$APP"
TAR="$BUNDLE/macos/Kothon.app.tar.gz"
rm -f "$TAR" "$TAR.sig"
tar -czf "$TAR" -C "$BUNDLE/macos" Kothon.app
TAURI_SIGNING_PRIVATE_KEY="$(cat "$KEY")" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
  bunx tauri signer sign "$TAR" >/dev/null

# 3. Notarize and staple the DMG.
xcrun notarytool submit "$DMG" --keychain-profile "$PROFILE" --wait
xcrun stapler staple "$DMG"

# 4. Collect assets and write the updater feed.
mkdir -p "$OUT"
cp "$DMG" "$OUT/"
cp "$TAR" "$OUT/Kothon_${VERSION}_aarch64.app.tar.gz"
cp "$TAR.sig" "$OUT/Kothon_${VERSION}_aarch64.app.tar.gz.sig"
python3 - "$OUT" "$VERSION" "$REPO" <<'PY'
import json, sys, datetime, pathlib
out, version, repo = sys.argv[1:]
sig = pathlib.Path(out, f"Kothon_{version}_aarch64.app.tar.gz.sig").read_text().strip()
url = f"https://github.com/{repo}/releases/download/v{version}/Kothon_{version}_aarch64.app.tar.gz"
feed = {
    "version": version,
    "notes": f"Kothon {version}",
    "pub_date": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "platforms": {"darwin-aarch64": {"signature": sig, "url": url}},
}
pathlib.Path(out, "latest.json").write_text(json.dumps(feed, indent=2) + "\n")
PY

spctl -a -vvv -t open --context context:primary-signature "$OUT"/*.dmg
echo
echo "Done: $OUT"
ls -la "$OUT"
echo
echo "Publish with:"
echo "  gh release create v$VERSION $OUT/* --repo $REPO --title \"Kothon $VERSION\" --notes-file src/content/release-notes/$VERSION.md"
