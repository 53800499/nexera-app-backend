import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { LiasseFiscaleService } from './liasse-fiscale.service';

@ApiTags('fiscalite-liasse-fiscale')
@ApiBearerAuth('access-token')
@Controller('fiscalite/liasse-fiscale')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LiasseFiscaleController {
  constructor(private readonly liasseService: LiasseFiscaleService) {}

  @Get('exercice/:exerciceId')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Obtenir la liasse fiscale annuelle SYSCOHADA d’un exercice' })
  async getLiasse(@Param('exerciceId') exerciceId: string) {
    return this.liasseService.getLiasseByExercice(exerciceId);
  }

  @Post('exercice/:exerciceId/generer')
  @Permissions('fiscalite.liasse.manage')
  @ApiOperation({ summary: 'Générer le dossier de liasse fiscale pour un exercice clos' })
  async genererLiasse(
    @Param('exerciceId') exerciceId: string,
    @Body() body: { typeSystemeComptable?: 'SYSTEME_NORMAL' | 'SMT' },
  ) {
    return this.liasseService.genererLiasse(exerciceId, body?.typeSystemeComptable);
  }

  @Put(':id/valider-cabinet')
  @Permissions('fiscalite.liasse.manage')
  @ApiOperation({ summary: 'Valider et signer la liasse fiscale par le cabinet d’expertise comptable (EF-026)' })
  async validerParCabinet(@Param('id') id: string) {
    return this.liasseService.validerParCabinet(id);
  }

  @Put(':id/deposer')
  @Permissions('fiscalite.liasse.manage')
  @ApiOperation({ summary: 'Marquer la liasse fiscale comme déposée à la DGI' })
  async marquerDeposee(@Param('id') id: string) {
    return this.liasseService.marquerDeposee(id);
  }

  @Post(':id/annexes')
  @Permissions('fiscalite.liasse.manage')
  @ApiOperation({ summary: 'Ajouter une pièce annexe à la liasse fiscale (états financiers consolidés, etc.)' })
  async ajouterAnnexe(
    @Param('id') id: string,
    @Body() body: { typeAnnexe: string; documentUrl: string },
  ) {
    return this.liasseService.ajouterAnnexe(id, body.typeAnnexe, body.documentUrl);
  }
}
