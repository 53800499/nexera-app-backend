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
import { MissionsAvancesService } from './missions-avances.service';
import {
  CreateAvanceFraisDto,
  CreateMissionDto,
  RegulariserAvanceDto,
  UpdateMissionDto,
} from '../dto/missions.dto';

@ApiTags('notes-frais-missions-avances')
@ApiBearerAuth('access-token')
@Controller('notes-frais/missions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MissionsAvancesController {
  constructor(private readonly missionsService: MissionsAvancesService) {}

  @Get()
  @Permissions('ndf.read')
  @ApiOperation({ summary: 'Lister les ordres de mission' })
  @ApiQuery({ name: 'employeRefId', required: false })
  @ApiQuery({ name: 'statut', required: false })
  async getMissions(
    @Request() req: any,
    @Query('employeRefId') employeRefId?: string,
    @Query('statut') statut?: any,
  ) {
    return this.missionsService.getMissions(req.user.tenantId, {
      employeRefId,
      statut,
    });
  }

  @Get(':id')
  @Permissions('ndf.read')
  @ApiOperation({ summary: 'Consulter le détail d’un ordre de mission' })
  @ApiParam({ name: 'id', description: 'ID de la mission' })
  async getMissionById(@Request() req: any, @Param('id') id: string) {
    return this.missionsService.getMissionById(req.user.tenantId, id);
  }

  @Post()
  @Permissions('ndf.advances.manage')
  @ApiOperation({ summary: 'Créer un ordre de mission' })
  async createMission(@Request() req: any, @Body() dto: CreateMissionDto) {
    return this.missionsService.createMission(req.user.tenantId, dto);
  }

  @Patch(':id')
  @Permissions('ndf.advances.manage')
  @ApiOperation({ summary: 'Mettre à jour un ordre de mission' })
  @ApiParam({ name: 'id', description: 'ID de la mission' })
  async updateMission(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateMissionDto,
  ) {
    return this.missionsService.updateMission(req.user.tenantId, id, dto);
  }

  // ----------------------------------------------------
  // AVANCES DE FRAIS
  // ----------------------------------------------------

  @Get('avances/list')
  @Permissions('ndf.read')
  @ApiOperation({ summary: 'Lister les avances de trésorerie sur mission' })
  @ApiQuery({ name: 'employeRefId', required: false })
  @ApiQuery({ name: 'statut', required: false })
  async getAvances(
    @Request() req: any,
    @Query('employeRefId') employeRefId?: string,
    @Query('statut') statut?: any,
  ) {
    return this.missionsService.getAvances(req.user.tenantId, {
      employeRefId,
      statut,
    });
  }

  @Post('avances')
  @Permissions('ndf.advances.manage')
  @ApiOperation({ summary: 'Verser une avance de trésorerie' })
  async createAvance(@Request() req: any, @Body() dto: CreateAvanceFraisDto) {
    return this.missionsService.createAvance(req.user.tenantId, dto);
  }

  @Post('avances/:id/regulariser')
  @Permissions('ndf.advances.manage')
  @ApiOperation({ summary: 'Régulariser une avance de frais' })
  @ApiParam({ name: 'id', description: 'ID de l’avance' })
  async regulariserAvance(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: RegulariserAvanceDto,
  ) {
    return this.missionsService.regulariserAvance(req.user.tenantId, id, dto);
  }
}
