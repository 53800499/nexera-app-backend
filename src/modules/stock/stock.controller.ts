import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { Permissions } from '../../common/decorators/permissions.decorator';
import { StockItemsService } from './stock-items.service';
import { WarehousesService } from './warehouses.service';
import { StockMovementsService } from './stock-movements.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { CreateWarehouseLocationDto } from './dto/create-warehouse-location.dto';
import { UpdateWarehouseLocationDto } from './dto/update-warehouse-location.dto';
import { CreateStockEntryDto } from './dto/create-stock-entry.dto';
import { CreateStockExitDto } from './dto/create-stock-exit.dto';
import { StockExitsService } from './stock-exits.service';

@ApiTags('stock')
@ApiBearerAuth('access-token')
@Controller('stock')
export class StockController {
  constructor(
    private readonly stockItemsService: StockItemsService,
    private readonly warehousesService: WarehousesService,
    private readonly stockMovementsService: StockMovementsService,
    private readonly stockExitsService: StockExitsService,
  ) {}

  // ── Mouvements / entrées (UC-S03) ─────────────────────────────────

  @Get('movements/entries')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Lister les entrées de stock (UC-S03)' })
  findEntries(@Request() req: { user: { tenantId: string } }) {
    return this.stockMovementsService.findEntries(req.user.tenantId);
  }

  @Get('movements/exits')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Lister les sorties de stock (UC-S04)' })
  findExits(@Request() req: { user: { tenantId: string } }) {
    return this.stockExitsService.findExits(req.user.tenantId);
  }

  @Get('movements/:id')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Détail d’un mouvement de stock' })
  findOneMovement(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.stockMovementsService.findOne(id, req.user.tenantId);
  }

  @Post('movements/entries')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Créer une entrée de stock (UC-S03)' })
  createEntry(
    @Body() dto: CreateStockEntryDto,
    @Request() req: { user: { tenantId: string; sub: string } },
  ) {
    return this.stockMovementsService.createEntry(
      dto,
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Post('movements/exits')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Créer une sortie de stock (UC-S04)' })
  createExit(
    @Body() dto: CreateStockExitDto,
    @Request() req: { user: { tenantId: string; sub: string } },
  ) {
    return this.stockExitsService.createExit(
      dto,
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Post('movements/:id/validate')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Valider un mouvement de stock (entrée ou sortie)' })
  async validateMovement(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string; sub: string } },
  ) {
    const movement = await this.stockMovementsService.findOne(
      id,
      req.user.tenantId,
    );
    const type = movement.movementType as string;
    if (type.startsWith('OUT_')) {
      return this.stockExitsService.validateExit(
        id,
        req.user.tenantId,
        req.user.sub,
      );
    }
    return this.stockMovementsService.validateEntry(
      id,
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Get('items/:stockItemId/available-lots')
  @Permissions('stock.read')
  @ApiOperation({
    summary: 'Lots / niveaux disponibles pour une sortie (FIFO — RM-OUT02)',
  })
  @ApiQuery({ name: 'warehouseId', required: true })
  listAvailableLots(
    @Param('stockItemId') stockItemId: string,
    @Query('warehouseId') warehouseId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.stockExitsService.listAvailableLots(
      stockItemId,
      warehouseId,
      req.user.tenantId,
    );
  }

  // ── Articles / config stock (UC-S01) ──────────────────────────────

  @Get('articles')
  @Permissions('stock.read')
  @ApiOperation({
    summary:
      'Lister les articles catalogue (produits) avec statut de configuration stock',
  })
  @ApiQuery({ name: 'q', required: false })
  findArticles(
    @Request() req: { user: { tenantId: string } },
    @Query('q') q?: string,
  ) {
    return this.stockItemsService.findArticles(req.user.tenantId, q);
  }

  @Get('items')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Lister les configurations stock' })
  findAllItems(@Request() req: { user: { tenantId: string } }) {
    return this.stockItemsService.findAll(req.user.tenantId);
  }

  @Get('items/by-catalog/:catalogItemId')
  @Permissions('stock.read')
  @ApiOperation({
    summary: 'Configuration stock d’un article catalogue (ou null)',
  })
  findByCatalog(
    @Param('catalogItemId') catalogItemId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.stockItemsService.findByCatalogItem(
      catalogItemId,
      req.user.tenantId,
    );
  }

  @Get('items/:id')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Détail d’une configuration stock' })
  findOneItem(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.stockItemsService.findOne(id, req.user.tenantId);
  }

  @Post('items')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Créer la configuration stock d’un article (UC-S01)' })
  createItem(
    @Body() dto: CreateStockItemDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.stockItemsService.create(dto, req.user.tenantId);
  }

  @Patch('items/:id')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Modifier la configuration stock (UC-S01)' })
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateStockItemDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.stockItemsService.update(id, req.user.tenantId, dto);
  }

  // ── Entrepôts ─────────────────────────────────────────────────────

  @Get('warehouses')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Lister les entrepôts (UC-S02)' })
  @ApiQuery({
    name: 'includeArchived',
    required: false,
    description: 'Inclure les entrepôts archivés (défaut: true)',
  })
  findAllWarehouses(
    @Request() req: { user: { tenantId: string } },
    @Query('includeArchived') includeArchived?: string,
  ) {
    const include =
      includeArchived === undefined ? true : includeArchived !== 'false';
    return this.warehousesService.findAll(req.user.tenantId, include);
  }

  @Get('warehouses/:id')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Détail d’un entrepôt' })
  findOneWarehouse(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.warehousesService.findOne(id, req.user.tenantId);
  }

  @Post('warehouses')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Créer un entrepôt (UC-S02)' })
  createWarehouse(
    @Body() dto: CreateWarehouseDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.warehousesService.create(dto, req.user.tenantId);
  }

  @Patch('warehouses/:id')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Modifier un entrepôt (nom, défaut, archivage)' })
  updateWarehouse(
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.warehousesService.update(id, req.user.tenantId, dto);
  }

  @Post('warehouses/:id/set-default')
  @Permissions('manage:stock')
  @ApiOperation({
    summary: 'Désigner l’entrepôt par défaut (RM-E03)',
  })
  setDefaultWarehouse(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.warehousesService.setDefault(id, req.user.tenantId);
  }

  @Post('warehouses/:id/archive')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Archiver un entrepôt (RM-E02)' })
  archiveWarehouse(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.warehousesService.archive(id, req.user.tenantId);
  }

  @Post('warehouses/:id/reactivate')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Réactiver un entrepôt archivé' })
  reactivateWarehouse(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.warehousesService.reactivate(id, req.user.tenantId);
  }

  @Post('warehouses/:id/locations')
  @Permissions('manage:stock')
  @ApiOperation({
    summary:
      'Créer un emplacement (code auto [ENT]-[ZONE]-[ALLÉE]-[RAYON]-[CASE] — RM-E01)',
  })
  createLocation(
    @Param('id') warehouseId: string,
    @Body() dto: CreateWarehouseLocationDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.warehousesService.createLocation(
      warehouseId,
      req.user.tenantId,
      dto,
    );
  }

  @Patch('warehouses/:warehouseId/locations/:locationId')
  @Permissions('manage:stock')
  @ApiOperation({
    summary: 'Modifier un emplacement (capacité / actif uniquement — RM-E01)',
  })
  updateLocation(
    @Param('warehouseId') warehouseId: string,
    @Param('locationId') locationId: string,
    @Body() dto: UpdateWarehouseLocationDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.warehousesService.updateLocation(
      warehouseId,
      locationId,
      req.user.tenantId,
      dto,
    );
  }
}
