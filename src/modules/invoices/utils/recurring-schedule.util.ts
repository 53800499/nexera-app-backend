import { RecurringFrequency } from '../enums/recurring-frequency.enum';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const RECURRING_GENERATION_LEAD_DAYS = 7;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  return new Date(startOfDay(date).getTime() + days * MS_PER_DAY);
}

export function computeNextExecution(
  frequency: RecurringFrequency | string,
  from: Date,
): Date {
  const base = startOfDay(from);
  const next = new Date(base);

  switch (frequency) {
    case RecurringFrequency.MONTHLY:
      next.setUTCMonth(next.getUTCMonth() + 1);
      break;
    case RecurringFrequency.QUARTERLY:
      next.setUTCMonth(next.getUTCMonth() + 3);
      break;
    case RecurringFrequency.YEARLY:
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      break;
    default:
      throw new Error(`Unsupported frequency: ${frequency}`);
  }

  return startOfDay(next);
}

/** Fenêtre J-7 : génération du brouillon autorisée. */
export function isInGenerationWindow(
  nextExecution: Date,
  now: Date = new Date(),
): boolean {
  const exec = startOfDay(nextExecution).getTime();
  const today = startOfDay(now).getTime();
  const windowStart = exec - RECURRING_GENERATION_LEAD_DAYS * MS_PER_DAY;
  return today >= windowStart && today < exec;
}

export function shouldAdvanceCycle(
  nextExecution: Date,
  now: Date = new Date(),
): boolean {
  return startOfDay(now).getTime() > startOfDay(nextExecution).getTime();
}

export function sameCalendarDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}
