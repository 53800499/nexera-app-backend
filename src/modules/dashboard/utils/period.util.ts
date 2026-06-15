export interface DatePeriod {
  from: Date;
  to: Date;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function defaultMonthPeriod(reference = new Date()): DatePeriod {
  const from = startOfDay(
    new Date(reference.getFullYear(), reference.getMonth(), 1),
  );
  const to = endOfDay(
    new Date(reference.getFullYear(), reference.getMonth() + 1, 0),
  );
  return { from, to };
}

export function previousYearPeriod(period: DatePeriod): DatePeriod {
  const from = new Date(period.from);
  from.setFullYear(from.getFullYear() - 1);
  const to = new Date(period.to);
  to.setFullYear(to.getFullYear() - 1);
  return { from: startOfDay(from), to: endOfDay(to) };
}

export function computeVariationPercent(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : null;
  }
  return Math.round(((current - previous) / previous) * 10000) / 100;
}
