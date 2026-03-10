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

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'APPLY_SETTINGS') {
    applySettings(message.settings);
  }
});

function boot() {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS', hostname: window.location.hostname }, (response) => {
    if (chrome.runtime.lastError || !response?.settings) return;
    applySettings(response.settings);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
