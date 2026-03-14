#!/bin/bash
set -euo pipefail

VERSION="$(node -p "require('./package.json').version")"
STAMP="$(date +%Y%m%d-%H%M%S)"
RELEASE_NAME="clarityone-test-v${VERSION}-${STAMP}"
RELEASES_DIR="dist/releases"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"
MASTER_ZIP="$RELEASES_DIR/${RELEASE_NAME}.zip"

mkdir -p "$RELEASE_DIR"

bash scripts/package-chrome-tester.sh
bash scripts/safari-convert.sh

cp dist/clarityone-chrome-tester.zip "$RELEASE_DIR/"
cp dist/clarityone-safari.zip "$RELEASE_DIR/"

(
  cd dist/safari
  zip -qr "../../$RELEASE_DIR/safari-xcode-project.zip" xcode
)

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
