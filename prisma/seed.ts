import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const QUOTATION_PERMISSIONS = [
  { code: 'quotations.read', description: 'View quotations' },
  { code: 'quotations.write', description: 'Manage quotations' },
  { code: 'manage:quotations', description: 'Manage quotations (API guard)' },
];

const ORDER_PERMISSIONS = [
  { code: 'orders.read', description: 'View orders' },
  { code: 'orders.write', description: 'Manage orders' },
  { code: 'manage:orders', description: 'Manage orders (API guard)' },
];

const INVOICE_PERMISSIONS = [
  { code: 'invoices.read', description: 'View invoices' },
  { code: 'invoices.write', description: 'Manage invoices' },
  { code: 'manage:invoices', description: 'Manage invoices (API guard)' },
];

const PAYMENT_PERMISSIONS = [
  { code: 'payments.read', description: 'View payments' },
  { code: 'payments.write', description: 'Manage payments' },
  { code: 'manage:payments', description: 'Manage payments (API guard)' },
];

const REMINDER_PERMISSIONS = [
  { code: 'reminders.read', description: 'View reminders' },
  { code: 'reminders.write', description: 'Manage reminders' },
  { code: 'manage:reminders', description: 'Manage reminders (API guard)' },
];

const DASHBOARD_PERMISSIONS = [
  { code: 'dashboard.read', description: 'View commercial dashboard' },
];

const SETTINGS_PERMISSIONS = [
  { code: 'settings.read', description: 'View tenant settings' },
  { code: 'manage:settings', description: 'Manage tenant settings (API guard)' },
];

const SYNC_PERMISSIONS = [
  { code: 'sync.read', description: 'Pull offline data (bootstrap + delta)' },
  { code: 'sync.push', description: 'Push offline mutations to server' },
];

const STOCK_PERMISSIONS = [
  { code: 'stock.read', description: 'View stock' },
  { code: 'manage:stock', description: 'Manage stock (API guard)' },
];

const API_ALIAS_PERMISSIONS = [
  { code: 'clients.read', description: 'View clients' },
  { code: 'catalogue.read', description: 'View catalogue' },
  { code: 'manage:catalogue', description: 'Manage catalogue (API guard)' },
  { code: 'manage:users', description: 'Manage users (API guard)' },
  { code: 'manage:roles', description: 'Manage roles (API guard)' },
  { code: 'manage:permissions', description: 'Manage permissions (API guard)' },
  { code: 'manage:tenants', description: 'Manage tenants (API guard)' },
  { code: 'manage:clients', description: 'Manage clients (API guard)' },
];

const CABINET_PERMISSIONS = [
  {
    code: 'cabinet.read',
    description: 'Espace cabinet — consulter les entreprises liées',
  },
];

const RH_PERMISSIONS = [
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

const NOTES_FRAIS_PERMISSIONS = [
  { code: 'ndf.read', description: 'Consulter le module Notes de frais' },
  { code: 'ndf.write', description: 'Gérer les notes de frais et dépenses' },
  { code: 'manage:ndf', description: 'Administration Notes de frais (API guard)' },
  { code: 'ndf.expenses.submit', description: 'Saisir et soumettre ses propres notes de frais' },
  { code: 'ndf.reports.validate', description: 'Approuver ou rejeter les rapports de frais' },
  { code: 'ndf.advances.manage', description: 'Gérer les ordres de mission et avances' },
  { code: 'ndf.refund.manage', description: 'Déclencher et suivre les remboursements' },
  { code: 'ndf.cards.reconcile', description: 'Gérer les cartes affaires et le rapprochement' },
  { code: 'ndf.accounting.export', description: 'Transmettre les écritures vers la comptabilité (M3)' },
  { code: 'ndf.settings.manage', description: 'Configurer les politiques et barèmes de dépenses' },
];

const ALL_NEW_PERMISSIONS = [
  ...QUOTATION_PERMISSIONS,
  ...ORDER_PERMISSIONS,
  ...INVOICE_PERMISSIONS,
  ...PAYMENT_PERMISSIONS,
  ...REMINDER_PERMISSIONS,
  ...DASHBOARD_PERMISSIONS,
  ...SETTINGS_PERMISSIONS,
  ...SYNC_PERMISSIONS,
  ...STOCK_PERMISSIONS,
  ...API_ALIAS_PERMISSIONS,
  ...CABINET_PERMISSIONS,
  ...RH_PERMISSIONS,
  ...NOTES_FRAIS_PERMISSIONS,
];

import { seedRhData } from './seed-rh';
import { seedNdfData } from './seed-ndf';

const ADMIN_ROLE_CODES = ['ADMIN', 'CEO', 'CABINET_ADMIN'];

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

const NDF_MANAGER_PERMISSION_CODES = [
  'dashboard.read',
  'settings.read',
  'sync.read',
  'ndf.read',
  'ndf.write',
  'manage:ndf',
  'ndf.expenses.submit',
  'ndf.reports.validate',
  'ndf.advances.manage',
  'ndf.refund.manage',
  'ndf.cards.reconcile',
  'ndf.accounting.export',
  'ndf.settings.manage',
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL must be set before running the seed.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  // 1. Upsert all platform permissions
  for (const permission of ALL_NEW_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      create: permission,
      update: { description: permission.description },
    });
  }

  const permissions = await prisma.permission.findMany({
    where: { code: { in: ALL_NEW_PERMISSIONS.map((p) => p.code) } },
  });

  // 2. Ensure RH_MANAGER & NDF_MANAGER roles exist for all company tenants
  const companyTenants = await prisma.tenant.findMany({
    where: { type: 'company' },
  });

  for (const tenant of companyTenants) {
    await prisma.role.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: 'RH_MANAGER',
        },
      },
      create: {
        tenantId: tenant.id,
        code: 'RH_MANAGER',
        name: 'Responsable RH & Paie',
        description: 'Gestion complète des salariés, contrats, congés et paie',
      },
      update: {
        name: 'Responsable RH & Paie',
        description: 'Gestion complète des salariés, contrats, congés et paie',
      },
    });

    await prisma.role.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: 'NDF_MANAGER',
        },
      },
      create: {
        tenantId: tenant.id,
        code: 'NDF_MANAGER',
        name: 'Responsable Notes de Frais',
        description: 'Gestion et validation des dépenses, missions et remboursements',
      },
      update: {
        name: 'Responsable Notes de Frais',
        description: 'Gestion et validation des dépenses, missions et remboursements',
      },
    });
  }

  // 3. Grant all permissions to ADMIN, CEO, CABINET_ADMIN roles across all tenants
  const adminRoles = await prisma.role.findMany({
    where: { code: { in: ADMIN_ROLE_CODES } },
  });

  for (const role of adminRoles) {
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  // 4. Grant RH permissions to RH_MANAGER roles across all tenants
  const rhPermissions = await prisma.permission.findMany({
    where: { code: { in: RH_MANAGER_PERMISSION_CODES } },
  });

  const rhRoles = await prisma.role.findMany({
    where: { code: 'RH_MANAGER' },
  });

  for (const role of rhRoles) {
    await prisma.rolePermission.createMany({
      data: rhPermissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  // 5. Grant NDF permissions to NDF_MANAGER roles across all tenants
  const ndfPermissions = await prisma.permission.findMany({
    where: { code: { in: NDF_MANAGER_PERMISSION_CODES } },
  });

  const ndfRoles = await prisma.role.findMany({
    where: { code: 'NDF_MANAGER' },
  });

  for (const role of ndfRoles) {
    await prisma.rolePermission.createMany({
      data: ndfPermissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  console.log(
    `✅ Seeded ${permissions.length} permission(s).`,
  );
  console.log(
    `✅ Updated ${adminRoles.length} admin/CEO role(s) with all permissions.`,
  );
  console.log(
    `✅ Updated ${rhRoles.length} RH_MANAGER role(s) with RH permissions across ${companyTenants.length} company tenant(s).`,
  );
  console.log(
    `✅ Updated ${ndfRoles.length} NDF_MANAGER role(s) with NDF permissions across ${companyTenants.length} company tenant(s).`,
  );

  // 6. Seed RH & Paie standard reference tables (rubriques, barèmes, etc.)
  await seedRhData(prisma);

  // 7. Seed Notes de Frais standard reference tables (catégories, barèmes, etc.)
  await seedNdfData(prisma);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
