import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

/**
 * Mail Service
 * 
 * Handles email sending functionality for the application.
 * Supports both production SMTP and development/test modes.
 * 
 * Why a separate mail service?
 * - Separation of concerns: Email logic separate from business logic
 * - Reusability: Can be used by multiple modules (Auth, Password Reset, etc.)
 * - Testability: Easy to mock for unit tests
 * - Flexibility: Can switch email providers without changing business logic
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;
  private readonly fromEmail: string;
  private readonly appUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
    this.fromEmail =
      this.configService.get<string>('MAIL_FROM') ||
      'noreply@janus-auth.local';
    this.appUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';
  }

  /**
   * Initialize Email Transporter
   * 
   * Sets up nodemailer transporter based on environment configuration.
   * 
   * Development Mode:
   * - If no SMTP config is provided, uses Ethereal Email (fake SMTP)
   * - Logs the email link to console for easy testing
   * 
   * Production Mode:
   * - Uses configured SMTP settings from environment variables
   */
  private async initializeTransporter() {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD');
    const smtpSecure = this.configService.get<boolean>('SMTP_SECURE', false);

    // Production: Use real SMTP if configured
    if (smtpHost && smtpPort && smtpUser && smtpPassword) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });

      this.logger.log('Mail service initialized with SMTP configuration');
      return;
    }

    // Development: Use Ethereal Email (fake SMTP for testing)
    // This creates a test account and logs credentials to console
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      this.logger.warn(
        '⚠️  Development Mode: Using Ethereal Email (fake SMTP)',
      );
      this.logger.warn(
        `📧 Test Account: ${testAccount.user} / ${testAccount.pass}`,
      );
      this.logger.warn(
        '💡 View emails at: https://ethereal.email',
      );
    } catch (error) {
      // Fallback: Log to console only (no actual email sending)
      this.logger.warn(
        '⚠️  Mail service running in console-only mode (no SMTP configured)',
      );
      this.transporter = null as any; // Will be handled in sendMail
    }
  }

  /**
   * Send Email Verification Email
   * 
   * Sends an email with a verification link to the user.
   * 
   * @param email - Recipient email address
   * @param token - Verification token (to be included in the link)
   * @returns Promise that resolves when email is sent
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${this.appUrl}/auth/verify-email?token=${token}`;

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: 'Verify Your Email Address',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h1 style="color: #4CAF50;">Welcome to Janus Auth!</h1>
              <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" 
                   style="background-color: #4CAF50; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              <p style="color: #666; font-size: 12px;">
                Or copy and paste this link into your browser:<br>
                <a href="${verificationUrl}" style="color: #4CAF50; word-break: break-all;">
                  ${verificationUrl}
                </a>
              </p>
              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                This link will expire in 24 hours. If you didn't create an account, please ignore this email.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
        Welcome to Janus Auth!
        
        Thank you for registering. Please verify your email address by visiting:
        ${verificationUrl}
        
        This link will expire in 24 hours. If you didn't create an account, please ignore this email.
      `,
    };

    try {
      // If transporter is not initialized (console-only mode), just log
      if (!this.transporter) {
        this.logger.log('📧 [CONSOLE MODE] Verification Email:');
        this.logger.log(`   To: ${email}`);
        this.logger.log(`   Verification URL: ${verificationUrl}`);
        return;
      }

      // Send email
      const info = await this.transporter.sendMail(mailOptions);

      // In development with Ethereal, log the preview URL
      if (info.messageId && nodemailer.getTestMessageUrl) {
        const previewUrl = await nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          this.logger.log(`📧 Email sent! Preview: ${previewUrl}`);
        } else {
          this.logger.log(`📧 Email sent! Message ID: ${info.messageId}`);
        }
      } else {
        this.logger.log(`📧 Verification email sent to ${email}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}:`, error);
      // Don't throw - allow registration to complete even if email fails
      // In production, you might want to queue the email for retry
      this.logger.warn(
        `⚠️  Registration completed, but email sending failed. Verification URL: ${verificationUrl}`,
      );
    }
  }
}
