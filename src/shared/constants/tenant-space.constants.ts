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

export const RH_PERMISSIONS: PermissionDefinition[] = [
  { code: 'rh.read', description: 'Consulter le module RH & Paie' },
  { code: 'rh.write', description: 'Gérer les données RH & Paie' },
  { code: 'manage:rh', description: 'Gérer le module RH (API guard)' },
  { code: 'rh.employees.read', description: 'Consulter le dossier des salariés' },
  { code: 'rh.employees.manage', description: 'Créer et modifier les salariés' },
  { code: 'rh.contracts.manage', description: 'Gérer les contrats et avenants' },
  { code: 'rh.leaves.request', description: 'Déposer une demande de congé' },
  { code: 'rh.leaves.validate', description: 'Valider les demandes de congé' },
  { code: 'rh.timesheets.manage', description: 'Saisir et valider les relevés d’heures' },
  { code: 'rh.payroll.calculate', description: 'Calculer les bulletins de paie' },
  { code: 'rh.payroll.validate', description: 'Valider et clôturer les cycles de paie' },
  { code: 'rh.declarations.manage', description: 'Gérer les déclarations fiscales et sociales' },
  { code: 'rh.accounting.export', description: 'Générer et exporter les OD de paie' },
];

export const NOTES_FRAIS_PERMISSIONS: PermissionDefinition[] = [
  { code: 'ndf.read', description: 'Consulter le module Notes de frais' },
  { code: 'ndf.write', description: 'Gérer les notes de frais et dépenses' },
  { code: 'manage:ndf', description: 'Administration Notes de frais (API guard)' },
  { code: 'ndf.expenses.submit', description: 'Saisir et soumettre ses propres notes de frais' },
  { code: 'ndf.reports.validate', description: 'Approuver ou rejeter les rapports de frais' },
  { code: 'ndf.advances.manage', description: 'Gérer les ordres de mission et avances' },
  { code: 'ndf.refund.manage', description: 'Déclencher et suivre les remboursements' },
  { code: 'ndf.cards.reconcile', description: 'Gérer les cartes affaires et le rapprochement' },
  { code: 'ndf.accounting.export', description: 'Transmettre les écritures vers la comptabilité' },
  { code: 'ndf.settings.manage', description: 'Configurer les politiques et barèmes de dépenses' },
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
  {
    code: 'RH_MANAGER',
    name: 'Responsable RH & Paie',
    description: 'Gestion complète des salariés, contrats, congés et paie',
  },
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

const RH_MANAGER_PERMISSION_CODES = [
  'dashboard.read',
  'settings.read',
  'sync.read',
  'rh.read',
  'rh.write',
  'manage:rh',
  'rh.employees.read',
  'rh.employees.manage',
  'rh.contracts.manage',
  'rh.leaves.request',
  'rh.leaves.validate',
  'rh.timesheets.manage',
  'rh.payroll.calculate',
  'rh.payroll.validate',
  'rh.declarations.manage',
  'rh.accounting.export',
];

export function getPermissionsForTenantType(
  type: TenantType,
): PermissionDefinition[] {
  const shared = [...SHARED_ADMIN_PERMISSIONS];
  if (type === TenantType.cabinet) {
    return [...shared, ...CABINET_SPACE_PERMISSIONS];
  }
  return [
    ...shared,
    ...COMPANY_CRM_PERMISSIONS,
    ...RH_PERMISSIONS,
    ...NOTES_FRAIS_PERMISSIONS,
  ];
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
  if (roleCode === 'RH_MANAGER') {
    return RH_MANAGER_PERMISSION_CODES;
  }

  return getPermissionsForTenantType(tenantType).map((p) => p.code);
}

export function getAllPlatformPermissions(): PermissionDefinition[] {
  const byCode = new Map<string, PermissionDefinition>();
  for (const p of [
    ...SHARED_ADMIN_PERMISSIONS,
    ...COMPANY_CRM_PERMISSIONS,
    ...RH_PERMISSIONS,
    ...NOTES_FRAIS_PERMISSIONS,
    ...CABINET_SPACE_PERMISSIONS,
  ]) {
    byCode.set(p.code, p);
  }
  return [...byCode.values()];
}
