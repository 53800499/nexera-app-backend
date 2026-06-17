import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from '../../common/strategies/jwt.strategy';
import { RefreshTokenStrategy } from '../../common/strategies/refresh.strategy';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { MailDeliveryService } from '../../shared/services/mail-delivery.service';
import { PasswordController } from './password.controller';
import { PasswordResetService } from './password-reset.service';
import { UserInvitationService } from './user-invitation.service';

@Module({
  imports: [
    DatabaseModule,
    SettingsModule,
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRATION', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, PasswordController],
  providers: [
    AuthService,
    PasswordResetService,
    UserInvitationService,
    MailDeliveryService,
    JwtStrategy,
    RefreshTokenStrategy,
  ],
  exports: [AuthService, PasswordResetService, UserInvitationService],
})
export class AuthModule {}
