import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config, isProduction } from './config/env';

async function bootstrap() {
  // Config is already validated at import time
  console.log('✅ Environment variables validated successfully');
  console.log(`🚀 Starting application in ${config.NODE_ENV} mode`);

  const app = await NestFactory.create(AppModule);

  // CORS
  app.enableCors({
    origin: config.CORS_ORIGIN === '*' ? '*' : config.CORS_ORIGIN.split(','),
  });

  // Global prefix
  app.setGlobalPrefix('api');

  const port = config.PORT;
  await app.listen(port);
  console.log(`✅ Application running on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start application:', err);
  process.exit(1);
});
