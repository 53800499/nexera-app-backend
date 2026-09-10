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
import { MissionsService } from './missions.service';
import {
  CreateCabinetEcheanceDto,
  CreateCabinetMissionDto,
  CreateCabinetTacheDto,
  UpdateCabinetEcheanceDto,
  UpdateCabinetMissionDto,
  UpdateCabinetTacheDto,
} from '../dto/missions.dto';
import {
  CabinetStatutEcheance,
  CabinetStatutMission,
} from '@prisma/client';

@ApiTags('cabinet-missions')
@ApiBearerAuth('access-token')
@Controller('cabinet/missions')
@UseGuards(JwtAuthGuard, PermissionsGuard, CabinetTenantGuard)
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  @Get()
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Lister les missions du cabinet avec filtres' })
  @ApiQuery({ name: 'mandatId', required: false })
  @ApiQuery({ name: 'statut', enum: CabinetStatutMission, required: false })
  @ApiQuery({ name: 'collaborateurId', required: false })
  listMissions(
    @Request() req: { user: { tenantId: string } },
    @Query('mandatId') mandatId?: string,
    @Query('statut') statut?: CabinetStatutMission,
    @Query('collaborateurId') collaborateurId?: string,
  ) {
    return this.missionsService.listMissions(req.user.tenantId, {
      mandatId,
      statut,
      collaborateurId,
    });
  }

  @Get('calendrier-consolide')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Consulter le calendrier consolidé du cabinet' })
  @ApiQuery({ name: 'mandatId', required: false })
  @ApiQuery({ name: 'statut', enum: CabinetStatutEcheance, required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  listCalendrier(
    @Request() req: { user: { tenantId: string } },
    @Query('mandatId') mandatId?: string,
    @Query('statut') statut?: CabinetStatutEcheance,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.missionsService.listEcheancesConsolidees(req.user.tenantId, {
      mandatId,
      statut,
      startDate,
      endDate,
    });
  }

  @Post('calendrier-consolide')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Ajouter une échéance au calendrier consolidé' })
  createEcheance(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateCabinetEcheanceDto,
  ) {
    return this.missionsService.createEcheance(req.user.tenantId, dto);
  }

  @Patch('calendrier-consolide/:id')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Mettre à jour une échéance consolidée' })
  updateEcheance(
    @Request() req: { user: { tenantId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCabinetEcheanceDto,
  ) {
    return this.missionsService.updateEcheance(req.user.tenantId, id, dto);
  }

  @Get(':id')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Détail d’une mission' })
  getMission(
    @Request() req: { user: { tenantId: string } },
    @Param('id') id: string,
  ) {
    return this.missionsService.getMissionById(req.user.tenantId, id);
  }

  @Post()
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Créer une mission' })
  createMission(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateCabinetMissionDto,
  ) {
    return this.missionsService.createMission(req.user.tenantId, dto);
  }

  @Patch(':id')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Mettre à jour une mission' })
  updateMission(
    @Request() req: { user: { tenantId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCabinetMissionDto,
  ) {
    return this.missionsService.updateMission(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Supprimer une mission' })
  deleteMission(
    @Request() req: { user: { tenantId: string } },
    @Param('id') id: string,
  ) {
    return this.missionsService.deleteMission(req.user.tenantId, id);
  }

  @Post('taches')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Créer une tâche sur une mission' })
  createTache(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateCabinetTacheDto,
  ) {
    return this.missionsService.createTache(req.user.tenantId, dto);
  }

  @Patch('taches/:tacheId')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'tacheId', format: 'uuid' })
  @ApiOperation({ summary: 'Modifier une tâche' })
  updateTache(
    @Request() req: { user: { tenantId: string } },
    @Param('tacheId') tacheId: string,
    @Body() dto: UpdateCabinetTacheDto,
  ) {
    return this.missionsService.updateTache(req.user.tenantId, tacheId, dto);
  }

  @Delete('taches/:tacheId')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'tacheId', format: 'uuid' })
  @ApiOperation({ summary: 'Supprimer une tâche' })
  deleteTache(
    @Request() req: { user: { tenantId: string } },
    @Param('tacheId') tacheId: string,
  ) {
    return this.missionsService.deleteTache(req.user.tenantId, tacheId);
  }
}
