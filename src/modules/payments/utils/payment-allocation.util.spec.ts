import {
  computeFifoAllocations,
  convertBetweenCurrencies,
} from './payment-allocation.util';

describe('payment-allocation.util', () => {
  const invoices = [
    {
      id: 'inv-old',
      amountDue: 1000,
      currency: 'EUR',
      exchangeRate: 1,
      issueDate: new Date('2026-01-01'),
    },
    {
      id: 'inv-new',
      amountDue: 800,
      currency: 'EUR',
      exchangeRate: 1,
      issueDate: new Date('2026-02-01'),
    },
  ];

  it('allocates FIFO to oldest invoice first', () => {
    const allocations = computeFifoAllocations(1200, invoices, 'EUR', 1);

    expect(allocations).toEqual([
      { invoiceId: 'inv-old', amount: 1000 },
      { invoiceId: 'inv-new', amount: 200 },
    ]);
  });

  it('leaves surplus unallocated when payment exceeds open invoices', () => {
    const allocations = computeFifoAllocations(2500, invoices, 'EUR', 1);

    expect(allocations).toEqual([
      { invoiceId: 'inv-old', amount: 1000 },
      { invoiceId: 'inv-new', amount: 800 },
    ]);
  });

  it('converts between currencies using exchange rates', () => {
    const amount = convertBetweenCurrencies(100, 'USD', 1.1, 'EUR', 1);
    expect(amount).toBe(90.91);
  });
});
