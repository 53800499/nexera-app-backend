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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { EcrituresService } from './ecritures.service';
import { ValidationService } from '../validation/validation.service';
import {
  CreateEcritureDto,
  ValidationDecisionDto,
  ValidationLotDto,
} from '../dto/compta.dto';

@ApiTags('compta-ecritures')
@ApiBearerAuth('access-token')
@Controller('compta/ecritures')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EcrituresController {
  constructor(
    private readonly ecrituresService: EcrituresService,
    private readonly validationService: ValidationService,
  ) {}

  @Get()
  @Permissions('compta.read')
  @ApiOperation({ summary: 'Lister les écritures comptables avec filtres' })
  @ApiQuery({ name: 'journalId', required: false })
  @ApiQuery({ name: 'exerciceId', required: false })
  @ApiQuery({ name: 'periodeId', required: false })
  @ApiQuery({ name: 'statut', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'dateDebut', required: false })
  @ApiQuery({ name: 'dateFin', required: false })
  async listEcritures(
    @Request() req: any,
    @Query('journalId') journalId?: string,
    @Query('exerciceId') exerciceId?: string,
    @Query('periodeId') periodeId?: string,
    @Query('statut') statut?: string,
    @Query('search') search?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.ecrituresService.listEcritures(tenantId, {
      journalId,
      exerciceId,
      periodeId,
      statut,
      search,
      dateDebut,
      dateFin,
    });
  }

  @Get(':id')
  @Permissions('compta.read')
  @ApiOperation({ summary: 'Consulter le détail d’une écriture avec ses lignes' })
  async getEcriture(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.ecrituresService.getEcritureById(tenantId, id);
  }

  @Post()
  @Permissions('compta.write')
  @ApiOperation({ summary: 'Saisir une nouvelle écriture comptable (brouillon)' })
  async createEcriture(@Request() req: any, @Body() dto: CreateEcritureDto) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.ecrituresService.createEcriture(tenantId, dto, userId);
  }

  @Put(':id')
  @Permissions('compta.write')
  @ApiOperation({ summary: 'Modifier une écriture (brouillon ou rejetée uniquement)' })
  async updateEcriture(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateEcritureDto>,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.ecrituresService.updateEcriture(tenantId, id, dto, userId);
  }

  @Delete(':id')
  @Permissions('compta.write')
  @ApiOperation({ summary: 'Supprimer une écriture brouillon' })
  async deleteEcriture(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.ecrituresService.deleteEcriture(tenantId, id);
  }

  @Post(':id/soumettre')
  @Permissions('compta.write')
  @ApiOperation({ summary: 'Soumettre une écriture brouillon pour validation' })
  async soumettreEcriturePost(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.ecrituresService.soumettreValidation(tenantId, id, userId);
  }

  @Put(':id/soumettre')
  @Permissions('compta.write')
  @ApiOperation({ summary: 'Soumettre une écriture brouillon pour validation' })
  async soumettreEcriturePut(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.ecrituresService.soumettreValidation(tenantId, id, userId);
  }

  // ---------------- VALIDATION (SÉPARATION DES TÂCHES EF-008) ----------------

  @Put(':id/valider')
  @Permissions('compta.ecritures.validate')
  @ApiOperation({ summary: 'Valider ou rejeter une écriture (EF-008 séparation des tâches)' })
  async validerEcriture(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ValidationDecisionDto,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    const userRoles = Array.isArray(req.user?.roles)
      ? req.user.roles
      : req.user?.role
        ? [req.user.role]
        : [];
    const isSuperviseurOrAdmin = userRoles.some((r: string) =>
      ['ADMIN', 'CEO', 'SUPER_ADMIN', 'admin', 'dirigeant', 'CABINET_ADMIN'].includes(r),
    );
    return this.validationService.deciderEcriture(
      tenantId,
      id,
      dto,
      userId,
      undefined,
      isSuperviseurOrAdmin,
    );
  }

  @Post('valider-lot')
  @Permissions('compta.ecritures.validate')
  @ApiOperation({ summary: 'Validation en masse d’un lot d’écritures' })
  async validerLot(@Request() req: any, @Body() dto: ValidationLotDto) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.validationService.validerLot(tenantId, dto, userId);
  }
}
