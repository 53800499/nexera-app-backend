/**
 * Règles de calcul document — §3.1 à §3.3
 * - Intermédiaires : 6 décimales
 * - Final : centime, demi-supérieur (round half up)
 * - TVA : calculée et arrondie par taux, jamais par ligne
 */

export const INTERMEDIATE_DECIMALS = 6;

export interface DocumentLineInput {
  quantity: number;
  unitPriceHt: number;
  discountPct?: number;
  discountAmount?: number;
  taxRate: number;
}

export interface ComputedLineNet {
  grossHt: number;
  lineDiscount: number;
  lineTotalHt: number;
  taxRate: number;
}

export interface ComputedDocumentLine extends ComputedLineNet {
  taxAmount: number;
  lineTotalTtc: number;
}

export interface DocumentTotals {
  subtotalHt: number;
  discountPct: number;
  discountAmount: number;
  baseHt: number;
  totalTax: number;
  totalTtc: number;
}

export interface ComputedDocument {
  lines: ComputedDocumentLine[];
  totals: DocumentTotals;
}

export function roundIntermediate(value: number): number {
  const factor = 10 ** INTERMEDIATE_DECIMALS;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Arrondi au centime — demi-supérieur (§3.3). */
export function roundCent(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Taux de change enregistré à 6 décimales (§3.3). */
export function roundExchangeRate(value: number): number {
  return roundIntermediate(value);
}

/** Reste à payer = total TTC − encaissements imputés (§3.2). */
export function computeAmountDue(
  totalTtc: number,
  amountPaid: number,
): number {
  return roundCent(Math.max(0, totalTtc - amountPaid));
}

/** §3.1 — Montant net HT ligne (TVA non arrondie ici). */
export function computeLineNet(input: DocumentLineInput): ComputedLineNet {
  const grossHt = roundIntermediate(input.quantity * input.unitPriceHt);
  const lineDiscount = roundIntermediate(
    (input.discountAmount ?? 0) > 0
      ? input.discountAmount!
      : grossHt * ((input.discountPct ?? 0) / 100),
  );
  const lineTotalHt = roundCent(Math.max(0, grossHt - lineDiscount));

  return {
    grossHt,
    lineDiscount,
    lineTotalHt,
    taxRate: input.taxRate,
  };
}

/** §3.2 + §3.3 — Totaux document avec TVA agrégée par taux. */
export function computeDocumentFromLineNets(
  lineNets: ComputedLineNet[],
  globalDiscountPct = 0,
  globalDiscountAmount = 0,
): ComputedDocument {
  const subtotalHt = roundCent(
    lineNets.reduce((sum, line) => sum + line.lineTotalHt, 0),
  );

  const globalDiscount = roundCent(
    globalDiscountAmount > 0
      ? globalDiscountAmount
      : roundIntermediate(subtotalHt * (globalDiscountPct / 100)),
  );

  const baseHt = roundCent(Math.max(0, subtotalHt - globalDiscount));

  const htByRate = new Map<number, number>();
  for (const line of lineNets) {
    htByRate.set(line.taxRate, (htByRate.get(line.taxRate) ?? 0) + line.lineTotalHt);
  }

  const taxByRate = new Map<number, number>();
  let totalTax = 0;
  for (const [rate, groupHt] of htByRate.entries()) {
    const share = subtotalHt > 0 ? groupHt / subtotalHt : 0;
    const groupBase = roundIntermediate(baseHt * share);
    const groupTax = roundCent(groupBase * (rate / 100));
    taxByRate.set(rate, groupTax);
    totalTax = roundCent(totalTax + groupTax);
  }

  const totalTtc = roundCent(baseHt + totalTax);
  const lines = allocateTaxToLines(lineNets, taxByRate, htByRate);

  return {
    lines,
    totals: {
      subtotalHt,
      discountPct: globalDiscountPct,
      discountAmount: globalDiscount > 0 ? globalDiscount : globalDiscountAmount,
      baseHt,
      totalTax,
      totalTtc,
    },
  };
}

export function computeDocumentFromInputs(
  inputs: DocumentLineInput[],
  globalDiscountPct = 0,
  globalDiscountAmount = 0,
): ComputedDocument {
  const lineNets = inputs.map(computeLineNet);
  return computeDocumentFromLineNets(
    lineNets,
    globalDiscountPct,
    globalDiscountAmount,
  );
}

function allocateTaxToLines(
  lineNets: ComputedLineNet[],
  taxByRate: Map<number, number>,
  htByRate: Map<number, number>,
): ComputedDocumentLine[] {
  const countByRate = new Map<number, number>();
  for (const line of lineNets) {
    countByRate.set(line.taxRate, (countByRate.get(line.taxRate) ?? 0) + 1);
  }

  const seenByRate = new Map<number, number>();
  const allocatedByRate = new Map<number, number>();

  return lineNets.map((line) => {
    const rate = line.taxRate;
    const groupTax = taxByRate.get(rate) ?? 0;
    const groupHt = htByRate.get(rate) ?? 0;
    const seen = (seenByRate.get(rate) ?? 0) + 1;
    seenByRate.set(rate, seen);
    const isLastInGroup = seen === (countByRate.get(rate) ?? 1);

    let taxAmount: number;
    if (isLastInGroup) {
      taxAmount = roundCent(groupTax - (allocatedByRate.get(rate) ?? 0));
    } else {
      taxAmount =
        groupHt > 0
          ? roundCent(groupTax * (line.lineTotalHt / groupHt))
          : 0;
      allocatedByRate.set(
        rate,
        roundCent((allocatedByRate.get(rate) ?? 0) + taxAmount),
      );
    }

    return {
      ...line,
      taxAmount,
      lineTotalTtc: roundCent(line.lineTotalHt + taxAmount),
    };
  });
}
