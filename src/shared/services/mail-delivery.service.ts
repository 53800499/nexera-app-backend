import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}

export interface SendMailResult {
  sent: boolean;
  reason?: string;
}

@Injectable()
export class MailDeliveryService {
  private readonly logger = new Logger(MailDeliveryService.name);

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    return (
      this.config.get<string>('MAIL_ENABLED', 'false') === 'true' &&
      !!this.config.get<string>('SMTP_HOST')
    );
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    if (!this.isEnabled()) {
      this.logger.warn(
        `Email not sent to ${input.to}: SMTP not configured (MAIL_ENABLED=true, SMTP_HOST)`,
      );
      return { sent: false, reason: 'smtp_not_configured' };
    }

    const transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: Number(this.config.get<string>('SMTP_PORT', '587')),
      secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });

    const from =
      this.config.get<string>('SMTP_FROM') ??
      this.config.get<string>('SMTP_USER');

    await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType ?? 'application/octet-stream',
      })),
    });

    return { sent: true };
  }
}
