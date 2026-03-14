# Safari Setup (Local Testing)

This project now supports separate Chrome and Safari packaging from the same source code.

## What changed
- Chrome manifest source: `clarityone/src/manifest.chrome.json`
- Safari manifest source: `clarityone/src/manifest.safari.json`
- Existing development manifest remains: `clarityone/src/manifest.json` (Chrome dev load stays unchanged)

## Build commands
- Build both targets: `npm run build`
- Build Chrome only: `npm run build:chrome`
- Build Safari only: `npm run build:safari`
- Build Chrome tester package (out-of-store): `npm run build:chrome-tester`
- Build one combined timestamped test release: `npm run build:test-release`

Artifacts:
- `dist/clarityone-chrome.zip`
- `dist/clarityone-safari.zip`
- `dist/clarityone.zip` (compatibility alias to Chrome zip)
- `dist/clarityone-chrome-tester.zip` (shareable unpacked install package)
- `dist/releases/clarityone-test-vX.Y.Z-YYYYMMDD-HHMMSS/`
- `dist/releases/clarityone-test-vX.Y.Z-YYYYMMDD-HHMMSS.zip`

## Create Safari Xcode project
Run:

```bash
npm run safari:convert
```

Optional custom app name / bundle id:

```bash
APP_NAME="ClarityOne Safari Dev" BUNDLE_ID="com.clarityone.safari.dev" npm run safari:convert
```

This generates a macOS Safari extension app project in:
- `dist/safari/xcode/`

## Enable in Safari
1. Open the generated Xcode project and run it once.
2. In Safari, go to `Settings` > `Extensions`.
3. Enable `ClarityOne Safari`.
4. Grant website permissions (for "All Websites" if you want behavior similar to Chrome's `<all_urls>`).
