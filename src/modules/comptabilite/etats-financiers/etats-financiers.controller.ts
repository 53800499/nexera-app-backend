import {
  Body,
  Controller,
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
import { AuditService } from './audit.service';
import { EtatsFinanciersService } from './etats-financiers.service';
import { FecService } from './fec.service';

@ApiTags('compta-etats-financiers')
@ApiBearerAuth('access-token')
@Controller('compta/etats-financiers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EtatsFinanciersController {
  constructor(
    private readonly etatsFinanciersService: EtatsFinanciersService,
    private readonly fecService: FecService,
    private readonly auditService: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // UC-17 : ÉTATS FINANCIERS SYSCOHADA
  // -------------------------------------------------------------------------

  @Post('generer')
  @Permissions('compta.etats.generate')
  async genererEtatsFinanciers(
    @Request() req: any,
    @Body()
    dto: {
      exerciceId: string;
      systemeRetenu?: 'SN' | 'SMT';
      typeEdition?: 'PROVISOIRE' | 'DEFINITIF';
    },
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.etatsFinanciersService.genererEtatsFinanciers(
      tenantId,
      dto.exerciceId,
      {
        systemeRetenu: dto.systemeRetenu,
        typeEdition: dto.typeEdition,
      },
      userId,
    );
  }

  // -------------------------------------------------------------------------
  // UC-15 / UC-16 : INTERFACE M7 (IS)
  // -------------------------------------------------------------------------

  @Get('m7/resultat/:exerciceId')
  @Permissions('compta.etats.read')
  async exposerResultatPourM7(
    @Request() req: any,
    @Param('exerciceId') exerciceId: string,
    @Query('demandeur') demandeur?: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.etatsFinanciersService.exposerResultatPourM7(
      tenantId,
      exerciceId,
      demandeur || 'M7',
    );
  }

  @Post('m7/recevoir-is')
  @Permissions('compta.ecritures.write')
  async recevoirEcritureRetourIs(
    @Request() req: any,
    @Body()
    dto: {
      exerciceId: string;
      montantIs: number;
      referenceCalculIsExterne: string;
    },
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.etatsFinanciersService.recevoirEcritureRetourIs(
      tenantId,
      dto,
      userId,
    );
  }

  // -------------------------------------------------------------------------
  // UC-18 : FEC (FICHIER DES ÉCRITURES COMPTABLES)
  // -------------------------------------------------------------------------

  @Post('fec/generer')
  @Permissions('compta.fec.export')
  async genererFec(
    @Request() req: any,
    @Body()
    dto: {
      exerciceId: string;
      format?: 'CSV' | 'TXT_TAB' | 'TXT_PIPE';
      motifGeneration?: 'A_LA_DEMANDE' | 'ARCHIVAGE' | 'CONTROLE_FISCAL';
    },
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.fecService.genererFec(
      tenantId,
      dto.exerciceId,
      {
        format: dto.format,
        motifGeneration: dto.motifGeneration,
      },
      userId,
    );
  }

  @Get('fec/historique')
  @Permissions('compta.fec.export')
  async getHistoriqueFec(
    @Request() req: any,
    @Query('exerciceId') exerciceId?: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.fecService.getHistoriqueExports(tenantId, exerciceId);
  }

  // -------------------------------------------------------------------------
  // UC-20 : JOURNAL D'AUDIT
  // -------------------------------------------------------------------------

  @Get('audit')
  @Permissions('compta.audit.read')
  async getJournalAudit(
    @Request() req: any,
    @Query('categorie') categorie?: string,
    @Query('action') action?: string,
    @Query('entiteType') entiteType?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('limite') limite?: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.auditService.getJournalAudit(tenantId, {
      categorie,
      action,
      entiteType,
      dateDebut,
      dateFin,
      limite: limite ? parseInt(limite, 10) : undefined,
    });
  }
}
