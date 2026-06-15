import { Injectable } from '@nestjs/common';
import { MailDeliveryService } from '../../../shared/services/mail-delivery.service';

export interface SendInvoiceMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  pdf: Buffer;
  filename: string;
}

@Injectable()
export class InvoiceMailService {
  constructor(private readonly mail: MailDeliveryService) {}

  isEnabled() {
    return this.mail.isEnabled();
  }

  send(input: SendInvoiceMailInput) {
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
