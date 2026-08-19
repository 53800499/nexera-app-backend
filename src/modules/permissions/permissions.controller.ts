import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('permissions')
@ApiBearerAuth('access-token')
@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PermissionsController {
  constructor(private permissionsService: PermissionsService) {}

  @Post()
  @Roles('admin')
  @Permissions('manage:permissions')
  @ApiOperation({
    summary: 'Créer une nouvelle permission système',
    description: 'Enregistre une nouvelle clé de permission (réservé aux administrateurs).',
  })
  @ApiResponse({ status: 201, description: 'Permission créée' })
  async create(@Body() dto: CreatePermissionDto) {
    return this.permissionsService.create(dto);
  }

  @Get()
  @Permissions('manage:permissions')
  @ApiOperation({
    summary: 'Lister toutes les permissions disponibles',
    description: 'Retourne le catalogue complet des permissions utilisables dans la configuration des rôles.',
  })
  @ApiResponse({ status: 200, description: 'Liste des permissions' })
  async findAll() {
    return this.permissionsService.findAll();
  }

  @Get(':id')
  @Permissions('manage:permissions')
  @ApiOperation({
    summary: 'Détail d’une permission',
    description: 'Retourne les informations d’une permission spécifique.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de la permission' })
  @ApiResponse({ status: 200, description: 'Détail de la permission' })
  @ApiResponse({ status: 404, description: 'Permission introuvable' })
  async findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  @Permissions('manage:permissions')
  @ApiOperation({
    summary: 'Mettre à jour une permission',
    description: 'Modifie la description ou le libellé d’une permission.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de la permission' })
  @ApiResponse({ status: 200, description: 'Permission mise à jour' })
  async update(@Param('id') id: string, @Body() dto: UpdatePermissionDto) {
    return this.permissionsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @Permissions('manage:permissions')
  @ApiOperation({
    summary: 'Supprimer une permission',
    description: 'Supprime une clé de permission du référentiel système.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de la permission' })
  @ApiResponse({ status: 200, description: 'Permission supprimée' })
  async remove(@Param('id') id: string) {
    return this.permissionsService.remove(id);
  }
}
