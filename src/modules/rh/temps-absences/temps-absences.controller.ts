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
import { TempsAbsencesService } from './temps-absences.service';
import {
  AdjustSoldeCongeDto,
  BatchReleveTempsDto,
  CreateAbsenceDto,
  CreatePlanningHoraireDto,
  CreateReleveTempsDto,
  RecalculerSoldesDto,
  ValidateAbsenceDto,
  ValidateReleveTempsDto,
} from './dto/temps-absences.dto';

/**
 * Contrôleur Gestion du Temps de Travail, Absences & Congés Payés
 * 
 * Assure le suivi opérationnel du temps de présence et des congés :
 * - Définition des grilles horaires (39h/40h légale, forfait jour, travail posté)
 * - Pointage quotidien et relevé des heures supplémentaires (+15%, +50%, Nuit, Dimanche)
 * - Workflow de dépôt et validation des demandes de congés et absences
 * - Calcul en temps réel des droits à congés payés acquis (2 jours / mois) et consommés
 */
@ApiTags('rh-temps-absences')
@ApiBearerAuth('access-token')
@Controller('rh/temps-absences')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TempsAbsencesController {
  constructor(private readonly tempsAbsencesService: TempsAbsencesService) {}

  // =========================================================================
  // PLANNINGS & MODÈLES HORAIRES
  // =========================================================================

  /**
   * Lister les plannings et régimes horaires applicables dans l'entreprise
   */
  @Get('plannings')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Lister les modèles d’horaires de travail',
    description: 'Renvoie les régimes de travail configurés (ex: Standard 40h, Équipe de nuit, Horaires décalés).',
  })
  @ApiQuery({ name: 'etablissementId', required: false, description: 'Filtrer par établissement' })
  @ApiResponse({ status: 200, description: 'Liste des plannings horaires' })
  getPlannings(
    @Request() req: { user: { tenantId: string } },
    @Query('etablissementId') etablissementId?: string,
  ) {
    return this.tempsAbsencesService.getPlannings(req.user.tenantId, etablissementId);
  }

  /**
   * Créer un nouveau modèle d'horaire de travail
   */
  @Post('plannings')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Créer un modèle d’horaire de travail' })
  @ApiResponse({ status: 201, description: 'Planning créé avec succès' })
  createPlanning(
    @Body() dto: CreatePlanningHoraireDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.tempsAbsencesService.createPlanning(dto, req.user.tenantId);
  }

  // =========================================================================
  // RELEVÉS D'HEURES & HEURES SUPPLÉMENTAIRES
  // =========================================================================

  /**
   * Lister les relevés de temps et heures supplémentaires
   */
  @Get('releves')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Lister les relevés d’heures et heures supplémentaires',
    description: 'Retourne les pointages avec décompte des heures normales, heures sup 15% (41e à 48e h), 50% (>48e h), de nuit et dimanches/fériés.',
  })
  @ApiQuery({ name: 'employeId', required: false, description: 'Filtrer par salarié' })
  @ApiQuery({ name: 'dateDebut', required: false, example: '2026-06-01', description: 'Date de début' })
  @ApiQuery({ name: 'dateFin', required: false, example: '2026-06-30', description: 'Date de fin' })
  @ApiQuery({ name: 'statut', required: false, description: 'Statut du relevé : SAISI, VALIDE_RH, REJETE' })
  @ApiResponse({ status: 200, description: 'Liste des relevés de temps' })
  getReleves(
    @Request() req: { user: { tenantId: string } },
    @Query('employeId') employeId?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('statut') statut?: string,
  ) {
    return this.tempsAbsencesService.getRelevesTemps(
      req.user.tenantId,
      employeId,
      dateDebut,
      dateFin,
      statut,
    );
  }

  /**
   * Enregistrer ou mettre à jour un relevé d'heures journalier
   */
  @Post('releves')
  @Permissions('rh.timesheets.manage')
  @ApiOperation({
    summary: 'Enregistrer le pointage / relevé d’heures quotidien',
    description: 'Enregistre les heures travaillées d’une journée avec calcul automatique des majorations d’heures sup.',
  })
  @ApiResponse({ status: 201, description: 'Relevé d’heures enregistré avec succès' })
  createOrUpdateReleve(
    @Body() dto: CreateReleveTempsDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.tempsAbsencesService.createOrUpdateReleveTemps(dto, req.user.tenantId);
  }

  /**
   * Saisie en masse de relevés d'heures (import périodique)
   */
  @Post('releves/batch')
  @Permissions('rh.timesheets.manage')
  @ApiOperation({
    summary: 'Saisie en masse des relevés d’heures (import hebdomadaire/mensuel)',
    description: 'Permet d’injecter en une seule requête les relevés de pointage pour plusieurs salariés sur une période.',
  })
  @ApiResponse({ status: 201, description: 'Relevés en masse traités avec succès' })
  batchReleves(
    @Body() dto: BatchReleveTempsDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.tempsAbsencesService.batchCreateRelevesTemps(dto, req.user.tenantId);
  }

  /**
   * Valider ou rejeter un relevé d'heures
   */
  @Patch('releves/:id/valider')
  @Permissions('rh.timesheets.manage')
  @ApiOperation({ summary: 'Valider un relevé d’heures (manager / RH)' })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du relevé d’heures' })
  @ApiResponse({ status: 200, description: 'Relevé d’heures validé' })
  validateReleve(
    @Param('id') id: string,
    @Body() dto: ValidateReleveTempsDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.tempsAbsencesService.validateReleveTemps(
      id,
      dto,
      req.user.tenantId,
      req.user.sub,
    );
  }

  // =========================================================================
  // ABSENCES & CONGÉS PAYÉS
  // =========================================================================

  /**
   * Lister les demandes de congés et absences
   */
  @Get('absences')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Lister les demandes de congés et absences',
    description: 'Affiche les demandes avec dates, nombre de jours ouvrés, type (Congé annuel, Maladie, etc.) et statut.',
  })
  @ApiQuery({ name: 'employeId', required: false, description: 'Filtrer par salarié' })
  @ApiQuery({ name: 'statut', required: false, description: 'SOUMIS, VALIDE_RH, REJETE' })
  @ApiQuery({ name: 'annee', required: false, example: 2026, description: 'Année civile' })
  @ApiResponse({ status: 200, description: 'Liste des absences' })
  getAbsences(
    @Request() req: { user: { tenantId: string } },
    @Query('employeId') employeId?: string,
    @Query('statut') statut?: string,
    @Query('annee') annee?: string,
  ) {
    return this.tempsAbsencesService.getAbsences(
      req.user.tenantId,
      employeId,
      statut,
      undefined,
      annee ? parseInt(annee, 10) : undefined,
    );
  }

  /**
   * Déposer une demande de congé ou déclarer une absence
   */
  @Post('absences')
  @Permissions('rh.leaves.request')
  @ApiOperation({
    summary: 'Déposer une demande de congé / déclarer une absence',
    description: 'Crée une demande d’absence avec calcul du nombre de jours ouvrés et contrôle du solde disponible.',
  })
  @ApiResponse({ status: 201, description: 'Demande de congé déposée avec succès' })
  createAbsence(
    @Body() dto: CreateAbsenceDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.tempsAbsencesService.createAbsence(dto, req.user.tenantId, req.user.sub);
  }

  /**
   * Valider ou refuser une demande d'absence
   */
  @Patch('absences/:id/valider')
  @Permissions('rh.leaves.validate')
  @ApiOperation({
    summary: 'Valider ou rejeter une demande de congé (déduction auto du solde si approuvé)',
    description: 'Met à jour le statut (VALIDE_RH ou REJETE) et déduit automatiquement les jours du compteur de congés de l’employé.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de la demande d’absence' })
  @ApiResponse({ status: 200, description: 'Demande d’absence validée ou rejetée' })
  validateAbsence(
    @Param('id') id: string,
    @Body() dto: ValidateAbsenceDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.tempsAbsencesService.validateAbsence(id, dto, req.user.tenantId, req.user.sub);
  }

  @Get('types-absence')
  @Permissions('rh.read')
  @ApiOperation({ summary: 'Lister les types de congés et motifs d’absence' })
  @ApiResponse({ status: 200, description: 'Liste des types d’absence' })
  getTypesAbsence() {
    return this.tempsAbsencesService.getTypesAbsence();
  }

  // =========================================================================
  // SOLDES & COMPTEURS DE CONGÉS
  // =========================================================================

  /**
   * Consulter les compteurs de solde de congés par salarié
   */
  @Get('soldes-conges')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Consulter les compteurs de droits à congés par salarié',
    description: 'Renvoie les compteurs pour l’année : jours acquis, jours pris, reliquat N-1 et solde restant disponible.',
  })
  @ApiQuery({ name: 'annee', required: false, example: 2026 })
  @ApiQuery({ name: 'employeId', required: false, description: 'Filtrer par salarié' })
  @ApiResponse({ status: 200, description: 'Soldes de congés calculés' })
  getSoldesConges(
    @Request() req: { user: { tenantId: string } },
    @Query('annee') annee = '2026',
    @Query('employeId') employeId?: string,
  ) {
    return this.tempsAbsencesService.getSoldesConges(
      req.user.tenantId,
      parseInt(annee, 10),
      employeId,
    );
  }

  /**
   * Recalculer les compteurs de congés selon les règles légales Bénin
   */
  @Post('soldes-conges/calculer')
  @Permissions('rh.leaves.validate')
  @ApiOperation({
    summary: 'Recalculer les compteurs de congés selon les règles légales Bénin',
    description: 'Actualise les droits acquis (2j/mois), majorations d’ancienneté/enfants, jours consommés et soldes disponibles.',
  })
  @ApiResponse({ status: 200, description: 'Compteurs recalculés avec succès' })
  recalculerSoldes(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: RecalculerSoldesDto,
  ) {
    return this.tempsAbsencesService.recalculerSoldesConges(
      req.user.tenantId,
      dto.annee || 2026,
      dto.employeId,
    );
  }

  /**
   * Ajuster manuellement les compteurs de congés (régularisation RH)
   */
  @Post('soldes-conges/:employeId/ajuster')
  @Permissions('rh.leaves.validate')
  @ApiOperation({
    summary: 'Ajuster les droits ou jours consommés d’un salarié',
    description: 'Permet une régularisation exceptionnelle des compteurs de congés avec motif d’audit obligatoire.',
  })
  @ApiParam({ name: 'employeId', description: 'Identifiant UUID du salarié' })
  @ApiResponse({ status: 200, description: 'Solde de congé ajusté' })
  adjustSoldeConge(
    @Param('employeId') employeId: string,
    @Body() dto: AdjustSoldeCongeDto,
    @Request() req: { user: { tenantId: string; id?: string; userId?: string } },
  ) {
    return this.tempsAbsencesService.adjustSoldeConge(
      employeId,
      dto,
      req.user.tenantId,
      req.user.userId || req.user.id,
    );
  }
}
