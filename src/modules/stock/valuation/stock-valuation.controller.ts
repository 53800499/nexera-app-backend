import {
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
import { StockValuationService } from './stock-valuation.service';

@ApiTags('stock-valuation')
@ApiBearerAuth('access-token')
@Controller('stock/valuation')
export class StockValuationController {
  constructor(private readonly valuationService: StockValuationService) {}

  @Get()
  @Permissions('stock.read')
  @ApiOperation({
    summary:
      'Valorisation du stock (courante ou à date — RM-VAL03) (UC-S08)',
  })
  @ApiQuery({ name: 'asOf', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'warehouseId', required: false })
  getValuation(
    @Request() req: { user: { tenantId: string } },
    @Query('asOf') asOf?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    if (asOf) {
      return this.valuationService.getValuationAsOf(req.user.tenantId, asOf, {
        warehouseId,
      });
    }
    return this.valuationService.getCurrentValuation(req.user.tenantId, {
      warehouseId,
    });
  }

  @Get('turnover')
  @Permissions('stock.read')
  @ApiOperation({
    summary:
      'Taux de rotation (§3.3) — COGS ÷ valeur moyenne du stock',
  })
  @ApiQuery({ name: 'from', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'warehouseId', required: false })
  getTurnover(
    @Request() req: { user: { tenantId: string } },
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.valuationService.getTurnoverRate(
      req.user.tenantId,
      from,
      to,
      { warehouseId },
    );
  }

  @Get('cmup-history/:stockItemId')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Historique CMUP horodaté (RM-VAL02)' })
  getCmupHistory(
    @Param('stockItemId') stockItemId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.valuationService.getCmupHistory(
      stockItemId,
      req.user.tenantId,
    );
  }

  @Post('publish')
  @Permissions('manage:stock')
  @ApiOperation({
    summary:
      'Publier la valorisation vers la Comptabilité (RM-VAL04)',
  })
  @ApiQuery({ name: 'asOf', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  publish(
    @Request() req: { user: { tenantId: string } },
    @Query('asOf') asOf?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.valuationService.publishToAccounting(
      req.user.tenantId,
      asOf,
      warehouseId,
    );
  }
}
