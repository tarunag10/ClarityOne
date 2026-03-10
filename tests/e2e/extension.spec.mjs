import { test, chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';

const expect = test.expect;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '../../clarityone/src');

let context;
let extensionId;
let userDataDir;

async function openPopup() {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.waitForLoadState('domcontentloaded');
  return popup;
}

test.beforeAll(async () => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-ext-'));
  context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
    ],
  });
  // Wait for the extension service worker to register
  let sw = context.serviceWorkers()[0];
  if (!sw) {
    sw = await context.waitForEvent('serviceworker', { timeout: 30000 });
  }
  extensionId = new URL(sw.url()).host;
});

test.afterAll(async () => {
  await context?.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

test('loads and shows controls', async () => {
  const popup = await openPopup();
  await expect(popup.locator('h1')).toHaveText('ClarityOne');
  await expect(popup.locator('#enabled')).toBeVisible();
  await expect(popup.locator('#contrastMode')).toBeVisible();
  await expect(popup.locator('#fontScale')).toBeVisible();
  await expect(popup.locator('#lineHeight')).toBeVisible();
  await expect(popup.locator('#readableFont')).toBeVisible();
  await expect(popup.locator('#enhancedFocus')).toBeVisible();
  await expect(popup.locator('#resetButton')).toBeVisible();
  await popup.close();
});

test('toggle enable/disable', async () => {
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  const popup = await openPopup();
  await popup.locator('#enabled').check();
  await page.waitForTimeout(500);
  await expect(page.locator('html')).toHaveClass(/clarityone-enabled/);

  await popup.locator('#enabled').uncheck();
  await page.waitForTimeout(500);
  const cls = (await page.locator('html').getAttribute('class')) || '';
  expect(cls).not.toContain('clarityone-enabled');

  await popup.close();
  await page.close();
});

test('contrast modes apply correct classes', async () => {
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  const popup = await openPopup();
  await popup.locator('#enabled').check();
  await page.waitForTimeout(300);

  for (const mode of ['light', 'dark', 'yellow', 'invert']) {
    await popup.locator('#contrastMode').selectOption(mode);
    await page.waitForTimeout(500);
    await expect(page.locator('html')).toHaveClass(
      new RegExp(`clarityone-contrast-${mode}`)
    );
  }

  await popup.close();
  await page.close();
});

test('font scale slider changes CSS variable', async () => {
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  const popup = await openPopup();
  await popup.locator('#enabled').check();
  await popup.locator('#fontScale').fill('1.5');
  await popup.locator('#fontScale').dispatchEvent('input');
  await page.waitForTimeout(500);

  const val = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--clarityone-font-scale').trim()
  );
  expect(val).toBe('1.5');

  await popup.close();
  await page.close();
});

test('line height slider changes CSS variable', async () => {
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  const popup = await openPopup();
  await popup.locator('#enabled').check();
  await popup.locator('#lineHeight').fill('2');
  await popup.locator('#lineHeight').dispatchEvent('input');
  await page.waitForTimeout(500);

  const val = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--clarityone-line-height').trim()
  );
  expect(val).toBe('2');

  await popup.close();
  await page.close();
});

test('readable font toggle works', async () => {
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  const popup = await openPopup();
  await popup.locator('#enabled').check();
  await popup.locator('#readableFont').check();
  await page.waitForTimeout(500);

  const val = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--clarityone-font-family').trim()
  );
  expect(val).toContain('Arial');

  await popup.close();
  await page.close();
});

test('enhanced focus toggle works', async () => {
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  const popup = await openPopup();
  await popup.locator('#enabled').check();
  await popup.locator('#enhancedFocus').check();
  await page.waitForTimeout(500);

  const val = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--clarityone-focus-outline').trim()
  );
  expect(val).toContain('#ff9900');

  await popup.close();
  await page.close();
});

test('reset button restores defaults', async () => {
  const popup = await openPopup();

  await popup.locator('#enabled').check();
  await popup.locator('#contrastMode').selectOption('dark');
  await popup.waitForTimeout(300);

  await popup.locator('#resetButton').click();
  await popup.waitForTimeout(500);

  await expect(popup.locator('#enabled')).not.toBeChecked();
  await expect(popup.locator('#contrastMode')).toHaveValue('light');
  await expect(popup.locator('#fontScaleValue')).toHaveText('1.2x');
  await expect(popup.locator('#lineHeightValue')).toHaveText('1.7');
  await expect(popup.locator('#readableFont')).toBeChecked();
  await expect(popup.locator('#enhancedFocus')).toBeChecked();

  await popup.close();
});

test('settings persist after popup close/reopen', async () => {
  const popup1 = await openPopup();
  await popup1.locator('#enabled').check();
  await popup1.locator('#contrastMode').selectOption('dark');
  await popup1.waitForTimeout(500);
  await popup1.close();

  const popup2 = await openPopup();
  await popup2.waitForTimeout(500);

  await expect(popup2.locator('#enabled')).toBeChecked();
  await expect(popup2.locator('#contrastMode')).toHaveValue('dark');

  await popup2.locator('#resetButton').click();
  await popup2.waitForTimeout(300);
  await popup2.close();
});
