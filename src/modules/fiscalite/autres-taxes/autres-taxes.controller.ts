import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { AutresTaxesService } from './autres-taxes.service';

@ApiTags('fiscalite-autres-taxes')
@ApiBearerAuth('access-token')
@Controller('fiscalite/autres-taxes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AutresTaxesController {
  constructor(private readonly autresTaxesService: AutresTaxesService) {}

  @Post('patente/simuler')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Simuler le calcul de la contribution des patentes (zone 1 ou 2, CGI 2026 Art. 202)' })
  simulerPatente(
    @Body() body: { chiffreAffaires: number; zoneAdministrative?: string },
  ) {
    return this.autresTaxesService.calculerPatente(
      body.chiffreAffaires,
      body.zoneAdministrative || '1ère zone',
    );
  }

  @Get('declarations')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Lister les déclarations de taxes génériques (Patente, TPS, TFU)' })
  @ApiQuery({ name: 'taxContribuableId', required: true })
  @ApiQuery({ name: 'taxTypeCode', required: false, example: 'PATENTE' })
  async getDeclarations(
    @Query('taxContribuableId') taxContribuableId: string,
    @Query('taxTypeCode') taxTypeCode?: string,
  ) {
    return this.autresTaxesService.getDeclarationsGeneriques(taxContribuableId, taxTypeCode);
  }

  @Post('declarations')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Créer une déclaration pour un impôt générique' })
  async creerDeclaration(
    @Body()
    body: {
      taxContribuableId: string;
      taxTypeId: string;
      periodeOuExercice: string;
      baseImposable?: number;
      montantCalcule: number;
      dateLimiteLegale: string;
      libelleLigne?: string;
    },
  ) {
    return this.autresTaxesService.creerDeclarationGenerique(body);
  }

  @Put('declarations/:id/valider')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Valider une déclaration générique' })
  async validerDeclaration(@Param('id') id: string) {
    return this.autresTaxesService.validerDeclaration(id);
  }

  @Put('declarations/:id/declarer')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Marquer une déclaration générique comme déclarée / télétransmise' })
  async declarerDeclaration(@Param('id') id: string) {
    return this.autresTaxesService.declarerDeclaration(id);
  }

  @Put('declarations/:id/payer')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Marquer une déclaration générique comme payée' })
  async marquerPayee(@Param('id') id: string) {
    return this.autresTaxesService.marquerPayee(id);
  }

  @Delete('declarations/:id')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Supprimer une déclaration générique' })
  async supprimerDeclaration(@Param('id') id: string) {
    return this.autresTaxesService.supprimerDeclaration(id);
  }
}
