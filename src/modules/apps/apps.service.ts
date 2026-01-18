import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { Database } from '../../database/database.types';
import { apps } from '../../database/schema';
import { CreateAppDto } from './dto/create-app.dto';

/**
 * Apps Service
 * 
 * Handles all app (tenant) related database operations.
 * This service is responsible for:
 * - App creation with slug uniqueness validation
 * - App lookup by various criteria
 * - Enforcing business rules (e.g., soft delete filtering)
 * 
 * Why separate service from controller?
 * - Separation of concerns: Business logic separate from HTTP handling
 * - Reusability: Can be used by AuthService and other modules
 * - Testability: Easier to unit test without HTTP context
 */
@Injectable()
export class AppsService {
  private readonly logger = new Logger(AppsService.name);

  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: Database,
  ) {}

  /**
   * Create a new app (tenant)
   * 
   * Steps:
   * 1. Check if app already exists (by slug - unique constraint)
   * 2. Insert app into database
   * 
   * Why check slug uniqueness explicitly?
   * - Better error messages: "Slug already exists" vs generic DB error
   * - Prevents partial failures: Catch issue before DB constraint violation
   * - User experience: Clear, actionable error messages
   * 
   * @param data - App creation data (name, slug)
   * @returns Created app (without deleted_at)
   * @throws ConflictException if app with slug already exists
   */
  async create(data: CreateAppDto) {
    // Check if app with this slug already exists
    // This check respects soft deletes - we don't want duplicate slugs even if old app is deleted
    const existingApp = await this.findOneBySlug(data.slug);

    if (existingApp) {
      throw new ConflictException(
        `App with slug "${data.slug}" already exists`,
      );
    }

    // Insert app into database
    // Drizzle returns an array, so we take the first element
    const [newApp] = await this.db
      .insert(apps)
      .values({
        name: data.name,
        slug: data.slug,
      })
      .returning({
        id: apps.id,
        name: apps.name,
        slug: apps.slug,
        createdAt: apps.createdAt,
        updatedAt: apps.updatedAt,
      });

    this.logger.log(`App "${newApp.name}" (${newApp.slug}) created with ID: ${newApp.id}`);

    return newApp;
  }

  /**
   * Find all active apps (excludes soft-deleted apps)
   * 
   * Used for listing all available tenants/apps.
   * This endpoint is public so frontend can show "Select App" dropdown.
   * 
   * Why filter deleted apps?
   * - User experience: Users shouldn't see deleted apps in dropdown
   * - Data integrity: Soft-deleted apps are preserved for audit but hidden from active use
   * 
   * @returns Array of active apps (deleted_at IS NULL)
   */
  async findAll() {
    const allApps = await this.db
      .select({
        id: apps.id,
        name: apps.name,
        slug: apps.slug,
        createdAt: apps.createdAt,
        updatedAt: apps.updatedAt,
      })
      .from(apps)
      .where(isNull(apps.deletedAt)); // Only return non-deleted apps

    return allApps;
  }

  /**
   * Find app by primary key (ID)
   * 
   * Used for app validation and lookups.
   * Respects soft deletes - deleted apps are considered "not found".
   * 
   * @param id - App's UUID
   * @returns App if found
   * @throws NotFoundException if app not found or is deleted
   */
  async findOne(id: string) {
    const [app] = await this.db
      .select({
        id: apps.id,
        name: apps.name,
        slug: apps.slug,
        createdAt: apps.createdAt,
        updatedAt: apps.updatedAt,
      })
      .from(apps)
      .where(
        and(
          eq(apps.id, id),
          isNull(apps.deletedAt), // Only return non-deleted apps
        ),
      )
      .limit(1);

    if (!app) {
      throw new NotFoundException(`App with ID ${id} not found`);
    }

    return app;
  }

  /**
   * Find app by slug
   * 
   * Internal utility method for slug uniqueness checks.
   * This method checks ALL apps (including soft-deleted) to prevent slug conflicts.
   * 
   * Why check deleted apps too?
   * - Slug uniqueness is permanent: Even if app is deleted, slug should remain unique
   * - Prevents confusion: Users can't recreate app with same slug as deleted one
   * 
   * @param slug - App's slug
   * @returns App if found (including soft-deleted), null otherwise
   */
  async findOneBySlug(slug: string) {
    const [app] = await this.db
      .select({
        id: apps.id,
        name: apps.name,
        slug: apps.slug,
        createdAt: apps.createdAt,
        updatedAt: apps.updatedAt,
        deletedAt: apps.deletedAt,
      })
      .from(apps)
      .where(eq(apps.slug, slug.toLowerCase().trim()))
      .limit(1);

    return app || null;
  }
}
