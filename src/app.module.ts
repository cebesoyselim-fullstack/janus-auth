import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    // Global configuration module - loads .env file automatically
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Pino logger module - provides structured logging with pretty printing in development
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: false,
                  translateTime: 'SYS:standard',
                },
              }
            : undefined,
      },
    }),
    // Database module - provides Drizzle ORM instance globally
    DatabaseModule,
  ],
})
export class AppModule {}

