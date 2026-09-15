import {
  Body,
  Controller,
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
  QualifySourceReglementaireDto,
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

  @Put('sources/:id/qualifier')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Qualifier l’impact logiciel d’une source réglementaire' })
  async qualifierSource(
    @Param('id') id: string,
    @Body() dto: QualifySourceReglementaireDto,
  ) {
    return this.referentielService.qualifierSource(id, dto);
  }

  @Get('parametres')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Lister les paramètres pays (taux de pénalités, plancher IS, seuils)' })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  async getParametres(@Query('paysCode') paysCode?: string) {
    return this.referentielService.getParametresPays(paysCode);
  }

  @Get('regimes')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Lister les régimes d’imposition d’un pays' })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  async getRegimes(@Query('paysCode') paysCode?: string) {
    return this.referentielService.getRegimes(paysCode);
  }
}
