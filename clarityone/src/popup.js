const els = {
  enabled: document.getElementById('enabled'),
  contrastMode: document.getElementById('contrastMode'),
  fontScale: document.getElementById('fontScale'),
  fontScaleValue: document.getElementById('fontScaleValue'),
  lineHeight: document.getElementById('lineHeight'),
  lineHeightValue: document.getElementById('lineHeightValue'),
  readableFont: document.getElementById('readableFont'),
  enhancedFocus: document.getElementById('enhancedFocus'),
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
  els.fontScale.value = settings.fontScale;
  els.fontScaleValue.textContent = `${settings.fontScale}x`;
  els.fontScale.setAttribute('aria-valuenow', settings.fontScale);
  els.lineHeight.value = settings.lineHeight;
  els.lineHeightValue.textContent = settings.lineHeight;
  els.lineHeight.setAttribute('aria-valuenow', settings.lineHeight);
  els.readableFont.checked = settings.readableFont;
  els.enhancedFocus.checked = settings.enhancedFocus;
}

function collectSettings() {
  return {
    enabled: els.enabled.checked,
    contrastMode: els.contrastMode.value,
    fontScale: Number(els.fontScale.value),
    lineHeight: Number(els.lineHeight.value),
    readableFont: els.readableFont.checked,
    enhancedFocus: els.enhancedFocus.checked
  };
}

function collectOverrideKeys() {
  const current = collectSettings();
  const overrides = {};
  for (const key of ['enabled', 'contrastMode', 'fontScale', 'lineHeight', 'readableFont', 'enhancedFocus']) {
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

['enabled', 'contrastMode', 'fontScale', 'lineHeight', 'readableFont', 'enhancedFocus'].forEach((key) => {
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
