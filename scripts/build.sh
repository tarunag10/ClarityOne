#!/bin/bash
set -euo pipefail

DIST_DIR="dist"
SRC_DIR="clarityone/src"
ICON_SRC_DIR="clarityone/icons"

TARGET="${1:-all}"

build_target() {
  local target="$1"
  local manifest_file="$2"
  local out_dir="$DIST_DIR/$target/clarityone"
  local zip_name="$DIST_DIR/clarityone-$target.zip"

  rm -rf "$out_dir"
  mkdir -p "$out_dir/icons"

  cp "$SRC_DIR"/*.js "$SRC_DIR"/*.css "$SRC_DIR"/*.html "$out_dir/"
  cp "$ICON_SRC_DIR"/*.png "$out_dir/icons/"
  cp "$manifest_file" "$out_dir/manifest.json"

  (
    cd "$out_dir"
    zip -qr "../../clarityone-$target.zip" .
  )

  echo "Built $zip_name"
}

case "$TARGET" in
  chrome)
    build_target "chrome" "$SRC_DIR/manifest.chrome.json"
    cp "$DIST_DIR/clarityone-chrome.zip" "$DIST_DIR/clarityone.zip"
    ;;
  safari)
    build_target "safari" "$SRC_DIR/manifest.safari.json"
    ;;
  all)
    build_target "chrome" "$SRC_DIR/manifest.chrome.json"
    build_target "safari" "$SRC_DIR/manifest.safari.json"
    cp "$DIST_DIR/clarityone-chrome.zip" "$DIST_DIR/clarityone.zip"
    echo "Built compatibility artifact dist/clarityone.zip (Chrome)"
    ;;
  *)
    echo "Usage: $0 [chrome|safari|all]"
    exit 1
    ;;
esac
