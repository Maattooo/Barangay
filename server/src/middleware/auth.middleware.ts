import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection';
import '../types';

export const JWT_SECRET = process.env.JWT_SECRET || 'barangay-offline-system-default-secret-2026';

/**
 * Middleware that authenticates incoming requests via HTTP-only cookie 'token'
 * or 'Authorization: Bearer <token>' header. Verifies against SQLite active users.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  let token: string | undefined;

  // 1. Check Authorization: Bearer <token>
  if (req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
      token = parts[1];
    }
  }

  // 2. Check HTTP-only cookie 'token'
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // Missing token
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      username: string;
      role: string;
      [key: string]: unknown;
    };

    // Confirm user exists and is active in SQLite
    const user = db.prepare(
      'SELECT id, username, full_name, role, official_id, is_active FROM users WHERE id = ?'
    ).get(decoded.id) as {
      id: number;
      username: string;
      full_name: string;
      role: 'Admin' | 'Clerk' | 'Treasurer' | 'Lupon';
      official_id: number | null;
      is_active: number;
    } | undefined;

    if (!user) {
      res.status(401).json({ error: 'Unauthorized: User not found' });
      return;
    }

    if (user.is_active !== 1) {
      res.status(403).json({ error: 'Forbidden: Account is deactivated' });
      return;
    }

    // Hydrate req.user
    req.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      official_id: user.official_id
    };

    next();
  } catch (_err) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

export const authenticate = authMiddleware;
export default authMiddleware;
