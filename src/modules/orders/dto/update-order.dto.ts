import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';

/** clientId et quotationId non modifiables après création. */
export class UpdateOrderDto extends PartialType(
  OmitType(CreateOrderDto, ['clientId', 'quotationId'] as const),
) {}
