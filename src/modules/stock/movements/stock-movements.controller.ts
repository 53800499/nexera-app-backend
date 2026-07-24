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
import { StockMovementsService } from './stock-movements.service';
import { StockExitsService } from './stock-exits.service';
import { CreateStockEntryDto } from './dto/create-stock-entry.dto';
import { CreateStockExitDto } from './dto/create-stock-exit.dto';

@ApiTags('stock-movements')
@ApiBearerAuth('access-token')
@Controller('stock')
export class StockMovementsController {
  constructor(
    private readonly stockMovementsService: StockMovementsService,
    private readonly stockExitsService: StockExitsService,
  ) {}

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
}
