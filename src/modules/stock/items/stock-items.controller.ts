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
import { StockItemsService } from './stock-items.service';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';

@ApiTags('stock-items')
@ApiBearerAuth('access-token')
@Controller('stock')
export class StockItemsController {
  constructor(private readonly stockItemsService: StockItemsService) {}

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
}
