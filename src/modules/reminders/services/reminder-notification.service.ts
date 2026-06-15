import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { ReminderLevel } from '../enums/reminder-level.enum';
import { EmailTemplateService } from '../../settings/services/email-template.service';
import { EmailTemplateType } from '../../settings/enums/email-template-type.enum';

export interface ReminderEmailInput {
  to: string;
  cc?: string[];
  subject: string;
  body: string;
  level: ReminderLevel;
  invoiceNumber: string;
  clientName: string;
}

const LEVEL_TEMPLATE_MAP: Record<ReminderLevel, EmailTemplateType> = {
  [ReminderLevel.LEVEL_1]: EmailTemplateType.REMINDER_LEVEL_1,
  [ReminderLevel.LEVEL_2]: EmailTemplateType.REMINDER_LEVEL_2,
  [ReminderLevel.LEVEL_3]: EmailTemplateType.REMINDER_LEVEL_3,
};

@Injectable()
export class ReminderNotificationService {
  private readonly logger = new Logger(ReminderNotificationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {}

  isEnabled(): boolean {
    return (
      this.config.get<string>('MAIL_ENABLED', 'false') === 'true' &&
      !!this.config.get<string>('SMTP_HOST')
    );
  }

  async buildAutoEmail(
    tenantId: string,
    level: ReminderLevel,
    variables: Record<string, string | number | undefined | null>,
  ) {
    return this.emailTemplateService.render(
      tenantId,
      LEVEL_TEMPLATE_MAP[level],
      variables,
    );
  }

  async sendEmail(
    input: ReminderEmailInput,
  ): Promise<{ sent: boolean; reason?: string }> {
    if (!this.isEnabled()) {
      this.logger.warn('Reminder email skipped (SMTP not configured)');
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
      cc: input.cc?.length ? input.cc.join(', ') : undefined,
      subject: input.subject,
      text: input.body,
    });

    return { sent: true };
  }
}
