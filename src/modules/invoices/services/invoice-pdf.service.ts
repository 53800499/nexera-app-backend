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
import { InvoiceType } from '../enums/invoice-type.enum';

@Injectable()
export class InvoicePdfService {
  private readonly storageRoot = path.join(
    process.cwd(),
    'storage',
    'invoices',
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  getPublicUrl(invoiceId: string) {
    return `/invoices/${invoiceId}/pdf`;
  }

  getStoragePath(tenantId: string, invoiceId: string) {
    return path.join(this.storageRoot, tenantId, `${invoiceId}.pdf`);
  }

  async generateForInvoice(tenantId: string, invoiceId: string): Promise<Buffer> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        client: true,
        contact: true,
        paymentTerm: true,
        lines: {
          orderBy: { position: 'asc' },
          include: { taxRate: true },
        },
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const [tenant, settings, pdfTemplate, latePaymentMention] =
      await Promise.all([
        this.prisma.tenant.findUnique({ where: { id: tenantId } }),
        this.settingsService.getTenantSettings(tenantId),
        this.settingsService.getPdfTemplate(tenantId),
        this.settingsService.getLatePaymentMention(tenantId),
      ]);

    const issueDate =
      invoice.status === 'draft'
        ? invoice.issueDate
        : invoice.cancelledAt ?? invoice.sentAt ?? invoice.issueDate;

    const lines = invoice.lines.map((line) => ({
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

    const taxBreakdown = buildTaxBreakdown(lines, invoice.baseHt);

    const documentLabel =
      invoice.invoiceType === InvoiceType.CREDIT_NOTE
        ? 'Avoir'
        : invoice.invoiceType === InvoiceType.PROFORMA
          ? 'Facture proforma'
          : 'Facture';

    const companyAddress = settings.companyAddress as PdfAddress | null;

    const contactName = invoice.contact
      ? `${invoice.contact.firstName} ${invoice.contact.lastName}`.trim()
      : null;

    return generateDocumentPdf({
      documentType:
        invoice.invoiceType === InvoiceType.CREDIT_NOTE
          ? 'credit_note'
          : 'invoice',
      documentLabel,
      number: invoice.number,
      issueDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      statusLabel:
        invoice.status === 'draft'
          ? 'Brouillon'
          : invoice.invoiceType === InvoiceType.PROFORMA
            ? 'Proforma'
            : null,
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
        companyName: invoice.client.companyName,
        tradeName: invoice.client.tradeName,
        contactName,
        siret: invoice.client.siret,
        taxId: invoice.client.taxId,
        billingAddress: invoice.client.billingAddress as PdfAddress | null,
      },
      lines,
      subtotalHt: invoice.subtotalHt,
      discountPct: invoice.discountPct,
      discountAmount: invoice.discountAmount,
      baseHt: invoice.baseHt,
      taxBreakdown,
      totalTax: invoice.totalTax,
      totalTtc: invoice.totalTtc,
      paymentTerms: invoice.paymentTerm?.name ?? null,
      acceptedPaymentMethods: settings.acceptedPaymentMethods,
      latePaymentMention,
      notes: invoice.notes,
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

  async save(tenantId: string, invoiceId: string, buffer: Buffer) {
    const filePath = this.getStoragePath(tenantId, invoiceId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return filePath;
  }

  async read(tenantId: string, invoiceId: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.getStoragePath(tenantId, invoiceId));
    } catch {
      return null;
    }
  }

  async removeCached(tenantId: string, invoiceId: string) {
    try {
      await fs.unlink(this.getStoragePath(tenantId, invoiceId));
    } catch {
      // fichier absent — rien à invalider
    }
  }

  async ensureGenerated(tenantId: string, invoiceId: string) {
    const existing = await this.read(tenantId, invoiceId);
    if (existing) return existing;
    const buffer = await this.generateForInvoice(tenantId, invoiceId);
    await this.save(tenantId, invoiceId, buffer);
    return buffer;
  }
}
