const ROOT_CLASS = 'clarityone-enabled';
const STYLE_ID = 'clarityone-inline-style';
const SKIP_LINK_ID = 'clarityone-skip-link';

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

function applySettings(settings) {
  const root = document.documentElement;
  const body = document.body;
  if (!body) return;

  if (!settings.enabled) {
    root.classList.remove(ROOT_CLASS);
    root.classList.remove('clarityone-contrast-light', 'clarityone-contrast-dark', 'clarityone-contrast-yellow');
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.textContent = '';
    return;
  }

  root.classList.add(ROOT_CLASS);
  root.classList.remove('clarityone-contrast-light', 'clarityone-contrast-dark', 'clarityone-contrast-yellow');
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

  ensureSkipLink();
}

let debounceTimer = null;
const observer = new MutationObserver(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    ensureSkipLink();
  }, 300);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'APPLY_SETTINGS') {
    applySettings(message.settings);
  }
});

function boot() {
  chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
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
