import {
  Injectable,
  Inject,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq, and, isNull } from 'drizzle-orm';
import { Database } from '../../database/database.types';
import { users, refreshTokens } from '../../database/schema';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { randomUUID } from 'crypto';

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
  ) {}

  /**
   * Validate user credentials
   * 
   * Used during login to verify email/password combination.
   * 
   * @param email - User's email
   * @param password - Plain text password
   * @param appId - Application ID (tenant)
   * @returns User if credentials are valid, null otherwise
   * @throws UnauthorizedException if credentials are invalid
   */
  async validateUser(email: string, password: string, appId: string) {
    // Find user by email and app_id
    const user = await this.usersService.findByEmail(email, appId);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
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
      throw new UnauthorizedException('Email not verified');
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
   * Creates a new user account and immediately generates tokens.
   * Note: Email verification is handled separately (Phase 4).
   * 
   * @param registerDto - Registration data (email, password, app_id)
   * @returns Access and refresh tokens
   */
  async register(registerDto: RegisterDto) {
    // Create user (this will hash the password)
    const user = await this.usersService.create(registerDto);

    // Generate tokens immediately after registration
    // In production, you might want to require email verification first
    return this.generateTokens({
      id: user.id,
      email: user.email,
      appId: user.appId,
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
}

