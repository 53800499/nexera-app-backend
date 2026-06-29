import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CabinetTenantSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Cabinet Martin & Associés' })
  name!: string;

  @ApiProperty({ enum: ['company', 'cabinet'], example: 'cabinet' })
  type!: string;
}

export class CompanyTenantSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Acme SARL' })
  name!: string;

  @ApiProperty({ enum: ['company', 'cabinet'], example: 'company' })
  type!: string;
}

export class AuthorizedCabinetDto extends CabinetTenantSummaryDto {
  @ApiProperty({
    description: "Date d'autorisation accordée par l'entreprise",
    example: '2026-06-12T10:00:00.000Z',
  })
  linkedAt!: Date;
}

export class CabinetAccessLinkDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  cabinetTenantId!: string;

  @ApiProperty({ format: 'uuid' })
  companyTenantId!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class CabinetAccessMessageDto {
  @ApiProperty({ example: "L'accès du cabinet a été révoqué." })
  message!: string;

  @ApiProperty({ format: 'uuid' })
  cabinetTenantId!: string;

  @ApiProperty({ format: 'uuid' })
  companyTenantId!: string;
}

export class CabinetCompanyInvoiceClientDto {
  @ApiProperty({ example: 'Client Dupont SAS' })
  companyName!: string;
}

export class CabinetCompanyInvoiceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'FAC-2026-000042' })
  number!: string;

  @ApiProperty({ example: 'issued' })
  status!: string;

  @ApiProperty()
  issueDate!: Date;

  @ApiPropertyOptional()
  dueDate?: Date | null;

  @ApiProperty({ example: 1200 })
  totalTtc!: number;

  @ApiProperty({ type: CabinetCompanyInvoiceClientDto })
  client!: CabinetCompanyInvoiceClientDto;
}

export class CabinetCompanyInvoicesPageDto {
  @ApiProperty({ type: [CabinetCompanyInvoiceDto] })
  items!: CabinetCompanyInvoiceDto[];

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 50 })
  limit!: number;
}
