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
 * Connection String Priority:
 * 1. DATABASE_URL (full connection string) - Common in production
 * 2. Individual POSTGRES_* variables - More flexible, easier to debug
 * 
 * DATABASE_URL format: postgresql://user:password@host:port/database
 */
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB}`;

// Validate connection string before proceeding
// This prevents cryptic errors from drizzle-kit when connection string is invalid
if (!connectionString || connectionString.includes('undefined')) {
  console.error('\n❌ Error: Database connection details are missing or invalid!\n');
  console.error('Please ensure you have a .env file in the project root with one of the following:\n');
  console.error('Option 1: Full connection string');
  console.error('  DATABASE_URL=postgresql://user:password@localhost:5432/database_name\n');
  console.error('Option 2: Individual variables');
  console.error('  POSTGRES_USER=your_username');
  console.error('  POSTGRES_PASSWORD=your_password');
  console.error('  POSTGRES_HOST=localhost');
  console.error('  POSTGRES_PORT=5432');
  console.error('  POSTGRES_DB=your_database_name\n');
  console.error('Current values detected:');
  console.error(`  POSTGRES_USER: ${process.env.POSTGRES_USER || '(not set)'}`);
  console.error(`  POSTGRES_PASSWORD: ${process.env.POSTGRES_PASSWORD ? '***' : '(not set)'}`);
  console.error(`  POSTGRES_HOST: ${process.env.POSTGRES_HOST || '(not set, default: localhost)'}`);
  console.error(`  POSTGRES_PORT: ${process.env.POSTGRES_PORT || '(not set, default: 5432)'}`);
  console.error(`  POSTGRES_DB: ${process.env.POSTGRES_DB || '(not set)'}`);
  console.error(`  DATABASE_URL: ${process.env.DATABASE_URL ? '***' : '(not set)'}\n`);
  process.exit(1);
}

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString,
  },
  // Verbose output for better debugging during development
  verbose: true,
  // Strict mode ensures migrations match schema exactly
  strict: true,
});


