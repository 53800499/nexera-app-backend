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
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('tenants')
@ApiBearerAuth('access-token')
@Controller('tenants')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenantsController {
  constructor(private tenantsService: TenantsService) {}

  @Post()
  @Permissions('manage:tenants')
  @ApiOperation({
    summary: 'Créer une nouvelle organisation (Tenant)',
    description: 'Enregistre une nouvelle entreprise dans le système multi-tenant.',
  })
  @ApiResponse({ status: 201, description: 'Organisation créée' })
  async create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  @Permissions('manage:tenants')
  @ApiOperation({
    summary: 'Lister les organisations',
    description: 'Retourne la liste des organisations enregistrées.',
  })
  @ApiResponse({ status: 200, description: 'Liste des organisations' })
  async findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @Permissions('manage:tenants')
  @ApiOperation({
    summary: 'Détail d’une organisation',
    description: 'Retourne les informations d’une entreprise spécifique.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de l’organisation' })
  @ApiResponse({ status: 200, description: 'Détail de l’organisation' })
  @ApiResponse({ status: 404, description: 'Organisation introuvable' })
  async findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @Permissions('manage:tenants')
  @ApiOperation({
    summary: 'Mettre à jour une organisation',
    description: 'Modifie les informations de l’organisation (nom, domaine, etc.).',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de l’organisation' })
  @ApiResponse({ status: 200, description: 'Organisation mise à jour' })
  async update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('manage:tenants')
  @ApiOperation({
    summary: 'Supprimer une organisation',
    description: 'Supprime un tenant du système.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant UUID de l’organisation' })
  @ApiResponse({ status: 200, description: 'Organisation supprimée' })
  async remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }
}
