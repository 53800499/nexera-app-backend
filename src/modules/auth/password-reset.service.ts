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
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
    });

    if (!user || !user.isActive) {
      return { message: AuthMessages.FORGOT_PASSWORD_SENT };
    }

    const rawToken = await this.issueResetToken(user.id);
    await this.sendResetEmail(user, rawToken);

    return { message: AuthMessages.FORGOT_PASSWORD_SENT };
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
        html: `<p>Bonjour ${user.firstName},</p><p><a href="${resetUrl}">Réinitialiser mon mot de passe</a></p><p>Ce lien expire dans ${expiryMinutes} minutes.</p>`,
      });

      if (!mailResult.sent) {
        this.logger.warn(
          `Password reset email not sent to ${user.email}: ${mailResult.reason ?? 'unknown'}`,
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
