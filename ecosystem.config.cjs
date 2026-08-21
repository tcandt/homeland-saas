module.exports = {
  apps: [
    {
      name: 'homeland-api',
      cwd: process.env.HOMELAND_RELEASE_PATH || process.cwd(),
      script: 'apps/api/dist/src/main.js',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3001,
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '768M',
      time: true,
    },
    {
      name: 'homeland-web',
      cwd: process.env.HOMELAND_RELEASE_PATH
        ? `${process.env.HOMELAND_RELEASE_PATH}/apps/web`
        : `${process.cwd()}/apps/web`,
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000 -H 0.0.0.0',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.WEB_PORT || 3000,
        NEXT_TELEMETRY_DISABLED: '1',
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '768M',
      time: true,
    },
  ],
};
