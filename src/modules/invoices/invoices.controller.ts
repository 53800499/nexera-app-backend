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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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
import { InvoicesService } from './invoices.service';
import { RecurringInvoicesService } from './recurring-invoices.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateCreditNoteDto } from './dto/create-credit-note.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { CreateRecurringInvoiceDto } from './dto/create-recurring-invoice.dto';
import { InvoiceStatus } from './enums/invoice-status.enum';
import { InvoiceType } from './enums/invoice-type.enum';
import { parsePagination } from '../../shared/utils/pagination.util';
import {
  InvoiceListResponseDto,
  InvoiceResponseDto,
} from './dto/invoice-response.dto';

@ApiTags('invoices')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'JWT manquant ou invalide' })
@ApiForbiddenResponse({ description: 'Permission manage:invoices requise' })
@Controller('invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly recurringInvoicesService: RecurringInvoicesService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post()
  @Permissions('manage:invoices')
  @ApiOperation({
    summary: 'Créer une facture',
    description: `**UC-05** — Types : standard, proforma, deposit (acompte), balance (solde), credit_note (via endpoint dédié).

**Brouillon :** numéro \`FAC-DRAFT-XXXXXX\`
**Émission (RM-F01) :** \`FAC-AAAA-XXXXXX\` via \`POST /invoices/:id/issue\`

**RM-F03** TVA multi-taux — base arrondie par taux.
**RM-F04** Facture de solde : acomptes du BC déduits automatiquement si \`invoiceType=balance\` + \`orderId\`.
**RM-F06** \`currency\` + \`exchangeRate\`.
**RM-F07** \`notes\` = mentions légales / conditions.`,
  })
  @ApiBody({ type: CreateInvoiceDto })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  create(
    @Body() dto: CreateInvoiceDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.invoicesService.create(dto, req.user.tenantId, req.user.sub);
  }

  @Get()
  @Permissions('invoices.read')
  @ApiOperation({ summary: 'Lister les factures' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'invoiceType', required: false, enum: InvoiceType })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiOkResponse({ type: InvoiceListResponseDto })
  findAll(
    @Request() req: { user: { tenantId: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: InvoiceStatus,
    @Query('invoiceType') invoiceType?: InvoiceType,
    @Query('clientId') clientId?: string,
    @Query('q') q?: string,
  ) {
    const pagination = parsePagination(page, limit);
    return this.invoicesService.findAll(
      req.user.tenantId,
      pagination.page,
      pagination.limit,
      status,
      invoiceType,
      clientId,
      q,
    );
  }

  @Get(':id/pdf')
  @Permissions('invoices.read')
  @ApiOperation({
    summary: 'Télécharger / prévisualiser le PDF de la facture',
    description:
      '§5.1 — Contenu légal complet (vendeur, client, lignes, TVA par taux, conditions).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  async downloadPdf(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.invoicesService.getPdf(
      id,
      req.user.tenantId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Get(':id')
  @Permissions('invoices.read')
  @ApiOperation({
    summary: 'Détail facture',
    description:
      'Inclut lignes, paiements, avoirs, BC/devis source, mentions légales (RM-F07).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: InvoiceResponseDto })
  @ApiNotFoundResponse()
  findOne(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.invoicesService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Permissions('manage:invoices')
  @ApiOperation({
    summary: 'Modifier une facture',
    description: 'Uniquement en **DRAFT** (RM-F02).',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateInvoiceDto })
  @ApiOkResponse({ type: InvoiceResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.invoicesService.update(id, req.user.tenantId, dto);
  }

  @Post(':id/issue')
  @Permissions('manage:invoices')
  @ApiOperation({
    summary: 'Émettre la facture',
    description: `**RM-F01** — Numéro définitif \`FAC-AAAA-XXXXXX\`, statut \`issued\`, document immuable (RM-F02).`,
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: InvoiceResponseDto })
  issue(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.invoicesService.issue(id, req.user.tenantId);
  }

  @Post(':id/send')
  @Permissions('manage:invoices')
  @ApiOperation({
    summary: 'Envoyer la facture au client',
    description: 'Statut `sent`. Émet automatiquement si encore en brouillon.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: SendInvoiceDto })
  @ApiOkResponse({ type: InvoiceResponseDto })
  send(
    @Param('id') id: string,
    @Body() dto: SendInvoiceDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.invoicesService.send(id, req.user.tenantId, dto);
  }

  @Post(':id/credit-note')
  @Permissions('manage:invoices')
  @ApiOperation({
    summary: 'Créer un avoir',
    description: `**RM-F05** — Référence la facture d'origine. Montant <= solde dû.
Avoir total → facture originale \`cancelled\`.`,
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Facture d\'origine' })
  @ApiBody({ type: CreateCreditNoteDto })
  @ApiCreatedResponse({ type: InvoiceResponseDto })
  createCreditNote(
    @Param('id') id: string,
    @Body() dto: CreateCreditNoteDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.invoicesService.createCreditNote(
      id,
      req.user.tenantId,
      dto,
      req.user.sub,
    );
  }

  @Post(':id/payments')
  @Permissions('manage:invoices')
  @ApiOperation({
    summary: 'Enregistrer un encaissement sur une facture',
    description:
      '**UC-06** (raccourci facture) — Imputation sur cette facture uniquement, sans trop-perçu. Voir `POST /payments` pour imputation multi-factures / FIFO.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: RecordPaymentDto })
  @ApiOkResponse({ type: InvoiceResponseDto })
  async recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    await this.paymentsService.recordForInvoice(
      id,
      req.user.tenantId,
      dto,
      req.user.sub,
    );
    return this.invoicesService.findOne(id, req.user.tenantId);
  }

  @Post(':id/recurring')
  @Permissions('manage:invoices')
  @ApiOperation({
    summary: 'Configurer une facture récurrente',
    description: `**RM-F08** — À partir d'une facture modèle.

- Génération automatique **J-7** avant \`nextExecution\`
- Brouillon **DRAFT** + notification email
- Validation manuelle puis \`POST /invoices/:id/issue\`
- Fréquences : \`monthly\`, \`quarterly\`, \`yearly\`

Gestion : \`GET /invoices/recurring\``,
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Facture modèle' })
  @ApiBody({ type: CreateRecurringInvoiceDto })
  createRecurring(
    @Param('id') id: string,
    @Body() dto: CreateRecurringInvoiceDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.recurringInvoicesService.create(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @Permissions('manage:invoices')
  @ApiOperation({ summary: 'Supprimer une facture brouillon' })
  @ApiParam({ name: 'id', format: 'uuid' })
  remove(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.invoicesService.remove(id, req.user.tenantId);
  }
}
