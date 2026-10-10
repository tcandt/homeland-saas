const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

function parsePostgresUrl(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('Database connection configuration is invalid.');
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  if (!POSTGRES_PROTOCOLS.has(parsed.protocol) || !parsed.hostname || !/^[a-z_][a-z0-9_-]{0,62}$/i.test(databaseName)) {
    throw new Error('Database connection configuration is invalid.');
  }

  return {
    protocol: parsed.protocol,
    host: parsed.hostname.replace(/^\[|\]$/g, ''),
    port: parsed.port || '5432',
    databaseName,
    username: decodeURIComponent(parsed.username || ''),
    password: decodeURIComponent(parsed.password || ''),
    sslmode: parsed.searchParams.get('sslmode') || null,
  };
}

function createPostgresCliEnv(databaseUrl, baseEnv = process.env) {
  const identity = parsePostgresUrl(databaseUrl);
  const env = { ...baseEnv };
  for (const key of Object.keys(env)) {
    if (/^PG/i.test(key) || /^(DATABASE_URL|RESTORE_DRILL_DATABASE_URL)$/i.test(key)) delete env[key];
  }
  env.PGHOST = identity.host;
  env.PGPORT = identity.port;
  env.PGDATABASE = identity.databaseName;
  if (identity.username) env.PGUSER = identity.username;
  if (identity.password) env.PGPASSWORD = identity.password;
  if (identity.sslmode) env.PGSSLMODE = identity.sslmode;
  return { env, identity };
}

module.exports = { createPostgresCliEnv, parsePostgresUrl };
