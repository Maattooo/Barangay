import { Request, Response } from 'express';
import { db } from '../db/connection';
import {
  createBlotter,
  getBlotters,
  getBlotterById,
  updateBlotter,
  archiveBlotter,
  checkResidentBlotter
} from '../services/blotter.service';
import { BLOTTER_STATUSES, BlotterStatus } from '../types/blotter';

/**
 * GET /api/blotter
 * List blotter cases with filtering by status, search, respondent_id, is_archived, and pagination.
 * Accessible to Admin and Lupon.
 */
export async function getBlotterListController(req: Request, res: Response): Promise<void> {
  try {
    const { status, search, respondent_id, is_archived, page, limit } = req.query;

    const filter = {
      status: typeof status === 'string' ? status : undefined,
      search: typeof search === 'string' ? search : undefined,
      respondent_id: respondent_id ? parseInt(String(respondent_id), 10) : undefined,
      is_archived: typeof is_archived === 'string' ? is_archived : undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined
    };

    const result = getBlotters(filter);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Error listing blotter cases:', error);
    res.status(500).json({ error: 'Internal server error listing blotter cases' });
  }
}

/**
 * GET /api/blotter/:id
 * Retrieve detailed blotter case inspection.
 * Accessible to Admin and Lupon.
 */
export async function getBlotterByIdController(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid blotter ID' });
      return;
    }

    const record = getBlotterById(id);
    if (!record) {
      res.status(404).json({ error: 'Blotter record not found' });
      return;
    }

    res.status(200).json(record);
  } catch (error: any) {
    console.error('Error fetching blotter case:', error);
    res.status(500).json({ error: 'Internal server error fetching blotter case' });
  }
}

/**
 * POST /api/blotter
 * Create a new blotter case with auto-generated BLT-YYYY-NNN case number.
 * Accessible to Admin and Lupon.
 */
export async function createBlotterController(req: Request, res: Response): Promise<void> {
  try {
    const {
      complainant_name,
      respondent_name,
      incident_type,
      incident_details,
      complainant_id,
      respondent_id,
      incident_location,
      date_incident,
      status
    } = req.body;

    if (!complainant_name || typeof complainant_name !== 'string' || complainant_name.trim().length === 0) {
      res.status(400).json({ error: 'Missing required field: complainant_name' });
      return;
    }
    if (!respondent_name || typeof respondent_name !== 'string' || respondent_name.trim().length === 0) {
      res.status(400).json({ error: 'Missing required field: respondent_name' });
      return;
    }
    if (!incident_type || typeof incident_type !== 'string' || incident_type.trim().length === 0) {
      res.status(400).json({ error: 'Missing required field: incident_type' });
      return;
    }
    if (!incident_details || typeof incident_details !== 'string' || incident_details.trim().length === 0) {
      res.status(400).json({ error: 'Missing required field: incident_details' });
      return;
    }

    if (status !== undefined && !BLOTTER_STATUSES.includes(status as BlotterStatus)) {
      res.status(400).json({
        error: `Invalid status "${status}". Allowed statuses: ${BLOTTER_STATUSES.join(', ')}`
      });
      return;
    }

    // Verify foreign keys if provided
    if (complainant_id !== undefined && complainant_id !== null) {
      const cId = Number(complainant_id);
      if (isNaN(cId) || cId <= 0) {
        res.status(400).json({ error: 'complainant_id must be a valid positive integer' });
        return;
      }
      const cExists = db.prepare('SELECT id FROM residents WHERE id = ?').get(cId);
      if (!cExists) {
        res.status(400).json({ error: `Complainant resident ID (${cId}) does not exist in residents` });
        return;
      }
    }

    if (respondent_id !== undefined && respondent_id !== null) {
      const rId = Number(respondent_id);
      if (isNaN(rId) || rId <= 0) {
        res.status(400).json({ error: 'respondent_id must be a valid positive integer' });
        return;
      }
      const rExists = db.prepare('SELECT id FROM residents WHERE id = ?').get(rId);
      if (!rExists) {
        res.status(400).json({ error: `Respondent resident ID (${rId}) does not exist in residents` });
        return;
      }
    }

    const newRecord = createBlotter(
      {
        complainant_name,
        respondent_name,
        incident_type,
        incident_details,
        complainant_id: complainant_id !== undefined && complainant_id !== null ? Number(complainant_id) : null,
        respondent_id: respondent_id !== undefined && respondent_id !== null ? Number(respondent_id) : null,
        incident_location,
        date_incident,
        status: status as BlotterStatus
      },
      {
        id: req.user!.id,
        username: req.user!.username,
        role: req.user!.role
      },
      req.clientIp
    );

    res.status(201).json(newRecord);
  } catch (error: any) {
    console.error('Error creating blotter case:', error);
    if (error.message && (error.message.includes('required') || error.message.includes('Invalid') || error.message.includes('does not exist'))) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error creating blotter case' });
  }
}

/**
 * PUT /api/blotter/:id
 * Update blotter case status and details with JSON diff audit logging.
 * Accessible to Admin and Lupon.
 */
export async function updateBlotterController(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid blotter ID' });
      return;
    }

    const existing = getBlotterById(id);
    if (!existing) {
      res.status(404).json({ error: 'Blotter record not found' });
      return;
    }

    const payload = req.body;

    if (payload.status !== undefined && !BLOTTER_STATUSES.includes(payload.status as BlotterStatus)) {
      res.status(400).json({
        error: `Invalid status "${payload.status}". Permitted statuses: ${BLOTTER_STATUSES.join(', ')}`
      });
      return;
    }

    if (payload.incident_details !== undefined && (typeof payload.incident_details !== 'string' || payload.incident_details.trim().length === 0)) {
      res.status(400).json({ error: 'incident_details cannot be empty' });
      return;
    }

    if (payload.incident_type !== undefined && (typeof payload.incident_type !== 'string' || payload.incident_type.trim().length === 0)) {
      res.status(400).json({ error: 'incident_type cannot be empty' });
      return;
    }

    if (payload.complainant_name !== undefined && (typeof payload.complainant_name !== 'string' || payload.complainant_name.trim().length === 0)) {
      res.status(400).json({ error: 'complainant_name cannot be empty' });
      return;
    }

    if (payload.respondent_name !== undefined && (typeof payload.respondent_name !== 'string' || payload.respondent_name.trim().length === 0)) {
      res.status(400).json({ error: 'respondent_name cannot be empty' });
      return;
    }

    if (payload.complainant_id !== undefined && payload.complainant_id !== null) {
      const cId = Number(payload.complainant_id);
      if (isNaN(cId) || cId <= 0) {
        res.status(400).json({ error: 'complainant_id must be a valid positive integer' });
        return;
      }
      const cExists = db.prepare('SELECT id FROM residents WHERE id = ?').get(cId);
      if (!cExists) {
        res.status(400).json({ error: `Complainant resident ID (${cId}) does not exist in residents` });
        return;
      }
    }

    if (payload.respondent_id !== undefined && payload.respondent_id !== null) {
      const rId = Number(payload.respondent_id);
      if (isNaN(rId) || rId <= 0) {
        res.status(400).json({ error: 'respondent_id must be a valid positive integer' });
        return;
      }
      const rExists = db.prepare('SELECT id FROM residents WHERE id = ?').get(rId);
      if (!rExists) {
        res.status(400).json({ error: `Respondent resident ID (${rId}) does not exist in residents` });
        return;
      }
    }

    const updated = updateBlotter(
      id,
      payload,
      {
        id: req.user!.id,
        username: req.user!.username,
        role: req.user!.role
      },
      req.clientIp
    );

    res.status(200).json(updated);
  } catch (error: any) {
    console.error('Error updating blotter case:', error);
    if (error.message && (error.message.includes('required') || error.message.includes('Invalid') || error.message.includes('cannot be empty') || error.message.includes('does not exist'))) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Internal server error updating blotter case' });
  }
}

/**
 * PATCH /api/blotter/:id/archive
 * Soft-delete blotter record (is_archived = 1) and record ARCHIVE audit log.
 * Restricted strictly to Admin.
 */
export async function archiveBlotterController(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid blotter ID' });
      return;
    }

    const existing = getBlotterById(id);
    if (!existing) {
      res.status(404).json({ error: 'Blotter record not found' });
      return;
    }

    archiveBlotter(
      id,
      {
        id: req.user!.id,
        username: req.user!.username,
        role: req.user!.role
      },
      req.clientIp
    );

    res.status(200).json({ message: 'Blotter case archived successfully' });
  } catch (error: any) {
    console.error('Error archiving blotter case:', error);
    res.status(500).json({ error: 'Internal server error archiving blotter case' });
  }
}

/**
 * GET /api/residents/:id/blotter-check
 * Fast automated clearance gatekeeper check returning { cleared: boolean, cases: [...] }.
 * Accessible to all authenticated staff (Admin, Clerk, Treasurer, Lupon).
 */
export async function checkResidentBlotterController(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid resident ID' });
      return;
    }

    const resident = db.prepare('SELECT id FROM residents WHERE id = ?').get(id);
    if (!resident) {
      res.status(404).json({ error: 'Resident not found' });
      return;
    }

    const checkResult = checkResidentBlotter(id);
    res.status(200).json(checkResult);
  } catch (error: any) {
    console.error('Error performing blotter gatekeeper check:', error);
    res.status(500).json({ error: 'Internal server error performing blotter gatekeeper check' });
  }
}
