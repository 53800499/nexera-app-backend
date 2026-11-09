import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllowAuthenticated } from '../../common/decorators/allow-authenticated.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { PlatformDashboardService } from './services/platform-dashboard.service';
import { PlatformTenantsService } from './services/platform-tenants.service';
import { PlatformUsersService } from './services/platform-users.service';
import { PlatformAssistanceService } from './services/platform-assistance.service';
import { PlatformAuditService } from './services/platform-audit.service';
import { PlatformHealthService } from './services/platform-health.service';
import { PlatformIncidentsService } from './services/platform-incidents.service';
import { PlatformOpsService } from './services/platform-ops.service';
import {
  ActivateTenantDto,
  CreateAssistanceSessionDto,
  CreateBroadcastDto,
  CreateIncidentDto,
  CreateTenantByAdminDto,
  ResetUserPasswordDto,
  RevokeAssistanceSessionDto,
  SuspendTenantDto,
  ToggleSuperAdminDto,
  ToggleUserStatusDto,
  UpdateIncidentDto,
  UpdateMaintenanceDto,
  UpdateTenantQuotasDto,
} from './dto/platform.dto';

@ApiTags('platform-control-plane')
@ApiBearerAuth('access-token')
@Controller('platform')
@AllowAuthenticated()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class PlatformController {
  constructor(
    private readonly dashboardService: PlatformDashboardService,
    private readonly tenantsService: PlatformTenantsService,
    private readonly usersService: PlatformUsersService,
    private readonly assistanceService: PlatformAssistanceService,
    private readonly auditService: PlatformAuditService,
    private readonly healthService: PlatformHealthService,
    private readonly incidentsService: PlatformIncidentsService,
    private readonly opsService: PlatformOpsService,
  ) {}

  private getAdminUser(req: any) {
    return {
      id: req.user?.id || req.user?.sub,
      email: req.user?.email || 'admin@nexera.erp',
    };
  }

  // ----------------------------------------------------
  // 1. DASHBOARD & KPIS
  // ----------------------------------------------------

  @Get('dashboard/kpis')
  @ApiOperation({ summary: 'Indicateurs clés du Control Plane' })
  async getDashboardKpis() {
    return this.dashboardService.getKpis();
  }

  @Get('dashboard/activity')
  @ApiOperation({ summary: 'Flux d’activité et journal d’audit récent' })
  async getRecentActivity(@Query('limit') limit?: number) {
    return this.dashboardService.getRecentActivity(Number(limit) || 10);
  }

  // ----------------------------------------------------
  // 2. GESTION DES ENTREPRISES (TENANTS)
  // ----------------------------------------------------

  @Get('tenants')
  @ApiOperation({ summary: 'Liste paginée de toutes les entreprises clientes' })
  async listTenants(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.tenantsService.listTenants({ search, status, type, page, limit });
  }

  @Get('tenants/export')
  @ApiOperation({ summary: 'Exporter la liste complète des entreprises' })
  async exportTenants() {
    return this.tenantsService.exportTenants();
  }

  @Post('tenants')
  @ApiOperation({ summary: 'Créer manuellement une entreprise et son administrateur' })
  async createTenant(
    @Body() dto: CreateTenantByAdminDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.tenantsService.createTenant(dto, this.getAdminUser(req), ip);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Détail 360° d’une entreprise' })
  async getTenantDetail(@Param('id') id: string) {
    return this.tenantsService.getTenantDetail(id);
  }

  @Patch('tenants/:id/quotas')
  @ApiOperation({ summary: 'Mettre à jour les quotas (utilisateurs, stockage, modules)' })
  async updateTenantQuotas(
    @Param('id') id: string,
    @Body() dto: UpdateTenantQuotasDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.tenantsService.updateQuotas(id, dto, this.getAdminUser(req), ip);
  }

  @Patch('tenants/:id/suspend')
  @ApiOperation({ summary: 'Suspendre une entreprise' })
  async suspendTenant(
    @Param('id') id: string,
    @Body() dto: SuspendTenantDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.tenantsService.suspendTenant(id, dto, this.getAdminUser(req), ip);
  }

  @Patch('tenants/:id/activate')
  @ApiOperation({ summary: 'Réactiver une entreprise suspendue' })
  async activateTenant(
    @Param('id') id: string,
    @Body() dto: ActivateTenantDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.tenantsService.activateTenant(id, dto, this.getAdminUser(req), ip);
  }

  // ----------------------------------------------------
  // 3. GESTION DES UTILISATEURS (GLOBAL DIRECTORY)
  // ----------------------------------------------------

  @Get('users')
  @ApiOperation({ summary: 'Annuaire global de tous les utilisateurs plateforme' })
  async listUsers(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('tenantId') tenantId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.usersService.listUsers({ search, isActive, tenantId, page, limit });
  }

  @Get('users/:id/activity')
  @ApiOperation({ summary: 'Consulter l’activité détaillée et connexions d’un utilisateur' })
  async getUserActivity(@Param('id') id: string) {
    return this.usersService.getUserActivity(id);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Bloquer ou débloquer un compte utilisateur' })
  async toggleUserStatus(
    @Param('id') id: string,
    @Body() dto: ToggleUserStatusDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.usersService.toggleUserStatus(id, dto, this.getAdminUser(req), ip);
  }

  @Patch('users/:id/super-admin')
  @ApiOperation({ summary: 'Promouvoir ou révoquer les privilèges Super Administrateur' })
  async toggleSuperAdmin(
    @Param('id') id: string,
    @Body() dto: ToggleSuperAdminDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.usersService.toggleSuperAdmin(id, dto, this.getAdminUser(req), ip);
  }

  @Post('users/:id/revoke-sessions')
  @ApiOperation({ summary: 'Invalider toutes les sessions actives (déconnexion forcée)' })
  async revokeUserSessions(
    @Param('id') id: string,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.usersService.revokeSessions(id, this.getAdminUser(req), ip);
  }

  @Post('users/:id/reset-2fa')
  @ApiOperation({ summary: 'Réinitialiser la double authentification (2FA)' })
  async resetUser2FA(
    @Param('id') id: string,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.usersService.reset2FA(id, this.getAdminUser(req), ip);
  }

  @Post('users/:id/reset-password')
  @ApiOperation({ summary: 'Réinitialiser le mot de passe (e-mail, lien direct ou manuel)' })
  async sendPasswordReset(
    @Param('id') id: string,
    @Body() dto: ResetUserPasswordDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.usersService.sendPasswordReset(id, dto, this.getAdminUser(req), ip);
  }

  // ----------------------------------------------------
  // 4. ASSISTANCE CONTRÔLÉE (SUPPORT JIT)
  // ----------------------------------------------------

  @Get('assistance')
  @Get('assistance/sessions')
  @ApiOperation({ summary: 'Historique des sessions d’assistance JIT' })
  async listAssistanceSessions() {
    return this.assistanceService.listSessions();
  }

  @Post('assistance')
  @Post('assistance/sessions')
  @Post('assistance/initiate')
  @ApiOperation({ summary: 'Initier une session d’assistance JIT' })
  async initiateAssistanceSession(
    @Body() dto: CreateAssistanceSessionDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.assistanceService.initiateSession(dto, this.getAdminUser(req), ip);
  }

  @Post('assistance/:id/revoke')
  @Post('assistance/sessions/:id/revoke')
  @ApiOperation({ summary: 'Révoquer immédiatement une session d’assistance' })
  async revokeAssistanceSession(
    @Param('id') id: string,
    @Body() dto: RevokeAssistanceSessionDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.assistanceService.revokeSession(id, dto, this.getAdminUser(req), ip);
  }

  // ----------------------------------------------------
  // 5. JOURNAL D'AUDIT SÉCURISÉ (APPEND-ONLY)
  // ----------------------------------------------------

  @Get('audit')
  @ApiOperation({ summary: 'Journal d’audit inaltérable des actions Super Admin' })
  async getAuditLogs(
    @Query('action') action?: string,
    @Query('targetEntity') targetEntity?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.auditService.getLogs({ action, targetEntity, search, page, limit });
  }

  // ----------------------------------------------------
  // 6. SANTÉ TECHNIQUE & RESSOURCES (HEALTH)
  // ----------------------------------------------------

  @Get('health')
  @ApiOperation({ summary: 'Diagnostic en temps réel : PostgreSQL, latence, mémoire' })
  async getHealth() {
    return this.healthService.getSystemHealth();
  }

  // ----------------------------------------------------
  // 7. INCIDENTS & SUPERVISION OPÉRATIONNELLE
  // ----------------------------------------------------

  @Get('incidents')
  @ApiOperation({ summary: 'Liste des incidents de la plateforme' })
  async listIncidents() {
    return this.incidentsService.listIncidents();
  }

  @Post('incidents')
  @ApiOperation({ summary: 'Déclarer un nouvel incident' })
  async createIncident(
    @Body() dto: CreateIncidentDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.incidentsService.createIncident(dto, this.getAdminUser(req), ip);
  }

  @Patch('incidents/:id')
  @ApiOperation({ summary: 'Mettre à jour l’état d’un incident' })
  async updateIncident(
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.incidentsService.updateIncident(id, dto, this.getAdminUser(req), ip);
  }

  // ----------------------------------------------------
  // 8. TÂCHES PROGRAMMÉES, SERVICES EXTERNES & SAUVEGARDES
  // ----------------------------------------------------

  @Get('crons')
  @Get('monitoring/crons')
  @ApiOperation({ summary: 'Supervision des tâches d’arrière-plan (crons)' })
  async listCrons() {
    return this.opsService.listCrons();
  }

  @Get('external-services')
  @Get('monitoring/external-services')
  @ApiOperation({ summary: 'État de santé des services externes (Brevo, DB, Storage)' })
  async getExternalServices() {
    return this.opsService.getExternalServices();
  }

  @Get('backups')
  @Get('monitoring/backups')
  @ApiOperation({ summary: 'Statut et historique des sauvegardes PostgreSQL' })
  async getBackups() {
    return this.opsService.getBackups();
  }

  @Post('backups/trigger')
  @Post('monitoring/backups/trigger')
  @ApiOperation({ summary: 'Déclencher un instantané de sauvegarde manuelle' })
  async triggerBackup(@Request() req: any, @Ip() ip: string) {
    return this.opsService.triggerBackup(this.getAdminUser(req), ip);
  }

  // ----------------------------------------------------
  // 9. DIFFUSION GLOBALE & MODE MAINTENANCE
  // ----------------------------------------------------

  @Get('broadcasts/active')
  @ApiOperation({ summary: 'Message de diffusion actif sur la plateforme' })
  async getActiveBroadcast() {
    return this.opsService.getActiveBroadcast();
  }

  @Get('broadcast/active')
  async getActiveBroadcastAlias() {
    return this.opsService.getActiveBroadcast();
  }

  @Get('broadcasts')
  @ApiOperation({ summary: 'Historique des diffusions globales' })
  async listBroadcasts() {
    return this.opsService.listBroadcasts();
  }

  @Get('broadcast')
  async listBroadcastsAlias() {
    return this.opsService.listBroadcasts();
  }

  @Post('broadcasts')
  @ApiOperation({ summary: 'Diffuser un message d’alerte ou d’information' })
  async createBroadcast(
    @Body() dto: CreateBroadcastDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.opsService.createBroadcast(dto, this.getAdminUser(req), ip);
  }

  @Post('broadcast')
  async createBroadcastAlias(
    @Body() dto: CreateBroadcastDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.opsService.createBroadcast(dto, this.getAdminUser(req), ip);
  }

  @Patch('broadcasts/:id/status')
  @Patch('broadcasts/:id/toggle')
  @Patch('broadcast/:id/status')
  @Patch('broadcast/:id/toggle')
  @ApiOperation({ summary: 'Activer ou désactiver une diffusion' })
  async toggleBroadcast(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.opsService.toggleBroadcast(id, Boolean(isActive), this.getAdminUser(req), ip);
  }

  @Delete('broadcasts/:id')
  @Delete('broadcast/:id')
  @ApiOperation({ summary: 'Supprimer un message de diffusion' })
  async deleteBroadcast(@Param('id') id: string, @Request() req: any, @Ip() ip: string) {
    return this.opsService.deleteBroadcast(id, this.getAdminUser(req), ip);
  }

  @Get('maintenance')
  @Get('settings/maintenance')
  @ApiOperation({ summary: 'Consulter le statut du Mode Maintenance' })
  async getMaintenanceStatus() {
    return this.opsService.getMaintenanceStatus();
  }

  @Post('maintenance')
  @Patch('maintenance')
  @Patch('settings/maintenance')
  @ApiOperation({ summary: 'Activer ou désactiver le Mode Maintenance global' })
  async updateMaintenanceStatus(
    @Body() dto: UpdateMaintenanceDto,
    @Request() req: any,
    @Ip() ip: string,
  ) {
    return this.opsService.updateMaintenanceStatus(dto, this.getAdminUser(req), ip);
  }
}
