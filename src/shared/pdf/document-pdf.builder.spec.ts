import { buildTaxBreakdown } from './document-pdf.builder';
import {
  formatDateFr,
  formatMoney,
  lightenHex,
  normalizeHex,
  resolveBoldFont,
} from './document-pdf.utils';

describe('document-pdf.utils', () => {
  it('formats money in French locale', () => {
    const formatted = formatMoney(1234.5, 'EUR');
    expect(formatted).toContain('1');
    expect(formatted).toContain('€');
  });

  it('lightens hex colors', () => {
    expect(lightenHex('#2563eb')).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('normalizes short hex codes', () => {
    expect(normalizeHex('#abc')).toBe('#aabbcc');
  });

  it('resolves bold font variants', () => {
    expect(resolveBoldFont('Helvetica')).toBe('Helvetica-Bold');
    expect(resolveBoldFont('Times-Roman')).toBe('Times-Bold');
  });
});

describe('buildTaxBreakdown', () => {
  it('groups tax lines by rate', () => {
    const result = buildTaxBreakdown(
      [
        { lineTotalHt: 100, taxRate: 20, taxRateName: 'Normal' },
        { lineTotalHt: 50, taxRate: 10 },
      ],
      150,
    );
    expect(result).toHaveLength(2);
    expect(result[0].taxAmount + result[1].taxAmount).toBeGreaterThan(0);
  });
});

describe('formatDateFr', () => {
  it('formats dates in French', () => {
    expect(formatDateFr(new Date('2026-06-12'))).toContain('2026');
  });
});
