const { assertStagingUrl } = require('./staging-url-guard');
function admissionStorageState(baseURL, env = process.env) {
  const value = env.E2E_STAGING_ADMISSION_COOKIE?.trim();
  if (!value) return {};
  if (!/^homeland_staging_access=[a-f0-9]{64}$/.test(value)) throw new Error('Invalid staging admission cookie');
  const url = new URL(baseURL);
  // Cookies belong only to explicitly approved HTTPS origins, never a loopback
  // API or another test target. Browser contexts created by fixtures must also
  // receive this state; Playwright config alone does not apply to newContext().
  if (url.protocol !== 'https:') return {};
  assertStagingUrl(baseURL, env.E2E_STAGING_ORIGINS);
  return { storageState: { cookies: [{
    name: 'homeland_staging_access', value: value.split('=')[1],
    domain: url.hostname, path: '/', expires: -1,
    secure: true, httpOnly: true, sameSite: 'Strict',
  }], origins: [] } };
}
module.exports = { admissionStorageState };
