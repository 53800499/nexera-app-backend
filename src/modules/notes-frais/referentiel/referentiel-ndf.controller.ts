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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ReferentielNdfService } from './referentiel-ndf.service';
import {
  CalculerIndemniteKmDto,
  CalculerPerDiemDto,
  CreateBaremeKmDto,
  CreateBaremePerDiemDto,
  CreateCategorieDepenseDto,
  CreatePolitiqueDepenseDto,
  UpdateBaremeKmDto,
  UpdateBaremePerDiemDto,
  UpdateCategorieDepenseDto,
} from '../dto/referentiel.dto';

@ApiTags('notes-frais-referentiel')
@ApiBearerAuth('access-token')
@Controller('notes-frais/referentiel')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReferentielNdfController {
  constructor(private readonly referentielService: ReferentielNdfService) {}

  @Get('categories')
  @Permissions('ndf.read')
  @ApiOperation({ summary: 'Lister les catégories de dépenses de notes de frais' })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  async getCategories(@Query('paysCode') paysCode?: string) {
    return this.referentielService.getCategories(paysCode);
  }

  @Post('categories')
  @Permissions('manage:ndf')
  @ApiOperation({ summary: 'Créer une catégorie de dépense' })
  async createCategorie(@Body() dto: CreateCategorieDepenseDto) {
    return this.referentielService.createCategorie(dto);
  }

  @Post('categories/seed')
  @Permissions('manage:ndf')
  @ApiOperation({ summary: 'Initialiser les catégories de dépenses par défaut' })
  async seedCategories() {
    return this.referentielService.seedDefaultCategories();
  }

  @Put('categories/:id')
  @Permissions('manage:ndf')
  @ApiOperation({ summary: 'Mettre à jour une catégorie de dépense' })
  async updateCategorie(
    @Param('id') id: string,
    @Body() dto: UpdateCategorieDepenseDto,
  ) {
    return this.referentielService.updateCategorie(id, dto);
  }

  @Delete('categories/:id')
  @Permissions('manage:ndf')
  @ApiOperation({ summary: 'Supprimer une catégorie de dépense' })
  async deleteCategorie(@Param('id') id: string) {
    return this.referentielService.deleteCategorie(id);
  }

  @Get('politiques')
  @Permissions('ndf.read')
  @ApiOperation({ summary: 'Lister les politiques et plafonds de dépenses du tenant' })
  async getPolitiques(@Request() req: any) {
    return this.referentielService.getPolitiques(req.user.tenantId);
  }

  @Post('politiques')
  @Permissions('ndf.settings.manage', 'manage:ndf')
  @ApiOperation({ summary: 'Définir une politique/plafond de dépenses' })
  async createPolitique(
    @Request() req: any,
    @Body() dto: CreatePolitiqueDepenseDto,
  ) {
    return this.referentielService.createPolitique(req.user.tenantId, dto);
  }

  // ----------------------------------------------------
  // BARÈMES KILOMÉTRIQUES (CGI BÉNIN 2026)
  // ----------------------------------------------------

  @Get('baremes-km')
  @Permissions('ndf.read')
  @ApiOperation({ summary: 'Lister les barèmes kilométriques par pays' })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  async getBaremesKm(@Query('paysCode') paysCode?: string) {
    return this.referentielService.getBaremesKm(paysCode);
  }

  @Post('baremes-km')
  @Permissions('ndf.settings.manage', 'manage:ndf')
  @ApiOperation({ summary: 'Créer un barème kilométrique' })
  async createBaremeKm(@Body() dto: CreateBaremeKmDto) {
    return this.referentielService.createBaremeKm(dto);
  }

  @Put('baremes-km/:id')
  @Permissions('ndf.settings.manage', 'manage:ndf')
  @ApiOperation({ summary: 'Mettre à jour un barème kilométrique' })
  async updateBaremeKm(
    @Param('id') id: string,
    @Body() dto: UpdateBaremeKmDto,
  ) {
    return this.referentielService.updateBaremeKm(id, dto);
  }

  @Delete('baremes-km/:id')
  @Permissions('ndf.settings.manage', 'manage:ndf')
  @ApiOperation({ summary: 'Supprimer un barème kilométrique' })
  async deleteBaremeKm(@Param('id') id: string) {
    return this.referentielService.deleteBaremeKm(id);
  }

  @Post('baremes-km/seed-officiel-benin')
  @Permissions('ndf.settings.manage', 'manage:ndf')
  @ApiOperation({ summary: 'Réinitialiser les barèmes kilométriques officiels Bénin 2026' })
  async seedBaremesKmOfficielBenin() {
    return this.referentielService.seedBaremesKmOfficielBenin();
  }

  @Post('calculer-indemnite-km')
  @Permissions('ndf.read')
  @ApiOperation({ summary: 'Calculer le montant d’une indemnité kilométrique' })
  async calculerIndemniteKm(@Body() dto: CalculerIndemniteKmDto) {
    return this.referentielService.calculerIndemniteKm(dto);
  }

  // ----------------------------------------------------
  // BARÈMES PER DIEM (FORFAITS JOURNALIERS DE MISSION)
  // ----------------------------------------------------

  @Get('baremes-per-diem')
  @Permissions('ndf.read')
  @ApiOperation({ summary: 'Lister les barèmes per diem par zone géographique' })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  async getBaremesPerDiem(@Query('paysCode') paysCode?: string) {
    return this.referentielService.getBaremesPerDiem(paysCode);
  }

  @Post('baremes-per-diem')
  @Permissions('ndf.settings.manage', 'manage:ndf')
  @ApiOperation({ summary: 'Créer un barème per diem' })
  async createBaremePerDiem(@Body() dto: CreateBaremePerDiemDto) {
    return this.referentielService.createBaremePerDiem(dto);
  }

  @Put('baremes-per-diem/:id')
  @Permissions('ndf.settings.manage', 'manage:ndf')
  @ApiOperation({ summary: 'Mettre à jour un barème per diem' })
  async updateBaremePerDiem(
    @Param('id') id: string,
    @Body() dto: UpdateBaremePerDiemDto,
  ) {
    return this.referentielService.updateBaremePerDiem(id, dto);
  }

  @Delete('baremes-per-diem/:id')
  @Permissions('ndf.settings.manage', 'manage:ndf')
  @ApiOperation({ summary: 'Supprimer un barème per diem' })
  async deleteBaremePerDiem(@Param('id') id: string) {
    return this.referentielService.deleteBaremePerDiem(id);
  }

  @Post('baremes-per-diem/seed-officiel-benin')
  @Permissions('ndf.settings.manage', 'manage:ndf')
  @ApiOperation({ summary: 'Réinitialiser les barèmes per diem officiels Bénin 2026' })
  async seedBaremesPerDiemOfficielBenin() {
    return this.referentielService.seedBaremesPerDiemOfficielBenin();
  }

  @Post('calculer-per-diem')
  @Permissions('ndf.read')
  @ApiOperation({ summary: 'Calculer le montant d’une indemnité per diem' })
  async calculerPerDiem(@Body() dto: CalculerPerDiemDto) {
    return this.referentielService.calculerPerDiem(dto);
  }

  @Get('parametres-pays')
  @Permissions('ndf.read')
  @ApiOperation({ summary: 'Lister les paramètres pays (seuil espèces, délais soumission)' })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  async getParametresPays(@Query('paysCode') paysCode?: string) {
    return this.referentielService.getParametresPays(paysCode);
  }
}

