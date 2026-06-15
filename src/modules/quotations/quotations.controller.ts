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
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { QuotationsService } from './quotations.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { SendQuotationDto } from './dto/send-quotation.dto';
import { ConvertQuotationDto } from './dto/convert-quotation.dto';
import { ChangeQuotationStatusDto } from './dto/change-quotation-status.dto';
import { QuotationStatus } from './enums/quotation-status.enum';
import { parsePagination } from '../../shared/utils/pagination.util';

@ApiTags('quotations')
@ApiBearerAuth('access-token')
@Controller('quotations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post()
  @Permissions('manage:quotations')
  @ApiOperation({
    summary: 'Créer un devis',
    description: 'UC-03 — numérotation DEV-AAAA-XXXXXX, calcul TVA/remises automatique.',
  })
  create(
    @Body() dto: CreateQuotationDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.quotationsService.create(dto, req.user.tenantId, req.user.sub);
  }

  @Get()
  @Permissions('quotations.read')
  @ApiOperation({ summary: 'Lister les devis' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  findAll(
    @Request() req: { user: { tenantId: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: QuotationStatus,
    @Query('clientId') clientId?: string,
    @Query('q') q?: string,
  ) {
    const pagination = parsePagination(page, limit);
    return this.quotationsService.findAll(
      req.user.tenantId,
      pagination.page,
      pagination.limit,
      status,
      clientId,
      q,
    );
  }

  @Get(':id/pdf')
  @Permissions('quotations.read')
  @ApiOperation({ summary: 'Télécharger / prévisualiser le PDF du devis' })
  async downloadPdf(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.quotationsService.getPdf(
      id,
      req.user.tenantId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Get(':id/preview')
  @Permissions('quotations.read')
  preview(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.quotationsService.preview(id, req.user.tenantId);
  }

  @Get(':id')
  @Permissions('quotations.read')
  findOne(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.quotationsService.findOne(id, req.user.tenantId);
  }

  @Patch(':id')
  @Permissions('manage:quotations')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.quotationsService.update(id, req.user.tenantId, dto);
  }

  @Delete(':id')
  @Permissions('manage:quotations')
  remove(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.quotationsService.remove(id, req.user.tenantId);
  }

  @Post(':id/send')
  @Permissions('manage:quotations')
  @ApiOperation({
    summary: 'Envoyer le devis',
    description: 'Génère le PDF, passe au statut sent, envoi email si SMTP configuré.',
  })
  send(
    @Param('id') id: string,
    @Body() dto: SendQuotationDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.quotationsService.send(id, req.user.tenantId, dto);
  }

  @Patch(':id/status')
  @Permissions('manage:quotations')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeQuotationStatusDto,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.quotationsService.changeStatus(id, req.user.tenantId, dto);
  }

  @Post(':id/convert')
  @Permissions('manage:quotations')
  convert(
    @Param('id') id: string,
    @Body() dto: ConvertQuotationDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.quotationsService.convert(
      id,
      req.user.tenantId,
      dto,
      req.user.sub,
    );
  }
}
