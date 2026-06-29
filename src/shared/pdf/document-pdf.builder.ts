import PDFDocument from 'pdfkit';
import { promises as fs } from 'fs';
import * as path from 'path';
import { PdfLayoutType } from '@prisma/client';
import { PdfDocumentInput } from './document-pdf.types';
import { resolvePdfFont } from './pdf-fonts';
import {
  formatDateFr,
  formatMoney,
  formatQuantity,
  lightenHex,
  normalizeHex,
  PDF_COLORS,
  PDF_PAGE,
  resolveBoldFont,
} from './document-pdf.utils';

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
  const boldFont = resolveBoldFont(font);
  const primary = normalizeHex(input.template.primaryColor);
  const secondary = normalizeHex(input.template.secondaryColor, '#64748b');
  const primarySoft = lightenHex(primary, 0.94);
  const margin = PDF_PAGE.margin;
  const contentWidth = PDF_PAGE.width - margin * 2;
  const showTtc = input.template.layoutType !== PdfLayoutType.minimal;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin,
      size: 'A4',
      bufferPages: true,
      info: {
        Title: `${input.documentLabel} ${input.number}`,
        Author: input.seller.legalName ?? input.seller.name,
      },
    });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const contentBottom = () => doc.page.height - margin - 36;

    const drawWatermark = () => {
      if (!input.statusLabel) return;
      doc.save();
      doc.opacity(0.07);
      doc
        .font(boldFont)
        .fontSize(72)
        .fillColor(primary)
        .rotate(-35, { origin: [PDF_PAGE.width / 2, PDF_PAGE.height / 2] })
        .text(input.statusLabel.toUpperCase(), 0, PDF_PAGE.height / 2 - 36, {
          width: PDF_PAGE.width,
          align: 'center',
        });
      doc.restore();
      doc.opacity(1);
    };

    const drawBrandStrip = () => {
      doc.rect(0, 0, PDF_PAGE.width, 5).fill(primary);
    };

    const drawFooterChrome = () => {
      const y = doc.page.height - margin - 18;
      doc
        .moveTo(margin, y)
        .lineTo(PDF_PAGE.width - margin, y)
        .strokeColor(PDF_COLORS.border)
        .lineWidth(0.5)
        .stroke();

      if (input.template.footerText) {
        doc
          .font(font)
          .fontSize(7)
          .fillColor(secondary)
          .text(input.template.footerText, margin, y + 4, {
            width: contentWidth,
            align: 'center',
          });
      }
    };

    const drawPageNumbers = () => {
      if (!input.template.showPageNumbers) return;
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .font(font)
          .fontSize(8)
          .fillColor(PDF_COLORS.textMuted)
          .text(
            `Page ${i - range.start + 1} / ${range.count}`,
            margin,
            doc.page.height - margin - 8,
            { width: contentWidth, align: 'right' },
          );
      }
    };

    const drawHeader = async () => {
      drawBrandStrip();
      drawWatermark();

      let headerY = margin + 8;
      const logoWidth = 72;

      if (input.template.logoUrl) {
        try {
          const logoPath = input.template.logoUrl.startsWith('/')
            ? path.join(process.cwd(), input.template.logoUrl.replace(/^\//, ''))
            : input.template.logoUrl;
          if (await fs.stat(logoPath).then(() => true).catch(() => false)) {
            doc.image(logoPath, margin, headerY, {
              fit: [logoWidth, 48],
            });
          }
        } catch {
          // logo optionnel
        }
      }

      const companyX = input.template.logoUrl ? margin + logoWidth + 14 : margin;
      const companyWidth = 250;

      doc
        .font(boldFont)
        .fontSize(13)
        .fillColor(PDF_COLORS.text)
        .text(input.seller.legalName ?? input.seller.name, companyX, headerY, {
          width: companyWidth,
        });

      doc.font(font).fontSize(8).fillColor(PDF_COLORS.textMuted);
      const sellerLines = [
        input.seller.tradeName &&
        input.seller.tradeName !== input.seller.legalName
          ? input.seller.tradeName
          : null,
        formatAddress(input.seller.address),
        input.seller.siret ? `SIRET ${input.seller.siret}` : null,
        input.seller.vatNumber ? `TVA ${input.seller.vatNumber}` : null,
        input.seller.registrationNumber
          ? `RCS ${input.seller.registrationNumber}`
          : null,
        input.seller.shareCapital
          ? `Capital ${input.seller.shareCapital}`
          : null,
        [input.seller.phone, input.seller.email, input.seller.website]
          .filter(Boolean)
          .join(' · '),
      ].filter(Boolean);

      doc.text(sellerLines.join('\n'), companyX, headerY + 18, {
        width: companyWidth,
        lineGap: 1,
      });

      const badgeX = PDF_PAGE.width - margin - 210;
      const badgeY = headerY;
      const badgeW = 210;
      const badgeH = input.dueDate ? 78 : 66;

      doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 6).fill(primarySoft);
      doc
        .roundedRect(badgeX, badgeY, badgeW, badgeH, 6)
        .lineWidth(0.75)
        .strokeColor(lightenHex(primary, 0.75));

      doc
        .font(boldFont)
        .fontSize(9)
        .fillColor(primary)
        .text(input.documentLabel.toUpperCase(), badgeX + 12, badgeY + 10, {
          width: badgeW - 24,
        });

      doc
        .font(boldFont)
        .fontSize(14)
        .fillColor(PDF_COLORS.text)
        .text(input.number, badgeX + 12, badgeY + 24, { width: badgeW - 24 });

      doc.font(font).fontSize(8).fillColor(PDF_COLORS.textMuted);
      doc.text(
        `Émis le ${formatDateFr(input.issueDate)}`,
        badgeX + 12,
        badgeY + 44,
        { width: badgeW - 24 },
      );
      if (input.dueDate) {
        doc.text(
          `Échéance ${formatDateFr(input.dueDate)}`,
          badgeX + 12,
          badgeY + 56,
          { width: badgeW - 24 },
        );
      }

      headerY = Math.max(doc.y, badgeY + badgeH) + 14;

      if (input.template.headerText) {
        doc
          .font(font)
          .fontSize(8)
          .fillColor(secondary)
          .text(input.template.headerText, margin, headerY, {
            width: contentWidth,
            align: 'center',
          });
        headerY = doc.y + 10;
      }

      doc.y = headerY;
    };

    const drawPartyCards = () => {
      const cardGap = 12;
      const cardW = (contentWidth - cardGap) / 2;
      const y = doc.y + 4;
      const pad = 10;

      const drawCard = (
        x: number,
        title: string,
        lines: string[],
      ) => {
        const textBlock = lines.filter(Boolean).join('\n');
        doc.font(font).fontSize(8);
        const textH = doc.heightOfString(textBlock, { width: cardW - pad * 2 });
        const cardH = Math.max(68, textH + 34);

        doc.roundedRect(x, y, cardW, cardH, 5).fill(PDF_COLORS.surface);
        doc
          .roundedRect(x, y, cardW, cardH, 5)
          .lineWidth(0.5)
          .strokeColor(PDF_COLORS.border);

        doc
          .font(boldFont)
          .fontSize(8)
          .fillColor(primary)
          .text(title.toUpperCase(), x + pad, y + pad);

        doc
          .font(font)
          .fontSize(9)
          .fillColor(PDF_COLORS.text)
          .text(textBlock, x + pad, y + pad + 14, {
            width: cardW - pad * 2,
            lineGap: 2,
          });

        return cardH;
      };

      const buyerLines = [
        input.buyer.companyName,
        input.buyer.tradeName,
        input.buyer.contactName ? `À l'attention de ${input.buyer.contactName}` : null,
        formatAddress(input.buyer.billingAddress),
        input.buyer.siret ? `SIRET ${input.buyer.siret}` : null,
        input.buyer.taxId ? `TVA ${input.buyer.taxId}` : null,
      ].filter(Boolean) as string[];

      const leftH = drawCard(margin, 'Émetteur', [
        input.seller.legalName ?? input.seller.name,
        input.seller.email ?? '',
      ].filter(Boolean));
      const rightH = drawCard(margin + cardW + cardGap, 'Client', buyerLines);

      doc.y = y + Math.max(leftH, rightH) + 16;
    };

    const drawTable = () => {
      const cols = showTtc
        ? [
            { key: 'desc', label: 'Désignation', x: margin, w: 228, align: 'left' as const },
            { key: 'qty', label: 'Qté', x: margin + 228, w: 32, align: 'center' as const },
            { key: 'unit', label: 'PU HT', x: margin + 260, w: 52, align: 'right' as const },
            { key: 'tax', label: 'TVA', x: margin + 312, w: 44, align: 'right' as const },
            { key: 'ht', label: 'Total HT', x: margin + 356, w: 52, align: 'right' as const },
            { key: 'ttc', label: 'Total TTC', x: margin + 408, w: contentWidth - 408, align: 'right' as const },
          ]
        : [
            { key: 'desc', label: 'Désignation', x: margin, w: 280, align: 'left' as const },
            { key: 'qty', label: 'Qté', x: margin + 280, w: 36, align: 'center' as const },
            { key: 'unit', label: 'PU HT', x: margin + 316, w: 58, align: 'right' as const },
            { key: 'tax', label: 'TVA', x: margin + 374, w: 48, align: 'right' as const },
            { key: 'ht', label: 'Total HT', x: margin + 422, w: contentWidth - 422, align: 'right' as const },
          ];

      const headerH = 22;
      let y = doc.y;

      const ensureSpace = (needed: number) => {
        if (y + needed > contentBottom()) {
          doc.addPage();
          drawBrandStrip();
          y = margin + 12;
        }
      };

      ensureSpace(headerH + 24);
      doc.rect(margin, y, contentWidth, headerH).fill(primary);
      doc.font(boldFont).fontSize(8).fillColor(PDF_COLORS.white);
      for (const col of cols) {
        doc.text(col.label, col.x + 4, y + 7, {
          width: col.w - 8,
          align: col.align,
        });
      }
      y += headerH;

      doc.font(font).fontSize(8).fillColor(PDF_COLORS.text);

      input.lines.forEach((line, index) => {
        const desc = `${line.position}. ${line.description}`;
        const descCol = cols[0];
        const descH = doc.heightOfString(desc, { width: descCol.w - 8 });
        const rowH = Math.max(22, descH + 10);

        ensureSpace(rowH + 4);

        if (index % 2 === 1) {
          doc.rect(margin, y, contentWidth, rowH).fill(PDF_COLORS.surfaceAlt);
        }

        doc
          .moveTo(margin, y + rowH)
          .lineTo(margin + contentWidth, y + rowH)
          .strokeColor(PDF_COLORS.border)
          .lineWidth(0.25)
          .stroke();

        const taxLabel = line.taxRateName
          ? `${line.taxRate}%`
          : `${line.taxRate}%`;
        const values: Record<string, string> = {
          desc,
          qty: formatQuantity(line.quantity),
          unit: formatMoney(line.unitPriceHt, input.currency),
          tax: taxLabel,
          ht: formatMoney(line.lineTotalHt, input.currency),
          ttc: formatMoney(line.lineTotalTtc, input.currency),
        };

        doc.fillColor(PDF_COLORS.text);
        for (const col of cols) {
          doc.text(values[col.key], col.x + 4, y + 6, {
            width: col.w - 8,
            align: col.align,
          });
        }

        y += rowH;
      });

      doc.y = y + 14;
    };

    const drawTotals = () => {
      const panelW = 230;
      const panelX = PDF_PAGE.width - margin - panelW;
      let y = doc.y;

      if (y + 130 > contentBottom()) {
        doc.addPage();
        drawBrandStrip();
        y = margin + 12;
      }

      const rows: Array<[string, string]> = [
        ['Sous-total HT', formatMoney(input.subtotalHt, input.currency)],
      ];
      if (input.discountAmount > 0 || input.discountPct > 0) {
        rows.push([
          'Remise',
          `${formatMoney(input.discountAmount, input.currency)}${input.discountPct > 0 ? ` (${input.discountPct} %)` : ''}`,
        ]);
      }
      rows.push(['Base HT', formatMoney(input.baseHt, input.currency)]);
      for (const tax of input.taxBreakdown) {
        const label = tax.rateName
          ? `TVA ${tax.rateName} (${tax.rate} %)`
          : `TVA ${tax.rate} %`;
        rows.push([label, formatMoney(tax.taxAmount, input.currency)]);
      }

      const rowH = 16;
      const panelH = rows.length * rowH + 34;
      doc.roundedRect(panelX, y, panelW, panelH, 6).fill(PDF_COLORS.surface);
      doc
        .roundedRect(panelX, y, panelW, panelH, 6)
        .lineWidth(0.5)
        .strokeColor(PDF_COLORS.border);

      let rowY = y + 10;
      for (const [label, value] of rows) {
        doc
          .font(font)
          .fontSize(8)
          .fillColor(PDF_COLORS.textMuted)
          .text(label, panelX + 12, rowY, { width: 120 });
        doc
          .font(font)
          .fontSize(8)
          .fillColor(PDF_COLORS.text)
          .text(value, panelX + 12, rowY, {
            width: panelW - 24,
            align: 'right',
          });
        rowY += rowH;
      }

      doc
        .moveTo(panelX + 10, rowY + 2)
        .lineTo(panelX + panelW - 10, rowY + 2)
        .strokeColor(primary)
        .lineWidth(1)
        .stroke();

      doc
        .font(boldFont)
        .fontSize(11)
        .fillColor(primary)
        .text('Total TTC', panelX + 12, rowY + 8, { width: 100 });
      doc
        .font(boldFont)
        .fontSize(11)
        .fillColor(PDF_COLORS.text)
        .text(formatMoney(input.totalTtc, input.currency), panelX + 12, rowY + 8, {
          width: panelW - 24,
          align: 'right',
        });

      doc.y = y + panelH + 18;
    };

    const drawInfoBlocks = () => {
      if (input.paymentTerms || input.acceptedPaymentMethods) {
        doc
          .font(boldFont)
          .fontSize(9)
          .fillColor(PDF_COLORS.text)
          .text('Conditions de paiement', margin);
        doc.font(font).fontSize(8).fillColor(PDF_COLORS.textMuted);
        if (input.paymentTerms) doc.text(input.paymentTerms, { lineGap: 2 });
        if (input.acceptedPaymentMethods) {
          doc.text(`Modes acceptés : ${input.acceptedPaymentMethods}`);
        }
        doc.moveDown(0.6);
      }

      if (input.latePaymentMention) {
        doc
          .font(font)
          .fontSize(7.5)
          .fillColor(PDF_COLORS.textMuted)
          .text(input.latePaymentMention, margin, doc.y, {
            width: contentWidth,
            lineGap: 1,
          });
        doc.moveDown(0.6);
      }

      if (input.notes) {
        doc.font(boldFont).fontSize(9).fillColor(PDF_COLORS.text).text('Notes');
        doc.font(font).fontSize(8).fillColor(PDF_COLORS.text).text(input.notes);
        doc.moveDown(0.6);
      }

      const legal = [input.template.legalMentions, input.template.termsAndConditions]
        .filter(Boolean)
        .join('\n\n');
      if (legal) {
        doc
          .font(boldFont)
          .fontSize(8)
          .fillColor(PDF_COLORS.textMuted)
          .text('Mentions légales');
        doc.font(font).fontSize(7).fillColor(PDF_COLORS.textMuted).text(legal, {
          width: contentWidth,
          lineGap: 1,
        });
      }
    };

    void (async () => {
      try {
        await drawHeader();
        drawPartyCards();
        drawTable();
        drawTotals();
        drawInfoBlocks();

        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          drawFooterChrome();
        }

        drawPageNumbers();
        doc.end();
      } catch (err) {
        reject(err);
      }
    })();
  });
}
