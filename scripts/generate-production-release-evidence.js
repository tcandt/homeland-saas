const fs = require('fs');
const path = require('path');
const { parseEnvFile } = require('./production-bundle-preflight');

function stringValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildEvidenceMarkdown(config) {
  const appUrl = stringValue(config.APP_URL);
  const apiHostPort = stringValue(config.API_HOST_PORT || '49188');
  const webHostPort = stringValue(config.WEB_HOST_PORT || '49187');
  const apiHealthUrl = `${appUrl.replace(/\/$/, '')}/api/v1/health/ready`;
  const lines = [
    '# Production Release Evidence',
    '',
    'Date: 2026-08-24',
    `APP_VERSION: ${stringValue(config.APP_VERSION)}`,
    `API_TAG: ${stringValue(config.API_TAG)}`,
    `WEB_TAG: ${stringValue(config.WEB_TAG)}`,
    `COMMIT_SHA: ${stringValue(config.COMMIT_SHA)}`,
    `BUILD_ID: ${stringValue(config.BUILD_ID)}`,
    `BUILD_TIME: ${stringValue(config.BUILD_TIME)}`,
    '',
    '## Runtime Targets',
    '',
    `- APP_URL: ${appUrl}`,
    `- API host port: ${apiHostPort}`,
    `- Web host port: ${webHostPort}`,
    `- Readiness URL: ${apiHealthUrl}`,
    '',
    '## Required Evidence',
    '',
    '- [ ] `npm run host-check:prod -- --path / --min-free-gb 8 --max-used-percent 85 --containers homeland_production_api,homeland_production_web,homeland_production_postgres,homeland_production_redis,homeland_production_cloudflared` passed on the VPS.',
    '- [ ] `npm run bundle-preflight:prod -- --env-file deploy/public-production/env.public-production` passed.',
    '- [ ] `npm run preflight:prod -- --env-file deploy/public-production/env.public-production` passed.',
    '- [ ] `docker compose --env-file deploy/public-production/env.public-production -f deploy/public-production/docker-compose.registry-production.yml pull` completed with the approved tags.',
    '- [ ] `docker compose --env-file deploy/public-production/env.public-production -f deploy/public-production/docker-compose.registry-production.yml up -d` completed.',
    '- [ ] `prisma migrate deploy` outcome recorded, including whether migrations were skipped or applied.',
    '- [ ] `curl -i /api/v1/health` and `/api/v1/health/ready` returned 200 after rollout.',
    '- [ ] Web login smoke passed for admin, adminA, adminB, manager.',
    '- [ ] One small SePay transaction per owner was verified end-to-end.',
    '- [ ] Zalo, Telegram, SMTP test delivery evidence attached.',
    '- [ ] Backup manifest ID and latest restore drill evidence attached.',
    '',
    '## Rollback Record',
    '',
    '- Previous API_TAG: ____________________',
    '- Previous WEB_TAG: ____________________',
    '- Rollback trigger threshold: health, smoke, 5xx, wrong owner/bank, duplicate payment, broken queue.',
    '- Rollback command: `docker compose --env-file deploy/public-production/env.public-production -f deploy/public-production/docker-compose.registry-production.yml up -d` after restoring previous tags.',
    '',
    '## Notes',
    '',
    '- Database rollback is not automatic.',
    '- If STORAGE_PROVIDER=local, attachment persistence depends on the `documents_production_storage` Docker volume.',
  ];
  return `${lines.join('\n')}\n`;
}

function parseArguments(argv) {
  const options = {
    envFile: 'deploy/public-production/env.public-production',
    output: 'docs/operations/PRODUCTION_RELEASE_EVIDENCE.md',
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--env-file') {
      options.envFile = argv[index + 1] || options.envFile;
      index += 1;
    } else if (argument === '--output') {
      options.output = argv[index + 1] || options.output;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  const config = parseEnvFile(options.envFile);
  const outputPath = path.resolve(options.output);
  fs.writeFileSync(outputPath, buildEvidenceMarkdown(config), 'utf8');
  process.stdout.write(`Wrote ${outputPath}\n`);
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`Generating production release evidence failed: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildEvidenceMarkdown,
  parseArguments,
};
