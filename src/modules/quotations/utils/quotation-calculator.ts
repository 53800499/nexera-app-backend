import {
  ComputedDocumentLine,
  DocumentLineInput,
  DocumentTotals,
  computeAmountDue,
  computeDocumentFromInputs,
  computeDocumentFromLineNets,
  computeLineNet,
  roundCent,
  roundExchangeRate,
} from '../../../shared/utils/document-calculator';

export type QuotationLineInput = DocumentLineInput;

export interface ComputedQuotationLine {
  lineTotalHt: number;
  taxAmount: number;
  lineTotalTtc: number;
}

export type QuotationTotals = DocumentTotals;

/** @deprecated Utiliser roundCent — conservé pour compatibilité imports existants */
export const roundDownCent = roundCent;

export function computeLine(line: QuotationLineInput): ComputedQuotationLine {
  const { lines } = computeDocumentFromInputs([line]);
  const computed = lines[0];
  return {
    lineTotalHt: computed.lineTotalHt,
    taxAmount: computed.taxAmount,
    lineTotalTtc: computed.lineTotalTtc,
  };
}

export interface LineWithTaxRate extends ComputedQuotationLine {
  taxRate: number;
}

export function computeTotals(
  lines: Array<ComputedQuotationLine & { taxRate: number }>,
  globalDiscountPct = 0,
  globalDiscountAmount = 0,
): QuotationTotals {
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

export function computeDocument(
  inputs: DocumentLineInput[],
  globalDiscountPct = 0,
  globalDiscountAmount = 0,
): { lines: ComputedDocumentLine[]; totals: DocumentTotals } {
  return computeDocumentFromInputs(inputs, globalDiscountPct, globalDiscountAmount);
}

export { computeLineNet, roundCent, roundExchangeRate, computeAmountDue };
