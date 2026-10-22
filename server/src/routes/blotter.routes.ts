import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import {
  getBlotterListController,
  getBlotterByIdController,
  createBlotterController,
  updateBlotterController,
  archiveBlotterController
} from '../controllers/blotter.controller';

const router = Router();

/**
 * GET /api/blotter
 * List and search blotter records with filters (status, search, respondent_id, is_archived, pagination).
 * Restricted to Admin and Lupon.
 */
router.get(
  '/',
  authenticate,
  requireRole('Admin', 'Lupon'),
  getBlotterListController
);

/**
 * POST /api/blotter
 * Create a new blotter case with auto-generated case number (BLT-YYYY-NNN) and audit log.
 * Restricted to Admin and Lupon.
 */
router.post(
  '/',
  authenticate,
  requireRole('Admin', 'Lupon'),
  createBlotterController
);

/**
 * GET /api/blotter/:id
 * Detailed case record inspection.
 * Restricted to Admin and Lupon.
 */
router.get(
  '/:id',
  authenticate,
  requireRole('Admin', 'Lupon'),
  getBlotterByIdController
);

/**
 * PUT /api/blotter/:id
 * Update blotter status or case details and log before/after JSON diff.
 * Restricted to Admin and Lupon.
 */
router.put(
  '/:id',
  authenticate,
  requireRole('Admin', 'Lupon'),
  updateBlotterController
);

/**
 * PATCH /api/blotter/:id/archive
 * Soft-delete blotter case (is_archived = 1) and log ARCHIVE audit event.
 * Strictly restricted to Admin.
 */
router.patch(
  '/:id/archive',
  authenticate,
  requireRole('Admin'),
  archiveBlotterController
);

export default router;
