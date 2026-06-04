export class UserEntity {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly tenantId: string,
    public readonly isActive: boolean,
    public readonly isSuperAdmin: boolean,
    public readonly roles: string[] = [],
    public readonly permissions: string[] = [],
  ) {}

  static fromPrisma(user: any): UserEntity {
    const roles = user.roles?.map((ur: any) => ur.role?.code ?? '') ?? [];
    const permissions =
      user.roles?.flatMap((ur: any) =>
        ur.role?.permissions?.map((rp: any) => rp.permission?.code ?? '') ?? [],
      ) ?? [];

    return new UserEntity(
      user.id,
      user.email,
      user.firstName,
      user.lastName,
      user.tenantId,
      user.isActive,
      user.isSuperAdmin ?? false,
      roles,
      permissions,
    );
  }

  toResponse() {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      tenantId: this.tenantId,
      isActive: this.isActive,
      isSuperAdmin: this.isSuperAdmin,
      roles: this.roles,
      permissions: this.permissions,
    };
  }
}
