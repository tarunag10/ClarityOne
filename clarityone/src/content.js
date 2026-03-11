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
  const pushIssue = (type, message, el) => {
    issues.push({ type, message, selector: el ? toSelector(el) : '' });
  };

  // Images missing useful alt text
  const missingAlt = Array.from(document.querySelectorAll('img')).filter((img) => !img.hasAttribute('alt') || !img.getAttribute('alt').trim());
  for (const img of missingAlt.slice(0, 10)) {
    pushIssue('Image alt text', 'Image is missing alt text.', img);
  }

  // Heading structure checks
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const h1s = headings.filter((h) => h.tagName === 'H1');
  if (h1s.length === 0) {
    pushIssue('Heading structure', 'No H1 heading found on the page.', document.querySelector('main') || document.body);
  }
  let lastLevel = 0;
  for (const heading of headings) {
    const level = Number(heading.tagName.replace('H', ''));
    if (lastLevel > 0 && level - lastLevel > 1) {
      pushIssue('Heading structure', `Heading level jumps from H${lastLevel} to H${level}.`, heading);
    }
    lastLevel = level;
  }

  // Landmark presence checks
  const hasMain = Boolean(document.querySelector('main, [role="main"]'));
  const hasNav = Boolean(document.querySelector('nav, [role="navigation"]'));
  if (!hasMain) {
    pushIssue('Landmarks', 'No main landmark found.', document.body);
  }
  if (!hasNav) {
    pushIssue('Landmarks', 'No navigation landmark found.', document.body);
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
        pushIssue('Small text', `Text is ${size.toFixed(1)}px; consider >= 12px.`, el);
      }
    }
  }

  return {
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
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
