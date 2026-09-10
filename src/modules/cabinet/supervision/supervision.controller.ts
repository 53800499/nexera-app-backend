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
import { SupervisionService } from './supervision.service';
import {
  CreateCabinetChecklistControleDto,
  CreateCabinetPointRevueDto,
  SubmitChecklistItemResultatDto,
  UpdateCabinetPointRevueDto,
} from '../dto/supervision.dto';
import {
  CabinetModuleSource,
  CabinetNiveauSeverite,
  CabinetStatutPointRevue,
} from '@prisma/client';

@ApiTags('cabinet-supervision')
@ApiBearerAuth('access-token')
@Controller('cabinet/supervision')
@UseGuards(JwtAuthGuard, PermissionsGuard, CabinetTenantGuard)
export class SupervisionController {
  constructor(private readonly supervisionService: SupervisionService) {}

  @Get('points-revue')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Lister les points de revue transverses' })
  @ApiQuery({ name: 'mandatId', required: false })
  @ApiQuery({ name: 'moduleSource', enum: CabinetModuleSource, required: false })
  @ApiQuery({ name: 'statut', enum: CabinetStatutPointRevue, required: false })
  @ApiQuery({ name: 'niveau', enum: CabinetNiveauSeverite, required: false })
  listPointsRevue(
    @Request() req: { user: { tenantId: string } },
    @Query('mandatId') mandatId?: string,
    @Query('moduleSource') moduleSource?: CabinetModuleSource,
    @Query('statut') statut?: CabinetStatutPointRevue,
    @Query('niveau') niveau?: CabinetNiveauSeverite,
  ) {
    return this.supervisionService.listPointsRevue(req.user.tenantId, {
      mandatId,
      moduleSource,
      statut,
      niveau,
    });
  }

  @Get('points-revue/objet/:objetType/:objetId')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'objetType' })
  @ApiParam({ name: 'objetId', description: "Identifiant ou référence de l'objet métier" })
  @ApiOperation({ summary: 'Obtenir les points de revue attachés à un objet précis' })
  getPointsRevueByObjet(
    @Request() req: { user: { tenantId: string } },
    @Param('objetType') objetType: string,
    @Param('objetId') objetId: string,
  ) {
    return this.supervisionService.getPointsRevueByObjet(
      req.user.tenantId,
      objetType,
      objetId,
    );
  }

  @Post('points-revue')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Créer un point de revue sur un objet métier' })
  createPointRevue(
    @Request() req: { user: { tenantId: string; id?: string } },
    @Body() dto: CreateCabinetPointRevueDto,
  ) {
    return this.supervisionService.createPointRevue(
      req.user.tenantId,
      req.user.id || null,
      dto,
    );
  }

  @Patch('points-revue/:id')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Mettre à jour un point de revue' })
  updatePointRevue(
    @Request() req: { user: { tenantId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCabinetPointRevueDto,
  ) {
    return this.supervisionService.updatePointRevue(req.user.tenantId, id, dto);
  }

  @Delete('points-revue/:id')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Supprimer un point de revue' })
  deletePointRevue(
    @Request() req: { user: { tenantId: string } },
    @Param('id') id: string,
  ) {
    return this.supervisionService.deletePointRevue(req.user.tenantId, id);
  }

  @Get('checklists')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Lister les modèles de checklists qualité' })
  listChecklists(@Request() req: { user: { tenantId: string } }) {
    return this.supervisionService.listChecklistsControle(req.user.tenantId);
  }

  @Post('checklists')
  @Permissions('manage:settings', 'cabinet.read')
  @ApiOperation({ summary: 'Créer un modèle de checklist qualité' })
  createChecklist(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateCabinetChecklistControleDto,
  ) {
    return this.supervisionService.createChecklistControle(
      req.user.tenantId,
      dto,
    );
  }

  @Post('checklists/resultats')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Soumettre une diligence de checklist' })
  submitChecklistResultat(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: SubmitChecklistItemResultatDto,
  ) {
    return this.supervisionService.submitChecklistItemResultat(
      req.user.tenantId,
      dto,
    );
  }
}
