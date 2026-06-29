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

    const permissions = this.reflector.getAllAndOverride<string[]>(
      'permissions',
      [context.getHandler(), context.getClass()],
    );

    if (!permissions?.length) {
      throw new ForbiddenException(
        'Endpoint non protégé par une permission explicite',
      );
    }

    const request = context.switchToHttp().getRequest();
    const userPermissions: string[] = request.user?.permissions ?? [];

    const allowed = userHasRequiredPermission(userPermissions, permissions);

    if (!allowed) {
      throw new ForbiddenException('Permission insuffisante');
    }

    return true;
  }
}
