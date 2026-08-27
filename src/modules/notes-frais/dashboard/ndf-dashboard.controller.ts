import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { NdfDashboardService } from './ndf-dashboard.service';

@ApiTags('notes-frais-dashboard')
@ApiBearerAuth('access-token')
@Controller('notes-frais/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NdfDashboardController {
  constructor(private readonly dashboardService: NdfDashboardService) {}

  @Get('stats')
  @Permissions('ndf.read')
  @ApiOperation({
    summary: 'Obtenir les statistiques & KPIs du module Notes de Frais',
  })
  async getDashboardStats(@Request() req: any) {
    return this.dashboardService.getDashboardStats(req.user.tenantId);
  }
}
