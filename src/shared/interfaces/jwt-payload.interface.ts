export interface JwtPayload {
  sub: string;
  tenantId: string;
  tenantType: string;

  email: string;

  roles: string[];
  permissions: string[];
  isSuperAdmin?: boolean;
  isAssistanceSession?: boolean;
  ticketRef?: string;
  justification?: string;
}
