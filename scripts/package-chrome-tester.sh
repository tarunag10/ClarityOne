#!/bin/bash
set -euo pipefail

DIST_DIR="dist"
CHROME_BUILD_DIR="$DIST_DIR/chrome/clarityone"
TESTER_DIR="$DIST_DIR/chrome-tester"
UNPACKED_DIR="$TESTER_DIR/clarityone-unpacked"
GUIDE_FILE="$TESTER_DIR/INSTALL-CHROME.md"
ZIP_FILE="$DIST_DIR/clarityone-chrome-tester.zip"

bash scripts/build.sh chrome

mkdir -p "$UNPACKED_DIR"
cp -R "$CHROME_BUILD_DIR"/. "$UNPACKED_DIR"/
cp docs/CHROME-TESTER-INSTALL.md "$GUIDE_FILE"

(
  cd "$TESTER_DIR"
  zip -qr "../clarityone-chrome-tester.zip" .
)

echo "Built $ZIP_FILE"
echo "Share this with testers: $ZIP_FILE"
