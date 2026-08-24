const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildEvidenceMarkdown,
  parseArguments,
} = require('./generate-production-release-evidence');

test('builds a release evidence template with immutable tags and rollout checklist', () => {
  const markdown = buildEvidenceMarkdown({
    APP_VERSION: 'v1.1.3',
    API_TAG: 'v1.1.3',
    WEB_TAG: '64f2666',
    COMMIT_SHA: '64f26661abc1234',
    BUILD_ID: 'public-production',
    BUILD_TIME: '2026-08-24T00:00:00Z',
    APP_URL: 'https://homeland.example.com',
    API_HOST_PORT: '49188',
    WEB_HOST_PORT: '49187',
  });

  assert.match(markdown, /Production Release Evidence/);
  assert.match(markdown, /API_TAG: v1\.1\.3/);
  assert.match(markdown, /WEB_TAG: 64f2666/);
  assert.match(markdown, /bundle-preflight:prod/);
  assert.match(markdown, /documents_production_storage/);
});

test('parses supported CLI arguments', () => {
  assert.deepEqual(parseArguments(['--env-file', 'prod.env', '--output', 'record.md']), {
    envFile: 'prod.env',
    output: 'record.md',
  });
});
