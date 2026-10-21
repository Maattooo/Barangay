import { Router, Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import { db } from '../db/connection';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { logAuditEvent } from '../services/audit.service';
import { UserRole, UserResponse } from '../types';

const router = Router();
const ALLOWED_ROLES: UserRole[] = ['Admin', 'Clerk', 'Treasurer', 'Lupon'];

// Protect all user routes with Admin RBAC guard
router.use(authenticate, requireRole('Admin'));

/**
 * GET /api/users
 * Lists all registered users (excluding password_hash).
 */
router.get('/', (_req: Request, res: Response): void => {
  const users = db.prepare(`
    SELECT id, username, full_name, role, official_id, is_active, last_login_at, created_at
    FROM users
    ORDER BY id ASC
  `).all() as UserResponse[];

  res.status(200).json(users);
});

/**
 * POST /api/users
 * Creates a new user with hashed password and writes a CREATE audit log within a transaction.
 */
router.post('/', (req: Request, res: Response): void => {
  const { username, password, full_name, role, official_id } = req.body || {};

  // Strict primitive type verification
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    typeof full_name !== 'string' ||
    typeof role !== 'string' ||
    username.trim().length === 0 ||
    password.trim().length === 0 ||
    full_name.trim().length === 0
  ) {
    res.status(400).json({ error: 'Missing required fields or invalid data types' });
    return;
  }

  if (!ALLOWED_ROLES.includes(role as UserRole)) {
    res.status(400).json({ error: 'Invalid role specified' });
    return;
  }

  // Pre-validate official_id foreign key if provided
  if (official_id !== undefined && official_id !== null) {
    const officialIdNum = Number(official_id);
    if (isNaN(officialIdNum) || !Number.isInteger(officialIdNum) || officialIdNum <= 0) {
      res.status(400).json({ error: 'Invalid official ID specified' });
      return;
    }
    const official = db.prepare('SELECT id FROM barangay_officials WHERE id = ?').get(officialIdNum);
    if (!official) {
      res.status(400).json({ error: 'Invalid official ID specified' });
      return;
    }
  }

  // Check for duplicate username
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existing) {
    res.status(409).json({ error: 'Username already exists' });
    return;
  }

  // Salt and hash password with bcrypt (work factor 10)
  const passwordHash = bcryptjs.hashSync(password, 10);

  try {
    let newUserId: number = 0;
    const clientIp = req.clientIp || '127.0.0.1';

    // Atomic transaction for user insertion and audit log record
    const createUserTx = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO users (username, password_hash, full_name, role, official_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(username.trim(), passwordHash, full_name.trim(), role, official_id ?? null);

      newUserId = Number(result.lastInsertRowid);

      logAuditEvent({
        userId: req.user!.id,
        username: req.user!.username,
        userRole: req.user!.role,
        action: 'CREATE',
        entityType: 'user',
        entityId: newUserId,
        summaryText: `Created user ${username.trim()} with role ${role}`,
        newData: {
          username: username.trim(),
          full_name: full_name.trim(),
          role,
          official_id: official_id ?? null
        },
        clientIp
      });
    });

    createUserTx();

    const createdUser = db.prepare(`
      SELECT id, username, full_name, role, official_id, is_active, last_login_at, created_at
      FROM users WHERE id = ?
    `).get(newUserId) as UserResponse;

    res.status(201).json(createdUser);
  } catch (error: any) {
    if (error?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || error?.message?.includes('FOREIGN KEY')) {
      res.status(400).json({ error: 'Invalid official ID specified' });
      return;
    }
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || error?.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to create user account' });
  }
});

/**
 * PUT /api/users/:id
 * Updates an existing user's role, active status, details, or password.
 * Enforces transactional execution, self-lockout prevention, and FK validation.
 */
router.put('/:id', (req: Request, res: Response): void => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    res.status(400).json({ error: 'Invalid user ID' });
    return;
  }

  const existingUser = db.prepare(`
    SELECT id, username, password_hash, full_name, role, official_id, is_active, last_login_at, created_at
    FROM users WHERE id = ?
  `).get(userId) as {
    id: number;
    username: string;
    password_hash: string;
    full_name: string;
    role: UserRole;
    official_id: number | null;
    is_active: number;
    last_login_at: string | null;
    created_at: string;
  } | undefined;

  if (!existingUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const { full_name, role, official_id, is_active, password } = req.body || {};

  // Input validation for password
  if (password !== undefined) {
    if (typeof password !== 'string' || password.trim().length === 0) {
      res.status(400).json({ error: 'Password must be a non-empty string' });
      return;
    }
  }

  // Input validation for full_name
  if (full_name !== undefined) {
    if (typeof full_name !== 'string' || full_name.trim().length === 0) {
      res.status(400).json({ error: 'Full name must be a non-empty string' });
      return;
    }
  }

  // Input validation for role
  if (role !== undefined && !ALLOWED_ROLES.includes(role)) {
    res.status(400).json({ error: 'Invalid role specified' });
    return;
  }

  // Pre-validate official_id foreign key if provided
  if (official_id !== undefined && official_id !== null) {
    const officialIdNum = Number(official_id);
    if (isNaN(officialIdNum) || !Number.isInteger(officialIdNum) || officialIdNum <= 0) {
      res.status(400).json({ error: 'Invalid official ID specified' });
      return;
    }
    const official = db.prepare('SELECT id FROM barangay_officials WHERE id = ?').get(officialIdNum);
    if (!official) {
      res.status(400).json({ error: 'Invalid official ID specified' });
      return;
    }
  }

  // Admin Self-Lockout Prevention
  const isSelfUpdate = req.user?.id === userId;
  const willBeInactive = is_active !== undefined && (is_active === 0 || is_active === false || is_active === '0');
  const willDemoteRole = role !== undefined && role !== 'Admin';

  if (isSelfUpdate && (willBeInactive || willDemoteRole)) {
    const adminCountRow = db.prepare(
      "SELECT COUNT(*) as count FROM users WHERE role = 'Admin' AND is_active = 1"
    ).get() as { count: number };

    if (adminCountRow.count <= 1) {
      res.status(400).json({ error: 'Cannot deactivate or demote the sole remaining active Admin account' });
      return;
    }
  }

  const updatedFullName = full_name !== undefined ? full_name.trim() : existingUser.full_name;
  const updatedRole = role !== undefined ? role : existingUser.role;
  const updatedOfficialId = official_id !== undefined ? (official_id === null ? null : Number(official_id)) : existingUser.official_id;
  const updatedIsActive = is_active !== undefined ? (is_active ? 1 : 0) : existingUser.is_active;
  const updatedPasswordHash = password ? bcryptjs.hashSync(password, 10) : existingUser.password_hash;

  try {
    const clientIp = req.clientIp || '127.0.0.1';

    // Atomic transaction for user update and audit log record
    const updateUserTx = db.transaction(() => {
      db.prepare(`
        UPDATE users
        SET full_name = ?,
            role = ?,
            official_id = ?,
            is_active = ?,
            password_hash = ?
        WHERE id = ?
      `).run(
        updatedFullName,
        updatedRole,
        updatedOfficialId,
        updatedIsActive,
        updatedPasswordHash,
        userId
      );

      const isPasswordReset = typeof password === 'string' && password.trim().length > 0;
      const isProfileUpdated = (
        updatedFullName !== existingUser.full_name ||
        updatedRole !== existingUser.role ||
        updatedOfficialId !== existingUser.official_id ||
        updatedIsActive !== existingUser.is_active
      );

      let summaryText = `Updated user ${existingUser.username}`;
      if (isPasswordReset && isProfileUpdated) {
        summaryText = `Updated user ${existingUser.username} (profile & password reset)`;
      } else if (isPasswordReset) {
        summaryText = `Updated user ${existingUser.username} (password reset)`;
      }

      // Log UPDATE audit record with computed JSON diff excluding unchanged fields
      logAuditEvent({
        userId: req.user!.id,
        username: req.user!.username,
        userRole: req.user!.role,
        action: 'UPDATE',
        entityType: 'user',
        entityId: userId,
        summaryText,
        oldData: {
          full_name: existingUser.full_name,
          role: existingUser.role,
          official_id: existingUser.official_id,
          is_active: existingUser.is_active
        },
        newData: {
          full_name: updatedFullName,
          role: updatedRole,
          official_id: updatedOfficialId,
          is_active: updatedIsActive
        },
        clientIp
      });
    });

    updateUserTx();

    const updatedUser = db.prepare(`
      SELECT id, username, full_name, role, official_id, is_active, last_login_at, created_at
      FROM users WHERE id = ?
    `).get(userId) as UserResponse;

    res.status(200).json(updatedUser);
  } catch (error: any) {
    if (error?.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || error?.message?.includes('FOREIGN KEY')) {
      res.status(400).json({ error: 'Invalid official ID specified' });
      return;
    }
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE' || error?.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to update user account' });
  }
});

export default router;
