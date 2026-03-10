# ClarityOne Manual Test Checklist

## Automated Testing
- `npm run test` runs unit tests for background/settings logic.
- `npm run test:e2e` runs Playwright extension tests and requires a local GUI/browser environment that can launch an unpacked extension context.
- `npm run test:all` always runs `npm run test`, then auto-runs e2e only when the environment supports it.
- `SKIP_E2E=1 npm run test:all` skips e2e explicitly.
- `REQUIRE_E2E=1 npm run test:all` fails if e2e cannot run in the current environment.
- `npm run test:ci` runs `build` + unit tests only (safe for headless CI).

## Setup
- [ ] Load unpacked extension from `clarityone/src/` in `chrome://extensions`
- [ ] Verify all 3 icons appear (16, 48, 128)

## Font Scaling (C1)
- [ ] Enable extension, set font scale to 1.5x
- [ ] Open a page with deeply nested elements (e.g. `<div><div><p><span>text</span></p></div></div>`)
- [ ] Verify text does NOT compound — all text should be same size regardless of nesting depth

## Contrast Themes (C2)
- [ ] Test **Light** mode: headings, links, buttons, inputs, tables all styled correctly
- [ ] Test **Dark** mode: all elements have white text on dark backgrounds, links are blue
- [ ] Test **Yellow-on-black** mode: all elements yellow on black, links cyan

## MutationObserver (C3)
- [ ] Open DevTools Performance tab on a SPA (e.g. Gmail, Twitter)
- [ ] Navigate between views — verify no message storm in console
- [ ] Verify skip link still appears after SPA navigation

## Line Height (P1)
- [ ] Open popup, verify line-height slider is present
- [ ] Adjust slider — verify page content line-height updates live

## ARIA / Accessibility (P2)
- [ ] Keyboard-navigate entire popup with Tab key
- [ ] Verify screen reader announces all controls with proper labels
- [ ] Verify output values are announced on change (aria-live)

## Settings Persistence (S1/S2)
- [ ] Change settings, close and reopen browser — settings persist
- [ ] Click "Reset to defaults" — all values return to defaults
- [ ] Update extension version — existing settings preserved, new keys merged

## Per-Site Settings Overrides (SO1)
- [ ] Open popup on any site — "Custom settings for [hostname]" toggle is visible
- [ ] Enable the site override toggle — checkbox becomes checked
- [ ] Change contrast mode while override is active — only that site is affected
- [ ] Navigate to a different site, open popup — global settings shown, override toggle unchecked
- [ ] Return to first site, open popup — custom settings still applied, toggle checked
- [ ] Disable the site override toggle — settings revert to global
- [ ] Click "Reset to defaults" — site overrides are cleared, toggle unchecked
- [ ] Open popup on `chrome://extensions` — site override row is hidden (no hostname)

## Keyboard Shortcut
- [ ] Press Alt+Shift+A — extension toggles on/off
