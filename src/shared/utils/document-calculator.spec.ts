import {
  computeAmountDue,
  computeDocumentFromInputs,
  computeLineNet,
  roundCent,
  roundExchangeRate,
  roundIntermediate,
} from './document-calculator';

describe('document-calculator', () => {
  describe('roundIntermediate', () => {
    it('keeps 6 decimal places', () => {
      expect(roundIntermediate(1.23456789)).toBe(1.234568);
    });
  });

  describe('roundCent', () => {
    it('rounds half up to the nearest cent', () => {
      expect(roundCent(10.995)).toBe(11);
      expect(roundCent(10.994)).toBe(10.99);
      expect(roundCent(10.99)).toBe(10.99);
    });
  });

  describe('roundExchangeRate', () => {
    it('stores exchange rate at 6 decimals', () => {
      expect(roundExchangeRate(1.23456789)).toBe(1.234568);
    });
  });

  describe('computeAmountDue', () => {
    it('returns total minus paid, floored at zero', () => {
      expect(computeAmountDue(100, 30)).toBe(70);
      expect(computeAmountDue(100, 120)).toBe(0);
    });
  });

  describe('computeLineNet', () => {
    it('computes net HT with percentage discount', () => {
      const line = computeLineNet({
        quantity: 2,
        unitPriceHt: 100,
        discountPct: 10,
        taxRate: 20,
      });

      expect(line.lineTotalHt).toBe(180);
    });

    it('prefers amount discount over percentage', () => {
      const line = computeLineNet({
        quantity: 1,
        unitPriceHt: 200,
        discountPct: 50,
        discountAmount: 25,
        taxRate: 20,
      });

      expect(line.lineTotalHt).toBe(175);
    });
  });

  describe('computeDocumentFromInputs', () => {
    it('aggregates VAT by rate (not per line)', () => {
      const { lines, totals } = computeDocumentFromInputs([
        { quantity: 1, unitPriceHt: 100, taxRate: 20 },
        { quantity: 1, unitPriceHt: 100, taxRate: 20 },
      ]);

      expect(totals.subtotalHt).toBe(200);
      expect(totals.totalTax).toBe(40);
      expect(totals.totalTtc).toBe(240);
      expect(lines[0].taxAmount + lines[1].taxAmount).toBe(40);
    });

    it('applies global discount before VAT allocation', () => {
      const { totals } = computeDocumentFromInputs(
        [
          { quantity: 1, unitPriceHt: 1000, taxRate: 20 },
          { quantity: 2, unitPriceHt: 200, discountPct: 10, taxRate: 10 },
        ],
        5,
        0,
      );

      expect(totals.subtotalHt).toBe(1360);
      expect(totals.discountAmount).toBe(68);
      expect(totals.baseHt).toBe(1292);
      expect(totals.totalTax).toBe(224.2);
      expect(totals.totalTtc).toBe(1516.2);
    });

    it('rounds single-rate VAT on group base (half up)', () => {
      const { lines } = computeDocumentFromInputs([
        { quantity: 3, unitPriceHt: 33.33, taxRate: 20 },
      ]);

      expect(lines[0].lineTotalHt).toBe(99.99);
      expect(lines[0].taxAmount).toBe(20);
      expect(lines[0].lineTotalTtc).toBe(119.99);
    });
  });
});
