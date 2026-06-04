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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CatalogueService } from './catalogue.service';
import { CreateCatalogCategoryDto } from './dto/create-catalog-category.dto';
import { UpdateCatalogCategoryDto } from './dto/update-catalog-category.dto';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { CreateCatalogPriceDto } from './dto/create-catalog-price.dto';

@ApiTags('catalogue')
@ApiBearerAuth('access-token')
@Controller('catalogue')
@UseGuards(JwtAuthGuard)
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Post('categories')
  @ApiOperation({ summary: 'Créer une catégorie catalogue' })
  createCategory(
    @Body() dto: CreateCatalogCategoryDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.catalogueService.createCategory(dto, req.user.tenantId);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Lister les catégories' })
  findAllCategories(@Request() req: { user: { tenantId: string } }) {
    return this.catalogueService.findAllCategories(req.user.tenantId);
  }

  @Get('categories/:id')
  @ApiOperation({ summary: 'Détail catégorie' })
  findOneCategory(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.catalogueService.findOneCategory(id, req.user.tenantId);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Modifier une catégorie' })
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogCategoryDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.catalogueService.updateCategory(id, req.user.tenantId, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Supprimer une catégorie' })
  removeCategory(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.catalogueService.removeCategory(id, req.user.tenantId);
  }

  @Post('items')
  @ApiOperation({
    summary: 'Créer un article / service',
    description:
      'UC-02 — référence ART-XXXXXX auto (RM-A01), prix HT >= 0 (RM-A02), TVA obligatoire (RM-A03).',
  })
  createItem(
    @Body() dto: CreateCatalogItemDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.catalogueService.createItem(dto, req.user.tenantId);
  }

  @Get('items')
  @ApiOperation({ summary: 'Lister les articles' })
  @ApiQuery({ name: 'q', required: false })
  findAllItems(
    @Request() req: { user: { tenantId: string } },
    @Query('q') q?: string,
  ) {
    return this.catalogueService.findAllItems(req.user.tenantId, q);
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Détail article avec tarifs' })
  findOneItem(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.catalogueService.findOneItem(id, req.user.tenantId);
  }

  @Patch('items/:id')
  @ApiOperation({ summary: 'Modifier un article' })
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.catalogueService.updateItem(id, req.user.tenantId, dto);
  }

  @Delete('items/:id')
  @ApiOperation({
    summary: 'Archiver un article',
    description:
      'RM-A04 — archivage si utilisé en transaction ; suppression physique sinon interdite si lié.',
  })
  removeItem(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.catalogueService.removeItem(id, req.user.tenantId);
  }

  @Post('items/:id/prices')
  @ApiOperation({
    summary: 'Ajouter un tarif (client ou groupe)',
    description: 'RM-A05 — tarifs multiples par client ou groupe.',
  })
  createPrice(
    @Param('id') id: string,
    @Body() dto: CreateCatalogPriceDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.catalogueService.createPrice(id, req.user.tenantId, dto);
  }

  @Get('items/:id/prices')
  @ApiOperation({ summary: 'Lister les tarifs d’un article' })
  findPrices(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.catalogueService.findPrices(id, req.user.tenantId);
  }
}
