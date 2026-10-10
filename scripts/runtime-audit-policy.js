const fs = require('node:fs');

function validateRuntimeAudit(report) {
  if (!report || report.error || !report.metadata?.vulnerabilities) throw new Error('Runtime audit is unavailable or malformed; release is blocked.');
  const counts = report.metadata.vulnerabilities;
  for (const severity of ['info', 'low', 'moderate', 'high', 'critical', 'total']) {
    if (!Number.isSafeInteger(counts[severity]) || counts[severity] < 0) throw new Error(`Runtime audit count is invalid: ${severity}.`);
  }
  if (counts.total !== counts.info + counts.low + counts.moderate + counts.high + counts.critical) throw new Error('Runtime audit total does not match its severity counts.');
  if (counts.high > 0 || counts.critical > 0) throw new Error(`Runtime audit blocks release: high=${counts.high}, critical=${counts.critical}.`);
  return { ...counts };
}

if (require.main === module) {
  try {
    const counts = validateRuntimeAudit(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
    console.log('Runtime audit policy PASS:', counts);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
module.exports = { validateRuntimeAudit };
