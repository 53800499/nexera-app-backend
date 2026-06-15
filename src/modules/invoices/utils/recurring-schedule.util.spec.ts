import {
  computeNextExecution,
  isInGenerationWindow,
  shouldAdvanceCycle,
  RECURRING_GENERATION_LEAD_DAYS,
} from './recurring-schedule.util';
import { RecurringFrequency } from '../enums/recurring-frequency.enum';

describe('recurring-schedule.util', () => {
  it('computes next monthly execution', () => {
    const next = computeNextExecution(
      RecurringFrequency.MONTHLY,
      new Date('2026-06-01'),
    );
    expect(next.toISOString().slice(0, 10)).toBe('2026-07-01');
  });

  it('opens generation window J-7 before execution', () => {
    const nextExecution = new Date('2026-07-01');
    const j7 = new Date('2026-06-24');
    expect(isInGenerationWindow(nextExecution, j7)).toBe(true);
    expect(isInGenerationWindow(nextExecution, new Date('2026-06-23'))).toBe(
      false,
    );
    expect(isInGenerationWindow(nextExecution, new Date('2026-07-01'))).toBe(
      false,
    );
  });

  it('advances cycle after execution day', () => {
    expect(
      shouldAdvanceCycle(new Date('2026-07-01'), new Date('2026-07-02')),
    ).toBe(true);
    expect(
      shouldAdvanceCycle(new Date('2026-07-01'), new Date('2026-07-01')),
    ).toBe(false);
  });

  it('uses 7-day lead constant', () => {
    expect(RECURRING_GENERATION_LEAD_DAYS).toBe(7);
  });
});
