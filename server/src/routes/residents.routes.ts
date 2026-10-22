import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import {
  getResidents,
  getResidentStats,
  createResident,
  updateResident,
  archiveResident,
  importResidentsController,
  exportResidentsController,
  enrichResident,
  SQL_DYNAMIC_AGE
} from '../controllers/residents.controller';
import { checkResidentBlotterController } from '../controllers/blotter.controller';
import { db } from '../db/connection';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max
});

/**
 * GET /api/residents/stats
 * Dashboard aggregated demographics and blotter statistics.
 * Accessible to Admin, Clerk, Treasurer, Lupon.
 */
router.get(
  '/stats',
  authenticate,
  requireRole('Admin', 'Clerk', 'Treasurer', 'Lupon'),
  getResidentStats
);

/**
 * GET /api/residents/export-excel
 * Generate filtered .xlsx spreadsheet matching query parameters.
 * Accessible to Admin, Clerk, Treasurer (Forbidden for Lupon).
 */
router.get(
  '/export-excel',
  authenticate,
  requireRole('Admin', 'Clerk', 'Treasurer'),
  exportResidentsController
);

/**
 * POST /api/residents/import-excel
 * Bulk import residents from uploaded file or JSON array.
 * Strictly restricted to Admin.
 */
router.post(
  '/import-excel',
  authenticate,
  requireRole('Admin'),
  upload.single('file'),
  importResidentsController
);

/**
 * GET /api/residents
 * Query and filter residents with text search, purok, sex, civil_status, combinatorial sector filter, and pagination.
 * Accessible to Admin, Clerk, Treasurer, Lupon.
 */
router.get(
  '/',
  authenticate,
  requireRole('Admin', 'Clerk', 'Treasurer', 'Lupon'),
  getResidents
);

/**
 * POST /api/residents
 * Create a new resident profile.
 * Accessible to Admin, Clerk (Forbidden for Treasurer, Lupon).
 */
router.post(
  '/',
  authenticate,
  requireRole('Admin', 'Clerk'),
  createResident
);

/**
 * GET /api/residents/:id/blotter-check
 * Automated blotter gatekeeper clearance check.
 * Accessible to Admin, Clerk, Treasurer, Lupon.
 */
router.get(
  '/:id/blotter-check',
  authenticate,
  requireRole('Admin', 'Clerk', 'Treasurer', 'Lupon'),
  checkResidentBlotterController
);

/**
 * GET /api/residents/:id
 * Retrieve single resident profile with dynamic age and sector derivations.
 * Accessible to Admin, Clerk, Treasurer, Lupon.
 */
router.get(
  '/:id',
  authenticate,
  requireRole('Admin', 'Clerk', 'Treasurer', 'Lupon'),
  (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid resident ID' });
      return;
    }

    const row = db.prepare(`
      SELECT r.*, ${SQL_DYNAMIC_AGE} AS age
      FROM residents r
      WHERE r.id = ?
    `).get(id);

    if (!row) {
      res.status(404).json({ error: 'Resident not found' });
      return;
    }

    res.status(200).json(enrichResident(row));
  }
);

/**
 * PUT /api/residents/:id
 * Update resident profile.
 * Accessible to Admin, Clerk (Forbidden for Treasurer, Lupon).
 */
router.put(
  '/:id',
  authenticate,
  requireRole('Admin', 'Clerk'),
  updateResident
);

/**
 * PATCH /api/residents/:id/archive
 * Soft-delete / archive resident.
 * Strictly restricted to Admin (Forbidden for Clerk, Treasurer, Lupon).
 */
router.patch(
  '/:id/archive',
  authenticate,
  requireRole('Admin'),
  archiveResident
);

export default router;
