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

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get('claritySettings');
  if (!existing.claritySettings) {
    await chrome.storage.local.set({ claritySettings: DEFAULT_SETTINGS });
  } else {
    const merged = { ...DEFAULT_SETTINGS, ...existing.claritySettings };
    await chrome.storage.local.set({ claritySettings: merged });
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
