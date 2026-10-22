import { Request, Response } from 'express';
import {
  previewIssuance,
  createIssuance,
  getIssuances,
  getIssuanceById,
  IssuanceError
} from '../services/issuance.service';
import { PreviewIssuanceInput, CreateIssuanceInput, IssuanceQueryParams } from '../types/issuances';

/**
 * POST /api/issuances/preview
 * Read-only preview endpoint rendering interpolated template and sidebar roster.
 * Strictly performs ZERO database mutations or audit logs.
 */
export async function previewIssuanceController(req: Request, res: Response): Promise<void> {
  try {
    const {
      resident_id,
      template_id,
      purpose,
      or_number,
      amount_paid,
      ctc_number,
      ctc_date_issued,
      ctc_place_issued,
      signatory_official_id,
      is_oic_signing,
      is_override,
      blotter_override_reason
    } = req.body;

    if (!resident_id || isNaN(Number(resident_id))) {
      res.status(400).json({ error: 'Valid resident_id is required' });
      return;
    }
    if (!template_id || isNaN(Number(template_id))) {
      res.status(400).json({ error: 'Valid template_id is required' });
      return;
    }
    if (!signatory_official_id || isNaN(Number(signatory_official_id))) {
      res.status(400).json({ error: 'Valid signatory_official_id is required' });
      return;
    }

    const input: PreviewIssuanceInput = {
      resident_id: Number(resident_id),
      template_id: Number(template_id),
      purpose: purpose !== undefined ? String(purpose) : '',
      or_number: or_number !== undefined ? String(or_number) : undefined,
      amount_paid: amount_paid !== undefined ? Number(amount_paid) : undefined,
      ctc_number: ctc_number !== undefined ? String(ctc_number) : undefined,
      ctc_date_issued: ctc_date_issued !== undefined ? String(ctc_date_issued) : undefined,
      ctc_place_issued: ctc_place_issued !== undefined ? String(ctc_place_issued) : undefined,
      signatory_official_id: Number(signatory_official_id),
      is_oic_signing,
      is_override,
      blotter_override_reason
    };

    const preview = previewIssuance(input);
    res.status(200).json(preview);
  } catch (error: any) {
    if (error instanceof IssuanceError) {
      const responseBody: any = { error: error.message };
      if (error.cases) {
        responseBody.cases = error.cases;
      }
      res.status(error.statusCode).json(responseBody);
      return;
    }
    console.error('Error generating issuance preview:', error);
    res.status(500).json({ error: 'Internal server error generating certificate preview' });
  }
}

/**
 * POST /api/issuances
 * Atomic certificate issuance transaction endpoint.
 * Validates entities, executes blotter gatekeeper check, generates sequential control number,
 * snapshots signatory, and writes immutable audit logs (PRINT_CERTIFICATE + BLOTTER_OVERRIDE).
 */
export async function createIssuanceController(req: Request, res: Response): Promise<void> {
  try {
    const {
      resident_id,
      template_id,
      purpose,
      or_number,
      amount_paid,
      ctc_number,
      ctc_date_issued,
      ctc_place_issued,
      signatory_official_id,
      is_oic_signing,
      is_override,
      blotter_override_reason
    } = req.body;

    if (!resident_id || isNaN(Number(resident_id))) {
      res.status(400).json({ error: 'Valid resident_id is required' });
      return;
    }
    if (!template_id || isNaN(Number(template_id))) {
      res.status(400).json({ error: 'Valid template_id is required' });
      return;
    }
    if (!purpose || typeof purpose !== 'string' || purpose.trim().length === 0) {
      res.status(400).json({ error: 'Purpose is required' });
      return;
    }
    if (!signatory_official_id || isNaN(Number(signatory_official_id))) {
      res.status(400).json({ error: 'Valid signatory_official_id is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized: User authentication required' });
      return;
    }

    const input: CreateIssuanceInput = {
      resident_id: Number(resident_id),
      template_id: Number(template_id),
      purpose: purpose.trim(),
      or_number: or_number !== undefined ? String(or_number) : undefined,
      amount_paid: amount_paid !== undefined ? Number(amount_paid) : undefined,
      ctc_number: ctc_number !== undefined ? String(ctc_number) : undefined,
      ctc_date_issued: ctc_date_issued !== undefined ? String(ctc_date_issued) : undefined,
      ctc_place_issued: ctc_place_issued !== undefined ? String(ctc_place_issued) : undefined,
      signatory_official_id: Number(signatory_official_id),
      is_oic_signing,
      is_override,
      blotter_override_reason
    };

    const result = createIssuance(input, req.user, req.clientIp);
    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof IssuanceError) {
      const responseBody: any = { error: error.message };
      if (error.cases) {
        responseBody.cases = error.cases;
      }
      res.status(error.statusCode).json(responseBody);
      return;
    }
    console.error('Error creating certificate issuance:', error);
    res.status(500).json({ error: 'Internal server error creating certificate issuance' });
  }
}

/**
 * GET /api/issuances
 * History of issued certificates with multi-parameter filtering and pagination.
 */
export async function getIssuancesListController(req: Request, res: Response): Promise<void> {
  try {
    const {
      start_date,
      end_date,
      template_id,
      issued_by_user_id,
      had_active_blotter,
      search,
      page,
      limit
    } = req.query;

    const queryParams: IssuanceQueryParams = {
      start_date: typeof start_date === 'string' ? start_date : undefined,
      end_date: typeof end_date === 'string' ? end_date : undefined,
      template_id: template_id !== undefined ? String(template_id) : undefined,
      issued_by_user_id: issued_by_user_id !== undefined ? String(issued_by_user_id) : undefined,
      had_active_blotter: had_active_blotter !== undefined ? String(had_active_blotter) : undefined,
      search: typeof search === 'string' ? search : undefined,
      page: page !== undefined ? String(page) : undefined,
      limit: limit !== undefined ? String(limit) : undefined
    };

    const result = getIssuances(queryParams);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Error fetching issuances history:', error);
    res.status(500).json({ error: 'Internal server error fetching certificate issuances' });
  }
}

/**
 * GET /api/issuances/:id
 * Single issuance detailed inspection with pre-interpolated printable HTML.
 */
export async function getIssuanceByIdController(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid issuance ID' });
      return;
    }

    const issuance = getIssuanceById(id);
    if (!issuance) {
      res.status(404).json({ error: 'Certificate issuance not found' });
      return;
    }

    res.status(200).json(issuance);
  } catch (error: any) {
    console.error('Error fetching issuance by id:', error);
    res.status(500).json({ error: 'Internal server error fetching certificate issuance' });
  }
}
