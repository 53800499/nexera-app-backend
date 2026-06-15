import {
  computeDocument,
  computeLine,
  computeTotals,
  roundDownCent,
} from './quotation-calculator';

describe('quotation-calculator', () => {
  describe('roundDownCent', () => {
    it('rounds half up to the nearest cent (alias of roundCent)', () => {
      expect(roundDownCent(10.995)).toBe(11);
      expect(roundDownCent(10.994)).toBe(10.99);
      expect(roundDownCent(10.99)).toBe(10.99);
    });
  });

  describe('computeLine', () => {
    it('computes HT, tax and TTC with percentage discount', () => {
      const line = computeLine({
        quantity: 2,
        unitPriceHt: 100,
        discountPct: 10,
        taxRate: 20,
      });

      expect(line.lineTotalHt).toBe(180);
      expect(line.taxAmount).toBe(36);
      expect(line.lineTotalTtc).toBe(216);
    });

    it('prefers amount discount over percentage', () => {
      const line = computeLine({
        quantity: 1,
        unitPriceHt: 200,
        discountPct: 50,
        discountAmount: 25,
        taxRate: 20,
      });

      expect(line.lineTotalHt).toBe(175);
      expect(line.taxAmount).toBe(35);
      expect(line.lineTotalTtc).toBe(210);
    });
  });

  describe('computeDocument', () => {
    it('aggregates VAT by tax rate across lines', () => {
      const { lines, totals } = computeDocument([
        { quantity: 3, unitPriceHt: 33.33, taxRate: 20 },
      ]);

      expect(lines[0].taxAmount).toBe(20);
      expect(totals.totalTax).toBe(20);
    });
  });

  describe('computeTotals', () => {
    it('applies global discount after line discounts', () => {
      const { lines } = computeDocument([
        { quantity: 1, unitPriceHt: 1000, taxRate: 20 },
        { quantity: 2, unitPriceHt: 200, discountPct: 10, taxRate: 10 },
      ]);

      const totals = computeTotals(lines, 5, 0);

      expect(totals.subtotalHt).toBe(1360);
      expect(totals.discountAmount).toBe(68);
      expect(totals.baseHt).toBe(1292);
      expect(totals.totalTax).toBe(224.2);
      expect(totals.totalTtc).toBe(1516.2);
    });

    it('supports global discount as fixed amount', () => {
      const { lines } = computeDocument([
        { quantity: 1, unitPriceHt: 500, taxRate: 20 },
      ]);
      const totals = computeTotals(lines, 0, 50);

      expect(totals.subtotalHt).toBe(500);
      expect(totals.baseHt).toBe(450);
      expect(totals.totalTax).toBe(90);
      expect(totals.totalTtc).toBe(540);
    });

    it('returns zero tax when subtotal is zero', () => {
      const totals = computeTotals([], 10, 0);
      expect(totals.subtotalHt).toBe(0);
      expect(totals.totalTax).toBe(0);
      expect(totals.totalTtc).toBe(0);
    });
  });
});
