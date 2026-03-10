const ROOT_CLASS = 'clarityone-enabled';
const STYLE_ID = 'clarityone-inline-style';
const SKIP_LINK_ID = 'clarityone-skip-link';
const SCALED_ATTR = 'data-clarityone-base-font-size';
const TEXT_SELECTOR = [
  'p', 'span', 'a', 'li', 'dt', 'dd', 'label', 'button', 'input', 'textarea',
  'select', 'th', 'td', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'small', 'strong',
  'em', 'blockquote', 'figcaption', 'div'
].join(',');

let currentSettings = null;

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
    root.classList.remove(
      'clarityone-contrast-light',
      'clarityone-contrast-dark',
      'clarityone-contrast-yellow',
      'clarityone-contrast-invert'
    );
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
    'clarityone-contrast-invert'
  );
  root.classList.add(`clarityone-contrast-${settings.contrastMode}`);

  const styleEl = ensureInlineStyle();
  styleEl.textContent = `
    :root {
      --clarityone-font-scale: ${settings.fontScale};
      --clarityone-line-height: ${settings.lineHeight};
      --clarityone-font-family: ${settings.readableFont ? 'Arial, Helvetica, sans-serif' : 'inherit'};
      --clarityone-focus-outline: ${settings.enhancedFocus ? '3px solid #ff9900' : 'initial'};
    }
  `;

  applyTextScale(settings.fontScale);
  ensureSkipLink();
}

let debounceTimer = null;
const observer = new MutationObserver(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    ensureSkipLink();
    if (currentSettings?.enabled) {
      applyTextScale(currentSettings.fontScale);
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
