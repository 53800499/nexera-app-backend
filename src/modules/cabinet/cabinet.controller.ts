import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CabinetService } from './cabinet.service';
import { parsePagination } from '../../shared/utils/pagination.util';

class GrantCabinetAccessDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  cabinetTenantId!: string;
}

@ApiTags('cabinet')
@ApiBearerAuth('access-token')
@Controller('cabinet')
export class CabinetController {
  constructor(private readonly cabinetService: CabinetService) {}

  @Get('companies')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Espace cabinet — entreprises liées' })
  listCompanies(@Request() req: { user: { tenantId: string } }) {
    return this.cabinetService.listLinkedCompanies(req.user.tenantId);
  }

  @Get('companies/:companyTenantId/invoices')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: "Factures d'une entreprise cliente (lecture)" })
  listInvoices(
    @Request() req: { user: { tenantId: string } },
    @Param('companyTenantId') companyTenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pagination = parsePagination(page, limit);
    return this.cabinetService.listCompanyInvoices(
      req.user.tenantId,
      companyTenantId,
      pagination.page,
      pagination.limit,
    );
  }

  @Post('access')
  @Permissions('manage:settings')
  @ApiOperation({ summary: "Autoriser un cabinet à consulter l'entreprise" })
  grantAccess(
    @Request() req: { user: { tenantId: string } },
    @Body() dto: GrantCabinetAccessDto,
  ) {
    return this.cabinetService.grantAccess(
      dto.cabinetTenantId,
      req.user.tenantId,
      req.user.tenantId,
    );
  }
}
