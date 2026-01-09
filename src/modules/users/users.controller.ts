import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Users Controller
 * 
 * Handles HTTP requests related to user management.
 * All endpoints are protected with JWT authentication.
 * 
 * Why protect all endpoints?
 * - Security: User data should only be accessible to authenticated users
 * - Consistency: All user operations require authentication
 * - Future-proof: Easy to add role-based access control later
 */
@Controller('users')
@UseGuards(JwtAuthGuard) // Protect all endpoints in this controller
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get current user profile
   * 
   * Returns the authenticated user's information.
   * The @CurrentUser() decorator extracts the user from the JWT token.
   * 
   * Route: GET /users/me
   * 
   * @param user - Authenticated user (injected by @CurrentUser() decorator)
   * @returns User profile data
   */
  @Get('me')
  getProfile(@CurrentUser() user: { id: string; email: string; appId: string }) {
    // Return user profile
    // The user object is populated by JwtStrategy.validate() method
    return {
      id: user.id,
      email: user.email,
      appId: user.appId,
    };
  }
}


