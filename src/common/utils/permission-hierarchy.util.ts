/** Implications RBAC : manage:* et *.write accordent aussi les lectures associées. */
const MANAGE_IMPLIES: Record<string, string[]> = {
  'manage:users': ['users.read', 'users.write'],
  'manage:roles': ['roles.read', 'roles.write', 'permissions.read'],
  'manage:permissions': ['permissions.read', 'permissions.write'],
  'manage:clients': ['clients.read', 'clients.write'],
  'manage:quotations': ['quotations.read', 'quotations.write'],
  'manage:orders': ['orders.read', 'orders.write'],
  'manage:invoices': ['invoices.read', 'invoices.write'],
  'manage:payments': ['payments.read', 'payments.write'],
  'manage:reminders': ['reminders.read', 'reminders.write'],
  'manage:settings': ['settings.read'],
  'manage:catalogue': ['catalogue.read'],
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
