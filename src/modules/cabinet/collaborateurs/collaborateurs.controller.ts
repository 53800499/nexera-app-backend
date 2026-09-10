import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CabinetTenantGuard } from '../../../common/guards/cabinet-tenant.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CollaborateursService } from './collaborateurs.service';
import {
  CreateCabinetCollaborateurDto,
  CreateCabinetHabilitationDto,
  CreateCabinetRoleDto,
  UpdateCabinetCollaborateurDto,
  UpdateCabinetHabilitationDto,
} from '../dto/collaborateurs.dto';

@ApiTags('cabinet-collaborateurs')
@ApiBearerAuth('access-token')
@Controller('cabinet/collaborateurs')
@UseGuards(JwtAuthGuard, PermissionsGuard, CabinetTenantGuard)
export class CollaborateursController {
  constructor(private readonly collaborateursService: CollaborateursService) {}

  @Get('roles')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Lister les rôles internes au cabinet' })
  listRoles() {
    return this.collaborateursService.listRoles();
  }

  @Post('roles')
  @Permissions('manage:settings')
  @ApiOperation({ summary: 'Créer un nouveau rôle cabinet' })
  createRole(@Body() dto: CreateCabinetRoleDto) {
    return this.collaborateursService.createRole(dto);
  }

  @Get()
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Lister les collaborateurs du cabinet' })
  listCollaborateurs(@Request() req: { user: { tenantId: string } }) {
    return this.collaborateursService.listCollaborateurs(req.user.tenantId);
  }

  @Get(':id')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Obtenir la fiche d’un collaborateur' })
  getCollaborateur(
    @Request() req: { user: { tenantId: string } },
    @Param('id') id: string,
  ) {
    return this.collaborateursService.getCollaborateurById(req.user.tenantId, id);
  }

  @Post()
  @Permissions('manage:users', 'cabinet.read')
  @ApiOperation({ summary: 'Créer un nouveau collaborateur' })
  createCollaborateur(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateCabinetCollaborateurDto,
  ) {
    return this.collaborateursService.createCollaborateur(req.user.tenantId, dto);
  }

  @Patch(':id')
  @Permissions('manage:users', 'cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Modifier un collaborateur' })
  updateCollaborateur(
    @Request() req: { user: { tenantId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCabinetCollaborateurDto,
  ) {
    return this.collaborateursService.updateCollaborateur(
      req.user.tenantId,
      id,
      dto,
    );
  }

  @Delete(':id')
  @Permissions('manage:users', 'cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Retirer un collaborateur' })
  deleteCollaborateur(
    @Request() req: { user: { tenantId: string } },
    @Param('id') id: string,
  ) {
    return this.collaborateursService.deleteCollaborateur(req.user.tenantId, id);
  }

  @Get('mandat/:mandatId/habilitations')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'mandatId', format: 'uuid' })
  @ApiOperation({ summary: 'Lister les collaborateurs habilités sur un mandat' })
  listHabilitations(
    @Request() req: { user: { tenantId: string } },
    @Param('mandatId') mandatId: string,
  ) {
    return this.collaborateursService.listHabilitationsByMandat(
      req.user.tenantId,
      mandatId,
    );
  }

  @Post('habilitations')
  @Permissions('manage:users', 'cabinet.read')
  @ApiOperation({ summary: 'Attribuer une habilitation sur un dossier client' })
  createHabilitation(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateCabinetHabilitationDto,
  ) {
    return this.collaborateursService.createHabilitation(req.user.tenantId, dto);
  }

  @Patch('habilitations/:habilitationId')
  @Permissions('manage:users', 'cabinet.read')
  @ApiParam({ name: 'habilitationId', format: 'uuid' })
  @ApiOperation({ summary: 'Modifier une habilitation' })
  updateHabilitation(
    @Request() req: { user: { tenantId: string } },
    @Param('habilitationId') habilitationId: string,
    @Body() dto: UpdateCabinetHabilitationDto,
  ) {
    return this.collaborateursService.updateHabilitation(
      req.user.tenantId,
      habilitationId,
      dto,
    );
  }

  @Delete('habilitations/:habilitationId')
  @Permissions('manage:users', 'cabinet.read')
  @ApiParam({ name: 'habilitationId', format: 'uuid' })
  @ApiOperation({ summary: 'Révoquer une habilitation' })
  deleteHabilitation(
    @Request() req: { user: { tenantId: string } },
    @Param('habilitationId') habilitationId: string,
  ) {
    return this.collaborateursService.deleteHabilitation(
      req.user.tenantId,
      habilitationId,
    );
  }
}
