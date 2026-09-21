import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { InventoryService } from './inventory.service';
import { InventoryPdfService } from './inventory-pdf.service';
import {
  CreateInventorySessionDto,
  SubmitInventoryCountsDto,
} from './dto/create-inventory-session.dto';

@ApiTags('stock-inventory')
@ApiBearerAuth('access-token')
@Controller('stock/inventories')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly inventoryPdfService: InventoryPdfService,
  ) {}

  @Get()
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Lister les sessions d’inventaire (UC-S06)' })
  findAll(@Request() req: { user: { tenantId: string } }) {
    return this.inventoryService.findAll(req.user.tenantId);
  }

  @Get(':id/pdf')
  @Permissions('stock.read')
  @ApiOperation({
    summary: 'Télécharger le rapport ou la feuille de comptage en PDF',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'type', required: false, enum: ['report', 'sheet'] })
  async downloadPdf(
    @Param('id') id: string,
    @Query('type') type: 'report' | 'sheet' | undefined,
    @Request() req: { user: { tenantId: string } },
    @Res() res: Response,
  ) {
    try {
      const { buffer, filename } = await this.inventoryPdfService.generatePdf(
        req.user.tenantId,
        id,
        type === 'sheet' ? 'sheet' : 'report',
      );
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=60',
      });
      res.send(buffer);
    } catch (err: any) {
      console.error('[InventoryPdfService] Error generating PDF:', err);
      const status = err?.status || 500;
      res.status(status).json({
        statusCode: status,
        message: err?.message || 'Erreur lors de la génération du PDF d’inventaire',
      });
    }
  }

  @Get(':id')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Détail d’une session (avec stock théorique)' })
  findOne(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.inventoryService.findOne(id, req.user.tenantId);
  }

  @Get(':id/count-sheet')
  @Permissions('stock.read')
  @ApiOperation({
    summary: 'Feuille de comptage — théorique masqué (RM-INV02)',
  })
  getCountSheet(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.inventoryService.getCountSheet(id, req.user.tenantId);
  }

  @Get(':id/variances')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Analyse des écarts' })
  @ApiQuery({ name: 'significantOnly', required: false })
  getVariances(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
    @Query('significantOnly') significantOnly?: string,
  ) {
    return this.inventoryService.getVariances(
      id,
      req.user.tenantId,
      significantOnly === 'true',
    );
  }

  @Post()
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Créer une session d’inventaire' })
  create(
    @Body() dto: CreateInventorySessionDto,
    @Request() req: { user: { tenantId: string; sub: string } },
  ) {
    return this.inventoryService.create(
      dto,
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Post(':id/start')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Démarrer le comptage (gel éventuel RM-INV01)' })
  start(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.inventoryService.start(id, req.user.tenantId);
  }

  @Post(':id/counts')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Saisir les quantités comptées' })
  submitCounts(
    @Param('id') id: string,
    @Body() dto: SubmitInventoryCountsDto,
    @Request() req: { user: { tenantId: string; sub: string } },
  ) {
    return this.inventoryService.submitCounts(
      id,
      dto,
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Post(':id/complete-count')
  @Permissions('manage:stock')
  @ApiOperation({
    summary: 'Clôturer le 1er comptage → recount ou analyse (RM-INV03)',
  })
  completeFirstCount(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.inventoryService.completeFirstCount(id, req.user.tenantId);
  }

  @Post(':id/complete-recount')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Clôturer le double comptage → analyse' })
  completeRecount(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.inventoryService.completeRecount(id, req.user.tenantId);
  }

  @Post(':id/validate')
  @Permissions('manage:stock')
  @ApiOperation({
    summary:
      'Valider les ajustements IN/OUT_ADJUSTMENT (RM-INV04)',
  })
  validate(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string; sub: string } },
  ) {
    return this.inventoryService.validate(
      id,
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Post(':id/close')
  @Permissions('manage:stock')
  @ApiOperation({
    summary: 'Clôturer la session — événement Comptabilité',
  })
  close(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string; sub: string } },
  ) {
    return this.inventoryService.close(
      id,
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Post(':id/cancel')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Annuler (brouillon / comptage uniquement)' })
  cancel(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.inventoryService.cancel(id, req.user.tenantId);
  }
}
