import { registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME || 'homeland-web',
    // ...other configuration can be added here
  });
}
