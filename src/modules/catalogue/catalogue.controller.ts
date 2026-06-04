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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CatalogueService } from './catalogue.service';
import { CreateCatalogCategoryDto } from './dto/create-catalog-category.dto';
import { UpdateCatalogCategoryDto } from './dto/update-catalog-category.dto';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { UpdateCatalogItemDto } from './dto/update-catalog-item.dto';
import { CreateCatalogPriceDto } from './dto/create-catalog-price.dto';

@Controller('catalogue')
@UseGuards(JwtAuthGuard)
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Post('categories')
  createCategory(@Body() dto: CreateCatalogCategoryDto, @Request() req: any) {
    return this.catalogueService.createCategory(dto, req.user.tenantId);
  }

  @Get('categories')
  findAllCategories(@Request() req: any) {
    return this.catalogueService.findAllCategories(req.user.tenantId);
  }

  @Get('categories/:id')
  findOneCategory(@Param('id') id: string, @Request() req: any) {
    return this.catalogueService.findOneCategory(id, req.user.tenantId);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogCategoryDto,
    @Request() req: any,
  ) {
    return this.catalogueService.updateCategory(id, req.user.tenantId, dto);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string, @Request() req: any) {
    return this.catalogueService.removeCategory(id, req.user.tenantId);
  }

  @Post('items')
  createItem(@Body() dto: CreateCatalogItemDto, @Request() req: any) {
    return this.catalogueService.createItem(dto, req.user.tenantId);
  }

  @Get('items')
  findAllItems(@Request() req: any, @Query('q') q?: string) {
    return this.catalogueService.findAllItems(req.user.tenantId, q);
  }

  @Get('items/:id')
  findOneItem(@Param('id') id: string, @Request() req: any) {
    return this.catalogueService.findOneItem(id, req.user.tenantId);
  }

  @Patch('items/:id')
  updateItem(
    @Param('id') id: string,
    @Body() dto: UpdateCatalogItemDto,
    @Request() req: any,
  ) {
    return this.catalogueService.updateItem(id, req.user.tenantId, dto);
  }

  @Delete('items/:id')
  removeItem(@Param('id') id: string, @Request() req: any) {
    return this.catalogueService.removeItem(id, req.user.tenantId);
  }

  @Post('items/:id/prices')
  createPrice(
    @Param('id') id: string,
    @Body() dto: CreateCatalogPriceDto,
    @Request() req: any,
  ) {
    return this.catalogueService.createPrice(id, req.user.tenantId, dto);
  }

  @Get('items/:id/prices')
  findPrices(@Param('id') id: string, @Request() req: any) {
    return this.catalogueService.findPrices(id, req.user.tenantId);
  }
}
