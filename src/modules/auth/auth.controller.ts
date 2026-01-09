import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

/**
 * Auth Controller
 * 
 * Handles authentication endpoints:
 * - Registration (public)
 * - Login (public)
 * - Logout (protected)
 * 
 * Why separate controller from service?
 * - HTTP-specific concerns (status codes, request/response)
 * - Route definitions and decorators
 * - Request validation (handled by DTOs)
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register new user
   * 
   * Route: POST /auth/register
   * 
   * Creates a new user account and returns authentication tokens.
   * This endpoint is public (no authentication required).
   * 
   * @param registerDto - Registration data
   * @returns Access and refresh tokens
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Login user
   * 
   * Route: POST /auth/login
   * 
   * Validates credentials and returns authentication tokens.
   * This endpoint is public (no authentication required).
   * 
   * @param loginDto - Login credentials
   * @returns Access and refresh tokens
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * Logout user
   * 
   * Route: POST /auth/logout
   * 
   * Revokes the refresh token, preventing further use.
   * This endpoint requires authentication (JWT token).
   * 
   * Note: Access tokens are stateless and cannot be revoked,
   * but they expire quickly (15 minutes).
   * 
   * @param user - Authenticated user (from JWT token)
   * @param body - Request body containing refresh_token
   * @returns Success message
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: { id: string },
    @Body() body: { refresh_token: string },
  ) {
    await this.authService.logout(body.refresh_token, user.id);
    return { message: 'Logged out successfully' };
  }
}


