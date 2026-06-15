import { ReminderLevel } from '../enums/reminder-level.enum';

export interface ReminderLevelConfig {
  level1DaysAfterDue: number;
  level2DaysAfterDue: number;
  level3DaysAfterDue: number;
}

export function daysPastDue(dueDate: Date, reference = new Date()): number {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const ref = new Date(reference);
  ref.setHours(0, 0, 0, 0);
  return Math.floor((ref.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Retourne le plus bas niveau éligible non encore envoyé (escalade ordonnée).
 */
export function resolveNextReminderLevel(
  daysOverdue: number,
  config: ReminderLevelConfig,
  sentLevels: number[],
): ReminderLevel | null {
  const levels: Array<{ level: ReminderLevel; minDays: number }> = [
    { level: ReminderLevel.LEVEL_1, minDays: config.level1DaysAfterDue },
    { level: ReminderLevel.LEVEL_2, minDays: config.level2DaysAfterDue },
    { level: ReminderLevel.LEVEL_3, minDays: config.level3DaysAfterDue },
  ];

  for (const entry of levels) {
    if (daysOverdue >= entry.minDays && !sentLevels.includes(entry.level)) {
      return entry.level;
    }
  }

  return null;
}
