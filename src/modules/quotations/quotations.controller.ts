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

@Controller('quotations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post()
  @Permissions('manage:quotations')
  create(
    @Body() dto: CreateQuotationDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.quotationsService.create(dto, req.user.tenantId, req.user.sub);
  }

  @Get()
  findAll(
    @Request() req: { user: { tenantId: string } },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: QuotationStatus,
    @Query('clientId') clientId?: string,
    @Query('q') q?: string,
  ) {
    return this.quotationsService.findAll(
      req.user.tenantId,
      Number(page),
      Number(limit),
      status,
      clientId,
      q,
    );
  }

  @Get(':id/pdf')
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
  preview(
    @Param('id') id: string,
    @Request() req: { user: { tenantId: string } },
  ) {
    return this.quotationsService.preview(id, req.user.tenantId);
  }

  @Get(':id')
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
