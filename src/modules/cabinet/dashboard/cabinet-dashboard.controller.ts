import {
  Controller,
  Get,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CabinetTenantGuard } from '../../../common/guards/cabinet-tenant.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CabinetDashboardService } from './cabinet-dashboard.service';

@ApiTags('cabinet-dashboard')
@ApiBearerAuth('access-token')
@Controller('cabinet/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard, CabinetTenantGuard)
export class CabinetDashboardController {
  constructor(
    private readonly dashboardService: CabinetDashboardService,
  ) {}

  @Get('cockpit')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Indicateurs consolidés du Cockpit Cabinet' })
  getCockpit(@Request() req: { user: { tenantId: string } }) {
    return this.dashboardService.getCockpitMetrics(req.user.tenantId);
  }
}
