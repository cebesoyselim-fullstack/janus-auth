import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

/**
 * Auth Module
 * 
 * Provides authentication functionality:
 * - JWT token generation and validation
 * - User login and registration
 * - Token management (logout)
 * 
 * Module Dependencies:
 * - UsersModule: For user creation and lookup
 * - PassportModule: For authentication strategies
 * - JwtModule: For token generation and validation
 * 
 * Why async JwtModule configuration?
 * - Allows injection of ConfigService
 * - Loads secrets from environment variables
 * - More secure than hardcoded values
 */
@Module({
  imports: [
    // Import UsersModule to use UsersService
    // UsersModule exports UsersService, avoiding circular dependency
    UsersModule,
    
    // Import MailModule to send verification emails
    MailModule,
    
    // Passport module for authentication strategies
    PassportModule.register({ defaultStrategy: 'jwt' }),
    
    // JWT module configured asynchronously to inject ConfigService
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService): JwtModuleOptions => {
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN') || '15m';
        return {
          // Secret key for signing tokens
          // In production, use a strong, randomly generated secret
          secret: configService.get<string>('JWT_SECRET') || 'default-secret',
          
          // Default expiration for tokens
          // Can be overridden per token generation
          signOptions: {
            expiresIn: expiresIn as any,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy, // JWT validation strategy for Passport
  ],
  exports: [AuthService], // Export for use in other modules if needed
})
export class AuthModule {}

