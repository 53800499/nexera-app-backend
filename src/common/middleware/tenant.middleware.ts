import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from '../../shared/interfaces/jwt-payload.interface';

declare global {
  namespace Express {
    interface User extends JwtPayload {
      refreshToken?: string;
    }
  }
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Extraire le tenantId du JWT payload
    if (req.user) {
      const user = req.user as JwtPayload & { refreshToken?: string };
      req.tenantId = user.tenantId;
    }

    // Ou extraire du header custom si fourni
    const tenantIdHeader = req.headers['x-tenant-id'] as string;
    if (tenantIdHeader) {
      req.tenantId = tenantIdHeader;
    }

    next();
  }
}

// Ajouter une property pour tenantId si elle n'existe pas
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}
