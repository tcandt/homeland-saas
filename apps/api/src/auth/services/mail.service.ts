import { Injectable, Logger } from '@nestjs/common';

export abstract class MailProvider {
  abstract sendPasswordResetEmail(email: string, token: string): Promise<void>;
  abstract sendWelcomeEmail(email: string): Promise<void>;
  abstract sendEmailVerification(email: string, token: string): Promise<void>;
}

@Injectable()
export class LoggerMailProvider implements MailProvider {
  private readonly logger = new Logger(LoggerMailProvider.name);

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    this.logger.log(`[MAIL STUB] Password reset email sent to ${email}. Token: ${token}`);
  }

  async sendWelcomeEmail(email: string): Promise<void> {
    this.logger.log(`[MAIL STUB] Welcome email sent to ${email}`);
  }

  async sendEmailVerification(email: string, token: string): Promise<void> {
    this.logger.log(`[MAIL STUB] Email verification sent to ${email}. Token: ${token}`);
  }
}
