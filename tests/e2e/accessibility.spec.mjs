import { test, chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
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

test('popup UI passes axe audit', async () => {
  const popup = await openPopup();

  const results = await new AxeBuilder({ page: popup }).analyze();
  expect(results.violations).toEqual([]);

  await popup.close();
});

test('page with extension enabled introduces no axe violations', async () => {
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  // Baseline
  const baseline = await new AxeBuilder({ page }).analyze();
  const baselineIds = new Set(baseline.violations.map((v) => v.id));

  // Enable extension
  const popup = await openPopup();
  await popup.locator('#enabled').check();
  await page.waitForTimeout(500);
  await popup.close();

  // Scan with extension
  const withExt = await new AxeBuilder({ page }).analyze();
  const newViolations = withExt.violations.filter((v) => !baselineIds.has(v.id));

  expect(newViolations).toEqual([]);

  await page.close();
});

test('skip-to-content link is present and functional', async () => {
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  // Enable extension
  const popup = await openPopup();
  await popup.locator('#enabled').check();
  await page.waitForTimeout(500);
  await popup.close();

  const skipLink = page.locator('#clarityone-skip-link');
  await expect(skipLink).toBeAttached();
  await expect(skipLink).toHaveText('Skip to content');

  const href = await skipLink.getAttribute('href');
  expect(href).toBeTruthy();
  const targetId = href.replace('#', '');
  await expect(page.locator(`#${targetId}`)).toBeAttached();

  await page.close();
});
