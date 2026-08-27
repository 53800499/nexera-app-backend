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
import { RapportsFraisService } from './rapports-frais.service';
import {
  CreateRapportFraisDto,
  RejeterRapportDto,
  UpdateRapportFraisDto,
  ValiderRapportDto,
} from '../dto/rapports-frais.dto';

@ApiTags('notes-frais-rapports')
@ApiBearerAuth('access-token')
@Controller('notes-frais/rapports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RapportsFraisController {
  constructor(private readonly rapportsService: RapportsFraisService) {}

  @Get()
  @Permissions('ndf.read')
  @ApiOperation({ summary: 'Lister les notes de frais avec filtres et pagination' })
  @ApiQuery({ name: 'employeRefId', required: false })
  @ApiQuery({ name: 'statut', required: false })
  async getRapports(
    @Request() req: any,
    @Query('employeRefId') employeRefId?: string,
    @Query('statut') statut?: any,
  ) {
    return this.rapportsService.getRapports(req.user.tenantId, {
      employeRefId,
      statut,
    });
  }

  @Get(':id')
  @Permissions('ndf.read')
  @ApiOperation({ summary: 'Consulter une note de frais détaillée' })
  @ApiParam({ name: 'id', description: 'ID du rapport' })
  async getRapportById(@Request() req: any, @Param('id') id: string) {
    return this.rapportsService.getRapportById(req.user.tenantId, id);
  }

  @Post()
  @Permissions('ndf.expenses.submit')
  @ApiOperation({ summary: 'Créer une note de frais (brouillon)' })
  async createRapport(@Request() req: any, @Body() dto: CreateRapportFraisDto) {
    return this.rapportsService.createRapport(req.user.tenantId, dto);
  }

  @Patch(':id')
  @Permissions('ndf.expenses.submit')
  @ApiOperation({ summary: 'Mettre à jour les informations d’une note de frais' })
  @ApiParam({ name: 'id', description: 'ID du rapport' })
  async updateRapport(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateRapportFraisDto,
  ) {
    return this.rapportsService.updateRapport(req.user.tenantId, id, dto);
  }

  @Post(':id/soumettre')
  @Permissions('ndf.expenses.submit')
  @ApiOperation({ summary: 'Soumettre une note de frais pour validation manager' })
  @ApiParam({ name: 'id', description: 'ID du rapport' })
  async soumettreRapport(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.sub || req.user.id || req.user.userId || 'system';
    return this.rapportsService.soumettreRapport(
      req.user.tenantId,
      id,
      userId,
    );
  }

  @Post(':id/valider')
  @Permissions('ndf.reports.validate')
  @ApiOperation({
    summary:
      'Approuver une note de frais (déclenche écriture M3, TVA M7 et paiement)',
  })
  @ApiParam({ name: 'id', description: 'ID du rapport' })
  async validerRapport(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ValiderRapportDto,
  ) {
    const userId = req.user.sub || req.user.id || req.user.userId || 'system';
    return this.rapportsService.validerRapport(
      req.user.tenantId,
      id,
      userId,
      dto,
    );
  }

  @Post(':id/rejeter')
  @Permissions('ndf.reports.validate')
  @ApiOperation({ summary: 'Rejeter une note de frais avec motif' })
  @ApiParam({ name: 'id', description: 'ID du rapport' })
  async rejeterRapport(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: RejeterRapportDto,
  ) {
    const userId = req.user.sub || req.user.id || req.user.userId || 'system';
    return this.rapportsService.rejeterRapport(
      req.user.tenantId,
      id,
      userId,
      dto,
    );
  }
}
