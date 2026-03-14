const els = {
  accessibilityTab: document.getElementById('accessibilityTab'),
  auditTab: document.getElementById('auditTab'),
  accessibilityPanel: document.getElementById('accessibilityPanel'),
  auditPanel: document.getElementById('auditPanel'),
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
let lastScanReport = null;
const TAB_IDS = ['accessibility', 'audit'];

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

function selectTab(tabId, moveFocus = false) {
  const isAudit = tabId === 'audit';
  els.accessibilityTab.setAttribute('aria-selected', String(!isAudit));
  els.auditTab.setAttribute('aria-selected', String(isAudit));
  els.accessibilityTab.tabIndex = isAudit ? -1 : 0;
  els.auditTab.tabIndex = isAudit ? 0 : -1;
  els.accessibilityPanel.hidden = isAudit;
  els.auditPanel.hidden = !isAudit;
  if (moveFocus) {
    (isAudit ? els.auditTab : els.accessibilityTab).focus();
  }
}

function moveTabFocus(currentId, direction) {
  const currentIndex = TAB_IDS.indexOf(currentId);
  const nextIndex = (currentIndex + direction + TAB_IDS.length) % TAB_IDS.length;
  selectTab(TAB_IDS[nextIndex], true);
}

function handleTabKeydown(currentId, event) {
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    moveTabFocus(currentId, 1);
    return;
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    moveTabFocus(currentId, -1);
    return;
  }
  if (event.key === 'Home') {
    event.preventDefault();
    selectTab('accessibility', true);
    return;
  }
  if (event.key === 'End') {
    event.preventDefault();
    selectTab('audit', true);
  }
}

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

els.accessibilityTab.addEventListener('click', () => {
  selectTab('accessibility');
});

els.auditTab.addEventListener('click', () => {
  selectTab('audit');
});

els.accessibilityTab.addEventListener('keydown', (event) => {
  handleTabKeydown('accessibility', event);
});

els.auditTab.addEventListener('keydown', (event) => {
  handleTabKeydown('audit', event);
});

selectTab('accessibility');
els.exportJsonButton.disabled = true;
els.exportCsvButton.disabled = true;
