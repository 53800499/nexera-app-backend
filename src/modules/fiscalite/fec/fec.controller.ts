import {
  Body,
  Controller,
  Header,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { FecLigne, FecService } from './fec.service';
import { ExportFecDto } from '../dto/fiscalite.dto';

@ApiTags('fiscalite-fec')
@ApiBearerAuth('access-token')
@Controller('fiscalite/fec')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FecController {
  constructor(private readonly fecService: FecService) {}

  @Post('valider-conformite')
  @Permissions('fiscalite.fec.export')
  @ApiOperation({ summary: 'Vérifier la conformité d’écritures comptables aux 18 colonnes de l’Arrêté 1085-C Bénin' })
  validerConformite(@Body() body: { lignes: FecLigne[] }) {
    return this.fecService.validerConformite(body.lignes || []);
  }

  @Post('generer')
  @Permissions('fiscalite.fec.export')
  @ApiOperation({ summary: 'Générer le Fichier des Écritures Comptables (FEC) conforme à l’Arrêté 1085-C' })
  @ApiQuery({ name: 'taxContribuableId', required: true })
  async genererFec(
    @Query('taxContribuableId') taxContribuableId: string,
    @Body() dto: ExportFecDto,
    @Request() req: any,
  ) {
    const tenantId = req.user.tenantId;
    return this.fecService.genererFichierFec(tenantId, taxContribuableId, dto);
  }

  @Post('telecharger')
  @Permissions('fiscalite.fec.export')
  @ApiOperation({ summary: 'Télécharger directement le fichier FEC normalisé (CSV ou TXT)' })
  @ApiQuery({ name: 'taxContribuableId', required: true })
  async telechargerFec(
    @Query('taxContribuableId') taxContribuableId: string,
    @Body() dto: ExportFecDto,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const tenantId = req.user.tenantId;
    const resultat = await this.fecService.genererFichierFec(tenantId, taxContribuableId, dto);

    res.setHeader('Content-Type', resultat.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${resultat.nomFichier}"`);
    res.send(resultat.contenuFichier);
  }
}
