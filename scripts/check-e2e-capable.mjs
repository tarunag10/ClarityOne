import { chromium } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const extensionPath = path.resolve('clarityone/src');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-ext-check-'));

let context;

try {
  context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: false,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
    ],
    timeout: 15000,
  });

  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 5000 });
  if (!worker) {
    console.error('E2E capability check failed: extension service worker was not detected.');
    process.exitCode = 1;
  } else {
    console.log('E2E capability check passed.');
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`E2E capability check failed: ${message}`);
  process.exitCode = 1;
} finally {
  await context?.close().catch(() => {});
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
