import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateStockItemDto } from './create-stock-item.dto';

export class UpdateStockItemDto extends PartialType(
  OmitType(CreateStockItemDto, ['commercialItemId'] as const),
) {}
