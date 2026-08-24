#!/usr/bin/env node
function parseArguments(argv) {
  const options = {
    provider: 'r2',
    bucket: '',
    noncurrentDays: 30,
    abortMultipartDays: 7,
    retainCurrentVersions: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--provider') {
      options.provider = (argv[index + 1] || options.provider).toLowerCase();
      index += 1;
    } else if (argument === '--bucket') {
      options.bucket = argv[index + 1] || options.bucket;
      index += 1;
    } else if (argument === '--noncurrent-days') {
      options.noncurrentDays = Number(argv[index + 1] || options.noncurrentDays);
      index += 1;
    } else if (argument === '--abort-multipart-days') {
      options.abortMultipartDays = Number(argv[index + 1] || options.abortMultipartDays);
      index += 1;
    } else if (argument === '--retain-current-versions=false') {
      options.retainCurrentVersions = false;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!['r2', 's3'].includes(options.provider)) {
    throw new Error('--provider must be r2 or s3.');
  }
  if (!Number.isFinite(options.noncurrentDays) || options.noncurrentDays <= 0) {
    throw new Error('--noncurrent-days must be a positive number.');
  }
  if (!Number.isFinite(options.abortMultipartDays) || options.abortMultipartDays <= 0) {
    throw new Error('--abort-multipart-days must be a positive number.');
  }

  return options;
}

function generatePolicy(options) {
  const lifecycle = {
    provider: options.provider,
    bucket: options.bucket || '<set-bucket-name>',
    versioning: 'Enabled',
    recommendation: {
      privateBucket: true,
      directPublicAccess: false,
      databaseStoresStableInternalReferences: true,
      signedUrlTtlSeconds: 900,
    },
    lifecycleRules: [
      {
        id: 'abort-incomplete-multipart-uploads',
        status: 'Enabled',
        abortIncompleteMultipartUploadDays: options.abortMultipartDays,
      },
      {
        id: 'expire-noncurrent-object-versions',
        status: 'Enabled',
        noncurrentVersionExpirationDays: options.noncurrentDays,
      },
    ],
  };

  if (!options.retainCurrentVersions) {
    lifecycle.lifecycleRules.push({
      id: 'current-object-expiration-disabled-by-default',
      status: 'Disabled',
      expirationDays: 0,
      note: 'Do not auto-delete current attachment objects until legal retention is approved.',
    });
  }

  return lifecycle;
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(generatePolicy(options), null, 2)}\n`);
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`Lifecycle policy generation failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  generatePolicy,
  parseArguments,
};
