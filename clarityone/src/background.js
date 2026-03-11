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

const DEFAULT_PRESETS = [
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
      lineHeight: 2.0,
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
const DEFAULT_RULES = [];

async function ensureContentLayer(tabId) {
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ['content.css']
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });
}

async function sendMessageToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (!msg.includes('Receiving end does not exist')) {
      throw error;
    }
    await ensureContentLayer(tabId);
    return await chrome.tabs.sendMessage(tabId, message);
  }
}

async function applySettingsToTab(tabId, settings) {
  await sendMessageToTab(tabId, { type: 'APPLY_SETTINGS', settings });
}

function hostnameMatchesPattern(hostname, pattern) {
  if (!hostname || !pattern) return false;
  const normalized = pattern.trim().toLowerCase();
  if (!normalized) return false;
  const host = hostname.toLowerCase();
  const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}$`, 'i');
  return regex.test(host);
}

async function getRuleAppliedSettings(hostname) {
  const { clarityRules = DEFAULT_RULES, clarityPresets = DEFAULT_PRESETS } = await chrome.storage.local.get([
    'clarityRules',
    'clarityPresets'
  ]);
  const activeRule = clarityRules.find((rule) => rule.enabled && hostnameMatchesPattern(hostname, rule.pattern));
  if (!activeRule) return null;
  const preset = clarityPresets.find((item) => item.id === activeRule.presetId);
  if (!preset?.settings) return null;
  return { ...DEFAULT_SETTINGS, ...preset.settings };
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(['claritySettings', 'clarityPresets', 'clarityRules']);
  if (!existing.claritySettings) {
    await chrome.storage.local.set({ claritySettings: DEFAULT_SETTINGS });
  } else {
    const merged = { ...DEFAULT_SETTINGS, ...existing.claritySettings };
    await chrome.storage.local.set({ claritySettings: merged });
  }
  if (!Array.isArray(existing.clarityPresets) || existing.clarityPresets.length === 0) {
    await chrome.storage.local.set({ clarityPresets: DEFAULT_PRESETS });
  }
  if (!Array.isArray(existing.clarityRules)) {
    await chrome.storage.local.set({ clarityRules: DEFAULT_RULES });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-clarity') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const { claritySettings = DEFAULT_SETTINGS } = await chrome.storage.local.get('claritySettings');
  const nextSettings = { ...claritySettings, enabled: !claritySettings.enabled };
  await chrome.storage.local.set({ claritySettings: nextSettings });
  try {
    await applySettingsToTab(tab.id, nextSettings);
  } catch (_) {
    // Ignore tabs where script injection is not allowed (e.g., browser internal pages).
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get('claritySettings').then(({ claritySettings = DEFAULT_SETTINGS }) => {
      const hostname = message.hostname;
      if (hostname && claritySettings.siteOverrides && claritySettings.siteOverrides[hostname]) {
        const merged = { ...claritySettings, ...claritySettings.siteOverrides[hostname] };
        merged.siteOverrides = claritySettings.siteOverrides;
        sendResponse({ settings: merged });
      } else {
        sendResponse({ settings: claritySettings });
      }
    });
    return true;
  }

  if (message.type === 'GET_PRESETS') {
    chrome.storage.local.get('clarityPresets').then(({ clarityPresets = DEFAULT_PRESETS }) => {
      sendResponse({ presets: clarityPresets });
    });
    return true;
  }

  if (message.type === 'SAVE_PRESET') {
    chrome.storage.local.get('clarityPresets').then(({ clarityPresets = DEFAULT_PRESETS }) => {
      const next = [...clarityPresets];
      const idx = next.findIndex((preset) => preset.id === message.preset.id);
      if (idx >= 0) {
        next[idx] = { ...next[idx], ...message.preset };
      } else {
        next.push(message.preset);
      }
      chrome.storage.local.set({ clarityPresets: next }).then(() => {
        sendResponse({ ok: true, presets: next });
      });
    });
    return true;
  }

  if (message.type === 'DELETE_PRESET') {
    chrome.storage.local.get('clarityPresets').then(({ clarityPresets = DEFAULT_PRESETS }) => {
      const next = clarityPresets.filter((preset) => {
        if (preset.id !== message.id) return true;
        return Boolean(preset.builtIn);
      });
      chrome.storage.local.set({ clarityPresets: next }).then(() => {
        sendResponse({ ok: true, presets: next });
      });
    });
    return true;
  }

  if (message.type === 'GET_RULES') {
    chrome.storage.local.get('clarityRules').then(({ clarityRules = DEFAULT_RULES }) => {
      sendResponse({ rules: clarityRules });
    });
    return true;
  }

  if (message.type === 'ADD_RULE') {
    chrome.storage.local.get('clarityRules').then(({ clarityRules = DEFAULT_RULES }) => {
      const next = [...clarityRules, message.rule];
      chrome.storage.local.set({ clarityRules: next }).then(() => {
        sendResponse({ ok: true, rules: next });
      });
    });
    return true;
  }

  if (message.type === 'TOGGLE_RULE') {
    chrome.storage.local.get('clarityRules').then(({ clarityRules = DEFAULT_RULES }) => {
      const next = clarityRules.map((rule) =>
        rule.id === message.id ? { ...rule, enabled: Boolean(message.enabled) } : rule
      );
      chrome.storage.local.set({ clarityRules: next }).then(() => {
        sendResponse({ ok: true, rules: next });
      });
    });
    return true;
  }

  if (message.type === 'DELETE_RULE') {
    chrome.storage.local.get('clarityRules').then(({ clarityRules = DEFAULT_RULES }) => {
      const next = clarityRules.filter((rule) => rule.id !== message.id);
      chrome.storage.local.set({ clarityRules: next }).then(() => {
        sendResponse({ ok: true, rules: next });
      });
    });
    return true;
  }

  if (message.type === 'AUTO_APPLY_RULES') {
    const tabId = sender?.tab?.id;
    if (!tabId || !message.hostname) {
      sendResponse({ ok: false });
      return false;
    }
    getRuleAppliedSettings(message.hostname)
      .then((settings) => {
        if (!settings) {
          sendResponse({ ok: true, applied: false });
          return;
        }
        applySettingsToTab(tabId, settings)
          .then(() => sendResponse({ ok: true, applied: true }))
          .catch(() => sendResponse({ ok: false, applied: false }));
      })
      .catch(() => sendResponse({ ok: false, applied: false }));
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set({ claritySettings: message.settings }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'SAVE_SITE_SETTINGS') {
    chrome.storage.local.get('claritySettings').then(({ claritySettings = DEFAULT_SETTINGS }) => {
      const overrides = { ...claritySettings.siteOverrides };
      overrides[message.hostname] = message.overrides;
      const updated = { ...claritySettings, siteOverrides: overrides };
      chrome.storage.local.set({ claritySettings: updated }).then(() => {
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (message.type === 'REMOVE_SITE_SETTINGS') {
    chrome.storage.local.get('claritySettings').then(({ claritySettings = DEFAULT_SETTINGS }) => {
      const overrides = { ...claritySettings.siteOverrides };
      delete overrides[message.hostname];
      const updated = { ...claritySettings, siteOverrides: overrides };
      chrome.storage.local.set({ claritySettings: updated }).then(() => {
        sendResponse({ ok: true });
      });
    });
    return true;
  }

  if (message.type === 'RESET_SETTINGS') {
    chrome.storage.local.set({ claritySettings: DEFAULT_SETTINGS }).then(() => {
      sendResponse({ settings: DEFAULT_SETTINGS });
    });
    return true;
  }

  if (message.type === 'APPLY_TO_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab?.id) {
        sendResponse({ ok: false });
        return;
      }
      applySettingsToTab(tab.id, message.settings)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
    });
    return true;
  }

  if (message.type === 'SCAN_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab?.id) {
        sendResponse({ ok: false, error: 'No active tab found.' });
        return;
      }
      sendMessageToTab(tab.id, { type: 'SCAN_PAGE' })
        .then((report) => sendResponse({ ok: true, report }))
        .catch((error) => sendResponse({ ok: false, error: String(error) }));
    });
    return true;
  }

  if (message.type === 'HIGHLIGHT_ISSUE_ACTIVE_TAB') {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab?.id) {
        sendResponse({ ok: false, error: 'No active tab found.' });
        return;
      }
      sendMessageToTab(tab.id, { type: 'HIGHLIGHT_ISSUE', selector: message.selector })
        .then(() => sendResponse({ ok: true }))
        .catch((error) => sendResponse({ ok: false, error: String(error) }));
    });
    return true;
  }
});
