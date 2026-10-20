#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// 1. Determine new version
let newVersion = process.argv[2] || 'patch';

const rootPkgPath = path.join(rootDir, 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(rootPkg.version)) throw new Error('Current version must be a stable major.minor.patch version.');
const lockPath = path.join(rootDir, 'package-lock.json');
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
for (const key of ['', 'apps/api', 'apps/web']) {
  if (!lock.packages?.[key]) throw new Error(`Missing lockfile package: ${key}`);
}

if (newVersion === 'sync') {
  newVersion = rootPkg.version;
  console.log(`[Version Sync] Explicit metadata sync from root package.json (${newVersion})...`);
} else if (newVersion === 'patch' || newVersion === 'minor' || newVersion === 'major') {
  const parts = rootPkg.version.split('.').map(Number);
  if (newVersion === 'patch') parts[2] = (parts[2] || 0) + 1;
  else if (newVersion === 'minor') { parts[1] = (parts[1] || 0) + 1; parts[2] = 0; }
  else if (newVersion === 'major') { parts[0] = (parts[0] || 0) + 1; parts[1] = 0; parts[2] = 0; }
  newVersion = parts.join('.');
} else {
  // Strip optional leading 'v'
  newVersion = newVersion.replace(/^v/, '');
}

const vTag = `v${newVersion}`;
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) throw new Error('Expected a stable major.minor.patch version.');
if (process.argv[2] !== 'sync') {
  const before = rootPkg.version.split('.').map(Number);
  const after = newVersion.split('.').map(Number);
  const comparison = after.reduce((result, value, index) => result || Math.sign(value - before[index]), 0);
  if (comparison <= 0) throw new Error('A release version must increase; use sync only to repair metadata.');
}
console.log(`\x1b[34m[Version Sync] Setting version to ${newVersion} (${vTag})...\x1b[0m`);

// 2. Update JSON files
const jsonFiles = [
  'package.json',
  'apps/web/package.json',
  'apps/api/package.json',
];

for (const rel of jsonFiles) {
  const p = path.join(rootDir, rel);
  if (fs.existsSync(p)) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    data.version = newVersion;
    fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
    console.log(`  ✓ Updated ${rel}`);
  }
}

lock.version = newVersion;
for (const key of ['', 'apps/api', 'apps/web']) {
  lock.packages[key].version = newVersion;
}
fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8');

// 3. Update docker compose and env template files
const textReplacements = [
  {
    file: 'deploy/public-production/docker-compose.registry-production.yml',
    patterns: [
      { regex: /:(v\d+\.\d+\.\d+)/g, replacement: `:${vTag}` },
      { regex: /API_TAG:-v\d+\.\d+\.\d+/g, replacement: `API_TAG:-${vTag}` },
      { regex: /WEB_TAG:-v\d+\.\d+\.\d+/g, replacement: `WEB_TAG:-${vTag}` },
    ]
  },
  {
    file: 'deploy/public-production/docker-compose.public-production.yml',
    patterns: [
      { regex: /APP_VERSION:-v\d+\.\d+\.\d+/g, replacement: `APP_VERSION:-${vTag}` },
      { regex: /homeland-api:v\d+\.\d+\.\d+/g, replacement: `homeland-api:${vTag}` },
      { regex: /homeland-web:v\d+\.\d+\.\d+/g, replacement: `homeland-web:${vTag}` },
    ]
  },
  {
    file: '.env.example',
    patterns: [
      { regex: /APP_VERSION="v\d+\.\d+\.\d+"/g, replacement: `APP_VERSION="${vTag}"` }
    ]
  },
  {
    file: '.env.docker.example',
    patterns: [
      { regex: /APP_VERSION="v\d+\.\d+\.\d+"/g, replacement: `APP_VERSION="${vTag}"` }
    ]
  }
];

for (const item of textReplacements) {
  const p = path.join(rootDir, item.file);
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    for (const pat of item.patterns) {
      content = content.replace(pat.regex, pat.replacement);
    }
    fs.writeFileSync(p, content, 'utf8');
    console.log(`  ✓ Updated ${item.file}`);
  }
}

console.log(`\x1b[32m[Version Sync] Successfully synchronized all files to version ${newVersion} (${vTag})!\x1b[0m\n`);
