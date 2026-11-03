import { Injectable, Logger } from '@nestjs/common';
import { MailDeliveryService } from '../../../shared/services/mail-delivery.service';
import { EmailTemplateService } from '../../settings/services/email-template.service';
import { EmailTemplateType } from '../../settings/enums/email-template-type.enum';

@Injectable()
export class RecurringInvoiceNotificationService {
  private readonly logger = new Logger(RecurringInvoiceNotificationService.name);

  constructor(
    private readonly mail: MailDeliveryService,
    private readonly emailTemplateService: EmailTemplateService,
  ) {}

  isEnabled(): boolean {
    return this.mail.isEnabled();
  }

  async notifyDraftReady(input: {
    tenantId: string;
    to: string;
    clientName: string;
    templateNumber: string;
    draftNumber: string;
    draftId: string;
    executionDate: Date;
  }): Promise<{ sent: boolean; reason?: string }> {
    if (!this.isEnabled()) {
      this.logger.warn(
        `Recurring invoice notification skipped (SMTP not configured)`,
      );
      return { sent: false, reason: 'smtp_not_configured' };
    }

    const execLabel = input.executionDate.toLocaleDateString('fr-FR');
    const mailContent = await this.emailTemplateService.render(
      input.tenantId,
      EmailTemplateType.RECURRING_INVOICE,
      {
        clientName: input.clientName,
        templateNumber: input.templateNumber,
        draftNumber: input.draftNumber,
        draftId: input.draftId,
        executionDate: execLabel,
      },
    );

    return this.mail.send({
      to: input.to,
      subject: mailContent.subject,
      text: mailContent.body,
    });
  }
}

