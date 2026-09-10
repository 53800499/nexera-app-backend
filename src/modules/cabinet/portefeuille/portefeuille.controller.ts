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
import { PortefeuilleService } from './portefeuille.service';
import {
  CreateCabinetClientContactDto,
  CreateCabinetLettreMissionDto,
  CreateCabinetMandatDto,
  UpdateCabinetClientContactDto,
  UpdateCabinetEntiteDto,
  UpdateCabinetLettreMissionDto,
  UpdateCabinetMandatDto,
} from '../dto/portefeuille.dto';

@ApiTags('cabinet-portefeuille')
@ApiBearerAuth('access-token')
@Controller('cabinet/portefeuille')
@UseGuards(JwtAuthGuard, PermissionsGuard, CabinetTenantGuard)
export class PortefeuilleController {
  constructor(private readonly portefeuilleService: PortefeuilleService) {}

  @Get('entite')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Obtenir la fiche identité du cabinet' })
  getEntite(@Request() req: { user: { tenantId: string } }) {
    return this.portefeuilleService.getOrCreateCabinetEntite(req.user.tenantId);
  }

  @Patch('entite')
  @Permissions('manage:settings')
  @ApiOperation({ summary: 'Mettre à jour la fiche identité du cabinet' })
  updateEntite(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: UpdateCabinetEntiteDto,
  ) {
    return this.portefeuilleService.updateCabinetEntite(req.user.tenantId, dto);
  }

  @Get('mandats')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Lister l’ensemble des mandats clients du cabinet' })
  listMandats(@Request() req: { user: { tenantId: string } }) {
    return this.portefeuilleService.listMandats(req.user.tenantId);
  }

  @Get('mandats/:mandatId')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'mandatId', format: 'uuid' })
  @ApiOperation({ summary: 'Détail 360° d’un mandat client' })
  getMandat(
    @Request() req: { user: { tenantId: string } },
    @Param('mandatId') mandatId: string,
  ) {
    return this.portefeuilleService.getMandatById(req.user.tenantId, mandatId);
  }

  @Post('mandats')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Créer un nouveau mandat pour une entreprise cliente' })
  createMandat(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateCabinetMandatDto,
  ) {
    return this.portefeuilleService.createMandat(req.user.tenantId, dto);
  }

  @Patch('mandats/:mandatId')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'mandatId', format: 'uuid' })
  @ApiOperation({ summary: 'Modifier un mandat' })
  updateMandat(
    @Request() req: { user: { tenantId: string } },
    @Param('mandatId') mandatId: string,
    @Body() dto: UpdateCabinetMandatDto,
  ) {
    return this.portefeuilleService.updateMandat(
      req.user.tenantId,
      mandatId,
      dto,
    );
  }

  @Delete('mandats/:mandatId')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'mandatId', format: 'uuid' })
  @ApiOperation({ summary: 'Supprimer un mandat' })
  deleteMandat(
    @Request() req: { user: { tenantId: string } },
    @Param('mandatId') mandatId: string,
  ) {
    return this.portefeuilleService.deleteMandat(req.user.tenantId, mandatId);
  }

  @Post('lettres-mission')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Créer une lettre de mission' })
  createLettreMission(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateCabinetLettreMissionDto,
  ) {
    return this.portefeuilleService.createLettreMission(
      req.user.tenantId,
      dto,
    );
  }

  @Patch('lettres-mission/:lettreId')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'lettreId', format: 'uuid' })
  @ApiOperation({ summary: 'Modifier une lettre de mission' })
  updateLettreMission(
    @Request() req: { user: { tenantId: string } },
    @Param('lettreId') lettreId: string,
    @Body() dto: UpdateCabinetLettreMissionDto,
  ) {
    return this.portefeuilleService.updateLettreMission(
      req.user.tenantId,
      lettreId,
      dto,
    );
  }

  @Post('contacts')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Ajouter un contact client pour un mandat' })
  addContact(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateCabinetClientContactDto,
  ) {
    return this.portefeuilleService.addClientContact(req.user.tenantId, dto);
  }

  @Patch('contacts/:contactId')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'contactId', format: 'uuid' })
  @ApiOperation({ summary: 'Modifier un contact client' })
  updateContact(
    @Request() req: { user: { tenantId: string } },
    @Param('contactId') contactId: string,
    @Body() dto: UpdateCabinetClientContactDto,
  ) {
    return this.portefeuilleService.updateClientContact(
      req.user.tenantId,
      contactId,
      dto,
    );
  }
}
