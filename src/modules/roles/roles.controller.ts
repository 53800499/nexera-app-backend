import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('roles')
@ApiBearerAuth('access-token')
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Post()
  @Permissions('manage:roles')
  @ApiOperation({
    summary: 'Créer un nouveau rôle',
    description: 'Définit un nouveau profil d’accès avec un code, un nom et une liste de permissions.',
  })
  @ApiResponse({ status: 201, description: 'Rôle créé avec succès' })
  async create(@Body() dto: CreateRoleDto, @Request() req: any) {
    return this.rolesService.create(dto);
  }

  @Get()
  @Permissions('manage:roles', 'manage:rh', 'rh.read')
  @ApiOperation({
    summary: 'Lister les rôles de l’organisation',
    description: 'Retourne l’ensemble des rôles configurés pour le tenant, accessible pour la gestion IAM et RH.',
  })
  @ApiResponse({ status: 200, description: 'Liste des rôles' })
  async findAll(@Request() req: any) {
    return this.rolesService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @Permissions('manage:roles')
  @ApiOperation({
    summary: 'Détail d’un rôle',
    description: 'Retourne la définition d’un rôle incluant ses permissions associées.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du rôle' })
  @ApiResponse({ status: 200, description: 'Détail du rôle' })
  @ApiResponse({ status: 404, description: 'Rôle introuvable' })
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.rolesService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Permissions('manage:roles')
  @ApiOperation({
    summary: 'Modifier un rôle',
    description: 'Met à jour le nom, la description ou les permissions d’un rôle existant.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du rôle' })
  @ApiResponse({ status: 200, description: 'Rôle mis à jour' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @Request() req: any,
  ) {
    return this.rolesService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @Permissions('manage:roles')
  @ApiOperation({
    summary: 'Supprimer un rôle',
    description: 'Supprime un rôle personnalisé s’il n’est plus assigné à des utilisateurs critiques.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID du rôle' })
  @ApiResponse({ status: 200, description: 'Rôle supprimé' })
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.rolesService.remove(id, req.user.tenantId);
  }

  @Post(':roleId/permissions/:permissionId')
  @Permissions('manage:roles')
  @ApiOperation({
    summary: 'Attacher une permission à un rôle',
    description: 'Ajoute une permission spécifique au rôle.',
  })
  @ApiParam({ name: 'roleId', description: 'Identifiant UUID du rôle' })
  @ApiParam({ name: 'permissionId', description: 'Identifiant UUID de la permission' })
  @ApiResponse({ status: 200, description: 'Permission attachée' })
  async addPermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Request() req: any,
  ) {
    return this.rolesService.addPermission(
      roleId,
      permissionId,
      req.user.tenantId,
    );
  }

  @Delete(':roleId/permissions/:permissionId')
  @Permissions('manage:roles')
  @ApiOperation({
    summary: 'Détacher une permission d’un rôle',
    description: 'Retire une permission spécifique du rôle.',
  })
  @ApiParam({ name: 'roleId', description: 'Identifiant UUID du rôle' })
  @ApiParam({ name: 'permissionId', description: 'Identifiant UUID de la permission' })
  @ApiResponse({ status: 200, description: 'Permission détachée' })
  async removePermission(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
    @Request() req: any,
  ) {
    return this.rolesService.removePermission(
      roleId,
      permissionId,
      req.user.tenantId,
    );
  }
}
