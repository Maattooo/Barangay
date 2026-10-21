import { Router, Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection';
import { authenticate, JWT_SECRET } from '../middleware/auth.middleware';
import '../types';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticates user credentials, updates last_login_at, writes LOGIN audit event,
 * sets HTTP-only cookie, and returns JWT token and user profile.
 */
router.post('/login', (req: Request, res: Response): void => {
  const { username, password } = req.body || {};

  // Strict primitive type verification
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username.trim().length === 0 ||
    password.trim().length === 0
  ) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const user = db.prepare(
    'SELECT id, username, password_hash, full_name, role, official_id, is_active FROM users WHERE username = ?'
  ).get(username.trim()) as {
    id: number;
    username: string;
    password_hash: string;
    full_name: string;
    role: 'Admin' | 'Clerk' | 'Treasurer' | 'Lupon';
    official_id: number | null;
    is_active: number;
  } | undefined;

  if (!user) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  if (user.is_active !== 1) {
    res.status(403).json({ error: 'Account is deactivated. Contact Administrator.' });
    return;
  }

  const passwordValid = bcryptjs.compareSync(password, user.password_hash);
  if (!passwordValid) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const clientIp = req.clientIp || '127.0.0.1';

  // Atomic update of last_login_at and LOGIN audit log inside a transaction
  const recordLoginTx = db.transaction(() => {
    db.prepare("UPDATE users SET last_login_at = datetime('now', 'localtime') WHERE id = ?").run(user.id);

    db.prepare(`
      INSERT INTO audit_logs (
        user_id,
        username_snapshot,
        user_role_snapshot,
        action,
        entity_type,
        entity_id,
        summary_text,
        old_data_json,
        new_data_json,
        client_ip
      ) VALUES (?, ?, ?, 'LOGIN', 'user', ?, ?, NULL, NULL, ?)
    `).run(
      user.id,
      user.username,
      user.role,
      user.id,
      `User ${user.username} logged in`,
      clientIp
    );
  });

  recordLoginTx();

  // Sign JWT token
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  // Set HTTP-only cookie
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/'
  });

  res.status(200).json({
    token,
    user: {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      official_id: user.official_id
    }
  });
});

/**
 * POST /api/auth/logout
 * Clears the HTTP-only cookie and returns success response.
 */
router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie('token', { path: '/' });
  res.status(200).json({ message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Verifies current token and returns logged-in user details.
 */
router.get('/me', authenticate, (req: Request, res: Response): void => {
  res.status(200).json({
    user: req.user
  });
});

export default router;
