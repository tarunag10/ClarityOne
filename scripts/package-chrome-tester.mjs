import fs from 'node:fs';
import path from 'node:path';
import { zipDirectory } from './build-extension.mjs';

const distDir = 'dist';
const chromeBuildDir = path.join(distDir, 'chrome', 'clarityone');
const testerDir = path.join(distDir, 'chrome-tester');
const unpackedDir = path.join(testerDir, 'clarityone-unpacked');
const guideFile = path.join(testerDir, 'INSTALL-CHROME.md');
const zipFile = path.join(distDir, 'clarityone-chrome-tester.zip');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, fs.readFileSync(src));
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name === '__MACOSX') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else if (entry.isFile()) copyFile(srcPath, destPath);
  }
}

fs.rmSync(testerDir, { recursive: true, force: true });
fs.rmSync(zipFile, { force: true });
copyDir(chromeBuildDir, unpackedDir);
copyFile(path.join('docs', 'CHROME-TESTER-INSTALL.md'), guideFile);
zipDirectory(testerDir, zipFile);

console.log(`Built ${zipFile}`);
console.log(`Share this with testers: ${zipFile}`);
