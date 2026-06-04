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
  ApiConflictResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { CheckClientDuplicateDto } from './dto/check-client-duplicate.dto';

@ApiTags('clients')
@ApiBearerAuth('access-token')
@Controller('clients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post('check-duplicates')
  @ApiOperation({
    summary: 'Détecter les doublons potentiels',
    description: 'RM-C03 — alerte si SIRET, IFU (taxId) ou email identique.',
  })
  checkDuplicates(
    @Body() dto: CheckClientDuplicateDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.clientsService.checkDuplicates(req.user.tenantId, dto);
  }

  @Post()
  @Permissions('manage:clients')
  @ApiOperation({
    summary: 'Créer un client',
    description:
      'UC-01 — génère le code CLT-XXXXXX (RM-C01), exige raison sociale, contact principal et adresse de facturation (RM-C02).',
  })
  @ApiConflictResponse({
    description: 'Doublon détecté — renvoyer confirmDuplicate: true pour forcer',
  })
  create(
    @Body() dto: CreateClientDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.clientsService.create(dto, req.user.tenantId, req.user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les clients (paginé)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'q', required: false, description: 'Recherche texte' })
  findAll(
    @Request() req: { user: { tenantId: string } },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('q') q?: string,
  ) {
    return this.clientsService.findAll(
      req.user.tenantId,
      Number(page),
      Number(limit),
      q,
    );
  }

  @Get('search')
  @ApiOperation({ summary: 'Recherche rapide clients (auto-complétion)' })
  @ApiQuery({ name: 'q', required: false })
  search(@Request() req: { user: { tenantId: string } }, @Query('q') q = '') {
    return this.clientsService.search(req.user.tenantId, q);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Fiche client détaillée',
    description:
      'RM-C04 — inclut l’historique des devis, factures, bons de commande et paiements.',
  })
  findOne(@Param('id') id: string, @Request() req: { user: { tenantId: string } }) {
    return this.clientsService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Permissions('manage:clients')
  @ApiOperation({
    summary: 'Modifier un client',
    description: 'Le code client CLT-XXXXXX n’est pas modifiable (RM-C01).',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.clientsService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @Permissions('manage:clients')
  @ApiOperation({
    summary: 'Archiver un client',
    description:
      'RM-C05 — archivage uniquement si des transactions existent ; sinon masquage (soft delete).',
  })
  @ApiResponse({ status: 200, description: 'Client archivé' })
  remove(@Param('id') id: string, @Request() req: { user: { tenantId: string } }) {
    return this.clientsService.remove(id, req.user.tenantId);
  }

  @Post(':id/contacts')
  @Permissions('manage:clients')
  @ApiOperation({ summary: 'Ajouter un contact au client' })
  createContact(
    @Param('id') id: string,
    @Body() dto: CreateContactDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.clientsService.createContact(id, req.user.tenantId, dto);
  }

  @Patch('contacts/:id')
  @Permissions('manage:clients')
  @ApiOperation({ summary: 'Modifier un contact' })
  updateContact(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.clientsService.updateContact(id, req.user.tenantId, dto);
  }

  @Delete('contacts/:id')
  @Permissions('manage:clients')
  @ApiOperation({
    summary: 'Supprimer un contact',
    description: 'Impossible de supprimer le dernier contact (RM-C02).',
  })
  removeContact(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.clientsService.removeContact(id, req.user.tenantId);
  }
}
