export enum ReminderLevel {
  LEVEL_1 = 1,
  LEVEL_2 = 2,
  LEVEL_3 = 3,
}

export const REMINDER_LEVEL_LABELS: Record<ReminderLevel, string> = {
  [ReminderLevel.LEVEL_1]: 'Rappel',
  [ReminderLevel.LEVEL_2]: 'Relance',
  [ReminderLevel.LEVEL_3]: 'Mise en demeure',
};
