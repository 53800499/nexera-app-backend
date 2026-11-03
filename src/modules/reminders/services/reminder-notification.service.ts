import { Injectable, Logger } from '@nestjs/common';
import { MailDeliveryService } from '../../../shared/services/mail-delivery.service';
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
    private readonly mail: MailDeliveryService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {}

  isEnabled(): boolean {
    return this.mail.isEnabled();
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

    return this.mail.send({
      to: input.to,
      subject: input.subject,
      text: input.body,
    });
  }
}

