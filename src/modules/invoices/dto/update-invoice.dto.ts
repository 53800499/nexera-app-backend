import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateInvoiceDto } from './create-invoice.dto';

/** Facture ISSUED+ non modifiable (RM-F02). clientId / orderId / quotationId figés. */
export class UpdateInvoiceDto extends PartialType(
  OmitType(CreateInvoiceDto, ['clientId', 'orderId', 'quotationId'] as const),
) {}
