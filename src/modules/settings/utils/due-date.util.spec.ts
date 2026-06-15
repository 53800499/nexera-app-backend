import { computeDueDateFromPaymentTerm } from './due-date.util';

describe('due-date.util', () => {
  it('adds net days', () => {
    const due = computeDueDateFromPaymentTerm(new Date(2026, 0, 15), 30, false);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(1);
    expect(due.getDate()).toBe(14);
  });

  it('computes end of month', () => {
    const due = computeDueDateFromPaymentTerm(new Date(2026, 0, 15), 30, true);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(1);
    expect(due.getDate()).toBe(28);
  });
});
