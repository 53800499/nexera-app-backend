import { Controller, Get, Param, Query, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { parsePagination } from '../../shared/utils/pagination.util';
import { AuditService } from './audit.service';
import { AuditEntityType } from './enums/audit.enum';

@ApiTags('audit')
@ApiBearerAuth('access-token')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get(':entityType/:entityId')
  @Permissions('settings.read')
  @ApiOperation({ summary: 'Historique d\'audit pour une entité' })
  @ApiParam({ name: 'entityType', enum: AuditEntityType })
  @ApiParam({ name: 'entityId', format: 'uuid' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findByEntity(
    @Param('entityType') entityType: AuditEntityType,
    @Param('entityId') entityId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Request() req?: { user: { tenantId: string } },
  ) {
    const pagination = parsePagination(page, limit);
    return this.auditService.findByEntity(
      req!.user.tenantId,
      entityType,
      entityId,
      pagination.page,
      pagination.limit,
    );
  }
}
