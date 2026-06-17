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

const ALL_NEW_PERMISSIONS = [
  ...QUOTATION_PERMISSIONS,
  ...ORDER_PERMISSIONS,
  ...INVOICE_PERMISSIONS,
  ...PAYMENT_PERMISSIONS,
  ...REMINDER_PERMISSIONS,
  ...DASHBOARD_PERMISSIONS,
  ...SETTINGS_PERMISSIONS,
  ...SYNC_PERMISSIONS,
  ...API_ALIAS_PERMISSIONS,
];

const ADMIN_ROLE_CODES = ['ADMIN', 'CEO'];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL must be set before running the seed.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

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

  const roles = await prisma.role.findMany({
    where: { code: { in: ADMIN_ROLE_CODES } },
  });

  for (const role of roles) {
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({
        roleId: role.id,
        permissionId: permission.id,
      })),
      skipDuplicates: true,
    });
  }

  console.log(
    `Seeded ${permissions.length} permission(s) for ${roles.length} role(s).`,
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
