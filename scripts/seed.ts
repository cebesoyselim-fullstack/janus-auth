import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../src/database/schema';
import { isNull } from 'drizzle-orm';

/**
 * Database Seeding Script
 * 
 * Populates the database with initial demo data for testing.
 * 
 * Purpose:
 * - Creates demo apps (tenants) for testing authentication flows
 * - Generates App IDs that can be used for registration testing
 * 
 * Usage:
 * - Run: npm run seed
 * - Or: npx tsx scripts/seed.ts
 * 
 * Why a standalone script?
 * - Not part of application runtime - only used during setup/testing
 * - Can be run independently of NestJS application
 * - Uses Drizzle directly for simplicity
 */

// Load environment variables from .env file
dotenv.config();

async function seed() {
  console.log('🌱 Starting database seeding...\n');

  // Build connection string from environment variables
  // Why check both DATABASE_URL and individual variables?
  // - DATABASE_URL: Common in production (Heroku, Railway, etc.)
  // - Individual variables: More flexible, easier to debug
  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB}`;

  // Validate connection string was built correctly
  if (!connectionString || connectionString.includes('undefined')) {
    console.error('❌ Error: Database connection details are missing!\n');
    console.error('Please ensure you have one of the following set in your .env file:');
    console.error('  - DATABASE_URL (full connection string)');
    console.error('  OR individual variables:');
    console.error('  - POSTGRES_USER');
    console.error('  - POSTGRES_PASSWORD');
    console.error('  - POSTGRES_HOST (default: localhost)');
    console.error('  - POSTGRES_PORT (default: 5432)');
    console.error('  - POSTGRES_DB\n');
    throw new Error(
      'DATABASE_URL or POSTGRES_* environment variables must be set',
    );
  }

  // Log connection info (without password) for debugging
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || 5432;
  const databaseName = process.env.POSTGRES_DB || '(from DATABASE_URL)';
  console.log(`📡 Connecting to: ${host}:${port}/${databaseName}\n`);

  // Create a connection pool
  const pool = new Pool({
    connectionString,
    max: 1, // Only need one connection for seeding
  });

  // Create Drizzle instance with schema
  const db = drizzle(pool, { schema });

  try {
    // Check if any apps already exist (including soft-deleted)
    const existingApps = await db
      .select()
      .from(schema.apps)
      .where(isNull(schema.apps.deletedAt)); // Only check active apps

    if (existingApps.length > 0) {
      console.log('ℹ️  Apps already exist in the database:');
      existingApps.forEach((app) => {
        console.log(`   - ${app.name} (${app.slug}): ${app.id}`);
      });
      console.log('\n✅ Skipping seed - apps already exist.\n');
      return;
    }

    // Insert demo apps
    console.log('📦 Inserting demo apps...\n');

    const [trackingApp] = await db
      .insert(schema.apps)
      .values({
        name: 'Tracking App',
        slug: 'tracking-app',
      })
      .returning({
        id: schema.apps.id,
        name: schema.apps.name,
        slug: schema.apps.slug,
      });

    const [todoApp] = await db
      .insert(schema.apps)
      .values({
        name: 'Todo App',
        slug: 'todo-app',
      })
      .returning({
        id: schema.apps.id,
        name: schema.apps.name,
        slug: schema.apps.slug,
      });

    console.log('✅ Demo apps created successfully!\n');
    console.log('📋 Generated App IDs (use these for registration testing):\n');
    console.log(`   1. ${trackingApp.name}`);
    console.log(`      Slug: ${trackingApp.slug}`);
    console.log(`      ID:   ${trackingApp.id}\n`);
    console.log(`   2. ${todoApp.name}`);
    console.log(`      Slug: ${todoApp.slug}`);
    console.log(`      ID:   ${todoApp.id}\n`);
    console.log('💡 Tip: Copy these App IDs to use in your registration requests!\n');
  } catch (error: any) {
    console.error('❌ Error seeding database:', error.message || error);
    
    // Provide helpful error messages for common connection issues
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Connection Refused Error - Possible solutions:\n');
      console.error('   1. Check if PostgreSQL is running:');
      console.error('      - If using Docker: docker-compose up -d');
      console.error('      - If running locally: Check PostgreSQL service status\n');
      console.error('   2. Verify connection details in .env file:');
      console.error(`      - Host: ${host}`);
      console.error(`      - Port: ${port}`);
      console.error(`      - Database: ${databaseName}\n`);
      console.error('   3. Test connection manually:');
      console.error(`      - psql -h ${host} -p ${port} -U ${process.env.POSTGRES_USER || 'your_user'} -d ${databaseName}\n`);
    } else if (error.code === 'ENOTFOUND') {
      console.error('\n💡 Host Not Found Error:\n');
      console.error(`   The host "${host}" could not be resolved.\n`);
      console.error('   - Check POSTGRES_HOST in .env file');
      console.error('   - Ensure database server is accessible\n');
    } else if (error.message?.includes('password authentication failed')) {
      console.error('\n💡 Authentication Failed Error:\n');
      console.error('   - Check POSTGRES_USER and POSTGRES_PASSWORD in .env file');
      console.error('   - Verify credentials match your database server\n');
    } else if (error.message?.includes('database') && error.message?.includes('does not exist')) {
      console.error('\n💡 Database Not Found Error:\n');
      console.error(`   - Database "${databaseName}" does not exist`);
      console.error('   - Create it first: CREATE DATABASE <database_name>;\n');
    }
    
    throw error;
  } finally {
    // Close the connection pool
    await pool.end();
    console.log('🔌 Database connection closed.');
  }
}

// Run the seed function
seed()
  .then(() => {
    console.log('✨ Seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Seeding failed:', error);
    process.exit(1);
  });
