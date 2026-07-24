import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { InventoryService } from './inventory.service';
import {
  CreateInventorySessionDto,
  SubmitInventoryCountsDto,
} from './dto/create-inventory-session.dto';

@ApiTags('stock-inventory')
@ApiBearerAuth('access-token')
@Controller('stock/inventories')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Lister les sessions d’inventaire (UC-S06)' })
  findAll(@Request() req: { user: { tenantId: string } }) {
    return this.inventoryService.findAll(req.user.tenantId);
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
