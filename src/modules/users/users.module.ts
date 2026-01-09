import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

/**
 * Users Module
 * 
 * Provides user management functionality.
 * Exports UsersService so it can be used by AuthModule.
 * 
 * Why export the service?
 * - AuthModule needs to create users during registration
 * - Avoids circular dependencies (AuthModule imports UsersModule, not vice versa)
 * - Follows NestJS module communication best practices
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Export service for use in other modules (e.g., AuthModule)
})
export class UsersModule {}


