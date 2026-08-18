import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
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
import { OrganisationService } from './organisation.service';
import {
  CreateDepartementDto,
  CreateEtablissementDto,
  CreatePosteDto,
  UpdateDepartementDto,
  UpdateEtablissementDto,
  UpdatePosteDto,
} from './dto/organisation.dto';

/**
 * Contrôleur Organisation et Structure de l'Entreprise
 * 
 * Permet de configurer l'organigramme multi-niveaux pour le tenant :
 * - Établissements / Sièges / Succursales (adresses, rattachements fiscaux IFU/CNSS)
 * - Départements et services (arborescence hiérarchique avec parentId)
 * - Postes de travail et fiches de poste (missions, qualifications requises)
 */
@ApiTags('rh-organisation')
@ApiBearerAuth('access-token')
@Controller('rh/organisation')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganisationController {
  constructor(private readonly organisationService: OrganisationService) {}

  // =========================================================================
  // ÉTABLISSEMENTS & SITES
  // =========================================================================

  /**
   * Lister tous les établissements et succursales de l'entreprise
   */
  @Get('etablissements')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Lister les établissements du tenant',
    description: 'Retourne tous les établissements (siège social, agences, chantiers) configurés pour l’entreprise.',
  })
  @ApiResponse({ status: 200, description: 'Liste des établissements retournée avec succès' })
  getEtablissements(@Request() req: { user: { tenantId: string } }) {
    return this.organisationService.getEtablissements(req.user.tenantId);
  }

  /**
   * Récupérer le détail d'un établissement par son identifiant
   */
  @Get('etablissements/:id')
  @Permissions('rh.read')
  @ApiOperation({ summary: 'Détail d’un établissement' })
  @ApiParam({ name: 'id', description: 'Identifiant unique UUID de l’établissement' })
  @ApiResponse({ status: 200, description: 'Détail de l’établissement trouvé' })
  @ApiResponse({ status: 404, description: 'Établissement introuvable' })
  getEtablissementById(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.organisationService.getEtablissementById(id, req.user.tenantId);
  }

  /**
   * Créer un nouvel établissement
   */
  @Post('etablissements')
  @Permissions('manage:rh')
  @ApiOperation({
    summary: 'Créer un établissement',
    description: 'Ajoute un site avec raison sociale, numéro IFU, numéro employeur CNSS et statut siège social.',
  })
  @ApiResponse({ status: 201, description: 'Établissement créé avec succès' })
  createEtablissement(
    @Body() dto: CreateEtablissementDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.organisationService.createEtablissement(dto, req.user.tenantId);
  }

  /**
   * Mettre à jour un établissement existant
   */
  @Patch('etablissements/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Modifier un établissement' })
  @ApiParam({ name: 'id', description: 'Identifiant unique UUID de l’établissement' })
  @ApiResponse({ status: 200, description: 'Établissement mis à jour avec succès' })
  updateEtablissement(
    @Param('id') id: string,
    @Body() dto: UpdateEtablissementDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.organisationService.updateEtablissement(id, dto, req.user.tenantId);
  }

  // =========================================================================
  // DÉPARTEMENTS & SERVICES
  // =========================================================================

  /**
   * Lister les départements avec filtrage optionnel par établissement
   */
  @Get('departements')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Lister les départements (arborescence)',
    description: 'Retourne la liste hiérarchique des départements avec compte des postes et salariés rattachés.',
  })
  @ApiQuery({ name: 'etablissementId', required: false, description: 'Filtrer par établissement' })
  @ApiResponse({ status: 200, description: 'Liste des départements' })
  getDepartements(
    @Request() req: { user: { tenantId: string } },
    @Query('etablissementId') etablissementId?: string,
  ) {
    return this.organisationService.getDepartements(req.user.tenantId, etablissementId);
  }

  /**
   * Créer un nouveau département ou service
   */
  @Post('departements')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Créer un département' })
  @ApiResponse({ status: 201, description: 'Département créé avec succès' })
  createDepartement(
    @Body() dto: CreateDepartementDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.organisationService.createDepartement(dto, req.user.tenantId);
  }

  /**
   * Modifier un département
   */
  @Patch('departements/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Modifier un département' })
  @ApiParam({ name: 'id', description: 'Identifiant unique UUID du département' })
  @ApiResponse({ status: 200, description: 'Département modifié avec succès' })
  updateDepartement(
    @Param('id') id: string,
    @Body() dto: UpdateDepartementDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.organisationService.updateDepartement(id, dto, req.user.tenantId);
  }

  // =========================================================================
  // POSTES DE TRAVAIL
  // =========================================================================

  /**
   * Lister les postes de travail avec filtrage optionnel par département
   */
  @Get('postes')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Lister les postes de travail',
    description: 'Renvoie les fiches de postes avec intitulé, département de rattachement, statut cadre et niveau de qualification.',
  })
  @ApiQuery({ name: 'departementId', required: false, description: 'Filtrer par département' })
  @ApiResponse({ status: 200, description: 'Liste des postes' })
  getPostes(
    @Request() req: { user: { tenantId: string } },
    @Query('departementId') departementId?: string,
  ) {
    return this.organisationService.getPostes(req.user.tenantId, departementId);
  }

  /**
   * Créer un nouveau poste de travail
   */
  @Post('postes')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Créer un poste' })
  @ApiResponse({ status: 201, description: 'Poste créé avec succès' })
  createPoste(
    @Body() dto: CreatePosteDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.organisationService.createPoste(dto, req.user.tenantId);
  }

  /**
   * Supprimer un établissement
   */
  @Delete('etablissements/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Supprimer un établissement' })
  deleteEtablissement(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.organisationService.deleteEtablissement(id, req.user.tenantId);
  }

  /**
   * Supprimer un département
   */
  @Delete('departements/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Supprimer un département' })
  deleteDepartement(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.organisationService.deleteDepartement(id, req.user.tenantId);
  }

  /**
   * Modifier une fiche de poste existante
   */
  @Patch('postes/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Modifier un poste' })
  @ApiParam({ name: 'id', description: 'Identifiant unique UUID du poste' })
  @ApiResponse({ status: 200, description: 'Poste mis à jour avec succès' })
  updatePoste(
    @Param('id') id: string,
    @Body() dto: UpdatePosteDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.organisationService.updatePoste(id, dto, req.user.tenantId);
  }

  /**
   * Supprimer un poste
   */
  @Delete('postes/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Supprimer un poste' })
  deletePoste(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.organisationService.deletePoste(id, req.user.tenantId);
  }
}
