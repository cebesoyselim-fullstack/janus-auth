import { pgTable, uuid, varchar, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/**
 * Common column patterns for reusability
 * Following PostgreSQL best practices with UUID v4 and timestamps
 */

// Helper function to create common timestamp columns
const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
};

/**
 * APPS TABLE
 * Core business entity representing tenant applications.
 * Uses Soft Delete to preserve data integrity and audit trails.
 */
export const apps = pgTable(
  'apps',
  {
    id: uuid('id')
      .primaryKey()
      .defaultRandom() // Uses gen_random_uuid() in PostgreSQL
      .$defaultFn(() => randomUUID()), // TypeScript fallback using Node.js crypto
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    ...timestamps,
    // Soft Delete: Allows data recovery and maintains referential integrity
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    // Index on slug for fast lookups (already unique, but explicit index helps)
    slugIdx: index('apps_slug_idx').on(table.slug),
    // Index on deleted_at for efficient filtering of active apps
    deletedAtIdx: index('apps_deleted_at_idx').on(table.deletedAt),
  }),
);

/**
 * USERS TABLE
 * User accounts scoped to a specific app (multi-tenancy).
 * Uses Soft Delete and enforces Composite Unique Index on (app_id, email).
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .defaultRandom()
      .$defaultFn(() => randomUUID()),
    appId: uuid('app_id')
      .notNull()
      .references(() => apps.id, { onDelete: 'restrict' }), // Prevent deletion of app with users
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: varchar('role', { length: 50 }).notNull().default('user'),
    isEmailVerified: boolean('is_email_verified').notNull().default(false),
    ...timestamps,
    // Soft Delete: Preserves user history and maintains audit trail
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    // Composite Unique Index: Enforces email uniqueness per app (multi-tenancy requirement)
    // This allows the same email to exist in different apps, but unique within each app
    appEmailUniqueIdx: uniqueIndex('users_app_id_email_unique_idx').on(
      table.appId,
      table.email,
    ),
    // Index on app_id for efficient queries filtering by tenant
    appIdIdx: index('users_app_id_idx').on(table.appId),
    // Index on email for login lookups (combined with app_id in queries)
    emailIdx: index('users_email_idx').on(table.email),
    // Index on deleted_at for filtering active users
    deletedAtIdx: index('users_deleted_at_idx').on(table.deletedAt),
  }),
);

/**
 * REFRESH TOKENS TABLE
 * Stores refresh tokens for JWT authentication.
 * Uses Hard Delete - tokens are ephemeral and should be completely removed when invalidated.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id')
      .primaryKey()
      .defaultRandom()
      .$defaultFn(() => randomUUID()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }), // Auto-delete tokens when user is deleted
    // TODO: Hash this token in production for security
    token: varchar('token', { length: 500 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    // No updated_at: Tokens are immutable once created
    // No deleted_at: Hard delete - tokens are completely removed on logout/invalidation
  },
  (table) => ({
    // Index on user_id for efficient token lookups per user
    userIdIdx: index('refresh_tokens_user_id_idx').on(table.userId),
    // Index on token for fast authentication lookups
    tokenIdx: index('refresh_tokens_token_idx').on(table.token),
    // Index on expires_at for cleanup of expired tokens
    expiresAtIdx: index('refresh_tokens_expires_at_idx').on(table.expiresAt),
  }),
);

/**
 * EMAIL VERIFICATION TOKENS TABLE
 * Stores one-time tokens for email verification during registration.
 * Uses Hard Delete - tokens are single-use and should be completely removed after verification.
 */
export const emailVerificationTokens = pgTable(
  'email_verification_tokens',
  {
    id: uuid('id')
      .primaryKey()
      .defaultRandom()
      .$defaultFn(() => randomUUID()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // TODO: Hash this token in production for security
    token: varchar('token', { length: 500 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    // No updated_at: Tokens are immutable
    // No deleted_at: Hard delete - all tokens deleted upon successful verification
  },
  (table) => ({
    userIdIdx: index('email_verification_tokens_user_id_idx').on(table.userId),
    tokenIdx: index('email_verification_tokens_token_idx').on(table.token),
    expiresAtIdx: index('email_verification_tokens_expires_at_idx').on(table.expiresAt),
  }),
);

/**
 * PASSWORD RESET TOKENS TABLE
 * Stores one-time tokens for password reset requests.
 * Uses Hard Delete - tokens are single-use and should be completely removed after use or expiration.
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id')
      .primaryKey()
      .defaultRandom()
      .$defaultFn(() => randomUUID()),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // TODO: Hash this token in production for security
    token: varchar('token', { length: 500 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    // No updated_at: Tokens are immutable
    // No deleted_at: Hard delete - all previous tokens deleted when new reset is requested
  },
  (table) => ({
    userIdIdx: index('password_reset_tokens_user_id_idx').on(table.userId),
    tokenIdx: index('password_reset_tokens_token_idx').on(table.token),
    expiresAtIdx: index('password_reset_tokens_expires_at_idx').on(table.expiresAt),
  }),
);

/**
 * DRIZZLE RELATIONS
 * Defines relationships between tables for type-safe joins and queries.
 * These relations enable Drizzle's relational query API.
 */

// Apps -> Users (One-to-Many)
export const appsRelations = relations(apps, ({ many }) => ({
  users: many(users),
}));

// Users -> App (Many-to-One)
// Users -> Tokens (One-to-Many for each token type)
export const usersRelations = relations(users, ({ one, many }) => ({
  app: one(apps, {
    fields: [users.appId],
    references: [apps.id],
  }),
  refreshTokens: many(refreshTokens),
  emailVerificationTokens: many(emailVerificationTokens),
  passwordResetTokens: many(passwordResetTokens),
}));

// Refresh Tokens -> User (Many-to-One)
export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

// Email Verification Tokens -> User (Many-to-One)
export const emailVerificationTokensRelations = relations(
  emailVerificationTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [emailVerificationTokens.userId],
      references: [users.id],
    }),
  }),
);

// Password Reset Tokens -> User (Many-to-One)
export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

