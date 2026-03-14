#!/bin/bash
set -euo pipefail

BUNDLE_ID="${BUNDLE_ID:-com.clarityone.safari}"
APP_NAME="${APP_NAME:-ClarityOne Safari}"
SAFARI_DIST_DIR="dist/safari"
WEBEXT_DIR="$SAFARI_DIST_DIR/clarityone"
PROJECT_DIR="$SAFARI_DIST_DIR/xcode"

if ! command -v xcrun >/dev/null 2>&1; then
  echo "xcrun was not found. Please install Xcode command line tools first."
  exit 1
fi

bash scripts/build.sh safari

mkdir -p "$PROJECT_DIR"

xcrun safari-web-extension-converter "$WEBEXT_DIR" \
  --project-location "$PROJECT_DIR" \
  --app-name "$APP_NAME" \
  --bundle-identifier "$BUNDLE_ID" \
  --swift \
  --macos-only \
  --copy-resources \
  --force \
  --no-open \
  --no-prompt

echo "Safari Xcode project created under $PROJECT_DIR"
