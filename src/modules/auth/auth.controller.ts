import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthTokensResponseDto } from './dto/auth-response.dto';
import { RefreshTokenGuard } from '../../common/guards/refresh-token.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ApiStandardErrors } from '../../common/swagger/api-error.docs';
import { AuthMessages } from './constants/auth-messages';

@Controller('auth')
@Public()
@ApiTags('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Inscription — créer un compte et une organisation',
    description:
      'Crée un utilisateur et rattache une organisation (tenant). ' +
      'Sans `tenantId` : fournir `tenantName` pour créer une organisation (`tenantType`: `company` ou `cabinet`). ' +
      'Avec `tenantId` : rejoindre une organisation existante. ' +
      'Le premier utilisateur d\'un tenant devient super-admin.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'Compte créé — tokens JWT retournés',
    type: AuthTokensResponseDto,
  })
  @ApiStandardErrors({
    badRequest: `Ex. ${AuthMessages.EMAIL_ALREADY_EXISTS} ou validation des champs`,
    includeNotFound: false,
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Connexion',
    description: 'Authentifie l\'utilisateur et retourne les tokens JWT.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Connexion réussie',
    type: AuthTokensResponseDto,
  })
  @ApiStandardErrors({
    badRequest: 'Champs invalides (email, mot de passe min. 8 caractères)',
    unauthorized: `Ex. ${AuthMessages.INVALID_CREDENTIALS} ou ${AuthMessages.ACCOUNT_DISABLED}`,
    includeNotFound: false,
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rafraîchir le token',
    description: 'Émet de nouveaux tokens à partir du refresh token (header Bearer).',
  })
  @ApiOkResponse({
    description: 'Nouveaux tokens',
    type: AuthTokensResponseDto,
  })
  @ApiStandardErrors({
    unauthorized: AuthMessages.SESSION_EXPIRED,
    includeNotFound: false,
  })
  async refresh(@Request() req: any) {
    return this.authService.refreshToken(req.user);
  }
}
