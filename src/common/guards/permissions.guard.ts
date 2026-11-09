import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_AUTHENTICATED_KEY } from '../decorators/allow-authenticated.decorator';
import { userHasRequiredPermission } from '../utils/permission-hierarchy.util';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const allowAuthenticated = this.reflector.getAllAndOverride<boolean>(
      ALLOW_AUTHENTICATED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowAuthenticated) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const userRoles: string[] = Array.isArray(user?.roles)
      ? user.roles
      : user?.role
        ? [user.role]
        : [];

    // Super Admins ont un accès total et ne sont pas restreints par les métadonnées de permissions métier
    if (
      user?.isSuperAdmin ||
      userRoles.some((r) =>
        ['SUPER_ADMIN', 'SUPERADMIN', 'PLATFORM_ADMIN'].includes(String(r).toUpperCase()),
      )
    ) {
      return true;
    }

    const permissions = this.reflector.getAllAndOverride<string[]>(
      'permissions',
      [context.getHandler(), context.getClass()],
    );

    if (!permissions?.length) {
      throw new ForbiddenException(
        'Endpoint non protégé par une permission explicite',
      );
    }

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // Admins, Dirigeants et CEOs ont un accès complet
    if (
      userRoles.some((r) =>
        ['ADMIN', 'CEO', 'admin', 'dirigeant', 'COMPTABLE', 'comptable', 'CABINET_ADMIN'].includes(r),
      )
    ) {
      return true;
    }

    const userPermissions: string[] = user.permissions ?? [];
    const allowed = userHasRequiredPermission(userPermissions, permissions);

    if (!allowed) {
      throw new ForbiddenException('Permission insuffisante');
    }

    return true;
  }
}
