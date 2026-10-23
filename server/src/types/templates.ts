import { Resident } from './resident';
import { BlotterRecord } from './blotter';

export type PaperSize = 'short' | 'a4' | 'long';
export type TemplateCategory = 'certificate' | 'blotter';

export interface HeaderConfig {
  show_left_seal?: boolean;
  show_right_seal?: boolean;
  left_seal_url?: string;
  right_seal_url?: string;
  seal_size?: 'sm' | 'md' | 'lg';
  show_control_number?: boolean;
  border_style?: 'double' | 'solid' | 'thin' | 'none';
  alignment?: 'center' | 'left';
  office_subtitle?: string;
  sub_header_html?: string;
}

export interface CertificateTemplate {
  id: number;
  template_code: string;
  template_name: string;
  template_category?: TemplateCategory;
  paper_size?: PaperSize;
  header_html?: string;
  header_config_json?: string;
  title_header: string;
  body_html: string;
  footer_html?: string;
  docx_filename?: string;
  show_officials_sidebar: number;
  default_fee: number;
  requires_blotter_check: number;
  is_active: number;
  updated_by: number | null;
  updated_at: string;
}

export interface UpdateTemplateInput {
  template_name?: string;
  template_category?: TemplateCategory;
  paper_size?: PaperSize;
  header_html?: string;
  header_config_json?: string;
  title_header?: string;
  body_html?: string;
  footer_html?: string;
  docx_filename?: string;
  show_officials_sidebar?: number;
  default_fee?: number;
  requires_blotter_check?: number;
  is_active?: number;
}

export interface TemplateInterpolationContext {
  resident?: Partial<Resident> | null;
  blotter?: Partial<BlotterRecord> | null;
  purpose?: string;
  or_number?: string;
  amount_paid?: number | string;
  control_number?: string;
  ctc_number?: string;
  ctc_date_issued?: string;
  ctc_place_issued?: string;
  signatory_official_id?: number | null;
  is_oic_signing?: boolean | number;
  transaction_date?: Date | string;
  [key: string]: any;
}
