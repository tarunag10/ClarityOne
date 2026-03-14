#!/bin/bash
set -euo pipefail

BUNDLE_ID="${BUNDLE_ID:-com.clarityone.safari}"
APP_NAME="${APP_NAME:-ClarityOne Safari}"
SAFARI_DIST_DIR="dist/safari"
WEBEXT_DIR="$SAFARI_DIST_DIR/clarityone"
PROJECT_DIR="$SAFARI_DIST_DIR/xcode"
PROJECT_NAME_DIR="$PROJECT_DIR/$APP_NAME"
PBXPROJ_FILE="$PROJECT_NAME_DIR/$APP_NAME.xcodeproj/project.pbxproj"
EXTENSION_BUNDLE_ID="${BUNDLE_ID}.Extension"

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

if [ -f "$PBXPROJ_FILE" ]; then
  # Some generated projects may use an app bundle id derived from app-name.
  # Force deterministic bundle ids so the extension id is prefixed by app id.
  perl -i -pe '
    if (/PRODUCT_BUNDLE_IDENTIFIER = .*Extension"?;/) {
      s/PRODUCT_BUNDLE_IDENTIFIER = .*;/PRODUCT_BUNDLE_IDENTIFIER = '"$EXTENSION_BUNDLE_ID"';/;
    } elsif (/PRODUCT_BUNDLE_IDENTIFIER = /) {
      s/PRODUCT_BUNDLE_IDENTIFIER = .*;/PRODUCT_BUNDLE_IDENTIFIER = '"$BUNDLE_ID"';/;
    }
  ' "$PBXPROJ_FILE"
fi

echo "Safari Xcode project created under $PROJECT_DIR"
