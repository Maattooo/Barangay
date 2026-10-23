import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FileCode2,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Columns,
  DollarSign,
  Plus,
  Eye,
  Edit3,
  X,
  Printer,
  FileUp,
  FileDown,
  RefreshCw,
  LayoutTemplate,
  CopyCheck,
  Scale,
  SplitSquareVertical,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import api from '../services/api';
import { CertificateTemplate, UpdateTemplateInput } from '../types/admin';
import {
  BarangayOfficial,
  HeaderConfig,
  PaperSize,
  TemplateCategory
} from '../types/certificates';
import RichTextTemplateEditor, {
  RichTextTemplateEditorHandle
} from '../components/templates/RichTextTemplateEditor';
import PlaceholderChipBar from '../components/templates/PlaceholderChipBar';
import CertificatePrintSheet, {
  PAPER_SIZE_SPECS
} from '../components/certificates/CertificatePrintSheet';

const DEFAULT_CERT_HEADER_HTML = `<div style="text-align: center; line-height: 1.35;">
  <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0;">Republic of the Philippines</p>
  <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Province of {{province_name}}</p>
  <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Municipality of {{municipality_name}}</p>
  <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; margin: 4px 0 2px 0;">BARANGAY {{barangay_name}}</h2>
  <p style="font-size: 11px; font-style: italic; margin: 0;">Office of the Punong Barangay</p>
</div>`;

const DEFAULT_BLOTTER_HEADER_HTML = `<div style="text-align: center; line-height: 1.35;">
  <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0;">Republic of the Philippines</p>
  <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Province of {{province_name}}</p>
  <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0;">Municipality of {{municipality_name}}</p>
  <h2 style="font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; margin: 4px 0 2px 0;">BARANGAY {{barangay_name}}</h2>
  <p style="font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin: 2px 0 0 0;">OFFICE OF THE LUPONG TAGAPAMAYAPA</p>
</div>`;

export const TemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | TemplateCategory>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // View mode: Editor vs Split View vs Live Print Preview
  const [activeTab, setActiveTab] = useState<'editor' | 'split' | 'preview'>('editor');

  // Active template editing state
  const [titleHeader, setTitleHeader] = useState('');
  const [paperSize, setPaperSize] = useState<PaperSize>('short');
  const [headerHtml, setHeaderHtml] = useState(DEFAULT_CERT_HEADER_HTML);
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>({
    showLeftSeal: true,
    showRightSeal: true,
    sealSizePx: 64,
    headerAlign: 'center',
    borderStyle: 'double',
    subHeaderTitle: 'Office of the Punong Barangay',
    showControlNumberBox: true
  });
  const [bodyHtml, setBodyHtml] = useState('');
  const [footerHtml, setFooterHtml] = useState('');
  const [showOfficialsSidebar, setShowOfficialsSidebar] = useState(1);
  const [defaultFee, setDefaultFee] = useState<number>(50.0);

  // Header panel collapsible state & active cursor target ('body' vs 'header')
  const [isHeaderStudioOpen, setIsHeaderStudioOpen] = useState(true);
  const [activeEditorTarget, setActiveEditorTarget] = useState<'body' | 'header'>('body');

  // MS Word (.docx) workflow state
  const [isImportingDocx, setIsImportingDocx] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isReloadingDocx, setIsReloadingDocx] = useState(false);
  const [isSyncingHeader, setIsSyncingHeader] = useState(false);
  const [detectedDocxTags, setDetectedDocxTags] = useState<string[] | null>(null);
  const docxFileInputRef = useRef<HTMLInputElement>(null);

  // System and officials metadata for real-time print preview
  const [officials, setOfficials] = useState<BarangayOfficial[]>([]);
  const [barangayName, setBarangayName] = useState('POBLACION');
  const [municipalityName, setMunicipalityName] = useState('LOS BAÑOS');
  const [provinceName, setProvinceName] = useState('LAGUNA');
  const [barangayLogoUrl, setBarangayLogoUrl] = useState('');
  const [cityLogoUrl, setCityLogoUrl] = useState('');

  // Create Template Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createCategory, setCreateCategory] = useState<TemplateCategory>('certificate');
  const [createCode, setCreateCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createPaperSize, setCreatePaperSize] = useState<PaperSize>('short');
  const [createFee, setCreateFee] = useState<number>(50);
  const [createSidebar, setCreateSidebar] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const editorRef = useRef<RichTextTemplateEditorHandle>(null);
  const headerEditorRef = useRef<RichTextTemplateEditorHandle>(null);

  // Load system info and officials for live dual-seal print preview
  useEffect(() => {
    let isMounted = true;
    api
      .getSystemInfo()
      .then((info) => {
        if (!isMounted) return;
        const s = info?.settings || {};
        if (s.barangay_name) setBarangayName(s.barangay_name as string);
        if (s.municipality_name || s.municipality)
          setMunicipalityName((s.municipality_name || s.municipality) as string);
        if (s.province_name || s.province)
          setProvinceName((s.province_name || s.province) as string);
        if (s.barangay_logo_url) setBarangayLogoUrl(s.barangay_logo_url as string);
        if (s.city_logo_url) setCityLogoUrl(s.city_logo_url as string);
      })
      .catch(() => {});

    api
      .getOfficials()
      .then((data) => {
        if (!isMounted) return;
        setOfficials(data.filter((o) => o.is_active === 1));
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const loadTemplateData = useCallback((tmpl: CertificateTemplate) => {
    setTitleHeader(tmpl.title_header);
    setPaperSize(tmpl.paper_size || 'short');
    const defaultHdr =
      tmpl.template_category === 'blotter'
        ? DEFAULT_BLOTTER_HEADER_HTML
        : DEFAULT_CERT_HEADER_HTML;
    setHeaderHtml(tmpl.header_html || defaultHdr);

    let parsedCfg: HeaderConfig = {
      showLeftSeal: true,
      showRightSeal: true,
      sealSizePx: 64,
      headerAlign: 'center',
      borderStyle: 'double',
      subHeaderTitle:
        tmpl.template_category === 'blotter'
          ? 'Office of the Lupong Tagapamayapa'
          : 'Office of the Punong Barangay',
      showControlNumberBox: true
    };
    if (tmpl.header_config_json) {
      try {
        const obj = JSON.parse(tmpl.header_config_json);
        if (obj && typeof obj === 'object') {
          parsedCfg = { ...parsedCfg, ...obj };
        }
      } catch {
        // ignore invalid json
      }
    }
    setHeaderConfig(parsedCfg);
    setBodyHtml(tmpl.body_html);
    setFooterHtml(tmpl.footer_html || '');
    setShowOfficialsSidebar(Number(tmpl.show_officials_sidebar));
    setDefaultFee(Number(tmpl.default_fee));
    setDetectedDocxTags(null);
    setSaveSuccess(null);
    setError(null);
  }, []);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTemplates();
      setTemplates(data);
      if (data.length > 0 && selectedTemplateId === null) {
        setSelectedTemplateId(data[0].id);
        loadTemplateData(data[0]);
      } else if (selectedTemplateId !== null) {
        const found = data.find((t) => t.id === selectedTemplateId);
        if (found) loadTemplateData(found);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch certificate templates.');
    } finally {
      setLoading(false);
    }
  }, [selectedTemplateId, loadTemplateData]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSelectTemplate = (tmpl: CertificateTemplate) => {
    setSelectedTemplateId(tmpl.id);
    loadTemplateData(tmpl);
  };

  const handleInsertPlaceholder = (placeholder: string) => {
    if (activeEditorTarget === 'header' && headerEditorRef.current) {
      headerEditorRef.current.insertText(placeholder);
      return;
    }
    if (editorRef.current) {
      editorRef.current.insertText(placeholder);
    } else {
      setBodyHtml((prev) => prev + placeholder);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedTemplateId) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(null);

    try {
      const currentBodyHtml = editorRef.current ? editorRef.current.getHTML() : bodyHtml;
      const currentHeaderHtml = headerEditorRef.current
        ? headerEditorRef.current.getHTML()
        : headerHtml;

      const payload: UpdateTemplateInput = {
        title_header: titleHeader.trim(),
        paper_size: paperSize,
        header_html: currentHeaderHtml,
        header_config_json: JSON.stringify(headerConfig),
        body_html: currentBodyHtml,
        footer_html: footerHtml,
        show_officials_sidebar: showOfficialsSidebar,
        default_fee: Number(defaultFee)
      };

      const updated = await api.updateTemplate(selectedTemplateId, payload);
      setTemplates((prev) =>
        prev.map((t) => (t.id === selectedTemplateId ? { ...t, ...updated } : t))
      );
      setBodyHtml(updated.body_html);
      if (updated.header_html) setHeaderHtml(updated.header_html);
      setSaveSuccess('Template saved & synced to MS Word (.docx) file!');
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save certificate template.');
    } finally {
      setSaving(false);
    }
  };

  const handleSyncHeaderToAll = async () => {
    if (isSyncingHeader) return;
    setIsSyncingHeader(true);
    setError(null);
    setSaveSuccess(null);
    try {
      const currentHeaderHtml = headerEditorRef.current
        ? headerEditorRef.current.getHTML()
        : headerHtml;
      const configStr = JSON.stringify(headerConfig);
      const res = await api.syncHeaderAcrossTemplates({
        header_html: currentHeaderHtml,
        header_config_json: configStr
      });
      setTemplates((prev) =>
        prev.map((t) => ({
          ...t,
          header_html: currentHeaderHtml,
          header_config_json: configStr
        }))
      );
      setSaveSuccess(`Header structure applied across all ${res.updatedCount} templates!`);
      setTimeout(() => setSaveSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to synchronize header across templates.');
    } finally {
      setIsSyncingHeader(false);
    }
  };

  const handleExportDocx = async () => {
    if (!selectedTemplateId || isExportingDocx) return;
    setIsExportingDocx(true);
    setError(null);
    try {
      await api.exportTemplateDocx(selectedTemplateId, paperSize);
    } catch (err: any) {
      setError(err?.message || 'Failed to download MS Word (.docx) template.');
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handleImportDocxFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTemplateId) return;

    setIsImportingDocx(true);
    setError(null);
    setSaveSuccess(null);
    try {
      const res = await api.importTemplateDocx(selectedTemplateId, file);
      setTemplates((prev) =>
        prev.map((t) => (t.id === selectedTemplateId ? { ...t, ...res.template } : t))
      );
      loadTemplateData(res.template);
      setDetectedDocxTags(res.detectedPlaceholders || []);
      setSaveSuccess(
        `MS Word (.docx) imported! Preserved ${res.detectedPlaceholders?.length || 0} dynamic placeholder tags.`
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to import MS Word (.docx) file.');
    } finally {
      setIsImportingDocx(false);
      if (docxFileInputRef.current) {
        docxFileInputRef.current.value = '';
      }
    }
  };

  const handleReloadDocxFromDisk = async () => {
    if (!selectedTemplateId || isReloadingDocx) return;
    setIsReloadingDocx(true);
    setError(null);
    setSaveSuccess(null);
    try {
      const res = await api.reloadTemplateDocxFromDisk(selectedTemplateId);
      setTemplates((prev) =>
        prev.map((t) => (t.id === selectedTemplateId ? { ...t, ...res.template } : t))
      );
      loadTemplateData(res.template);
      setDetectedDocxTags(res.detectedPlaceholders || []);
      setSaveSuccess(
        `Reloaded template from disk (.docx)! Found ${res.detectedPlaceholders?.length || 0} placeholder tags.`
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to reload .docx template from disk.');
    } finally {
      setIsReloadingDocx(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createCode.trim() || !createName.trim() || !createTitle.trim()) {
      setCreateError('Template Code, Name, and Title Header are required.');
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const defaultBody =
        createCategory === 'blotter'
          ? `<p>Barangay Case No.: <strong>{{case_number}}</strong> | For: <strong>{{incident_type}}</strong></p><p>Complainant: <strong>{{complainant_name}}</strong> vs. Respondent: <strong>{{respondent_name}}</strong></p><p>{{incident_details}}</p><p>Issued this <strong>{{day_ordinal}} day of {{month_year}}</strong>.</p>`
          : `<p>TO WHOM IT MAY CONCERN:</p><p>This is to certify that <strong>{{full_name}}</strong>, {{age}} years old, {{civil_status}}, Filipino, is a bona fide resident of {{address}}.</p><p>This certification is issued upon the request of the above-named person for <strong>{{purpose}}</strong>.</p><p>Issued this <strong>{{day_ordinal}} day of {{month_year}}</strong> at the Office of the Punong Barangay.</p>`;

      const newTmpl = await api.createTemplate({
        template_code: createCode.trim().toUpperCase(),
        template_name: createName.trim(),
        template_category: createCategory,
        title_header: createTitle.trim().toUpperCase(),
        paper_size: createPaperSize,
        header_html:
          createCategory === 'blotter' ? DEFAULT_BLOTTER_HEADER_HTML : DEFAULT_CERT_HEADER_HTML,
        body_html: defaultBody,
        show_officials_sidebar: createCategory === 'blotter' ? 0 : createSidebar,
        default_fee: createCategory === 'blotter' ? 0 : Number(createFee) || 0
      });

      setTemplates((prev) => [...prev, newTmpl]);
      setSelectedTemplateId(newTmpl.id);
      loadTemplateData(newTmpl);
      setIsCreateModalOpen(false);
      setCreateCode('');
      setCreateName('');
      setCreateTitle('');
      setCreateFee(50);
      setCreateSidebar(1);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to create new template.');
    } finally {
      setIsCreating(false);
    }
  };

  const interpolateSampleText = useCallback(
    (rawHtml: string) => {
      const now = new Date();
      const day = now.getDate();
      const dayOrdinal =
        day === 1 || day === 21 || day === 31
          ? `${day}st`
          : day === 2 || day === 22
          ? `${day}nd`
          : day === 3 || day === 23
          ? `${day}rd`
          : `${day}th`;
      const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const fullDate = now.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });

      const pb = officials.find((o) => o.position === 'Punong Barangay');
      const sec = officials.find((o) => o.position === 'Barangay Secretary');
      const tres = officials.find((o) => o.position === 'Barangay Treasurer');

      return (rawHtml || '')
        .replace(/\{\{barangay_name\}\}/g, barangayName)
        .replace(/\{\{municipality_name\}\}/g, municipalityName)
        .replace(/\{\{province_name\}\}/g, provinceName)
        .replace(/\{\{full_name\}\}/g, 'JUAN MENDOZA DELA CRUZ')
        .replace(/\{\{first_name\}\}/g, 'JUAN')
        .replace(/\{\{last_name\}\}/g, 'DELA CRUZ')
        .replace(/\{\{age\}\}/g, '34')
        .replace(/\{\{birthdate\}\}/g, '1992-05-14')
        .replace(/\{\{sex\}\}/g, 'Male')
        .replace(/\{\{civil_status\}\}/g, 'Single')
        .replace(/\{\{pronoun_he_she\}\}/g, 'he')
        .replace(/\{\{pronoun_his_her\}\}/g, 'his')
        .replace(/\{\{purok\}\}/g, 'Purok 1')
        .replace(/\{\{street\}\}/g, '123 Rizal St.')
        .replace(/\{\{address\}\}/g, '123 Rizal St., Purok 1')
        .replace(/\{\{purpose\}\}/g, 'Local Employment / Valid Identification')
        .replace(/\{\{control_number\}\}/g, 'SAMPLE-2026-00001')
        .replace(/\{\{or_number\}\}/g, 'OR-2026-00042')
        .replace(/\{\{amount_paid\}\}/g, `₱${Number(defaultFee).toFixed(2)}`)
        .replace(/\{\{ctc_number\}\}/g, 'CTC-19283746')
        .replace(/\{\{ctc_date_issued\}\}/g, fullDate)
        .replace(/\{\{ctc_place_issued\}\}/g, `${municipalityName}, ${provinceName}`)
        .replace(/\{\{day_ordinal\}\}/g, dayOrdinal)
        .replace(/\{\{month_year\}\}/g, monthYear)
        .replace(/\{\{date_today\}\}/g, fullDate)
        .replace(/\{\{punong_barangay\}\}/g, pb ? pb.full_name : 'HON. ROBERTO V. SANTOS')
        .replace(/\{\{barangay_secretary\}\}/g, sec ? sec.full_name : 'SEC. MARIA L. REYES')
        .replace(/\{\{barangay_treasurer\}\}/g, tres ? tres.full_name : 'TRS. FELIPE M. CASTRO')
        .replace(/\{\{signatory_name\}\}/g, pb ? pb.full_name : 'HON. ROBERTO V. SANTOS')
        .replace(/\{\{signatory_title\}\}/g, pb ? pb.position : 'Punong Barangay')
        .replace(/\{\{case_number\}\}/g, 'BLT-2026-001')
        .replace(/\{\{complainant_name\}\}/g, 'MARIA SANTOS')
        .replace(/\{\{respondent_name\}\}/g, 'JUAN DELA CRUZ')
        .replace(/\{\{incident_type\}\}/g, 'Property Boundary Dispute')
        .replace(/\{\{incident_location\}\}/g, 'Purok 1, Barangay Poblacion')
        .replace(
          /\{\{incident_details\}\}/g,
          'Dispute regarding residential lot boundary marker along Rizal Street.'
        )
        .replace(/\{\{date_incident\}\}/g, fullDate)
        .replace(/\{\{date_recorded\}\}/g, fullDate)
        .replace(/\{\{status\}\}/g, 'Under Mediation')
        .replace(
          /\{\{settlement_notes\}\}/g,
          'Both parties agreed to conduct a joint relocation survey within 15 days.'
        )
        .replace(/\{\{hearing_date\}\}/g, `${fullDate} at 9:00 AM`);
    },
    [barangayName, municipalityName, provinceName, defaultFee, officials]
  );

  const samplePreviewHtml = useMemo(() => {
    const raw = editorRef.current ? editorRef.current.getHTML() : bodyHtml;
    return interpolateSampleText(raw);
  }, [bodyHtml, interpolateSampleText]);

  const sampleHeaderPreviewHtml = useMemo(() => {
    const raw = headerEditorRef.current ? headerEditorRef.current.getHTML() : headerHtml;
    return interpolateSampleText(raw);
  }, [headerHtml, interpolateSampleText]);

  const filteredTemplates = useMemo(() => {
    if (categoryFilter === 'all') return templates;
    return templates.filter((t) => (t.template_category || 'certificate') === categoryFilter);
  }, [templates, categoryFilter]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const isBlotterTemplate = selectedTemplate?.template_category === 'blotter';
  const activePaperSpec = PAPER_SIZE_SPECS[paperSize];

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-900 text-white rounded-none border border-zinc-900">
            <FileCode2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-zinc-950 uppercase tracking-tight">
              Certificate Templates &amp; Blotter Document Studio
            </h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Customize headers, coupon bond sizes (Short/A4/Long), MS Word (.docx) feeds &amp; dynamic placeholders
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-mono font-medium bg-emerald-50 px-2.5 py-1.5 rounded-none border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{saveSuccess}</span>
            </div>
          )}

          {/* View Mode Switcher */}
          <div className="flex items-center bg-zinc-100 p-0.5 border border-zinc-300 rounded-none">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                activeTab === 'editor'
                  ? 'bg-zinc-900 text-white font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Studio</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('split')}
              className={`px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                activeTab === 'split'
                  ? 'bg-zinc-900 text-white font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Split View</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                activeTab === 'preview'
                  ? 'bg-zinc-900 text-white font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Paper Preview</span>
            </button>
          </div>

          <button
            onClick={() => handleSave()}
            disabled={saving || !selectedTemplate}
            aria-label="Save Template"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-none bg-zinc-900 hover:bg-black text-white text-xs font-mono font-semibold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer shadow-none"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Template</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 rounded-none text-xs font-mono text-red-800 font-medium flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white p-12 rounded-none border border-zinc-200 shadow-none text-center flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
          <p className="text-xs font-mono text-zinc-500">Loading document templates...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Template Selector Sidebar */}
          <div className="lg:col-span-1 space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-mono font-bold text-zinc-700 uppercase tracking-wider">
                Templates ({filteredTemplates.length})
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 uppercase tracking-wider transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>New</span>
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="grid grid-cols-3 border border-zinc-300 bg-zinc-100 p-0.5 font-mono text-[10px] uppercase">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`py-1 font-semibold transition-colors ${
                  categoryFilter === 'all'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                All ({templates.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('certificate')}
                className={`py-1 font-semibold transition-colors ${
                  categoryFilter === 'certificate'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Certs (
                {templates.filter((t) => (t.template_category || 'certificate') === 'certificate')
                  .length}
                )
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('blotter')}
                className={`py-1 font-semibold transition-colors ${
                  categoryFilter === 'blotter'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Blotter (
                {templates.filter((t) => t.template_category === 'blotter').length})
              </button>
            </div>

            <div className="space-y-1">
              {filteredTemplates.map((tmpl) => {
                const isSelected = tmpl.id === selectedTemplateId;
                const isBlotter = tmpl.template_category === 'blotter';
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`w-full text-left p-3 rounded-none border transition-colors flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-50 border-zinc-900 border-l-4 text-zinc-950 font-bold'
                        : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-none mt-0.5 border ${
                        isSelected
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                      }`}
                    >
                      {isBlotter ? (
                        <Scale className="w-3.5 h-3.5" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate text-zinc-950 uppercase tracking-tight">
                        {tmpl.template_name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-mono text-zinc-500 truncate">
                          {tmpl.template_code}
                        </span>
                        <span className="text-[9px] font-mono uppercase px-1 py-0.2 bg-zinc-100 border border-zinc-300 text-zinc-700">
                          {(tmpl.paper_size || 'short').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-zinc-500">
                        {isBlotter ? (
                          <span>KP / Blotter Form</span>
                        ) : (
                          <span>Fee: ₱{Number(tmpl.default_fee).toFixed(2)}</span>
                        )}
                        <span>•</span>
                        <span>{tmpl.show_officials_sidebar ? '28% Sidebar' : 'Full Width'}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Template Editor / Split / Live Preview Area */}
          <div className="lg:col-span-3 space-y-4">
            {selectedTemplate && (activeTab === 'editor' || activeTab === 'split') && (
              <div
                className={
                  activeTab === 'split'
                    ? 'grid grid-cols-1 xl:grid-cols-2 gap-4 items-start'
                    : 'space-y-4'
                }
              >
                <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none space-y-4">
                  {/* MS Word (.docx) Feed & Synchronization Bar */}
                  <div className="bg-zinc-900 text-white p-3 rounded-none border border-zinc-900 flex flex-wrap items-center justify-between gap-2 font-mono">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-zinc-300 shrink-0" />
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                          <span>MS Word (.docx) System Feed</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-emerald-400 border border-zinc-700">
                            {selectedTemplate.docx_filename ||
                              `${selectedTemplate.template_code}.docx`}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400">
                          Edit in-app or feed an MS Word (.docx) file containing{' '}
                          <code className="text-white">{'{{placeholder}}'}</code> tags.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        ref={docxFileInputRef}
                        type="file"
                        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleImportDocxFileChange}
                        data-testid="import-docx-input"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => docxFileInputRef.current?.click()}
                        disabled={isImportingDocx}
                        data-testid="import-docx-btn"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-semibold uppercase bg-white text-zinc-950 hover:bg-zinc-100 rounded-none transition-colors disabled:opacity-50"
                      >
                        {isImportingDocx ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <FileUp className="w-3 h-3" />
                        )}
                        <span>Feed / Import .docx</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleReloadDocxFromDisk}
                        disabled={isReloadingDocx}
                        data-testid="reload-docx-btn"
                        title="Reload from data/templates/word/*.docx on disk"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-medium uppercase bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700 rounded-none transition-colors disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${isReloadingDocx ? 'animate-spin' : ''}`}
                        />
                        <span>Sync Disk .docx</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportDocx}
                        disabled={isExportingDocx}
                        data-testid="export-template-docx-btn"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-medium uppercase bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700 rounded-none transition-colors disabled:opacity-50"
                      >
                        <FileDown className="w-3 h-3" />
                        <span>Download .docx</span>
                      </button>
                    </div>
                  </div>

                  {detectedDocxTags && (
                    <div
                      data-testid="detected-docx-placeholders"
                      className="p-2.5 bg-zinc-50 border border-zinc-300 text-xs font-mono text-zinc-800 flex flex-wrap items-center gap-1.5"
                    >
                      <span className="font-bold uppercase text-[10px] text-zinc-600">
                        Detected .docx Tags ({detectedDocxTags.length}):
                      </span>
                      {detectedDocxTags.length === 0 ? (
                        <span className="text-[11px] text-zinc-500">
                          No {'{{tags}}'} found in uploaded document
                        </span>
                      ) : (
                        detectedDocxTags.map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 bg-white border border-zinc-300 text-[11px] font-bold text-zinc-900"
                          >
                            {tag}
                          </span>
                        ))
                      )}
                    </div>
                  )}

                  {/* Configuration Header Bar: Title, Coupon Bond Size, Fee, Layout */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pb-3 border-b border-zinc-200">
                    {/* Title Header */}
                    <div className="space-y-1">
                      <label
                        htmlFor="title_header"
                        className="block text-xs font-mono font-semibold uppercase text-zinc-700"
                      >
                        Title Header
                      </label>
                      <input
                        id="title_header"
                        name="title_header"
                        aria-label="Title Header"
                        type="text"
                        value={titleHeader}
                        onChange={(e) => setTitleHeader(e.target.value)}
                        placeholder="e.g. BARANGAY CLEARANCE"
                        className="w-full px-3 py-1.5 text-xs font-mono font-bold uppercase border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
                      />
                    </div>

                    {/* Coupon Bond Paper Size */}
                    <div className="space-y-1">
                      <label
                        htmlFor="paper_size"
                        className="block text-xs font-mono font-semibold uppercase text-zinc-700"
                      >
                        Coupon Bond Size
                      </label>
                      <select
                        id="paper_size"
                        name="paper_size"
                        aria-label="Coupon Bond Size"
                        data-testid="template-paper-size-select"
                        value={paperSize}
                        onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                        className="w-full px-2.5 py-1.5 text-xs font-mono font-semibold border border-zinc-300 rounded-none bg-white text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
                      >
                        <option value="short">Short Bond (8.5&quot; × 11&quot;)</option>
                        <option value="a4">A4 Standard (210 × 297mm)</option>
                        <option value="long">Long Bond / Folio (8.5&quot; × 13&quot;)</option>
                      </select>
                    </div>

                    {/* Default Fee */}
                    <div className="space-y-1">
                      <label
                        htmlFor="default_fee"
                        className="block text-xs font-mono font-semibold uppercase text-zinc-700"
                      >
                        Default Issuance Fee (₱)
                      </label>
                      <div className="relative">
                        <DollarSign className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="default_fee"
                          name="default_fee"
                          aria-label="Default Fee"
                          type="number"
                          min="0"
                          step="0.01"
                          value={defaultFee}
                          onChange={(e) => setDefaultFee(parseFloat(e.target.value) || 0)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs font-mono font-semibold border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-colors"
                        />
                      </div>
                    </div>

                    {/* Officials Sidebar Toggle Switch */}
                    <div className="space-y-1">
                      <span className="block text-xs font-mono font-semibold uppercase text-zinc-700">
                        Print Layout Structure
                      </span>
                      <label className="flex items-center gap-2 p-1.5 border border-zinc-300 rounded-none bg-zinc-50 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          aria-label="Toggle Officials Sidebar"
                          checked={showOfficialsSidebar === 1}
                          onChange={(e) => setShowOfficialsSidebar(e.target.checked ? 1 : 0)}
                          className="w-4 h-4 text-zinc-900 rounded-none border-zinc-300 focus:ring-0"
                        />
                        <Columns className="w-4 h-4 text-zinc-600" />
                        <span className="text-xs font-mono font-medium text-zinc-800">
                          {showOfficialsSidebar === 1
                            ? '28% Council Sidebar'
                            : '100% Full Width'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Clickable Placeholder Chips Bar */}
                  <PlaceholderChipBar
                    onInsertPlaceholder={handleInsertPlaceholder}
                    activeTargetLabel={
                      activeEditorTarget === 'header' ? 'Header Structure' : 'Document Body'
                    }
                    templateCategory={selectedTemplate.template_category || 'certificate'}
                  />

                  {/* Freely Modifiable Document Header Structure Studio */}
                  <div className="border border-zinc-300 bg-zinc-50/60 rounded-none">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-zinc-100 border-b border-zinc-200 font-mono">
                      <button
                        type="button"
                        onClick={() => setIsHeaderStudioOpen((prev) => !prev)}
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-900"
                      >
                        <LayoutTemplate className="w-3.5 h-3.5" />
                        <span>Header Structure &amp; Official Seal Customizer</span>
                        {isHeaderStudioOpen ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setHeaderHtml(
                              isBlotterTemplate
                                ? DEFAULT_BLOTTER_HEADER_HTML
                                : DEFAULT_CERT_HEADER_HTML
                            )
                          }
                          className="px-2 py-1 text-[10px] font-mono uppercase border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
                        >
                          Reset Default Header
                        </button>
                        <button
                          type="button"
                          onClick={handleSyncHeaderToAll}
                          disabled={isSyncingHeader}
                          data-testid="sync-header-all-btn"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-semibold uppercase bg-zinc-900 text-white hover:bg-black transition-colors disabled:opacity-50"
                        >
                          <CopyCheck className="w-3 h-3" />
                          <span>
                            {isSyncingHeader ? 'Syncing...' : 'Apply Header to All Templates'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {isHeaderStudioOpen && (
                      <div className="p-3.5 space-y-3">
                        {/* Visual Header Controls */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                          <label className="flex items-center gap-2 p-2 bg-white border border-zinc-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={headerConfig.showLeftSeal !== false}
                              onChange={(e) =>
                                setHeaderConfig((prev) => ({
                                  ...prev,
                                  showLeftSeal: e.target.checked
                                }))
                              }
                              className="rounded-none text-zinc-900"
                            />
                            <span className="text-[11px]">Left Brgy Seal</span>
                          </label>

                          <label className="flex items-center gap-2 p-2 bg-white border border-zinc-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={headerConfig.showRightSeal !== false}
                              onChange={(e) =>
                                setHeaderConfig((prev) => ({
                                  ...prev,
                                  showRightSeal: e.target.checked
                                }))
                              }
                              className="rounded-none text-zinc-900"
                            />
                            <span className="text-[11px]">Right City Seal</span>
                          </label>

                          <div className="flex items-center gap-1.5 bg-white border border-zinc-300 px-2 py-1">
                            <span className="text-[10px] uppercase text-zinc-500">Divider:</span>
                            <select
                              aria-label="Header Border Style"
                              value={headerConfig.borderStyle || 'double'}
                              onChange={(e) =>
                                setHeaderConfig((prev) => ({
                                  ...prev,
                                  borderStyle: e.target.value as HeaderConfig['borderStyle']
                                }))
                              }
                              className="flex-1 text-[11px] bg-transparent outline-none font-semibold"
                            >
                              <option value="double">Double Rule</option>
                              <option value="solid">Solid Line</option>
                              <option value="accent">Bold Accent</option>
                              <option value="none">No Border</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-1.5 bg-white border border-zinc-300 px-2 py-1">
                            <span className="text-[10px] uppercase text-zinc-500">Align:</span>
                            <select
                              aria-label="Header Alignment"
                              value={headerConfig.headerAlign || 'center'}
                              onChange={(e) =>
                                setHeaderConfig((prev) => ({
                                  ...prev,
                                  headerAlign: e.target.value as HeaderConfig['headerAlign']
                                }))
                              }
                              className="flex-1 text-[11px] bg-transparent outline-none font-semibold"
                            >
                              <option value="center">Centered</option>
                              <option value="left">Left Aligned</option>
                            </select>
                          </div>
                        </div>

                        {/* Editable Header Content */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="block text-[11px] font-mono font-semibold uppercase text-zinc-700">
                              Editable Header Lines &amp; Office Title (Supports{' '}
                              <code>{'{{barangay_name}}'}</code>, etc.)
                            </label>
                            <span className="text-[10px] font-mono text-zinc-500">
                              Click inside to insert placeholder chips into header
                            </span>
                          </div>
                          <RichTextTemplateEditor
                            ref={headerEditorRef}
                            value={headerHtml}
                            onChange={(html) => setHeaderHtml(html)}
                            onEditorFocus={() => setActiveEditorTarget('header')}
                            minHeight="120px"
                            testId="header-rich-text-editor"
                            ariaLabel="Document Header Rich Text Editor"
                            compactToolbar={true}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* WYSIWYG Document Body Editor */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-mono font-semibold uppercase text-zinc-700">
                        {isBlotterTemplate
                          ? 'Blotter / KP Form Body Content'
                          : 'Certificate Body Content'}
                      </label>
                      <span className="text-[10px] font-mono text-zinc-500">
                        Paper: {activePaperSpec.shortLabel} ({activePaperSpec.dimensionsLabel})
                      </span>
                    </div>
                    <RichTextTemplateEditor
                      ref={editorRef}
                      value={bodyHtml}
                      onChange={(html) => setBodyHtml(html)}
                      onEditorFocus={() => setActiveEditorTarget('body')}
                      minHeight="340px"
                      testId="rich-text-editor"
                      ariaLabel="Certificate Body Rich Text Editor"
                    />
                    <p className="text-[11px] text-zinc-500 font-mono pt-1">
                      Tip: Click any <code className="text-zinc-900 font-bold">{'{{tag}}'}</code>{' '}
                      above to insert it into the focused editor ({activeEditorTarget.toUpperCase()}
                      ). Saving automatically updates the MS Word (<code>.docx</code>) template on
                      disk.
                    </p>
                  </div>
                </div>

                {/* Right Pane when in Split View */}
                {activeTab === 'split' && (
                  <div className="bg-zinc-200 border border-zinc-300 p-4 overflow-x-auto sticky top-4">
                    <div className="mb-2 flex items-center justify-between font-mono text-[11px] text-zinc-700">
                      <span className="font-bold uppercase">
                        Live Paper Canvas ({activePaperSpec.shortLabel})
                      </span>
                      <span>{activePaperSpec.dimensionsLabel}</span>
                    </div>
                    <div className="bg-white border border-zinc-400 shadow-md mx-auto">
                      <CertificatePrintSheet
                        html={samplePreviewHtml}
                        titleHeader={titleHeader}
                        paperSize={paperSize}
                        headerHtml={sampleHeaderPreviewHtml}
                        headerConfig={headerConfig}
                        footerHtml={footerHtml}
                        showOfficialsSidebar={showOfficialsSidebar === 1}
                        sidebarOfficials={officials}
                        controlNumber={
                          isBlotterTemplate ? 'BLT-2026-001' : 'SAMPLE-2026-00001'
                        }
                        controlLabel={isBlotterTemplate ? 'Case No:' : 'Control No:'}
                        signatoryName={
                          officials.find((o) => o.position === 'Punong Barangay')?.full_name ||
                          'HON. ROBERTO V. SANTOS'
                        }
                        signatoryPosition="Punong Barangay"
                        barangayName={barangayName}
                        municipalityName={municipalityName}
                        provinceName={provinceName}
                        barangayLogoUrl={barangayLogoUrl}
                        cityLogoUrl={cityLogoUrl}
                        residentName="JUAN MENDOZA DELA CRUZ"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Full Live Paper Print Preview Tab */}
            {selectedTemplate && activeTab === 'preview' && (
              <div className="space-y-3">
                <div className="bg-zinc-900 text-white p-3 rounded-none flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4 text-zinc-300" />
                    <span className="font-bold uppercase tracking-wider">
                      Live {activePaperSpec.shortLabel} Print Preview &mdash;{' '}
                      {selectedTemplate.template_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {(['short', 'a4', 'long'] as PaperSize[]).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setPaperSize(sz)}
                        className={`px-2 py-0.5 text-[10px] uppercase border transition-colors ${
                          paperSize === sz
                            ? 'bg-white text-zinc-950 border-white font-bold'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {sz === 'short'
                          ? 'Short (8.5×11")'
                          : sz === 'a4'
                          ? 'A4 (210×297mm)'
                          : 'Long (8.5×13")'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 sm:p-8 bg-zinc-200 border border-zinc-300 flex justify-center overflow-x-auto">
                  <div className="bg-white border border-zinc-400 shadow-md">
                    <CertificatePrintSheet
                      html={samplePreviewHtml}
                      titleHeader={titleHeader}
                      paperSize={paperSize}
                      headerHtml={sampleHeaderPreviewHtml}
                      headerConfig={headerConfig}
                      footerHtml={footerHtml}
                      showOfficialsSidebar={showOfficialsSidebar === 1}
                      sidebarOfficials={officials}
                      controlNumber={isBlotterTemplate ? 'BLT-2026-001' : 'SAMPLE-2026-00001'}
                      controlLabel={isBlotterTemplate ? 'Case No:' : 'Control No:'}
                      signatoryName={
                        officials.find((o) => o.position === 'Punong Barangay')?.full_name ||
                        'HON. ROBERTO V. SANTOS'
                      }
                      signatoryPosition="Punong Barangay"
                      barangayName={barangayName}
                      municipalityName={municipalityName}
                      provinceName={provinceName}
                      barangayLogoUrl={barangayLogoUrl}
                      cityLogoUrl={cityLogoUrl}
                      residentName="JUAN MENDOZA DELA CRUZ"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create New Template Modal */}
      {isCreateModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-template-modal-title"
          className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-none shadow-none max-w-lg w-full border border-zinc-300 overflow-hidden my-8">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 bg-zinc-50">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-zinc-900 text-white rounded-none">
                  <FileCode2 className="w-4 h-4" />
                </div>
                <div>
                  <h2
                    id="create-template-modal-title"
                    className="text-sm font-bold text-zinc-950 uppercase tracking-tight"
                  >
                    Create Custom Document Template
                  </h2>
                  <p className="text-[11px] font-mono text-zinc-500 uppercase">
                    Add new official Certificate or Blotter / KP template
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                aria-label="Close modal"
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-none hover:bg-zinc-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTemplate} className="p-5 space-y-3.5 font-mono">
              {createError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-xs text-red-800">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase text-zinc-700">
                    Template Category
                  </label>
                  <select
                    value={createCategory}
                    onChange={(e) => setCreateCategory(e.target.value as TemplateCategory)}
                    className="w-full px-3 py-1.5 text-xs border border-zinc-300 rounded-none bg-white focus:border-zinc-900 outline-none"
                  >
                    <option value="certificate">Certificate Issuance</option>
                    <option value="blotter">Blotter / KP Form</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase text-zinc-700">
                    Coupon Bond Size
                  </label>
                  <select
                    value={createPaperSize}
                    onChange={(e) => setCreatePaperSize(e.target.value as PaperSize)}
                    className="w-full px-3 py-1.5 text-xs border border-zinc-300 rounded-none bg-white focus:border-zinc-900 outline-none"
                  >
                    <option value="short">Short (8.5&quot; × 11&quot;)</option>
                    <option value="a4">A4 (210 × 297mm)</option>
                    <option value="long">Long (8.5&quot; × 13&quot;)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase text-zinc-700">
                  Template Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RESIDENCY, KP_NOTICE"
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 text-xs font-bold uppercase border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none"
                />
                <span className="text-[10px] text-zinc-500">
                  Unique identifier (also names the .docx file in data/templates/word/)
                </span>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase text-zinc-700">
                  Template Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Certificate of Good Moral Character"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase text-zinc-700">
                  Title Header <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CERTIFICATE OF GOOD MORAL CHARACTER"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 text-xs font-bold uppercase border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase text-zinc-700">
                    Default Fee (₱)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={createFee}
                    onChange={(e) => setCreateFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 text-xs font-semibold border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold uppercase text-zinc-700">
                    Layout Style
                  </label>
                  <select
                    value={createSidebar}
                    onChange={(e) => setCreateSidebar(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs border border-zinc-300 rounded-none bg-white focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none"
                  >
                    <option value={1}>28% Council Sidebar</option>
                    <option value={0}>100% Full Width Body</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isCreating}
                  className="px-3.5 py-1.5 text-xs font-mono font-medium text-zinc-800 hover:bg-zinc-100 rounded-none border border-zinc-300 uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-semibold text-white bg-zinc-900 hover:bg-black rounded-none uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create Template</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesPage;
