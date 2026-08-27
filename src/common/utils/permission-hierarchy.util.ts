/** Implications RBAC : manage:* et *.write accordent aussi les lectures associées. */
const MANAGE_IMPLIES: Record<string, string[]> = {
  'manage:users': [
    'users.read',
    'users.write',
    'roles.read',
    'roles.write',
    'permissions.read',
    'permissions.write',
  ],
  'manage:roles': ['roles.read', 'roles.write', 'permissions.read'],
  'manage:permissions': ['permissions.read', 'permissions.write'],
  'manage:clients': ['clients.read', 'clients.write'],
  'manage:quotations': ['quotations.read', 'quotations.write'],
  'manage:orders': ['orders.read', 'orders.write'],
  'manage:invoices': ['invoices.read', 'invoices.write'],
  'manage:payments': ['payments.read', 'payments.write'],
  'manage:reminders': ['reminders.read', 'reminders.write'],
  'manage:settings': [
    'settings.read',
    'settings.write',
    'ndf.settings.manage',
    'ndf.read',
    'ndf.write',
    'rh.read',
    'rh.write',
  ],
  'manage:catalogue': ['catalogue.read'],
  'manage:stock': ['stock.read'],
  'manage:ndf': [
    'ndf.read',
    'ndf.write',
    'ndf.settings.manage',
    'ndf.expenses.submit',
    'ndf.reports.validate',
    'ndf.advances.manage',
    'ndf.refund.manage',
    'ndf.cards.reconcile',
    'ndf.accounting.export',
  ],
  'manage:rh': [
    'rh.read',
    'rh.write',
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
  ],
};

export function expandUserPermissions(permissions: string[]): Set<string> {
  const expanded = new Set(permissions);

  for (const code of permissions) {
    if (code.endsWith('.write')) {
      expanded.add(code.replace(/\.write$/, '.read'));
    }

    const implied = MANAGE_IMPLIES[code];
    if (implied) {
      for (const grant of implied) {
        expanded.add(grant);
      }
    }
  }

  return expanded;
}

export function userHasRequiredPermission(
  userPermissions: string[],
  required: string[],
): boolean {
  const expanded = expandUserPermissions(userPermissions);
  return required.some((permission) => expanded.has(permission));
}
