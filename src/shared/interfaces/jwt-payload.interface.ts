export interface JwtPayload {
  sub: string;
  tenantId: string;
  tenantType: string;

  email: string;

  roles: string[];
  permissions: string[];
}
