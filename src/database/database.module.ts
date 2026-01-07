import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

/**
 * Database Module (Global)
 * 
 * Provides a singleton Drizzle ORM instance connected to PostgreSQL.
 * This module is marked as @Global() so it can be imported once in AppModule
 * and used throughout the application without re-importing.
 * 
 * Why use Pool instead of Client?
 * - Pool manages multiple connections efficiently
 * - Better for concurrent requests in a web application
 * - Automatic connection reuse and health checks
 */
@Global()
@Module({
  providers: [
    {
      provide: 'DRIZZLE_DB',
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        // Build connection string from environment variables
        // This approach is more secure than storing the full URL in .env
        const connectionString = configService.get<string>('DATABASE_URL') || 
          `postgresql://${configService.get<string>('POSTGRES_USER')}:${configService.get<string>('POSTGRES_PASSWORD')}@${configService.get<string>('POSTGRES_HOST', 'localhost')}:${configService.get<number>('POSTGRES_PORT', 5432)}/${configService.get<string>('POSTGRES_DB')}`;

        // Create a connection pool
        // max: 20 connections is a good default for most applications
        const pool = new Pool({
          connectionString,
          max: 20, // Maximum number of clients in the pool
          idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
          connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
        });

        // Create and return Drizzle instance with schema
        // The schema is passed here for type inference in queries
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: ['DRIZZLE_DB'],
})
export class DatabaseModule {}

