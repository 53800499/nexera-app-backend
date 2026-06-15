/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { PaymentMethod } from '../enums/payment-method.enum';

export class PaymentEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly clientId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly paymentMethod: PaymentMethod,
    public readonly isCancelled: boolean,
  ) {}

  static fromPrisma(payment: any): PaymentEntity {
    return new PaymentEntity(
      payment.id,
      payment.tenantId,
      payment.clientId,
      payment.amount,
      payment.currency,
      payment.paymentMethod as PaymentMethod,
      payment.isCancelled,
    );
  }

  toResponse() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      clientId: this.clientId,
      amount: this.amount,
      currency: this.currency,
      paymentMethod: this.paymentMethod,
      isCancelled: this.isCancelled,
    };
  }
}
