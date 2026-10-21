import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';

/**
 * Role-Based Access Control (RBAC) middleware factory.
 * Enforces role boundaries across Admin, Clerk, Treasurer, and Lupon.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      return;
    }

    next();
  };
}

export default requireRole;
