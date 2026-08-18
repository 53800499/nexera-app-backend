import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { ContratsService } from './contrats.service';
import {
  CreateAvenantDto,
  CreateContratDto,
  CreateRuptureDto,
  IssueEssaiDto,
  RenouvelerEssaiDto,
  UpdateContratDto,
} from './dto/contrat.dto';

/**
 * Contrôleur Gestion des Contrats de Travail & Périodes d'Essai
 * 
 * Pilote l'ensemble des aspects contractuels de l'employé :
 * - Création et numérotation des contrats (CDI, CDD, Stage, Prestataire)
 * - Périodes d'essai légales et renouvellement formalisé (écrit unique)
 * - Gestion des avenants au contrat (revalorisation salariale, temps de travail)
 * - Rupture conventionnelle, démission, licenciement et calcul des indemnités CCGT
 */
@ApiTags('rh-contrats')
@ApiBearerAuth('access-token')
@Controller('rh/contrats')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContratsController {
  constructor(private readonly contratsService: ContratsService) {}

  /**
   * Lister les contrats de travail avec filtres multi-critères
   */
  @Get()
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Lister les contrats de travail',
    description: 'Retourne la liste des contrats filtrable par salarié, statut (ACTIF, SUSPENDU, TERMINE, ROMPU) et type de contrat (CDI, CDD, STAGE).',
  })
  @ApiQuery({ name: 'employeId', required: false, description: 'Filtrer par salarié' })
  @ApiQuery({ name: 'statut', required: false, description: 'Statut du contrat : ACTIF, SUSPENDU, TERMINE, ROMPU' })
  @ApiQuery({ name: 'typeContrat', required: false, description: 'Type de contrat : CDI, CDD, STAGE, INTERIM, PRESTATAIRE' })
  @ApiQuery({ name: 'etablissementId', required: false, description: 'Filtrer par établissement' })
  @ApiResponse({ status: 200, description: 'Liste des contrats de travail' })
  findAll(
    @Request() req: { user: { tenantId: string } },
    @Query('employeId') employeId?: string,
    @Query('statut') statut?: string,
    @Query('typeContrat') typeContrat?: string,
    @Query('etablissementId') etablissementId?: string,
  ) {
    return this.contratsService.findAll(
      req.user.tenantId,
      employeId,
      statut,
      typeContrat,
      etablissementId,
    );
  }

  /**
   * Simulateur d'indemnité légale de licenciement (Convention Collective Générale du Travail Bénin)
   */
  @Get(['simulate-severance', 'simulateur-indemnites'])
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Simulateur d’indemnité de licenciement (Convention Collective Bénin)',
    description: 'Calcule l’indemnité estimée selon le barème CCGT Bénin : 30% du salaire mensuel moyen (1-5 ans), 35% (6-10 ans), 40% (au-delà de 10 ans).',
  })
  @ApiQuery({ name: 'ancienneteAnnees', example: 7, description: 'Nombre d’années d’ancienneté' })
  @ApiQuery({ name: 'salaireMoyen12m', example: 350000, description: 'Salaire mensuel brut moyen des 12 derniers mois' })
  @ApiResponse({ status: 200, description: 'Calcul détaillé par tranche d’ancienneté' })
  simulateSeverance(
    @Query('ancienneteAnnees') anciennete: string,
    @Query('salaireMoyen12m') salaire: string,
  ) {
    return this.contratsService.calculateEstimatedSeverance(
      parseFloat(anciennete || '0'),
      parseFloat(salaire || '0'),
    );
  }

  /**
   * Consulter les détails complets d'un contrat de travail
   */
  @Get(':id')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Détail d’un contrat (période d’essai, avenants, rupture)',
    description: 'Retourne la rémunération de base, indemnités conventionnelles, statut de la période d’essai et tous les avenants.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du contrat' })
  @ApiResponse({ status: 200, description: 'Détail du contrat récupéré' })
  @ApiResponse({ status: 404, description: 'Contrat introuvable' })
  findOne(@Param('id') id: string, @Request() req: { user: { tenantId: string } }) {
    return this.contratsService.findOne(id, req.user.tenantId);
  }

  /**
   * Créer un nouveau contrat de travail
   */
  @Post()
  @Permissions('rh.contracts.manage')
  @ApiOperation({
    summary: 'Créer un contrat de travail',
    description: 'Enregistre le contrat avec salaire de base, type, dates d’effet et génère le suivi de période d’essai.',
  })
  @ApiResponse({ status: 201, description: 'Contrat de travail créé avec succès' })
  create(
    @Body() dto: CreateContratDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.contratsService.create(dto, req.user.tenantId, req.user.sub);
  }

  /**
   * Modifier un contrat de travail
   */
  @Patch(':id')
  @Permissions('rh.contracts.manage')
  @ApiOperation({ summary: 'Modifier un contrat' })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du contrat' })
  @ApiResponse({ status: 200, description: 'Contrat mis à jour' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContratDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.contratsService.update(id, dto, req.user.tenantId, req.user.sub);
  }

  /**
   * Renouveler la période d'essai d'un contrat
   */
  @Post(':id/renouveler-essai')
  @Permissions('rh.contracts.manage')
  @ApiOperation({
    summary: 'Renouveler la période d’essai (écrit unique obligatoire)',
    description: 'Prolonge la période d’essai conformément au Code du Travail du Bénin (renouvellement expressément notifié par écrit).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du contrat' })
  @ApiResponse({ status: 200, description: 'Période d’essai renouvelée avec succès' })
  renouvelerEssai(
    @Param('id') id: string,
    @Body() dto: RenouvelerEssaiDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.contratsService.renouvelerEssai(id, dto, req.user.tenantId);
  }

  /**
   * Valider l'embauche définitive ou clore l'essai
   */
  @Post(':id/clore-essai')
  @Permissions('rh.contracts.manage')
  @ApiOperation({
    summary: 'Valider ou rompre la période d’essai',
    description: 'Enregistre l’issue de la période d’essai : CONFIRMEE (embauche définitive) ou ROMPUE_EMPLOYEUR / ROMPUE_EMPLOYE.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du contrat' })
  @ApiResponse({ status: 200, description: 'Issue de la période d’essai enregistrée' })
  cloreEssai(
    @Param('id') id: string,
    @Body() dto: IssueEssaiDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.contratsService.cloreEssai(id, dto, req.user.tenantId);
  }

  /**
   * Créer un avenant modifiant les conditions du contrat de travail
   */
  @Post(':id/avenants')
  @Permissions('rh.contracts.manage')
  @ApiOperation({
    summary: 'Créer un avenant au contrat (salaire, poste, temps de travail)',
    description: 'Ajoute un avenant numéroté traçant l’historique des augmentations et changements contractuels.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du contrat' })
  @ApiResponse({ status: 201, description: 'Avenant créé et appliqué au contrat' })
  createAvenant(
    @Param('id') id: string,
    @Body() dto: CreateAvenantDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.contratsService.createAvenant(id, dto, req.user.tenantId, req.user.sub);
  }

  /**
   * Enregistrer la rupture définitive d'un contrat de travail
   */
  @Post(':id/rupture')
  @Permissions('rh.contracts.manage')
  @ApiOperation({
    summary: 'Enregistrer une rupture de contrat avec calcul des indemnités',
    description: 'Clôture le contrat, met à jour le statut du salarié (SORTI) et calcule les indemnités de rupture et de congés payés.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du contrat' })
  @ApiResponse({ status: 201, description: 'Rupture enregistrée avec succès' })
  createRupture(
    @Param('id') id: string,
    @Body() dto: CreateRuptureDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.contratsService.createRupture(id, dto, req.user.tenantId, req.user.sub);
  }
}
