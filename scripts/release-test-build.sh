#!/bin/bash
set -euo pipefail

VERSION="$(node -p "require('./package.json').version")"
STAMP="$(date +%Y%m%d-%H%M%S)"
RELEASE_NAME="clarityone-test-v${VERSION}-${STAMP}"
RELEASES_DIR="dist/releases"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"
MASTER_ZIP="$RELEASES_DIR/${RELEASE_NAME}.zip"
KEEP_RELEASES="${KEEP_RELEASES:-1}"

mkdir -p "$RELEASE_DIR"

bash scripts/package-chrome-tester.sh
bash scripts/safari-convert.sh

bash scripts/validate-release-package.sh \
  dist/clarityone-chrome-tester.zip \
  dist/clarityone-safari.zip

cp dist/clarityone-chrome-tester.zip "$RELEASE_DIR/"
cp dist/clarityone-safari.zip "$RELEASE_DIR/"

(
  cd dist/safari
  zip -qr "../../$RELEASE_DIR/safari-xcode-project.zip" xcode
)

bash scripts/validate-release-package.sh \
  "$RELEASE_DIR/clarityone-chrome-tester.zip" \
  "$RELEASE_DIR/clarityone-safari.zip"

cat > "$RELEASE_DIR/RELEASE-NOTES.txt" <<EOF
ClarityOne Test Release
Version: $VERSION
Generated: $STAMP

Contents:
- clarityone-chrome-tester.zip (share with Chrome testers)
- clarityone-safari.zip (Safari web extension package)
- safari-xcode-project.zip (Safari local testing via Xcode)
EOF

(
  cd "$RELEASES_DIR"
  zip -qr "${RELEASE_NAME}.zip" "$RELEASE_NAME"
)

echo "Release folder: $RELEASE_DIR"
echo "Master shareable zip: $MASTER_ZIP"

# Keep only the newest N release folder+zip pairs to avoid clutter.
if [[ "$KEEP_RELEASES" =~ ^[0-9]+$ ]] && [ "$KEEP_RELEASES" -ge 1 ]; then
  (
    cd "$RELEASES_DIR"
    ls -1dt clarityone-test-v* 2>/dev/null | tail -n +"$((KEEP_RELEASES + 1))" | while read -r old; do
      rm -rf "$old" "${old}.zip"
    done
  )
  echo "Kept latest $KEEP_RELEASES release(s) in $RELEASES_DIR"
fi
