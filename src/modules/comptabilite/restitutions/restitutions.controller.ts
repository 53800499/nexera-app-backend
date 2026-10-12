import {
  Controller,
  Get,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RestitutionsService } from './restitutions.service';

@ApiTags('compta-restitutions')
@ApiBearerAuth('access-token')
@Controller('compta/restitutions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RestitutionsController {
  constructor(private readonly restitutionsService: RestitutionsService) {}

  @Get('grand-livre')
  @Permissions('compta.grandlivre.read')
  async getGrandLivre(
    @Request() req: any,
    @Query('exerciceId') exerciceId?: string,
    @Query('compteId') compteId?: string,
    @Query('compteNumero') compteNumero?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('avecAuxiliaires') avecAuxiliaires?: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.restitutionsService.getGrandLivre(tenantId, {
      exerciceId,
      compteId,
      compteNumero,
      dateDebut,
      dateFin,
      avecAuxiliaires: avecAuxiliaires === 'true',
    });
  }

  @Get('balance')
  @Permissions('compta.balance.read')
  async getBalanceGenerale(
    @Request() req: any,
    @Query('exerciceId') exerciceId: string,
    @Query('periodeId') periodeId?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.restitutionsService.getBalanceGenerale(tenantId, {
      exerciceId,
      periodeId,
      dateDebut,
      dateFin,
    });
  }

  @Get('balance-auxiliaire')
  @Permissions('compta.balance.read')
  async getBalanceAuxiliaire(
    @Request() req: any,
    @Query('exerciceId') exerciceId: string,
    @Query('compteCollectifId') compteCollectifId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.restitutionsService.getBalanceAuxiliaire(tenantId, {
      exerciceId,
      compteCollectifId,
    });
  }
}
