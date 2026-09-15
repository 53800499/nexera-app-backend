import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { FiscaliteDashboardService } from './fiscalite-dashboard.service';

@ApiTags('fiscalite-dashboard')
@ApiBearerAuth('access-token')
@Controller('fiscalite/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FiscaliteDashboardController {
  constructor(private readonly dashboardService: FiscaliteDashboardService) {}

  @Get('kpis')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Obtenir les indicateurs de performance fiscale (TVA, IS, échéances, veille)' })
  async getKpis(@Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.dashboardService.getDashboardKpis(tenantId);
  }
}
