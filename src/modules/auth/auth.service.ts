import {
  Injectable,
  Inject,
  UnauthorizedException,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq, and, isNull, lt } from 'drizzle-orm';
import { Database } from '../../database/database.types';
import {
  users,
  refreshTokens,
  emailVerificationTokens,
} from '../../database/schema';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

/**
 * Auth Service
 * 
 * Handles authentication logic:
 * - User validation (login)
 * - Token generation (access + refresh)
 * - User registration
 * - Token management (logout)
 * 
 * Why separate from UsersService?
 * - Single Responsibility: Auth logic vs User CRUD
 * - Security: Centralized authentication logic
 * - Scalability: Can add OAuth, 2FA, etc. without bloating UsersService
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject('DRIZZLE_DB')
    private readonly db: Database,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Validate user credentials
   * 
   * Used during login to verify email/password combination.
   * Enforces security rules:
   * - Email must be verified
   * - User must not be soft-deleted
   * 
   * @param email - User's email
   * @param password - Plain text password
   * @param appId - Application ID (tenant)
   * @returns User if credentials are valid
   * @throws UnauthorizedException if credentials are invalid or user cannot login
   */
  async validateUser(email: string, password: string, appId: string) {
    // Find user by email and app_id
    const user = await this.usersService.findByEmail(email, appId);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Per .cursorrules: Users cannot login if deleted_at IS NOT NULL
    if (user.deletedAt) {
      throw new UnauthorizedException('Account has been deleted');
    }

    // Verify password using bcrypt
    const isPasswordValid = await this.usersService.verifyPassword(
      password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Per .cursorrules: Users cannot login unless is_email_verified = true
    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Email not verified. Please check your email for the verification link.',
      );
    }

    return user;
  }

  /**
   * Generate JWT tokens (access + refresh)
   * 
   * Creates both access token (short-lived) and refresh token (long-lived).
   * Refresh token is stored in database for revocation capability.
   * 
   * @param user - Authenticated user object
   * @returns Object containing access_token and refresh_token
   */
  async generateTokens(user: { id: string; email: string; appId: string }) {
    // Create JWT payload
    // 'sub' (subject) is the standard JWT claim for user ID
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      appId: user.appId,
    };

    // Generate access token (short-lived, 15 minutes default)
    // Access tokens are stateless and don't need database storage
    const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: expiresIn as any,
    });

    // Generate refresh token (long-lived, 7 days default)
    // Refresh tokens are stored in DB for revocation
    const refreshTokenValue = randomUUID(); // Generate unique token
    const refreshTokenExpiresAt = new Date();
    refreshTokenExpiresAt.setDate(
      refreshTokenExpiresAt.getDate() +
        parseInt(process.env.JWT_REFRESH_EXPIRES_IN?.replace('d', '') || '7'),
    );

    // Store refresh token in database
    // This allows us to revoke tokens on logout
    await this.db.insert(refreshTokens).values({
      userId: user.id,
      token: refreshTokenValue,
      expiresAt: refreshTokenExpiresAt,
    });

    return {
      access_token: accessToken,
      refresh_token: refreshTokenValue,
    };
  }

  /**
   * Login user
   * 
   * Validates credentials and generates tokens.
   * 
   * @param loginDto - Login credentials (email, password, app_id)
   * @returns Access and refresh tokens
   */
  async login(loginDto: LoginDto) {
    // Validate credentials
    const user = await this.validateUser(
      loginDto.email,
      loginDto.password,
      loginDto.app_id,
    );

    // Generate tokens
    return this.generateTokens(user);
  }


  /**
   * Register new user
   * 
   * Creates a new user account with email verification flow.
   * Uses a database transaction to ensure atomicity:
   * - If user creation fails, nothing is committed
   * - If token creation fails, user creation is rolled back
   * - If email sending fails, user and token are still created (email can be resent)
   * 
   * Why use a Transaction?
   * - Atomicity: All operations succeed or all fail together
   * - Data Integrity: Prevents partial state (user without token, etc.)
   * - Consistency: Ensures database remains in valid state
   * - Error Recovery: Automatic rollback on any failure
   * 
   * Transaction Flow:
   * 1. Check if user exists (outside transaction - read-only check)
   * 2. Hash password (outside transaction - CPU operation)
   * 3. Begin transaction:
   *    a. Insert user
   *    b. Insert verification token
   * 4. Send email (outside transaction - external service)
   * 
   * @param registerDto - Registration data (email, password, app_id)
   * @returns Success message (no tokens - user must verify email first)
   */
  async register(registerDto: RegisterDto) {
    // Pre-transaction checks (outside transaction for better performance)
    // Check if user already exists using composite key (app_id + email)
    const existingUser = await this.usersService.findByEmail(
      registerDto.email,
      registerDto.app_id,
    );

    if (existingUser) {
      throw new ConflictException(
        `User with email ${registerDto.email} already exists in this app`,
      );
    }

    // Hash password before transaction (CPU operation, not DB operation)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(registerDto.password, saltRounds);

    // Use database transaction to ensure atomicity
    // All database operations must succeed or all will be rolled back
    return await this.db.transaction(async (tx) => {
      // Step 1: Create user (is_email_verified: false by default)
      // Using transaction context (tx) instead of global db instance
      const [newUser] = await tx
        .insert(users)
        .values({
          email: registerDto.email,
          passwordHash,
          appId: registerDto.app_id,
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

      // Step 2: Create verification token within the same transaction
      // Token is generated securely and stored with expiration
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await tx.insert(emailVerificationTokens).values({
        userId: newUser.id,
        token,
        expiresAt,
      });

      // Transaction commits here if no errors occurred
      // Now send email (outside transaction - external service)
      // If email fails, user and token are still created (email can be resent)
      await this.mailService.sendVerificationEmail(newUser.email, token);

      this.logger.log(
        `User ${newUser.email} registered successfully. Verification email sent.`,
      );

      // Return success message (no tokens - user must verify email first)
      return {
        message:
          'Registration successful! Please check your email to verify your account.',
        email: newUser.email, // Include email for testing purposes
      };
    });
  }

  /**
   * Logout user
   * 
   * Removes the refresh token from database.
   * Access tokens cannot be revoked (they're stateless),
   * but they expire quickly (15 minutes).
   * 
   * @param refreshToken - Refresh token to revoke
   * @param userId - User ID (from JWT payload)
   */
  async logout(refreshToken: string, userId: string) {
    // Delete refresh token from database
    // This prevents the token from being used again
    await this.db
      .delete(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, refreshToken),
          eq(refreshTokens.userId, userId),
        ),
      );

    this.logger.log(`User ${userId} logged out successfully`);
  }

  /**
   * Verify Email Address
   * 
   * Verifies a user's email address using a verification token.
   * 
   * Steps:
   * 1. Find token in database
   * 2. Verify token hasn't expired
   * 3. Update user's is_email_verified to true
   * 4. Hard delete the verification token (as per .cursorrules)
   * 
   * @param token - Verification token from email link
   * @returns Success message
   * @throws BadRequestException if token is invalid or expired
   */
  async verifyEmail(token: string) {
    // Find token in database
    const [verificationToken] = await this.db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.token, token))
      .limit(1);

    if (!verificationToken) {
      throw new BadRequestException('Invalid verification token');
    }

    // Check if token has expired
    if (new Date() > verificationToken.expiresAt) {
      // Delete expired token
      await this.db
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.id, verificationToken.id));

      throw new BadRequestException(
        'Verification token has expired. Please request a new verification email.',
      );
    }

    // Use transaction to ensure atomicity
    // Both user update and token deletion must succeed together
    await this.db.transaction(async (tx) => {
      // Update user's email verification status
      await tx
        .update(users)
        .set({ isEmailVerified: true })
        .where(eq(users.id, verificationToken.userId));

      // Hard delete the verification token (as per .cursorrules)
      // Per rules: "Upon successful verification, DELETE ALL email_verification_tokens for that user"
      await tx
        .delete(emailVerificationTokens)
        .where(eq(emailVerificationTokens.userId, verificationToken.userId));
    });

    this.logger.log(
      `Email verified for user ${verificationToken.userId}`,
    );

    return {
      message: 'Email verified successfully! You can now log in.',
    };
  }
}

