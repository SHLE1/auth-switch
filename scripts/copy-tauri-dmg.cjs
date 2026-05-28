#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const releaseDir = path.join(root, 'release');
const bundleRoot = path.join(root, 'src-tauri', 'target');
const requestedArch = process.env.AUTH_SWITCH_DMG_ARCH;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(next, out);
    else if (entry.isFile() && entry.name.endsWith('.dmg') && next.includes(`${path.sep}bundle${path.sep}dmg${path.sep}`)) out.push(next);
  }
  return out;
}

function inferArch(file) {
  const normalized = file.replace(/\\/g, '/').toLowerCase();
  if (requestedArch) return requestedArch;
  if (normalized.includes('aarch64') || normalized.includes('arm64')) return 'arm64';
  if (normalized.includes('x86_64') || normalized.includes('x64')) return 'x64';
  return process.arch === 'arm64' ? 'arm64' : 'x64';
}

const dmgs = walk(bundleRoot).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
if (dmgs.length === 0) {
  console.error(`No Tauri DMG found under ${bundleRoot}`);
  process.exit(1);
}

fs.mkdirSync(releaseDir, { recursive: true });
const copied = [];
const seen = new Set();
for (const dmg of dmgs) {
  const arch = inferArch(dmg);
  if (seen.has(arch)) continue;
  seen.add(arch);
  const dest = path.join(releaseDir, `auth-switch-${pkg.version}-${arch}.dmg`);
  fs.copyFileSync(dmg, dest);
  const bytes = fs.statSync(dest).size;
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
  copied.push({ dest, bytes, sha256 });
  if (requestedArch) break;
}

for (const artifact of copied) {
  console.log(`${artifact.dest}`);
  console.log(`size=${artifact.bytes}`);
  console.log(`sha256=${artifact.sha256}`);
}
