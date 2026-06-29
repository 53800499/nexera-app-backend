import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateCatalogPriceDto } from './create-catalog-price.dto';

export class UpdateCatalogPriceDto extends PartialType(
  OmitType(CreateCatalogPriceDto, ['clientId', 'groupName'] as const),
) {}
