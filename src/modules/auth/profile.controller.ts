import {
  Body,
  Controller,
  Get,
  Patch,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AllowAuthenticated } from '../../common/decorators/allow-authenticated.decorator';
import { ApiStandardErrors } from '../../common/swagger/api-error.docs';
import { JwtPayload } from '../../shared/interfaces/jwt-payload.interface';
import { AuthMessages } from './constants/auth-messages';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MessageResponseDto } from './dto/auth-response.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@ApiBearerAuth('access-token')
@Controller('profile')
@UseGuards(JwtAuthGuard)
@AllowAuthenticated()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({
    summary: 'Mon profil',
    description: 'Retourne le profil de l\'utilisateur connecté (JWT).',
  })
  @ApiOkResponse({ type: ProfileResponseDto })
  @ApiStandardErrors({
    badRequest: 'Données invalides',
    notFound: AuthMessages.PROFILE_NOT_FOUND,
  })
  getProfile(@Request() req: { user: JwtPayload }) {
    return this.profileService.getProfile(req.user.sub);
  }

  @Patch()
  @ApiOperation({
    summary: 'Mettre à jour mon profil',
    description: 'Modifie le prénom, le nom et/ou l\'email du compte connecté.',
  })
  @ApiOkResponse({ type: ProfileResponseDto })
  @ApiStandardErrors({
    badRequest: `Ex. ${AuthMessages.EMAIL_ALREADY_USED} ou validation des champs`,
    notFound: AuthMessages.PROFILE_NOT_FOUND,
  })
  updateProfile(
    @Request() req: { user: JwtPayload },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(req.user.sub, dto);
  }

  @Patch('password')
  @ApiOperation({
    summary: 'Changer mon mot de passe',
    description:
      'Vérifie le mot de passe actuel, enregistre le nouveau et invalide les refresh tokens.',
  })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiStandardErrors({
    badRequest: 'Nouveau mot de passe trop court (min. 8 caractères)',
    unauthorized: AuthMessages.CURRENT_PASSWORD_INVALID,
    includeNotFound: false,
  })
  changePassword(
    @Request() req: { user: JwtPayload },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.profileService.changePassword(req.user.sub, dto);
  }
}
