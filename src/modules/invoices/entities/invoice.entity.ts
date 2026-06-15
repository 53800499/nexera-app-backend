/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { InvoiceStatus } from '../enums/invoice-status.enum';
import { InvoiceType } from '../enums/invoice-type.enum';

export class InvoiceEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly number: string,
    public readonly clientId: string,
    public readonly status: InvoiceStatus,
    public readonly invoiceType: InvoiceType,
    public readonly totalTtc: number,
    public readonly amountDue: number,
  ) {}

  static fromPrisma(invoice: any): InvoiceEntity {
    return new InvoiceEntity(
      invoice.id,
      invoice.tenantId,
      invoice.number,
      invoice.clientId,
      invoice.status as InvoiceStatus,
      invoice.invoiceType as InvoiceType,
      invoice.totalTtc,
      invoice.amountDue,
    );
  }

  toResponse() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      number: this.number,
      clientId: this.clientId,
      status: this.status,
      invoiceType: this.invoiceType,
      totalTtc: this.totalTtc,
      amountDue: this.amountDue,
    };
  }
}
