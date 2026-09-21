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
import { PaieService } from './paie.service';
import {
  BatchElementVariableDto,
  CalculateCyclePaieDto,
  CreateElementVariableDto,
  CreateRemunerationExceptionnelleDto,
  CreateRubriquePaieDto,
  UpdateRubriquePaieDto,
  CreateSoldeToutCompteDto,
  OpenCyclePaieDto,
  SignerSoldeToutCompteDto,
} from './dto/paie.dto';

/**
 * Contrôleur Moteur de Paie, Cycles & Bulletins OHADA
 * 
 * Cœur du traitement salarial conforme au Code Général des Impôts (CGI Bénin 2026) :
 * - Ouverture et clôture mensuelle des cycles de paie
 * - Saisie des éléments variables (primes, commissions, déductions, avantages en nature)
 * - Moteur de calcul 1-clic :
 *    * Barème progressif ITS Art. 125 (0% à 30%)
 *    * Rémunérations exceptionnelles / 13e mois via méthode du quotient Art. 126
 *    * Cotisations CNSS (3,6% salariale, 17,4% patronale) et VPS (4%)
 * - Émission des bulletins de paie complets conformes SYSCOHADA / OHADA
 * - Solde de tout compte et reçu pour solde de tout compte avec décharge
 */
@ApiTags('rh-paie')
@ApiBearerAuth('access-token')
@Controller('rh/paie')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaieController {
  constructor(private readonly paieService: PaieService) {}

  // =========================================================================
  // RUBRIQUES DE PAIE (PLAN DE PAIE)
  // =========================================================================

  /**
   * Lister le catalogue des rubriques de paie pour le pays
   */
  @Get('rubriques')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Catalogue des rubriques de paie',
    description: 'Renvoie toutes les rubriques actives avec leur nature (gain, retenue, cotisation), base taxable et compte comptable SYSCOHADA.',
  })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  @ApiResponse({ status: 200, description: 'Catalogue des rubriques de paie' })
  getRubriques(@Query('paysCode') paysCode = 'BJ') {
    return this.paieService.getRubriques(paysCode);
  }

  /**
   * Créer une rubrique de paie personnalisée pour l'entreprise
   */
  @Post('rubriques')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Créer une rubrique de paie' })
  @ApiResponse({ status: 201, description: 'Rubrique de paie créée' })
  createRubrique(@Body() dto: CreateRubriquePaieDto) {
    return this.paieService.createRubrique(dto);
  }

  /**
   * Modifier une rubrique de paie
   */
  @Patch('rubriques/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Modifier une rubrique de paie' })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de la rubrique' })
  @ApiResponse({ status: 200, description: 'Rubrique de paie modifiée' })
  updateRubrique(
    @Param('id') id: string,
    @Body() dto: UpdateRubriquePaieDto,
  ) {
    return this.paieService.updateRubrique(id, dto);
  }

  /**
   * Supprimer ou désactiver une rubrique de paie
   */
  @Delete('rubriques/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Supprimer ou désactiver une rubrique de paie' })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de la rubrique' })
  @ApiResponse({ status: 200, description: 'Rubrique de paie supprimée ou désactivée' })
  deleteRubrique(@Param('id') id: string) {
    return this.paieService.deleteRubrique(id);
  }

  // =========================================================================
  // CYCLES DE PAIE MENSUELS
  // =========================================================================

  /**
   * Lister l'historique des cycles de paie du tenant
   */
  @Get('cycles')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Lister les cycles de paie',
    description: 'Retourne les cycles de paie avec statut (OUVERT, EN_COURS, CLOTURE), masse salariale brute totale, total net à payer et total charges patronales.',
  })
  @ApiQuery({ name: 'etablissementId', required: false, description: 'Filtrer par établissement' })
  @ApiQuery({ name: 'annee', required: false, example: 2026, description: 'Année du cycle' })
  @ApiResponse({ status: 200, description: 'Liste des cycles de paie' })
  getCycles(
    @Request() req: { user: { tenantId: string } },
    @Query('etablissementId') etablissementId?: string,
    @Query('annee') annee?: string,
  ) {
    return this.paieService.getCycles(
      req.user.tenantId,
      etablissementId,
      annee ? parseInt(annee, 10) : undefined,
    );
  }

  /**
   * Obtenir le détail exhaustif d'un cycle de paie
   */
  @Get('cycles/:id')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Détail d’un cycle de paie (bulletins, variables, déclarations, OD)',
    description: 'Affiche la synthèse financière du cycle, le détail des bulletins générés, les éléments variables saisis et l’état des écritures comptables.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du cycle de paie' })
  @ApiResponse({ status: 200, description: 'Détail du cycle de paie' })
  @ApiResponse({ status: 404, description: 'Cycle de paie introuvable' })
  getCycleById(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.paieService.getCycleById(id, req.user.tenantId);
  }

  /**
   * Ouvrir un nouveau cycle de paie mensuel
   */
  @Post('cycles/ouvrir')
  @Permissions('rh.payroll.calculate')
  @ApiOperation({
    summary: 'Ouvrir un nouveau cycle de paie mensuel',
    description: 'Initialise la période de paie pour un mois donné (ex: 06/2026) pour un établissement ou pour tout le tenant.',
  })
  @ApiResponse({ status: 201, description: 'Cycle de paie ouvert avec succès' })
  openCycle(
    @Body() dto: OpenCyclePaieDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.paieService.openCycle(dto, req.user.tenantId);
  }

  // =========================================================================
  // ÉLÉMENTS VARIABLES DE PAIE (EVP)
  // =========================================================================

  /**
   * Lister les éléments variables saisis sur un cycle
   */
  @Get('cycles/:id/variables')
  @Permissions('rh.read')
  @ApiOperation({ summary: 'Lister les éléments variables saisis pour un cycle' })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du cycle de paie' })
  @ApiResponse({ status: 200, description: 'Liste des éléments variables' })
  getVariables(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.paieService.getElementsVariables(req.user.tenantId, id);
  }

  /**
   * Saisir un élément variable pour un employé donné
   */
  @Post('cycles/:id/variables')
  @Permissions('rh.payroll.calculate')
  @ApiOperation({
    summary: 'Saisir un élément variable (prime, déduction, avantage)',
    description: 'Ajoute une prime de rendement, retenue sur prêt, avance sur salaire ou indemnité kilométrique.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du cycle de paie' })
  @ApiResponse({ status: 201, description: 'Élément variable enregistré' })
  createVariable(
    @Param('id') id: string,
    @Body() dto: CreateElementVariableDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.paieService.createOrUpdateElementVariable(id, dto, req.user.tenantId, req.user.sub);
  }

  /**
   * Saisie en masse de variables de paie (grille multi-salariés)
   */
  @Post('cycles/:id/variables/batch')
  @Permissions('rh.payroll.calculate')
  @ApiOperation({
    summary: 'Saisie en masse d’éléments variables (grille multi-employés)',
    description: 'Enregistre en un seul appel plusieurs variables pour différents salariés du cycle.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du cycle de paie' })
  @ApiResponse({ status: 201, description: 'Variables en masse enregistrées' })
  batchVariables(
    @Param('id') id: string,
    @Body() dto: BatchElementVariableDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.paieService.batchCreateElementsVariables(id, dto, req.user.tenantId, req.user.sub);
  }

  // =========================================================================
  // MOTEUR DE CALCUL DE PAIE & VALIDATION
  // =========================================================================

  /**
   * Lancer le calcul 1-clic de la paie pour tous les salariés du cycle
   */
  @Post('cycles/:id/calculer')
  @Permissions('rh.payroll.calculate')
  @ApiOperation({
    summary: 'Calculer la paie pour tous les salariés du cycle (1-clic)',
    description: 'Exécute le moteur de paie complet : salaire brut, CNSS salariale 3,6%, abattement forfaitaire de 25% (frais professionnels), barème progressif ITS Art. 125, déductions pour charges de famille, cotisations patronales CNSS 17,4% et VPS 4%, net à payer final.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du cycle de paie' })
  @ApiResponse({ status: 200, description: 'Calcul de paie terminé avec génération des bulletins' })
  calculateCycle(
    @Param('id') id: string,
    @Body() dto: CalculateCyclePaieDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.paieService.calculateCycle(id, dto, req.user.tenantId, req.user.sub);
  }

  /**
   * Valider et clôturer définitivement un cycle de paie
   */
  @Patch('cycles/:id/valider')
  @Permissions('rh.payroll.validate')
  @ApiOperation({
    summary: 'Valider et verrouiller le cycle de paie',
    description: 'Verrouille le cycle (statut CLOTURE) et fige les bulletins de paie, empêchant toute modification ultérieure.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du cycle de paie' })
  @ApiResponse({ status: 200, description: 'Cycle validé et clôturé avec succès' })
  validateCycle(
    @Param('id') id: string,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.paieService.validateCycle(id, req.user.tenantId, req.user.sub);
  }

  // =========================================================================
  // BULLETINS DE SALAIRE
  // =========================================================================

  /**
   * Lister les bulletins de paie
   */
  @Get('bulletins')
  @Permissions('rh.read')
  @ApiOperation({ summary: 'Lister les bulletins de paie' })
  @ApiQuery({ name: 'cyclePaieId', required: false })
  @ApiQuery({ name: 'employeId', required: false })
  @ApiQuery({ name: 'annee', required: false, example: 2026 })
  @ApiResponse({ status: 200, description: 'Liste des bulletins de paie' })
  getBulletins(
    @Request() req: { user: { tenantId: string } },
    @Query('cyclePaieId') cyclePaieId?: string,
    @Query('employeId') employeId?: string,
    @Query('annee') annee?: string,
  ) {
    return this.paieService.getBulletins(
      req.user.tenantId,
      cyclePaieId,
      employeId,
      annee ? parseInt(annee, 10) : undefined,
    );
  }

  /**
   * Consulter un bulletin de salaire détaillé avec toutes ses lignes de calcul
   */
  @Get('bulletins/:id')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Visualiser un bulletin de paie complet (conforme OHADA / Bénin)',
    description: 'Affiche le bulletin officiel : en-tête employeur/salarié, salaire de base, primes, heures supplémentaires, brut imposable, charges salariales, ITS, net à payer en lettres, charges patronales et compteurs de congés.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du bulletin de paie' })
  @ApiResponse({ status: 200, description: 'Bulletin de paie complet retourné' })
  @ApiResponse({ status: 404, description: 'Bulletin introuvable' })
  getBulletinById(
    @Param('id') id: string,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.paieService.getBulletinById(id, req.user.tenantId, req.user.sub);
  }

  // =========================================================================
  // RÉMUNÉRATIONS EXCEPTIONNELLES (QUOTIENT FISCAL ART. 126 CGI)
  // =========================================================================

  /**
   * Ajouter une gratification ou 13e mois traité par la méthode du quotient
   */
  @Post('cycles/:id/remunerations-exceptionnelles')
  @Permissions('rh.payroll.calculate')
  @ApiOperation({
    summary: 'Ajouter une rémunération exceptionnelle avec calcul du quotient (Art. 126 CGI)',
    description: 'Applique le mécanisme fiscal du quotient (CGI Bénin Art. 126) : lissage de l’impôt sur 12 mois pour éviter la sur-imposition des primes annuelles et 13e mois.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du cycle de paie' })
  @ApiResponse({ status: 201, description: 'Rémunération exceptionnelle enregistrée et calculée' })
  createRemunerationExceptionnelle(
    @Param('id') id: string,
    @Body() dto: CreateRemunerationExceptionnelleDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.paieService.createRemunerationExceptionnelle(id, dto, req.user.tenantId);
  }

  // =========================================================================
  // SOLDE DE TOUT COMPTE & CERTIFICAT DE TRAVAIL
  // =========================================================================

  /**
   * Lister les soldes de tout compte de l'entreprise
   */
  @Get('soldes-tout-compte')
  @Permissions('rh.read')
  @ApiOperation({ summary: 'Lister les soldes de tout compte' })
  @ApiQuery({ name: 'employeId', required: false })
  @ApiResponse({ status: 200, description: 'Liste des soldes de tout compte' })
  getSoldesToutCompte(
    @Request() req: { user: { tenantId: string } },
    @Query('employeId') employeId?: string,
  ) {
    return this.paieService.getSoldesToutCompte(req.user.tenantId, employeId);
  }

  /**
   * Générer le solde de tout compte d'un salarié quittant l'entreprise
   */
  @Post('soldes-tout-compte')
  @Permissions('rh.payroll.calculate')
  @ApiOperation({
    summary: 'Générer un solde de tout compte et certificat de travail',
    description: 'Calcule l’indemnité de congés payés non pris, le salaire du dernier mois au prorata temporis, l’indemnité de préavis éventuelle et l’indemnité de licenciement légale/conventionnelle.',
  })
  @ApiResponse({ status: 201, description: 'Solde de tout compte généré avec succès' })
  createSoldeToutCompte(
    @Body() dto: CreateSoldeToutCompteDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.paieService.createSoldeToutCompte(dto, req.user.tenantId);
  }

  /**
   * Enregistrer la signature du reçu pour solde de tout compte
   */
  @Patch('soldes-tout-compte/:id/signer')
  @Permissions('rh.payroll.validate')
  @ApiOperation({
    summary: 'Enregistrer la signature du reçu pour solde de tout compte',
    description: 'Valide le reçu libératoire et génère la décharge signée.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du solde de tout compte' })
  @ApiResponse({ status: 200, description: 'Reçu signé et enregistré' })
  signerSoldeToutCompte(
    @Param('id') id: string,
    @Body() dto: SignerSoldeToutCompteDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.paieService.signerSoldeToutCompte(id, dto, req.user.tenantId);
  }
}
