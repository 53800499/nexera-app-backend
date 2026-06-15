import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailTemplateService } from '../../settings/services/email-template.service';
import { EmailTemplateType } from '../../settings/enums/email-template-type.enum';

@Injectable()
export class RecurringInvoiceNotificationService {
  private readonly logger = new Logger(RecurringInvoiceNotificationService.name);

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
      subject: mailContent.subject,
      text: mailContent.body,
    });

    return { sent: true };
  }
}
