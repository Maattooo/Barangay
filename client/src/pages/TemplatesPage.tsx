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
  Printer
} from 'lucide-react';
import api from '../services/api';
import { CertificateTemplate, UpdateTemplateInput } from '../types/admin';
import { BarangayOfficial } from '../types/certificates';
import RichTextTemplateEditor, {
  RichTextTemplateEditorHandle
} from '../components/templates/RichTextTemplateEditor';
import PlaceholderChipBar from '../components/templates/PlaceholderChipBar';
import CertificatePrintSheet from '../components/certificates/CertificatePrintSheet';

export const TemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View mode: Editor vs Live A4 Print Preview
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  // Active template editing state
  const [titleHeader, setTitleHeader] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [showOfficialsSidebar, setShowOfficialsSidebar] = useState(1);
  const [defaultFee, setDefaultFee] = useState<number>(50.0);

  // System and officials metadata for real-time print preview
  const [officials, setOfficials] = useState<BarangayOfficial[]>([]);
  const [barangayName, setBarangayName] = useState('POBLACION');
  const [municipalityName, setMunicipalityName] = useState('LOS BAÑOS');
  const [provinceName, setProvinceName] = useState('LAGUNA');
  const [barangayLogoUrl, setBarangayLogoUrl] = useState('');
  const [cityLogoUrl, setCityLogoUrl] = useState('');

  // Create Template Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createFee, setCreateFee] = useState<number>(50);
  const [createSidebar, setCreateSidebar] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const editorRef = useRef<RichTextTemplateEditorHandle>(null);

  // Load system info and officials for live dual-seal print preview
  useEffect(() => {
    let isMounted = true;
    api.getSystemInfo().then((info) => {
      if (!isMounted) return;
      const s = info?.settings || {};
      if (s.barangay_name) setBarangayName(s.barangay_name as string);
      if (s.municipality_name || s.municipality) setMunicipalityName((s.municipality_name || s.municipality) as string);
      if (s.province_name || s.province) setProvinceName((s.province_name || s.province) as string);
      if (s.barangay_logo_url) setBarangayLogoUrl(s.barangay_logo_url as string);
      if (s.city_logo_url) setCityLogoUrl(s.city_logo_url as string);
    }).catch(() => {});

    api.getOfficials().then((data) => {
      if (!isMounted) return;
      setOfficials(data.filter((o) => o.is_active === 1));
    }).catch(() => {});

    return () => { isMounted = false; };
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
  }, [selectedTemplateId]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const loadTemplateData = (tmpl: CertificateTemplate) => {
    setTitleHeader(tmpl.title_header);
    setBodyHtml(tmpl.body_html);
    setShowOfficialsSidebar(Number(tmpl.show_officials_sidebar));
    setDefaultFee(Number(tmpl.default_fee));
    setSaveSuccess(false);
    setError(null);
  };

  const handleSelectTemplate = (tmpl: CertificateTemplate) => {
    setSelectedTemplateId(tmpl.id);
    loadTemplateData(tmpl);
  };

  const handleInsertPlaceholder = (placeholder: string) => {
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
    setSaveSuccess(false);

    try {
      const currentHtml = editorRef.current ? editorRef.current.getHTML() : bodyHtml;
      const payload: UpdateTemplateInput = {
        title_header: titleHeader.trim(),
        body_html: currentHtml,
        show_officials_sidebar: showOfficialsSidebar,
        default_fee: Number(defaultFee)
      };

      const updated = await api.updateTemplate(selectedTemplateId, payload);
      setTemplates((prev) =>
        prev.map((t) => (t.id === selectedTemplateId ? { ...t, ...updated } : t))
      );
      setBodyHtml(updated.body_html);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save certificate template.');
    } finally {
      setSaving(false);
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
      const defaultBody = `<p>TO WHOM IT MAY CONCERN:</p><p>This is to certify that <strong>{{full_name}}</strong>, {{age}} years old, {{civil_status}}, Filipino, is a bona fide resident of {{address}}.</p><p>This certification is issued upon the request of the above-named person for <strong>{{purpose}}</strong>.</p><p>Issued this <strong>{{day_ordinal}} day of {{month_year}}</strong> at the Office of the Punong Barangay.</p>`;

      const newTmpl = await api.createTemplate({
        template_code: createCode.trim().toUpperCase(),
        template_name: createName.trim(),
        title_header: createTitle.trim().toUpperCase(),
        body_html: defaultBody,
        show_officials_sidebar: createSidebar,
        default_fee: Number(createFee) || 0
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

  const samplePreviewHtml = useMemo(() => {
    const raw = editorRef.current ? editorRef.current.getHTML() : bodyHtml;
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
    const fullDate = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const pb = officials.find((o) => o.position === 'Punong Barangay');
    const sec = officials.find((o) => o.position === 'Barangay Secretary');
    const tres = officials.find((o) => o.position === 'Barangay Treasurer');

    return (raw || '')
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
      .replace(/\{\{day_ordinal\}\}/g, dayOrdinal)
      .replace(/\{\{month_year\}\}/g, monthYear)
      .replace(/\{\{date_today\}\}/g, fullDate)
      .replace(/\{\{punong_barangay\}\}/g, pb ? pb.full_name : 'HON. ROBERTO V. SANTOS')
      .replace(/\{\{barangay_secretary\}\}/g, sec ? sec.full_name : 'SEC. MARIA L. REYES')
      .replace(/\{\{barangay_treasurer\}\}/g, tres ? tres.full_name : 'TRS. FELIPE M. CASTRO')
      .replace(/\{\{signatory_name\}\}/g, pb ? pb.full_name : 'HON. ROBERTO V. SANTOS')
      .replace(/\{\{signatory_title\}\}/g, pb ? pb.position : 'Punong Barangay');
  }, [bodyHtml, defaultFee, officials]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-100 text-zinc-800 rounded-none border border-zinc-200">
            <FileCode2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-zinc-950 uppercase tracking-tight">
              Certificate Templates
            </h1>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Customize layouts, dynamic placeholder tokens, fees, and council roster layout
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-mono font-medium bg-emerald-50 px-2.5 py-1.5 rounded-none border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Template saved successfully!</span>
            </div>
          )}

          {/* View Mode Switcher */}
          <div className="flex items-center bg-zinc-100 p-0.5 border border-zinc-300 rounded-none">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                activeTab === 'editor'
                  ? 'bg-zinc-900 text-white font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
                activeTab === 'preview'
                  ? 'bg-zinc-900 text-white font-bold'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live A4 Preview</span>
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
          <p className="text-xs font-mono text-zinc-500">Loading certificate templates...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Template Selector Sidebar */}
          <div className="lg:col-span-1 space-y-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-mono font-bold text-zinc-700 uppercase tracking-wider">
                Templates ({templates.length})
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
            <div className="space-y-1">
              {templates.map((tmpl) => {
                const isSelected = tmpl.id === selectedTemplateId;
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
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate text-zinc-950 uppercase tracking-tight">
                        {tmpl.template_name}
                      </p>
                      <p className="text-[10px] font-mono text-zinc-500 truncate mt-0.5">
                        {tmpl.template_code}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-zinc-500">
                        <span>Fee: ₱{Number(tmpl.default_fee).toFixed(2)}</span>
                        <span>•</span>
                        <span>{tmpl.show_officials_sidebar ? '28% Sidebar' : 'Full Width'}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Template Editor / Live Preview Form */}
          <div className="lg:col-span-3 space-y-4">
            {selectedTemplate && activeTab === 'editor' && (
              <div className="bg-white p-4 sm:p-5 rounded-none border border-zinc-200 shadow-none space-y-4">
                {/* Configuration header bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-3 border-b border-zinc-200">
                  {/* Title Header */}
                  <div className="space-y-1 sm:col-span-1">
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

                  {/* Default Fee */}
                  <div className="space-y-1">
                    <label htmlFor="default_fee" className="block text-xs font-mono font-semibold uppercase text-zinc-700">
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
                        {showOfficialsSidebar === 1 ? '28% Council Sidebar' : '100% Full Width Body'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Clickable Placeholder Chips Bar */}
                <PlaceholderChipBar onInsertPlaceholder={handleInsertPlaceholder} />

                {/* WYSIWYG Template Editor */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono font-semibold uppercase text-zinc-700">
                    Certificate Body Content
                  </label>
                  <RichTextTemplateEditor
                    ref={editorRef}
                    value={bodyHtml}
                    onChange={(html) => setBodyHtml(html)}
                    minHeight="340px"
                  />
                  <p className="text-[11px] text-zinc-500 font-mono pt-1">
                    Tip: Use toolbar to format text. Dynamic placeholders (like{' '}
                    <code className="text-zinc-900 font-bold">{'{{full_name}}'}</code>) are
                    automatically populated with resident &amp; signatory data during certificate printing.
                  </p>
                </div>
              </div>
            )}

            {/* Live A4 Print Preview Tab */}
            {selectedTemplate && activeTab === 'preview' && (
              <div className="space-y-3">
                <div className="bg-zinc-900 text-white p-3 rounded-none flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Printer className="w-4 h-4 text-zinc-300" />
                    <span className="font-bold uppercase tracking-wider">
                      Live A4 Print Preview &mdash; {selectedTemplate.template_name}
                    </span>
                  </div>
                  <span className="text-zinc-400 text-[11px]">
                    Using Dual Seals &amp; Council Roster configured in Settings
                  </span>
                </div>

                <div className="p-4 sm:p-8 bg-zinc-200 border border-zinc-300 flex justify-center overflow-x-auto">
                  <div className="w-[210mm] bg-white border border-zinc-400 shadow-md">
                    <CertificatePrintSheet
                      html={samplePreviewHtml}
                      titleHeader={titleHeader}
                      showOfficialsSidebar={showOfficialsSidebar === 1}
                      sidebarOfficials={officials}
                      controlNumber="SAMPLE-2026-00001"
                      signatoryName={officials.find((o) => o.position === 'Punong Barangay')?.full_name || 'HON. ROBERTO V. SANTOS'}
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
                  <h2 id="create-template-modal-title" className="text-sm font-bold text-zinc-950 uppercase tracking-tight">
                    Create Custom Template
                  </h2>
                  <p className="text-[11px] font-mono text-zinc-500 uppercase">
                    Add new official certificate type for your Barangay
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

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase text-zinc-700">
                  Template Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RESIDENCY, SOLO_PARENT"
                  value={createCode}
                  onChange={(e) => setCreateCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-1.5 text-xs font-bold uppercase border border-zinc-300 rounded-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 outline-none"
                />
                <span className="text-[10px] text-zinc-500">Unique alphanumeric identifier (e.g. CLEARANCE, INDIGENCY)</span>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase text-zinc-700">
                  Template Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Certificate of Residency"
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
                  placeholder="e.g. CERTIFICATE OF RESIDENCY"
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
