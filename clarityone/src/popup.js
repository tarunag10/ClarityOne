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
  presetSelect: document.getElementById('presetSelect'),
  applyPresetButton: document.getElementById('applyPresetButton'),
  savePresetButton: document.getElementById('savePresetButton'),
  deletePresetButton: document.getElementById('deletePresetButton'),
  rulePatternInput: document.getElementById('rulePatternInput'),
  rulePresetSelect: document.getElementById('rulePresetSelect'),
  addRuleButton: document.getElementById('addRuleButton'),
  rulesList: document.getElementById('rulesList'),
  scanButton: document.getElementById('scanButton'),
  exportJsonButton: document.getElementById('exportJsonButton'),
  exportCsvButton: document.getElementById('exportCsvButton'),
  scanSummary: document.getElementById('scanSummary'),
  scanResults: document.getElementById('scanResults'),
  resetButton: document.getElementById('resetButton'),
  siteOverrideRow: document.getElementById('siteOverrideRow'),
  siteOverride: document.getElementById('siteOverride'),
  hostnameLabel: document.getElementById('hostnameLabel')
};

let currentHostname = null;
let globalSettings = null;
let siteOverrideActive = false;
let presets = [];
let selectedPresetId = '';
let rules = [];
let lastScanReport = null;

const SETTINGS_KEYS = [
  'enabled',
  'contrastMode',
  'colorBlindMode',
  'fontScale',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'paragraphSpacing',
  'readableFont',
  'dyslexiaFont',
  'enhancedFocus',
  'readingMode'
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderScanReport(report) {
  lastScanReport = report || null;
  if (!report) {
    els.scanSummary.textContent = 'No scan data available.';
    els.scanResults.innerHTML = '';
    els.exportJsonButton.disabled = true;
    els.exportCsvButton.disabled = true;
    return;
  }
  const total = report.totalIssues || 0;
  els.exportJsonButton.disabled = total === 0;
  els.exportCsvButton.disabled = total === 0;
  if (total === 0) {
    els.scanSummary.textContent = 'No issues found in this quick scan.';
    els.scanResults.innerHTML = '';
    return;
  }
  const high = report.issues.filter((i) => i.severity === 'high').length;
  const medium = report.issues.filter((i) => i.severity === 'medium').length;
  const low = report.issues.filter((i) => i.severity === 'low').length;
  els.scanSummary.textContent = `${total} issue(s): ${high} high, ${medium} medium, ${low} low.`;
  els.scanResults.innerHTML = report.issues.map((issue) => `
    <article class="scan-item">
      <strong>[${escapeHtml((issue.severity || 'medium').toUpperCase())}] ${escapeHtml(issue.type)}</strong>
      <p>${escapeHtml(issue.message)}</p>
      ${issue.suggestion ? `<p><em>Fix:</em> ${escapeHtml(issue.suggestion)}</p>` : ''}
      ${issue.selector ? `<button type="button" data-selector="${escapeHtml(issue.selector)}">Highlight on page</button>` : ''}
    </article>
  `).join('');
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportReportJson() {
  if (!lastScanReport || !Array.isArray(lastScanReport.issues) || lastScanReport.issues.length === 0) return;
  const payload = {
    generatedAt: new Date().toISOString(),
    hostname: currentHostname || '',
    ...lastScanReport
  };
  downloadTextFile('clarityone-audit-report.json', JSON.stringify(payload, null, 2), 'application/json');
}

function exportReportCsv() {
  if (!lastScanReport || !Array.isArray(lastScanReport.issues) || lastScanReport.issues.length === 0) return;
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = [
    ['severity', 'type', 'message', 'suggestion', 'selector'],
    ...lastScanReport.issues.map((issue) => [
      issue.severity || 'medium',
      issue.type || '',
      issue.message || '',
      issue.suggestion || '',
      issue.selector || ''
    ])
  ];
  const csv = rows.map((row) => row.map(quote).join(',')).join('\n');
  downloadTextFile('clarityone-audit-report.csv', csv, 'text/csv');
}

function renderPresetOptions() {
  els.presetSelect.innerHTML = '';
  if (presets.length === 0) {
    els.presetSelect.innerHTML = '<option value="">No presets</option>';
    els.deletePresetButton.disabled = true;
    return;
  }
  for (const preset of presets) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.builtIn ? `${preset.name} (built-in)` : preset.name;
    els.presetSelect.appendChild(option);
  }
  if (!selectedPresetId || !presets.some((preset) => preset.id === selectedPresetId)) {
    selectedPresetId = presets[0].id;
  }
  els.presetSelect.value = selectedPresetId;
  const selected = presets.find((preset) => preset.id === selectedPresetId);
  els.deletePresetButton.disabled = !selected || Boolean(selected.builtIn);
}

function renderRulePresetOptions() {
  els.rulePresetSelect.innerHTML = '';
  for (const preset of presets) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.name;
    els.rulePresetSelect.appendChild(option);
  }
}

function renderRules() {
  if (rules.length === 0) {
    els.rulesList.innerHTML = '<p class="scan-summary">No auto-apply rules yet.</p>';
    return;
  }
  const presetNames = new Map(presets.map((preset) => [preset.id, preset.name]));
  els.rulesList.innerHTML = rules.map((rule) => `
    <article class="rule-item">
      <div class="rule-row">
        <strong>${escapeHtml(rule.pattern)}</strong>
        <label class="row">
          <span>Enabled</span>
          <input type="checkbox" data-rule-toggle="${escapeHtml(rule.id)}" ${rule.enabled ? 'checked' : ''} />
        </label>
      </div>
      <p>Preset: ${escapeHtml(presetNames.get(rule.presetId) || 'Unknown preset')}</p>
      <button type="button" data-rule-delete="${escapeHtml(rule.id)}">Delete rule</button>
    </article>
  `).join('');
}

function loadPresets() {
  chrome.runtime.sendMessage({ type: 'GET_PRESETS' }, (response) => {
    presets = Array.isArray(response?.presets) ? response.presets : [];
    renderPresetOptions();
    renderRulePresetOptions();
    renderRules();
  });
}

function loadRules() {
  chrome.runtime.sendMessage({ type: 'GET_RULES' }, (response) => {
    rules = Array.isArray(response?.rules) ? response.rules : [];
    renderRules();
  });
}

function normalizePresetSettings(settings) {
  const next = {};
  for (const key of SETTINGS_KEYS) {
    next[key] = settings[key];
  }
  return next;
}

function applySelectedPreset() {
  const selected = presets.find((preset) => preset.id === selectedPresetId);
  if (!selected || !selected.settings) return;
  const merged = { ...collectSettings(), ...normalizePresetSettings(selected.settings) };
  render(merged);
  save(merged);
}

function saveCurrentAsPreset() {
  const name = window.prompt('Preset name');
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const preset = {
    id: `preset-${Date.now()}`,
    name: trimmed,
    builtIn: false,
    settings: normalizePresetSettings(collectSettings())
  };
  chrome.runtime.sendMessage({ type: 'SAVE_PRESET', preset }, (response) => {
    presets = Array.isArray(response?.presets) ? response.presets : presets;
    selectedPresetId = preset.id;
    renderPresetOptions();
  });
}

function deleteSelectedPreset() {
  const selected = presets.find((preset) => preset.id === selectedPresetId);
  if (!selected || selected.builtIn) return;
  chrome.runtime.sendMessage({ type: 'DELETE_PRESET', id: selected.id }, (response) => {
    presets = Array.isArray(response?.presets) ? response.presets : presets;
    selectedPresetId = presets[0]?.id || '';
    renderPresetOptions();
    renderRulePresetOptions();
    renderRules();
  });
}

function addRule() {
  const pattern = els.rulePatternInput.value.trim().toLowerCase();
  const presetId = els.rulePresetSelect.value;
  if (!pattern || !presetId) return;
  const rule = {
    id: `rule-${Date.now()}`,
    pattern,
    presetId,
    enabled: true
  };
  chrome.runtime.sendMessage({ type: 'ADD_RULE', rule }, (response) => {
    rules = Array.isArray(response?.rules) ? response.rules : rules;
    els.rulePatternInput.value = '';
    renderRules();
  });
}

function toggleRule(id, enabled) {
  chrome.runtime.sendMessage({ type: 'TOGGLE_RULE', id, enabled }, (response) => {
    rules = Array.isArray(response?.rules) ? response.rules : rules;
    renderRules();
  });
}

function deleteRule(id) {
  chrome.runtime.sendMessage({ type: 'DELETE_RULE', id }, (response) => {
    rules = Array.isArray(response?.rules) ? response.rules : rules;
    renderRules();
  });
}

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
  for (const key of SETTINGS_KEYS) {
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

els.presetSelect.addEventListener('change', () => {
  selectedPresetId = els.presetSelect.value;
  const selected = presets.find((preset) => preset.id === selectedPresetId);
  els.deletePresetButton.disabled = !selected || Boolean(selected.builtIn);
});

els.applyPresetButton.addEventListener('click', () => {
  applySelectedPreset();
});

els.savePresetButton.addEventListener('click', () => {
  saveCurrentAsPreset();
});

els.deletePresetButton.addEventListener('click', () => {
  deleteSelectedPreset();
});

els.addRuleButton.addEventListener('click', () => {
  addRule();
});

els.rulesList.addEventListener('change', (event) => {
  const input = event.target.closest('input[data-rule-toggle]');
  if (!input) return;
  toggleRule(input.getAttribute('data-rule-toggle'), input.checked);
});

els.rulesList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-rule-delete]');
  if (!button) return;
  deleteRule(button.getAttribute('data-rule-delete'));
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

els.scanButton.addEventListener('click', () => {
  els.scanButton.disabled = true;
  els.exportJsonButton.disabled = true;
  els.exportCsvButton.disabled = true;
  els.scanSummary.textContent = 'Scanning...';
  els.scanResults.innerHTML = '';
  chrome.runtime.sendMessage({ type: 'SCAN_ACTIVE_TAB' }, (response) => {
    els.scanButton.disabled = false;
    if (!response?.ok) {
      els.scanSummary.textContent = 'Scan failed on this page.';
      return;
    }
    renderScanReport(response.report);
  });
});

els.scanResults.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-selector]');
  if (!button) return;
  const selector = button.getAttribute('data-selector');
  if (!selector) return;
  chrome.runtime.sendMessage({ type: 'HIGHLIGHT_ISSUE_ACTIVE_TAB', selector }, () => {});
});

els.exportJsonButton.addEventListener('click', () => {
  exportReportJson();
});

els.exportCsvButton.addEventListener('click', () => {
  exportReportCsv();
});

loadPresets();
loadRules();
els.exportJsonButton.disabled = true;
els.exportCsvButton.disabled = true;
