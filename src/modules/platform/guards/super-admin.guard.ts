import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentification requise');
    }

    const roles: string[] = Array.isArray(user.roles)
      ? user.roles.map((r: string) => String(r).toUpperCase())
      : user.role
        ? [String(user.role).toUpperCase()]
        : [];

    const isExplicitSuperAdmin = Boolean(user.isSuperAdmin);
    const hasSuperAdminRole = roles.some((r) =>
      ['SUPER_ADMIN', 'SUPERADMIN', 'PLATFORM_ADMIN', 'ADMIN'].includes(r),
    );

    if (!isExplicitSuperAdmin && !hasSuperAdminRole) {
      throw new ForbiddenException(
        'Accès refusé : cette ressource est strictement réservée au Super Administrateur de la plateforme Nexera.',
      );
    }

    return true;
  }
}

