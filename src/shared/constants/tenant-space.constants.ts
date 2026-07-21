import { TenantType } from '@prisma/client';

export interface PermissionDefinition {
  code: string;
  description: string;
}

export interface RoleDefinition {
  code: string;
  name: string;
  description: string;
}

const SHARED_ADMIN_PERMISSIONS: PermissionDefinition[] = [
  { code: 'users.read', description: 'View users' },
  { code: 'users.write', description: 'Manage users' },
  { code: 'roles.read', description: 'View roles' },
  { code: 'roles.write', description: 'Manage roles' },
  { code: 'permissions.read', description: 'View permissions' },
  { code: 'permissions.write', description: 'Manage permissions' },
  { code: 'manage:users', description: 'Manage users (API guard)' },
  { code: 'manage:roles', description: 'Manage roles (API guard)' },
  { code: 'manage:permissions', description: 'Manage permissions (API guard)' },
  { code: 'settings.read', description: 'View tenant settings' },
  { code: 'manage:settings', description: 'Manage tenant settings (API guard)' },
  { code: 'sync.read', description: 'Pull offline data (bootstrap + delta)' },
  { code: 'sync.push', description: 'Push offline mutations to server' },
];

const COMPANY_CRM_PERMISSIONS: PermissionDefinition[] = [
  { code: 'clients.read', description: 'View clients' },
  { code: 'clients.write', description: 'Manage clients' },
  { code: 'manage:clients', description: 'Manage clients (API guard)' },
  { code: 'catalogue.read', description: 'View catalogue' },
  { code: 'manage:catalogue', description: 'Manage catalogue (API guard)' },
  { code: 'stock.read', description: 'View stock' },
  { code: 'manage:stock', description: 'Manage stock (API guard)' },
  { code: 'quotations.read', description: 'View quotations' },
  { code: 'quotations.write', description: 'Manage quotations' },
  { code: 'manage:quotations', description: 'Manage quotations (API guard)' },
  { code: 'orders.read', description: 'View orders' },
  { code: 'orders.write', description: 'Manage orders' },
  { code: 'manage:orders', description: 'Manage orders (API guard)' },
  { code: 'invoices.read', description: 'View invoices' },
  { code: 'invoices.write', description: 'Manage invoices' },
  { code: 'manage:invoices', description: 'Manage invoices (API guard)' },
  { code: 'payments.read', description: 'View payments' },
  { code: 'payments.write', description: 'Manage payments' },
  { code: 'manage:payments', description: 'Manage payments (API guard)' },
  { code: 'reminders.read', description: 'View reminders' },
  { code: 'reminders.write', description: 'Manage reminders' },
  { code: 'manage:reminders', description: 'Manage reminders (API guard)' },
  { code: 'dashboard.read', description: 'View commercial dashboard' },
  { code: 'manage:tenants', description: 'Manage tenants (API guard)' },
];

const CABINET_SPACE_PERMISSIONS: PermissionDefinition[] = [
  {
    code: 'cabinet.read',
    description: 'Espace cabinet — consulter les entreprises liées',
  },
];

export const COMPANY_ROLES: RoleDefinition[] = [
  { code: 'ADMIN', name: 'Admin', description: 'Administrateur entreprise' },
  { code: 'CEO', name: 'CEO', description: 'Dirigeant / fondateur' },
];

export const CABINET_ROLES: RoleDefinition[] = [
  {
    code: 'CABINET_ADMIN',
    name: 'Administrateur cabinet',
    description: 'Gestion du cabinet et des accès',
  },
  {
    code: 'COLLABORATOR',
    name: 'Collaborateur',
    description: 'Consultation des dossiers clients autorisés',
  },
];

const COLLABORATOR_PERMISSION_CODES = [
  'cabinet.read',
  'sync.read',
  'settings.read',
];

export function getPermissionsForTenantType(
  type: TenantType,
): PermissionDefinition[] {
  const shared = [...SHARED_ADMIN_PERMISSIONS];
  if (type === TenantType.cabinet) {
    return [...shared, ...CABINET_SPACE_PERMISSIONS];
  }
  return [...shared, ...COMPANY_CRM_PERMISSIONS];
}

export function getRolesForTenantType(type: TenantType): RoleDefinition[] {
  return type === TenantType.cabinet ? CABINET_ROLES : COMPANY_ROLES;
}

export function getPermissionCodesForRole(
  roleCode: string,
  tenantType: TenantType,
): string[] {
  if (roleCode === 'COLLABORATOR') {
    return COLLABORATOR_PERMISSION_CODES;
  }

  return getPermissionsForTenantType(tenantType).map((p) => p.code);
}

export function getAllPlatformPermissions(): PermissionDefinition[] {
  const byCode = new Map<string, PermissionDefinition>();
  for (const p of [
    ...SHARED_ADMIN_PERMISSIONS,
    ...COMPANY_CRM_PERMISSIONS,
    ...CABINET_SPACE_PERMISSIONS,
  ]) {
    byCode.set(p.code, p);
  }
  return [...byCode.values()];
}
