import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AppConfigService } from './config/config.service';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Get configuration service
  const configService = app.get(AppConfigService);
  const appConfig = configService.app;

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  });

  // Global prefix for API routes
  app.setGlobalPrefix('api');

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Enable shutdown hooks for graceful shutdown
  app.enableShutdownHooks();

  // Start the server
  await app.listen(appConfig.port);

  logger.log(`🚀 Application is running on: http://localhost:${appConfig.port}/api`);
  logger.log(`📡 WebSocket server is available at: ws://localhost:${appConfig.port}/tracking`);
  logger.log(`🌍 Environment: ${appConfig.environment}`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', error);
  process.exit(1);
});
