const els = {
  enabled: document.getElementById('enabled'),
  contrastMode: document.getElementById('contrastMode'),
  fontScale: document.getElementById('fontScale'),
  fontScaleValue: document.getElementById('fontScaleValue'),
  lineHeight: document.getElementById('lineHeight'),
  lineHeightValue: document.getElementById('lineHeightValue'),
  readableFont: document.getElementById('readableFont'),
  enhancedFocus: document.getElementById('enhancedFocus'),
  resetButton: document.getElementById('resetButton')
};

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
    enhancedFocus: els.enhancedFocus.checked,
    siteOverrides: {}
  };
}

function save(settings) {
  chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', settings }, () => {
    chrome.runtime.sendMessage({ type: 'APPLY_TO_ACTIVE_TAB', settings });
  });
}

chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
  if (response?.settings) render(response.settings);
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
      render(response.settings);
      chrome.runtime.sendMessage({ type: 'APPLY_TO_ACTIVE_TAB', settings: response.settings });
    }
  });
});
