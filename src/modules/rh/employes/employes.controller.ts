import {
  Body,
  Controller,
  Delete,
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
import { EmployesService } from './employes.service';
import {
  CreateAffectationDto,
  CreateCoordonneeBancaireDto,
  CreateEmployeDocumentDto,
  CreateEmployeDto,
  CreatePersonneAChargeDto,
  UpdateEmployeDto,
} from './dto/employe.dto';
import { parsePagination } from '../../../shared/utils/pagination.util';

/**
 * Contrôleur Gestion des Salariés & Fiches 360°
 * 
 * Centralise l'intégralité du cycle de vie du collaborateur :
 * - Création de salarié avec génération automatique de matricule unique (EMP-XXXXXX)
 * - Fiche 360° du collaborateur (état civil, personnes à charge, coordonnées bancaires)
 * - Historique des contrats, avenants, affectations de poste et département
 * - Suivi des soldes de congés et historique complet des bulletins de paie
 * - Gestion du coffre-fort documentaire (CNI, diplômes, contrats signés)
 */
@ApiTags('rh-employes')
@ApiBearerAuth('access-token')
@Controller('rh/employes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EmployesController {
  constructor(private readonly employesService: EmployesService) {}

  /**
   * Lister les salariés avec pagination, recherche multi-critères et filtres
   */
  @Get()
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Lister les salariés (paginé avec recherche et filtres)',
    description: 'Recherche plein texte sur le nom, prénom, matricule, email, téléphone, IFU et CNSS. Permet le filtrage par statut d’emploi (ACTIF, SUSPENDU, SORTI) et département.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Numéro de page' })
  @ApiQuery({ name: 'limit', required: false, example: 50, description: 'Salariés par page' })
  @ApiQuery({ name: 'q', required: false, description: 'Recherche texte (nom, matricule, email...)' })
  @ApiQuery({ name: 'statut', required: false, description: 'ACTIF, EN_CONGE, SUSPENDU, DEMISSIONNE, LICENCIE, RETRAITE' })
  @ApiQuery({ name: 'etablissementId', required: false, description: 'Filtrer par établissement' })
  @ApiQuery({ name: 'departementId', required: false, description: 'Filtrer par département' })
  @ApiResponse({ status: 200, description: 'Liste paginée des salariés avec métadonnées' })
  findAll(
    @Request() req: { user: { tenantId: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('statut') statut?: string,
    @Query('statutEmploi') statutEmploi?: string,
    @Query('etablissementId') etablissementId?: string,
    @Query('departementId') departementId?: string,
  ) {
    const pagination = parsePagination(page, limit);
    return this.employesService.findAll(
      req.user.tenantId,
      pagination.page,
      pagination.limit,
      q,
      statut || statutEmploi,
      etablissementId,
      departementId,
    );
  }

  /**
   * Consulter la fiche 360° intégrale d'un salarié
   */
  @Get(':id')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Fiche 360° du salarié',
    description: 'Retourne le dossier complet : état civil, situation de famille, personnes à charge, comptes bancaires, historique des contrats, affectations, solde congés et derniers bulletins.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du salarié' })
  @ApiResponse({ status: 200, description: 'Fiche 360° du salarié récupérée' })
  @ApiResponse({ status: 404, description: 'Salarié introuvable' })
  findOne(
    @Param('id') id: string,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.employesService.findOne(id, req.user.tenantId, req.user.sub);
  }

  /**
   * Créer un nouveau salarié
   */
  @Post()
  @Permissions('manage:rh')
  @ApiOperation({
    summary: 'Créer un nouveau salarié (génération auto du matricule)',
    description: 'Enregistre un salarié dans l’entreprise. Si le matricule n’est pas fourni, le format standard EMP-000001 est auto-généré.',
  })
  @ApiResponse({ status: 201, description: 'Salarié créé avec succès' })
  @ApiResponse({ status: 400, description: 'Données de formulaire invalides' })
  create(
    @Body() dto: CreateEmployeDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.employesService.create(dto, req.user.tenantId, req.user.sub);
  }

  /**
   * Mettre à jour la fiche administrative d'un salarié
   */
  @Patch(':id')
  @Permissions('manage:rh')
  @ApiOperation({
    summary: 'Mettre à jour la fiche d’un salarié',
    description: 'Modifie l’état civil, la situation familiale, les numéros fiscaux/sociaux (IFU, CNSS) et l’adresse.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du salarié' })
  @ApiResponse({ status: 200, description: 'Salarié mis à jour avec succès' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.employesService.update(id, dto, req.user.tenantId, req.user.sub);
  }

  /**
   * Supprimer logiquement un salarié (soft-delete)
   */
  @Delete(':id')
  @Permissions('manage:rh')
  @ApiOperation({
    summary: 'Supprimer un salarié (archivage logique soft-delete)',
    description: 'Marque le salarié comme supprimé sans altérer les historiques de paie et déclarations antérieures.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du salarié' })
  @ApiResponse({ status: 200, description: 'Salarié archivé avec succès' })
  remove(
    @Param('id') id: string,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.employesService.remove(id, req.user.tenantId, req.user.sub);
  }

  // =========================================================================
  // PERSONNES À CHARGE (DÉDUCTION FISCALE ITS)
  // =========================================================================

  /**
   * Ajouter un conjoint ou un enfant à charge du salarié
   */
  @Post(':id/personnes-a-charge')
  @Permissions('manage:rh')
  @ApiOperation({
    summary: 'Ajouter une personne à charge (conjoint / enfant)',
    description: 'Enregistre une personne à charge donnant droit aux réductions d’impôt sur le revenu (CGI Bénin 2026).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du salarié' })
  @ApiResponse({ status: 201, description: 'Personne à charge ajoutée avec succès' })
  addPersonneACharge(
    @Param('id') id: string,
    @Body() dto: CreatePersonneAChargeDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.employesService.addPersonneACharge(id, dto, req.user.tenantId);
  }

  /**
   * Supprimer une personne à charge
   */
  @Delete('personnes-a-charge/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Supprimer une personne à charge' })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de la personne à charge' })
  @ApiResponse({ status: 200, description: 'Personne à charge supprimée' })
  removePersonneACharge(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.employesService.removePersonneACharge(id, req.user.tenantId);
  }

  // =========================================================================
  // COORDONNÉES BANCAIRES & MOBILE MONEY (PAIE)
  // =========================================================================

  /**
   * Enregistrer un RIB bancaire ou compte Mobile Money (MTN MoMo, Moov Money)
   */
  @Post(':id/coordonnees-bancaires')
  @Permissions('manage:rh')
  @ApiOperation({
    summary: 'Ajouter un compte bancaire ou Mobile Money',
    description: 'Configure le mode de virement pour le versement automatique des salaires mensuels.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du salarié' })
  @ApiResponse({ status: 201, description: 'Coordonnée bancaire ajoutée' })
  addCoordonneeBancaire(
    @Param('id') id: string,
    @Body() dto: CreateCoordonneeBancaireDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.employesService.addCoordonneeBancaire(id, dto, req.user.tenantId);
  }

  // =========================================================================
  // HISTORIQUE DES AFFECTATIONS
  // =========================================================================

  /**
   * Enregistrer une nouvelle affectation de poste / service pour un collaborateur
   */
  @Post(':id/affectations')
  @Permissions('manage:rh')
  @ApiOperation({
    summary: 'Créer une nouvelle affectation (poste / département / établissement)',
    description: 'Enregistre une promotion, mutation ou changement de poste dans l’historique de carrière.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du salarié' })
  @ApiResponse({ status: 201, description: 'Affectation enregistrée' })
  addAffectation(
    @Param('id') id: string,
    @Body() dto: CreateAffectationDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.employesService.addAffectation(id, dto, req.user.tenantId);
  }

  // =========================================================================
  // COFFRE-FORT NUMÉRIQUE RH
  // =========================================================================

  /**
   * Attacher un document justificatif à la fiche de l'employé
   */
  @Post(':id/documents')
  @Permissions('manage:rh')
  @ApiOperation({
    summary: 'Ajouter un document au coffre-fort RH du salarié',
    description: 'Stocke les métadonnées et lien vers la pièce jointe (CNI, diplôme, certificat médical, contrat scanné).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du salarié' })
  @ApiResponse({ status: 201, description: 'Document rattaché avec succès' })
  addDocument(
    @Param('id') id: string,
    @Body() dto: CreateEmployeDocumentDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.employesService.addDocument(id, dto, req.user.tenantId);
  }
}
