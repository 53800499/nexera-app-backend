import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
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
import { ReferentielService } from './referentiel.service';
import {
  CreateAvantageNatureDto,
  CreateBaremeItsDto,
  CreateBaremeTrancheDto,
  CreateCountryParamDto,
  CreateSocialChargeDto,
  DuplicateBaremeItsDto,
  ReplaceTranchesBatchDto,
  SimulateurFiscalDto,
  UpdateAvantageNatureDto,
  UpdateBaremeItsDto,
  UpdateBaremeTrancheDto,
  UpdateCountryParamDto,
  UpdateSocialChargeDto,
} from './dto/baremes-fiscaux.dto';

/**
 * Contrôleur Référentiel Légal et Paramètres Nationaux RH
 * 
 * Gestion intégrale des règles fiscales, barèmes progressifs d'ITS, cotisations sociales,
 * avantages en nature et paramètres réglementaires (Bénin CGI 2026, OHADA/UEMOA).
 */
@ApiTags('rh-referentiel')
@ApiBearerAuth('access-token')
@Controller('rh/referentiel')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReferentielController {
  constructor(private readonly referentielService: ReferentielService) {}

  // =========================================================================
  // PAYS
  // =========================================================================
  @Get('pays')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Lister les pays supportés',
    description: 'Retourne la liste des pays configurés avec leur code ISO 2 (ex: BJ pour Bénin) et devise par défaut (XOF).',
  })
  @ApiResponse({ status: 200, description: 'Liste des pays supportés retournée avec succès' })
  getCountries() {
    return this.referentielService.getCountries();
  }

  @Get('pays/:codeIso2')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Détail complet du paramétrage d’un pays (barèmes, taux, conventions, jours fériés)',
    description: 'Récupère la configuration intégrale d’un pays : barème ITS (CGI Art. 125), cotisations CNSS, VPS, calendrier des jours fériés et grilles salariales.',
  })
  @ApiParam({ name: 'codeIso2', description: 'Code ISO à 2 lettres du pays (ex: BJ)', example: 'BJ' })
  @ApiResponse({ status: 200, description: 'Détails du pays récupérés avec succès' })
  getCountryByIso(@Param('codeIso2') codeIso2: string) {
    return this.referentielService.getCountryByIso(codeIso2);
  }

  // =========================================================================
  // BARÈMES FISCAUX ITS (IMPÔT SUR LES TRAITEMENTS ET SALAIRES)
  // =========================================================================
  @Get(['baremes-its', 'tax-brackets'])
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Lister les barèmes ITS par pays',
    description: 'Retourne tous les barèmes d’ITS configurés avec leurs tranches progressives.',
  })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ', description: 'Code ISO2 du pays' })
  @ApiQuery({ name: 'includeExpired', required: false, type: Boolean, description: 'Inclure barèmes expirés' })
  @ApiResponse({ status: 200, description: 'Liste des barèmes ITS' })
  getBaremesIts(
    @Query('paysCode') paysCode = 'BJ',
    @Query('includeExpired') includeExpired?: string,
  ) {
    const inclExp = includeExpired === 'true' || includeExpired === '1';
    return this.referentielService.getBaremesIts(paysCode, inclExp);
  }

  @Get('baremes-its/:id')
  @Permissions('rh.read')
  @ApiOperation({ summary: 'Obtenir le détail d’un barème ITS et ses tranches' })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du barème ITS' })
  @ApiResponse({ status: 200, description: 'Détail du barème' })
  getBaremeItsById(@Param('id') id: string) {
    return this.referentielService.getBaremeItsById(id);
  }

  @Post('baremes-its')
  @Permissions('manage:rh')
  @ApiOperation({
    summary: 'Créer un nouveau barème ITS',
    description: 'Permet de créer un nouveau barème d’imposition avec ou sans tranches initiales.',
  })
  @ApiResponse({ status: 201, description: 'Barème ITS créé' })
  createBaremeIts(@Body() dto: CreateBaremeItsDto) {
    return this.referentielService.createBaremeIts(dto);
  }

  @Patch('baremes-its/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Modifier les métadonnées ou dates d’un barème ITS' })
  @ApiParam({ name: 'id', description: 'ID du barème' })
  @ApiResponse({ status: 200, description: 'Barème ITS modifié' })
  updateBaremeIts(
    @Param('id') id: string,
    @Body() dto: UpdateBaremeItsDto,
  ) {
    return this.referentielService.updateBaremeIts(id, dto);
  }

  @Delete('baremes-its/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Supprimer un barème ITS' })
  @ApiParam({ name: 'id', description: 'ID du barème' })
  @ApiResponse({ status: 200, description: 'Barème supprimé' })
  deleteBaremeIts(@Param('id') id: string) {
    return this.referentielService.deleteBaremeIts(id);
  }

  @Post('baremes-its/:id/dupliquer')
  @Permissions('manage:rh')
  @ApiOperation({
    summary: 'Dupliquer un barème pour une nouvelle année fiscale',
    description: 'Clôture automatiquement l’ancien barème à la veille de la nouvelle date de début et copie l’ensemble des tranches.',
  })
  @ApiParam({ name: 'id', description: 'ID du barème source' })
  @ApiResponse({ status: 201, description: 'Nouveau barème créé par duplication' })
  duplicateBaremeIts(
    @Param('id') id: string,
    @Body() dto: DuplicateBaremeItsDto,
  ) {
    return this.referentielService.duplicateBaremeIts(id, dto);
  }

  // --- TRANCHES FISCALES DU BARÈME ---
  @Post('baremes-its/:id/tranches')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Ajouter une tranche à un barème ITS' })
  @ApiParam({ name: 'id', description: 'ID du barème ITS' })
  @ApiResponse({ status: 201, description: 'Tranche ajoutée' })
  addBaremeItsTranche(
    @Param('id') baremeItsId: string,
    @Body() dto: CreateBaremeTrancheDto,
  ) {
    return this.referentielService.addBaremeItsTranche(baremeItsId, dto);
  }

  @Patch('baremes-its/tranches/:trancheId')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Modifier une tranche fiscale d’un barème' })
  @ApiParam({ name: 'trancheId', description: 'ID de la tranche' })
  @ApiResponse({ status: 200, description: 'Tranche modifiée' })
  updateBaremeItsTranche(
    @Param('trancheId') trancheId: string,
    @Body() dto: UpdateBaremeTrancheDto,
  ) {
    return this.referentielService.updateBaremeItsTranche(trancheId, dto);
  }

  @Delete('baremes-its/tranches/:trancheId')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Supprimer une tranche fiscale' })
  @ApiParam({ name: 'trancheId', description: 'ID de la tranche' })
  @ApiResponse({ status: 200, description: 'Tranche supprimée' })
  deleteBaremeItsTranche(@Param('trancheId') trancheId: string) {
    return this.referentielService.deleteBaremeItsTranche(trancheId);
  }

  @Put('baremes-its/:id/tranches')
  @Permissions('manage:rh')
  @ApiOperation({
    summary: 'Remplacer en bloc toutes les tranches d’un barème ITS',
    description: 'Valide la cohérence des tranches (continuité, bornes, taux) et remplace la grille complète dans une transaction.',
  })
  @ApiParam({ name: 'id', description: 'ID du barème' })
  @ApiResponse({ status: 200, description: 'Tranches du barème remplacées' })
  replaceBaremeItsTranches(
    @Param('id') id: string,
    @Body() dto: ReplaceTranchesBatchDto,
  ) {
    return this.referentielService.replaceBaremeItsTranches(id, dto);
  }

  // =========================================================================
  // CHARGES SOCIALES & PATRONALES (CNSS, VPS)
  // =========================================================================
  @Get(['charges-sociales', 'social-charges'])
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Lister les taux de cotisations sociales et patronales (CNSS, VPS)',
    description: 'Retourne la liste des cotisations : CNSS Salariale (3,6%), CNSS Patronale Prestations (17,4%), VPS Patronal (4%).',
  })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Liste des charges sociales et patronales' })
  getSocialCharges(
    @Query('paysCode') paysCode = 'BJ',
    @Query('includeInactive') includeInactive?: string,
  ) {
    const incl = includeInactive === 'true' || includeInactive === '1';
    return this.referentielService.getSocialCharges(paysCode, incl);
  }

  @Get('charges-sociales/:id')
  @Permissions('rh.read')
  @ApiOperation({ summary: 'Détail d’un taux de cotisation sociale ou patronale' })
  @ApiParam({ name: 'id', description: 'ID de la charge' })
  @ApiResponse({ status: 200, description: 'Détail de la charge' })
  getSocialChargeById(@Param('id') id: string) {
    return this.referentielService.getSocialChargeById(id);
  }

  @Post('charges-sociales')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Créer un nouveau taux de cotisation sociale ou patronale' })
  @ApiResponse({ status: 201, description: 'Charge créée' })
  createSocialCharge(@Body() dto: CreateSocialChargeDto) {
    return this.referentielService.createSocialCharge(dto);
  }

  @Patch('charges-sociales/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Modifier un taux de cotisation sociale ou patronale' })
  @ApiParam({ name: 'id', description: 'ID de la charge' })
  @ApiResponse({ status: 200, description: 'Charge modifiée' })
  updateSocialCharge(
    @Param('id') id: string,
    @Body() dto: UpdateSocialChargeDto,
  ) {
    return this.referentielService.updateSocialCharge(id, dto);
  }

  @Delete('charges-sociales/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Supprimer un taux de charge sociale' })
  @ApiParam({ name: 'id', description: 'ID de la charge' })
  @ApiResponse({ status: 200, description: 'Charge supprimée' })
  deleteSocialCharge(@Param('id') id: string) {
    return this.referentielService.deleteSocialCharge(id);
  }

  // =========================================================================
  // AVANTAGES EN NATURE (CGI Art. 123)
  // =========================================================================
  @Get(['avantages-nature', 'benefits-in-kind'])
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Lister les règles d’évaluation forfaitaire des avantages en nature',
    description: 'Logement (15%), Domesticité (15%), Électricité, Eau, Téléphone, Nourriture, Véhicules (CGI Bénin Art. 123).',
  })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  @ApiResponse({ status: 200, description: 'Liste des barèmes d’avantages en nature' })
  getAvantagesNature(@Query('paysCode') paysCode = 'BJ') {
    return this.referentielService.getAvantagesNature(paysCode);
  }

  @Get('avantages-nature/:id')
  @Permissions('rh.read')
  @ApiOperation({ summary: 'Détail d’un barème d’avantage en nature' })
  @ApiParam({ name: 'id', description: 'ID de l’avantage' })
  @ApiResponse({ status: 200, description: 'Détail de l’avantage en nature' })
  getAvantageNatureById(@Param('id') id: string) {
    return this.referentielService.getAvantageNatureById(id);
  }

  @Post('avantages-nature')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Créer une règle d’évaluation forfaitaire d’avantage en nature' })
  @ApiResponse({ status: 201, description: 'Règle créée' })
  createAvantageNature(@Body() dto: CreateAvantageNatureDto) {
    return this.referentielService.createAvantageNature(dto);
  }

  @Patch('avantages-nature/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Modifier une règle d’évaluation forfaitaire d’avantage en nature' })
  @ApiParam({ name: 'id', description: 'ID de l’avantage' })
  @ApiResponse({ status: 200, description: 'Règle modifiée' })
  updateAvantageNature(
    @Param('id') id: string,
    @Body() dto: UpdateAvantageNatureDto,
  ) {
    return this.referentielService.updateAvantageNature(id, dto);
  }

  @Delete('avantages-nature/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Supprimer une règle d’avantage en nature' })
  @ApiParam({ name: 'id', description: 'ID de l’avantage' })
  @ApiResponse({ status: 200, description: 'Règle supprimée' })
  deleteAvantageNature(@Param('id') id: string) {
    return this.referentielService.deleteAvantageNature(id);
  }

  // =========================================================================
  // PARAMÈTRES RÉGLEMENTAIRES PAYS
  // =========================================================================
  @Get('parametres')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Paramètres légaux par pays (SMIG, durées légales, majorations HS)',
    description: 'Renvoie le SMIG légal (52 000 FCFA au Bénin), la durée hebdomadaire standard (40h) et les taux de majoration des heures sup (+15%, +50%, +100%).',
  })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  @ApiResponse({ status: 200, description: 'Paramètres légaux' })
  getCountryParams(@Query('paysCode') paysCode = 'BJ') {
    return this.referentielService.getCountryParams(paysCode);
  }

  @Get('parametres/:id')
  @Permissions('rh.read')
  @ApiOperation({ summary: 'Détail d’un paramètre pays' })
  @ApiParam({ name: 'id', description: 'ID du paramètre' })
  @ApiResponse({ status: 200, description: 'Paramètre pays' })
  getCountryParamById(@Param('id') id: string) {
    return this.referentielService.getCountryParamById(id);
  }

  @Post('parametres')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Créer un paramètre légal pays' })
  @ApiResponse({ status: 201, description: 'Paramètre créé' })
  createCountryParam(@Body() dto: CreateCountryParamDto) {
    return this.referentielService.createCountryParam(dto);
  }

  @Patch('parametres/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Modifier un paramètre légal pays' })
  @ApiParam({ name: 'id', description: 'ID du paramètre' })
  @ApiResponse({ status: 200, description: 'Paramètre modifié' })
  updateCountryParam(
    @Param('id') id: string,
    @Body() dto: UpdateCountryParamDto,
  ) {
    return this.referentielService.updateCountryParam(id, dto);
  }

  @Delete('parametres/:id')
  @Permissions('manage:rh')
  @ApiOperation({ summary: 'Supprimer un paramètre pays' })
  @ApiParam({ name: 'id', description: 'ID du paramètre' })
  @ApiResponse({ status: 200, description: 'Paramètre supprimé' })
  deleteCountryParam(@Param('id') id: string) {
    return this.referentielService.deleteCountryParam(id);
  }

  // =========================================================================
  // SIMULATEUR FISCAL & SOCIAL EN DIRECT
  // =========================================================================
  @Post(['simulateur-fiscal', 'tax-simulator'])
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Simulateur fiscal & social en direct',
    description: 'Calcule tranche par tranche l’ITS progressif, le VPS patronal, la CNSS salariale et patronale, et la redevance ORTB en direct à partir d’un salaire brut ou net imposable.',
  })
  @ApiResponse({ status: 200, description: 'Résultat détaillé de la simulation fiscale' })
  simulateFiscalCalculation(@Body() dto: SimulateurFiscalDto) {
    return this.referentielService.simulateFiscalCalculation(dto);
  }

  // =========================================================================
  // AUTRES RÉFÉRENTIELS (Jours fériés, Conventions, Congés, Rubriques)
  // =========================================================================
  @Get(['jours-feries', 'holidays'])
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Calendrier des jours fériés légaux',
    description: 'Retourne la liste des jours fériés officiels pour l’année spécifiée.',
  })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  @ApiQuery({ name: 'annee', required: false, example: 2026, description: 'Année civile' })
  @ApiResponse({ status: 200, description: 'Liste des jours fériés' })
  getPublicHolidays(
    @Query('paysCode') paysCode = 'BJ',
    @Query('annee') annee = '2026',
  ) {
    return this.referentielService.getPublicHolidays(paysCode, parseInt(annee, 10));
  }

  @Get(['conventions', 'collective-agreements'])
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Conventions collectives et grilles salariales',
    description: 'Expose les catégories professionnelles (ouvriers, employés, agents de maîtrise, cadres) et salaires minima conventionnels.',
  })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  @ApiResponse({ status: 200, description: 'Conventions collectives et catégories' })
  getCollectiveAgreements(@Query('paysCode') paysCode = 'BJ') {
    return this.referentielService.getCollectiveAgreements(paysCode);
  }

  @Get(['types-absence', 'absence-types'])
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Référentiel des types d’absence',
    description: 'Types d’absence légaux (Congé payé, Maladie, Maternité, Événement familial, Sans solde) avec déductibilité de la paie et des droits à congé.',
  })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  @ApiResponse({ status: 200, description: 'Types d’absence' })
  getLeaveTypes(@Query('paysCode') paysCode = 'BJ') {
    return this.referentielService.getLeaveTypes(paysCode);
  }

  @Get('rubriques-paie')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Catalogue des rubriques de paie et comptes comptables',
    description: 'Catalogue officiel des rubriques SYSCOHADA (6611 Salaires, 6612 Primes, 6641 CNSS Patronale, 421 Personnel, 431 CNSS, 447 DGI/ITS).',
  })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  @ApiResponse({ status: 200, description: 'Rubriques de paie SYSCOHADA' })
  getPayrollRubrics(@Query('paysCode') paysCode = 'BJ') {
    return this.referentielService.getPayrollRubrics(paysCode);
  }
}
