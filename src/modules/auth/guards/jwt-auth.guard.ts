import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Authentication Guard
 * 
 * Protects routes by requiring a valid JWT token.
 * Extends Passport's AuthGuard which automatically:
 * 1. Extracts the token using the configured strategy
 * 2. Validates the token using JwtStrategy
 * 3. Attaches user data to req.user if valid
 * 4. Throws UnauthorizedException if invalid
 * 
 * Usage:
 * ```typescript
 * @UseGuards(JwtAuthGuard)
 * @Get('protected')
 * getProtectedData() { ... }
 * ```
 * 
 * Why a separate guard file?
 * - Can add custom logic (e.g., role checking) later
 * - Consistent naming and import path
 * - Easy to extend with additional guards (e.g., RolesGuard)
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Optional: Override canActivate for custom logic
   * 
   * For now, we use the default Passport behavior.
   * This method can be extended to add:
   * - Role-based access control
   * - IP whitelisting
   * - Rate limiting per user
   */
  canActivate(context: ExecutionContext) {
    // Call parent's canActivate to use default Passport JWT validation
    return super.canActivate(context);
  }
}


