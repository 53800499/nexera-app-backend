import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { PlanComptableService } from './plan-comptable.service';
import {
  CreateCompteAuxiliaireDto,
  CreateCompteDto,
  UpdateCompteDto,
} from '../dto/compta.dto';

@ApiTags('compta-plan-comptable')
@ApiBearerAuth('access-token')
@Controller('compta/plan-comptable')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlanComptableController {
  constructor(private readonly service: PlanComptableService) {}

  @Get()
  @Permissions('compta.read')
  @ApiOperation({ summary: 'Consulter le plan comptable activé du tenant' })
  @ApiQuery({ name: 'classe', required: false })
  @ApiQuery({ name: 'statut', required: false })
  @ApiQuery({ name: 'actif', required: false })
  @ApiQuery({ name: 'search', required: false })
  async listComptesRoot(
    @Request() req: any,
    @Query('classe') classe?: string,
    @Query('statut') statut?: string,
    @Query('actif') actif?: string,
    @Query('search') search?: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const computedStatut = statut || (actif === 'true' ? 'ACTIF' : actif === 'false' ? 'INACTIF' : undefined);
    return this.service.listComptes(
      tenantId,
      classe ? parseInt(classe, 10) : undefined,
      computedStatut,
      search,
    );
  }

  @Post()
  @Permissions('compta.write')
  @ApiOperation({ summary: 'Créer / activer un compte dans le plan du tenant' })
  async createCompteRoot(@Request() req: any, @Body() dto: CreateCompteDto) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.createCompte(tenantId, dto, userId);
  }

  @Get('modeles')
  @Permissions('compta.read')
  @ApiOperation({ summary: 'Consulter le référentiel modèle SYSCOHADA (443 comptes)' })
  @ApiQuery({ name: 'paysCode', required: false, example: 'BJ' })
  @ApiQuery({ name: 'classe', required: false })
  @ApiQuery({ name: 'search', required: false })
  async listModeles(
    @Query('paysCode') paysCode?: string,
    @Query('classe') classe?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listModeles(
      paysCode || 'BJ',
      classe ? parseInt(classe, 10) : undefined,
      search,
    );
  }

  // ---------------- COMPTES AUXILIAIRES (AVANT :id !) ----------------

  @Get('auxiliaires')
  @Permissions('compta.read')
  @ApiOperation({ summary: 'Lister les comptes auxiliaires de tiers (classe 4)' })
  @ApiQuery({ name: 'compteCollectifId', required: false })
  @ApiQuery({ name: 'search', required: false })
  async listAuxiliaires(
    @Request() req: any,
    @Query('compteCollectifId') compteCollectifId?: string,
    @Query('search') search?: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.service.listAuxiliaires(tenantId, compteCollectifId, search);
  }

  @Post('auxiliaires')
  @Permissions('compta.write')
  @ApiOperation({ summary: 'Créer un sous-compte auxiliaire de tiers alphanumérique' })
  async createAuxiliaire(@Request() req: any, @Body() dto: CreateCompteAuxiliaireDto) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.createAuxiliaire(tenantId, dto, userId);
  }

  // ---------------- COMPTES DU TENANT ----------------

  @Get('comptes')
  @Permissions('compta.read')
  @ApiOperation({ summary: 'Consulter le plan comptable activé du tenant' })
  @ApiQuery({ name: 'classe', required: false })
  @ApiQuery({ name: 'statut', required: false })
  @ApiQuery({ name: 'actif', required: false })
  @ApiQuery({ name: 'search', required: false })
  async listComptes(
    @Request() req: any,
    @Query('classe') classe?: string,
    @Query('statut') statut?: string,
    @Query('actif') actif?: string,
    @Query('search') search?: string,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const computedStatut = statut || (actif === 'true' ? 'ACTIF' : actif === 'false' ? 'INACTIF' : undefined);
    return this.service.listComptes(
      tenantId,
      classe ? parseInt(classe, 10) : undefined,
      computedStatut,
      search,
    );
  }

  @Post('comptes')
  @Permissions('compta.write')
  @ApiOperation({ summary: 'Créer / activer un compte dans le plan du tenant' })
  async createCompte(@Request() req: any, @Body() dto: CreateCompteDto) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.createCompte(tenantId, dto, userId);
  }

  @Get('comptes/:id')
  @Permissions('compta.read')
  @ApiOperation({ summary: 'Détail d’un compte comptable' })
  async getCompte(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.service.getCompteById(tenantId, id);
  }

  @Put('comptes/:id')
  @Permissions('compta.write')
  @ApiOperation({ summary: 'Modifier un compte (libellé, archivage)' })
  async updateCompte(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCompteDto,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.updateCompte(tenantId, id, dto, userId);
  }

  @Patch(':id/toggle-actif')
  @Permissions('compta.write')
  @ApiOperation({ summary: 'Activer ou désactiver un compte comptable' })
  async toggleActifPatch(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.toggleActif(tenantId, id, userId);
  }

  @Put(':id/toggle-actif')
  @Permissions('compta.write')
  @ApiOperation({ summary: 'Activer ou désactiver un compte comptable' })
  async toggleActifPut(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.toggleActif(tenantId, id, userId);
  }

  // ---------------- PARAMÈTRE DIRECT :id EN DERNIER RECOURS ----------------

  @Get(':id')
  @Permissions('compta.read')
  @ApiOperation({ summary: 'Détail d’un compte comptable' })
  async getCompteDirect(@Request() req: any, @Param('id') id: string) {
    const tenantId = req.user?.tenantId || req.tenantId;
    return this.service.getCompteById(tenantId, id);
  }

  @Put(':id')
  @Permissions('compta.write')
  @ApiOperation({ summary: 'Modifier un compte (libellé, archivage)' })
  async updateCompteDirect(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCompteDto,
  ) {
    const tenantId = req.user?.tenantId || req.tenantId;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    return this.service.updateCompte(tenantId, id, dto, userId);
  }
}
