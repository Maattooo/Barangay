import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileCode2,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Columns,
  DollarSign
} from 'lucide-react';
import api from '../services/api';
import { CertificateTemplate, UpdateTemplateInput } from '../types/admin';
import RichTextTemplateEditor, {
  RichTextTemplateEditorHandle
} from '../components/templates/RichTextTemplateEditor';
import PlaceholderChipBar from '../components/templates/PlaceholderChipBar';

export const TemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active template editing state
  const [titleHeader, setTitleHeader] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [showOfficialsSidebar, setShowOfficialsSidebar] = useState(1);
  const [defaultFee, setDefaultFee] = useState<number>(50.0);

  const editorRef = useRef<RichTextTemplateEditorHandle>(null);

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

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-purple-100 text-purple-700 rounded-xl shadow-inner">
            <FileCode2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Certificate Templates
            </h1>
            <p className="text-xs text-slate-500">
              Customize layouts, dynamic placeholder tokens, fees, and council roster layout
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveSuccess && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
              <CheckCircle2 className="w-4 h-4" />
              <span>Template saved successfully!</span>
            </div>
          )}

          <button
            onClick={() => handleSave()}
            disabled={saving || !selectedTemplate}
            aria-label="Save Template"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Template</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          <p className="text-xs font-medium text-slate-500">Loading certificate templates...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Template Selector Sidebar */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Select Template
            </h2>
            <div className="space-y-1.5">
              {templates.map((tmpl) => {
                const isSelected = tmpl.id === selectedTemplateId;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-purple-50 border-purple-300 shadow-xs ring-1 ring-purple-400'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-lg mt-0.5 ${
                        isSelected ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-xs font-bold truncate ${
                          isSelected ? 'text-purple-900' : 'text-slate-900'
                        }`}
                      >
                        {tmpl.template_name}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400 truncate">
                        {tmpl.template_code}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
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

          {/* Template Editor Form */}
          <div className="lg:col-span-3 space-y-5">
            {selectedTemplate && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                {/* Configuration header bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-100">
                  {/* Title Header */}
                  <div className="space-y-1 sm:col-span-1">
                    <label
                      htmlFor="title_header"
                      className="block text-xs font-bold text-slate-700"
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
                      className="w-full px-3 py-2 text-xs font-bold uppercase border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                    />
                  </div>

                  {/* Default Fee */}
                  <div className="space-y-1">
                    <label htmlFor="default_fee" className="block text-xs font-bold text-slate-700">
                      Default Issuance Fee (₱)
                    </label>
                    <div className="relative">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="default_fee"
                        name="default_fee"
                        aria-label="Default Fee"
                        type="number"
                        min="0"
                        step="0.01"
                        value={defaultFee}
                        onChange={(e) => setDefaultFee(parseFloat(e.target.value) || 0)}
                        className="w-full pl-8 pr-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
                      />
                    </div>
                  </div>

                  {/* Officials Sidebar Toggle Switch */}
                  <div className="space-y-1">
                    <span className="block text-xs font-bold text-slate-700">
                      Print Layout Structure
                    </span>
                    <label className="flex items-center gap-2.5 p-2 border border-slate-200 rounded-lg bg-slate-50 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        aria-label="Toggle Officials Sidebar"
                        checked={showOfficialsSidebar === 1}
                        onChange={(e) => setShowOfficialsSidebar(e.target.checked ? 1 : 0)}
                        className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                      />
                      <Columns className="w-4 h-4 text-slate-500" />
                      <span className="text-xs font-semibold text-slate-700">
                        {showOfficialsSidebar === 1 ? '28% Council Sidebar' : '100% Full Width Body'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Clickable Placeholder Chips Bar */}
                <PlaceholderChipBar onInsertPlaceholder={handleInsertPlaceholder} />

                {/* WYSIWYG Template Editor */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Certificate Body Content
                  </label>
                  <RichTextTemplateEditor
                    ref={editorRef}
                    value={bodyHtml}
                    onChange={(html) => setBodyHtml(html)}
                    minHeight="340px"
                  />
                  <p className="text-[11px] text-slate-400 pt-1">
                    Tip: Use the toolbar above to style headings and lists. Dynamic placeholders (like{' '}
                    <code className="text-purple-600 font-mono">{'{{full_name}}'}</code>) will be
                    automatically substituted with resident and signatory data during certificate
                    printing.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesPage;
