import { ConfigService } from '@nestjs/config';
import { MailDeliveryService } from './mail-delivery.service';
import * as nodemailer from 'nodemailer';

jest.mock('nodemailer');

describe('MailDeliveryService', () => {
  let service: MailDeliveryService;
  let mockConfigService: Partial<ConfigService>;
  const mockSendMail = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail.mockResolvedValue({ messageId: 'msg-123' }),
    });
  });

  describe('when SMTP is disabled', () => {
    beforeEach(() => {
      mockConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => {
          if (key === 'MAIL_ENABLED') return 'false';
          if (key === 'SMTP_HOST') return '';
          return defaultValue;
        }),
      };
      service = new MailDeliveryService(mockConfigService as ConfigService);
    });

    it('isEnabled() returns false', () => {
      expect(service.isEnabled()).toBe(false);
    });

    it('send() returns { sent: false, reason: "smtp_not_configured" } without calling nodemailer', async () => {
      const result = await service.send({
        to: 'client@example.com',
        subject: 'Test Subject',
        text: 'Test Body',
      });

      expect(result).toEqual({ sent: false, reason: 'smtp_not_configured' });
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  describe('when SMTP is enabled', () => {
    beforeEach(() => {
      mockConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => {
          const map: Record<string, string> = {
            MAIL_ENABLED: 'true',
            SMTP_HOST: 'smtp.example.com',
            SMTP_PORT: '587',
            SMTP_SECURE: 'false',
            SMTP_USER: 'user@example.com',
            SMTP_PASS: 'secret',
            SMTP_FROM: 'noreply@nexera.app',
          };
          return map[key] ?? defaultValue;
        }),
      };
      service = new MailDeliveryService(mockConfigService as ConfigService);
    });

    it('isEnabled() returns true', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('send() initializes nodemailer and sends email with attachments', async () => {
      const result = await service.send({
        to: 'recipient@example.com',
        subject: 'Facture FAC-2026-000001',
        text: 'Veuillez trouver votre facture.',
        html: '<p>Veuillez trouver votre facture.</p>',
        attachments: [
          {
            filename: 'FAC-2026-000001.pdf',
            content: Buffer.from('pdf-content'),
            contentType: 'application/pdf',
          },
        ],
      });

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'user@example.com',
          pass: 'secret',
        },
      });

      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'noreply@nexera.app',
        to: 'recipient@example.com',
        subject: 'Facture FAC-2026-000001',
        text: 'Veuillez trouver votre facture.',
        html: '<p>Veuillez trouver votre facture.</p>',
        attachments: [
          {
            filename: 'FAC-2026-000001.pdf',
            content: Buffer.from('pdf-content'),
            contentType: 'application/pdf',
          },
        ],
      });

      expect(result).toEqual({ sent: true });
    });
  });
});
