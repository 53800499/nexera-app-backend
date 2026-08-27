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
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { RemboursementsCartesService } from './remboursements-cartes.service';
import {
  CreateCarteAffaireDto,
  EnregistrerPaiementDto,
  ImportTransactionCarteDto,
  RapprocherTransactionDto,
} from '../dto/remboursements.dto';

@ApiTags('notes-frais-remboursements-cartes')
@ApiBearerAuth('access-token')
@Controller('notes-frais/remboursements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RemboursementsCartesController {
  constructor(private readonly service: RemboursementsCartesService) {}

  @Get()
  @Permissions('ndf.refund.manage')
  @ApiOperation({ summary: 'Lister les ordres de remboursement' })
  @ApiQuery({ name: 'statut', required: false })
  async getRemboursements(@Request() req: any, @Query('statut') statut?: any) {
    return this.service.getRemboursements(req.user.tenantId, statut);
  }

  @Post(':id/payer')
  @Permissions('ndf.refund.manage')
  @ApiOperation({
    summary:
      'Enregistrer le règlement d’un remboursement (génère écriture comptable M3)',
  })
  @ApiParam({ name: 'id', description: 'ID du remboursement' })
  async executerRemboursement(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: EnregistrerPaiementDto,
  ) {
    return this.service.executerRemboursement(req.user.tenantId, id, dto);
  }

  @Post(':id/basculer-paie')
  @Permissions('ndf.refund.manage')
  @ApiOperation({
    summary:
      'Basculer le remboursement vers le prochain bulletin de paie M4',
  })
  @ApiParam({ name: 'id', description: 'ID du remboursement' })
  async basculerSurBulletinPaie(
    @Request() req: any,
    @Param('id') id: string,
    @Body('periodePaieCible') periodePaieCible: string,
  ) {
    return this.service.basculerSurBulletinPaie(
      req.user.tenantId,
      id,
      periodePaieCible,
    );
  }

  // ----------------------------------------------------
  // CARTES AFFAIRES
  // ----------------------------------------------------

  @Get('cartes/list')
  @Permissions('ndf.cards.reconcile')
  @ApiOperation({ summary: 'Lister les cartes affaires professionnelles' })
  async getCartesAffaires(@Request() req: any) {
    return this.service.getCartesAffaires(req.user.tenantId);
  }

  @Post('cartes')
  @Permissions('ndf.cards.reconcile')
  @ApiOperation({ summary: 'Enregistrer une carte affaire' })
  async createCarteAffaire(
    @Request() req: any,
    @Body() dto: CreateCarteAffaireDto,
  ) {
    return this.service.createCarteAffaire(req.user.tenantId, dto);
  }

  @Post('cartes/transactions')
  @Permissions('ndf.cards.reconcile')
  @ApiOperation({ summary: 'Importer une ligne de relevé de carte affaire' })
  async importerTransaction(
    @Request() req: any,
    @Body() dto: ImportTransactionCarteDto,
  ) {
    return this.service.importerTransactionCarte(req.user.tenantId, dto);
  }

  @Post('cartes/rapprocher')
  @Permissions('ndf.cards.reconcile')
  @ApiOperation({
    summary: 'Rapprocher une transaction de carte avec une dépense',
  })
  async rapprocherTransaction(
    @Request() req: any,
    @Body() dto: RapprocherTransactionDto,
  ) {
    return this.service.rapprocherTransaction(req.user.tenantId, dto);
  }
}
