#!/bin/bash
set -e
DIST_DIR="dist"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/clarityone/icons"

cp clarityone/src/*.js clarityone/src/*.css clarityone/src/*.html clarityone/src/manifest.json "$DIST_DIR/clarityone/"
cp clarityone/icons/*.png "$DIST_DIR/clarityone/icons/"

cd "$DIST_DIR/clarityone"
zip -r ../clarityone.zip .
cd ../..

echo "Built dist/clarityone.zip"
