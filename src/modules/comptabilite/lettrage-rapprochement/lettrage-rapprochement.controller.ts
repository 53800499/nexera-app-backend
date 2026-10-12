import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { LettrageRapprochementService } from './lettrage-rapprochement.service';

@ApiTags('compta-lettrage-rapprochement')
@ApiBearerAuth('access-token')
@Controller('compta/lettrage-rapprochement')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LettrageRapprochementController {
  constructor(
    private readonly lettrageRapprochementService: LettrageRapprochementService,
  ) {}

  // -------------------------------------------------------------------------
  // UC-10 : LETTRAGE
  // -------------------------------------------------------------------------

  @Get('lettrage/non-lettrees')
  @Permissions('compta.lettrage.execute')
  async getLignesNonLettrees(
    @Request() req: any,
    @Query('compteAuxiliaireId') compteAuxiliaireId: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.lettrageRapprochementService.getLignesNonLettrees(
      tenantId,
      compteAuxiliaireId,
    );
  }

  @Post('lettrage/manuel')
  @Permissions('compta.lettrage.execute')
  async lettrerManuel(
    @Request() req: any,
    @Body()
    dto: {
      compteAuxiliaireId: string;
      ligneIds: string[];
      codeLettre?: string;
    },
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.lettrageRapprochementService.lettrerManuel(
      tenantId,
      dto,
      userId,
    );
  }

  @Post('lettrage/automatique')
  @Permissions('compta.lettrage.execute')
  async lettrerAutomatique(
    @Request() req: any,
    @Body() dto: { compteAuxiliaireId: string },
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.lettrageRapprochementService.lettrerAutomatique(
      tenantId,
      dto.compteAuxiliaireId,
      userId,
    );
  }

  @Delete('lettrage/:id')
  @Permissions('compta.lettrage.execute')
  async delettrer(
    @Request() req: any,
    @Param('id') lettrageId: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.lettrageRapprochementService.delettrer(
      tenantId,
      lettrageId,
      userId,
    );
  }

  // -------------------------------------------------------------------------
  // UC-11 : RAPPROCHEMENT BANCAIRE
  // -------------------------------------------------------------------------

  @Post('rapprochement/import')
  @Permissions('compta.rapprochement.manage')
  async importerReleve(
    @Request() req: any,
    @Body()
    dto: {
      journalId: string;
      formatSource: 'CSV' | 'OFX' | 'MT940';
      dateDebut: string;
      dateFin: string;
      soldeOuverture?: number;
      soldeCloture?: number;
      lignes: Array<{
        dateOperation: string;
        libelle: string;
        montant: number;
        referenceBancaire?: string;
      }>;
    },
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.lettrageRapprochementService.importerReleve(
      tenantId,
      dto,
      userId,
    );
  }

  @Post('rapprochement/:releveId/automatique')
  @Permissions('compta.rapprochement.manage')
  async rapprocherAutomatique(
    @Request() req: any,
    @Param('releveId') releveId: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.lettrageRapprochementService.rapprocherAutomatique(
      tenantId,
      releveId,
      userId,
    );
  }

  @Post('rapprochement/manuel')
  @Permissions('compta.rapprochement.manage')
  async rapprocherManuel(
    @Request() req: any,
    @Body() dto: { ligneReleveId: string; ecritureLigneId: string },
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.lettrageRapprochementService.rapprocherManuel(
      tenantId,
      dto,
      userId,
    );
  }

  @Delete('rapprochement/:rapprochementId')
  @Permissions('compta.rapprochement.manage')
  async annulerRapprochement(
    @Request() req: any,
    @Param('rapprochementId') rapprochementId: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.lettrageRapprochementService.annulerRapprochement(
      tenantId,
      rapprochementId,
    );
  }

  @Get('rapprochement/:releveId/etat')
  @Permissions('compta.rapprochement.manage')
  async getEtatRapprochement(
    @Request() req: any,
    @Param('releveId') releveId: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.lettrageRapprochementService.getEtatRapprochement(
      tenantId,
      releveId,
    );
  }
}
