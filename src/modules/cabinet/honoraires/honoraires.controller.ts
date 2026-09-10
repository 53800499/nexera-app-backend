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
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CabinetTenantGuard } from '../../../common/guards/cabinet-tenant.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { HonorairesService } from './honoraires.service';
import {
  CreateCabinetNoteHonorairesDto,
  CreateCabinetTempsPasseDto,
  UpdateCabinetNoteHonorairesDto,
  UpdateCabinetTempsPasseDto,
} from '../dto/honoraires.dto';

@ApiTags('cabinet-honoraires')
@ApiBearerAuth('access-token')
@Controller('cabinet/honoraires')
@UseGuards(JwtAuthGuard, PermissionsGuard, CabinetTenantGuard)
export class HonorairesController {
  constructor(private readonly honorairesService: HonorairesService) {}

  @Get('temps')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Lister les relevés de temps passé' })
  @ApiQuery({ name: 'collaborateurId', required: false })
  @ApiQuery({ name: 'mandatId', required: false })
  @ApiQuery({ name: 'missionId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  listTemps(
    @Request() req: { user: { tenantId: string } },
    @Query('collaborateurId') collaborateurId?: string,
    @Query('mandatId') mandatId?: string,
    @Query('missionId') missionId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.honorairesService.listTempsPasses(req.user.tenantId, {
      collaborateurId,
      mandatId,
      missionId,
      startDate,
      endDate,
    });
  }

  @Post('temps')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Enregistrer une feuille de temps' })
  createTemps(
    @Request() req: { user: { tenantId: string; id?: string } },
    @Body() dto: CreateCabinetTempsPasseDto,
  ) {
    return this.honorairesService.createTempsPasse(
      req.user.tenantId,
      req.user.id || null,
      dto,
    );
  }

  @Patch('temps/:id')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Modifier une feuille de temps' })
  updateTemps(
    @Request() req: { user: { tenantId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCabinetTempsPasseDto,
  ) {
    return this.honorairesService.updateTempsPasse(req.user.tenantId, id, dto);
  }

  @Delete('temps/:id')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Supprimer une feuille de temps' })
  deleteTemps(
    @Request() req: { user: { tenantId: string } },
    @Param('id') id: string,
  ) {
    return this.honorairesService.deleteTempsPasse(req.user.tenantId, id);
  }

  @Get('notes')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Lister les factures d’honoraires du cabinet' })
  @ApiQuery({ name: 'mandatId', required: false })
  listNotes(
    @Request() req: { user: { tenantId: string } },
    @Query('mandatId') mandatId?: string,
  ) {
    return this.honorairesService.listNotesHonoraires(
      req.user.tenantId,
      mandatId,
    );
  }

  @Get('notes/:id')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Obtenir le détail d’une note d’honoraires' })
  getNote(
    @Request() req: { user: { tenantId: string } },
    @Param('id') id: string,
  ) {
    return this.honorairesService.getNoteHonorairesById(req.user.tenantId, id);
  }

  @Post('notes')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Émettre une note d’honoraires cabinet' })
  createNote(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateCabinetNoteHonorairesDto,
  ) {
    return this.honorairesService.createNoteHonoraires(req.user.tenantId, dto);
  }

  @Patch('notes/:id')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Modifier le statut d’une note d’honoraires' })
  updateNote(
    @Request() req: { user: { tenantId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCabinetNoteHonorairesDto,
  ) {
    return this.honorairesService.updateNoteHonoraires(
      req.user.tenantId,
      id,
      dto,
    );
  }
}
