import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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

/**
 * Contrôleur Référentiel Légal et Paramètres Nationaux RH
 * 
 * Expose les règles fiscales, barèmes sociaux, conventions collectives
 * et jours fériés légaux pour les pays supportés (Bénin CGI 2026, OHADA).
 */
@ApiTags('rh-referentiel')
@ApiBearerAuth('access-token')
@Controller('rh/referentiel')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReferentielController {
  constructor(private readonly referentielService: ReferentielService) {}

  /**
   * Lister l'ensemble des pays d'imposition supportés par NEXERA RH
   */
  @Get('pays')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Lister les pays supportés',
    description: 'Retourne la liste des pays configurés avec leur code ISO 2 (ex: BJ pour Bénin) et devise par défaut (XOF).',
  })
  @ApiResponse({ status: 200, description: 'Liste des pays supportés retournée avec succès' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Permission rh.read requise' })
  getCountries() {
    return this.referentielService.getCountries();
  }

  /**
   * Consulter la configuration légale et fiscale exhaustive d'un pays
   */
  @Get('pays/:codeIso2')
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Détail complet du paramétrage d’un pays (barèmes, taux, conventions, jours fériés)',
    description: 'Récupère la configuration intégrale d’un pays : barème ITS (CGI Art. 125), cotisations CNSS, VPS, calendrier des jours fériés et grilles salariales.',
  })
  @ApiParam({ name: 'codeIso2', description: 'Code ISO à 2 lettres du pays (ex: BJ)', example: 'BJ' })
  @ApiResponse({ status: 200, description: 'Détails du pays récupérés avec succès' })
  @ApiResponse({ status: 404, description: 'Pays non trouvé dans le référentiel légal' })
  getCountryByIso(@Param('codeIso2') codeIso2: string) {
    return this.referentielService.getCountryByIso(codeIso2);
  }

  /**
   * Obtenir les tranches d'imposition sur le revenu salarial (ITS)
   */
  @Get(['baremes-its', 'tax-brackets'])
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Barèmes ITS progressifs par pays',
    description: 'Retourne les tranches du barème d’impôt sur les traitements et salaires (CGI Bénin 2026 Art. 125 : 0%, 10%, 15%, 20%, 30%).',
  })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ', description: 'Code ISO2 du pays' })
  @ApiResponse({ status: 200, description: 'Tranches du barème ITS' })
  getBaremesIts(@Query('paysCode') paysCode = 'BJ') {
    return this.referentielService.getBaremesIts(paysCode);
  }

  /**
   * Obtenir les taux de cotisations sociales (CNSS salariale et patronale, VPS)
   */
  @Get(['charges-sociales', 'social-charges'])
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Taux de cotisations sociales et patronales (CNSS, VPS)',
    description: 'Retourne la liste des cotisations sociales obligatoires : CNSS Salariale (3,6%), CNSS Patronale Prestations (17,4%), VPS Patronal (4%).',
  })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  @ApiResponse({ status: 200, description: 'Taux des charges sociales' })
  getSocialCharges(@Query('paysCode') paysCode = 'BJ') {
    return this.referentielService.getSocialCharges(paysCode);
  }

  /**
   * Obtenir le calendrier des jours fériés chômés et payés
   */
  @Get(['jours-feries', 'holidays'])
  @Permissions('rh.read')
  @ApiOperation({
    summary: 'Calendrier des jours fériés légaux',
    description: 'Retourne la liste des jours fériés officiels pour l’année spécifiée (ex: 1er Janvier, Fête du Vaudou 10 Janvier, Fête du Travail 1er Mai, Fête Nationale 1er Août).',
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

  /**
   * Obtenir les conventions collectives et grilles salariales conventionnelles
   */
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

  /**
   * Obtenir les paramètres légaux généraux (SMIG, majorations d'heures supplémentaires)
   */
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

  /**
   * Obtenir les types de congés et motifs d'absence autorisés
   */
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

  /**
   * Obtenir le catalogue des rubriques de paie préconfigurées
   */
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
