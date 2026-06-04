/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { QuotationStatus } from '../enums/quotation-status.enum';

export class QuotationEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly number: string,
    public readonly clientId: string,
    public readonly status: QuotationStatus,
    public readonly totalTtc: number,
  ) {}

  static fromPrisma(quotation: any): QuotationEntity {
    return new QuotationEntity(
      quotation.id,
      quotation.tenantId,
      quotation.number,
      quotation.clientId,
      quotation.status as QuotationStatus,
      quotation.totalTtc,
    );
  }

  toResponse() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      number: this.number,
      clientId: this.clientId,
      status: this.status,
      totalTtc: this.totalTtc,
    };
  }
}
