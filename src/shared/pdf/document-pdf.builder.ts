import PDFDocument from 'pdfkit';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PdfLayoutType } from '@prisma/client';
import { PdfDocumentInput } from './document-pdf.types';
import { resolvePdfFont } from './pdf-fonts';

function formatAddress(addr?: {
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
} | null): string {
  if (!addr) return '';
  return [
    addr.street,
    [addr.postalCode, addr.city].filter(Boolean).join(' '),
    addr.country,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR');
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

export function buildTaxBreakdown(
  lines: Array<{ lineTotalHt: number; taxRate: number; taxRateName?: string }>,
  baseHt: number,
): Array<{ rate: number; rateName?: string; baseHt: number; taxAmount: number }> {
  const byRate = new Map<number, { name?: string; ht: number }>();
  for (const line of lines) {
    const entry = byRate.get(line.taxRate) ?? { name: line.taxRateName, ht: 0 };
    entry.ht += line.lineTotalHt;
    if (line.taxRateName) entry.name = line.taxRateName;
    byRate.set(line.taxRate, entry);
  }

  const subtotal = lines.reduce((s, l) => s + l.lineTotalHt, 0);
  return [...byRate.entries()].map(([rate, group]) => {
    const share = subtotal > 0 ? group.ht / subtotal : 0;
    const groupBase = Math.round(baseHt * share * 100) / 100;
    const taxAmount = Math.round(groupBase * (rate / 100) * 100) / 100;
    return {
      rate,
      rateName: group.name,
      baseHt: groupBase,
      taxAmount,
    };
  });
}

export async function generateDocumentPdf(
  input: PdfDocumentInput,
): Promise<Buffer> {
  const font = resolvePdfFont(input.template.fontFamily);
  const boldFont = font.includes('Bold') ? font : `${font.split('-')[0]}-Bold`;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const chunks: Buffer[] = [];
    let pageNumber = 0;

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const drawPageNumber = () => {
      if (!input.template.showPageNumbers) return;
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .fillColor(input.template.secondaryColor)
          .text(
            `Page ${i - range.start + 1}/${range.count}`,
            50,
            doc.page.height - 40,
            { align: 'center', width: doc.page.width - 100 },
          );
      }
    };

    const drawHeader = async () => {
      pageNumber += 1;
      const primary = input.template.primaryColor;
      const secondary = input.template.secondaryColor;

      if (input.template.logoUrl) {
        try {
          const logoPath = input.template.logoUrl.startsWith('/')
            ? path.join(process.cwd(), input.template.logoUrl.replace(/^\//, ''))
            : input.template.logoUrl;
          if (await fs.stat(logoPath).then(() => true).catch(() => false)) {
            doc.image(logoPath, 50, 45, { width: 80 });
          }
        } catch {
          // logo optionnel
        }
      }

      const headerX = input.template.logoUrl ? 140 : 50;
      doc
        .font(boldFont)
        .fontSize(14)
        .fillColor(primary)
        .text(input.seller.legalName ?? input.seller.name, headerX, 50);

      doc.font(font).fontSize(8).fillColor(secondary);
      const sellerLines = [
        input.seller.tradeName,
        formatAddress(input.seller.address),
        input.seller.siret ? `SIRET : ${input.seller.siret}` : null,
        input.seller.vatNumber ? `N° TVA : ${input.seller.vatNumber}` : null,
        input.seller.registrationNumber
          ? `RCS : ${input.seller.registrationNumber}`
          : null,
        input.seller.shareCapital
          ? `Capital social : ${input.seller.shareCapital}`
          : null,
        [input.seller.phone, input.seller.email].filter(Boolean).join(' | '),
      ].filter(Boolean);

      doc.text(sellerLines.join('\n'), headerX, 68, { width: 250 });

      doc
        .font(boldFont)
        .fontSize(16)
        .fillColor(primary)
        .text(`${input.documentLabel} ${input.number}`, 320, 50, {
          align: 'right',
          width: 225,
        });

      doc.font(font).fontSize(9).fillColor('#333');
      doc.text(`Date d'émission : ${formatDate(input.issueDate)}`, 320, 75, {
        align: 'right',
        width: 225,
      });
      if (input.dueDate) {
        doc.text(`Échéance : ${formatDate(input.dueDate)}`, 320, 88, {
          align: 'right',
          width: 225,
        });
      }

      if (input.template.headerText) {
        doc
          .font(font)
          .fontSize(8)
          .fillColor(secondary)
          .text(input.template.headerText, 50, 120, {
            width: doc.page.width - 100,
            align: 'center',
          });
      }

      doc.moveDown(2);
    };

    const drawParties = () => {
      const y = doc.y + 10;
      doc.font(boldFont).fontSize(10).fillColor(input.template.primaryColor);
      doc.text('Client', 50, y);
      doc.font(font).fontSize(9).fillColor('#333');
      const buyerLines = [
        input.buyer.companyName,
        input.buyer.tradeName,
        formatAddress(input.buyer.billingAddress),
        input.buyer.siret ? `SIRET : ${input.buyer.siret}` : null,
        input.buyer.taxId ? `N° TVA : ${input.buyer.taxId}` : null,
      ].filter(Boolean);
      doc.text(buyerLines.join('\n'), 50, y + 14, { width: 250 });
      doc.y = y + 70;
    };

    const drawLinesTable = () => {
      const layout = input.template.layoutType;
      const startY = doc.y + 10;
      const colX = {
        desc: 50,
        qty: layout === PdfLayoutType.minimal ? 300 : 280,
        unit: layout === PdfLayoutType.minimal ? 340 : 330,
        tax: layout === PdfLayoutType.minimal ? 390 : 400,
        ht: layout === PdfLayoutType.minimal ? 430 : 450,
        ttc: layout === PdfLayoutType.minimal ? 490 : 510,
      };

      doc
        .rect(50, startY, doc.page.width - 100, 18)
        .fill(input.template.primaryColor);
      doc.fillColor('#fff').font(boldFont).fontSize(8);
      doc.text('Désignation', colX.desc + 4, startY + 5);
      doc.text('Qté', colX.qty, startY + 5);
      doc.text('PU HT', colX.unit, startY + 5);
      doc.text('TVA', colX.tax, startY + 5);
      doc.text('HT', colX.ht, startY + 5);
      if (layout !== PdfLayoutType.minimal) {
        doc.text('TTC', colX.ttc, startY + 5);
      }

      let rowY = startY + 22;
      doc.font(font).fillColor('#333').fontSize(8);

      for (const line of input.lines) {
        if (rowY > doc.page.height - 180) {
          doc.addPage();
          rowY = 60;
        }
        const taxLabel = line.taxRateName
          ? `${line.taxRateName} (${line.taxRate}%)`
          : `${line.taxRate}%`;
        doc.text(`${line.position}. ${line.description}`, colX.desc, rowY, {
          width: colX.qty - colX.desc - 8,
        });
        doc.text(String(line.quantity), colX.qty, rowY);
        doc.text(line.unitPriceHt.toFixed(2), colX.unit, rowY);
        doc.text(taxLabel, colX.tax, rowY, { width: 45 });
        doc.text(line.lineTotalHt.toFixed(2), colX.ht, rowY);
        if (layout !== PdfLayoutType.minimal) {
          doc.text(line.lineTotalTtc.toFixed(2), colX.ttc, rowY);
        }
        rowY += 22;
      }

      doc.y = rowY + 10;
    };

    const drawTotals = () => {
      const x = 320;
      let y = doc.y;
      doc.font(font).fontSize(9).fillColor('#333');

      const rows: Array<[string, string]> = [
        ['Sous-total HT', formatMoney(input.subtotalHt, input.currency)],
      ];
      if (input.discountAmount > 0 || input.discountPct > 0) {
        rows.push([
          'Remise globale',
          `${formatMoney(input.discountAmount, input.currency)}` +
            (input.discountPct > 0 ? ` (${input.discountPct}%)` : ''),
        ]);
      }
      rows.push(['Base HT', formatMoney(input.baseHt, input.currency)]);

      for (const tax of input.taxBreakdown) {
        const label = tax.rateName
          ? `TVA ${tax.rateName} (${tax.rate}%)`
          : `TVA ${tax.rate}%`;
        rows.push([label, formatMoney(tax.taxAmount, input.currency)]);
      }

      for (const [label, value] of rows) {
        doc.text(label, x, y, { width: 120 });
        doc.text(value, x + 125, y, { width: 100, align: 'right' });
        y += 14;
      }

      doc
        .font(boldFont)
        .fontSize(11)
        .fillColor(input.template.primaryColor)
        .text('Total TTC', x, y + 4, { width: 120 });
      doc.text(formatMoney(input.totalTtc, input.currency), x + 125, y + 4, {
        width: 100,
        align: 'right',
      });
      doc.y = y + 30;
    };

    const drawFooterBlocks = () => {
      doc.font(font).fontSize(8).fillColor('#333');

      if (input.paymentTerms || input.acceptedPaymentMethods) {
        doc.font(boldFont).text('Conditions de paiement', 50);
        doc.font(font);
        if (input.paymentTerms) doc.text(input.paymentTerms);
        if (input.acceptedPaymentMethods) {
          doc.text(`Modes acceptés : ${input.acceptedPaymentMethods}`);
        }
        doc.moveDown(0.5);
      }

      if (input.latePaymentMention) {
        doc.text(input.latePaymentMention);
        doc.moveDown(0.5);
      }

      if (input.notes) {
        doc.font(boldFont).text('Notes');
        doc.font(font).text(input.notes);
        doc.moveDown(0.5);
      }

      const legal = [
        input.template.legalMentions,
        input.template.termsAndConditions,
      ]
        .filter(Boolean)
        .join('\n\n');

      if (legal) {
        doc.font(boldFont).text('Mentions légales', 50);
        doc.font(font).text(legal, { width: doc.page.width - 100 });
      }

      if (input.template.footerText) {
        doc
          .font(font)
          .fontSize(7)
          .fillColor(input.template.secondaryColor)
          .text(input.template.footerText, 50, doc.page.height - 55, {
            align: 'center',
            width: doc.page.width - 100,
          });
      }
    };

  void (async () => {
      try {
        await drawHeader();
        drawParties();
        drawLinesTable();
        drawTotals();
        drawFooterBlocks();
        drawPageNumber();
        doc.end();
      } catch (err) {
        reject(err);
      }
    })();
  });
}
