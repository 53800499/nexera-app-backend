import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import { InventoryService } from './inventory.service';
import { CrmMessages } from '../../../shared/constants/crm-messages';
import {
  formatDateFr,
  formatDateTimeFr,
  formatMoney,
  formatQuantity,
  PDF_PAGE,
} from '../../../shared/pdf/document-pdf.utils';

const TYPE_LABELS: Record<string, string> = {
  complete: 'Inventaire complet',
  category: 'Inventaire par catégorie',
  cycle: 'Inventaire tournant',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  counting: 'Comptage en cours',
  recount: 'Double comptage',
  analyzing: 'Analyse des écarts',
  validated: 'Ajustements validés',
  closed: 'Clôturé',
  cancelled: 'Annulé',
};

function safeFormatDate(d: any): string {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '—' : formatDateFr(dt);
  } catch {
    return '—';
  }
}

@Injectable()
export class InventoryPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    @Inject(forwardRef(() => InventoryService))
    private readonly inventoryService: InventoryService,
  ) {}

  async generatePdf(
    tenantId: string,
    sessionId: string,
    mode: 'report' | 'sheet' = 'report',
  ): Promise<{ buffer: Buffer; filename: string }> {
    const session = await this.inventoryService.findOne(sessionId, tenantId);

    if (!session) {
      throw new NotFoundException(CrmMessages.stock.INVENTORY_NOT_FOUND);
    }

    const [tenant, settings] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId } }).catch(() => null),
      this.settingsService.getTenantSettings(tenantId).catch(() => null),
    ]);

    const currency = settings?.primaryCurrency ?? 'EUR';
    const isSheet = mode === 'sheet';

    const filename = isSheet
      ? `feuille-comptage-${session.number}.pdf`
      : `rapport-inventaire-${session.number}.pdf`;

    const buffer = await this.buildPdfDocument(session, tenant, currency, isSheet);
    return { buffer, filename };
  }

  private buildPdfDocument(
    session: any,
    tenant: any,
    currency: string,
    isSheet: boolean,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const margin = 36;
        const doc = new PDFDocument({
          size: 'A4',
          margin,
          bufferPages: true,
          info: {
            Title: isSheet
              ? `Feuille de comptage ${session.number}`
              : `Rapport d'inventaire ${session.number}`,
            Author: tenant?.legalName ?? tenant?.name ?? 'Nexera ERP',
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        const pageWidth = PDF_PAGE.width;
        const contentWidth = pageWidth - margin * 2;
        const primaryColor = '#2563eb';
        const textDark = '#0f172a';
        const textMuted = '#64748b';
        const borderColor = '#cbd5e1';

        // Tri propre en mémoire des lignes
        const lines = [...(session.lines ?? [])].sort((a: any, b: any) => {
          const refA = a.stockItem?.commercialItem?.reference ?? '';
          const refB = b.stockItem?.commercialItem?.reference ?? '';
          return refA.localeCompare(refB);
        });

        // --- En-tête ---
        const drawHeader = () => {
          const topY = margin;

          // Bloc entreprise (gauche)
          doc
            .font('Helvetica-Bold')
            .fontSize(13)
            .fillColor(textDark)
            .text(tenant?.legalName ?? tenant?.name ?? 'NEXERA', margin, topY);

          let companyY = topY + 16;
          doc.font('Helvetica').fontSize(8.5).fillColor(textMuted);

          if (tenant?.address) {
            doc.text(tenant.address, margin, companyY);
            companyY += 11;
          }
          const cityLine = [tenant?.postalCode, tenant?.city, tenant?.country]
            .filter(Boolean)
            .join(' ');
          if (cityLine) {
            doc.text(cityLine, margin, companyY);
            companyY += 11;
          }
          const contactLine = [tenant?.phone, tenant?.email].filter(Boolean).join(' • ');
          if (contactLine) {
            doc.text(contactLine, margin, companyY);
            companyY += 11;
          }
          if (tenant?.taxId) {
            doc.text(`N° Contribuable / IFU : ${tenant.taxId}`, margin, companyY);
            companyY += 11;
          }

          // Bloc document (droite)
          const docBoxWidth = 240;
          const docBoxX = pageWidth - margin - docBoxWidth;

          doc
            .font('Helvetica-Bold')
            .fontSize(13)
            .fillColor(primaryColor)
            .text(
              isSheet ? 'FEUILLE DE COMPTAGE' : "RAPPORT D'INVENTAIRE",
              docBoxX,
              topY,
              { width: docBoxWidth, align: 'right' },
            );

          doc
            .font('Helvetica-Bold')
            .fontSize(10.5)
            .fillColor(textDark)
            .text(`Session : ${session.number}`, docBoxX, topY + 16, {
              width: docBoxWidth,
              align: 'right',
            });

          doc.font('Helvetica').fontSize(8.5).fillColor(textMuted);
          const dateStr = safeFormatDate(session.plannedDate ?? session.createdAt);
          doc.text(`Date : ${dateStr}`, docBoxX, topY + 30, {
            width: docBoxWidth,
            align: 'right',
          });
          const whCode = session.warehouse?.code ?? '';
          const whName = session.warehouse?.name ?? '';
          doc.text(
            `Entrepôt : ${whCode ? `${whCode} — ` : ''}${whName || 'Tous'}`,
            docBoxX,
            topY + 42,
            { width: docBoxWidth, align: 'right' },
          );
          doc.text(
            `Type : ${TYPE_LABELS[session.type] ?? session.type} | Statut : ${STATUS_LABELS[session.status] ?? session.status}`,
            docBoxX,
            topY + 54,
            { width: docBoxWidth, align: 'right' },
          );

          // Ligne de séparation
          const sepY = Math.max(companyY, topY + 70) + 6;
          doc
            .strokeColor(borderColor)
            .lineWidth(0.8)
            .moveTo(margin, sepY)
            .lineTo(pageWidth - margin, sepY)
            .stroke();

          return sepY + 10;
        };

        let currentY = drawHeader();

        // --- KPIs Banner (uniquement pour le rapport d'inventaire) ---
        if (!isSheet) {
          const totalLines = lines.length;
          const totalTheo = lines.reduce(
            (sum: number, l: any) => sum + (Number(l.qtyTheoretical) || 0),
            0,
          );
          const totalCounted = lines.reduce(
            (sum: number, l: any) =>
              sum + (Number(l.qtyFinal ?? l.qtyCounted2 ?? l.qtyCounted1) || 0),
            0,
          );
          const totalVarianceVal = lines.reduce(
            (sum: number, l: any) => sum + (Number(l.varianceValue) || 0),
            0,
          );
          const linesWithDiff = lines.filter(
            (l: any) => (Number(l.varianceQty) || 0) !== 0,
          ).length;

          const kpiBoxWidth = (contentWidth - 18) / 4;
          const kpiHeight = 44;

          const drawKpi = (x: number, title: string, value: string, sub?: string) => {
            doc
              .roundedRect(x, currentY, kpiBoxWidth, kpiHeight, 4)
              .fillAndStroke('#f8fafc', '#e2e8f0');
            doc
              .font('Helvetica')
              .fontSize(7.5)
              .fillColor(textMuted)
              .text(title, x + 8, currentY + 7, { width: kpiBoxWidth - 16 });
            doc
              .font('Helvetica-Bold')
              .fontSize(10.5)
              .fillColor(textDark)
              .text(value, x + 8, currentY + 18, { width: kpiBoxWidth - 16 });
            if (sub) {
              doc
                .font('Helvetica')
                .fontSize(7)
                .fillColor(textMuted)
                .text(sub, x + 8, currentY + 31, { width: kpiBoxWidth - 16 });
            }
          };

          drawKpi(
            margin,
            'Total références',
            String(totalLines),
            `${linesWithDiff} avec écart`,
          );
          drawKpi(
            margin + kpiBoxWidth + 6,
            'Qté théorique',
            formatQuantity(totalTheo),
            'En stock initial',
          );
          drawKpi(
            margin + (kpiBoxWidth + 6) * 2,
            'Qté comptée',
            formatQuantity(totalCounted),
            `Écart net: ${formatQuantity(totalCounted - totalTheo)}`,
          );

          const valColor =
            totalVarianceVal > 0
              ? '#059669'
              : totalVarianceVal < 0
                ? '#dc2626'
                : textDark;
          doc
            .roundedRect(
              margin + (kpiBoxWidth + 6) * 3,
              currentY,
              kpiBoxWidth,
              kpiHeight,
              4,
            )
            .fillAndStroke('#f8fafc', '#e2e8f0');
          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor(textMuted)
            .text(
              'Valeur nette des écarts',
              margin + (kpiBoxWidth + 6) * 3 + 8,
              currentY + 7,
            );
          doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .fillColor(valColor)
            .text(
              formatMoney(totalVarianceVal, currency),
              margin + (kpiBoxWidth + 6) * 3 + 8,
              currentY + 19,
            );

          currentY += kpiHeight + 14;
        }

        // --- Colonnes ---
        type ColumnConfig = {
          key: string;
          title: string;
          width: number;
          align: 'left' | 'right' | 'center';
        };

        const reportCols: ColumnConfig[] = [
          { key: 'ref', title: 'Référence', width: 65, align: 'left' },
          { key: 'name', title: 'Désignation', width: 130, align: 'left' },
          { key: 'loc', title: 'Empl. / Lot', width: 70, align: 'left' },
          { key: 'theo', title: 'Théo', width: 42, align: 'right' },
          { key: 'counted', title: 'Compté', width: 44, align: 'right' },
          { key: 'diff', title: 'Écart', width: 42, align: 'right' },
          { key: 'cmup', title: 'CMUP', width: 55, align: 'right' },
          { key: 'val', title: 'Val. Écart', width: 75, align: 'right' },
        ];

        const sheetCols: ColumnConfig[] = [
          { key: 'ref', title: 'Référence', width: 75, align: 'left' },
          { key: 'name', title: 'Désignation', width: 170, align: 'left' },
          { key: 'loc', title: 'Emplacement', width: 85, align: 'left' },
          { key: 'lot', title: 'Lot', width: 85, align: 'left' },
          { key: 'counted', title: 'Qté comptée', width: 65, align: 'center' },
          { key: 'obs', title: 'Observations', width: 43, align: 'left' },
        ];

        const columns = isSheet ? sheetCols : reportCols;

        const drawTableHeader = (y: number) => {
          doc.rect(margin, y, contentWidth, 20).fill('#f1f5f9');
          doc
            .strokeColor(borderColor)
            .lineWidth(0.5)
            .rect(margin, y, contentWidth, 20)
            .stroke();

          let colX = margin;
          doc.font('Helvetica-Bold').fontSize(8).fillColor(textDark);

          for (const col of columns) {
            doc.text(col.title, colX + 4, y + 6, {
              width: col.width - 8,
              align: col.align,
            });
            colX += col.width;
          }
          return y + 20;
        };

        currentY = drawTableHeader(currentY);

        // --- Lignes de données ---
        const rowHeight = isSheet ? 26 : 20;
        const bottomLimit = doc.page.height - margin - 80;

        lines.forEach((line: any, index: number) => {
          if (currentY + rowHeight > bottomLimit) {
            doc.addPage();
            currentY = drawTableHeader(margin);
          }

          const isAlt = index % 2 === 1;
          if (isAlt) {
            doc.rect(margin, currentY, contentWidth, rowHeight).fill('#fafafa');
          }

          doc
            .strokeColor('#f1f5f9')
            .lineWidth(0.5)
            .moveTo(margin, currentY + rowHeight)
            .lineTo(pageWidth - margin, currentY + rowHeight)
            .stroke();

          const comm = line.stockItem?.commercialItem;
          const ref = comm?.reference ?? '-';
          const name = comm?.name ?? '-';
          const locCode = line.location?.code ?? '';
          const lotNum = line.lot?.lotNumber ? `Lot ${line.lot.lotNumber}` : '';
          const locAndLot = [locCode, lotNum].filter(Boolean).join(' / ') || '-';

          let colX = margin;
          doc.font('Helvetica').fontSize(7.5).fillColor(textDark);

          if (isSheet) {
            doc.text(ref, colX + 4, currentY + 7, { width: 75 - 8, align: 'left' });
            colX += 75;
            doc.text(name, colX + 4, currentY + 7, {
              width: 170 - 8,
              align: 'left',
              ellipsis: true,
            });
            colX += 170;
            doc.text(locCode || '-', colX + 4, currentY + 7, {
              width: 85 - 8,
              align: 'left',
            });
            colX += 85;
            doc.text(lotNum || '-', colX + 4, currentY + 7, {
              width: 85 - 8,
              align: 'left',
            });
            colX += 85;
            doc
              .rect(colX + 8, currentY + 4, 65 - 16, rowHeight - 8)
              .fillAndStroke('#ffffff', '#94a3b8');
            colX += 65;
            doc.text('', colX + 4, currentY + 7, { width: 43 - 8 });
          } else {
            const qtyTheo = Number(line.qtyTheoretical) || 0;
            const qtyCount =
              line.qtyFinal ?? line.qtyCounted2 ?? line.qtyCounted1 ?? null;
            const diffQty = line.varianceQty ?? (qtyCount != null ? qtyCount - qtyTheo : 0);
            const cmup = Number(line.unitCost) || 0;
            const diffVal = line.varianceValue ?? diffQty * cmup;

            doc.text(ref, colX + 4, currentY + 5.5, { width: 65 - 8, align: 'left' });
            colX += 65;
            doc.text(name, colX + 4, currentY + 5.5, {
              width: 130 - 8,
              align: 'left',
              ellipsis: true,
            });
            colX += 130;
            doc.text(locAndLot, colX + 4, currentY + 5.5, {
              width: 70 - 8,
              align: 'left',
              ellipsis: true,
            });
            colX += 70;
            doc.text(formatQuantity(qtyTheo), colX + 4, currentY + 5.5, {
              width: 42 - 8,
              align: 'right',
            });
            colX += 42;
            doc.text(
              qtyCount != null ? formatQuantity(qtyCount) : '-',
              colX + 4,
              currentY + 5.5,
              { width: 44 - 8, align: 'right' },
            );
            colX += 44;

            const diffColor =
              diffQty > 0 ? '#059669' : diffQty < 0 ? '#dc2626' : textMuted;
            doc
              .font('Helvetica-Bold')
              .fillColor(diffColor)
              .text(
                (diffQty > 0 ? '+' : '') + formatQuantity(diffQty),
                colX + 4,
                currentY + 5.5,
                { width: 42 - 8, align: 'right' },
              );
            colX += 42;

            doc
              .font('Helvetica')
              .fillColor(textDark)
              .text(formatMoney(cmup, currency), colX + 4, currentY + 5.5, {
                width: 55 - 8,
                align: 'right',
              });
            colX += 55;

            doc
              .font('Helvetica-Bold')
              .fillColor(diffColor)
              .text(formatMoney(diffVal, currency), colX + 4, currentY + 5.5, {
                width: 75 - 8,
                align: 'right',
              });
          }

          currentY += rowHeight;
        });

        // --- Bloc Signatures en bas de page ---
        const signBlockHeight = 55;
        if (currentY + signBlockHeight + 10 > doc.page.height - margin - 30) {
          doc.addPage();
          currentY = margin + 10;
        } else {
          currentY += 15;
        }

        const signBoxWidth = (contentWidth - 16) / (isSheet ? 2 : 3);

        const drawSignBox = (x: number, title: string) => {
          doc
            .roundedRect(x, currentY, signBoxWidth, signBlockHeight, 4)
            .strokeColor(borderColor)
            .lineWidth(0.6)
            .stroke();
          doc
            .font('Helvetica-Bold')
            .fontSize(7.5)
            .fillColor(textDark)
            .text(title, x + 6, currentY + 6, { width: signBoxWidth - 12 });
          doc
            .font('Helvetica')
            .fontSize(6.5)
            .fillColor(textMuted)
            .text('Nom, date & visa :', x + 6, currentY + 17);
        };

        if (isSheet) {
          drawSignBox(margin, 'Magasinier / Compteur');
          drawSignBox(margin + signBoxWidth + 16, "Superviseur d'inventaire");
        } else {
          drawSignBox(margin, 'Compté par');
          drawSignBox(margin + signBoxWidth + 8, 'Responsable Stock');
          drawSignBox(margin + (signBoxWidth + 8) * 2, 'Direction / Finance');
        }

        // --- Pagination globale et horodatage sécurisée ---
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.page.margins.bottom = 0; // Empêche un saut de page intempestif
          const footerY = doc.page.height - 24;

          doc
            .strokeColor('#e2e8f0')
            .lineWidth(0.5)
            .moveTo(margin, footerY - 4)
            .lineTo(pageWidth - margin, footerY - 4)
            .stroke();

          doc
            .font('Helvetica')
            .fontSize(7.5)
            .fillColor(textMuted)
            .text(
              `Session ${session.number} — Document généré le ${formatDateTimeFr(new Date())}`,
              margin,
              footerY,
              { width: contentWidth / 2, align: 'left', lineBreak: false },
            );

          doc.text(
            `Page ${i - range.start + 1} / ${range.count}`,
            margin + contentWidth / 2,
            footerY,
            { width: contentWidth / 2, align: 'right', lineBreak: false },
          );
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
