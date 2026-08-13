import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  name: process.env.APP_NAME || 'HomeLand PMS API',
  url: process.env.APP_URL || 'http://localhost:3001',
  allowRegistration: process.env.ALLOW_REGISTRATION === 'true',
  enableSwagger: process.env.ENABLE_SWAGGER === 'true' || process.env.NODE_ENV !== 'production',
}));
