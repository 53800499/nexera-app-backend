import { roundDownCent } from '../../../shared/utils/invoice-calculator';

export interface AllocatableInvoice {
  id: string;
  amountDue: number;
  currency: string;
  exchangeRate: number;
  issueDate: Date;
}

export interface PaymentAllocation {
  invoiceId: string;
  amount: number;
}

/**
 * RM-E02 — Imputation FIFO : factures les plus anciennes en premier.
 */
export function computeFifoAllocations(
  paymentAmount: number,
  invoices: AllocatableInvoice[],
  paymentCurrency: string,
  paymentExchangeRate: number,
): PaymentAllocation[] {
  const sorted = [...invoices].sort(
    (a, b) => a.issueDate.getTime() - b.issueDate.getTime(),
  );

  let remaining = paymentAmount;
  const allocations: PaymentAllocation[] = [];

  for (const invoice of sorted) {
    if (remaining <= 0.01) break;
    if (invoice.amountDue <= 0.01) continue;

    const invoiceDueInPaymentCurrency = convertBetweenCurrencies(
      invoice.amountDue,
      invoice.currency,
      invoice.exchangeRate,
      paymentCurrency,
      paymentExchangeRate,
    );

    const payInPaymentCurrency = roundDownCent(
      Math.min(remaining, invoiceDueInPaymentCurrency),
    );
    if (payInPaymentCurrency <= 0.01) continue;

    const imputeOnInvoice = convertBetweenCurrencies(
      payInPaymentCurrency,
      paymentCurrency,
      paymentExchangeRate,
      invoice.currency,
      invoice.exchangeRate,
    );

    const amount = roundDownCent(Math.min(imputeOnInvoice, invoice.amountDue));
    if (amount <= 0.01) continue;

    allocations.push({ invoiceId: invoice.id, amount });
    remaining = roundDownCent(remaining - payInPaymentCurrency);
  }

  return allocations;
}

export function convertBetweenCurrencies(
  amount: number,
  fromCurrency: string,
  fromExchangeRate: number,
  toCurrency: string,
  toExchangeRate: number,
): number {
  if (fromCurrency === toCurrency) {
    return roundDownCent(amount);
  }

  const inBase = amount / fromExchangeRate;
  return roundDownCent(inBase * toExchangeRate);
}

export function computeExchangeGainLoss(
  paymentAmount: number,
  paymentExchangeRate: number,
  allocatedInPaymentCurrency: number,
): number {
  const theoreticalBase = paymentAmount / paymentExchangeRate;
  const allocatedBase = allocatedInPaymentCurrency / paymentExchangeRate;
  return roundDownCent(theoreticalBase - allocatedBase);
}
