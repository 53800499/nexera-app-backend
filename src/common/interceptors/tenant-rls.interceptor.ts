import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * Active le contexte tenant PostgreSQL pour les politiques RLS (ENF sécurité).
 */
@Injectable()
export class TenantRlsInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.tenantId ?? request.user?.tenantId;

    if (!tenantId) {
      return next.handle();
    }

    return from(
      this.prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
    ).pipe(switchMap(() => next.handle()));
  }
}
