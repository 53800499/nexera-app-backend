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

    const tenantHeader = req.headers['x-tenant-id'] as string | undefined;
    if (tenantHeader && process.env.NODE_ENV !== 'production') {
      req.tenantId = tenantHeader;
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
