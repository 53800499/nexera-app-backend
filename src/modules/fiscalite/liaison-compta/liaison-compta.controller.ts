import {
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { LiaisonComptaService } from './liaison-compta.service';

@ApiTags('fiscalite-liaison-compta')
@ApiBearerAuth('access-token')
@Controller('fiscalite/liaison-compta')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LiaisonComptaController {
  constructor(private readonly liaisonService: LiaisonComptaService) {}

  @Get('donnees-is/:exerciceId')
  @Permissions('fiscalite.read')
  @ApiOperation({
    summary: 'Consulter les données réelles du Grand Livre (Classes 6 et 7) pour le calcul de l’IS',
  })
  async getDonneesComptablesPourIs(
    @Param('exerciceId') exerciceId: string,
    @Request() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    return this.liaisonService.getDonneesComptablesPourIs(exerciceId, tenantId);
  }

  @Post('synchroniser-is/:exerciceId')
  @Permissions('fiscalite.is.manage')
  @ApiOperation({
    summary: 'Synchroniser le calcul de l’IS avec la comptabilité générale (Grand Livre)',
  })
  async synchroniserIs(
    @Param('exerciceId') exerciceId: string,
    @Request() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id || req.user?.userId;
    return this.liaisonService.synchroniserDonneesComptablesPourIs(exerciceId, tenantId, userId);
  }

  @Get('cadrage-tva/:declarationId')
  @Permissions('fiscalite.read')
  @ApiOperation({
    summary: 'Rapprochement comptable TVA : concordance des comptes 4431, 445x, 70x avec la déclaration périodique',
  })
  async getCadrageTva(
    @Param('declarationId') declarationId: string,
    @Request() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    return this.liaisonService.getCadrageTva(declarationId, tenantId);
  }

  @Post('generer-od-tva/:declarationId')
  @Permissions('fiscalite.tva.manage')
  @ApiOperation({
    summary: 'Générer ou régénérer l’écriture comptable de liquidation de TVA (Journal OD)',
  })
  async genererOdLiquidationTva(
    @Param('declarationId') declarationId: string,
    @Request() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    return this.liaisonService.genererOdLiquidationTva(declarationId, tenantId);
  }
}
