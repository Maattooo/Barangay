import React, { useMemo } from 'react';
import { BarangayOfficial, HeaderConfig, PaperSize } from '../../types/certificates';

export const PAPER_SIZE_SPECS: Record<
  PaperSize,
  {
    width: string;
    minHeight: string;
    pageCssSize: string;
    shortLabel: string;
    dimensionsLabel: string;
  }
> = {
  short: {
    width: '215.9mm',
    minHeight: '279.4mm',
    pageCssSize: '8.5in 11in',
    shortLabel: 'Short Bond',
    dimensionsLabel: '8.5" × 11" (216 × 279 mm)'
  },
  a4: {
    width: '210mm',
    minHeight: '297mm',
    pageCssSize: '210mm 297mm',
    shortLabel: 'A4 Standard',
    dimensionsLabel: '210 × 297 mm (8.27" × 11.69")'
  },
  long: {
    width: '215.9mm',
    minHeight: '330.2mm',
    pageCssSize: '8.5in 13in',
    shortLabel: 'Long Bond (Folio)',
    dimensionsLabel: '8.5" × 13" (216 × 330 mm)'
  }
};

export interface CertificatePrintSheetProps {
  html: string;
  titleHeader?: string;
  title_header?: string;
  paperSize?: PaperSize;
  paper_size?: PaperSize;
  headerHtml?: string;
  header_html?: string;
  headerConfig?: HeaderConfig;
  headerConfigJson?: string;
  header_config_json?: string;
  footerHtml?: string;
  footer_html?: string;
  showOfficialsSidebar?: number | boolean;
  show_officials_sidebar?: number | boolean;
  sidebarOfficials?: BarangayOfficial[];
  sidebar_officials?: BarangayOfficial[];
  controlNumber?: string;
  control_number?: string;
  controlLabel?: string;
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
    paperSize,
    paper_size,
    headerHtml,
    header_html,
    headerConfig,
    headerConfigJson,
    header_config_json,
    footerHtml,
    footer_html,
    showOfficialsSidebar,
    show_officials_sidebar,
    sidebarOfficials,
    sidebar_officials,
    controlNumber,
    control_number,
    controlLabel = 'Control No:',
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
  const activePaperSize: PaperSize = useMemo(() => {
    const raw = paperSize || paper_size || 'a4';
    return raw === 'short' || raw === 'a4' || raw === 'long' ? raw : 'a4';
  }, [paperSize, paper_size]);

  const paperSpec = PAPER_SIZE_SPECS[activePaperSize];

  const parsedHeaderConfig: HeaderConfig = useMemo(() => {
    const defaults: HeaderConfig = {
      showLeftSeal: true,
      showRightSeal: true,
      sealSizePx: 64,
      headerAlign: 'center',
      borderStyle: 'solid',
      subHeaderTitle: 'Office of the Punong Barangay',
      showControlNumberBox: true
    };
    if (headerConfig) {
      return { ...defaults, ...headerConfig };
    }
    const rawJson = headerConfigJson || header_config_json;
    if (rawJson) {
      try {
        const parsed = JSON.parse(rawJson);
        if (parsed && typeof parsed === 'object') {
          return { ...defaults, ...parsed };
        }
      } catch {
        // fallback to defaults
      }
    }
    return defaults;
  }, [headerConfig, headerConfigJson, header_config_json]);

  const activeHeaderHtml = (headerHtml ?? header_html ?? '').trim();
  const activeFooterHtml = (footerHtml ?? footer_html ?? '').trim();
  const activeBarangayLogo = parsedHeaderConfig.leftSealUrl || barangayLogoUrl || barangay_logo_url;
  const activeCityLogo = parsedHeaderConfig.rightSealUrl || cityLogoUrl || city_logo_url;
  const activeTitle = titleHeader !== undefined ? titleHeader : (title_header !== undefined ? title_header : 'BARANGAY CLEARANCE');
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

  const headerBorderClass = useMemo(() => {
    switch (parsedHeaderConfig.borderStyle) {
      case 'double':
        return 'border-b-4 border-double border-slate-900';
      case 'accent':
        return 'border-b-[3px] border-slate-950';
      case 'none':
        return 'border-b-0';
      case 'solid':
      default:
        return 'border-b-2 border-slate-900';
    }
  }, [parsedHeaderConfig.borderStyle]);

  const sealDimension = parsedHeaderConfig.sealSizePx || 64;

  return (
    <div
      id="printable-certificate-area"
      data-testid="printable-certificate-area"
      data-paper-size={activePaperSize}
      className="bg-white text-slate-900 mx-auto box-border flex flex-col justify-between"
      style={{
        width: paperSpec.width,
        minHeight: paperSpec.minHeight,
        padding: '12mm',
        fontFamily: 'Georgia, "Times New Roman", serif',
        position: 'relative'
      }}
    >
      {/* Dynamic @page rule for exact Coupon Bond printing (Short / A4 / Long) */}
      <style>{`
        @media print {
          @page {
            size: ${paperSpec.pageCssSize};
            margin: 12mm;
          }
        }
      `}</style>

      <div>
        {/* Official Header */}
        <header
          className={`${headerBorderClass} pb-3 mb-4 ${
            parsedHeaderConfig.headerAlign === 'left' ? 'text-left' : 'text-center'
          } relative min-h-[76px]`}
          data-testid="certificate-header"
        >
          {/* Left: Barangay Seal */}
          {parsedHeaderConfig.showLeftSeal !== false && (
            <div
              className="absolute left-0 top-0 flex items-center justify-center"
              style={{ width: `${sealDimension}px`, height: `${sealDimension}px` }}
            >
              {activeBarangayLogo ? (
                <img
                  src={activeBarangayLogo}
                  alt="Barangay Seal"
                  className="object-contain w-full h-full"
                />
              ) : (
                <div className="w-full h-full rounded-full border-2 border-slate-800 flex items-center justify-center bg-slate-50 text-[10px] font-bold uppercase text-slate-700 tracking-tighter text-center p-1">
                  Barangay Seal
                </div>
              )}
            </div>
          )}

          {/* Header Text (Custom Rich Header HTML or Standard Institutional Header) */}
          <div
            className={
              parsedHeaderConfig.headerAlign === 'left'
                ? `${parsedHeaderConfig.showLeftSeal !== false ? 'pl-20' : ''} pr-28`
                : 'px-20'
            }
          >
            {activeHeaderHtml ? (
              <div
                data-testid="certificate-header-custom-html"
                className="text-slate-900 leading-snug [&_p]:my-0.5 [&_h1]:my-0.5 [&_h2]:my-0.5 [&_h3]:my-0.5"
                dangerouslySetInnerHTML={{ __html: activeHeaderHtml }}
              />
            ) : (
              <div className="space-y-0.5">
                <p className="text-xs uppercase tracking-widest text-slate-600 font-semibold">
                  Republic of the Philippines
                </p>
                <p className="text-xs uppercase tracking-wider text-slate-700">
                  Province of {provinceName}
                </p>
                <p className="text-xs uppercase tracking-wider text-slate-700">
                  Municipality of {municipalityName}
                </p>
                <h2 className="text-base font-bold uppercase tracking-wider text-slate-900 mt-1">
                  BARANGAY {barangayName}
                </h2>
                {parsedHeaderConfig.subHeaderTitle && (
                  <p className="text-xs italic text-slate-700 font-medium">
                    {parsedHeaderConfig.subHeaderTitle}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right: City/Municipal Seal and Control/Case Number */}
          <div className="absolute right-0 top-0 flex flex-col items-end gap-1">
            {parsedHeaderConfig.showRightSeal !== false && activeCityLogo && (
              <img
                src={activeCityLogo}
                alt="City Seal"
                className="w-12 h-12 object-contain"
              />
            )}
            {activeControlNo && parsedHeaderConfig.showControlNumberBox !== false && (
              <div className="text-right" data-testid="control-number-display">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  {controlLabel}
                </span>
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
                      className={`text-left ${
                        isPB ? 'border-b border-slate-300 pb-2 mb-2 font-semibold' : ''
                      }`}
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
            className={
              showSidebar
                ? 'w-[72%] flex-1 flex flex-col justify-between'
                : 'w-full flex-1 flex flex-col justify-between'
            }
            style={{ width: showSidebar ? '72%' : '100%' }}
          >
            {/* Certificate Title */}
            {activeTitle && (
              <div className="text-center my-4">
                <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-widest text-slate-900 underline decoration-2 underline-offset-8">
                  {activeTitle}
                </h1>
              </div>
            )}

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

      {/* Optional Document Footer */}
      {activeFooterHtml && (
        <footer
          data-testid="certificate-footer"
          className="mt-8 pt-2 border-t border-slate-300 text-[10px] text-slate-600 text-center"
          dangerouslySetInnerHTML={{ __html: activeFooterHtml }}
        />
      )}
    </div>
  );
};

export default CertificatePrintSheet;
