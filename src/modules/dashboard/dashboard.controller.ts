import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { CommercialDashboardResponseDto } from './dto/commercial-dashboard-response.dto';

@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'JWT manquant ou invalide' })
@ApiForbiddenResponse({ description: 'Permission dashboard.read requise' })
@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('commercial')
  @Permissions('dashboard.read')
  @ApiOperation({
    summary: 'Tableau de bord commercial',
    description: `**UC-08** — KPIs temps réel pour dirigeant et responsable commercial.

**Indicateurs :**
- CA HT période (factures émises hors brouillon/proforma)
- Variation % vs même période N-1
- Nombre de factures émises
- Montant impayés (OVERDUE)
- Taux conversion devis (CONVERTED / envoyés)
- Top 5 clients et articles (CA HT)
- Balance âgée (0-30j / 31-60j / 61-90j / +90j)
- Factures à échéance J+7 (SENT/PARTIAL)

**Période :** \`from\` + \`to\` (ISO date). Défaut = mois courant.`,
  })
  @ApiOkResponse({ type: CommercialDashboardResponseDto })
  getCommercial(
    @Query() query: DashboardQueryDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.dashboardService.getCommercialDashboard(
      req.user.tenantId,
      query,
    );
  }
}
