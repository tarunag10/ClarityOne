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

check_safari_preflight() {
  local status=0

  echo "Safari conversion preflight"

  if command -v xcrun >/dev/null 2>&1; then
    echo "- xcrun: found"
  else
    echo "- xcrun: missing. Install Xcode command line tools or full Xcode."
    status=1
  fi

  if command -v xcrun >/dev/null 2>&1 && xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
    echo "- safari-web-extension-converter: found"
  else
    echo "- safari-web-extension-converter: missing. Install/activate a recent Xcode that includes Safari Web Extension support."
    status=1
  fi

  if [ -d "$PROJECT_NAME_DIR/$APP_NAME.xcodeproj" ] || [ -f "$PBXPROJ_FILE" ]; then
    echo "- generated Xcode project: found under $PROJECT_DIR"
  else
    echo "- generated Xcode project: not found yet. Run npm run safari:convert after preflight passes."
  fi

  echo ""
  echo "Remaining manual Safari release steps:"
  echo "- Open the generated project in Xcode."
  echo "- Select an Apple team and validate bundle identifiers/signing."
  echo "- Run the app once locally, then enable the extension in Safari settings."
  echo "- Archive/notarize/sign with your Apple Developer credentials before distribution."

  return "$status"
}

if [ "${1:-}" = "--preflight" ]; then
  check_safari_preflight
  exit $?
fi

check_safari_preflight
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
  perl -i -pe '
    if (/PRODUCT_BUNDLE_IDENTIFIER = .*Extension"?;/) {
      s/PRODUCT_BUNDLE_IDENTIFIER = .*;/PRODUCT_BUNDLE_IDENTIFIER = '"$EXTENSION_BUNDLE_ID"';/;
    } elsif (/PRODUCT_BUNDLE_IDENTIFIER = /) {
      s/PRODUCT_BUNDLE_IDENTIFIER = .*;/PRODUCT_BUNDLE_IDENTIFIER = '"$BUNDLE_ID"';/;
    }
  ' "$PBXPROJ_FILE"
fi

if [ ! -f "$PBXPROJ_FILE" ]; then
  echo "Safari converter did not generate expected project file: $PBXPROJ_FILE"
  exit 1
fi

echo "Safari Xcode project created under $PROJECT_DIR"
echo "Manual next steps: open the project in Xcode, set signing/team, run once, enable the extension in Safari, then archive/notarize for distribution."
