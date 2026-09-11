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
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CabinetTenantGuard } from '../../common/guards/cabinet-tenant.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ApiStandardErrors } from '../../common/swagger/api-error.docs';
import { CabinetService } from './cabinet.service';
import { parsePagination } from '../../shared/utils/pagination.util';
import { CabinetAccessDto } from './dto/cabinet-access.dto';
import { RevokeCabinetAccessDto } from './dto/revoke-cabinet-access.dto';
import { UpdateCabinetPermissionsDto } from './dto/update-cabinet-permissions.dto';
import { CabinetInviteCodeDto } from './dto/cabinet-invite-code.dto';
import {
  AuthorizedCabinetDto,
  CabinetAccessMessageDto,
  CabinetCompanyInvoicesPageDto,
  CabinetCompanyPaymentsPageDto,
  CabinetCompanyClientsPageDto,
  CompanyTenantSummaryDto,
} from './dto/cabinet-response.dto';
import { CabinetMessages } from './constants/cabinet-messages';

const CABINET_PROCESS_DOC = [
  '**Processus cabinet ↔ entreprise (multi-dossiers)**',
  '',
  '1. **Inscription cabinet** — `POST /auth/register` avec `tenantType: cabinet`.',
  '2. **Inscription entreprise** — `POST /auth/register` avec `tenantType: company` (défaut).',
  '3. **Autorisation** (Espace Entreprise) — `POST /cabinet/access` : l\'entreprise lie un cabinet via `cabinetTenantId`.',
  '4. **Consultation** (Espace Cabinet) — `GET /cabinet/companies` puis `GET /cabinet/companies/:companyTenantId/invoices`.',
  '5. **Révocation** (Espace Entreprise) — `DELETE /cabinet/access` : l\'entreprise retire l\'accès.',
  '',
  'Un cabinet peut être lié à **plusieurs entreprises** ; chaque entreprise autorise explicitement le cabinet.',
  'Le JWT du collaborateur cabinet reste sur le tenant cabinet ; le dossier client est passé en paramètre d\'URL.',
].join('\n');

@ApiTags('cabinet')
@ApiBearerAuth('access-token')
@Controller('cabinet')
@UseGuards(JwtAuthGuard, PermissionsGuard, CabinetTenantGuard)
@ApiForbiddenResponse({
  description: `Permission \`cabinet.read\` requise ou ${CabinetMessages.CABINET_SPACE_ONLY}`,
})
export class CabinetController {
  constructor(private readonly cabinetService: CabinetService) {}

  @Get('invite-code')
  @Permissions('settings.read', 'manage:settings')
  @ApiOperation({
    summary: "Code d'invitation cabinet (à partager aux entreprises)",
    description:
      "Retourne un code opaque rotatable. Ne jamais exposer l'UUID tenant aux clients.",
  })
  @ApiOkResponse({ type: CabinetInviteCodeDto })
  getInviteCode(@Request() req: { user: { tenantId: string } }) {
    return this.cabinetService.getInviteCode(req.user.tenantId);
  }

  @Post('invite-code/regenerate')
  @Permissions('manage:settings')
  @ApiOperation({
    summary: "Régénérer le code d'invitation cabinet",
    description:
      "Invalide l'ancien code. Les entreprises déjà liées conservent leur accès.",
  })
  @ApiOkResponse({ type: CabinetInviteCodeDto })
  regenerateInviteCode(@Request() req: { user: { tenantId: string } }) {
    return this.cabinetService.regenerateInviteCode(req.user.tenantId);
  }

  @Get('companies')
  @Permissions('cabinet.read')
  @ApiOperation({
    summary: 'Lister les entreprises clientes liées (Espace Cabinet)',
    description:
      'Retourne toutes les entreprises ayant autorisé ce cabinet via `cabinet_company_access`. ' +
      'Point d\'entrée du tableau de bord multi-dossiers côté expert-comptable.\n\n' +
      CABINET_PROCESS_DOC,
  })
  @ApiOkResponse({
    description: 'Entreprises accessibles par le cabinet connecté',
    type: [CompanyTenantSummaryDto],
  })
  @ApiStandardErrors({
    badRequest: CabinetMessages.CABINET_SPACE_ONLY,
    includeNotFound: false,
  })
  listCompanies(@Request() req: { user: { tenantId: string } }) {
    return this.cabinetService.listLinkedCompanies(req.user.tenantId);
  }

  @Get('companies/:companyTenantId/invoices')
  @Permissions('cabinet.read')
  @ApiOperation({
    summary: "Factures d'une entreprise cliente (lecture cabinet)",
    description:
      'Consulte les factures d\'un dossier entreprise précis. ' +
      'Vérifie que le lien cabinet ↔ entreprise existe avant toute lecture. ' +
      'Le `companyTenantId` est l\'identifiant tenant de l\'entreprise (pas du cabinet).',
  })
  @ApiParam({
    name: 'companyTenantId',
    format: 'uuid',
    description: 'Identifiant tenant de l\'entreprise cliente',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiOkResponse({
    description: 'Factures paginées de l\'entreprise sélectionnée',
    type: CabinetCompanyInvoicesPageDto,
  })
  @ApiStandardErrors({
    notFound: CabinetMessages.ACCESS_NOT_AUTHORIZED,
  })
  listInvoices(
    @Request() req: { user: { tenantId: string } },
    @Param('companyTenantId') companyTenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pagination = parsePagination(page, limit);
    return this.cabinetService.listCompanyInvoices(
      req.user.tenantId,
      companyTenantId,
      pagination.page,
      pagination.limit,
    );
  }

  @Get('companies/:companyTenantId/payments')
  @Permissions('cabinet.read')
  @ApiOperation({
    summary: "Encaissements d'une entreprise cliente (lecture cabinet)",
    description:
      "Consulte les paiements reçus d'un dossier entreprise précis. " +
      "Vérifie que l'entreprise a autorisé la permission `cabinet.scope.payments.read`.",
  })
  @ApiParam({
    name: 'companyTenantId',
    format: 'uuid',
    description: "Identifiant tenant de l'entreprise cliente",
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiOkResponse({
    description: "Encaissements paginés de l'entreprise sélectionnée",
    type: CabinetCompanyPaymentsPageDto,
  })
  @ApiStandardErrors({
    notFound: CabinetMessages.ACCESS_NOT_AUTHORIZED,
  })
  listPayments(
    @Request() req: { user: { tenantId: string } },
    @Param('companyTenantId') companyTenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pagination = parsePagination(page, limit);
    return this.cabinetService.listCompanyPayments(
      req.user.tenantId,
      companyTenantId,
      pagination.page,
      pagination.limit,
    );
  }

  @Get('companies/:companyTenantId/clients')
  @Permissions('cabinet.read')
  @ApiOperation({
    summary: "Référentiel clients d'une entreprise cliente (lecture cabinet)",
    description:
      "Consulte les fiches clients d'un dossier entreprise précis. " +
      "Vérifie que l'entreprise a autorisé la permission `cabinet.scope.clients.read`.",
  })
  @ApiParam({
    name: 'companyTenantId',
    format: 'uuid',
    description: "Identifiant tenant de l'entreprise cliente",
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiOkResponse({
    description: "Clients paginés de l'entreprise sélectionnée",
    type: CabinetCompanyClientsPageDto,
  })
  @ApiStandardErrors({
    notFound: CabinetMessages.ACCESS_NOT_AUTHORIZED,
  })
  listClients(
    @Request() req: { user: { tenantId: string } },
    @Param('companyTenantId') companyTenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pagination = parsePagination(page, limit);
    return this.cabinetService.listCompanyClients(
      req.user.tenantId,
      companyTenantId,
      pagination.page,
      pagination.limit,
    );
  }
}

@ApiTags('cabinet')
@ApiBearerAuth('access-token')
@Controller('cabinet')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiForbiddenResponse({
  description: 'Permission manage:settings ou settings.read requise',
})
export class CabinetAccessController {
  constructor(private readonly cabinetService: CabinetService) {}

  @Get('access')
  @Permissions('settings.read', 'manage:settings')
  @ApiOperation({
    summary: 'Lister les cabinets autorisés (Espace Entreprise)',
    description:
      'Retourne les cabinets comptables auxquels l\'entreprise connectée a accordé un accès. ' +
      'Utilisé dans les paramètres entreprise pour auditer les partages de données.\n\n' +
      CABINET_PROCESS_DOC,
  })
  @ApiOkResponse({
    description: 'Cabinets liés à cette entreprise',
    type: [AuthorizedCabinetDto],
  })
  @ApiStandardErrors({
    badRequest: CabinetMessages.COMPANY_ONLY_LIST,
    includeNotFound: false,
  })
  listAuthorizedCabinets(@Request() req: { user: { tenantId: string } }) {
    return this.cabinetService.listAuthorizedCabinets(req.user.tenantId);
  }

  @Post('access')
  @Permissions('manage:settings')
  @ApiOperation({
    summary: 'Autoriser un cabinet à consulter l\'entreprise',
    description:
      'Crée (ou confirme) un lien dans `cabinet_company_access`. ' +
      'Seule l\'entreprise connectée peut appeler cet endpoint. ' +
      'Le cabinet pourra ensuite lister l\'entreprise et consulter ses factures.',
  })
  @ApiBody({ type: CabinetAccessDto })
  @ApiCreatedResponse({
    description: 'Lien cabinet ↔ entreprise créé ou déjà existant',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: CabinetMessages.ACCESS_GRANTED,
        },
        link: { $ref: '#/components/schemas/CabinetAccessLinkDto' },
      },
    },
  })
  @ApiStandardErrors({
    badRequest: `${CabinetMessages.INVALID_CABINET} ou ${CabinetMessages.INVALID_COMPANY}`,
    includeNotFound: false,
  })
  grantAccess(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CabinetAccessDto,
  ) {
    return this.cabinetService.grantAccessFromDto(
      dto,
      req.user.tenantId,
      req.user.tenantId,
    );
  }

  @Patch('access/:cabinetTenantId/permissions')
  @Permissions('manage:settings')
  @ApiOperation({
    summary: "Modifier les droits accordés à un cabinet",
    description:
      "Met à jour les permissions du lien cabinet ↔ entreprise (factures, encaissements, clients).",
  })
  @ApiParam({ name: 'cabinetTenantId', format: 'uuid' })
  updatePermissions(
    @Request() req: { user: { tenantId: string } },
    @Param('cabinetTenantId') cabinetTenantId: string,
    @Body() dto: UpdateCabinetPermissionsDto,
  ) {
    return this.cabinetService.updateCabinetPermissions(
      cabinetTenantId,
      req.user.tenantId,
      req.user.tenantId,
      dto.permissions,
    );
  }

  @Delete('access')
  @Permissions('manage:settings')
  @ApiOperation({
    summary: 'Révoquer l\'accès d\'un cabinet',
    description:
      'Supprime le lien `cabinet_company_access` entre l\'entreprise connectée et le cabinet indiqué. ' +
      'Après révocation, le cabinet ne peut plus consulter les données de cette entreprise.',
  })
  @ApiBody({ type: RevokeCabinetAccessDto })
  @ApiOkResponse({
    description: 'Accès révoqué',
    type: CabinetAccessMessageDto,
  })
  @ApiStandardErrors({
    badRequest: `${CabinetMessages.INVALID_CABINET} ou ${CabinetMessages.INVALID_COMPANY}`,
    notFound: CabinetMessages.ACCESS_NOT_FOUND,
  })
  revokeAccess(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: RevokeCabinetAccessDto,
  ) {
    return this.cabinetService.revokeAccess(
      dto.cabinetTenantId,
      req.user.tenantId,
      req.user.tenantId,
    );
  }
}
