import {
  daysPastDue,
  resolveNextReminderLevel,
} from './reminder-eligibility.util';
import { ReminderLevel } from '../enums/reminder-level.enum';

describe('reminder-eligibility.util', () => {
  const config = {
    level1DaysAfterDue: 3,
    level2DaysAfterDue: 15,
    level3DaysAfterDue: 30,
  };

  it('computes days past due', () => {
    const due = new Date('2026-06-01');
    const ref = new Date('2026-06-10');
    expect(daysPastDue(due, ref)).toBe(9);
  });

  it('returns level 1 when eligible and not yet sent', () => {
    expect(resolveNextReminderLevel(5, config, [])).toBe(ReminderLevel.LEVEL_1);
  });

  it('escalates to level 2 after level 1 sent', () => {
    expect(resolveNextReminderLevel(20, config, [1])).toBe(ReminderLevel.LEVEL_2);
  });

  it('returns null when all levels sent', () => {
    expect(resolveNextReminderLevel(40, config, [1, 2, 3])).toBeNull();
  });
});
