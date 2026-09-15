import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { TvaService } from './tva.service';
import { CreateDeclarationTvaDto, CreateLigneTvaDto } from '../dto/fiscalite.dto';

@ApiTags('fiscalite-tva')
@ApiBearerAuth('access-token')
@Controller('fiscalite/tva')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TvaController {
  constructor(private readonly tvaService: TvaService) {}

  @Get('declarations')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Lister les déclarations mensuelles de TVA' })
  @ApiQuery({ name: 'taxContribuableId', required: true })
  async getDeclarations(@Query('taxContribuableId') taxContribuableId: string) {
    return this.tvaService.getDeclarations(taxContribuableId);
  }

  @Get('declarations/:id')
  @Permissions('fiscalite.read')
  @ApiOperation({ summary: 'Consulter le détail d’une déclaration de TVA et ses lignes' })
  async getDeclarationById(@Param('id') id: string) {
    return this.tvaService.getDeclarationById(id);
  }

  @Post('declarations')
  @Permissions('fiscalite.tva.manage')
  @ApiOperation({ summary: 'Créer et pré-remplir une déclaration de TVA pour une période (EF-020)' })
  async createDeclaration(@Body() dto: CreateDeclarationTvaDto) {
    return this.tvaService.createDeclaration(dto);
  }

  @Post('declarations/:id/lignes')
  @Permissions('fiscalite.tva.manage')
  @ApiOperation({ summary: 'Ajouter une ligne de détail à une déclaration de TVA' })
  async addLigne(
    @Param('id') id: string,
    @Body() dto: CreateLigneTvaDto,
  ) {
    return this.tvaService.addLigneManuelle(id, dto);
  }

  @Put('declarations/:id/valider')
  @Permissions('fiscalite.tva.manage')
  @ApiOperation({ summary: 'Valider la déclaration de TVA' })
  async validerDeclaration(@Param('id') id: string) {
    return this.tvaService.validerDeclaration(id);
  }

  @Put('declarations/:id/payer')
  @Permissions('fiscalite.tva.manage')
  @ApiOperation({ summary: 'Enregistrer le paiement de la TVA due' })
  async marquerPayee(@Param('id') id: string) {
    return this.tvaService.marquerPayee(id);
  }
}
