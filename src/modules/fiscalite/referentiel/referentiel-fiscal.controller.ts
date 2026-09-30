import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ReferentielFiscalService } from './referentiel-fiscal.service';
import {
  CreateSourceReglementaireDto,
  CreateTaxBaremeDto,
  CreateTaxParametrePaysDto,
  CreateTaxRegimeDto,
  QualifySourceReglementaireDto,
  UpdateSourceReglementaireDto,
  UpdateTaxBaremeDto,
  UpdateTaxParametrePaysDto,
  UpdateTaxRegimeDto,
  ValidateTaxBaremeDto,
} from '../dto/fiscalite.dto';

@ApiTags('fiscalite-referentiel')
@ApiBearerAuth('access-token')
@Controller('fiscalite/referentiel')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReferentielFiscalController {
  constructor(private readonly referentielService: ReferentielFiscalService) {}

  @Get('pays')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Consulter la liste des pays et leur configuration fiscale' })
  async getPays() {
    return this.referentielService.getPays();
  }

  @Get('types')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Lister le catalogue des types d’impôts et taxes' })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  async getTypes(@Query('paysCode') paysCode?: string) {
    return this.referentielService.getTypes(paysCode);
  }

  // ---------------- BARÈMES ----------------

  @Get('baremes')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Consulter les barèmes fiscaux versionnés' })
  @ApiQuery({ name: 'taxTypeId', required: false })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  async getBaremes(
    @Query('taxTypeId') taxTypeId?: string,
    @Query('paysCode') paysCode?: string,
  ) {
    return this.referentielService.getBaremes(taxTypeId, paysCode);
  }

  @Post('baremes')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Créer un nouveau barème fiscal (statut BROUILLON)' })
  async createBareme(@Body() dto: CreateTaxBaremeDto, @Request() req: any) {
    return this.referentielService.createBareme(dto, req.user?.id || req.user?.userId);
  }

  @Put('baremes/:id')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Modifier un barème fiscal' })
  async updateBareme(@Param('id') id: string, @Body() dto: UpdateTaxBaremeDto) {
    return this.referentielService.updateBareme(id, dto);
  }

  @Post('baremes/:id/dupliquer')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Dupliquer un barème fiscal' })
  async duplicateBareme(
    @Param('id') id: string,
    @Body('dateDebutValidite') dateDebutValidite?: string,
  ) {
    return this.referentielService.duplicateBareme(id, dateDebutValidite);
  }

  @Delete('baremes/:id')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Supprimer un barème fiscal' })
  async deleteBareme(@Param('id') id: string) {
    return this.referentielService.deleteBareme(id);
  }

  @Put('baremes/:id/valider')
  @Permissions('fiscalite.baremes.validate')
  @ApiOperation({ summary: 'Valider et activer un barème (Double contrôle EF-008)' })
  async validerBareme(
    @Param('id') id: string,
    @Body() dto: ValidateTaxBaremeDto,
    @Request() req: any,
  ) {
    return this.referentielService.validerBareme(id, req.user?.id || req.user?.userId, dto);
  }

  // ---------------- SOURCES & VEILLE ----------------

  @Get('sources')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Consulter la veille réglementaire (CGI, arrêtés, circulaires)' })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  @ApiQuery({ name: 'statutVeille', required: false })
  async getSources(
    @Query('paysCode') paysCode?: string,
    @Query('statutVeille') statutVeille?: string,
  ) {
    return this.referentielService.getSources(paysCode, statutVeille);
  }

  @Post('sources')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Enregistrer une nouvelle source légale ou circulaire' })
  async createSource(@Body() dto: CreateSourceReglementaireDto, @Request() req: any) {
    return this.referentielService.createSource(dto, req.user?.id || req.user?.userId);
  }

  @Put('sources/:id')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Modifier une source réglementaire' })
  async updateSource(
    @Param('id') id: string,
    @Body() dto: UpdateSourceReglementaireDto,
  ) {
    return this.referentielService.updateSource(id, dto);
  }

  @Delete('sources/:id')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Supprimer une source réglementaire' })
  async deleteSource(@Param('id') id: string) {
    return this.referentielService.deleteSource(id);
  }

  @Put('sources/:id/qualifier')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Qualifier l’impact logiciel d’une source réglementaire' })
  async qualifierSource(
    @Param('id') id: string,
    @Body() dto: QualifySourceReglementaireDto,
  ) {
    return this.referentielService.qualifierSource(id, dto);
  }

  // ---------------- PARAMÈTRES PAYS ----------------

  @Get('parametres')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Lister les paramètres pays (taux de pénalités, plancher IS, seuils)' })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  async getParametres(@Query('paysCode') paysCode?: string) {
    return this.referentielService.getParametresPays(paysCode);
  }

  @Post('parametres')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Créer un nouveau paramètre fiscal pays' })
  async createParametre(@Body() dto: CreateTaxParametrePaysDto) {
    return this.referentielService.createParametrePays(dto);
  }

  @Put('parametres/:id')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Modifier un paramètre fiscal pays' })
  async updateParametre(
    @Param('id') id: string,
    @Body() dto: UpdateTaxParametrePaysDto,
  ) {
    return this.referentielService.updateParametrePays(id, dto);
  }

  @Delete('parametres/:id')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Supprimer un paramètre fiscal pays' })
  async deleteParametre(@Param('id') id: string) {
    return this.referentielService.deleteParametrePays(id);
  }

  // ---------------- RÉGIMES D'IMPOSITION ----------------

  @Get('regimes')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Lister les régimes d’imposition d’un pays' })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  async getRegimes(@Query('paysCode') paysCode?: string) {
    return this.referentielService.getRegimes(paysCode);
  }

  @Post('regimes')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Créer un nouveau régime d’imposition' })
  async createRegime(@Body() dto: CreateTaxRegimeDto) {
    return this.referentielService.createRegime(dto);
  }

  @Put('regimes/:id')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Modifier un régime d’imposition' })
  async updateRegime(@Param('id') id: string, @Body() dto: UpdateTaxRegimeDto) {
    return this.referentielService.updateRegime(id, dto);
  }

  @Delete('regimes/:id')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Supprimer un régime d’imposition' })
  async deleteRegime(@Param('id') id: string) {
    return this.referentielService.deleteRegime(id);
  }
}
