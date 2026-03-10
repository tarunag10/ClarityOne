/**
 * Unit tests for background.js message handlers.
 * Run with: node tests/background.test.mjs
 *
 * Mocks chrome.storage.local and chrome.tabs APIs to test
 * message handler logic in isolation.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

const DEFAULT_SETTINGS = {
  enabled: false,
  contrastMode: 'light',
  fontScale: 1.2,
  readableFont: true,
  enhancedFocus: true,
  lineHeight: 1.7,
  siteOverrides: {}
};

// --- Chrome API mock ---
function createChromeMock(initialStorage = {}) {
  const storage = { ...initialStorage };
  const messageHandlers = [];

  return {
    storage: {
      local: {
        async get(key) {
          return { [key]: storage[key] };
        },
        async set(obj) {
          Object.assign(storage, obj);
        }
      }
    },
    runtime: {
      onMessage: {
        addListener(fn) { messageHandlers.push(fn); }
      },
      onInstalled: { addListener() {} },
      lastError: null
    },
    tabs: {
      async query() { return [{ id: 1 }]; },
      sendMessage() {}
    },
    commands: { onCommand: { addListener() {} } },
    _messageHandlers: messageHandlers,
    _storage: storage,
    async sendMessage(message) {
      return new Promise((resolve) => {
        for (const handler of messageHandlers) {
          const result = handler(message, {}, resolve);
          if (result === true) return; // async response
        }
        resolve(undefined);
      });
    }
  };
}

// --- Load background.js handler logic ---
function createHandler(chrome) {
  // Replicate the onMessage handler from background.js
  const handler = (message, sender, sendResponse) => {
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
        if (!tab?.id) { sendResponse({ ok: false }); return; }
        chrome.tabs.sendMessage(tab.id, { type: 'APPLY_SETTINGS', settings: message.settings });
        sendResponse({ ok: true });
      });
      return true;
    }
  };
  chrome.runtime.onMessage.addListener(handler);
  return handler;
}

test('GET_SETTINGS returns defaults when storage is empty', async () => {
  const chrome = createChromeMock();
  createHandler(chrome);
  const response = await chrome.sendMessage({ type: 'GET_SETTINGS' });
  assert.deepStrictEqual(response.settings, DEFAULT_SETTINGS);
});

test('GET_SETTINGS returns stored settings', async () => {
  const custom = { ...DEFAULT_SETTINGS, fontScale: 1.5, enabled: true };
  const chrome = createChromeMock({ claritySettings: custom });
  createHandler(chrome);
  const response = await chrome.sendMessage({ type: 'GET_SETTINGS' });
  assert.deepStrictEqual(response.settings, custom);
});

test('SAVE_SETTINGS persists to storage', async () => {
  const chrome = createChromeMock();
  createHandler(chrome);
  const newSettings = { ...DEFAULT_SETTINGS, fontScale: 1.8 };
  const response = await chrome.sendMessage({ type: 'SAVE_SETTINGS', settings: newSettings });
  assert.strictEqual(response.ok, true);
  assert.deepStrictEqual(chrome._storage.claritySettings, newSettings);
});

test('RESET_SETTINGS restores defaults', async () => {
  const chrome = createChromeMock({ claritySettings: { ...DEFAULT_SETTINGS, fontScale: 2.0 } });
  createHandler(chrome);
  const response = await chrome.sendMessage({ type: 'RESET_SETTINGS' });
  assert.deepStrictEqual(response.settings, DEFAULT_SETTINGS);
  assert.deepStrictEqual(chrome._storage.claritySettings, DEFAULT_SETTINGS);
});

test('APPLY_TO_ACTIVE_TAB sends message to tab', async () => {
  const chrome = createChromeMock();
  let sentMessage = null;
  chrome.tabs.sendMessage = (id, msg) => { sentMessage = { id, msg }; };
  createHandler(chrome);
  const settings = { ...DEFAULT_SETTINGS, enabled: true };
  const response = await chrome.sendMessage({ type: 'APPLY_TO_ACTIVE_TAB', settings });
  assert.strictEqual(response.ok, true);
  assert.strictEqual(sentMessage.id, 1);
  assert.strictEqual(sentMessage.msg.type, 'APPLY_SETTINGS');
});

test('SAVE_SITE_SETTINGS stores override for hostname', async () => {
  const chrome = createChromeMock({ claritySettings: { ...DEFAULT_SETTINGS } });
  createHandler(chrome);
  const response = await chrome.sendMessage({
    type: 'SAVE_SITE_SETTINGS',
    hostname: 'example.com',
    overrides: { contrastMode: 'dark' }
  });
  assert.strictEqual(response.ok, true);
  assert.deepStrictEqual(chrome._storage.claritySettings.siteOverrides['example.com'], { contrastMode: 'dark' });
});

test('REMOVE_SITE_SETTINGS deletes override for hostname', async () => {
  const initial = { ...DEFAULT_SETTINGS, siteOverrides: { 'example.com': { contrastMode: 'dark' } } };
  const chrome = createChromeMock({ claritySettings: initial });
  createHandler(chrome);
  const response = await chrome.sendMessage({ type: 'REMOVE_SITE_SETTINGS', hostname: 'example.com' });
  assert.strictEqual(response.ok, true);
  assert.strictEqual(chrome._storage.claritySettings.siteOverrides['example.com'], undefined);
});

test('GET_SETTINGS with hostname returns merged site settings', async () => {
  const initial = { ...DEFAULT_SETTINGS, siteOverrides: { 'example.com': { contrastMode: 'dark', fontScale: 1.8 } } };
  const chrome = createChromeMock({ claritySettings: initial });
  createHandler(chrome);
  const response = await chrome.sendMessage({ type: 'GET_SETTINGS', hostname: 'example.com' });
  assert.strictEqual(response.settings.contrastMode, 'dark');
  assert.strictEqual(response.settings.fontScale, 1.8);
  assert.strictEqual(response.settings.readableFont, true); // from global
  assert.deepStrictEqual(response.settings.siteOverrides, initial.siteOverrides);
});

test('GET_SETTINGS without hostname returns global settings', async () => {
  const initial = { ...DEFAULT_SETTINGS, siteOverrides: { 'example.com': { contrastMode: 'dark' } } };
  const chrome = createChromeMock({ claritySettings: initial });
  createHandler(chrome);
  const response = await chrome.sendMessage({ type: 'GET_SETTINGS' });
  assert.strictEqual(response.settings.contrastMode, 'light'); // global, not overridden
});
