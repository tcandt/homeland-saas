const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('registry production compose pulls immutable API and web tags instead of building locally', () => {
  const compose = fs.readFileSync(
    path.resolve('deploy/public-production/docker-compose.registry-production.yml'),
    'utf8',
  );

  assert.match(compose, /API_IMAGE/);
  assert.match(compose, /WEB_IMAGE/);
  assert.match(compose, /API_TAG/);
  assert.match(compose, /WEB_TAG/);
  assert.doesNotMatch(compose, /^\s+build:/m);
  assert.match(compose, /ghcr\.io\/tcandt\/homeland-saas\/homeland-api/);
  assert.match(compose, /ghcr\.io\/tcandt\/homeland-saas\/homeland-web/);
});
