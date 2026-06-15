import { roundDownCent } from '../../../shared/utils/invoice-calculator';

export interface AgedBalanceBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  amountTtc: number;
  invoiceCount: number;
}

export interface AgedInvoice {
  amountDue: number;
  dueDate: Date | null;
}

function resolveBucketLabel(overdueDays: number): string {
  if (overdueDays <= 30) return '0-30j';
  if (overdueDays <= 60) return '31-60j';
  if (overdueDays <= 90) return '61-90j';
  return '+90j';
}

export function daysPastDue(dueDate: Date, reference = new Date()): number {
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const ref = new Date(reference);
  ref.setHours(0, 0, 0, 0);
  return Math.floor((ref.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

export function computeAgedBalance(
  invoices: AgedInvoice[],
  reference = new Date(),
): AgedBalanceBucket[] {
  const bucketMap = new Map<string, AgedBalanceBucket>([
    ['0-30j', { label: '0-30j', minDays: 0, maxDays: 30, amountTtc: 0, invoiceCount: 0 }],
    ['31-60j', { label: '31-60j', minDays: 31, maxDays: 60, amountTtc: 0, invoiceCount: 0 }],
    ['61-90j', { label: '61-90j', minDays: 61, maxDays: 90, amountTtc: 0, invoiceCount: 0 }],
    ['+90j', { label: '+90j', minDays: 91, maxDays: null, amountTtc: 0, invoiceCount: 0 }],
  ]);

  for (const invoice of invoices) {
    if (invoice.amountDue <= 0.01 || !invoice.dueDate) continue;

    const overdue = daysPastDue(invoice.dueDate, reference);
    const label = resolveBucketLabel(overdue);
    const bucket = bucketMap.get(label)!;

    bucket.amountTtc = roundDownCent(bucket.amountTtc + invoice.amountDue);
    bucket.invoiceCount += 1;
  }

  return Array.from(bucketMap.values());
}
