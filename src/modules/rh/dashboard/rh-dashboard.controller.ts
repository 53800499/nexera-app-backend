import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RhDashboardService } from './rh-dashboard.service';

/**
 * Contrôleur du Tableau de Bord RH & Paie
 * 
 * Expose les indicateurs clés de performance (KPIs) RH pour le tenant :
 * - Effectif total (actifs, en congé, suspendus, sortis)
 * - Masse salariale brute et cotisations patronales du mois
 * - Alertes contractuelles (fins de période d'essai imminentes, fins de CDD)
 * - Demandes d'absence et congés en attente de validation
 * - Répartition par département, établissement et type de contrat
 */
@ApiTags('rh-dashboard')
@ApiBearerAuth('access-token')
@Controller('rh/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RhDashboardController {
  constructor(private readonly dashboardService: RhDashboardService) {}

  /**
   * Récupérer la synthèse globale et les KPIs du tableau de bord RH
   * 
   * @param req - Requête HTTP injectée contenant l'utilisateur connecté et son tenantId
   * @returns Un objet complet contenant les métriques, alertes et graphiques RH
   */
  @Get()
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Tableau de bord RH & Paie (KPIs effectifs, masse salariale, alertes fins de contrats/essais, congés)',
    description: 'Calcule en temps réel les indicateurs RH pour le tenant actif : total effectif, masse salariale mensuelle, alertes de fin d’essai/contrat à 30 jours, et demandes d’absence en attente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Synthèse des métriques RH et alertes calculées avec succès',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié (token JWT manquant ou expiré)' })
  @ApiResponse({ status: 403, description: 'Accès refusé - permission rh.read requise' })
  getSummary(@Request() req: { user: { tenantId: string } }) {
    return this.dashboardService.getDashboardSummary(req.user.tenantId);
  }
}
