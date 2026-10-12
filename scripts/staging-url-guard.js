function assertStagingUrl(value, approvedOrigins) {
  const url = new URL(value);
  const origins = (approvedOrigins || '').split(',').map((entry) => entry.trim()).filter(Boolean);
  if (!origins.length) throw new Error('BLOCKED: approved staging origins are required');
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'https:' || parsed.origin !== origin || parsed.username || parsed.password) {
      throw new Error('BLOCKED: staging origin allowlist must contain exact HTTPS origins');
    }
  }
  if (url.protocol !== 'https:') throw new Error('BLOCKED: staging URL must use HTTPS');
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('BLOCKED: staging URL must be an origin without userinfo/path/query/fragment');
  }
  if (!origins.includes(url.origin)) throw new Error('BLOCKED: URL is not an approved staging origin');
  return url.origin;
}

if (require.main === module) {
  try {
    assertStagingUrl(process.env.STAGING_URL, process.env.E2E_STAGING_ORIGINS);
    console.log('PASS: trusted HTTPS staging origin');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { assertStagingUrl };
