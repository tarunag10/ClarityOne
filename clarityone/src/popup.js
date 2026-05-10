const els = {
  accessibilityTab: document.getElementById('accessibilityTab'),
  auditTab: document.getElementById('auditTab'),
  accessibilityPanel: document.getElementById('accessibilityPanel'),
  auditPanel: document.getElementById('auditPanel'),
  onboardingSection: document.getElementById('onboardingSection'),
  dismissOnboardingButton: document.getElementById('dismissOnboardingButton'),
  readingPickerButton: document.getElementById('readingPickerButton'),
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
  profileBadge: document.getElementById('profileBadge'),
  profileStatus: document.getElementById('profileStatus'),
  siteOverrideRow: document.getElementById('siteOverrideRow'),
  siteOverride: document.getElementById('siteOverride'),
  hostnameLabel: document.getElementById('hostnameLabel'),
  removeSiteOverrideButton: document.getElementById('removeSiteOverrideButton'),
  presetList: document.getElementById('presetList'),
  presetCountBadge: document.getElementById('presetCountBadge'),
  ruleCountBadge: document.getElementById('ruleCountBadge'),
  rulePattern: document.getElementById('rulePattern'),
  rulePreset: document.getElementById('rulePreset'),
  addRuleButton: document.getElementById('addRuleButton'),
  ruleList: document.getElementById('ruleList'),
  exportSettingsButton: document.getElementById('exportSettingsButton'),
  importSettingsButton: document.getElementById('importSettingsButton'),
  importSettingsInput: document.getElementById('importSettingsInput'),
  settingsStatus: document.getElementById('settingsStatus'),
  scanButton: document.getElementById('scanButton'),
  exportJsonButton: document.getElementById('exportJsonButton'),
  exportCsvButton: document.getElementById('exportCsvButton'),
  exportDeveloperReportButton: document.getElementById('exportDeveloperReportButton'),
  severityFilter: document.getElementById('severityFilter'),
  typeFilter: document.getElementById('typeFilter'),
  auditBadges: document.getElementById('auditBadges'),
  scanSummary: document.getElementById('scanSummary'),
  scanResults: document.getElementById('scanResults'),
  scanHistory: document.getElementById('scanHistory'),
  historyCountBadge: document.getElementById('historyCountBadge'),
  resetButton: document.getElementById('resetButton')
};

const DEFAULT_SETTINGS = {
  enabled: false,
  contrastMode: 'light',
  colorBlindMode: 'none',
  fontScale: 1.2,
  readableFont: true,
  dyslexiaFont: false,
  enhancedFocus: true,
  lineHeight: 1.7,
  letterSpacing: 0.02,
  wordSpacing: 0.05,
  paragraphSpacing: 1.2,
  readingMode: false,
  siteOverrides: {}
};

const FALLBACK_PRESETS = [
  {
    id: 'preset-reading',
    name: 'Reading',
    builtIn: true,
    settings: {
      enabled: true,
      readingMode: true,
      contrastMode: 'light',
      colorBlindMode: 'none',
      fontScale: 1.3,
      lineHeight: 2,
      letterSpacing: 0.03,
      wordSpacing: 0.1,
      paragraphSpacing: 1.6,
      readableFont: true,
      dyslexiaFont: false,
      enhancedFocus: true
    }
  },
  {
    id: 'preset-high-contrast',
    name: 'High Contrast',
    builtIn: true,
    settings: {
      enabled: true,
      readingMode: false,
      contrastMode: 'dark',
      colorBlindMode: 'none',
      fontScale: 1.2,
      lineHeight: 1.9,
      letterSpacing: 0.02,
      wordSpacing: 0.06,
      paragraphSpacing: 1.3,
      readableFont: true,
      dyslexiaFont: false,
      enhancedFocus: true
    }
  },
  {
    id: 'preset-dyslexia',
    name: 'Dyslexia',
    builtIn: true,
    settings: {
      enabled: true,
      readingMode: true,
      contrastMode: 'light',
      colorBlindMode: 'none',
      fontScale: 1.25,
      lineHeight: 2.1,
      letterSpacing: 0.06,
      wordSpacing: 0.16,
      paragraphSpacing: 1.9,
      readableFont: true,
      dyslexiaFont: true,
      enhancedFocus: true
    }
  },
  {
    id: 'preset-focus',
    name: 'Focus',
    builtIn: true,
    settings: {
      enabled: true,
      readingMode: false,
      contrastMode: 'yellow',
      colorBlindMode: 'none',
      fontScale: 1.2,
      lineHeight: 1.8,
      letterSpacing: 0.02,
      wordSpacing: 0.06,
      paragraphSpacing: 1.2,
      readableFont: true,
      dyslexiaFont: false,
      enhancedFocus: true
    }
  }
];

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
const TAB_IDS = ['accessibility', 'audit'];
const AUDIT_HISTORY_KEY = 'clarityScanHistory';
const FIRST_RUN_KEY = 'clarityPopupOnboardingDismissed';

let currentHostname = null;
let currentTabId = null;
let globalSettings = { ...DEFAULT_SETTINGS };
let currentEffectiveSettings = { ...DEFAULT_SETTINGS };
let siteOverrideActive = false;
let presets = FALLBACK_PRESETS;
let rules = [];
let activeRule = null;
let lastScanReport = null;
let auditHistory = {};

function safeSendMessage(message) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(response || null);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

function storageGet(keys) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          resolve({});
          return;
        }
        resolve(result || {});
      });
    } catch (_) {
      resolve({});
    }
  });
}

function storageSet(payload) {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.set(payload, () => {
        resolve(!chrome.runtime.lastError);
      });
    } catch (_) {
      resolve(false);
    }
  });
}

function tabsQuery(queryInfo) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query(queryInfo, (tabs) => {
        if (chrome.runtime.lastError) {
          resolve([]);
          return;
        }
        resolve(tabs || []);
      });
    } catch (_) {
      resolve([]);
    }
  });
}

function tabsSendMessage(tabId, message) {
  return new Promise((resolve) => {
    if (!tabId) {
      resolve(null);
      return;
    }
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(response || null);
      });
    } catch (_) {
      resolve(null);
    }
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

function makeSlug(value) {
  return String(value || 'page')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'page';
}

function hostnameMatchesPattern(hostname, pattern) {
  if (!hostname || !pattern) return false;
  const normalized = pattern.trim().toLowerCase();
  if (!normalized) return false;
  const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(hostname.toLowerCase());
}

function normalizeSettings(input) {
  if (!input || typeof input !== 'object') return null;
  const next = { ...DEFAULT_SETTINGS, ...input };
  next.enabled = Boolean(next.enabled);
  next.contrastMode = String(next.contrastMode || DEFAULT_SETTINGS.contrastMode);
  next.colorBlindMode = String(next.colorBlindMode || DEFAULT_SETTINGS.colorBlindMode);
  next.fontScale = Number.isFinite(Number(next.fontScale)) ? Number(next.fontScale) : DEFAULT_SETTINGS.fontScale;
  next.lineHeight = Number.isFinite(Number(next.lineHeight)) ? Number(next.lineHeight) : DEFAULT_SETTINGS.lineHeight;
  next.letterSpacing = Number.isFinite(Number(next.letterSpacing)) ? Number(next.letterSpacing) : DEFAULT_SETTINGS.letterSpacing;
  next.wordSpacing = Number.isFinite(Number(next.wordSpacing)) ? Number(next.wordSpacing) : DEFAULT_SETTINGS.wordSpacing;
  next.paragraphSpacing = Number.isFinite(Number(next.paragraphSpacing)) ? Number(next.paragraphSpacing) : DEFAULT_SETTINGS.paragraphSpacing;
  next.readableFont = Boolean(next.readableFont);
  next.dyslexiaFont = Boolean(next.dyslexiaFont);
  next.enhancedFocus = Boolean(next.enhancedFocus);
  next.readingMode = Boolean(next.readingMode);
  next.siteOverrides = next.siteOverrides && typeof next.siteOverrides === 'object' ? next.siteOverrides : {};
  return next;
}

function effectiveSettingsFrom(global) {
  const settings = normalizeSettings(global) || { ...DEFAULT_SETTINGS };
  if (currentHostname && settings.siteOverrides && settings.siteOverrides[currentHostname]) {
    return { ...settings, ...settings.siteOverrides[currentHostname], siteOverrides: settings.siteOverrides };
  }
  if (currentHostname && Array.isArray(rules) && Array.isArray(presets)) {
    const matchedRule = rules.find((rule) => rule.enabled && hostnameMatchesPattern(currentHostname, rule.pattern));
    const matchedPreset = matchedRule ? presets.find((preset) => preset.id === matchedRule.presetId) : null;
    if (matchedPreset?.settings) {
      return { ...settings, ...matchedPreset.settings, siteOverrides: settings.siteOverrides };
    }
  }
  return settings;
}

function getPresetDescription(preset) {
  const settings = preset.settings || {};
  const parts = [];
  if (settings.readingMode) parts.push('reading');
  if (settings.dyslexiaFont) parts.push('dyslexia');
  if (settings.contrastMode && settings.contrastMode !== 'light') parts.push(settings.contrastMode);
  if (settings.enhancedFocus) parts.push('focus');
  return parts.length ? parts.join(', ') : 'custom settings';
}

function getIssueSeverity(issue) {
  return String(issue?.severity || 'medium').toLowerCase();
}

function getIssueType(issue) {
  return String(issue?.type || 'general');
}

function getIssueSummary(issue, index) {
  const severity = getIssueSeverity(issue).toUpperCase();
  const type = getIssueType(issue);
  const selector = issue?.selector ? ` Selector: ${issue.selector}` : '';
  const suggestion = issue?.suggestion ? ` Fix: ${issue.suggestion}` : '';
  return `${index + 1}. [${severity}] ${type}: ${issue?.message || 'Accessibility issue.'}${selector}${suggestion}`;
}

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

function render(settings) {
  const next = normalizeSettings(settings) || { ...DEFAULT_SETTINGS };
  currentEffectiveSettings = next;
  els.enabled.checked = next.enabled;
  els.contrastMode.value = next.contrastMode;
  els.colorBlindMode.value = next.colorBlindMode || 'none';
  els.fontScale.value = next.fontScale;
  els.fontScaleValue.textContent = `${next.fontScale}x`;
  els.fontScale.setAttribute('aria-valuenow', next.fontScale);
  els.lineHeight.value = next.lineHeight;
  els.lineHeightValue.textContent = String(next.lineHeight);
  els.lineHeight.setAttribute('aria-valuenow', next.lineHeight);
  els.letterSpacing.value = next.letterSpacing;
  els.letterSpacingValue.textContent = `${Number(next.letterSpacing).toFixed(2)}em`;
  els.letterSpacing.setAttribute('aria-valuenow', next.letterSpacing);
  els.wordSpacing.value = next.wordSpacing;
  els.wordSpacingValue.textContent = `${Number(next.wordSpacing).toFixed(2)}em`;
  els.wordSpacing.setAttribute('aria-valuenow', next.wordSpacing);
  els.paragraphSpacing.value = next.paragraphSpacing;
  els.paragraphSpacingValue.textContent = `${Number(next.paragraphSpacing).toFixed(1)}em`;
  els.paragraphSpacing.setAttribute('aria-valuenow', next.paragraphSpacing);
  els.readableFont.checked = next.readableFont;
  els.dyslexiaFont.checked = next.dyslexiaFont;
  els.enhancedFocus.checked = next.enhancedFocus;
  els.readingMode.checked = next.readingMode;
}

function collectSettings() {
  return normalizeSettings({
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
    readingMode: els.readingMode.checked,
    siteOverrides: globalSettings?.siteOverrides || {}
  });
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

async function applyToActiveTab(settings) {
  await safeSendMessage({ type: 'APPLY_TO_ACTIVE_TAB', settings });
}

async function saveGlobalSettings(settings) {
  const full = normalizeSettings({ ...settings, siteOverrides: settings.siteOverrides || globalSettings?.siteOverrides || {} });
  if (!full) return false;
  const response = await safeSendMessage({ type: 'SAVE_SETTINGS', settings: full });
  if (response?.ok === false) return false;
  globalSettings = { ...full };
  currentEffectiveSettings = effectiveSettingsFrom(globalSettings);
  await applyToActiveTab(currentEffectiveSettings);
  render(currentEffectiveSettings);
  renderProfileStatus();
  return true;
}

async function save(settings) {
  const normalized = normalizeSettings(settings);
  if (!normalized) return;
  if (siteOverrideActive && currentHostname) {
    const overrides = collectOverrideKeys();
    const response = await safeSendMessage({ type: 'SAVE_SITE_SETTINGS', hostname: currentHostname, overrides });
    if (response?.ok === false) return;
    globalSettings = {
      ...globalSettings,
      siteOverrides: {
        ...(globalSettings?.siteOverrides || {}),
        [currentHostname]: overrides
      }
    };
    const merged = effectiveSettingsFrom(globalSettings);
    currentEffectiveSettings = merged;
    await applyToActiveTab(merged);
    renderProfileStatus();
    return;
  }
  await saveGlobalSettings(normalized);
}

function renderPresets() {
  const list = Array.isArray(presets) && presets.length ? presets : FALLBACK_PRESETS;
  els.presetCountBadge.textContent = String(list.length);
  els.presetList.innerHTML = list.map((preset) => `
    <button class="preset-card" type="button" data-preset-id="${escapeHtml(preset.id)}" aria-label="Apply ${escapeHtml(preset.name)} preset">
      <strong>${escapeHtml(preset.name)}</strong>
      <span>${preset.builtIn ? 'Built-in' : 'Custom'}: ${escapeHtml(getPresetDescription(preset))}</span>
    </button>
  `).join('');
  els.rulePreset.innerHTML = list.map((preset) => (
    `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`
  )).join('');
}

function renderRulesManager() {
  const list = Array.isArray(rules) ? rules : [];
  els.ruleCountBadge.textContent = String(list.length);
  if (!list.length) {
    els.ruleList.innerHTML = '<p class="muted">No auto rules yet.</p>';
    return;
  }
  els.ruleList.innerHTML = list.map((rule) => {
    const preset = presets.find((item) => item.id === rule.presetId);
    return `
      <article class="rule-item">
        <div>
          <strong>${escapeHtml(rule.pattern || 'Unnamed rule')}</strong>
          <p class="muted">${escapeHtml(preset?.name || rule.presetId || 'Unknown preset')}</p>
        </div>
        <label class="row compact-label">
          <span>${rule.enabled ? 'On' : 'Off'}</span>
          <input type="checkbox" data-rule-action="toggle" data-rule-id="${escapeHtml(rule.id)}" ${rule.enabled ? 'checked' : ''} aria-label="Toggle rule for ${escapeHtml(rule.pattern || 'site')}" />
        </label>
        <button class="secondary" type="button" data-rule-action="delete" data-rule-id="${escapeHtml(rule.id)}">Delete</button>
      </article>
    `;
  }).join('');
}

function renderProfileStatus() {
  const hasOverride = Boolean(currentHostname && globalSettings?.siteOverrides?.[currentHostname]);
  activeRule = currentHostname ? rules.find((rule) => rule.enabled && hostnameMatchesPattern(currentHostname, rule.pattern)) || null : null;
  els.removeSiteOverrideButton.disabled = !hasOverride;
  els.siteOverride.checked = siteOverrideActive;

  if (!currentHostname) {
    els.profileBadge.className = 'badge neutral';
    els.profileBadge.textContent = 'Global';
    els.profileStatus.textContent = 'This browser page does not expose a site profile.';
    return;
  }

  if (hasOverride) {
    els.profileBadge.className = 'badge custom';
    els.profileBadge.textContent = 'Custom';
    els.profileStatus.textContent = `Using a custom override for ${currentHostname}.`;
    return;
  }

  if (activeRule) {
    els.profileBadge.className = 'badge rule';
    els.profileBadge.textContent = 'Auto rule';
    els.profileStatus.textContent = `Matched ${activeRule.pattern || 'rule'}${activeRule.presetId ? ` -> ${activeRule.presetId}` : ''}.`;
    return;
  }

  els.profileBadge.className = 'badge neutral';
  els.profileBadge.textContent = 'Global';
  els.profileStatus.textContent = `Using global settings for ${currentHostname}.`;
}

function renderAuditBadges(issues) {
  const high = issues.filter((issue) => getIssueSeverity(issue) === 'high').length;
  const medium = issues.filter((issue) => getIssueSeverity(issue) === 'medium').length;
  const low = issues.filter((issue) => getIssueSeverity(issue) === 'low').length;
  els.auditBadges.innerHTML = `
    <span>Total ${issues.length}</span>
    <span>High ${high}</span>
    <span>Medium ${medium}</span>
    <span>Low ${low}</span>
  `;
}

function updateTypeFilter(issues) {
  const currentValue = els.typeFilter.value || 'all';
  const types = [...new Set(issues.map(getIssueType))].sort((a, b) => a.localeCompare(b));
  els.typeFilter.innerHTML = '<option value="all">All types</option>' + types.map((type) => (
    `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`
  )).join('');
  els.typeFilter.value = types.includes(currentValue) ? currentValue : 'all';
}

function getFilteredIssues() {
  const issues = Array.isArray(lastScanReport?.issues) ? lastScanReport.issues : [];
  const severity = els.severityFilter.value;
  const type = els.typeFilter.value;
  return issues.filter((issue) => {
    const matchesSeverity = severity === 'all' || getIssueSeverity(issue) === severity;
    const matchesType = type === 'all' || getIssueType(issue) === type;
    return matchesSeverity && matchesType;
  });
}

function renderScanReport(report, refreshTypes = true) {
  lastScanReport = report || null;
  const issues = Array.isArray(report?.issues) ? report.issues : [];
  const total = Number(report?.totalIssues ?? issues.length);
  els.exportJsonButton.disabled = total === 0;
  els.exportCsvButton.disabled = total === 0;
  els.exportDeveloperReportButton.disabled = total === 0;

  if (!report) {
    els.scanSummary.textContent = 'No scan data available.';
    els.scanResults.innerHTML = '';
    renderAuditBadges([]);
    return;
  }

  renderAuditBadges(issues);
  if (refreshTypes) updateTypeFilter(issues);

  if (total === 0) {
    els.scanSummary.textContent = 'No issues found in this quick scan.';
    els.scanResults.innerHTML = '';
    return;
  }

  const filtered = getFilteredIssues();
  els.scanSummary.textContent = `${filtered.length} of ${total} issue(s) shown for ${currentHostname || 'this page'}.`;
  els.scanResults.innerHTML = filtered.map((issue, index) => {
    const severity = getIssueSeverity(issue);
    const originalIndex = issues.indexOf(issue);
    const selector = issue.selector || '';
    return `
      <article class="scan-item severity-${escapeHtml(severity)}">
        <header>
          <strong>[${escapeHtml(severity.toUpperCase())}] ${escapeHtml(getIssueType(issue))}</strong>
          <span class="badge">${escapeHtml(String(originalIndex + 1 || index + 1))}</span>
        </header>
        <p>${escapeHtml(issue.message || 'Accessibility issue found.')}</p>
        ${issue.suggestion ? `<p><strong>Fix:</strong> ${escapeHtml(issue.suggestion)}</p>` : ''}
        ${selector ? `<code>${escapeHtml(selector)}</code>` : ''}
        <div class="issue-actions">
          <button type="button" data-action="copy-summary" data-index="${originalIndex}">Copy summary</button>
          <button type="button" data-action="copy-selector" data-index="${originalIndex}" ${selector ? '' : 'disabled'}>Copy selector</button>
          <button type="button" data-action="highlight" data-index="${originalIndex}" ${selector ? '' : 'disabled'}>Highlight</button>
        </div>
      </article>
    `;
  }).join('');
}

function exportReportJson() {
  if (!lastScanReport || !Array.isArray(lastScanReport.issues) || lastScanReport.issues.length === 0) return;
  const payload = {
    generatedAt: new Date().toISOString(),
    hostname: currentHostname || '',
    ...lastScanReport
  };
  downloadTextFile(`clarityone-audit-${makeSlug(currentHostname)}.json`, JSON.stringify(payload, null, 2), 'application/json');
}

function exportReportCsv() {
  if (!lastScanReport || !Array.isArray(lastScanReport.issues) || lastScanReport.issues.length === 0) return;
  const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = [
    ['severity', 'type', 'message', 'suggestion', 'selector'],
    ...lastScanReport.issues.map((issue) => [
      getIssueSeverity(issue),
      getIssueType(issue),
      issue.message || '',
      issue.suggestion || '',
      issue.selector || ''
    ])
  ];
  const csv = rows.map((row) => row.map(quote).join(',')).join('\n');
  downloadTextFile(`clarityone-audit-${makeSlug(currentHostname)}.csv`, csv, 'text/csv');
}

function exportDeveloperReport() {
  if (!lastScanReport || !Array.isArray(lastScanReport.issues) || lastScanReport.issues.length === 0) return;
  const lines = [
    '# ClarityOne Accessibility Developer Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Hostname: ${currentHostname || 'unknown'}`,
    `Total issues: ${lastScanReport.issues.length}`,
    '',
    ...lastScanReport.issues.flatMap((issue, index) => [
      `## ${index + 1}. ${getIssueSeverity(issue).toUpperCase()} ${getIssueType(issue)}`,
      '',
      issue.message || 'Accessibility issue found.',
      issue.selector ? `Selector: \`${issue.selector}\`` : 'Selector: not available',
      issue.suggestion ? `Suggested fix: ${issue.suggestion}` : 'Suggested fix: review manually.',
      ''
    ])
  ];
  downloadTextFile(`clarityone-developer-report-${makeSlug(currentHostname)}.md`, lines.join('\n'), 'text/markdown');
}

async function copyText(text, statusElement = els.scanSummary) {
  try {
    await navigator.clipboard.writeText(text);
    statusElement.textContent = 'Copied to clipboard.';
  } catch (_) {
    statusElement.textContent = 'Copy failed. Browser clipboard permission is unavailable.';
  }
}

function historyForCurrentHost() {
  if (!currentHostname) return [];
  return Array.isArray(auditHistory[currentHostname]) ? auditHistory[currentHostname] : [];
}

function getHistoryTime(entry) {
  return entry?.scannedAt || entry?.timestamp || '';
}

function getHistoryTotal(entry) {
  if (Number.isFinite(entry?.totalIssues)) return entry.totalIssues;
  if (Number.isFinite(entry?.issueCounts?.total)) return entry.issueCounts.total;
  if (Array.isArray(entry?.issues)) return entry.issues.length;
  if (Array.isArray(entry?.report?.issues)) return entry.report.issues.length;
  return 0;
}

function getHistorySummary(entry) {
  if (entry?.summary) return entry.summary;
  const counts = entry?.issueCounts;
  if (counts) {
    return `${counts.high || 0} high, ${counts.medium || 0} medium, ${counts.low || 0} low`;
  }
  return 'Scan completed.';
}

function getHistoryReport(entry) {
  if (entry?.report) return entry.report;
  return {
    totalIssues: getHistoryTotal(entry),
    issues: Array.isArray(entry?.issues) ? entry.issues : [],
    hostname: entry?.hostname || currentHostname || '',
    url: entry?.url || '',
    title: entry?.title || '',
    score: entry?.score
  };
}

function renderHistory() {
  const hostHistory = historyForCurrentHost();
  els.historyCountBadge.textContent = String(hostHistory.length);
  if (!currentHostname) {
    els.scanHistory.innerHTML = '<p class="muted">History is available on normal web pages.</p>';
    return;
  }
  if (!hostHistory.length) {
    els.scanHistory.innerHTML = '<p class="muted">No scans recorded for this hostname yet.</p>';
    return;
  }
  els.scanHistory.innerHTML = hostHistory.slice(0, 8).map((entry, index) => `
    <article class="history-item">
      <header>
        <strong>${escapeHtml(getHistoryTime(entry) ? new Date(getHistoryTime(entry)).toLocaleString() : 'Recent scan')}</strong>
        <span class="badge">${escapeHtml(String(getHistoryTotal(entry)))} issues</span>
      </header>
      <p>${escapeHtml(getHistorySummary(entry))}</p>
      <button type="button" data-history-index="${index}">Open report</button>
    </article>
  `).join('');
}

async function loadAuditHistory() {
  const response = await safeSendMessage({ type: 'GET_SCAN_HISTORY', hostname: currentHostname });
  if (response?.history && typeof response.history === 'object') {
    auditHistory = response.history;
    renderHistory();
    return;
  }
  if (Array.isArray(response?.records) && currentHostname) {
    auditHistory = { ...auditHistory, [currentHostname]: response.records };
    renderHistory();
    return;
  }
  const stored = await storageGet(AUDIT_HISTORY_KEY);
  auditHistory = stored[AUDIT_HISTORY_KEY] && typeof stored[AUDIT_HISTORY_KEY] === 'object' ? stored[AUDIT_HISTORY_KEY] : {};
  renderHistory();
}

async function saveScanHistory(report, backgroundEntry = null) {
  if (!currentHostname || !report) return;
  if (backgroundEntry) {
    await loadAuditHistory();
    return;
  }
  const issues = Array.isArray(report.issues) ? report.issues : [];
  const high = issues.filter((issue) => getIssueSeverity(issue) === 'high').length;
  const medium = issues.filter((issue) => getIssueSeverity(issue) === 'medium').length;
  const low = issues.filter((issue) => getIssueSeverity(issue) === 'low').length;
  const entry = {
    scannedAt: new Date().toISOString(),
    hostname: currentHostname,
    totalIssues: Number(report.totalIssues ?? issues.length),
    summary: `${high} high, ${medium} medium, ${low} low`,
    report
  };
  const existing = historyForCurrentHost();
  auditHistory = {
    ...auditHistory,
    [currentHostname]: [entry, ...existing].slice(0, 20)
  };
  await storageSet({ [AUDIT_HISTORY_KEY]: auditHistory });
  renderHistory();
}

async function loadPresets() {
  const response = await safeSendMessage({ type: 'GET_PRESETS' });
  presets = Array.isArray(response?.presets) && response.presets.length ? response.presets : FALLBACK_PRESETS;
  renderPresets();
  renderRulesManager();
}

async function loadRules() {
  const response = await safeSendMessage({ type: 'GET_RULES' });
  rules = Array.isArray(response?.rules) ? response.rules : [];
  if (!siteOverrideActive) {
    currentEffectiveSettings = effectiveSettingsFrom(globalSettings);
    render(currentEffectiveSettings);
  }
  renderProfileStatus();
  renderRulesManager();
}

async function loadSettings() {
  const response = await safeSendMessage({ type: 'GET_SETTINGS' });
  if (!response?.settings) {
    render(DEFAULT_SETTINGS);
    renderProfileStatus();
    return;
  }
  globalSettings = normalizeSettings(response.settings) || { ...DEFAULT_SETTINGS };
  siteOverrideActive = Boolean(currentHostname && globalSettings.siteOverrides?.[currentHostname]);
  currentEffectiveSettings = effectiveSettingsFrom(globalSettings);
  render(currentEffectiveSettings);
  renderProfileStatus();
}

async function detectActiveTab() {
  const [tab] = await tabsQuery({ active: true, currentWindow: true });
  currentTabId = tab?.id || null;
  if (tab?.url) {
    try {
      currentHostname = new URL(tab.url).hostname;
      if (currentHostname) {
        els.hostnameLabel.textContent = currentHostname;
        els.siteOverrideRow.hidden = false;
      }
    } catch (_) {
      currentHostname = null;
    }
  }
}

async function removeCurrentSiteOverride() {
  if (!currentHostname) return;
  await safeSendMessage({ type: 'REMOVE_SITE_SETTINGS', hostname: currentHostname });
  if (globalSettings?.siteOverrides) {
    const nextOverrides = { ...globalSettings.siteOverrides };
    delete nextOverrides[currentHostname];
    globalSettings = { ...globalSettings, siteOverrides: nextOverrides };
  }
  siteOverrideActive = false;
  currentEffectiveSettings = effectiveSettingsFrom(globalSettings);
  render(currentEffectiveSettings);
  renderProfileStatus();
  await applyToActiveTab(currentEffectiveSettings);
}

async function applyPreset(presetId) {
  const preset = presets.find((item) => item.id === presetId);
  if (!preset?.settings) return;
  const siteOverrides = { ...(globalSettings?.siteOverrides || {}) };
  const merged = normalizeSettings({
    ...currentEffectiveSettings,
    ...preset.settings,
    siteOverrides
  });
  if (!merged) return;
  if (siteOverrideActive && currentHostname) {
    const overrides = SETTINGS_KEYS.reduce((nextOverrides, key) => {
      if (merged[key] !== globalSettings[key]) nextOverrides[key] = merged[key];
      return nextOverrides;
    }, {});
    const response = await safeSendMessage({ type: 'SAVE_SITE_SETTINGS', hostname: currentHostname, overrides });
    if (response?.ok === false) {
      els.settingsStatus.textContent = 'Preset could not be saved for this site.';
      return;
    }
    siteOverrides[currentHostname] = overrides;
    globalSettings = { ...globalSettings, siteOverrides };
    currentEffectiveSettings = { ...globalSettings, ...overrides, siteOverrides };
    render(currentEffectiveSettings);
    renderProfileStatus();
    await applyToActiveTab(currentEffectiveSettings);
    els.settingsStatus.textContent = `${preset.name} preset applied to ${currentHostname}.`;
    return;
  }
  const ok = await saveGlobalSettings({ ...globalSettings, ...merged, siteOverrides });
  els.settingsStatus.textContent = ok ? `${preset.name} preset applied.` : 'Preset could not be saved.';
}

function getStorageCompatibleExport() {
  return {
    exportedAt: new Date().toISOString(),
    claritySettings: normalizeSettings(globalSettings) || DEFAULT_SETTINGS,
    clarityPresets: presets,
    clarityRules: rules
  };
}

function extractImportedSettings(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.claritySettings) return normalizeSettings(parsed.claritySettings);
  if (parsed.settings) return normalizeSettings(parsed.settings);
  if (SETTINGS_KEYS.some((key) => Object.prototype.hasOwnProperty.call(parsed, key))) {
    return normalizeSettings(parsed);
  }
  return null;
}

async function importSettingsFile(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const importedSettings = extractImportedSettings(parsed);
    if (!importedSettings) {
      els.settingsStatus.textContent = 'Import failed: no ClarityOne settings found.';
      return;
    }
    const ok = await saveGlobalSettings(importedSettings);
    if (Array.isArray(parsed.clarityPresets)) {
      await Promise.all(parsed.clarityPresets.map((preset) => safeSendMessage({ type: 'SAVE_PRESET', preset })));
      await loadPresets();
    }
    if (Array.isArray(parsed.clarityRules)) {
      const existingIds = new Set(rules.map((rule) => rule.id));
      const newRules = parsed.clarityRules.filter((rule) => rule?.id && !existingIds.has(rule.id));
      await Promise.all(newRules.map((rule) => safeSendMessage({ type: 'ADD_RULE', rule })));
      await loadRules();
    }
    els.settingsStatus.textContent = ok ? 'Settings imported.' : 'Settings import could not be saved.';
  } catch (_) {
    els.settingsStatus.textContent = 'Import failed: JSON could not be read.';
  } finally {
    els.importSettingsInput.value = '';
  }
}

async function renderOnboarding() {
  const stored = await storageGet(FIRST_RUN_KEY);
  els.onboardingSection.hidden = Boolean(stored[FIRST_RUN_KEY]);
}

function wireEvents() {
  els.siteOverride.addEventListener('change', async () => {
    siteOverrideActive = els.siteOverride.checked;
    if (!siteOverrideActive) {
      await removeCurrentSiteOverride();
      return;
    }
    renderProfileStatus();
    await save(collectSettings());
  });

  els.removeSiteOverrideButton.addEventListener('click', removeCurrentSiteOverride);

  SETTINGS_KEYS.forEach((key) => {
    els[key].addEventListener('input', () => {
      const settings = collectSettings();
      render(settings);
      save(settings);
    });
  });

  els.resetButton.addEventListener('click', async () => {
    const response = await safeSendMessage({ type: 'RESET_SETTINGS' });
    if (response?.settings) {
      globalSettings = normalizeSettings(response.settings) || { ...DEFAULT_SETTINGS };
      siteOverrideActive = false;
      currentEffectiveSettings = globalSettings;
      render(globalSettings);
      renderProfileStatus();
      await applyToActiveTab(globalSettings);
    }
  });

  els.presetList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-preset-id]');
    if (!button) return;
    applyPreset(button.getAttribute('data-preset-id'));
  });

  els.addRuleButton.addEventListener('click', async () => {
    const pattern = els.rulePattern.value.trim();
    const presetId = els.rulePreset.value;
    if (!pattern || !presetId) {
      els.settingsStatus.textContent = 'Add a site pattern and preset first.';
      return;
    }
    const rule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pattern,
      presetId,
      enabled: true
    };
    const response = await safeSendMessage({ type: 'ADD_RULE', rule });
    if (Array.isArray(response?.rules)) {
      rules = response.rules;
      els.rulePattern.value = '';
      renderRulesManager();
      renderProfileStatus();
      els.settingsStatus.textContent = `Auto rule added for ${pattern}.`;
    } else {
      els.settingsStatus.textContent = 'Auto rule could not be saved.';
    }
  });

  els.ruleList.addEventListener('click', async (event) => {
    const target = event.target.closest('[data-rule-action]');
    if (!target) return;
    const id = target.getAttribute('data-rule-id');
    const action = target.getAttribute('data-rule-action');
    if (action === 'delete') {
      const response = await safeSendMessage({ type: 'DELETE_RULE', id });
      if (Array.isArray(response?.rules)) {
        rules = response.rules;
        renderRulesManager();
        renderProfileStatus();
      }
    }
  });

  els.ruleList.addEventListener('change', async (event) => {
    const target = event.target.closest('[data-rule-action="toggle"]');
    if (!target) return;
    const response = await safeSendMessage({
      type: 'TOGGLE_RULE',
      id: target.getAttribute('data-rule-id'),
      enabled: target.checked
    });
    if (Array.isArray(response?.rules)) {
      rules = response.rules;
      renderRulesManager();
      renderProfileStatus();
    }
  });

  els.exportSettingsButton.addEventListener('click', () => {
    downloadTextFile('clarityone-settings.json', JSON.stringify(getStorageCompatibleExport(), null, 2), 'application/json');
    els.settingsStatus.textContent = 'Settings exported.';
  });

  els.importSettingsButton.addEventListener('click', () => {
    els.importSettingsInput.click();
  });

  els.importSettingsInput.addEventListener('change', () => {
    importSettingsFile(els.importSettingsInput.files?.[0]);
  });

  els.readingPickerButton.addEventListener('click', async () => {
    const response = await tabsSendMessage(currentTabId, { type: 'START_READING_PICKER' });
    if (!response) {
      await safeSendMessage({ type: 'START_READING_PICKER' });
    }
    els.settingsStatus.textContent = 'Reading target picker requested for this page.';
  });

  els.dismissOnboardingButton.addEventListener('click', async () => {
    await storageSet({ [FIRST_RUN_KEY]: true });
    els.onboardingSection.hidden = true;
  });

  els.scanButton.addEventListener('click', async () => {
    els.scanButton.disabled = true;
    els.exportJsonButton.disabled = true;
    els.exportCsvButton.disabled = true;
    els.exportDeveloperReportButton.disabled = true;
    els.scanSummary.textContent = 'Scanning...';
    els.scanResults.innerHTML = '';
    const response = await safeSendMessage({ type: 'SCAN_ACTIVE_TAB' });
    els.scanButton.disabled = false;
    if (!response?.ok) {
      els.scanSummary.textContent = 'Scan failed on this page.';
      return;
    }
    els.severityFilter.value = 'all';
    renderScanReport(response.report);
    await saveScanHistory(response.report, response.historyEntry);
  });

  els.severityFilter.addEventListener('change', () => renderScanReport(lastScanReport, false));
  els.typeFilter.addEventListener('change', () => renderScanReport(lastScanReport, false));

  els.scanResults.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button || !lastScanReport?.issues) return;
    const issue = lastScanReport.issues[Number(button.getAttribute('data-index'))];
    if (!issue) return;
    const action = button.getAttribute('data-action');
    if (action === 'copy-summary') {
      await copyText(getIssueSummary(issue, Number(button.getAttribute('data-index'))));
      return;
    }
    if (action === 'copy-selector') {
      await copyText(issue.selector || '');
      return;
    }
    if (action === 'highlight' && issue.selector) {
      await safeSendMessage({ type: 'HIGHLIGHT_ISSUE_ACTIVE_TAB', selector: issue.selector });
    }
  });

  els.scanHistory.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-history-index]');
    if (!button) return;
    const entry = historyForCurrentHost()[Number(button.getAttribute('data-history-index'))];
    if (!entry) return;
    els.severityFilter.value = 'all';
    renderScanReport(getHistoryReport(entry));
  });

  els.exportJsonButton.addEventListener('click', exportReportJson);
  els.exportCsvButton.addEventListener('click', exportReportCsv);
  els.exportDeveloperReportButton.addEventListener('click', exportDeveloperReport);

  els.accessibilityTab.addEventListener('click', () => selectTab('accessibility'));
  els.auditTab.addEventListener('click', () => selectTab('audit'));
  els.accessibilityTab.addEventListener('keydown', (event) => handleTabKeydown('accessibility', event));
  els.auditTab.addEventListener('keydown', (event) => handleTabKeydown('audit', event));
}

async function init() {
  selectTab('accessibility');
  els.exportJsonButton.disabled = true;
  els.exportCsvButton.disabled = true;
  els.exportDeveloperReportButton.disabled = true;
  renderPresets();
  wireEvents();
  await detectActiveTab();
  await Promise.all([
    loadSettings(),
    loadPresets(),
    loadRules(),
    loadAuditHistory(),
    renderOnboarding()
  ]);
}

init();
