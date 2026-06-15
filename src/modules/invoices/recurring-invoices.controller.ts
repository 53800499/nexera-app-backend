import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RecurringInvoicesService } from './recurring-invoices.service';
import { UpdateRecurringInvoiceDto } from './dto/update-recurring-invoice.dto';
import { RecurringInvoiceResponseDto } from './dto/recurring-invoice-response.dto';

@ApiTags('invoices')
@ApiBearerAuth('access-token')
@Controller('invoices/recurring')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RecurringInvoicesController {
  constructor(
    private readonly recurringInvoicesService: RecurringInvoicesService,
  ) {}

  @Get()
  @Permissions('invoices.read')
  @ApiOperation({
    summary: 'Lister les factures récurrentes',
    description: 'RM-F08 — plannings actifs et historique des brouillons générés.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiOkResponse({ description: 'Liste paginée' })
  findAll(
    @Request() req: { user: { tenantId: string } },
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.recurringInvoicesService.findAll(
      req.user.tenantId,
      Number(page),
      Number(limit),
    );
  }

  @Post('process')
  @Permissions('manage:invoices')
  @ApiOperation({
    summary: 'Exécuter le job de génération (manuel)',
    description:
      'Déclenche la même logique que le cron quotidien : génération J-7 + avancement des cycles.',
  })
  processAll() {
    return this.recurringInvoicesService.processAllDue();
  }

  @Get(':id')
  @Permissions('invoices.read')
  @ApiOperation({ summary: 'Détail d\'un planning récurrent' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: RecurringInvoiceResponseDto })
  findOne(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.recurringInvoicesService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Permissions('manage:invoices')
  @ApiOperation({ summary: 'Modifier fréquence / prochaine échéance / actif' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRecurringInvoiceDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.recurringInvoicesService.update(id, req.user.tenantId, dto);
  }

  @Post(':id/generate')
  @Permissions('manage:invoices')
  @ApiOperation({
    summary: 'Générer un brouillon immédiatement',
    description:
      'Crée un brouillon DRAFT depuis le modèle (hors fenêtre J-7). À valider puis émettre.',
  })
  @ApiCreatedResponse({ description: 'Brouillon généré' })
  generateNow(
    @Param('id') id: string,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.recurringInvoicesService.generateNow(
      id,
      req.user.tenantId,
      req.user.sub,
    );
  }

  @Delete(':id')
  @Permissions('manage:invoices')
  @ApiOperation({ summary: 'Supprimer un planning récurrent' })
  remove(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.recurringInvoicesService.remove(id, req.user.tenantId);
  }
}
