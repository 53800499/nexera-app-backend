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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
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
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateOrderInvoiceDto } from './dto/create-order-invoice.dto';
import { OrderStatus } from './enums/order-status.enum';
import { parsePagination } from '../../shared/utils/pagination.util';
import {
  OrderInvoiceCreatedResponseDto,
  OrderListResponseDto,
  OrderMessageResponseDto,
  OrderResponseDto,
} from './dto/order-response.dto';

@ApiTags('orders')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'JWT manquant ou invalide' })
@ApiForbiddenResponse({ description: 'Permission manage:orders requise' })
@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Permissions('manage:orders')
  @ApiOperation({
    summary: 'Créer un bon de commande',
    description: `**UC-04** — Création manuelle d'un BC.

**État initial :** \`draft\` (Brouillon)

**Numérotation (RM-BC01) :**
- À la création : \`BC-DRAFT-XXXXXX\` (provisoire)
- À la confirmation : \`BC-AAAA-XXXXXX\` (définitif, immuable)

**Lien devis (RM-BC03) :** renseigner \`quotationId\` si le BC provient d'un devis accepté.`,
  })
  @ApiBody({ type: CreateOrderDto })
  @ApiCreatedResponse({
    type: OrderResponseDto,
    description: 'Bon de commande créé en brouillon',
  })
  @ApiBadRequestResponse({ description: 'Données invalides ou client introuvable' })
  create(
    @Body() dto: CreateOrderDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.ordersService.create(dto, req.user.tenantId, req.user.sub);
  }

  @Get()
  @Permissions('orders.read')
  @ApiOperation({
    summary: 'Lister les bons de commande',
    description: 'Liste paginée avec recherche par numéro BC, client ou devis source.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: OrderStatus,
    description:
      'draft | confirmed | partially_paid (en cours) | paid (facturé) | cancelled',
  })
  @ApiQuery({ name: 'clientId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'q', required: false, description: 'Recherche texte' })
  @ApiOkResponse({ type: OrderListResponseDto })
  findAll(
    @Request() req: { user: { tenantId: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: OrderStatus,
    @Query('clientId') clientId?: string,
    @Query('q') q?: string,
  ) {
    const pagination = parsePagination(page, limit);
    return this.ordersService.findAll(
      req.user.tenantId,
      pagination.page,
      pagination.limit,
      status,
      clientId,
      q,
    );
  }

  @Get(':id')
  @Permissions('orders.read')
  @ApiOperation({
    summary: 'Détail bon de commande',
    description: `Retourne le BC avec :
- **quotation** : devis source (RM-BC03)
- **invoices** : factures liées
- **billing** : \`invoicedTtc\`, \`remainingToInvoice\`, \`billingProgressPct\` (RM-BC02)
- **lines** : lignes du BC`,
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiNotFoundResponse({ description: 'Bon de commande introuvable' })
  findOne(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.ordersService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Permissions('manage:orders')
  @ApiOperation({
    summary: 'Modifier un BC',
    description:
      'Modification autorisée **uniquement** si statut `draft`. `clientId` et `quotationId` ne sont pas modifiables.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateOrderDto })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ description: 'BC non modifiable (pas en brouillon)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.ordersService.update(id, req.user.tenantId, dto);
  }

  @Post(':id/confirm')
  @Permissions('manage:orders')
  @ApiOperation({
    summary: 'Confirmer le bon de commande',
    description: `**Transition :** \`draft\` → \`confirmed\`

**RM-BC01 :** attribue le numéro définitif \`BC-AAAA-XXXXXX\` (ex. BC-2026-000001). Ce numéro ne change plus ensuite.`,
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({ description: 'BC déjà confirmé ou non brouillon' })
  confirm(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.ordersService.confirm(id, req.user.tenantId);
  }

  @Post(':id/cancel')
  @Permissions('manage:orders')
  @ApiOperation({
    summary: 'Annuler le bon de commande',
    description: `**Transition :** → \`cancelled\`

**Condition :** aucune facture active liée au BC (UC-04).`,
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiBadRequestResponse({
    description: 'Annulation impossible : factures existantes',
  })
  cancel(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.ordersService.cancel(id, req.user.tenantId);
  }

  @Post(':id/invoices')
  @Permissions('manage:orders')
  @ApiOperation({
    summary: 'Créer une facture depuis le BC',
    description: `**RM-BC02 — Facturation partielle ou totale**

Le BC doit être \`confirmed\`, \`partially_paid\` ou \`paid\` (pas \`draft\`).

**Options :**
- \`amountTtc\` : montant TTC exact à facturer
- \`billingPct\` : % du **reste** à facturer (ex. 30 = acompte 30 %)
- Si les deux sont omis : facture le **reste à facturer** en totalité

**Types de facture :** \`standard\`, \`deposit\` (acompte), \`balance\` (solde), \`proforma\`

**Mise à jour automatique du statut BC :**
- Première facture → \`partially_paid\` (en cours)
- 100 % facturé → \`paid\` (facturé)`,
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({
    type: CreateOrderInvoiceDto,
    examples: {
      acompte30: {
        summary: 'Acompte 30 % du reste',
        value: { invoiceType: 'deposit', billingPct: 30 },
      },
      solde: {
        summary: 'Facturer tout le reste',
        value: { invoiceType: 'balance' },
      },
      montantFixe: {
        summary: 'Montant TTC fixe',
        value: { amountTtc: 5000, invoiceType: 'standard' },
      },
    },
  })
  @ApiCreatedResponse({ type: OrderInvoiceCreatedResponseDto })
  @ApiBadRequestResponse({
    description: 'BC non confirmé, déjà facturé à 100 %, ou montant invalide',
  })
  createInvoice(
    @Param('id') id: string,
    @Body() dto: CreateOrderInvoiceDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.ordersService.createInvoice(
      id,
      req.user.tenantId,
      dto,
      req.user.sub,
    );
  }

  @Delete(':id')
  @Permissions('manage:orders')
  @ApiOperation({
    summary: 'Supprimer un BC brouillon',
    description: 'Suppression physique uniquement si statut `draft` et sans facture.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OrderMessageResponseDto })
  @ApiBadRequestResponse({ description: 'BC non supprimable' })
  remove(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.ordersService.remove(id, req.user.tenantId);
  }
}
