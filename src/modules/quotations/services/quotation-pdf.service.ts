import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { promises as fs } from 'fs';
import * as path from 'path';

type QuotationForPdf = {
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
  client: { companyName: string; code: string };
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

  getPublicUrl(quotationId: string) {
    return `/quotations/${quotationId}/pdf`;
  }

  getStoragePath(tenantId: string, quotationId: string) {
    return path.join(this.storageRoot, tenantId, `${quotationId}.pdf`);
  }

  async generate(quotation: QuotationForPdf): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text(`Devis ${quotation.number}`, { align: 'center' });
      doc.moveDown(0.5);
      doc
        .fontSize(10)
        .text(
          `Date : ${quotation.issueDate.toLocaleDateString('fr-FR')}` +
            (quotation.expiryDate
              ? `  |  Validité : ${quotation.expiryDate.toLocaleDateString('fr-FR')}`
              : ''),
        );

      doc.moveDown();
      doc.fontSize(12).text('Client', { underline: true });
      doc.fontSize(10).text(`${quotation.client.companyName} (${quotation.client.code})`);

      if (quotation.contact) {
        doc.text(
          `Contact : ${quotation.contact.firstName} ${quotation.contact.lastName}`,
        );
      }

      doc.moveDown();
      doc.fontSize(11).text('Lignes', { underline: true });
      doc.moveDown(0.3);

      for (const line of quotation.lines) {
        const taxLabel = line.taxRate
          ? `${line.taxRate.name} (${line.taxRate.rate}%)`
          : 'TVA';
        doc
          .fontSize(9)
          .text(
            `${line.position}. ${line.description}`,
          );
        doc.text(
          `   Qté ${line.quantity} × ${line.unitPriceHt.toFixed(2)} ${quotation.currency} HT` +
            `  |  HT ${line.lineTotalHt.toFixed(2)}  |  ${taxLabel} ${line.taxAmount.toFixed(2)}` +
            `  |  TTC ${line.lineTotalTtc.toFixed(2)}`,
        );
      }

      doc.moveDown();
      doc.fontSize(11).text('Totaux', { underline: true });
      doc.fontSize(10);
      doc.text(`Sous-total HT : ${quotation.subtotalHt.toFixed(2)} ${quotation.currency}`);
      if (quotation.discountAmount > 0 || quotation.discountPct > 0) {
        doc.text(
          `Remise globale : ${quotation.discountAmount.toFixed(2)} ${quotation.currency}` +
            (quotation.discountPct > 0 ? ` (${quotation.discountPct} %)` : ''),
        );
      }
      doc.text(`Base HT : ${quotation.baseHt.toFixed(2)} ${quotation.currency}`);
      doc.text(`TVA : ${quotation.totalTax.toFixed(2)} ${quotation.currency}`);
      doc.fontSize(12).text(
        `Total TTC : ${quotation.totalTtc.toFixed(2)} ${quotation.currency}`,
        { underline: true },
      );

      if (quotation.notes) {
        doc.moveDown();
        doc.fontSize(10).text('Notes / conditions', { underline: true });
        doc.text(quotation.notes);
      }

      doc.end();
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
