import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailDeliveryService } from '../../shared/services/mail-delivery.service';
import { PasswordResetService } from './password-reset.service';

export interface NewUserInvitationInput {
  user: { id: string; email: string; firstName: string };
  tenantName: string;
  initialPassword: string;
  requestPasswordReset: boolean;
}

@Injectable()
export class UserInvitationService {
  private readonly logger = new Logger(UserInvitationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mail: MailDeliveryService,
    private readonly passwordReset: PasswordResetService,
  ) {}

  async sendNewUserInvitation(input: NewUserInvitationInput) {
    const loginUrl = this.buildLoginUrl();
    let resetUrl: string | undefined;

    if (input.requestPasswordReset) {
      const rawToken = await this.passwordReset.issueResetToken(input.user.id);
      resetUrl = this.passwordReset.getResetUrl(rawToken);
    }

    const subject = `Invitation à rejoindre ${input.tenantName} sur Nexera`;
    const greeting = `Bonjour ${input.user.firstName},`;

    const text = input.requestPasswordReset
      ? `${greeting}\n\nUn compte Nexera a été créé pour vous au sein de ${input.tenantName}.\n\nPour définir votre mot de passe, ouvrez ce lien :\n${resetUrl}\n\nVous pourrez ensuite vous connecter ici :\n${loginUrl}\n\nIdentifiant : ${input.user.email}`
      : `${greeting}\n\nUn compte Nexera a été créé pour vous au sein de ${input.tenantName}.\n\nConnectez-vous ici :\n${loginUrl}\n\nIdentifiant : ${input.user.email}\nMot de passe temporaire : ${input.initialPassword}\n\nNous vous recommandons de changer ce mot de passe après votre première connexion.`;

    const html = input.requestPasswordReset
      ? `<p>${greeting}</p><p>Un compte Nexera a été créé pour vous au sein de <strong>${input.tenantName}</strong>.</p><p><a href="${resetUrl}">Définir mon mot de passe</a></p><p>Puis connectez-vous sur <a href="${loginUrl}">la page de connexion</a> avec <strong>${input.user.email}</strong>.</p>`
      : `<p>${greeting}</p><p>Un compte Nexera a été créé pour vous au sein de <strong>${input.tenantName}</strong>.</p><p><a href="${loginUrl}">Se connecter</a></p><p>Identifiant : <strong>${input.user.email}</strong><br/>Mot de passe temporaire : <strong>${input.initialPassword}</strong></p><p>Nous vous recommandons de changer ce mot de passe après votre première connexion.</p>`;

    try {
      const mailResult = await this.mail.send({
        to: input.user.email,
        subject,
        text,
        html,
      });

      if (!mailResult.sent) {
        this.logger.warn(
          `Invitation email not sent to ${input.user.email}: ${mailResult.reason ?? 'unknown'}`,
        );
      }

      return {
        sent: mailResult.sent,
        reason: mailResult.reason,
        passwordResetRequested: input.requestPasswordReset,
      };
    } catch (error) {
      this.logger.error(
        `Invitation email failed for ${input.user.email}`,
        error instanceof Error ? error.stack : String(error),
      );
      return {
        sent: false,
        reason: 'send_failed',
        passwordResetRequested: input.requestPasswordReset,
      };
    }
  }

  resolveDefaultPassword(): string {
    return (
      this.config.get<string>('DEFAULT_USER_PASSWORD')?.trim() || 'password1234'
    );
  }

  private buildLoginUrl(): string {
    const base =
      this.config.get<string>('FRONT_APP_URL') ??
      this.config.get<string>('PUBLIC_APP_URL') ??
      'http://localhost:3001';
    return new URL('/login', base.replace(/\/$/, '')).toString();
  }
}
