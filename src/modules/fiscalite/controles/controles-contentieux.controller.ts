import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { ControlesContentieuxService } from './controles-contentieux.service';
import {
  CreerControleFiscalDto,
  EstimerPenaliteDto,
  IntroduireRecoursDto,
  NotifierRedressementDto,
} from '../dto/fiscalite.dto';

@ApiTags('fiscalite-controles')
@ApiBearerAuth('access-token')
@Controller('fiscalite/controles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ControlesContentieuxController {
  constructor(private readonly controlesService: ControlesContentieuxService) {}

  @Post('penalites/estimer')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Estimer les pénalités et intérêts de retard applicables selon le CGI 2026 Art. 485-488' })
  estimerPenalite(@Body() dto: EstimerPenaliteDto) {
    return this.controlesService.estimerPenalite(dto);
  }

  @Get()
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Lister les procédures de contrôle fiscal d’un contribuable' })
  @ApiQuery({ name: 'taxContribuableId', required: true })
  async getControles(@Query('taxContribuableId') taxContribuableId: string) {
    return this.controlesService.getControles(taxContribuableId);
  }

  @Post()
  @Permissions('fiscalite.controles.manage')
  @ApiOperation({ summary: 'Enregistrer une nouvelle procédure de contrôle fiscal (sur pièces / sur place)' })
  async creerControle(@Body() dto: CreerControleFiscalDto) {
    return this.controlesService.creerControle(dto);
  }

  @Post(':id/redressements')
  @Permissions('fiscalite.controles.manage')
  @ApiOperation({ summary: 'Enregistrer une notification de redressement fiscal' })
  async notifierRedressement(
    @Param('id') id: string,
    @Body() dto: NotifierRedressementDto,
  ) {
    return this.controlesService.notifierRedressement(id, dto);
  }

  @Get('reclamations')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Lister les recours et contentieux introduits' })
  @ApiQuery({ name: 'taxContribuableId', required: true })
  async getReclamations(@Query('taxContribuableId') taxContribuableId: string) {
    return this.controlesService.getReclamations(taxContribuableId);
  }

  @Post('reclamations')
  @Permissions('fiscalite.controles.manage')
  @ApiOperation({ summary: 'Introduire un recours gracieux, hiérarchique ou juridictionnel' })
  async introduireRecours(@Body() dto: IntroduireRecoursDto) {
    return this.controlesService.introduireRecours(dto);
  }

  @Put('reclamations/:id/clore')
  @Permissions('fiscalite.controles.manage')
  @ApiOperation({ summary: 'Enregistrer la décision de l’Administration fiscale sur un recours' })
  async cloreRecours(
    @Param('id') id: string,
    @Body() body: { statut: 'ACCEPTEE' | 'REJETEE' | 'PARTIELLEMENT_ACCEPTEE'; decisionUrl?: string },
  ) {
    return this.controlesService.cloreRecours(id, body.statut, body.decisionUrl);
  }
}
