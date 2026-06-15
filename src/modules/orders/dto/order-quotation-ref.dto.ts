import { ApiProperty } from '@nestjs/swagger';

/** Référence devis source (RM-BC03). */
export class OrderQuotationRefDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'DEV-2026-000042' })
  number!: string;

  @ApiProperty({ example: 'converted' })
  status!: string;
}
