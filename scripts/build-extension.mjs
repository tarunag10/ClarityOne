import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = 'dist';
const srcDir = 'clarityone/src';
const iconDir = path.join(srcDir, 'icons');

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function writeUInt32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32LE(value >>> 0);
  return buffer;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanPath(filePath) {
  fs.rmSync(filePath, { recursive: true, force: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, fs.readFileSync(src));
}

function walkFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name === '__MACOSX') continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

export function zipDirectory(root, zipPath) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const filePath of walkFiles(root)) {
    const rel = path.relative(root, filePath).split(path.sep).join('/');
    const name = Buffer.from(rel);
    const data = fs.readFileSync(filePath);
    const crc = crc32(data);

    const local = Buffer.concat([
      writeUInt32(0x04034b50),
      writeUInt16(20),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(crc),
      writeUInt32(data.length),
      writeUInt32(data.length),
      writeUInt16(name.length),
      writeUInt16(0),
      name,
      data
    ]);
    locals.push(local);

    centrals.push(Buffer.concat([
      writeUInt32(0x02014b50),
      writeUInt16(20),
      writeUInt16(20),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(crc),
      writeUInt32(data.length),
      writeUInt32(data.length),
      writeUInt16(name.length),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt16(0),
      writeUInt32(0),
      writeUInt32(offset),
      name
    ]));
    offset += local.length;
  }

  const central = Buffer.concat(centrals);
  const end = Buffer.concat([
    writeUInt32(0x06054b50),
    writeUInt16(0),
    writeUInt16(0),
    writeUInt16(centrals.length),
    writeUInt16(centrals.length),
    writeUInt32(central.length),
    writeUInt32(offset),
    writeUInt16(0)
  ]);

  ensureDir(path.dirname(zipPath));
  fs.writeFileSync(zipPath, Buffer.concat([...locals, central, end]));
}

function buildTarget(name, manifest) {
  const outDir = path.join(distDir, name, 'clarityone');
  const zipPath = path.join(distDir, `clarityone-${name}.zip`);
  cleanPath(outDir);
  cleanPath(zipPath);
  ensureDir(path.join(outDir, 'icons'));

  for (const file of ['background.js', 'content.js', 'popup.js', 'content.css', 'popup.css', 'popup.html']) {
    copyFile(path.join(srcDir, file), path.join(outDir, file));
  }
  for (const file of ['icon-16.png', 'icon-48.png', 'icon-128.png']) {
    copyFile(path.join(iconDir, file), path.join(outDir, 'icons', file));
  }
  copyFile(manifest, path.join(outDir, 'manifest.json'));
  zipDirectory(outDir, zipPath);
  console.log(`Built ${zipPath}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const target = process.argv[2] || 'all';
  if (!['chrome', 'safari', 'all'].includes(target)) {
    console.error('Usage: node scripts/build-extension.mjs [chrome|safari|all]');
    process.exit(1);
  }

  if (target === 'chrome' || target === 'all') {
    buildTarget('chrome', path.join(srcDir, 'manifest.chrome.json'));
    copyFile(path.join(distDir, 'clarityone-chrome.zip'), path.join(distDir, 'clarityone.zip'));
  }
  if (target === 'safari' || target === 'all') {
    buildTarget('safari', path.join(srcDir, 'manifest.safari.json'));
  }
  if (target === 'all') {
    console.log('Built compatibility artifact dist/clarityone.zip (Chrome)');
  }
}
