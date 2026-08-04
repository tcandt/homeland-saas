import { Injectable } from '@nestjs/common';
import { SettingScope } from '@prisma/client';
import nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma.service';

export abstract class MailProvider {
  abstract sendPasswordResetEmail(email: string, token: string, tenantId: string): Promise<void>;
  abstract sendWelcomeEmail(email: string, tenantId: string): Promise<void>;
  abstract sendEmailVerification(email: string, token: string, tenantId: string): Promise<void>;
}

@Injectable()
export class DbSmtpMailProvider implements MailProvider {
  constructor(private readonly prisma: PrismaService) {}

  private async getSettings(tenantId: string) {
    const record = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.TENANT,
          ownerId: tenantId,
          key: 'email-provider',
        },
      },
    });
    const settings = (record?.value as any) || {};

    if (settings.enabled === false || !settings.smtpHost) {
      throw new Error('Email provider is not configured');
    }

    return settings;
  }

  private async sendMail(tenantId: string, to: string, subject: string, message: string) {
    const settings = await this.getSettings(tenantId);
    const transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: Number(settings.smtpPort || 587),
      secure: Boolean(settings.smtpSecure),
      auth: settings.smtpUser
        ? {
            user: settings.smtpUser,
            pass: settings.smtpPassword || '',
          }
        : undefined,
    });
    const fromName = settings.fromName || 'HomeLand';
    const fromEmail = settings.fromEmail || settings.smtpUser;
    if (!fromEmail) throw new Error('Email sender is not configured');

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text: message,
      html: settings.sendHtml === false ? undefined : message.replace(/\n/g, '<br />'),
    });
  }

  async sendPasswordResetEmail(email: string, token: string, tenantId: string): Promise<void> {
    await this.sendMail(
      tenantId,
      email,
      'HomeLand password reset',
      `Use this token to reset your password:\n\n${token}\n\nThis token expires in 1 hour.`,
    );
  }

  async sendWelcomeEmail(email: string, tenantId: string): Promise<void> {
    await this.sendMail(tenantId, email, 'Welcome to HomeLand', 'Welcome to HomeLand.');
  }

  async sendEmailVerification(email: string, token: string, tenantId: string): Promise<void> {
    await this.sendMail(
      tenantId,
      email,
      'Verify your HomeLand email',
      `Use this token to verify your email:\n\n${token}`,
    );
  }
}
