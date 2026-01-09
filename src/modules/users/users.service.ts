import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { Database } from '../../database/database.types';
import { users } from '../../database/schema';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';

/**
 * Users Service
 * 
 * Handles all user-related database operations.
 * This service is responsible for:
 * - User creation with password hashing
 * - User lookup by various criteria
 * - Enforcing business rules (e.g., email uniqueness per app)
 * 
 * Why separate service from controller?
 * - Separation of concerns: Business logic separate from HTTP handling
 * - Reusability: Can be used by AuthService and other modules
 * - Testability: Easier to unit test without HTTP context
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: Database,
  ) {}

  /**
   * Create a new user
   * 
   * Steps:
   * 1. Check if user already exists (by email + app_id composite key)
   * 2. Hash the password using bcrypt (never store plain passwords)
   * 3. Insert user into database
   * 
   * @param data - User creation data (email, password, app_id)
   * @returns Created user (without password hash)
   * @throws ConflictException if user already exists
   */
  async create(data: CreateUserDto) {
    // Check if user already exists using composite key (app_id + email)
    // This enforces the multi-tenancy requirement
    const existingUser = await this.findByEmail(data.email, data.app_id);
    
    if (existingUser) {
      throw new ConflictException(
        `User with email ${data.email} already exists in this app`,
      );
    }

    // Hash password with bcrypt
    // Salt rounds: 10 is a good balance between security and performance
    // Higher rounds = more secure but slower (exponential time increase)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(data.password, saltRounds);

    // Insert user into database
    // Drizzle returns an array, so we take the first element
    const [newUser] = await this.db
      .insert(users)
      .values({
        email: data.email,
        passwordHash,
        appId: data.app_id,
        role: 'user', // Default role
        isEmailVerified: false, // Email verification happens after registration
      })
      .returning({
        id: users.id,
        email: users.email,
        appId: users.appId,
        role: users.role,
        isEmailVerified: users.isEmailVerified,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return newUser;
  }

  /**
   * Find user by email and app_id (composite key lookup)
   * 
   * This method respects soft deletes by filtering out deleted users.
   * Used for login and registration checks.
   * 
   * @param email - User's email address
   * @param appId - Application ID (tenant identifier)
   * @returns User if found, null otherwise
   */
  async findByEmail(email: string, appId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email.toLowerCase().trim()),
          eq(users.appId, appId),
          isNull(users.deletedAt), // Only return non-deleted users
        ),
      )
      .limit(1);

    return user || null;
  }

  /**
   * Find user by primary key (ID)
   * 
   * Used for JWT token validation and profile lookups.
   * Also respects soft deletes.
   * 
   * @param id - User's UUID
   * @returns User if found, null otherwise
   * @throws NotFoundException if user not found (for better error handling)
   */
  async findOne(id: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, id),
          isNull(users.deletedAt), // Only return non-deleted users
        ),
      )
      .limit(1);

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  /**
   * Verify password against stored hash
   * 
   * Utility method for password verification during login.
   * Uses bcrypt.compare() which handles salt extraction automatically.
   * 
   * @param plainPassword - Password from login request
   * @param hashedPassword - Stored password hash from database
   * @returns true if password matches, false otherwise
   */
  async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
}


