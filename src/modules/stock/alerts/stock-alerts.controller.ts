import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { StockAlertStatus, StockAlertType } from '@prisma/client';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { StockAlertsService } from './stock-alerts.service';
import {
  CreateReplenishmentDto,
  RejectReplenishmentDto,
} from './dto/alerts.dto';

@ApiTags('stock-alerts')
@ApiBearerAuth('access-token')
@Controller('stock')
export class StockAlertsController {
  constructor(private readonly alertsService: StockAlertsService) {}

  @Get('alerts')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Lister les alertes stock (UC-S07)' })
  @ApiQuery({ name: 'status', required: false, enum: StockAlertStatus })
  @ApiQuery({ name: 'alertType', required: false, enum: StockAlertType })
  listAlerts(
    @Request() req: { user: { tenantId: string } },
    @Query('status') status?: StockAlertStatus,
    @Query('alertType') alertType?: StockAlertType,
  ) {
    return this.alertsService.listAlerts(req.user.tenantId, {
      status,
      alertType,
    });
  }

  @Get('alerts/summary')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Résumé badges alertes / réappro en attente' })
  summary(@Request() req: { user: { tenantId: string } }) {
    return this.alertsService.getSummary(req.user.tenantId);
  }

  @Get('alerts/:id')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Détail d’une alerte' })
  findAlert(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.alertsService.findAlert(id, req.user.tenantId);
  }

  @Post('alerts/scan')
  @Permissions('manage:stock')
  @ApiOperation({
    summary:
      'Rescanner les seuils / péremptions / dormants et générer réappro auto',
  })
  @ApiQuery({ name: 'dormantDays', required: false })
  scan(
    @Request() req: { user: { tenantId: string; sub: string } },
    @Query('dormantDays') dormantDays?: string,
  ) {
    return this.alertsService.scan(req.user.tenantId, {
      dormantDays: dormantDays ? Number(dormantDays) : undefined,
      userId: req.user.sub,
    });
  }

  @Post('alerts/:id/acknowledge')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Acquitter une alerte' })
  acknowledge(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string; sub: string } },
  ) {
    return this.alertsService.acknowledge(
      id,
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Post('alerts/:id/dismiss')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Ignorer une alerte' })
  dismiss(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.alertsService.dismiss(id, req.user.tenantId);
  }

  @Get('replenishments')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Lister les demandes de réapprovisionnement' })
  listReplenishments(@Request() req: { user: { tenantId: string } }) {
    return this.alertsService.listReplenishments(req.user.tenantId);
  }

  @Get('replenishments/:id')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Détail d’une proposition de réappro' })
  findReplenishment(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.alertsService.findReplenishment(id, req.user.tenantId);
  }

  @Post('replenishments')
  @Permissions('manage:stock')
  @ApiOperation({
    summary: 'Créer une demande d’achat interne (réappro v1.0)',
  })
  createReplenishment(
    @Body() dto: CreateReplenishmentDto,
    @Request() req: { user: { tenantId: string; sub: string } },
  ) {
    return this.alertsService.createReplenishment(
      dto,
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Post('replenishments/:id/approve')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Valider la proposition (avant Module Achats)' })
  approveReplenishment(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string; sub: string } },
  ) {
    return this.alertsService.approveReplenishment(
      id,
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Post('replenishments/:id/reject')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Rejeter la proposition' })
  rejectReplenishment(
    @Param('id') id: string,
    @Body() dto: RejectReplenishmentDto,
    @Request() req: { user: { tenantId: string; sub: string } },
  ) {
    return this.alertsService.rejectReplenishment(
      id,
      dto,
      req.user.tenantId,
      req.user.sub,
    );
  }
}
