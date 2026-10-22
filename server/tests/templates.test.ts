import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import bcryptjs from 'bcryptjs';
import { app } from '../src/index';
import { db, initDb, closeDb } from '../src/db/connection';
import { initSchema } from '../src/db/init';
import { seed } from '../src/db/seed';
import * as auditService from '../src/services/audit.service';
import {
  interpolateTemplate,
  getOrdinalSuffix,
  formatBirthdate,
  calculateAge,
  getOfficialsSidebarData
} from '../src/services/template.service';
import { CertificateTemplate, TemplateInterpolationContext } from '../src/types/templates';

describe('Certificate Templates & Template Engine Test Suite (templates.test.ts)', () => {
  const testDbFile = path.resolve(__dirname, '../../data/test_templates_suite.sqlite');

  let adminToken: string;
  let clerkToken: string;
  let treasurerToken: string;
  let luponToken: string;

  beforeAll(async () => {
    // Clean up any stale test database
    const filesToClean = [
      testDbFile,
      `${testDbFile}-wal`,
      `${testDbFile}-shm`
    ];
    for (const f of filesToClean) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // Ignore
        }
      }
    }

    initDb(testDbFile);
    initSchema();
    seed();

    // Ensure staff roles exist
    const passHash = bcryptjs.hashSync('matrix_pass_123', 10);
    db.prepare(`
      INSERT INTO users (username, password_hash, full_name, role, is_active)
      VALUES 
        ('tpl_clerk', ?, 'Clerk Member', 'Clerk', 1),
        ('tpl_treasurer', ?, 'Treasurer Member', 'Treasurer', 1),
        ('tpl_lupon', ?, 'Lupon Member', 'Lupon', 1)
      ON CONFLICT(username) DO UPDATE SET
        password_hash = excluded.password_hash,
        role = excluded.role,
        is_active = excluded.is_active
    `).run(passHash, passHash, passHash);

    // Acquire tokens
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.token;

    const clerkLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'tpl_clerk', password: 'matrix_pass_123' });
    clerkToken = clerkLogin.body.token;

    const treasurerLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'tpl_treasurer', password: 'matrix_pass_123' });
    treasurerToken = treasurerLogin.body.token;

    const luponLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'tpl_lupon', password: 'matrix_pass_123' });
    luponToken = luponLogin.body.token;
  });

  afterAll(() => {
    closeDb();
    const filesToClean = [
      testDbFile,
      `${testDbFile}-wal`,
      `${testDbFile}-shm`
    ];
    for (const f of filesToClean) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {
          // Ignore
        }
      }
    }
  });

  describe('1. Template Retrieval & Configuration Endpoints', () => {
    it('GET /api/templates returns default seed templates', async () => {
      const res = await request(app)
        .get('/api/templates')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const codes = res.body.map((t: CertificateTemplate) => t.template_code);
      expect(codes).toContain('BRGY_CLEARANCE');
      expect(codes).toContain('INDIGENCY');
      expect(codes).toContain('RESIDENCY');
      expect(codes).toContain('JOBSEEKER');
    });

    it('GET /api/templates/:id returns single template by numeric ID or code', async () => {
      // Fetch by template_code
      const codeRes = await request(app)
        .get('/api/templates/BRGY_CLEARANCE')
        .set('Authorization', `Bearer ${clerkToken}`);

      expect(codeRes.status).toBe(200);
      expect(codeRes.body.template_code).toBe('BRGY_CLEARANCE');
      expect(codeRes.body.title_header).toBe('BARANGAY CLEARANCE');
      expect(codeRes.body.body_html).toBeDefined();
      expect(codeRes.body.show_officials_sidebar).toBe(1);

      // Fetch by numeric ID
      const numId = codeRes.body.id;
      const idRes = await request(app)
        .get(`/api/templates/${numId}`)
        .set('Authorization', `Bearer ${treasurerToken}`);

      expect(idRes.status).toBe(200);
      expect(idRes.body.id).toBe(numId);
      expect(idRes.body.template_code).toBe('BRGY_CLEARANCE');
    });

    it('GET /api/templates/:id returns 404 for non-existent template', async () => {
      const res = await request(app)
        .get('/api/templates/UNKNOWN_TEMPLATE_XYZ')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Template not found');
    });

    it('Admin can PUT /api/templates/:id to update text, fee, and sidebar with audit diff', async () => {
      const initial = db.prepare(`SELECT * FROM certificate_templates WHERE template_code = 'RESIDENCY'`).get() as CertificateTemplate;
      expect(initial).toBeDefined();

      const updatePayload = {
        title_header: 'CERTIFICATE OF RESIDENCY & GOOD STANDING',
        default_fee: 75.0,
        show_officials_sidebar: 0,
        body_html: '<p>Updated residency body for {{full_name}}.</p>'
      };

      const res = await request(app)
        .put(`/api/templates/${initial.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.title_header).toBe('CERTIFICATE OF RESIDENCY & GOOD STANDING');
      expect(res.body.default_fee).toBe(75.0);
      expect(res.body.show_officials_sidebar).toBe(0);
      expect(res.body.body_html).toBe('<p>Updated residency body for {{full_name}}.</p>');

      // Verify audit log has been recorded
      const auditLog = db.prepare(`
        SELECT action, entity_type, entity_id, old_data_json, new_data_json
        FROM audit_logs
        WHERE entity_type = 'template' AND entity_id = ? AND action = 'UPDATE'
        ORDER BY id DESC LIMIT 1
      `).get(initial.id) as {
        action: string;
        entity_type: string;
        entity_id: number;
        old_data_json: string;
        new_data_json: string;
      } | undefined;

      expect(auditLog).toBeDefined();
      const oldDiff = JSON.parse(auditLog!.old_data_json);
      const newDiff = JSON.parse(auditLog!.new_data_json);

      expect(oldDiff.title_header).toBe(initial.title_header);
      expect(newDiff.title_header).toBe('CERTIFICATE OF RESIDENCY & GOOD STANDING');
      expect(oldDiff.default_fee).toBe(initial.default_fee);
      expect(newDiff.default_fee).toBe(75.0);
      expect(oldDiff.show_officials_sidebar).toBe(initial.show_officials_sidebar);
      expect(newDiff.show_officials_sidebar).toBe(0);
    });

    it('RBAC: non-admin roles cannot PUT /api/templates/:id (403 Forbidden)', async () => {
      const clerkRes = await request(app)
        .put('/api/templates/1')
        .set('Authorization', `Bearer ${clerkToken}`)
        .send({ default_fee: 100 });
      expect(clerkRes.status).toBe(403);

      const treasurerRes = await request(app)
        .put('/api/templates/1')
        .set('Authorization', `Bearer ${treasurerToken}`)
        .send({ default_fee: 100 });
      expect(treasurerRes.status).toBe(403);

      const luponRes = await request(app)
        .put('/api/templates/1')
        .set('Authorization', `Bearer ${luponToken}`)
        .send({ default_fee: 100 });
      expect(luponRes.status).toBe(403);
    });
  });

  describe('2. Template Placeholder Interpolation Engine Accuracy', () => {
    it('resolves all 20 standard placeholders correctly in a single template', () => {
      const sampleTemplateHtml = `
        <div>
          <p>Resident: {{full_name}}, Age: {{age}}, DOB: {{birthdate}}, Sex: {{sex}}, Status: {{civil_status}}</p>
          <p>Pronouns: {{pronoun_he_she}} and {{pronoun_his_her}}</p>
          <p>Purok: {{purok}}, Address: {{address}}</p>
          <p>Purpose: {{purpose}}, Control: {{control_number}}, OR: {{or_number}}, Amount: {{amount_paid}}</p>
          <p>Date: {{day_ordinal}} day of {{month_year}}</p>
          <p>Punong Barangay: {{punong_barangay}}, Sec: {{barangay_secretary}}, Treas: {{barangay_treasurer}}</p>
          <p>Signatory: {{signatory_name}} - {{signatory_title}}</p>
        </div>
      `;

      const context: TemplateInterpolationContext = {
        resident: {
          first_name: 'Juan',
          middle_name: 'Mendoza',
          last_name: 'Dela Cruz',
          suffix: 'Jr.',
          birthdate: '1990-10-21',
          sex: 'Male',
          civil_status: 'Married',
          purok: 'Purok 1',
          house_no_street: '123 Rizal St.'
        },
        purpose: 'Local Employment',
        control_number: 'CERT-2026-00042',
        or_number: 'OR-998877',
        amount_paid: 50.0,
        transaction_date: '2026-10-21T08:00:00Z',
        is_oic_signing: false
      };

      const result = interpolateTemplate(sampleTemplateHtml, context);

      expect(result).toContain('JUAN MENDOZA DELA CRUZ JR.');
      expect(result).toContain('Age: 36'); // 2026 - 1990
      expect(result).toContain('DOB: October 21, 1990');
      expect(result).toContain('Sex: Male');
      expect(result).toContain('Status: Married');
      expect(result).toContain('Pronouns: he and his');
      expect(result).toContain('Purok: Purok 1');
      expect(result).toContain('Address: 123 Rizal St., Purok 1, Barangay San Jose, Antipolo City, Rizal');
      expect(result).toContain('Purpose: Local Employment');
      expect(result).toContain('Control: CERT-2026-00042');
      expect(result).toContain('OR: OR-998877');
      expect(result).toContain('Amount: ₱50.00');
      expect(result).toContain('Date: 21st day of October 2026');
      expect(result).toContain('HON. ROBERTO C. SANTOS');
      expect(result).toContain('JOSEPHINE K. DELOS REYES');
      expect(result).toContain('RICARDO E. VILLANUEVA');
      expect(result).toContain('Signatory: HON. ROBERTO C. SANTOS - Punong Barangay');
    });

    it('formats full_name in uppercase and trims properly without double spaces when middle name or suffix is empty', () => {
      // No middle name, no suffix
      const ctx1: TemplateInterpolationContext = {
        resident: {
          first_name: 'Juan',
          middle_name: '',
          last_name: 'Dela Cruz',
          suffix: ''
        }
      };
      const res1 = interpolateTemplate('{{full_name}}', ctx1);
      expect(res1).toBe('JUAN DELA CRUZ');

      // Whitespace in middle name
      const ctx2: TemplateInterpolationContext = {
        resident: {
          first_name: 'Maria   ',
          middle_name: '   ',
          last_name: 'Santos',
          suffix: null as any
        }
      };
      const res2 = interpolateTemplate('{{full_name}}', ctx2);
      expect(res2).toBe('MARIA SANTOS');

      // With suffix only
      const ctx3: TemplateInterpolationContext = {
        resident: {
          first_name: 'Danilo',
          middle_name: '',
          last_name: 'Bautista',
          suffix: 'III'
        }
      };
      const res3 = interpolateTemplate('{{full_name}}', ctx3);
      expect(res3).toBe('DANILO BAUTISTA III');
    });

    it('resolves pronouns correctly for male and female residents', () => {
      const maleCtx: TemplateInterpolationContext = {
        resident: { sex: 'Male' }
      };
      const maleRes = interpolateTemplate('{{pronoun_he_she}} - {{pronoun_his_her}}', maleCtx);
      expect(maleRes).toBe('he - his');

      const femaleCtx: TemplateInterpolationContext = {
        resident: { sex: 'Female' }
      };
      const femaleRes = interpolateTemplate('{{pronoun_he_she}} - {{pronoun_his_her}}', femaleCtx);
      expect(femaleRes).toBe('she - her');
    });

    it('resolves date ordinals and formatted birthdate properly', () => {
      // Test all required ordinals
      expect(getOrdinalSuffix(1)).toBe('1st');
      expect(getOrdinalSuffix(2)).toBe('2nd');
      expect(getOrdinalSuffix(3)).toBe('3rd');
      expect(getOrdinalSuffix(4)).toBe('4th');
      expect(getOrdinalSuffix(11)).toBe('11th');
      expect(getOrdinalSuffix(12)).toBe('12th');
      expect(getOrdinalSuffix(13)).toBe('13th');
      expect(getOrdinalSuffix(21)).toBe('21st');
      expect(getOrdinalSuffix(22)).toBe('22nd');
      expect(getOrdinalSuffix(23)).toBe('23rd');
      expect(getOrdinalSuffix(31)).toBe('31st');

      // Formatted birthdate
      expect(formatBirthdate('1990-10-21')).toBe('October 21, 1990');
      expect(formatBirthdate('2000-01-01')).toBe('January 1, 2000');
      expect(formatBirthdate('1985-12-25')).toBe('December 25, 1985');
    });

    it('resolves address properly, omitting leading comma when house_no_street is empty', () => {
      // With house_no_street
      const ctxWithStreet: TemplateInterpolationContext = {
        resident: {
          house_no_street: '75 Bonifacio St.',
          purok: 'Purok 1'
        }
      };
      const resWith = interpolateTemplate('{{address}}', ctxWithStreet);
      expect(resWith).toBe('75 Bonifacio St., Purok 1, Barangay San Jose, Antipolo City, Rizal');

      // Without house_no_street (empty string or undefined)
      const ctxNoStreet: TemplateInterpolationContext = {
        resident: {
          house_no_street: '',
          purok: 'Sitio Centro'
        }
      };
      const resNo = interpolateTemplate('{{address}}', ctxNoStreet);
      expect(resNo).toBe('Sitio Centro, Barangay San Jose, Antipolo City, Rizal');
      expect(resNo.startsWith(',')).toBe(false);
    });

    it('resolves signatory and OIC title resolution', () => {
      // When is_oic_signing is false -> Punong Barangay
      const regularCtx: TemplateInterpolationContext = {
        is_oic_signing: false
      };
      const regularRes = interpolateTemplate('{{signatory_title}}', regularCtx);
      expect(regularRes).toBe('Punong Barangay');

      // When is_oic_signing is true -> Sangguniang Barangay Member / OIC
      const oicCtx: TemplateInterpolationContext = {
        is_oic_signing: true
      };
      const oicRes = interpolateTemplate('{{signatory_title}}', oicCtx);
      expect(oicRes).toBe('Sangguniang Barangay Member / OIC');

      // With specific signatory official
      const kagawad = db.prepare(`SELECT id, full_name, position FROM barangay_officials WHERE position = 'Sangguniang Barangay Member' LIMIT 1`).get() as { id: number; full_name: string; position: string };
      const signCtx: TemplateInterpolationContext = {
        signatory_official_id: kagawad.id,
        is_oic_signing: true
      };
      const signRes = interpolateTemplate('{{signatory_name}} - {{signatory_title}}', signCtx);
      expect(signRes).toBe(`${kagawad.full_name} - Sangguniang Barangay Member / OIC`);
    });

    it('resolves active officials snapshot accurately from the database', () => {
      const template = '{{punong_barangay}} | {{barangay_secretary}} | {{barangay_treasurer}}';
      const output = interpolateTemplate(template);

      expect(output).toContain('HON. ROBERTO C. SANTOS');
      expect(output).toContain('JOSEPHINE K. DELOS REYES');
      expect(output).toContain('RICARDO E. VILLANUEVA');
    });

    it('leaves unrecognized or malformed placeholders untouched without crashing', () => {
      const template = 'Hello {{unknown_placeholder}} and {{malformed_tag!';
      const output = interpolateTemplate(template);

      expect(output).toContain('{{unknown_placeholder}}');
      expect(output).toContain('{{malformed_tag!');
    });

    it('resolves or_number and amount_paid for free/exempt certificates', () => {
      const ctx: TemplateInterpolationContext = {
        amount_paid: 0,
        or_number: ''
      };
      const output = interpolateTemplate('OR: {{or_number}}, Fee: {{amount_paid}}', ctx);
      expect(output).toContain('OR: FREE / EXEMPT');
      expect(output).toContain('Fee: FREE');
    });
  });

  describe('3. Left Sidebar Council Roster Data', () => {
    it('getOfficialsSidebarData() returns active officials ordered by rank_order ASC with committee subtitles', () => {
      const sidebar = getOfficialsSidebarData();

      expect(Array.isArray(sidebar)).toBe(true);
      expect(sidebar.length).toBeGreaterThanOrEqual(11);

      // Verify rank_order order
      for (let i = 0; i < sidebar.length - 1; i++) {
        expect(sidebar[i].rank_order).toBeLessThanOrEqual(sidebar[i + 1].rank_order);
      }

      // Verify structured roles
      expect(sidebar.punong_barangay).toBeDefined();
      expect(sidebar.punong_barangay!.position).toBe('Punong Barangay');
      expect(sidebar.punong_barangay!.rank_order).toBe(1);

      expect(sidebar.kagawads).toBeDefined();
      expect(sidebar.kagawads!.length).toBe(7);
      for (const k of sidebar.kagawads!) {
        expect(k.position).toBe('Sangguniang Barangay Member');
        expect(k.committee).toBeTruthy(); // Kagawads have committee subtitles
      }

      expect(sidebar.sk_chairperson).toBeDefined();
      expect(sidebar.sk_chairperson!.position).toBe('SK Chairperson');

      expect(sidebar.secretary).toBeDefined();
      expect(sidebar.secretary!.position).toBe('Barangay Secretary');

      expect(sidebar.treasurer).toBeDefined();
      expect(sidebar.treasurer!.position).toBe('Barangay Treasurer');
    });
  });

  describe('4. Transaction Atomicity & Rollback Guarantees', () => {
    it('rolls back template update if audit logging throws an error', async () => {
      const template = db.prepare(`SELECT * FROM certificate_templates WHERE template_code = 'JOBSEEKER'`).get() as CertificateTemplate;
      expect(template).toBeDefined();

      const originalTitle = template.title_header;

      const spy = vi.spyOn(auditService, 'logAuditEvent').mockImplementationOnce(() => {
        throw new Error('Simulated atomic power brownout during template audit log');
      });

      const res = await request(app)
        .put(`/api/templates/${template.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title_header: 'ROLLED_BACK_HEADER_TEST' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Failed to update template');

      // Verify template remains unchanged in the database
      const reFetched = db.prepare(`SELECT title_header FROM certificate_templates WHERE id = ?`).get(template.id) as { title_header: string };
      expect(reFetched.title_header).toBe(originalTitle);

      spy.mockRestore();
    });
  });

  describe('5. No-Op Update Suppression', () => {
    it('sending PUT /api/templates/:id with empty {} or identical values returns 200 without creating an audit log', async () => {
      const template = db.prepare(`SELECT * FROM certificate_templates WHERE template_code = 'INDIGENCY'`).get() as CertificateTemplate;
      expect(template).toBeDefined();

      const initialAuditCount = (db.prepare('SELECT count(*) as count FROM audit_logs').get() as { count: number }).count;

      // 1. Send empty object {}
      const resEmpty = await request(app)
        .put(`/api/templates/${template.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(resEmpty.status).toBe(200);
      expect(resEmpty.body.id).toBe(template.id);

      const afterEmptyAuditCount = (db.prepare('SELECT count(*) as count FROM audit_logs').get() as { count: number }).count;
      expect(afterEmptyAuditCount).toBe(initialAuditCount);

      // 2. Send identical values
      const resIdentical = await request(app)
        .put(`/api/templates/${template.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title_header: template.title_header,
          body_html: template.body_html,
          show_officials_sidebar: template.show_officials_sidebar,
          default_fee: template.default_fee,
          is_active: template.is_active
        });

      expect(resIdentical.status).toBe(200);
      const afterIdenticalAuditCount = (db.prepare('SELECT count(*) as count FROM audit_logs').get() as { count: number }).count;
      expect(afterIdenticalAuditCount).toBe(initialAuditCount);
    });
  });
});
