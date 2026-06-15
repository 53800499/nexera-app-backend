import { Injectable } from '@nestjs/common';
import { MailDeliveryService } from '../../../shared/services/mail-delivery.service';

export interface SendQuotationMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  pdf: Buffer;
  filename: string;
}

export interface SendQuotationMailResult {
  sent: boolean;
  reason?: string;
}

@Injectable()
export class QuotationMailService {
  constructor(private readonly mail: MailDeliveryService) {}

  isEnabled(): boolean {
    return this.mail.isEnabled();
  }

  send(input: SendQuotationMailInput): Promise<SendQuotationMailResult> {
    return this.mail.send({
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: [
        {
          filename: input.filename,
          content: input.pdf,
          contentType: 'application/pdf',
        },
      ],
    });
  }
}
