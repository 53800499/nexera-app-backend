import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuthModule } from '../auth/auth.module';
import { PlatformController } from './platform.controller';
import { PlatformDashboardService } from './services/platform-dashboard.service';
import { PlatformTenantsService } from './services/platform-tenants.service';
import { PlatformUsersService } from './services/platform-users.service';
import { PlatformAssistanceService } from './services/platform-assistance.service';
import { PlatformAuditService } from './services/platform-audit.service';
import { PlatformHealthService } from './services/platform-health.service';
import { PlatformIncidentsService } from './services/platform-incidents.service';
import { PlatformOpsService } from './services/platform-ops.service';
import { SuperAdminGuard } from './guards/super-admin.guard';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    AuthModule,
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
  controllers: [PlatformController],
  providers: [
    SuperAdminGuard,
    PlatformDashboardService,
    PlatformTenantsService,
    PlatformUsersService,
    PlatformAssistanceService,
    PlatformAuditService,
    PlatformHealthService,
    PlatformIncidentsService,
    PlatformOpsService,
  ],
  exports: [
    PlatformDashboardService,
    PlatformTenantsService,
    PlatformUsersService,
    PlatformAssistanceService,
    PlatformAuditService,
    PlatformHealthService,
    PlatformIncidentsService,
    PlatformOpsService,
  ],
})
export class PlatformModule {}

