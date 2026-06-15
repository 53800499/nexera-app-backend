import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CancelPaymentDto } from './dto/cancel-payment.dto';
import {
  ClientPaymentContextDto,
  PaymentListResponseDto,
  PaymentResponseDto,
} from './dto/payment-response.dto';
import { parsePagination } from '../../shared/utils/pagination.util';

@ApiTags('payments')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'JWT manquant ou invalide' })
@ApiForbiddenResponse({ description: 'Permission manage:payments requise' })
@Controller('payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('clients/:clientId/context')
  @Permissions('payments.read')
  @ApiOperation({
    summary: 'Contexte encaissement client',
    description:
      '**UC-06 étape 2** — Factures impayées/partielles et avances disponibles pour un client.',
  })
  @ApiParam({ name: 'clientId', format: 'uuid' })
  @ApiOkResponse({ type: ClientPaymentContextDto })
  @ApiNotFoundResponse()
  getClientContext(
    @Param('clientId') clientId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.paymentsService.getClientPaymentContext(
      clientId,
      req.user.tenantId,
    );
  }

  @Post()
  @Permissions('manage:payments')
  @ApiOperation({
    summary: 'Enregistrer un encaissement',
    description: `**UC-06** — Enregistrement d'un paiement client sur une ou plusieurs factures.

**RM-E01** — Trop-perçu → avance client (\`unallocatedAmount\` + \`ClientAdvance\`).
**RM-E02** — Imputation FIFO par défaut (\`allocationMode=fifo\`) ou manuelle.
**RM-E03** — \`currency\` + \`exchangeRate\` : écart de change enregistré.
**RM-E04** — Annulation via \`POST /payments/:id/cancel\` (motif obligatoire).`,
  })
  @ApiBody({ type: CreatePaymentDto })
  @ApiCreatedResponse({ type: PaymentResponseDto })
  create(
    @Body() dto: CreatePaymentDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.paymentsService.create(dto, req.user.tenantId, req.user.sub);
  }

  @Get()
  @Permissions('payments.read')
  @ApiOperation({ summary: 'Lister les encaissements' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'includeCancelled', required: false, example: false })
  @ApiOkResponse({ type: PaymentListResponseDto })
  findAll(
    @Request() req: { user: { tenantId: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('clientId') clientId?: string,
    @Query('includeCancelled') includeCancelled?: string,
  ) {
    const pagination = parsePagination(page, limit);
    return this.paymentsService.findAll(
      req.user.tenantId,
      pagination.page,
      pagination.limit,
      clientId,
      includeCancelled === 'true',
    );
  }

  @Get(':id')
  @Permissions('payments.read')
  @ApiOperation({ summary: 'Détail encaissement' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiNotFoundResponse()
  findOne(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.paymentsService.findOne(id, req.user.tenantId);
  }

  @Post(':id/cancel')
  @Permissions('manage:payments')
  @ApiOperation({
    summary: 'Annuler un encaissement',
    description:
      '**RM-E04** — Motif obligatoire. Annule les imputations et supprime l\'avance non utilisée.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: CancelPaymentDto })
  @ApiOkResponse({ type: PaymentResponseDto })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelPaymentDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.paymentsService.cancel(id, req.user.tenantId, dto);
  }
}
