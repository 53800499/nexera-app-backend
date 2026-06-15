import { computeAgedBalance } from './aged-balance.util';

describe('aged-balance.util', () => {
  const ref = new Date('2026-06-15');

  it('segments unpaid amounts by aging bucket', () => {
    const buckets = computeAgedBalance(
      [
        { amountDue: 100, dueDate: new Date('2026-06-10') },
        { amountDue: 200, dueDate: new Date('2026-05-01') },
        { amountDue: 300, dueDate: new Date('2026-01-01') },
      ],
      ref,
    );

    expect(buckets.find((b) => b.label === '0-30j')?.amountTtc).toBe(100);
    expect(buckets.find((b) => b.label === '31-60j')?.amountTtc).toBe(200);
    expect(buckets.find((b) => b.label === '+90j')?.amountTtc).toBe(300);
  });
});
