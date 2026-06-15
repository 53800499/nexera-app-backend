import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@ApiBearerAuth('access-token')
@Controller('metrics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Permissions('settings.read')
  @ApiOperation({
    summary: 'Métriques de latence API (p95 estimé par route)',
  })
  getSummary() {
    return this.metrics.getSummary();
  }
}
