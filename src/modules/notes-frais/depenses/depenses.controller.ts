import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { DepensesService } from './depenses.service';
import { CreateDepenseDto, UpdateDepenseDto } from '../dto/depenses.dto';

@ApiTags('notes-frais-depenses')
@ApiBearerAuth('access-token')
@Controller('notes-frais/depenses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DepensesController {
  constructor(private readonly depensesService: DepensesService) {}

  @Get()
  @Permissions('ndf.read')
  @ApiOperation({ summary: 'Lister les dépenses individuelles avec filtres' })
  @ApiQuery({ name: 'ndfRapportFraisId', required: false })
  @ApiQuery({ name: 'categorieDepenseId', required: false })
  @ApiQuery({ name: 'statut', required: false })
  async getDepenses(
    @Request() req: any,
    @Query('ndfRapportFraisId') ndfRapportFraisId?: string,
    @Query('categorieDepenseId') categorieDepenseId?: string,
    @Query('statut') statut?: any,
  ) {
    return this.depensesService.getDepenses(req.user.tenantId, {
      ndfRapportFraisId,
      categorieDepenseId,
      statut,
    });
  }

  @Get(':id')
  @Permissions('ndf.read')
  @ApiOperation({ summary: 'Consulter le détail d’une dépense' })
  @ApiParam({ name: 'id', description: 'ID de la dépense' })
  async getDepenseById(@Request() req: any, @Param('id') id: string) {
    return this.depensesService.getDepenseById(req.user.tenantId, id);
  }

  @Post()
  @Permissions('ndf.expenses.submit')
  @ApiOperation({ summary: 'Saisir une nouvelle dépense' })
  async createDepense(@Request() req: any, @Body() dto: CreateDepenseDto) {
    return this.depensesService.createDepense(req.user.tenantId, dto);
  }

  @Patch(':id')
  @Permissions('ndf.expenses.submit')
  @ApiOperation({ summary: 'Mettre à jour une dépense' })
  @ApiParam({ name: 'id', description: 'ID de la dépense' })
  async updateDepense(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateDepenseDto,
  ) {
    return this.depensesService.updateDepense(req.user.tenantId, id, dto);
  }

  @Delete(':id')
  @Permissions('ndf.expenses.submit')
  @ApiOperation({ summary: 'Supprimer une ligne de dépense' })
  @ApiParam({ name: 'id', description: 'ID de la dépense' })
  async deleteDepense(@Request() req: any, @Param('id') id: string) {
    return this.depensesService.deleteDepense(req.user.tenantId, id);
  }
}
