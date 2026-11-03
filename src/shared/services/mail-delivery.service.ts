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
  messageId?: string;
  previewUrl?: string | false;
}

@Injectable()
export class MailDeliveryService {
  private readonly logger = new Logger(MailDeliveryService.name);
  private etherealTransporter: any = null;

  constructor(private readonly config: ConfigService) {}

  isEnabled(): boolean {
    const mailEnabled = this.config.get<string>('MAIL_ENABLED', 'false') === 'true';
    const hasHost = !!this.config.get<string>('SMTP_HOST');
    const hasBrevoApi = !!this.config.get<string>('BREVO_API_KEY');
    const isEthereal = this.config.get<string>('MAIL_DRIVER') === 'ethereal';
    return mailEnabled && (hasHost || hasBrevoApi || isEthereal);
  }

  getDriver(): 'smtp' | 'brevo' | 'ethereal' | 'none' {
    if (!this.isEnabled()) return 'none';
    if (this.config.get<string>('BREVO_API_KEY') || this.config.get<string>('MAIL_DRIVER') === 'brevo') {
      return 'brevo';
    }
    if (this.config.get<string>('MAIL_DRIVER') === 'ethereal' || !this.config.get<string>('SMTP_HOST')) {
      return 'ethereal';
    }
    return 'smtp';
  }

  private parseSender(fromRaw: string): { name: string; email: string } {
    const match = fromRaw.match(/^(.*?)<(.+?)>$/);
    if (match) {
      return {
        name: match[1].trim().replace(/^["']|["']$/g, '') || 'Nexera ERP',
        email: match[2].trim(),
      };
    }
    return {
      name: 'Nexera ERP',
      email: fromRaw.trim(),
    };
  }

  private async sendViaBrevoHttp(input: SendMailInput, apiKey: string): Promise<SendMailResult> {
    const fromRaw =
      this.config.get<string>('SMTP_FROM') ??
      this.config.get<string>('SMTP_USER') ??
      'noreply@nexera.erp';
    const sender = this.parseSender(fromRaw);

    const payload: Record<string, any> = {
      sender,
      to: [{ email: input.to }],
      subject: input.subject,
      textContent: input.text,
      ...(input.html ? { htmlContent: input.html } : {}),
      ...(input.attachments?.length
        ? {
            attachment: input.attachments.map((a) => ({
              name: a.filename,
              content: a.content.toString('base64'),
            })),
          }
        : {}),
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey.trim(),
      },
      body: JSON.stringify(payload),
    });

    const data: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errMsg = data?.message || `HTTP ${response.status}`;
      throw new Error(`Brevo API error: ${errMsg}`);
    }

    this.logger.log(`Email envoyé avec succès via Brevo HTTPS à ${input.to} (id: ${data?.messageId || 'ok'})`);
    return {
      sent: true,
      messageId: data?.messageId,
      previewUrl: false,
    };
  }

  private async getOrCreateTransporter(): Promise<{ transporter: any; from: string; driver: string }> {
    const driver = this.getDriver();

    if (driver === 'ethereal') {
      if (!this.etherealTransporter) {
        this.logger.log('Initialisation du compte de test Ethereal pour l\'envoi d\'emails...');
        const testAccount = await (nodemailer as any).createTestAccount?.() || {
          user: 'test@ethereal.email',
          pass: 'secret',
          smtp: { host: 'smtp.ethereal.email', port: 587, secure: false },
        };

        this.etherealTransporter = nodemailer.createTransport({
          host: testAccount.smtp?.host || 'smtp.ethereal.email',
          port: testAccount.smtp?.port || 587,
          secure: testAccount.smtp?.secure || false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.logger.log(`Compte Ethereal prêt (utilisateur: ${testAccount.user})`);
      }
      return {
        transporter: this.etherealTransporter,
        from: this.config.get<string>('SMTP_FROM') || 'noreply@nexera.erp',
        driver: 'ethereal',
      };
    }

    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS');

    const transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: Number(this.config.get<string>('SMTP_PORT', '587')),
      secure: this.config.get<string>('SMTP_SECURE', 'false') === 'true',
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      ...(smtpUser ? { auth: { user: smtpUser, pass: smtpPass } } : {}),
    });

    const from =
      this.config.get<string>('SMTP_FROM') ??
      this.config.get<string>('SMTP_USER') ??
      'noreply@nexera.erp';

    return { transporter, from, driver: 'smtp' };
  }

  async verifyConnection(): Promise<{ ok: boolean; message: string; driver: string }> {
    if (!this.isEnabled()) {
      return {
        ok: false,
        message: 'Le service email n\'est pas activé (MAIL_ENABLED=false ou hôte SMTP non renseigné).',
        driver: 'none',
      };
    }

    const driver = this.getDriver();
    if (driver === 'brevo') {
      return {
        ok: true,
        message: 'Passerelle API HTTPS Brevo activée.',
        driver: 'brevo',
      };
    }

    try {
      const { transporter } = await this.getOrCreateTransporter();
      if (typeof transporter.verify === 'function') {
        await transporter.verify();
      }
      return {
        ok: true,
        message: `Connexion au serveur email (${driver.toUpperCase()}) établie avec succès.`,
        driver,
      };
    } catch (err: any) {
      this.logger.error(`Vérification SMTP échouée : ${err.message}`);
      return {
        ok: false,
        message: `Échec de connexion au serveur SMTP : ${err.message}`,
        driver,
      };
    }
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    if (!this.isEnabled()) {
      this.logger.warn(
        `Email not sent to ${input.to}: SMTP not configured (MAIL_ENABLED=true, SMTP_HOST)`,
      );
      return { sent: false, reason: 'smtp_not_configured' };
    }

    try {
      const brevoApiKey =
        this.config.get<string>('BREVO_API_KEY') ||
        (this.config.get<string>('SMTP_PASS')?.startsWith('xkeysib-')
          ? this.config.get<string>('SMTP_PASS')
          : undefined);

      if (brevoApiKey && this.getDriver() === 'brevo') {
        return await this.sendViaBrevoHttp(input, brevoApiKey);
      }

      const { transporter, from } = await this.getOrCreateTransporter();

      const info = await transporter.sendMail({
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

      const previewUrl = (nodemailer as any).getTestMessageUrl?.(info) || false;
      this.logger.log(
        `Email envoyé avec succès à ${input.to} (id: ${info?.messageId || 'ok'})${previewUrl ? ` - Prévisualisation: ${previewUrl}` : ''}`,
      );

      return {
        sent: true,
        messageId: info?.messageId,
        previewUrl,
      };
    } catch (err: any) {
      this.logger.error(`Erreur lors de l'envoi de l'email à ${input.to} : ${err.message}`, err.stack);
      return {
        sent: false,
        reason: err.message,
      };
    }
  }

  async sendTestEmail(toEmail: string): Promise<SendMailResult> {
    return this.send({
      to: toEmail,
      subject: '✅ Test d\'envoi email — NEXERA ERP',
      text: 'Félicitations ! Votre passerelle d\'envoi d\'e-mails sur Nexera ERP fonctionne parfaitement.',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <div style="margin-bottom: 20px;">
            <span style="font-size: 20px; font-weight: bold; color: #4f46e5;">NEXERA ERP</span>
          </div>
          <h2 style="color: #111827; margin-bottom: 12px; font-size: 18px;">Validation de la Passerelle E-mail</h2>
          <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
            Ce message certifie que la configuration du serveur d'envoi d'e-mails de votre instance <strong>Nexera</strong> est opérationnelle et prête pour la diffusion des devis, factures, relances et notifications de paie.
          </p>
          <div style="margin: 20px 0; padding: 12px 16px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
            <p style="margin: 0; color: #166534; font-size: 13px; font-weight: 500;">
              ✔ Statut : Opérationnel &bull; Destinataire validé : ${toEmail}
            </p>
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 12px;">
            Date et heure d'émission : ${new Date().toLocaleString('fr-FR')} &bull; Nexera ERP Notification System
          </p>
        </div>
      `,
    });
  }
}
