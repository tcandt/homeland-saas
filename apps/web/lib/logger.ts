import pino from 'pino';

export const logger = pino({
  level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
  base: {
    service: 'homeland-web',
  },
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  }),
});

// Helper to log with correlation ID context
export const getContextLogger = () => {
  let correlationId = '';
  if (typeof window === 'undefined') {
    try {
      const { headers } = require('next/headers');
      correlationId = headers().get('x-correlation-id') || '';
    } catch (e) {
      // Ignore
    }
  }

  return logger.child({
    ...(correlationId ? { correlationId } : {}),
  });
};
