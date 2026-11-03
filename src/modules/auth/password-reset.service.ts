import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MailDeliveryService } from '../../shared/services/mail-delivery.service';
import { assertDeliverableEmail } from '../../shared/utils/email-validator.util';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthMessages } from './constants/auth-messages';

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailDeliveryService,
  ) {}

  async forgotPassword(dto: ForgotPasswordDto) {
    const normalizedEmail = await assertDeliverableEmail(dto.email);

    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    });

    if (!user) {
      throw new BadRequestException(
        `Aucun compte Nexera n'est associé à l'adresse e-mail « ${normalizedEmail} ». Veuillez vérifier l'orthographe de l'adresse saisie ou créer un compte.`,
      );
    }

    if (!user.isActive) {
      throw new BadRequestException(
        `Le compte associé à l'adresse e-mail « ${user.email} » est désactivé. Veuillez contacter l'administrateur de votre organisation.`,
      );
    }

    const rawToken = await this.issueResetToken(user.id);
    const mailResult = await this.sendResetEmail(user, rawToken);

    if (!mailResult.sent) {
      throw new BadRequestException(
        `L'envoi de l'e-mail de réinitialisation vers « ${user.email} » a échoué : ${this.describeMailFailure(mailResult.reason)}`,
      );
    }

    return {
      recipientEmail: user.email,
      message: `Un e-mail de réinitialisation a été envoyé avec succès à l'adresse ${user.email}. Veuillez consulter votre boîte de réception (ainsi que vos spams).`,
    };
  }

  private describeMailFailure(reason?: string): string {
    if (!reason || reason === 'unknown') {
      return "Le serveur de messagerie n'a pas pu délivrer le message. Réessayez dans quelques instants.";
    }
    if (reason === 'smtp_not_configured') {
      return "Le service d'envoi d'e-mails n'est pas encore activé ou configuré sur le serveur.";
    }
    if (reason.includes('Key not found') || reason.includes('535')) {
      return "Échec d'authentification auprès du fournisseur d'e-mails (clé API ou identifiants SMTP invalides sur le serveur).";
    }
    if (reason.includes('ETIMEDOUT') || reason.includes('ECONNREFUSED') || reason.includes('Connection timeout')) {
      return 'Délai de connexion dépassé avec le serveur de messagerie. Réessayez dans quelques instants.';
    }
    return `Le serveur mail a refusé l'envoi (${reason}). Vérifiez que l'adresse « destinataire » est bien active.`;
  }

  async issueResetToken(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = this.resolveExpiryDate();

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: { userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    return rawToken;
  }

  getResetUrl(rawToken: string): string {
    return this.buildResetUrl(rawToken);
  }

  async sendResetEmail(
    user: { email: string; firstName: string },
    rawToken: string,
  ) {
    const resetUrl = this.buildResetUrl(rawToken);
    const expiryMinutes = this.resolveExpiryMinutes();

    try {
      const mailResult = await this.mail.send({
        to: user.email,
        subject: 'Réinitialisation de votre mot de passe Nexera',
        text: `Bonjour ${user.firstName},\n\nPour réinitialiser votre mot de passe, ouvrez ce lien (valide ${expiryMinutes} minutes) :\n${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="margin-bottom: 24px; text-align: center;">
              <h2 style="color: #1e293b; margin: 0; font-size: 20px;">Nexera ERP</h2>
              <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0;">Sécurité et gestion des accès</p>
            </div>
            <p style="color: #334155; font-size: 14px; line-height: 1.6;">Bonjour <strong>${user.firstName}</strong>,</p>
            <p style="color: #334155; font-size: 14px; line-height: 1.6;">
              Une demande de réinitialisation de mot de passe a été initiée pour votre compte. Cliquez sur le bouton ci-dessous pour choisir votre nouveau mot de passe :
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                Réinitialiser mon mot de passe
              </a>
            </div>
            <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
              Ce lien est sécurisé et expire dans <strong>${expiryMinutes} minutes</strong>. Si le bouton ne fonctionne pas, copiez-collez l'adresse suivante dans votre navigateur :<br/>
              <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 11px; margin: 0;">
              Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité. Votre mot de passe actuel restera inchangé.
            </p>
          </div>
        `,
      });

      if (!mailResult.sent) {
        this.logger.warn(
          `Password reset email not sent to ${user.email}: ${mailResult.reason ?? 'unknown'}`,
        );
      } else {
        this.logger.log(
          `Password reset email successfully sent to ${user.email} (preview: ${mailResult.previewUrl || resetUrl})`,
        );
      }

      return mailResult;
    } catch (error) {
      this.logger.error(
        `Password reset email failed for ${user.email}`,
        error instanceof Error ? error.stack : String(error),
      );
      return { sent: false, reason: 'send_failed' };
    }
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token.trim());

    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!record || !record.user.isActive) {
      throw new BadRequestException(AuthMessages.RESET_TOKEN_INVALID);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          password: hashedPassword,
          refreshToken: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: {
          userId: record.userId,
          usedAt: null,
          id: { not: record.id },
        },
        data: { usedAt: new Date() },
      }),
    ]);

    return { message: AuthMessages.PASSWORD_UPDATED };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private resolveExpiryDate(): Date {
    return new Date(Date.now() + this.resolveExpiryMinutes() * 60 * 1000);
  }

  private resolveExpiryMinutes(): number {
    const minutes = Number(
      this.config.get<string>('PASSWORD_RESET_EXPIRATION_MINUTES', '60'),
    );
    return Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
  }

  private buildResetUrl(rawToken: string): string {
    const base =
      this.config.get<string>('FRONT_APP_URL') ??
      this.config.get<string>('PUBLIC_APP_URL') ??
      'http://localhost:3001';
    const url = new URL('/reset-password', base.replace(/\/$/, ''));
    url.searchParams.set('token', rawToken);
    return url.toString();
  }
}
