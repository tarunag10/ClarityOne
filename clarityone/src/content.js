const ROOT_CLASS = 'clarityone-enabled';
const STYLE_ID = 'clarityone-inline-style';
const SKIP_LINK_ID = 'clarityone-skip-link';
const SCALED_ATTR = 'data-clarityone-base-font-size';
const READING_MODE_CLASS = 'clarityone-reading-mode';
const READING_TARGET_CLASS = 'clarityone-reading-target';
const TEXT_SELECTOR = [
  'p', 'span', 'a', 'li', 'dt', 'dd', 'label', 'button', 'input', 'textarea',
  'select', 'th', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'small', 'strong',
  'em', 'blockquote', 'figcaption', 'div'
].join(',');

let currentSettings = null;
let readingTarget = null;

function ensureInlineStyle() {
  let styleEl = document.getElementById(STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.documentElement.appendChild(styleEl);
  }
  return styleEl;
}

function ensureSkipLink() {
  if (document.getElementById(SKIP_LINK_ID)) return;

  const mainTarget =
    document.querySelector('main') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('#main-content') ||
    document.body.firstElementChild;

  if (!mainTarget) return;

  if (!mainTarget.id) {
    mainTarget.id = 'clarityone-main-target';
  }

  const skipLink = document.createElement('a');
  skipLink.id = SKIP_LINK_ID;
  skipLink.href = `#${mainTarget.id}`;
  skipLink.className = 'clarityone-skip-link';
  skipLink.textContent = 'Skip to content';
  document.body.prepend(skipLink);
}

function clearTextScale() {
  const scaled = document.querySelectorAll(`[${SCALED_ATTR}]`);
  for (const el of scaled) {
    el.style.removeProperty('font-size');
    el.removeAttribute(SCALED_ATTR);
  }
}

function getReadingTarget() {
  return (
    document.querySelector('article') ||
    document.querySelector('main') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('#content') ||
    document.querySelector('.content') ||
    document.body
  );
}

function applyReadingMode(enabled) {
  const root = document.documentElement;
  root.classList.remove(READING_MODE_CLASS);
  if (readingTarget) {
    readingTarget.classList.remove(READING_TARGET_CLASS);
    readingTarget = null;
  }
  if (!enabled) return;
  readingTarget = getReadingTarget();
  if (!readingTarget) return;
  readingTarget.classList.add(READING_TARGET_CLASS);
  root.classList.add(READING_MODE_CLASS);
}

function applyTextScale(scale) {
  const targets = document.querySelectorAll(TEXT_SELECTOR);
  for (const el of targets) {
    if (!el.getAttribute(SCALED_ATTR)) {
      const computed = window.getComputedStyle(el).fontSize;
      const px = Number.parseFloat(computed);
      if (!Number.isFinite(px) || px <= 0) continue;
      el.setAttribute(SCALED_ATTR, String(px));
    }
    const base = Number.parseFloat(el.getAttribute(SCALED_ATTR));
    if (!Number.isFinite(base) || base <= 0) continue;
    el.style.setProperty('font-size', `${(base * scale).toFixed(2)}px`, 'important');
  }
}

function toSelector(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';
  if (el.id) return `#${CSS.escape(el.id)}`;
  const parts = [];
  let node = el;
  while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.body) {
    const tag = node.tagName.toLowerCase();
    const siblings = node.parentElement
      ? Array.from(node.parentElement.children).filter((child) => child.tagName === node.tagName)
      : [];
    const index = siblings.indexOf(node) + 1;
    parts.unshift(`${tag}:nth-of-type(${index})`);
    node = node.parentElement;
  }
  return `body > ${parts.join(' > ')}`;
}

function clearIssueHighlight() {
  for (const el of document.querySelectorAll('.clarityone-a11y-highlight')) {
    el.classList.remove('clarityone-a11y-highlight');
  }
}

function highlightIssue(selector) {
  clearIssueHighlight();
  if (!selector) return { ok: false };
  const el = document.querySelector(selector);
  if (!el) return { ok: false };
  el.classList.add('clarityone-a11y-highlight');
  el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  return { ok: true };
}

function scanPage() {
  const issues = [];
  const pushIssue = (type, message, el, severity = 'medium', suggestion = '') => {
    issues.push({ type, message, severity, suggestion, selector: el ? toSelector(el) : '' });
  };

  const parseRgb = (value) => {
    const match = value && value.match(/rgba?\(([^)]+)\)/i);
    if (!match) return null;
    const parts = match[1].split(',').map((part) => Number.parseFloat(part.trim()));
    if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: Number.isFinite(parts[3]) ? parts[3] : 1 };
  };

  const srgbToLinear = (c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };

  const luminance = (rgb) =>
    (0.2126 * srgbToLinear(rgb.r)) + (0.7152 * srgbToLinear(rgb.g)) + (0.0722 * srgbToLinear(rgb.b));

  const contrastRatio = (fg, bg) => {
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  };

  const findBackgroundColor = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = parseRgb(window.getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0.01) return bg;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };

  const isNaturallyFocusable = (el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return el.hasAttribute('href');
    if (['input', 'select', 'textarea', 'button'].includes(tag)) return !el.hasAttribute('disabled');
    if (tag === 'iframe') return true;
    return false;
  };

  const isFocusable = (el) => {
    if (!el || el.getAttribute('aria-hidden') === 'true') return false;
    const tabindex = el.getAttribute('tabindex');
    if (tabindex !== null) return Number.parseInt(tabindex, 10) >= 0;
    return isNaturallyFocusable(el);
  };

  const knownRoles = new Set([
    'alert', 'alertdialog', 'application', 'article', 'banner', 'blockquote', 'button', 'caption',
    'cell', 'checkbox', 'code', 'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition',
    'deletion', 'dialog', 'directory', 'document', 'emphasis', 'feed', 'figure', 'form', 'generic',
    'grid', 'gridcell', 'group', 'heading', 'img', 'insertion', 'link', 'list', 'listbox', 'listitem',
    'log', 'main', 'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
    'meter', 'navigation', 'none', 'note', 'option', 'paragraph', 'presentation', 'progressbar', 'radio',
    'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'separator',
    'slider', 'spinbutton', 'status', 'strong', 'subscript', 'superscript', 'switch', 'tab', 'table',
    'tablist', 'tabpanel', 'term', 'textbox', 'time', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid',
    'treeitem'
  ]);

  // Images missing useful alt text
  const missingAlt = Array.from(document.querySelectorAll('img')).filter((img) => !img.hasAttribute('alt') || !img.getAttribute('alt').trim());
  for (const img of missingAlt.slice(0, 10)) {
    pushIssue('Image alt text', 'Image is missing alt text.', img, 'high', 'Add a concise alt attribute that describes the image meaning.');
  }

  // Heading structure checks
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const h1s = headings.filter((h) => h.tagName === 'H1');
  if (h1s.length === 0) {
    pushIssue('Heading structure', 'No H1 heading found on the page.', document.querySelector('main') || document.body, 'medium', 'Add one clear H1 that describes the page topic.');
  }
  let lastLevel = 0;
  for (const heading of headings) {
    const level = Number(heading.tagName.replace('H', ''));
    if (lastLevel > 0 && level - lastLevel > 1) {
      pushIssue('Heading structure', `Heading level jumps from H${lastLevel} to H${level}.`, heading, 'medium', 'Use sequential heading levels without skipping.');
    }
    lastLevel = level;
  }

  // Landmark presence checks
  const hasMain = Boolean(document.querySelector('main, [role="main"]'));
  const hasNav = Boolean(document.querySelector('nav, [role="navigation"]'));
  if (!hasMain) {
    pushIssue('Landmarks', 'No main landmark found.', document.body, 'medium', 'Add a <main> region for primary content.');
  }
  if (!hasNav) {
    pushIssue('Landmarks', 'No navigation landmark found.', document.body, 'low', 'Add a <nav> element for primary navigation.');
  }

  // Small text checks
  const textNodes = Array.from(document.querySelectorAll('p, li, span'));
  let smallTextCount = 0;
  for (const el of textNodes) {
    const text = (el.textContent || '').trim();
    if (text.length < 20) continue;
    const size = Number.parseFloat(window.getComputedStyle(el).fontSize);
    if (Number.isFinite(size) && size < 12) {
      smallTextCount += 1;
      if (smallTextCount <= 10) {
        pushIssue('Small text', `Text is ${size.toFixed(1)}px; consider >= 12px.`, el, 'medium', 'Increase font-size to at least 12px for body text.');
      }
    }
  }

  // Form controls missing label checks
  const controls = Array.from(document.querySelectorAll('input, select, textarea')).filter((el) => {
    if (el.tagName === 'INPUT') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return !['hidden', 'submit', 'button', 'image', 'reset'].includes(type);
    }
    return true;
  });
  for (const control of controls.slice(0, 100)) {
    const id = control.getAttribute('id');
    const wrappedByLabel = Boolean(control.closest('label'));
    const labelFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    const aria = control.getAttribute('aria-label') || control.getAttribute('aria-labelledby');
    if (!wrappedByLabel && !labelFor && !aria) {
      pushIssue('Form label', 'Form control appears to be missing an associated label.', control, 'high', 'Associate a <label> using for/id or add aria-label.');
    }
  }

  // Ambiguous links
  const ambiguous = ['click here', 'read more', 'more', 'here', 'link'];
  for (const link of Array.from(document.querySelectorAll('a')).slice(0, 300)) {
    const text = (link.textContent || '').trim().toLowerCase();
    const aria = (link.getAttribute('aria-label') || link.getAttribute('title') || '').trim().toLowerCase();
    if (!text && !aria) {
      pushIssue('Link text', 'Link has no accessible name.', link, 'high', 'Add descriptive visible text or aria-label for the link.');
      continue;
    }
    const basis = text || aria;
    if (ambiguous.includes(basis)) {
      pushIssue('Link text', `Link text "${basis}" is ambiguous.`, link, 'low', 'Use destination-specific link text, for example "Download annual report".');
    }
  }

  // WCAG-aware contrast checks
  let contrastCount = 0;
  const contrastTargets = Array.from(document.querySelectorAll('p, li, a, button, label, span, th, td'));
  for (const el of contrastTargets) {
    const text = (el.textContent || '').trim();
    if (text.length < 8) continue;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    const fg = parseRgb(style.color);
    const bg = findBackgroundColor(el);
    if (!fg || !bg) continue;
    const ratio = contrastRatio(fg, bg);
    const sizePx = Number.parseFloat(style.fontSize);
    const weight = Number.parseInt(style.fontWeight, 10);
    const isBold = Number.isFinite(weight) && weight >= 700;
    const isLargeText = (sizePx >= 24) || (isBold && sizePx >= 18.66);
    const required = isLargeText ? 3.0 : 4.5;
    if (ratio < required) {
      contrastCount += 1;
      if (contrastCount <= 15) {
        pushIssue(
          'Low contrast',
          `Contrast ratio is ${ratio.toFixed(2)}:1 (requires ${required.toFixed(1)}:1).`,
          el,
          ratio < 3 ? 'high' : 'medium',
          'Increase text/background contrast to meet WCAG AA threshold.'
        );
      }
    }
  }

  // Keyboard trap risk heuristics
  for (const el of Array.from(document.querySelectorAll('[tabindex]')).slice(0, 150)) {
    const val = Number.parseInt(el.getAttribute('tabindex') || '', 10);
    if (Number.isFinite(val) && val > 0) {
      pushIssue(
        'Keyboard trap risk',
        `Element uses positive tabindex (${val}), which can break natural tab order.`,
        el,
        'medium',
        'Use tabindex="0" or native focus order instead of positive tabindex.'
      );
    }
  }
  for (const el of Array.from(document.querySelectorAll('[onkeydown], [onkeypress], [onkeyup]')).slice(0, 80)) {
    if (!isFocusable(el)) continue;
    const handler = `${el.getAttribute('onkeydown') || ''} ${el.getAttribute('onkeypress') || ''} ${el.getAttribute('onkeyup') || ''}`.toLowerCase();
    if (handler.includes('preventdefault') || handler.includes('return false')) {
      pushIssue(
        'Keyboard trap risk',
        'Focusable element has keyboard handlers that may block normal keyboard navigation.',
        el,
        'medium',
        'Do not block Tab/Escape keys unless alternative keyboard navigation is provided.'
      );
    }
  }
  for (const modal of Array.from(document.querySelectorAll('dialog, [role="dialog"], [aria-modal="true"]')).slice(0, 20)) {
    const focusables = Array.from(modal.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')).filter(isFocusable);
    if (focusables.length === 0) continue;
    const closeControl = modal.querySelector(
      'button[aria-label*="close" i], button[title*="close" i], [data-close], [data-dismiss], .close, [aria-label="Close"]'
    );
    if (!closeControl) {
      pushIssue(
        'Keyboard trap risk',
        'Dialog-like container has focusable elements but no obvious close control.',
        modal,
        'high',
        'Provide a visible close button and support Escape to close the dialog.'
      );
    }
  }

  // ARIA role misuse checks
  const interactiveRoles = new Set(['button', 'link', 'checkbox', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option', 'radio', 'switch', 'tab']);
  for (const el of Array.from(document.querySelectorAll('[role]')).slice(0, 400)) {
    const roleAttr = (el.getAttribute('role') || '').trim().toLowerCase();
    if (!roleAttr) continue;
    const tokens = roleAttr.split(/\s+/g).filter(Boolean);
    const firstKnown = tokens.find((token) => knownRoles.has(token));
    if (!firstKnown) {
      pushIssue('ARIA role misuse', `Element uses unknown role value "${roleAttr}".`, el, 'high', 'Use only valid WAI-ARIA role names.');
      continue;
    }
    if (interactiveRoles.has(firstKnown) && !isFocusable(el)) {
      pushIssue('ARIA role misuse', `role="${firstKnown}" is not keyboard-focusable.`, el, 'high', 'Make interactive role elements focusable with tabindex="0" and keyboard handlers.');
    }
    if (el.getAttribute('aria-hidden') === 'true' && isFocusable(el)) {
      pushIssue('ARIA role misuse', 'Focusable element is aria-hidden, which hides it from assistive technology.', el, 'high', 'Remove aria-hidden from focusable controls.');
    }
    if (['menuitem', 'menuitemcheckbox', 'menuitemradio'].includes(firstKnown) && !el.closest('[role="menu"], [role="menubar"]')) {
      pushIssue('ARIA role misuse', `${firstKnown} is used outside a menu/menubar container.`, el, 'medium', 'Place menu items inside role="menu" or role="menubar".');
    }
    if (firstKnown === 'option' && !el.closest('[role="listbox"]')) {
      pushIssue('ARIA role misuse', 'role="option" is used outside a listbox.', el, 'medium', 'Place options inside a role="listbox" container.');
    }
    if (firstKnown === 'row' && !el.closest('[role="grid"], [role="table"], [role="treegrid"]')) {
      pushIssue('ARIA role misuse', 'role="row" is used outside grid/table/treegrid.', el, 'low', 'Place rows within appropriate composite table roles.');
    }
  }

  return {
    version: 'v3',
    totalIssues: issues.length,
    issues
  };
}

function applySettings(settings) {
  const root = document.documentElement;
  const body = document.body;
  if (!body) return;
  currentSettings = settings;

  if (!settings.enabled) {
    root.classList.remove(ROOT_CLASS);
    root.classList.remove(READING_MODE_CLASS);
    root.classList.remove(
      'clarityone-contrast-light',
      'clarityone-contrast-dark',
      'clarityone-contrast-yellow',
      'clarityone-contrast-invert',
      'clarityone-cb-deuteranopia',
      'clarityone-cb-protanopia',
      'clarityone-cb-tritanopia'
    );
    if (readingTarget) {
      readingTarget.classList.remove(READING_TARGET_CLASS);
      readingTarget = null;
    }
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.textContent = '';
    clearTextScale();
    return;
  }

  root.classList.add(ROOT_CLASS);
  root.classList.remove(
    'clarityone-contrast-light',
    'clarityone-contrast-dark',
    'clarityone-contrast-yellow',
    'clarityone-contrast-invert',
    'clarityone-cb-deuteranopia',
    'clarityone-cb-protanopia',
    'clarityone-cb-tritanopia'
  );
  root.classList.add(`clarityone-contrast-${settings.contrastMode}`);
  if (settings.colorBlindMode && settings.colorBlindMode !== 'none') {
    root.classList.add(`clarityone-cb-${settings.colorBlindMode}`);
  }

  const styleEl = ensureInlineStyle();
  styleEl.textContent = `
    :root {
      --clarityone-font-scale: ${settings.fontScale};
      --clarityone-line-height: ${settings.lineHeight};
      --clarityone-letter-spacing: ${settings.letterSpacing ?? 0.02}em;
      --clarityone-word-spacing: ${settings.wordSpacing ?? 0.05}em;
      --clarityone-paragraph-spacing: ${settings.paragraphSpacing ?? 1.2}em;
      --clarityone-font-family: ${
        settings.dyslexiaFont
          ? '"OpenDyslexic", "Atkinson Hyperlegible", Arial, Helvetica, sans-serif'
          : (settings.readableFont ? 'Arial, Helvetica, sans-serif' : 'inherit')
      };
      --clarityone-focus-outline: ${settings.enhancedFocus ? '3px solid #ff9900' : 'initial'};
    }
  `;

  applyTextScale(settings.fontScale);
  applyReadingMode(Boolean(settings.readingMode));
  ensureSkipLink();
}

let debounceTimer = null;
const observer = new MutationObserver(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    ensureSkipLink();
    if (currentSettings?.enabled) {
      applyTextScale(currentSettings.fontScale);
      if (currentSettings.readingMode && (!readingTarget || !document.contains(readingTarget))) {
        applyReadingMode(true);
      }
    }
  }, 300);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'APPLY_SETTINGS') {
    applySettings(message.settings);
    sendResponse?.({ ok: true });
    return;
  }
  if (message.type === 'SCAN_PAGE') {
    sendResponse?.(scanPage());
    return;
  }
  if (message.type === 'HIGHLIGHT_ISSUE') {
    sendResponse?.(highlightIssue(message.selector));
  }
  return true;
});

function boot() {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS', hostname: window.location.hostname }, (response) => {
    if (chrome.runtime.lastError || !response?.settings) return;
    applySettings(response.settings);
    chrome.runtime.sendMessage({
      type: 'AUTO_APPLY_RULES',
      hostname: window.location.hostname
    }, () => {});
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
