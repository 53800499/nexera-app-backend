import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Request as ExpressRequest, Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { SyncPullQueryDto, SyncPushDto } from './dto/sync.dto';
import { SYNC_MANIFEST } from './sync.manifest';
import { SyncService } from './sync.service';
import { sendSyncPayload } from './utils/sync-response.util';

@ApiTags('sync')
@ApiBearerAuth('access-token')
@Controller('sync')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('manifest')
  @Permissions('sync.read')
  @ApiOperation({
    summary: 'Manifest PWA offline',
    description:
      'Contrat sync v2 : entités pull/push, compression gzip, tag Background Sync.',
  })
  manifest() {
    return SYNC_MANIFEST;
  }

  @Get('bootstrap')
  @Permissions('sync.read')
  @ApiOperation({
    summary: 'Pack initial offline',
    description:
      'Référentiel (TVA, conditions) + clients, catalogue, devis, BC, factures et paiements.',
  })
  @ApiQuery({ name: 'compress', required: false, type: Boolean })
  @ApiHeader({ name: 'Accept-Encoding', required: false })
  @ApiProduces('application/json')
  @ApiOkResponse({ description: 'JSON ou gzip (Content-Encoding: gzip)' })
  async bootstrap(
    @Request() req: { user: { tenantId: string } },
    @Query() query: SyncPullQueryDto,
    @Req() httpReq: ExpressRequest,
    @Res() res: Response,
  ) {
    const payload = await this.syncService.bootstrap(req.user.tenantId);
    sendSyncPayload(res, payload, {
      compress: query.compress,
      acceptEncoding: httpReq.headers['accept-encoding'],
    });
  }

  @Get('pull')
  @Permissions('sync.read')
  @ApiOperation({
    summary: 'Synchronisation incrémentale (pull)',
    description:
      'Delta depuis curseur opaque. `compress=true` ou `Accept-Encoding: gzip` pour payload compressé.',
  })
  @ApiQuery({ name: 'deviceId', required: false })
  @ApiQuery({ name: 'compress', required: false, type: Boolean })
  async pull(
    @Request() req: { user: { sub: string; tenantId: string } },
    @Query() query: SyncPullQueryDto,
    @Req() httpReq: ExpressRequest,
    @Res() res: Response,
  ) {
    const payload = await this.syncService.pull(
      req.user.tenantId,
      req.user.sub,
      query.deviceId,
      query.cursor,
      query.limit,
    );
    sendSyncPayload(res, payload, {
      compress: query.compress,
      acceptEncoding: httpReq.headers['accept-encoding'],
    });
  }

  @Post('push')
  @Permissions('sync.push')
  @ApiOperation({
    summary: 'Envoi des mutations offline (push)',
    description:
      'Lot idempotent. Opérations : create/update/delete/confirm/issue/record_payment.',
  })
  push(
    @Body() dto: SyncPushDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.syncService.push(req.user.tenantId, req.user.sub, dto);
  }

  @Post('push/background')
  @Permissions('sync.push')
  @ApiOperation({
    summary: 'Push Background Sync (PWA)',
    description:
      'Même contrat que POST /sync/push — à appeler depuis le Service Worker (tag nexera-sync-push).',
  })
  @ApiHeader({
    name: 'X-Sync-Background',
    required: false,
    description: 'Positionné à 1 par le Service Worker Nexera',
  })
  backgroundPush(
    @Body() dto: SyncPushDto,
    @Request() req: { user: { sub: string; tenantId: string } },
  ) {
    return this.syncService.push(req.user.tenantId, req.user.sub, dto);
  }
}
