import { Module } from '@nestjs/common';
import { AppsController } from './apps.controller';
import { AppsService } from './apps.service';

/**
 * Apps Module
 * 
 * Provides app (tenant) management functionality.
 * 
 * Exports:
 * - AppsService: Can be used by other modules (e.g., AuthModule) to validate app existence
 * 
 * Why export AppsService?
 * - Reusability: AuthService needs to validate appId during registration
 * - Separation of concerns: Keep app validation logic in AppsService
 * - Consistency: Single source of truth for app-related queries
 */
@Module({
  controllers: [AppsController],
  providers: [AppsService],
  exports: [AppsService], // Export service so other modules can use it
})
export class AppsModule {}
