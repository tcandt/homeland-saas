const test = require('node:test');
const assert = require('node:assert/strict');

const { generatePolicy, parseArguments } = require('./generate-object-storage-lifecycle-policy');

test('parses object storage lifecycle policy CLI arguments', () => {
  assert.deepEqual(
    parseArguments(['--provider', 's3', '--bucket', 'homeland-prod', '--noncurrent-days', '45', '--abort-multipart-days', '5']),
    {
      provider: 's3',
      bucket: 'homeland-prod',
      noncurrentDays: 45,
      abortMultipartDays: 5,
      retainCurrentVersions: true,
    },
  );
});

test('generates lifecycle/versioning policy scaffolding for object storage rollout', () => {
  const policy = generatePolicy({
    provider: 'r2',
    bucket: 'homeland-production',
    noncurrentDays: 30,
    abortMultipartDays: 7,
    retainCurrentVersions: true,
  });

  assert.equal(policy.versioning, 'Enabled');
  assert.equal(policy.recommendation.privateBucket, true);
  assert.equal(policy.lifecycleRules[0].abortIncompleteMultipartUploadDays, 7);
  assert.equal(policy.lifecycleRules[1].noncurrentVersionExpirationDays, 30);
});
