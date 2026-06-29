import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { TenantType } from '@prisma/client';
import { CabinetMessages } from '../../modules/cabinet/constants/cabinet-messages';

@Injectable()
export class CabinetTenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantType: string | undefined =
      request.user?.tenantType ?? request.tenantType;

    if (tenantType !== TenantType.cabinet) {
      throw new ForbiddenException(
        CabinetMessages.CABINET_SPACE_ONLY,
      );
    }

    return true;
  }
}
