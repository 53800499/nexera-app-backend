import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { promises as fs } from 'fs';
import * as path from 'path';
import { DocumentAccessService } from './services/document-access.service';
import { EmailTrackingService } from './services/email-tracking.service';

const TRACKING_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

function resolvePdfPath(
  documentType: string,
  tenantId: string,
  documentId: string,
): string {
  const folder =
    documentType === 'quotation' ? 'quotations' : 'invoices';
  return path.join(
    process.cwd(),
    'storage',
    folder,
    tenantId,
    `${documentId}.pdf`,
  );
}

@ApiTags('public')
@Controller('public')
export class PublicDocumentsController {
  constructor(
    private readonly documentAccess: DocumentAccessService,
    private readonly emailTracking: EmailTrackingService,
  ) {}

  @Get('documents/:token')
  @ApiOperation({ summary: 'Téléchargement sécurisé PDF (lien tokenisé)' })
  async downloadDocument(
    @Param('token') token: string,
    @Res() res: Response,
  ) {
    const access = await this.documentAccess.resolveToken(token);
    const filePath = resolvePdfPath(
      access.documentType,
      access.tenantId,
      access.documentId,
    );

    let buffer: Buffer;
    try {
      buffer = await fs.readFile(filePath);
    } catch {
      throw new NotFoundException('Document PDF introuvable');
    }

    const prefix = access.documentType === 'quotation' ? 'devis' : 'facture';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${prefix}-${access.documentId}.pdf"`,
    );
    res.send(buffer);
  }

  @Get('track/:trackingId')
  @Header('Content-Type', 'image/gif')
  @ApiOperation({ summary: 'Pixel de suivi ouverture email (optionnel)' })
  async trackOpen(@Param('trackingId') trackingId: string, @Res() res: Response) {
    await this.emailTracking.recordOpen(trackingId);
    res.send(TRACKING_GIF);
  }
}
