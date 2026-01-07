import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

/**
 * Database Type Export
 * 
 * This type represents the Drizzle database instance with full type inference
 * from our schema. Use this type when injecting the database into services.
 * 
 * Example usage in a service:
 * ```typescript
 * constructor(@Inject('DRIZZLE_DB') private db: Database) {}
 * ```
 */
export type Database = NodePgDatabase<typeof schema>;

