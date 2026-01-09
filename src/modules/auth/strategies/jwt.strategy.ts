import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

/**
 * JWT Payload Interface
 * 
 * Defines the structure of data stored in the JWT token.
 * This payload is created during login and validated on each request.
 */
export interface JwtPayload {
  sub: string; // User ID (subject)
  email: string;
  appId: string;
}

/**
 * JWT Strategy
 * 
 * Passport strategy for validating JWT tokens on protected routes.
 * This strategy:
 * 1. Extracts the token from the Authorization header
 * 2. Verifies the token signature using the secret
 * 3. Validates the user still exists and is active
 * 4. Attaches user data to req.user for use in controllers
 * 
 * Why a separate strategy file?
 * - Separation of concerns: Auth logic separate from service logic
 * - Reusability: Can be used by multiple guards
 * - Testability: Easy to mock and test independently
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      // Extract JWT from Authorization header as Bearer token
      // Format: "Bearer <token>"
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      
      // Secret key for verifying token signature
      // Must match the secret used when creating the token
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-secret',
      
      // Ignore token expiration (we handle it manually if needed)
      ignoreExpiration: false,
    });
  }

  /**
   * Validate JWT Payload
   * 
   * Called automatically by Passport after token signature verification.
   * This method:
   * 1. Receives the decoded JWT payload
   * 2. Validates the user still exists in the database
   * 3. Checks the user is not soft-deleted
   * 4. Returns user data to be attached to req.user
   * 
   * @param payload - Decoded JWT payload (from token)
   * @returns User object (attached to req.user)
   * @throws UnauthorizedException if user not found or deleted
   */
  async validate(payload: JwtPayload) {
    // Extract user ID from token payload
    // 'sub' (subject) is the standard JWT claim for user ID
    const userId = payload.sub;

    try {
      // Verify user still exists and is active
      // This check is critical for security:
      // - Prevents use of tokens after user deletion
      // - Ensures soft-deleted users cannot authenticate
      const user = await this.usersService.findOne(userId);

      // Additional check: Ensure user's email is verified
      // Per .cursorrules: Users cannot login unless is_email_verified = true
      if (!user.isEmailVerified) {
        throw new UnauthorizedException('Email not verified');
      }

      // Return user data to be attached to req.user
      // This object is available in controllers via @CurrentUser() decorator
      return {
        id: user.id,
        email: user.email,
        appId: user.appId,
        role: user.role,
      };
    } catch (error) {
      // If user not found or any other error, reject the token
      throw new UnauthorizedException('Invalid token or user not found');
    }
  }
}


