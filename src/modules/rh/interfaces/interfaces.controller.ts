import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { InterfacesService } from './interfaces.service';

/**
 * Contrôleur Interfaces Comptables & Déclarations Fiscales/Sociales
 * 
 * Assure l'intégration de la paie avec le reste de l'ERP et les organismes officiels :
 * 1. Module Comptabilité (M3) :
 *    - Génération automatique des pièces d'Opérations Diverses (OD de paie)
 *    - Respect de la nomenclature SYSCOHADA (Débit 661/664 = Crédit 421/431/447)
 *    - Écritures parfaitement équilibrées (Principe de la partie double)
 * 2. Module Fiscalité & Déclarations (M7) :
 *    - Déclaration mensuelle ITS (Impôt sur les Traitements et Salaires - DGI)
 *    - Déclaration mensuelle VPS (Versement Patronal sur Salaires - DGI)
 *    - Déclaration nominative mensuelle ou trimestrielle CNSS (Caisse Nationale de Sécurité Sociale)
 */
@ApiTags('rh-interfaces')
@ApiBearerAuth('access-token')
@Controller('rh/interfaces')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InterfacesController {
  constructor(private readonly interfacesService: InterfacesService) {}

  // =========================================================================
  // ÉCRITURES COMPTABLES OD DE PAIE (SYSCOHADA)
  // =========================================================================

  /**
   * Consulter le projet d'écriture comptable d'OD de paie pour un cycle
   */
  @Get('od-paie/:cycleId')
  @Permissions('rh.accounting.export')
  @ApiOperation({
    summary: 'Consulter l’écriture comptable OD de paie SYSCOHADA générée',
    description: 'Renvoie le journal d’OD avec toutes les lignes débit/crédit (Comptes 6611, 6612, 6641 au Débit et 4211, 4311, 4471 au Crédit).',
  })
  @ApiParam({ name: 'cycleId', description: 'Identifiant UUID du cycle de paie' })
  @ApiResponse({ status: 200, description: 'Écriture comptable OD de paie' })
  @ApiResponse({ status: 404, description: 'Aucune écriture trouvée pour ce cycle' })
  getOdPaie(
    @Param('cycleId') cycleId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.interfacesService.getOdPaie(cycleId, req.user.tenantId);
  }

  /**
   * Générer et comptabiliser l'OD de paie équilibrée
   */
  @Post('od-paie/:cycleId/generer')
  @Permissions('rh.accounting.export')
  @ApiOperation({
    summary: 'Générer l’écriture comptable de paie équilibrée (SYSCOHADA classe 6 / 42 / 43 / 44)',
    description: 'Calcule et génère la pièce comptable d’OD dans le journal des salaires, en garantissant un équilibre strict Débit = Crédit.',
  })
  @ApiParam({ name: 'cycleId', description: 'Identifiant UUID du cycle de paie' })
  @ApiResponse({ status: 201, description: 'Écriture comptable d’OD générée et équilibrée' })
  generateOdPaie(
    @Param('cycleId') cycleId: string,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.interfacesService.generateOdPaie(cycleId, req.user.tenantId, req.user.sub);
  }

  // =========================================================================
  // DÉCLARATIONS SOCIALES ET FISCALES OFFICIELLES (M7)
  // =========================================================================

  /**
   * Lister les déclarations fiscales et sociales archivées
   */
  @Get('declarations')
  @Permissions('rh.declarations.manage')
  @ApiOperation({
    summary: 'Lister les déclarations fiscales et sociales (ITS, VPS, CNSS)',
    description: 'Renvoie les déclarations générées avec assiettes imposables, montants dus et statuts de transmission.',
  })
  @ApiQuery({ name: 'cyclePaieId', required: false, description: 'Filtrer par cycle de paie' })
  @ApiQuery({ name: 'annee', required: false, example: 2026, description: 'Année civile' })
  @ApiResponse({ status: 200, description: 'Liste des déclarations officielles' })
  getDeclarations(
    @Request() req: { user: { tenantId: string } },
    @Query('cyclePaieId') cyclePaieId?: string,
    @Query('annee') annee?: string,
  ) {
    return this.interfacesService.getDeclarations(
      req.user.tenantId,
      cyclePaieId,
      annee ? parseInt(annee, 10) : undefined,
    );
  }

  /**
   * Générer le bordereau des déclarations ITS, VPS et CNSS d'un cycle de paie
   */
  @Post('declarations/:cycleId/generer')
  @Permissions('rh.declarations.manage')
  @ApiOperation({
    summary: 'Générer les déclarations ITS, VPS et CNSS pour un cycle',
    description: 'Compile les bordereaux déclaratifs officiels prêts pour télé-déclaration DGI et CNSS Bénin avec décompte nominatif par salarié.',
  })
  @ApiParam({ name: 'cycleId', description: 'Identifiant UUID du cycle de paie' })
  @ApiResponse({ status: 201, description: 'Déclarations fiscales et sociales générées' })
  generateDeclarations(
    @Param('cycleId') cycleId: string,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.interfacesService.generateDeclarations(cycleId, req.user.tenantId, req.user.sub);
  }
}
