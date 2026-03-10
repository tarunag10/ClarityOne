const els = {
  enabled: document.getElementById('enabled'),
  contrastMode: document.getElementById('contrastMode'),
  colorBlindMode: document.getElementById('colorBlindMode'),
  fontScale: document.getElementById('fontScale'),
  fontScaleValue: document.getElementById('fontScaleValue'),
  lineHeight: document.getElementById('lineHeight'),
  lineHeightValue: document.getElementById('lineHeightValue'),
  letterSpacing: document.getElementById('letterSpacing'),
  letterSpacingValue: document.getElementById('letterSpacingValue'),
  wordSpacing: document.getElementById('wordSpacing'),
  wordSpacingValue: document.getElementById('wordSpacingValue'),
  paragraphSpacing: document.getElementById('paragraphSpacing'),
  paragraphSpacingValue: document.getElementById('paragraphSpacingValue'),
  readableFont: document.getElementById('readableFont'),
  dyslexiaFont: document.getElementById('dyslexiaFont'),
  enhancedFocus: document.getElementById('enhancedFocus'),
  readingMode: document.getElementById('readingMode'),
  resetButton: document.getElementById('resetButton'),
  siteOverrideRow: document.getElementById('siteOverrideRow'),
  siteOverride: document.getElementById('siteOverride'),
  hostnameLabel: document.getElementById('hostnameLabel')
};

let currentHostname = null;
let globalSettings = null;
let siteOverrideActive = false;

function render(settings) {
  els.enabled.checked = settings.enabled;
  els.contrastMode.value = settings.contrastMode;
  els.colorBlindMode.value = settings.colorBlindMode || 'none';
  els.fontScale.value = settings.fontScale;
  els.fontScaleValue.textContent = `${settings.fontScale}x`;
  els.fontScale.setAttribute('aria-valuenow', settings.fontScale);
  els.lineHeight.value = settings.lineHeight;
  els.lineHeightValue.textContent = settings.lineHeight;
  els.lineHeight.setAttribute('aria-valuenow', settings.lineHeight);
  els.letterSpacing.value = settings.letterSpacing ?? 0.02;
  els.letterSpacingValue.textContent = `${Number(els.letterSpacing.value).toFixed(2)}em`;
  els.letterSpacing.setAttribute('aria-valuenow', els.letterSpacing.value);
  els.wordSpacing.value = settings.wordSpacing ?? 0.05;
  els.wordSpacingValue.textContent = `${Number(els.wordSpacing.value).toFixed(2)}em`;
  els.wordSpacing.setAttribute('aria-valuenow', els.wordSpacing.value);
  els.paragraphSpacing.value = settings.paragraphSpacing ?? 1.2;
  els.paragraphSpacingValue.textContent = `${Number(els.paragraphSpacing.value).toFixed(1)}em`;
  els.paragraphSpacing.setAttribute('aria-valuenow', els.paragraphSpacing.value);
  els.readableFont.checked = settings.readableFont;
  els.dyslexiaFont.checked = Boolean(settings.dyslexiaFont);
  els.enhancedFocus.checked = settings.enhancedFocus;
  els.readingMode.checked = Boolean(settings.readingMode);
}

function collectSettings() {
  return {
    enabled: els.enabled.checked,
    contrastMode: els.contrastMode.value,
    colorBlindMode: els.colorBlindMode.value,
    fontScale: Number(els.fontScale.value),
    lineHeight: Number(els.lineHeight.value),
    letterSpacing: Number(els.letterSpacing.value),
    wordSpacing: Number(els.wordSpacing.value),
    paragraphSpacing: Number(els.paragraphSpacing.value),
    readableFont: els.readableFont.checked,
    dyslexiaFont: els.dyslexiaFont.checked,
    enhancedFocus: els.enhancedFocus.checked,
    readingMode: els.readingMode.checked
  };
}

function collectOverrideKeys() {
  const current = collectSettings();
  const overrides = {};
  for (const key of ['enabled', 'contrastMode', 'colorBlindMode', 'fontScale', 'lineHeight', 'letterSpacing', 'wordSpacing', 'paragraphSpacing', 'readableFont', 'dyslexiaFont', 'enhancedFocus', 'readingMode']) {
    if (globalSettings && current[key] !== globalSettings[key]) {
      overrides[key] = current[key];
    }
  }
  return overrides;
}

function save(settings) {
  if (siteOverrideActive && currentHostname) {
    const overrides = collectOverrideKeys();
    chrome.runtime.sendMessage({ type: 'SAVE_SITE_SETTINGS', hostname: currentHostname, overrides }, () => {
      const merged = { ...globalSettings, ...overrides };
      chrome.runtime.sendMessage({ type: 'APPLY_TO_ACTIVE_TAB', settings: merged });
    });
  } else {
    const full = { ...settings, siteOverrides: globalSettings?.siteOverrides || {} };
    chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings: full }, () => {
      chrome.runtime.sendMessage({ type: 'APPLY_TO_ACTIVE_TAB', settings: full });
    });
  }
}

// Detect active tab hostname
chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (tab?.url) {
    try {
      currentHostname = new URL(tab.url).hostname;
      if (currentHostname) {
        els.hostnameLabel.textContent = currentHostname;
        els.siteOverrideRow.hidden = false;
      }
    } catch (_) { /* chrome:// or similar */ }
  }
});

chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
  if (!response?.settings) return;
  const settings = response.settings;
  globalSettings = { ...settings };
  // Check if site override exists
  if (currentHostname && settings.siteOverrides && settings.siteOverrides[currentHostname]) {
    siteOverrideActive = true;
    els.siteOverride.checked = true;
    const merged = { ...settings, ...settings.siteOverrides[currentHostname] };
    render(merged);
  } else {
    render(settings);
  }
});

els.siteOverride.addEventListener('change', () => {
  siteOverrideActive = els.siteOverride.checked;
  if (!siteOverrideActive && currentHostname) {
    chrome.runtime.sendMessage({ type: 'REMOVE_SITE_SETTINGS', hostname: currentHostname }, () => {
      if (globalSettings) {
        render(globalSettings);
        chrome.runtime.sendMessage({ type: 'APPLY_TO_ACTIVE_TAB', settings: globalSettings });
      }
    });
  }
});

['enabled', 'contrastMode', 'colorBlindMode', 'fontScale', 'lineHeight', 'letterSpacing', 'wordSpacing', 'paragraphSpacing', 'readableFont', 'dyslexiaFont', 'enhancedFocus', 'readingMode'].forEach((key) => {
  els[key].addEventListener('input', () => {
    const settings = collectSettings();
    render(settings);
    save(settings);
  });
});

els.resetButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'RESET_SETTINGS' }, (response) => {
    if (response?.settings) {
      globalSettings = { ...response.settings };
      siteOverrideActive = false;
      els.siteOverride.checked = false;
      render(response.settings);
      chrome.runtime.sendMessage({ type: 'APPLY_TO_ACTIVE_TAB', settings: response.settings });
    }
  });
});
