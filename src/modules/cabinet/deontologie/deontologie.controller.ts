import {
  Body,
  Controller,
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
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { CabinetTenantGuard } from '../../../common/guards/cabinet-tenant.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { DeontologieService } from './deontologie.service';
import {
  ArbitrerCabinetConflitInteretDto,
  CreateCabinetConflitInteretDto,
  LogCabinetAccesSecretProDto,
} from '../dto/deontologie.dto';

@ApiTags('cabinet-deontologie')
@ApiBearerAuth('access-token')
@Controller('cabinet/deontologie')
@UseGuards(JwtAuthGuard, PermissionsGuard, CabinetTenantGuard)
export class DeontologieController {
  constructor(private readonly deontologieService: DeontologieService) {}

  @Get('conflits')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Lister les déclarations de conflits d’intérêt' })
  listConflits(@Request() req: { user: { tenantId: string } }) {
    return this.deontologieService.listConflitsInteret(req.user.tenantId);
  }

  @Post('conflits')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Déclarer un conflit d’intérêt sur un dossier' })
  declareConflit(
    @Request() req: { user: { tenantId: string; id?: string } },
    @Body() dto: CreateCabinetConflitInteretDto,
  ) {
    return this.deontologieService.declareConflitInteret(
      req.user.tenantId,
      req.user.id || null,
      dto,
    );
  }

  @Patch('conflits/:id/arbitrer')
  @Permissions('manage:settings', 'cabinet.read')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOperation({ summary: 'Arbitrer une déclaration de conflit d’intérêt (Associé)' })
  arbitrerConflit(
    @Request() req: { user: { tenantId: string; id?: string } },
    @Param('id') id: string,
    @Body() dto: ArbitrerCabinetConflitInteretDto,
  ) {
    return this.deontologieService.arbitrerConflitInteret(
      req.user.tenantId,
      id,
      req.user.id || null,
      dto,
    );
  }

  @Get('journal-acces')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Consulter le journal d’accès renforcé (Secret professionnel)' })
  @ApiQuery({ name: 'mandatId', required: false })
  listJournal(
    @Request() req: { user: { tenantId: string } },
    @Query('mandatId') mandatId?: string,
  ) {
    return this.deontologieService.listJournalAcces(
      req.user.tenantId,
      mandatId,
    );
  }

  @Post('journal-acces')
  @Permissions('cabinet.read')
  @ApiOperation({ summary: 'Enregistrer une trace d’accès à un dossier client' })
  logAcces(
    @Request() req: { user: { tenantId: string; id?: string } },
    @Body() dto: LogCabinetAccesSecretProDto,
  ) {
    return this.deontologieService.logAccesSecretPro(
      req.user.tenantId,
      req.user.id || null,
      dto,
    );
  }
}
