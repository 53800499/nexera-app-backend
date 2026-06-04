import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateClientDto } from './create-client.dto';

/** Le code client (CLT-XXXXXX) n'est pas modifiable — RM-C01 */
export class UpdateClientDto extends PartialType(
  OmitType(CreateClientDto, ['primaryContact', 'confirmDuplicate'] as const),
) {}
