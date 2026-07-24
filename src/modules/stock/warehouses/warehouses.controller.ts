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
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { CreateWarehouseLocationDto } from './dto/create-warehouse-location.dto';
import { UpdateWarehouseLocationDto } from './dto/update-warehouse-location.dto';

@ApiTags('stock-warehouses')
@ApiBearerAuth('access-token')
@Controller('stock')
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

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
