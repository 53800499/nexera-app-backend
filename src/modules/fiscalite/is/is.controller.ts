import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ImpotSocietesService } from './is.service';
import {
  CreateExerciceFiscalDto,
  CreateRetraitementDto,
  SimulerCalculIsDto,
} from '../dto/fiscalite.dto';

@ApiTags('fiscalite-is')
@ApiBearerAuth('access-token')
@Controller('fiscalite/is')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ImpotSocietesController {
  constructor(private readonly isService: ImpotSocietesService) {}

  @Get('exercices')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Lister les exercices fiscaux d’un contribuable' })
  @ApiQuery({ name: 'taxContribuableId', required: true })
  async getExercices(@Query('taxContribuableId') taxContribuableId: string) {
    return this.isService.getExercices(taxContribuableId);
  }

  @Post('exercices')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Créer un nouvel exercice fiscal annuel avec ses 4 acomptes' })
  async createExercice(@Body() dto: CreateExerciceFiscalDto) {
    return this.isService.createExercice(dto);
  }

  @Get('exercices/:id')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Obtenir le détail d’un exercice fiscal (retraitements, calcul IS, acomptes)' })
  async getExerciceById(@Param('id') id: string) {
    return this.isService.getExerciceById(id);
  }

  @Post('exercices/:id/retraitements')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Ajouter une réintégration ou déduction fiscale extracomptable' })
  async addRetraitement(
    @Param('id') id: string,
    @Body() dto: CreateRetraitementDto,
  ) {
    return this.isService.addRetraitement(id, dto);
  }

  @Delete('retraitements/:id')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Supprimer un retraitement fiscal' })
  async deleteRetraitement(@Param('id') id: string) {
    return this.isService.deleteRetraitement(id);
  }

  @Post('simuler')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Simuler le calcul de l’IS (comparaison avec minimum de perception Bénin CGI 2026)' })
  simuler(@Body() dto: SimulerCalculIsDto) {
    return this.isService.simulerCalcul(dto);
  }

  @Post('exercices/:id/calculer')
  @Permissions('fiscalite.is.manage')
  @ApiOperation({ summary: 'Calculer et enregistrer officiellement l’IS d’un exercice' })
  async calculerEtEnregistrer(
    @Param('id') id: string,
    @Body() body: { resultatComptableNet: number; produitsEncaissables: number },
    @Request() req: any,
  ) {
    return this.isService.calculerEtEnregistrer(
      id,
      body.resultatComptableNet,
      body.produitsEncaissables,
      req.user?.id || req.user?.userId,
    );
  }

  @Post('exercices/:id/valider-transmission-m3')
  @Permissions('fiscalite.is.manage')
  @ApiOperation({ summary: 'Valider l’IS et générer l’écriture comptable retour 695/444 vers M3 (EF-045)' })
  async validerTransmission(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.isService.validerEtGenererEcritureM3(id, req.user?.id || req.user?.userId);
  }

  @Put('acomptes/:id/payer')
  @Permissions('fiscalite.write')
  @ApiOperation({ summary: 'Enregistrer le règlement d’un acompte trimestriel' })
  async payerAcompte(
    @Param('id') id: string,
    @Body() body: { montant: number },
  ) {
    return this.isService.payerAcompte(id, body.montant);
  }
}
