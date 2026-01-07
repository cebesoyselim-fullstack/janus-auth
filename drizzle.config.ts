import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Drizzle Kit Configuration
 * 
 * This configuration file tells Drizzle Kit:
 * - Where to find the schema definitions
 * - Where to output migration files
 * - How to connect to the database for migrations
 * 
 * DATABASE_URL format: postgresql://user:password@host:port/database
 */
export default defineConfig({
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
  // Verbose output for better debugging during development
  verbose: true,
  // Strict mode ensures migrations match schema exactly
  strict: true,
});

