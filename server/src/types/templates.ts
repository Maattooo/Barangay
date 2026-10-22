import { Resident } from './resident';

export interface CertificateTemplate {
  id: number;
  template_code: string;
  template_name: string;
  title_header: string;
  body_html: string;
  show_officials_sidebar: number;
  default_fee: number;
  requires_blotter_check: number;
  is_active: number;
  updated_by: number | null;
  updated_at: string;
}

export interface UpdateTemplateInput {
  title_header?: string;
  body_html?: string;
  show_officials_sidebar?: number;
  default_fee?: number;
  is_active?: number;
}

export interface TemplateInterpolationContext {
  resident?: Partial<Resident> | null;
  purpose?: string;
  or_number?: string;
  amount_paid?: number | string;
  control_number?: string;
  signatory_official_id?: number | null;
  is_oic_signing?: boolean | number;
  transaction_date?: Date | string;
  [key: string]: any;
}
