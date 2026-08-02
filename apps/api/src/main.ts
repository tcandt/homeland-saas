import './instrumentation';
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { ZodValidationPipe } from 'nestjs-zod';
import { ClsService } from 'nestjs-cls';
import { MetricsInterceptor } from './metrics/metrics.interceptor';

import { AppModule } from './app.module';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor';
import { GlobalExceptionFilter } from './shared/exceptions/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });

  // 1. Logger
  app.useLogger(app.get(Logger));

  // 2. Versioning (/api/v1/...)
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const express = require('express');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // 3. CORS & Security
  app.enableCors();
  const helmet = require('helmet');
  app.use(helmet({
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: true,
    hsts: true,
    referrerPolicy: { policy: 'no-referrer' },
    xContentTypeOptions: true,
  }));

  // 4. Global Pipes, Filters & Interceptors
  const clsService = app.get(ClsService);
  const metricsInterceptor = app.get(MetricsInterceptor);
  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalInterceptors(new ResponseInterceptor(clsService), metricsInterceptor);
  app.useGlobalFilters(new GlobalExceptionFilter(clsService));

  // 5. Swagger Setup
  const config = new DocumentBuilder()
    .setTitle('HomeLand PMS API')
    .setDescription('The Enterprise Commercial PMS API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 6. Start server
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api/v1`);
  console.log(`Swagger Docs available at: http://localhost:${port}/api/docs`);
}
bootstrap();