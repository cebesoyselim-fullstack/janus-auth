import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer logs until logger is ready
  });

  // Use Pino logger for consistent structured logging
  app.useLogger(app.get(Logger));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  app.get(Logger).log(`🚀 Application is running on: http://localhost:${port}`);
}
bootstrap();

