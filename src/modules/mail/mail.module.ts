import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Mail Module
 * 
 * Provides email sending functionality.
 * Exports MailService for use in other modules (e.g., AuthModule).
 */
@Module({
  providers: [MailService],
  exports: [MailService], // Export for use in other modules
})
export class MailModule {}
