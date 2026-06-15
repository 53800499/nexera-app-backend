import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import {
  buildTaxBreakdown,
  generateDocumentPdf,
} from '../../../shared/pdf/document-pdf.builder';
import { PdfAddress } from '../../../shared/pdf/document-pdf.types';

type QuotationForPdf = {
  id: string;
  tenantId: string;
  number: string;
  issueDate: Date;
  expiryDate: Date | null;
  currency: string;
  subtotalHt: number;
  discountPct: number;
  discountAmount: number;
  baseHt: number;
  totalTax: number;
  totalTtc: number;
  notes: string | null;
  client: {
    companyName: string;
    tradeName?: string | null;
    siret?: string | null;
    taxId?: string | null;
    billingAddress?: unknown;
    code: string;
  };
  contact?: { firstName: string; lastName: string; email?: string | null } | null;
  lines: Array<{
    position: number;
    description: string;
    quantity: number;
    unitPriceHt: number;
    lineTotalHt: number;
    taxAmount: number;
    lineTotalTtc: number;
    taxRate?: { name: string; rate: number };
  }>;
};

@Injectable()
export class QuotationPdfService {
  private readonly storageRoot = path.join(
    process.cwd(),
    'storage',
    'quotations',
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  getPublicUrl(quotationId: string) {
    return `/quotations/${quotationId}/pdf`;
  }

  getStoragePath(tenantId: string, quotationId: string) {
    return path.join(this.storageRoot, tenantId, `${quotationId}.pdf`);
  }

  async generate(quotation: QuotationForPdf): Promise<Buffer> {
    const [tenant, settings, pdfTemplate] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: quotation.tenantId } }),
      this.settingsService.getTenantSettings(quotation.tenantId),
      this.settingsService.getPdfTemplate(quotation.tenantId),
    ]);

    const lines = quotation.lines.map((line) => ({
      position: line.position,
      description: line.description,
      quantity: line.quantity,
      unitPriceHt: line.unitPriceHt,
      lineTotalHt: line.lineTotalHt,
      taxRate: line.taxRate?.rate ?? 0,
      taxRateName: line.taxRate?.name,
      taxAmount: line.taxAmount,
      lineTotalTtc: line.lineTotalTtc,
    }));

    const taxBreakdown = buildTaxBreakdown(lines, quotation.baseHt);
    const companyAddress = settings.companyAddress as PdfAddress | null;

    return generateDocumentPdf({
      documentType: 'quotation',
      documentLabel: 'Devis',
      number: quotation.number,
      issueDate: quotation.issueDate,
      dueDate: quotation.expiryDate,
      currency: quotation.currency,
      seller: {
        name: tenant?.name ?? 'Entreprise',
        legalName: settings.legalName,
        tradeName: settings.tradeName,
        siret: settings.siret,
        vatNumber: settings.vatNumber,
        registrationNumber: settings.registrationNumber,
        shareCapital: settings.shareCapital,
        address: companyAddress,
        phone: settings.companyPhone,
        email: settings.companyEmail,
        website: settings.companyWebsite,
      },
      buyer: {
        companyName: quotation.client.companyName,
        tradeName: quotation.client.tradeName,
        siret: quotation.client.siret,
        taxId: quotation.client.taxId,
        billingAddress: quotation.client.billingAddress as PdfAddress | null,
      },
      lines,
      subtotalHt: quotation.subtotalHt,
      discountPct: quotation.discountPct,
      discountAmount: quotation.discountAmount,
      baseHt: quotation.baseHt,
      taxBreakdown,
      totalTax: quotation.totalTax,
      totalTtc: quotation.totalTtc,
      acceptedPaymentMethods: settings.acceptedPaymentMethods,
      notes: quotation.notes,
      template: {
        logoUrl: pdfTemplate.logoUrl,
        primaryColor: pdfTemplate.primaryColor,
        secondaryColor: pdfTemplate.secondaryColor,
        fontFamily: pdfTemplate.fontFamily,
        layoutType: pdfTemplate.layoutType,
        showPageNumbers: pdfTemplate.showPageNumbers,
        headerText: pdfTemplate.headerText,
        footerText: pdfTemplate.footerText,
        legalMentions: pdfTemplate.legalMentions,
        termsAndConditions: pdfTemplate.termsAndConditions ?? settings.cgvText,
      },
    });
  }

  async save(tenantId: string, quotationId: string, buffer: Buffer) {
    const filePath = this.getStoragePath(tenantId, quotationId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  async read(tenantId: string, quotationId: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.getStoragePath(tenantId, quotationId));
    } catch {
      return null;
    }
  }
}
