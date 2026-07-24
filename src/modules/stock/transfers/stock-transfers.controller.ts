import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { StockTransfersService } from './stock-transfers.service';
import {
  CreateStockTransferDto,
  ReceiveStockTransferDto,
} from './dto/create-stock-transfer.dto';

@ApiTags('stock-transfers')
@ApiBearerAuth('access-token')
@Controller('stock')
export class StockTransfersController {
  constructor(private readonly stockTransfersService: StockTransfersService) {}

  @Get('transfers')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Lister les transferts inter-entrepôts (UC-S05)' })
  findTransfers(@Request() req: { user: { tenantId: string } }) {
    return this.stockTransfersService.findAll(req.user.tenantId);
  }

  @Get('transfers/:id')
  @Permissions('stock.read')
  @ApiOperation({ summary: 'Détail d’un transfert' })
  findOneTransfer(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.stockTransfersService.findOne(id, req.user.tenantId);
  }

  @Post('transfers')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Créer un transfert (brouillon)' })
  createTransfer(
    @Body() dto: CreateStockTransferDto,
    @Request() req: { user: { tenantId: string; sub: string } },
  ) {
    return this.stockTransfersService.create(
      dto,
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Post('transfers/:id/submit')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Soumettre le transfert (en attente départ)' })
  submitTransfer(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.stockTransfersService.submit(id, req.user.tenantId);
  }

  @Post('transfers/:id/ship')
  @Permissions('manage:stock')
  @ApiOperation({
    summary:
      'Valider le départ / expédier — stock source diminué → EN TRANSIT',
  })
  shipTransfer(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string; sub: string } },
  ) {
    return this.stockTransfersService.ship(
      id,
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Post('transfers/:id/receive')
  @Permissions('manage:stock')
  @ApiOperation({
    summary:
      'Confirmer la réception — stock destination augmenté → COMPLÉTÉ',
  })
  receiveTransfer(
    @Param('id') id: string,
    @Body() dto: ReceiveStockTransferDto,
    @Request() req: { user: { tenantId: string; sub: string } },
  ) {
    return this.stockTransfersService.receive(
      id,
      dto,
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Post('transfers/:id/cancel')
  @Permissions('manage:stock')
  @ApiOperation({ summary: 'Annuler un transfert (avant expédition)' })
  cancelTransfer(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.stockTransfersService.cancel(id, req.user.tenantId);
  }
}
