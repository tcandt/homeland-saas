#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

// 1. Determine new version
let newVersion = process.argv[2];

const rootPkgPath = path.join(rootDir, 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));

if (!newVersion) {
  // If no argument passed, sync based on current root package.json version
  newVersion = rootPkg.version;
  console.log(`[Version Sync] No target version provided. Syncing from root package.json (${newVersion})...`);
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
