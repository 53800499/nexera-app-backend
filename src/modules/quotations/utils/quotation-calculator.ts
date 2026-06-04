export interface QuotationLineInput {
  quantity: number;
  unitPriceHt: number;
  discountPct?: number;
  discountAmount?: number;
  taxRate: number;
}

export interface ComputedQuotationLine {
  lineTotalHt: number;
  taxAmount: number;
  lineTotalTtc: number;
}

export interface QuotationTotals {
  subtotalHt: number;
  discountPct: number;
  discountAmount: number;
  baseHt: number;
  totalTax: number;
  totalTtc: number;
}

/** Arrondi au centime inférieur (RM-D02). */
export function roundDownCent(value: number): number {
  return Math.floor(value * 100 + 1e-9) / 100;
}

export function computeLine(line: QuotationLineInput): ComputedQuotationLine {
  const grossHt = line.quantity * line.unitPriceHt;
  const lineDiscount =
    (line.discountAmount ?? 0) > 0
      ? line.discountAmount!
      : grossHt * ((line.discountPct ?? 0) / 100);

  const lineTotalHt = roundDownCent(Math.max(0, grossHt - lineDiscount));
  const taxAmount = roundDownCent(lineTotalHt * (line.taxRate / 100));
  const lineTotalTtc = roundDownCent(lineTotalHt + taxAmount);

  return { lineTotalHt, taxAmount, lineTotalTtc };
}

export function computeTotals(
  lines: ComputedQuotationLine[],
  globalDiscountPct = 0,
  globalDiscountAmount = 0,
): QuotationTotals {
  const subtotalHt = roundDownCent(
    lines.reduce((sum, line) => sum + line.lineTotalHt, 0),
  );

  const globalDiscount =
    globalDiscountAmount > 0
      ? globalDiscountAmount
      : roundDownCent(subtotalHt * (globalDiscountPct / 100));

  const baseHt = roundDownCent(Math.max(0, subtotalHt - globalDiscount));
  const rawTax = roundDownCent(
    lines.reduce((sum, line) => sum + line.taxAmount, 0),
  );

  const totalTax =
    subtotalHt > 0
      ? roundDownCent(rawTax * (baseHt / subtotalHt))
      : 0;

  const totalTtc = roundDownCent(baseHt + totalTax);

  return {
    subtotalHt,
    discountPct: globalDiscountPct,
    discountAmount: globalDiscount > 0 ? globalDiscount : globalDiscountAmount,
    baseHt,
    totalTax,
    totalTtc,
  };
}
