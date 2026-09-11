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

export class CabinetDetailsSummaryDto {
  @ApiProperty({ example: 'Cabinet Martin & Associés' })
  raisonSociale!: string;

  @ApiPropertyOptional({ example: 'contact@cabinetmartin.fr' })
  email?: string | null;

  @ApiPropertyOptional({ example: '+33123456789' })
  telephone?: string | null;

  @ApiPropertyOptional({ example: '12 rue de la Paix, 75002 Paris' })
  adresse?: string | null;

  @ApiPropertyOptional({ example: 'OEC-75-98765' })
  numeroInscriptionOrdre?: string | null;

  @ApiPropertyOptional({ example: 'BJ' })
  paysCode?: string | null;

  @ApiPropertyOptional({ example: '12345678900012' })
  siret?: string | null;
}

export class AuthorizedCabinetDto extends CabinetTenantSummaryDto {
  @ApiProperty({
    description: "Date d'autorisation accordée par l'entreprise",
    example: '2026-06-12T10:00:00.000Z',
  })
  linkedAt!: Date;

  @ApiProperty({
    description: 'Permissions accordées au cabinet',
    example: ['cabinet.scope.invoices.read', 'cabinet.scope.payments.read'],
  })
  permissions!: string[];

  @ApiPropertyOptional({ type: CabinetDetailsSummaryDto })
  details?: CabinetDetailsSummaryDto;
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

export class CabinetCompanyPaymentClientDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Client Dupont SAS' })
  companyName!: string;
}

export class CabinetCompanyPaymentImputationInvoiceDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'FAC-2026-000042' })
  number!: string;
}

export class CabinetCompanyPaymentImputationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 450.5 })
  amount!: number;

  @ApiProperty({ type: CabinetCompanyPaymentImputationInvoiceDto })
  invoice!: CabinetCompanyPaymentImputationInvoiceDto;
}

export class CabinetCompanyPaymentDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ example: 'VIR-2026-001' })
  reference?: string | null;

  @ApiProperty()
  paymentDate!: Date;

  @ApiProperty({ example: 1200 })
  amount!: number;

  @ApiProperty({ example: 'EUR' })
  currency!: string;

  @ApiProperty({ example: 'wire' })
  paymentMethod!: string;

  @ApiProperty({ example: false })
  isCancelled!: boolean;

  @ApiProperty({ example: 0 })
  unallocatedAmount!: number;

  @ApiProperty({ type: CabinetCompanyPaymentClientDto })
  client!: CabinetCompanyPaymentClientDto;

  @ApiProperty({ type: [CabinetCompanyPaymentImputationDto] })
  imputations!: CabinetCompanyPaymentImputationDto[];
}

export class CabinetCompanyPaymentsPageDto {
  @ApiProperty({ type: [CabinetCompanyPaymentDto] })
  items!: CabinetCompanyPaymentDto[];

  @ApiProperty({ example: 25 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 50 })
  limit!: number;
}

export class CabinetCompanyClientContactDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Jean' })
  firstName!: string;

  @ApiProperty({ example: 'Dupont' })
  lastName!: string;

  @ApiPropertyOptional({ example: 'jean.dupont@example.com' })
  email?: string | null;

  @ApiPropertyOptional({ example: '+33612345678' })
  phone?: string | null;

  @ApiPropertyOptional({ example: true })
  isPrimary?: boolean;
}

export class CabinetCompanyClientCountsDto {
  @ApiProperty({ example: 5 })
  invoices!: number;

  @ApiProperty({ example: 3 })
  payments!: number;
}

export class CabinetCompanyClientDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'CLI-00042' })
  code!: string;

  @ApiProperty({ example: 'Client Dupont SAS' })
  companyName!: string;

  @ApiPropertyOptional({ example: 'Dupont Distribution' })
  tradeName?: string | null;

  @ApiProperty({ example: 'company' })
  clientType!: string;

  @ApiPropertyOptional({ example: '12345678900012' })
  siret?: string | null;

  @ApiPropertyOptional({ example: 'FR12345678901' })
  taxId?: string | null;

  @ApiProperty({ example: 'EUR' })
  defaultCurrency!: string;

  @ApiProperty({ example: false })
  isArchived!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: [CabinetCompanyClientContactDto] })
  contacts!: CabinetCompanyClientContactDto[];

  @ApiProperty({ type: CabinetCompanyClientCountsDto })
  _count!: CabinetCompanyClientCountsDto;
}

export class CabinetCompanyClientsPageDto {
  @ApiProperty({ type: [CabinetCompanyClientDto] })
  items!: CabinetCompanyClientDto[];

  @ApiProperty({ example: 15 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 50 })
  limit!: number;
}

