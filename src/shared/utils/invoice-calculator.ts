import {
  ComputedDocumentLine,
  DocumentLineInput,
  DocumentTotals,
  computeDocumentFromInputs,
  computeDocumentFromLineNets,
  computeLineNet,
  roundCent,
  roundExchangeRate,
  computeAmountDue,
} from './document-calculator';

export {
  computeLineNet,
  roundCent,
  roundExchangeRate,
  computeAmountDue,
  computeDocumentFromInputs,
  computeDocumentFromLineNets,
};
export type {
  DocumentLineInput,
  ComputedDocumentLine,
  DocumentTotals,
};

export interface LineWithTaxRate {
  lineTotalHt: number;
  taxRate: number;
  taxAmount?: number;
  lineTotalTtc?: number;
}

/** §3.2 + §3.3 — TVA agrégée par taux (factures, devis, BC). */
export function computeTotalsByTaxRate(
  lines: LineWithTaxRate[],
  globalDiscountPct = 0,
  globalDiscountAmount = 0,
): DocumentTotals {
  const lineNets = lines.map((line) => ({
    grossHt: line.lineTotalHt,
    lineDiscount: 0,
    lineTotalHt: line.lineTotalHt,
    taxRate: line.taxRate,
  }));

  return computeDocumentFromLineNets(
    lineNets,
    globalDiscountPct,
    globalDiscountAmount,
  ).totals;
}

export function computeLinesFromInput(
  inputs: DocumentLineInput[],
): Array<LineWithTaxRate & ComputedDocumentLine> {
  const { lines } = computeDocumentFromInputs(inputs);
  return lines.map((line) => ({ ...line }));
}

export function computeInvoiceTotals(
  lines: LineWithTaxRate[],
  globalDiscountPct = 0,
  globalDiscountAmount = 0,
): DocumentTotals {
  return computeTotalsByTaxRate(lines, globalDiscountPct, globalDiscountAmount);
}

/** Compatibilité — alias de roundCent */
export const roundDownCent = roundCent;

export function computeLine(input: DocumentLineInput) {
  const { lines } = computeDocumentFromInputs([input]);
  const line = lines[0];
  return {
    lineTotalHt: line.lineTotalHt,
    taxAmount: line.taxAmount,
    lineTotalTtc: line.lineTotalTtc,
  };
}
