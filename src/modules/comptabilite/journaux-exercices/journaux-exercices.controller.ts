import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { JournauxExercicesService } from './journaux-exercices.service';
import {
  ClotureExerciceDto,
  CreateExerciceDto,
  CreateJournalDto,
  ReouvertureExerciceDto,
} from '../dto/compta.dto';

@ApiTags('compta-journaux-exercices')
@ApiBearerAuth('access-token')
@Controller('compta/journaux-exercices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JournauxExercicesController {
  constructor(private readonly service: JournauxExercicesService) {}

  // ---------------- JOURNAUX ----------------

  @Get('journaux')
  @Permissions('compta.read')
  @ApiOperation({ summary: 'Lister les journaux comptables du tenant' })
  async listJournaux(@Request() req: any) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.service.listJournaux(tenantId);
  }

  @Post('journaux')
  @Permissions('compta.write')
  @ApiOperation({ summary: 'Créer un nouveau journal comptable' })
  async createJournal(@Request() req: any, @Body() dto: CreateJournalDto) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.createJournal(tenantId, dto, userId);
  }

  // ---------------- EXERCICES ----------------

  @Get('exercices')
  @Permissions('compta.read')
  @ApiOperation({ summary: 'Lister tous les exercices comptables' })
  async listExercices(@Request() req: any) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.service.listExercices(tenantId);
  }

  @Get('exercices/actif')
  @Permissions('compta.read')
  @ApiOperation({ summary: 'Consulter l’exercice comptable actif en cours' })
  async getExerciceActif(@Request() req: any) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.service.getExerciceActif(tenantId);
  }

  @Post('exercices')
  @Permissions('compta.cloture.manage')
  @ApiOperation({ summary: 'Ouvrir un nouvel exercice comptable' })
  async createExercice(@Request() req: any, @Body() dto: CreateExerciceDto) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.createExercice(tenantId, dto, userId);
  }

  @Put('periodes/:id/cloturer')
  @Permissions('compta.cloture.manage')
  @ApiOperation({ summary: 'Clôturer une période mensuelle' })
  async cloturerPeriode(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.cloturerPeriode(tenantId, id, userId);
  }

  @Post('periodes/:id/cloturer')
  @Permissions('compta.cloture.manage')
  @ApiOperation({ summary: 'Clôturer une période mensuelle' })
  async cloturerPeriodePost(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.cloturerPeriode(tenantId, id, userId);
  }

  @Put('exercices/:id/cloturer')
  @Permissions('compta.cloture.manage')
  @ApiOperation({ summary: 'Clôturer un exercice comptable (UC-12)' })
  async cloturerExercice(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ClotureExerciceDto = {},
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.cloturerExercice(tenantId, id, dto || {}, userId);
  }

  @Post('exercices/:id/cloturer')
  @Permissions('compta.cloture.manage')
  @ApiOperation({ summary: 'Clôturer un exercice comptable (UC-12)' })
  async cloturerExercicePost(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ClotureExerciceDto = {},
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.cloturerExercice(tenantId, id, dto || {}, userId);
  }

  @Post('exercices/:id/rouvrir')
  @Permissions('compta.cloture.manage')
  @ApiOperation({ summary: 'Rouvrir un exercice clôturé pour régularisation (UC-13)' })
  async rouvrirExercice(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ReouvertureExerciceDto,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.rouvrirExercice(tenantId, id, dto, userId);
  }

  @Put('exercices/:id/archiver')
  @Permissions('compta.cloture.manage')
  @ApiOperation({ summary: 'Archiver définitivement un exercice (scellement SHA-256 UC-14)' })
  async archiverExercice(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.archiverExercice(tenantId, id, userId);
  }

  @Post('exercices/:id/archiver')
  @Permissions('compta.cloture.manage')
  @ApiOperation({ summary: 'Archiver définitivement un exercice (scellement SHA-256 UC-14)' })
  async archiverExercicePost(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.archiverExercice(tenantId, id, userId);
  }
}
