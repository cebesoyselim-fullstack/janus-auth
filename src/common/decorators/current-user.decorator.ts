import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @CurrentUser() Decorator
 * 
 * Extracts the authenticated user from the request object.
 * This decorator works with Passport JWT strategy which attaches
 * the user object to `req.user` after successful token validation.
 * 
 * Usage in controllers:
 * ```typescript
 * @Get('me')
 * getProfile(@CurrentUser() user: User) {
 *   return user;
 * }
 * ```
 * 
 * Why a custom decorator?
 * - Cleaner code: No need to access `req.user` manually
 * - Type-safe: Can specify the user type
 * - Reusable: Works across all controllers
 * - Testable: Easy to mock in unit tests
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    // Get the request object from the execution context
    // Works with both HTTP (Express) and GraphQL contexts
    const request = ctx.switchToHttp().getRequest();
    
    // Return the user object attached by JWT strategy
    // The JwtStrategy's validate() method populates req.user
    return request.user;
  },
);


