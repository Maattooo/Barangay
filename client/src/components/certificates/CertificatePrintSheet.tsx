import React, { useMemo } from 'react';
import { BarangayOfficial } from '../../types/certificates';

export interface CertificatePrintSheetProps {
  html: string;
  titleHeader?: string;
  title_header?: string;
  showOfficialsSidebar?: number | boolean;
  show_officials_sidebar?: number | boolean;
  sidebarOfficials?: BarangayOfficial[];
  sidebar_officials?: BarangayOfficial[];
  controlNumber?: string;
  control_number?: string;
  signatoryName?: string;
  signatory_name?: string;
  signatoryPosition?: string;
  signatory_position?: string;
  isOicSigning?: boolean | number;
  is_oic_signing?: boolean | number;
  barangayName?: string;
  municipalityName?: string;
  provinceName?: string;
  residentName?: string;
  resident_name?: string;
  barangayLogoUrl?: string;
  barangay_logo_url?: string;
  cityLogoUrl?: string;
  city_logo_url?: string;
}

export const CertificatePrintSheet: React.FC<CertificatePrintSheetProps> = (props) => {
  const {
    html = '',
    titleHeader,
    title_header,
    showOfficialsSidebar,
    show_officials_sidebar,
    sidebarOfficials,
    sidebar_officials,
    controlNumber,
    control_number,
    signatoryName,
    signatory_name,
    signatoryPosition,
    signatory_position,
    isOicSigning,
    is_oic_signing,
    barangayName = 'POBLACION',
    municipalityName = 'LOS BAÑOS',
    provinceName = 'LAGUNA',
    residentName,
    resident_name,
    barangayLogoUrl,
    barangay_logo_url,
    cityLogoUrl,
    city_logo_url
  } = props;

  // Resolve aliases
  const activeBarangayLogo = barangayLogoUrl || barangay_logo_url;
  const activeCityLogo = cityLogoUrl || city_logo_url;
  const activeTitle = titleHeader || title_header || 'BARANGAY CLEARANCE';
  const rawSidebarVal = showOfficialsSidebar !== undefined ? showOfficialsSidebar : show_officials_sidebar;
  const showSidebar = Boolean(rawSidebarVal === 1 || rawSidebarVal === true || String(rawSidebarVal) === '1');
  const officialsList = sidebarOfficials || sidebar_officials || [];
  const activeControlNo = controlNumber || control_number || '';
  const rawSignatoryName = signatoryName || signatory_name;
  const rawSignatoryPos = signatoryPosition || signatory_position;
  const rawOic = isOicSigning !== undefined ? isOicSigning : is_oic_signing;
  const isOic = Boolean(rawOic === 1 || rawOic === true || String(rawOic).toLowerCase() === 'true' || String(rawOic) === '1');
  const activeResidentName = residentName || resident_name;

  // Sort officials strictly by rank_order ASC
  const sortedOfficials = useMemo(() => {
    return [...officialsList].sort((a, b) => a.rank_order - b.rank_order);
  }, [officialsList]);

  // Find fallback signatory if not explicitly passed
  const displaySignatoryName = useMemo(() => {
    if (rawSignatoryName && rawSignatoryName.trim()) {
      return rawSignatoryName.trim().toUpperCase();
    }
    const pb = sortedOfficials.find(o => o.position === 'Punong Barangay');
    if (pb) return pb.full_name.toUpperCase();
    if (sortedOfficials.length > 0) return sortedOfficials[0].full_name.toUpperCase();
    return 'HON. PUNONG BARANGAY';
  }, [rawSignatoryName, sortedOfficials]);

  const displaySignatoryPosition = useMemo(() => {
    if (rawSignatoryPos && rawSignatoryPos.trim()) {
      return rawSignatoryPos.trim();
    }
    if (isOic) {
      return 'Sangguniang Barangay Member';
    }
    return 'Punong Barangay';
  }, [rawSignatoryPos, isOic]);

  // Format HTML: ensure resident name is bold uppercase, and strip existing redundant signature block
  const formattedHtml = useMemo(() => {
    let result = html;
    if (activeResidentName && activeResidentName.trim()) {
      const upperName = activeResidentName.trim().toUpperCase();
      // Ensure resident name is uppercase bold if contained in raw text, escaping regex special characters
      const escapedName = activeResidentName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nameRegex = new RegExp(`(?<!<strong>)${escapedName}(?!<\\/strong>)`, 'gi');
      result = result.replace(nameRegex, `<strong class="uppercase font-bold">${upperName}</strong>`);
    }
    // Remove existing signature block if backend already generated one to avoid duplicate
    result = result.replace(/<div style="text-align:\s*right;?"[\s\S]*?<\/div>/gi, '');
    result = result.replace(/<div class="[^"]*text-right[^"]*"[\s\S]*?<\/div>/gi, '');
    return result;
  }, [html, activeResidentName]);

  return (
    <div
      id="printable-certificate-area"
      data-testid="printable-certificate-area"
      className="bg-white text-slate-900 mx-auto box-border"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '12mm',
        fontFamily: 'Georgia, "Times New Roman", serif',
        position: 'relative'
      }}
    >
      {/* Official Header */}
      <header className="border-b-2 border-slate-900 pb-3 mb-4 text-center relative min-h-[70px]" data-testid="certificate-header">
        {/* Left: Barangay Seal */}
        <div className="absolute left-0 top-0 w-16 h-16 flex items-center justify-center">
          {activeBarangayLogo ? (
            <img
              src={activeBarangayLogo}
              alt="Barangay Seal"
              className="w-16 h-16 object-contain"
            />
          ) : (
            <div className="w-16 h-16 rounded-full border-2 border-slate-800 flex items-center justify-center bg-slate-50 text-[10px] font-bold uppercase text-slate-700 tracking-tighter text-center p-1">
              Barangay Seal
            </div>
          )}
        </div>

        {/* Header Text */}
        <div className="space-y-0.5 px-20">
          <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold">Republic of the Philippines</p>
          <p className="text-xs uppercase tracking-wider text-slate-700">Province of {provinceName}</p>
          <p className="text-xs uppercase tracking-wider text-slate-700">Municipality of {municipalityName}</p>
          <h2 className="text-base font-bold uppercase tracking-wider text-slate-900 mt-1">
            BARANGAY {barangayName}
          </h2>
          <p className="text-xs italic text-slate-700 font-medium">Office of the Punong Barangay</p>
        </div>

        {/* Right: City/Municipal Seal and Control Number */}
        <div className="absolute right-0 top-0 flex flex-col items-end gap-1">
          {activeCityLogo && (
            <img
              src={activeCityLogo}
              alt="City Seal"
              className="w-12 h-12 object-contain"
            />
          )}
          {activeControlNo && (
            <div className="text-right" data-testid="control-number-display">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Control No:</span>
              <p className="text-xs font-mono font-bold text-slate-800">{activeControlNo}</p>
            </div>
          )}
        </div>
      </header>

      {/* Dynamic 2-Column or Full-Width Layout */}
      <div className="flex flex-row w-full gap-6">
        {/* Left Column (28% width) - Council Sidebar */}
        {showSidebar && (
          <aside
            data-testid="print-officials-sidebar"
            className="w-[28%] flex-shrink-0 border-r border-slate-300 pr-4 space-y-4 text-left"
            style={{ width: '28%' }}
          >
            <div className="border-b border-slate-800 pb-1 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 text-center">
                Sangguniang Barangay
              </h3>
            </div>

            <div className="space-y-3">
              {sortedOfficials.map((official) => {
                const isPB = official.position === 'Punong Barangay';
                return (
                  <div
                    key={official.id}
                    data-testid={`official-sidebar-item-${official.id}`}
                    className={`text-left ${isPB ? 'border-b border-slate-300 pb-2 mb-2 font-semibold' : ''}`}
                  >
                    <p className="text-[11px] font-bold uppercase text-slate-900 tracking-tight leading-tight">
                      {official.full_name}
                    </p>
                    <p className="text-[10px] text-slate-700 leading-tight">
                      {official.position}
                    </p>
                    {official.committee && (
                      <p className="text-[9px] italic text-slate-500 leading-tight">
                        {official.committee}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {/* Right Column (72% width when sidebar enabled, 100% when disabled) */}
        <main
          data-testid="print-certificate-body"
          className={showSidebar ? 'w-[72%] flex-1 flex flex-col justify-between' : 'w-full flex-1 flex flex-col justify-between'}
          style={{ width: showSidebar ? '72%' : '100%' }}
        >
          {/* Certificate Title */}
          <div className="text-center my-4">
            <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-slate-900 underline decoration-2 underline-offset-8">
              {activeTitle}
            </h1>
          </div>

          {/* Body Content */}
          <div
            className="certificate-body text-slate-800 text-sm sm:text-base leading-relaxed space-y-4 my-4 text-justify"
            data-testid="certificate-html-content"
            dangerouslySetInnerHTML={{ __html: formattedHtml }}
          />

          {/* Formal Signatory Block */}
          <div className="mt-12 text-right" data-testid="signatory-block">
            <div className="inline-block text-center min-w-[220px]">
              <p className="font-bold uppercase tracking-wider text-slate-900 text-sm">
                {displaySignatoryName}
              </p>
              <p className="text-xs font-semibold text-slate-800">
                {displaySignatoryPosition}
              </p>
              {isOic && (
                <p className="text-[11px] italic text-slate-600 mt-0.5">
                  By Authority of the Punong Barangay
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default CertificatePrintSheet;
