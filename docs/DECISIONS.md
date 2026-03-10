# ClarityOne — Architecture Decisions

## 2026-03-10: MVP Implementation

### What changed
1. **Font scale uses `1rem` instead of `1em`** (content.css) — prevents font-size compounding on nested elements
2. **Contrast themes deepened** — headings, links, buttons, inputs, tables all receive per-theme styling for all 3 modes (light, dark, yellow-on-black)
3. **MutationObserver fixed** — removed `GET_SETTINGS` call from observer callback; debounced to 300ms; only re-checks skip link presence
4. **Line-height slider added** to popup UI and wired through settings pipeline
5. **ARIA labels, `aria-live`, `aria-value*`** added to all popup controls
6. **Duplicate `DEFAULT_SETTINGS` removed** from popup.js — popup now gets defaults from background.js via `GET_SETTINGS` and `RESET_SETTINGS` messages
7. **`RESET_SETTINGS` message handler** added to background.js
8. **Default key merging on extension update** — `onInstalled` now spreads `DEFAULT_SETTINGS` under existing values so new keys are added without overwriting user prefs
9. **Icon paths fixed** in manifest.json from `../icons/` to `icons/`
10. **Build script, tests, test checklist** added

### Why
The scaffold had several bugs that would break real-world usage: font compounding made nested text unreadable, the MutationObserver caused a message storm on SPAs, contrast themes only styled body/html, and there was no line-height control. These were all blocking issues for an MVP release.

### Tradeoffs
- **`1rem` vs `1em`**: Using `rem` means font scale is relative to the root only, losing any intentional relative sizing on the original page. This is acceptable for an accessibility tool where predictable sizing matters more.
- **Debounce at 300ms**: Balances responsiveness with performance. Skip link re-check could lag on very fast DOM changes, but this is cosmetic.
- **No per-site overrides UI yet**: `siteOverrides` key exists in settings but has no popup UI — deferred to post-MVP.
- **Unit tests mock Chrome APIs**: Tests don't run in a real extension context, so integration issues could be missed. Manual testing checklist covers the gap.
