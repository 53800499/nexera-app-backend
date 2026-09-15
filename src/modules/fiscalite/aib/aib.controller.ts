import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { AibService } from './aib.service';
import { SimulerCalculAibDto } from '../dto/fiscalite.dto';

@ApiTags('fiscalite-aib')
@ApiBearerAuth('access-token')
@Controller('fiscalite/aib')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AibController {
  constructor(private readonly aibService: AibService) {}

  @Post('simuler')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Simuler le calcul de la retenue AIB (1%, 3% ou 5% selon CGI 2026 Art. 132)' })
  simuler(@Body() dto: SimulerCalculAibDto) {
    return this.aibService.simulerCalcul(dto);
  }

  @Get('retenues')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Lister les retenues AIB subies ou opérées pour un contribuable' })
  @ApiQuery({ name: 'taxContribuableId', required: true })
  @ApiQuery({ name: 'periode', required: false, example: '2026-03' })
  async getRetenues(
    @Query('taxContribuableId') taxContribuableId: string,
    @Query('periode') periode?: string,
  ) {
    return this.aibService.getRetenuesSubies(taxContribuableId, periode);
  }

  @Get('recapitulatif')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Obtenir le récapitulatif annuel de l’AIB imputable sur l’IS' })
  @ApiQuery({ name: 'taxContribuableId', required: true })
  @ApiQuery({ name: 'annee', required: false, example: '2026' })
  async getRecapitulatif(
    @Query('taxContribuableId') taxContribuableId: string,
    @Query('annee') annee?: string,
  ) {
    return this.aibService.getRecapitulatifAib(taxContribuableId, annee);
  }
}
