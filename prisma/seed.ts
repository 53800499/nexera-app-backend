import { PrismaClient } from '@prisma/client';

const QUOTATION_PERMISSIONS = [
  { code: 'quotations.read', description: 'View quotations' },
  { code: 'quotations.write', description: 'Manage quotations' },
  { code: 'manage:quotations', description: 'Manage quotations (API guard)' },
];

const API_ALIAS_PERMISSIONS = [
  { code: 'manage:users', description: 'Manage users (API guard)' },
  { code: 'manage:roles', description: 'Manage roles (API guard)' },
  { code: 'manage:permissions', description: 'Manage permissions (API guard)' },
  { code: 'manage:tenants', description: 'Manage tenants (API guard)' },
  { code: 'manage:clients', description: 'Manage clients (API guard)' },
];

const ALL_NEW_PERMISSIONS = [
  ...QUOTATION_PERMISSIONS,
  ...API_ALIAS_PERMISSIONS,
];

const ADMIN_ROLE_CODES = ['ADMIN', 'CEO'];

async function main() {
  const prisma = new PrismaClient();

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
