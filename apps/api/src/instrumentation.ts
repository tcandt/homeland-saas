import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { TraceIdRatioBasedSampler, ParentBasedSampler, AlwaysOnSampler } from '@opentelemetry/sdk-trace-base';
import * as dotenv from 'dotenv';

dotenv.config();

// When running in Docker monitoring stack, OTLP_ENDPOINT points to Tempo.
// Default falls back to localhost (for local dev without Tempo).
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

const traceExporter = new OTLPTraceExporter({
  url: `${otlpEndpoint}/v1/traces`,
});

// Configure Sampling
// Default to 100% locally/staging, but 20% on production
const samplingRatio = parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || (process.env.NODE_ENV === 'production' ? '0.2' : '1.0'));
const rootSampler = samplingRatio === 1.0 ? new AlwaysOnSampler() : new TraceIdRatioBasedSampler(samplingRatio);
const sampler = new ParentBasedSampler({
  root: rootSampler,
});

export const otelSDK = new NodeSDK({
  // Resource attributes are picked up automatically from OTEL_SERVICE_NAME and OTEL_RESOURCE_ATTRIBUTES
  traceExporter,
  sampler,
  instrumentations: [
    new HttpInstrumentation({
      // Exclude health check and metrics from tracing to reduce noise
      ignoreIncomingRequestHook: (req) => {
        const url = req.url || '';
        return url.includes('/metrics') || url.startsWith('/api/v1/health');
      },
    }),
    new ExpressInstrumentation(),
    new NestInstrumentation(),
    // new PrismaInstrumentation(), // Disabled temporarily due to createEngineSpan TypeError
  ],
});

// Graceful shutdown
process.on('SIGTERM', () => {
  otelSDK.shutdown()
    .then(() => process.stdout.write('Tracing terminated\n'))
    .catch((error) => process.stdout.write(`Error terminating tracing: ${error}\n`))
    .finally(() => process.exit(0));
});

otelSDK.start();
