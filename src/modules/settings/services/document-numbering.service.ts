import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { NumberingDocumentType } from '../enums/numbering-document-type.enum';
import { DEFAULT_NUMBERING_RULES } from '../constants/default-settings.constants';

type NumberingRule = {
  prefix: string;
  suffix?: string | null;
  separator: string;
  draftMarker?: string | null;
  includeYear: boolean;
  counterLength: number;
  annualReset: boolean;
};

@Injectable()
export class DocumentNumberingService {
  constructor(private readonly prisma: PrismaService) {}

  async generateNext(
    tenantId: string,
    documentType: NumberingDocumentType,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const db = tx ?? this.prisma;
    const rule = await this.getRule(tenantId, documentType, db);
    const searchPrefix = this.buildSearchPrefix(rule, documentType);
    const latest = await this.findLatestNumber(db, tenantId, documentType, searchPrefix);

    let seq = 1;
    if (latest) {
      const parsed = this.extractSequence(latest, rule);
      if (!Number.isNaN(parsed)) seq = parsed + 1;
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = this.formatNumber(rule, documentType, seq + attempt);
      const exists = await this.numberExists(db, candidate, documentType);
      if (!exists) return candidate;
    }

    throw new BadRequestException('Unable to generate a unique document number');
  }

  async listRules(tenantId: string) {
    const rules = await this.prisma.documentNumberingRule.findMany({
      where: { tenantId },
      orderBy: { documentType: 'asc' },
    });

    if (!rules.length) {
      return DEFAULT_NUMBERING_RULES.map((r) => ({
        ...r,
        separator: '-',
        suffix: null,
      }));
    }

    return rules;
  }

  async updateRule(
    tenantId: string,
    documentType: NumberingDocumentType,
    data: Partial<NumberingRule>,
  ) {
    return this.prisma.documentNumberingRule.upsert({
      where: {
        tenantId_documentType: { tenantId, documentType: documentType as any },
      },
      create: {
        tenantId,
        documentType: documentType as any,
        prefix: data.prefix ?? 'DOC',
        suffix: data.suffix,
        separator: data.separator ?? '-',
        draftMarker: data.draftMarker,
        includeYear: data.includeYear ?? true,
        counterLength: data.counterLength ?? 6,
        annualReset: data.annualReset ?? true,
      },
      update: data,
    });
  }

  private async getRule(
    tenantId: string,
    documentType: NumberingDocumentType,
    db: Prisma.TransactionClient | PrismaService,
  ): Promise<NumberingRule> {
    const stored = await db.documentNumberingRule.findUnique({
      where: {
        tenantId_documentType: { tenantId, documentType: documentType as any },
      },
    });

    if (stored) return stored;

    const fallback = DEFAULT_NUMBERING_RULES.find(
      (r) => r.documentType === documentType,
    );
    if (!fallback) {
      throw new BadRequestException(`Unknown document type: ${documentType}`);
    }

    return { ...fallback, separator: '-', suffix: null };
  }

  private buildSearchPrefix(
    rule: NumberingRule,
    documentType: NumberingDocumentType,
  ): string {
    const sep = rule.separator;
    const parts = [rule.prefix];

    const isDraft =
      documentType === NumberingDocumentType.ORDER_DRAFT ||
      documentType === NumberingDocumentType.INVOICE_DRAFT;

    if (isDraft && rule.draftMarker) {
      parts.push(rule.draftMarker);
    } else if (rule.includeYear && rule.annualReset) {
      parts.push(String(new Date().getFullYear()));
    }

    let prefix = parts.join(sep);
    if (rule.suffix) prefix += sep + rule.suffix;
    return prefix + sep;
  }

  private formatNumber(
    rule: NumberingRule,
    documentType: NumberingDocumentType,
    seq: number,
  ): string {
    const sep = rule.separator;
    const parts = [rule.prefix];

    const isDraft =
      documentType === NumberingDocumentType.ORDER_DRAFT ||
      documentType === NumberingDocumentType.INVOICE_DRAFT;

    if (isDraft && rule.draftMarker) {
      parts.push(rule.draftMarker);
    } else if (rule.includeYear) {
      parts.push(String(new Date().getFullYear()));
    }

    if (rule.suffix) parts.push(rule.suffix);

    parts.push(String(seq).padStart(rule.counterLength, '0'));
    return parts.join(sep);
  }

  private extractSequence(number: string, rule: NumberingRule): number {
    const parts = number.split(rule.separator);
    return Number.parseInt(parts[parts.length - 1] ?? '', 10);
  }

  private async findLatestNumber(
    db: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    documentType: NumberingDocumentType,
    prefix: string,
  ): Promise<string | null> {
    switch (documentType) {
      case NumberingDocumentType.QUOTATION:
        return (
          await db.quotation.findFirst({
            where: { tenantId, number: { startsWith: prefix } },
            orderBy: { number: 'desc' },
            select: { number: true },
          })
        )?.number ?? null;
      case NumberingDocumentType.ORDER_DRAFT:
      case NumberingDocumentType.ORDER_ISSUED:
        return (
          await db.order.findFirst({
            where: { tenantId, number: { startsWith: prefix } },
            orderBy: { number: 'desc' },
            select: { number: true },
          })
        )?.number ?? null;
      case NumberingDocumentType.INVOICE_DRAFT:
      case NumberingDocumentType.INVOICE_ISSUED:
        return (
          await db.invoice.findFirst({
            where: { tenantId, number: { startsWith: prefix } },
            orderBy: { number: 'desc' },
            select: { number: true },
          })
        )?.number ?? null;
      case NumberingDocumentType.CLIENT:
        return (
          await db.client.findFirst({
            where: { tenantId, code: { startsWith: prefix } },
            orderBy: { code: 'desc' },
            select: { code: true },
          })
        )?.code ?? null;
      case NumberingDocumentType.CATALOG_ITEM:
        return (
          await db.catalogItem.findFirst({
            where: { tenantId, reference: { startsWith: prefix } },
            orderBy: { reference: 'desc' },
            select: { reference: true },
          })
        )?.reference ?? null;
      default:
        return null;
    }
  }

  private async numberExists(
    db: Prisma.TransactionClient | PrismaService,
    number: string,
    documentType: NumberingDocumentType,
  ): Promise<boolean> {
    switch (documentType) {
      case NumberingDocumentType.QUOTATION:
        return !!(await db.quotation.findUnique({
          where: { number },
          select: { id: true },
        }));
      case NumberingDocumentType.ORDER_DRAFT:
      case NumberingDocumentType.ORDER_ISSUED:
        return !!(await db.order.findUnique({
          where: { number },
          select: { id: true },
        }));
      case NumberingDocumentType.INVOICE_DRAFT:
      case NumberingDocumentType.INVOICE_ISSUED:
        return !!(await db.invoice.findUnique({
          where: { number },
          select: { id: true },
        }));
      case NumberingDocumentType.CLIENT:
        return !!(await db.client.findFirst({
          where: { code: number },
          select: { id: true },
        }));
      case NumberingDocumentType.CATALOG_ITEM:
        return !!(await db.catalogItem.findUnique({
          where: { reference: number },
          select: { id: true },
        }));
      default:
        return false;
    }
  }
}
