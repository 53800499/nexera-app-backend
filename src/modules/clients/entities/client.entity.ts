/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
export class ClientEntity {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly code: string,
    public readonly clientType: string,
    public readonly companyName: string,
    public readonly tradeName: string | null,
    public readonly isArchived: boolean,
    public readonly deletedAt: Date | null,
  ) {}

  static fromPrisma(client: any): ClientEntity {
    return new ClientEntity(
      client.id,
      client.tenantId,
      client.code,
      client.clientType,
      client.companyName,
      client.tradeName ?? null,
      client.isArchived ?? false,
      client.deletedAt ?? null,
    );
  }

  toResponse() {
    return {
      id: this.id,
      tenantId: this.tenantId,
      code: this.code,
      clientType: this.clientType,
      companyName: this.companyName,
      tradeName: this.tradeName,
      isArchived: this.isArchived,
      deletedAt: this.deletedAt,
    };
  }
}
