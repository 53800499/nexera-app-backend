import { PaymentEntity } from '../entities/payment.entity';
import { PaymentAllocation } from '../utils/payment-allocation.util';

export const PAYMENT_RECORDED = 'payment.recorded' as const;

export class PaymentRecordedEvent {
  readonly eventName = PAYMENT_RECORDED;

  constructor(
    public readonly payment: PaymentEntity,
    public readonly allocations: PaymentAllocation[],
    public readonly advanceAmount: number,
  ) {}
}
