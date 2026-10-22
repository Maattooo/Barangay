import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import {
  previewIssuanceController,
  createIssuanceController,
  getIssuancesListController,
  getIssuanceByIdController
} from '../controllers/issuances.controller';

const router = Router();

// All issuance endpoints require authentication and RBAC permissions
// Section 5.5 RBAC: Admin, Clerk, and Treasurer are permitted; Lupon is strictly forbidden.
router.use(authenticate);
router.use(requireRole('Admin', 'Clerk', 'Treasurer'));

/**
 * POST /api/issuances/preview
 * Read-only preview pipeline rendering interpolated template and sidebar council roster.
 * Strictly performs ZERO writes to certificate_issuances or audit_logs.
 */
router.post('/preview', previewIssuanceController);

/**
 * POST /api/issuances
 * Atomic certificate issuance transaction endpoint.
 */
router.post('/', createIssuanceController);

/**
 * GET /api/issuances
 * Paginated issuance history with multi-parameter filtering.
 */
router.get('/', getIssuancesListController);

/**
 * GET /api/issuances/:id
 * Single issuance detailed inspection with pre-interpolated printable HTML.
 */
router.get('/:id', getIssuanceByIdController);

// STRICT IMMUTABILITY: Zero PUT, PATCH, or DELETE routes exist for certificate_issuances.
export default router;
