import {
  Body,
  Controller,
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
import { CalendrierFiscalService } from './calendrier-fiscal.service';

@ApiTags('fiscalite-calendrier')
@ApiBearerAuth('access-token')
@Controller('fiscalite/calendrier')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CalendrierFiscalController {
  constructor(private readonly calendrierService: CalendrierFiscalService) {}

  @Get('echeances')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Consulter le calendrier consolidé de toutes les échéances fiscales et pénalités estimées' })
  @ApiQuery({ name: 'taxContribuableId', required: true })
  @ApiQuery({ name: 'statut', required: false, example: 'A_VENIR' })
  async getEcheances(
    @Query('taxContribuableId') taxContribuableId: string,
    @Query('statut') statut?: string,
  ) {
    return this.calendrierService.getEcheances(taxContribuableId, statut);
  }

  @Post('synchroniser')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Générer ou rafraîchir automatiquement l’échéancier fiscal récurrent de l’entité' })
  async synchroniser(@Body() body: { taxContribuableId: string }) {
    return this.calendrierService.synchroniserEcheancesAutomatiques(body.taxContribuableId);
  }

  @Put('echeances/:id/payer')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Marquer une échéance fiscale comme acquittée' })
  async marquerPayee(@Param('id') id: string) {
    return this.calendrierService.marquerEcheancePayee(id);
  }

  @Post('echeances/:id/alertes')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Programmer une alerte d’échéance (J-30, J-15, J-7, J-3)' })
  async creerAlerte(
    @Param('id') id: string,
    @Body() body: { delaiJours: number; canal?: 'APPLICATION' | 'EMAIL' | 'SMS' },
    @Request() req: any,
  ) {
    return this.calendrierService.creerAlerte(
      id,
      body.delaiJours,
      req.user?.id || req.user?.userId,
      body.canal || 'APPLICATION',
    );
  }
}
