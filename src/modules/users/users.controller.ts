import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-role.dto';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions('manage:users')
  @ApiOperation({
    summary: 'Créer un nouvel utilisateur ERP',
    description: 'Crée un utilisateur avec son email, mot de passe initial et rôles optionnels rattachés au tenant courant.',
  })
  @ApiResponse({ status: 201, description: 'Utilisateur créé avec succès' })
  @ApiResponse({ status: 409, description: 'Adresse email déjà utilisée' })
  async create(
    @Body() dto: CreateUserDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.create(dto, req.user.tenantId);
  }

  @Get()
  @Permissions('manage:users')
  @ApiOperation({
    summary: 'Lister les utilisateurs de l’organisation',
    description: 'Retourne la liste des utilisateurs du tenant avec leurs rôles et état d’activation.',
  })
  @ApiResponse({ status: 200, description: 'Liste des utilisateurs récupérée' })
  async findAll(@Request() req: { user: { tenantId: string } }) {
    return this.usersService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @Permissions('manage:users')
  @ApiOperation({
    summary: 'Détail d’un utilisateur',
    description: 'Retourne la fiche complète d’un utilisateur incluant ses rôles associés.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de l’utilisateur' })
  @ApiResponse({ status: 200, description: 'Détail de l’utilisateur' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  async findOne(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Permissions('manage:users')
  @ApiOperation({
    summary: 'Mettre à jour un utilisateur',
    description: 'Modifie le nom, prénom, email ou mot de passe de l’utilisateur.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de l’utilisateur' })
  @ApiResponse({ status: 200, description: 'Utilisateur mis à jour' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @Permissions('manage:users')
  @ApiOperation({
    summary: 'Supprimer un utilisateur',
    description: 'Supprime définitivement le compte utilisateur du tenant.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de l’utilisateur' })
  @ApiResponse({ status: 200, description: 'Utilisateur supprimé' })
  async remove(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.remove(id, req.user.tenantId);
  }

  @Patch(':id/status')
  @Permissions('manage:users')
  @ApiOperation({
    summary: 'Activer ou désactiver un compte utilisateur',
    description: 'Bascule l’état actif / inactif d’un utilisateur sans supprimer son compte.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de l’utilisateur' })
  @ApiBody({ schema: { properties: { isActive: { type: 'boolean', example: true } } } })
  @ApiResponse({ status: 200, description: 'Statut mis à jour' })
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.toggleStatus(id, req.user.tenantId, isActive);
  }

  @Post(':id/roles')
  @Permissions('manage:users')
  @ApiOperation({
    summary: 'Assigner des rôles à un utilisateur',
    description: 'Remplace ou assigne la liste des rôles pour cet utilisateur.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de l’utilisateur' })
  @ApiResponse({ status: 200, description: 'Rôles assignés' })
  async assignRoles(
    @Param('id') id: string,
    @Body() dto: AssignRolesDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.assignRoles(id, req.user.tenantId, dto);
  }

  @Delete(':id/roles/:roleId')
  @Permissions('manage:users')
  @ApiOperation({
    summary: 'Retirer un rôle spécifique d’un utilisateur',
    description: 'Désassigne un rôle sans modifier les autres attributions.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de l’utilisateur' })
  @ApiParam({ name: 'roleId', description: 'Identifiant UUID du rôle' })
  @ApiResponse({ status: 200, description: 'Rôle retiré avec succès' })
  async removeRole(
    @Param('id') id: string,
    @Param('roleId') roleId: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.removeRole(id, roleId, req.user.tenantId);
  }

  @Get(':id/permissions')
  @Permissions('manage:users')
  @ApiOperation({
    summary: 'Lister les permissions effectives d’un utilisateur',
    description: 'Calcule l’ensemble des permissions résultant des rôles attribués à l’utilisateur.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de l’utilisateur' })
  @ApiResponse({ status: 200, description: 'Liste des codes de permission effectifs' })
  async permissions(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.usersService.permissions(id, req.user.tenantId);
  }
}
