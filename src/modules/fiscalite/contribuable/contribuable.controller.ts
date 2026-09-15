import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ContribuableService } from './contribuable.service';
import { UpdateContribuableDto } from '../dto/fiscalite.dto';

@ApiTags('fiscalite-contribuable')
@ApiBearerAuth('access-token')
@Controller('fiscalite/contribuable')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContribuableController {
  constructor(private readonly contribuableService: ContribuableService) {}

  @Get('mon-profil')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Obtenir le profil fiscal de l’entité connectée (IFU, régimes, options)' })
  async getMonProfil(@Request() req: any) {
    const tenantId = req.user.tenantId;
    return this.contribuableService.getContribuableByTenant(tenantId);
  }

  @Put(':id')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Mettre à jour le profil fiscal du contribuable' })
  async updateProfil(
    @Param('id') id: string,
    @Body() dto: UpdateContribuableDto,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    return this.contribuableService.updateContribuable(id, tenantId, dto);
  }

  @Post(':id/options')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Ajouter une option fiscale (changement de régime, TVA débits)' })
  async addOption(
    @Param('id') id: string,
    @Body() body: { typeOption: string; dateEffet: string; documentUrl?: string },
  ) {
    return this.contribuableService.addOption(
      id,
      body.typeOption,
      body.dateEffet,
      body.documentUrl,
    );
  }

  @Post(':id/etablissements-secondaires')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Ajouter un établissement secondaire pour la patente locale' })
  async addEtablissementSecondaire(
    @Param('id') id: string,
    @Body() body: { libelle: string; zoneAdministrative?: string; adresse?: string },
  ) {
    return this.contribuableService.addEtablissementSecondaire(
      id,
      body.libelle,
      body.zoneAdministrative,
      body.adresse,
    );
  }
}
