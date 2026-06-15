import { PaymentEntity } from '../entities/payment.entity';

export const PAYMENT_CANCELLED = 'payment.cancelled' as const;

export class PaymentCancelledEvent {
  readonly eventName = PAYMENT_CANCELLED;

  constructor(
    public readonly payment: PaymentEntity,
    public readonly reason: string,
  ) {}
}
