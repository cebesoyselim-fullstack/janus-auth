import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AppsModule } from './modules/apps/apps.module';

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
    // Authentication module - handles login, register, logout
    AuthModule,
    // Users module - handles user management
    UsersModule,
    // Apps module - handles app (tenant) management
    AppsModule,
  ],
})
export class AppModule {}

