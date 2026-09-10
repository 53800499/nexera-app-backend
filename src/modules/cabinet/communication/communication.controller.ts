import {
  Body,
  Controller,
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
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CabinetTenantGuard } from '../../../common/guards/cabinet-tenant.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { CommunicationService } from './communication.service';
import {
  CreateCabinetDemandePieceDto,
  CreateCabinetDocumentPartageDto,
  CreateCabinetMessageDto,
  UpdateCabinetDemandePieceDto,
} from '../dto/communication.dto';

@ApiTags('cabinet-communication')
@ApiBearerAuth('access-token')
@Controller('cabinet/communication')
@UseGuards(JwtAuthGuard, PermissionsGuard, CabinetTenantGuard)
export class CommunicationController {
  constructor(private readonly communicationService: CommunicationService) {}

  @Get('demandes-pieces')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Lister les demandes de pièces' })
  @ApiQuery({ name: 'mandatId', required: false })
  listDemandes(
    @Request() req: { user: { tenantId: string } },
    @Query('mandatId') mandatId?: string,
  ) {
    return this.communicationService.listDemandesPiece(
      req.user.tenantId,
      mandatId,
    );
  }

  @Post('demandes-pieces')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Créer une demande formelle de pièces' })
  createDemande(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: CreateCabinetDemandePieceDto,
  ) {
    return this.communicationService.createDemandePiece(req.user.tenantId, dto);
  }

  @Patch('demandes-pieces/:id')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Mettre à jour une demande de pièce' })
  updateDemande(
    @Request() req: { user: { tenantId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateCabinetDemandePieceDto,
  ) {
    return this.communicationService.updateDemandePiece(
      req.user.tenantId,
      id,
      dto,
    );
  }

  @Post('demandes-pieces/:id/relance')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Relancer une demande de pièces en attente' })
  relancerDemande(
    @Request() req: { user: { tenantId: string } },
    @Param('id') id: string,
  ) {
    return this.communicationService.relancerDemandePiece(
      req.user.tenantId,
      id,
    );
  }

  @Get('messages/:mandatId')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'mandatId', format: 'uuid' })
  @ApiOperation({ summary: 'Obtenir les messages rattachés au mandat' })
  listMessages(
    @Request() req: { user: { tenantId: string } },
    @Param('mandatId') mandatId: string,
  ) {
    return this.communicationService.listMessagesByMandat(
      req.user.tenantId,
      mandatId,
    );
  }

  @Post('messages')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Envoyer un message dans le fil du mandat' })
  sendMessage(
    @Request() req: { user: { tenantId: string; id?: string } },
    @Body() dto: CreateCabinetMessageDto,
  ) {
    return this.communicationService.sendMessage(
      req.user.tenantId,
      req.user.id || null,
      dto,
    );
  }

  @Get('documents/:mandatId')
  @Permissions('cabinet.read')
  @ApiParam({ name: 'mandatId', format: 'uuid' })
  @ApiOperation({ summary: 'Lister les documents partagés du mandat' })
  listDocuments(
    @Request() req: { user: { tenantId: string } },
    @Param('mandatId') mandatId: string,
  ) {
    return this.communicationService.listDocumentsPartages(
      req.user.tenantId,
      mandatId,
    );
  }

  @Post('documents')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Déposer un document dans l’espace partagé' })
  addDocument(
    @Request() req: { user: { tenantId: string; id?: string } },
    @Body() dto: CreateCabinetDocumentPartageDto,
  ) {
    return this.communicationService.addDocumentPartage(
      req.user.tenantId,
      req.user.id || null,
      dto,
    );
  }
}
