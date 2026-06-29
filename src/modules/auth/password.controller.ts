import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiStandardErrors } from '../../common/swagger/api-error.docs';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MessageResponseDto } from './dto/auth-response.dto';
import { PasswordResetService } from './password-reset.service';

@ApiTags('auth')
@Controller()
@Public()
export class PasswordController {
  constructor(private readonly passwordResetService: PasswordResetService) {}

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mot de passe oublié',
    description:
      'Envoie un email avec un lien de réinitialisation si le compte existe et est actif. ' +
      'La réponse est **toujours identique** (anti-énumération). ' +
      'Configurer `MAIL_ENABLED=true`, `SMTP_*` et `FRONT_APP_URL` pour l\'envoi d\'email. ' +
      'Le lien pointe vers `{FRONT_APP_URL}/reset-password?token=...` (durée : `PASSWORD_RESET_EXPIRATION_MINUTES`, défaut 60 min).',
  })
  @ApiResponse({
    status: 200,
    description: 'Demande prise en compte (réponse identique que le compte existe ou non)',
    type: MessageResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Adresse email invalide',
    includeNotFound: false,
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordResetService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Réinitialiser le mot de passe',
    description:
      'Consomme le jeton reçu par email (`token` en query sur le front) et définit un nouveau mot de passe. ' +
      'Invalide les refresh tokens existants.',
  })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe mis à jour',
    type: MessageResponseDto,
  })
  @ApiStandardErrors({
    badRequest:
      'Jeton invalide ou expiré, ou mot de passe trop court (min. 8 caractères)',
    includeNotFound: false,
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordResetService.resetPassword(dto);
  }
}
