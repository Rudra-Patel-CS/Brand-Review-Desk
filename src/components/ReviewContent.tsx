import React, { useState, useEffect, useRef } from 'react';
import { Brand } from '../data/mockData.js';
import {
  CampaignPreset,
  ComplianceFinding,
  BrandRule,
  calculateComplianceScore,
  applyCorrectionToCaption,
  runComplianceAudit
} from '../utils/rulesEngine.js';

interface ReviewContentProps {
  activeBrand: Brand;
  campaigns: CampaignPreset[];
  activeCampaign: CampaignPreset;
  onSelectCampaign: (campaign: CampaignPreset) => void;
  rules: BrandRule[];
  onSaveCampaign: (campaign: CampaignPreset) => Promise<void>;
  onOpenUpload: () => void;
  onOpenOcrText: (ocrText: string, onSave: (text: string) => Promise<void>) => void;
  onOpenApproveModal: (campaign: CampaignPreset, caption: string, findings: ComplianceFinding[]) => void;
  onOpenDismissModal: (finding: ComplianceFinding, applyDecision: (note: string) => void) => void;
  onOpenPlannedModal: (title: string) => void;
  onShowToast: (message: string) => void;
}

export const ReviewContent: React.FC<ReviewContentProps> = ({
  activeBrand,
  campaigns,
  activeCampaign,
  onSelectCampaign,
  rules,
  onSaveCampaign,
  onOpenUpload,
  onOpenOcrText,
  onOpenApproveModal,
  onOpenDismissModal,
  onOpenPlannedModal,
  onShowToast
}) => {
  const [currentCaption, setCurrentCaption] = useState(activeCampaign.caption);
  const [currentOcrText, setCurrentOcrText] = useState(activeCampaign.ocrText);
  const [findings, setFindings] = useState<ComplianceFinding[]>(activeCampaign.initialFindings);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState('Loaded from database');
  const [hasRunAudit, setHasRunAudit] = useState(Boolean(activeCampaign.auditAt || activeCampaign.initialFindings.length));
  const [zoomLevel, setZoomLevel] = useState<1 | 1.25 | 1.5>(1);

  const findingRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Sync the editor only when a different saved campaign version arrives.
  useEffect(() => {
    setCurrentCaption(activeCampaign.caption);
    setCurrentOcrText(activeCampaign.ocrText);
    setFindings(activeCampaign.initialFindings);
    setSelectedFindingId(null);
    setHasRunAudit(Boolean(activeCampaign.auditAt || activeCampaign.initialFindings.length));
    setAutosaveStatus('Loaded from database');
  }, [activeCampaign.id, activeCampaign.updatedAt]);

  // Re-run compliance calculations
  const compliance = calculateComplianceScore(findings);
  const applicableRuleCount = rules.filter((rule) => rule.enabled && (rule.brand === activeBrand.id || rule.brand === 'global')).length;

  // Handle caption edits
  const handleCaptionChange = (newCaption: string) => {
    setCurrentCaption(newCaption);
    setHasRunAudit(false);
    setAutosaveStatus('Unsaved changes');
  };

  // Re-audit compliance
  const handleReaudit = () => {
    setIsScanning(true);
    const detected = runComplianceAudit(currentCaption, currentOcrText, rules, activeBrand.id);
    const updatedFindings = detected.map((finding) => {
      const existing = findings.find((saved) => saved.ruleId === finding.ruleId && saved.matchedText.toLowerCase() === finding.matchedText.toLowerCase());
      return existing && existing.status !== 'open'
        ? { ...finding, status: existing.status, dismissNote: existing.dismissNote }
        : finding;
    });
    setFindings(updatedFindings);
    setHasRunAudit(true);
    setIsScanning(false);
    setAutosaveStatus('Rule check complete • not saved yet');
  };

  const handleSaveAndValidate = async () => {
    setIsScanning(true);
    const detected = runComplianceAudit(currentCaption, currentOcrText, rules, activeBrand.id);
    const updatedFindings = detected.map((finding) => {
      const existing = findings.find((saved) => saved.ruleId === finding.ruleId && saved.matchedText.toLowerCase() === finding.matchedText.toLowerCase());
      return existing && existing.status !== 'open'
        ? { ...finding, status: existing.status, dismissNote: existing.dismissNote }
        : finding;
    });
    const updatedCampaign: CampaignPreset = {
      ...activeCampaign,
      caption: currentCaption,
      ocrText: currentOcrText,
      initialFindings: updatedFindings,
      auditAt: new Date().toISOString(),
      status: updatedFindings.some((finding) => finding.status === 'open' && finding.severity === 'critical') ? 'action_required' : 'under_review'
    };
    setFindings(updatedFindings);
    setHasRunAudit(true);
    try {
      await onSaveCampaign(updatedCampaign);
      setAutosaveStatus('Saved to database');
    } catch (error) {
      setAutosaveStatus('Save failed');
      onShowToast(`Campaign was not saved: ${error instanceof Error ? error.message : 'database error'}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle Apply Suggestion
  const handleApplySuggestion = (finding: ComplianceFinding) => {
    if (!finding.suggestedCorrection) return;

    if (finding.source === 'caption' || finding.source === 'both') {
      const updatedCaption = applyCorrectionToCaption(
        currentCaption,
        finding.matchedText,
        finding.suggestedCorrection
      );
      setCurrentCaption(updatedCaption);
    }

    setFindings((prev) =>
      prev.map((f) => (f.id === finding.id ? { ...f, status: 'applied' } : f))
    );
    setHasRunAudit(false);
    setAutosaveStatus('Unsaved decision');
  };

  // Handle Undo finding
  const handleUndoFinding = (findingId: string) => {
    setFindings((prev) =>
      prev.map((f) => (f.id === findingId ? { ...f, status: 'open', dismissNote: undefined } : f))
    );
    setAutosaveStatus('Unsaved decision');
  };

  // Handle Manual Reviewed override
  const handleMarkManualReviewed = (findingId: string) => {
    setFindings((prev) =>
      prev.map((f) => (f.id === findingId ? { ...f, status: 'manual_reviewed' } : f))
    );
    setAutosaveStatus('Unsaved decision');
  };

  // Select finding from click on OCR box
  const handleSelectOcrBox = (findingId: string) => {
    setSelectedFindingId(findingId);
    const targetElement = findingRefs.current[findingId];
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 1. Header Context Badge & Campaign Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container-high shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-container-high text-on-surface">
              {activeCampaign.code}
            </span>
            <span className="text-xs text-on-surface-variant font-medium">
              {activeBrand.name} • {activeCampaign.channel}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                !hasRunAudit
                  ? 'bg-surface-container text-on-surface-variant'
                  : compliance.criticalOpen > 0
                  ? 'bg-error-container text-on-error-container'
                  : compliance.warningOpen > 0
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-secondary-container text-on-secondary-container'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  !hasRunAudit ? 'bg-outline' : compliance.criticalOpen > 0 ? 'bg-error animate-ping' : 'bg-secondary'
                }`}
              />
              {!hasRunAudit
                ? 'Not checked yet'
                : applicableRuleCount === 0
                ? 'No enabled rules available'
                : compliance.criticalOpen > 0
                ? `Action Required (${compliance.criticalOpen} Critical, ${compliance.totalResolved} Resolved)`
                : compliance.warningOpen > 0
                ? `Review needed (${compliance.warningOpen} Warning, ${compliance.totalResolved} Resolved)`
                : findings.length === 0
                ? 'No saved rule matched'
                : `${findings.length} saved finding(s)`}
            </span>
          </div>

          <h1 className="font-serif text-2xl sm:text-3xl text-primary font-medium tracking-tight">
            {activeCampaign.title}
          </h1>
          {(activeCampaign.isDemo || activeCampaign.referenceOnly) && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {activeCampaign.isDemo && <span className="text-[10px] font-semibold text-amber-950 bg-amber-100 border border-amber-200 px-2 py-1 rounded">Sample record</span>}
              {activeCampaign.referenceOnly && <span className="text-[10px] font-semibold text-primary bg-primary-fixed/50 border border-primary-container px-2 py-1 rounded">Reference image · not a real brand campaign</span>}
            </div>
          )}
        </div>

        {/* Quick Campaign Switcher / Presets Strip */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar flex-shrink-0">
          {campaigns.map((c) => {
            const isActive = c.id === activeCampaign.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCampaign(c)}
                className={`flex items-center gap-2 p-1.5 pr-3 rounded-xl border text-left transition-all flex-shrink-0 ${
                  isActive
                    ? 'bg-surface-container-lowest border-primary shadow-sm ring-1 ring-primary/30'
                    : 'bg-surface-container-low border-surface-container-high hover:bg-surface-container opacity-85'
                }`}
              >
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-container-high relative flex-shrink-0">
                  <img src={c.imageUrl} alt={c.title} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-on-surface truncate max-w-[130px]">
                    {c.title}
                  </span>
                  <span className="text-[10px] font-mono text-on-surface-variant truncate">
                    {c.referenceOnly ? 'Image reference' : c.brandName}
                  </span>
                </div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-surface-container-highest hover:border-primary bg-surface-container-low hover:bg-surface-container text-xs font-semibold text-primary transition-all flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
            <span>+ Upload</span>
          </button>
        </div>
      </div>

      {/* 2. Main Workstation Multi-Pane Layout (Desktop Split) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (lg:col-span-7): Inspection Proof Artboard & OCR Overlays */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-md overflow-hidden">
            {/* Viewport Header Toolbar */}
            <div className="px-4 py-3 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">
                  document_scanner
                </span>
                <span className="text-xs font-bold text-on-surface uppercase tracking-wide">
                  Inspection Proof Viewport
                </span>
                <span className="font-mono text-[11px] text-on-surface-variant">
                  {activeCampaign.format}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* Zoom toggles */}
                <div className="flex items-center bg-surface-container rounded-lg p-0.5 border border-surface-container-high">
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                      zoomLevel === 1 ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant'
                    }`}
                  >
                    1x
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1.25)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                      zoomLevel === 1.25 ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant'
                    }`}
                  >
                    1.25x
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1.5)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                      zoomLevel === 1.5 ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant'
                    }`}
                  >
                    1.5x
                  </button>
                </div>

                {hasRunAudit && <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-[11px] text-on-surface-variant">Rule check saved</span>}
              </div>
            </div>

            {/* Artwork Canvas Stage with Interactive OCR Overlays */}
            <div className="relative w-full overflow-hidden bg-stone-900 flex items-center justify-center min-h-[420px] max-h-[580px] p-2 select-none">
              <div
                className="relative transition-transform duration-200 ease-out max-h-full"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                <img
                  src={activeCampaign.imageUrl}
                  alt={activeCampaign.title}
                  className="w-auto h-auto max-h-[540px] max-w-full rounded-lg object-contain shadow-2xl"
                />

                {/* Rule check progress */}
                {isScanning && (
                  <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] animate-pulse flex items-center justify-center">
                    <div className="bg-inverse-surface/90 text-inverse-on-surface px-4 py-2 rounded-xl shadow-xl flex items-center gap-2 font-mono text-xs">
                      <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                      Checking the entered text against saved rules…
                    </div>
                  </div>
                )}

                {/* Interactive Bounding Boxes Overlay */}
                {findings.map((finding) => {
                  if (!finding.bbox) return null;
                  const isSelected = selectedFindingId === finding.id;
                  const isResolved = finding.status !== 'open';

                  return (
                    <div
                      key={finding.id}
                      onClick={() => handleSelectOcrBox(finding.id)}
                      style={{
                        top: `${finding.bbox.top}%`,
                        left: `${finding.bbox.left}%`,
                        width: `${finding.bbox.width}%`,
                        height: `${finding.bbox.height}%`
                      }}
                      className={`absolute rounded cursor-pointer transition-all duration-150 z-20 ${
                        isResolved
                          ? 'border-2 border-secondary bg-secondary/15 ring-2 ring-secondary/30'
                          : finding.severity === 'critical'
                          ? 'border-2 border-dashed border-error bg-error/20 ring-2 ring-error/40 hover:bg-error/30'
                          : 'border-2 border-amber-600 bg-amber-500/20 ring-2 ring-amber-500/30 hover:bg-amber-500/30'
                      } ${isSelected ? 'scale-[1.03] ring-4 ring-offset-1 shadow-xl' : ''}`}
                    >
                      {/* Floating Target Pin */}
                      <div
                        className={`absolute -top-7 left-0 flex items-center gap-1.5 px-2 py-0.5 rounded shadow-lg whitespace-nowrap text-[10px] font-mono font-bold transition-all ${
                          isResolved
                            ? 'bg-secondary text-on-secondary'
                            : finding.severity === 'critical'
                            ? 'bg-inverse-surface text-error-container'
                            : 'bg-inverse-surface text-amber-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isResolved
                              ? 'bg-white'
                              : finding.severity === 'critical'
                              ? 'bg-error animate-pulse'
                              : 'bg-amber-400'
                          }`}
                        />
                        <span>
                          {finding.ruleId}: {isResolved ? 'Resolved' : finding.matchedText}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Overlays Watermark Pill */}
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-inverse-surface/85 backdrop-blur-md px-2.5 py-1 rounded-md text-inverse-on-surface font-mono text-[11px] pointer-events-none">
                  <span className="material-symbols-outlined text-[15px] text-secondary-fixed">
                    center_focus_strong
                  </span>
                    <span>{findings.filter((f) => f.bbox).length} saved image annotations</span>
                </div>
              </div>
            </div>

            {/* Proof Quick Action Sub-bar */}
            <div className="px-4 py-3 bg-surface-container-low border-t border-surface-container-high flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReaudit}
                  disabled={isScanning}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface text-xs font-semibold border border-surface-container-high transition-colors shadow-xs"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isScanning ? 'animate-spin' : ''}`}>
                    sync
                  </span>
                  Check text against rules
                </button>
                <button
                  type="button"
                  onClick={onOpenUpload}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface text-xs font-semibold border border-surface-container-high transition-colors shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">drive_file_move</span>
                  Replace Creative File
                </button>
              </div>

              <button
                type="button"
                onClick={() => onOpenOcrText(currentOcrText, async (text) => {
                  const updatedCampaign: CampaignPreset = {
                    ...activeCampaign,
                    caption: currentCaption,
                    ocrText: text,
                    initialFindings: [],
                    auditAt: '',
                    status: 'action_required'
                  };
                  await onSaveCampaign(updatedCampaign);
                  setCurrentOcrText(text);
                  setFindings([]);
                  setHasRunAudit(false);
                  setAutosaveStatus('Saved artwork text · run rules again');
                })}
                className="flex items-center gap-1 text-xs font-mono text-secondary hover:text-primary font-semibold py-1 px-2 rounded hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">text_fields</span>
                Edit artwork text ({currentOcrText.trim() ? currentOcrText.trim().split(/\s+/).length : 0} words)
              </button>
            </div>
          </div>

          {(activeCampaign.sourceUrl || activeCampaign.licenseName || activeCampaign.attribution) && (
            <div className="bg-surface-container-lowest px-4 py-3 rounded-xl border border-surface-container-high text-xs space-y-1">
              <div className="font-semibold text-on-surface">Image source and license</div>
              <div className="text-on-surface-variant">
                {activeCampaign.sourceName || 'Source'}{activeCampaign.attribution ? ` · ${activeCampaign.attribution}` : ''}
                {activeCampaign.licenseName ? ` · ${activeCampaign.licenseName}` : ''}
              </div>
              <div className="flex gap-3 flex-wrap">
                {activeCampaign.sourceUrl && <a href={activeCampaign.sourceUrl} target="_blank" rel="noreferrer" className="text-primary underline">Open image source</a>}
                {activeCampaign.licenseUrl && <a href={activeCampaign.licenseUrl} target="_blank" rel="noreferrer" className="text-primary underline">Read license</a>}
              </div>
              {activeCampaign.sourceDescription && <p className="text-[11px] text-on-surface-variant">{activeCampaign.sourceDescription}</p>}
            </div>
          )}

          {/* 3. Caption & Copy Editor */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">edit_note</span>
                <h2 className="font-serif text-lg font-medium text-on-surface">
                  Ad Caption & Body Copy Editor
                </h2>
              </div>
              <span className="font-mono text-xs text-on-surface-variant">
                {currentCaption.length} / 2,200 chars
              </span>
            </div>

            {/* Editable Caption Textarea */}
            <div className="relative">
              <textarea
                rows={3}
                value={currentCaption}
                onChange={(e) => handleCaptionChange(e.target.value)}
                placeholder="Draft ad copy for editorial review..."
                className="w-full p-3 rounded-xl bg-surface-container-low border border-surface-container-high text-sm font-sans text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest leading-relaxed"
              />
            </div>

            {/* Synchronized Inline Token Feedback Ribbon */}
            <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface-variant uppercase tracking-wider text-[10px]">
                  Matches from saved brand rules:
                </span>
                <button
                  type="button"
                  onClick={handleReaudit}
                  className="text-primary hover:underline font-semibold flex items-center gap-0.5"
                >
                  <span className="material-symbols-outlined text-[13px]">refresh</span>
                  Re-evaluate Rules
                </button>
              </div>

              <div className="text-xs font-mono text-on-surface leading-relaxed p-2 rounded bg-surface-container-lowest border border-surface-container-high">
                {findings.length === 0 ? (
                  <span className="text-secondary flex items-center gap-1 font-sans">
                    <span className="material-symbols-outlined text-[15px]">check_circle</span>
                    {hasRunAudit ? 'No enabled database rule matched the current text.' : 'Run a rule check to evaluate this text.'}
                  </span>
                ) : (
                  findings.map((f) => {
                    const isResolved = f.status !== 'open';
                    return (
                      <span
                        key={f.id}
                        onClick={() => handleSelectOcrBox(f.id)}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 m-0.5 rounded cursor-pointer transition-transform hover:scale-105 ${
                          isResolved
                            ? 'bg-secondary-container text-on-secondary-container line-through'
                            : f.severity === 'critical'
                            ? 'bg-error-container text-on-error-container font-bold ring-1 ring-error/50'
                            : 'bg-amber-100 text-amber-900 font-semibold ring-1 ring-amber-300'
                        }`}
                        title={f.explanation}
                      >
                        {f.matchedText}
                        <span className="material-symbols-outlined text-[12px]">
                          {isResolved ? 'check' : f.severity === 'critical' ? 'error' : 'warning'}
                        </span>
                      </span>
                    );
                  })
                )}
              </div>
              {!hasRunAudit && findings.length > 0 && (
                <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                  These findings came from the last saved check. Recheck after changing the caption or artwork text.
                </p>
              )}
            </div>

            {/* Caption Draft Footer */}
            <div className="flex items-center justify-between pt-1 text-xs">
                <span className="text-on-surface-variant flex items-center gap-1 font-mono text-[11px]">
                <span className="material-symbols-outlined text-[14px] text-secondary">{autosaveStatus === 'Saved to database' || autosaveStatus === 'Loaded from database' ? 'cloud_done' : 'edit_note'}</span>
                {autosaveStatus}
              </span>
              <button
                type="button"
                onClick={() => void handleSaveAndValidate()}
                disabled={isScanning}
                className="px-3 py-1.5 rounded-lg bg-secondary text-on-secondary font-semibold hover:bg-secondary-fixed transition-colors shadow-xs"
              >
                {isScanning ? 'Checking and saving…' : 'Save & Check Rules'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (lg:col-span-5): Compliance Audit Log & Actions Inspector */}
        <div className="lg:col-span-5 space-y-4">
          {/* Severity Distribution Tally Strip */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-error-container/60 border border-error-container text-on-error-container shadow-xs flex flex-col justify-center text-center">
              <span className="font-mono text-xs uppercase tracking-wider font-bold">
                {compliance.criticalOpen} Critical
              </span>
              <span className="text-[11px] opacity-85">Prohibited Claim</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 shadow-xs flex flex-col justify-center text-center">
              <span className="font-mono text-xs uppercase tracking-wider font-bold">
                {compliance.warningOpen} Warning
              </span>
              <span className="text-[11px] opacity-85">Advisory Limit</span>
            </div>
            <div className="p-3 rounded-xl bg-secondary-container/50 border border-secondary-fixed text-on-secondary-container shadow-xs flex flex-col justify-center text-center">
              <span className="font-mono text-xs uppercase tracking-wider font-bold">
                {compliance.totalResolved} Cleared
              </span>
              <span className="text-[11px] opacity-85">Findings resolved</span>
            </div>
          </div>

          {/* Audit Log Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-xl font-medium text-primary">Compliance Audit Findings</h2>
              <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-xs font-semibold text-on-surface">
                [{findings.length} Tagged]
              </span>
            </div>
            <span className="text-xs text-on-surface-variant font-mono">
              Enabled rules: <strong className="text-primary font-bold">{applicableRuleCount}</strong>
            </span>
          </div>

          {/* Findings Cards List */}
          <div className="space-y-3">
            {findings.map((finding, idx) => {
              const isSelected = selectedFindingId === finding.id;
              const isApplied = finding.status === 'applied';
              const isDismissed = finding.status === 'dismissed';
              const isManual = finding.status === 'manual_reviewed';
              const isResolved = isApplied || isDismissed || isManual;

              return (
                <div
                  key={finding.id}
                  ref={(el) => { findingRefs.current[finding.id] = el; }}
                  className={`bg-surface-container-lowest p-4 rounded-xl border transition-all duration-150 shadow-sm ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20 shadow-md'
                      : 'border-surface-container-high hover:border-outline-variant'
                  } ${isResolved ? 'opacity-90' : ''}`}
                >
                  {/* Finding Card Top Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                            isResolved
                              ? 'bg-secondary-container text-on-secondary-container'
                              : finding.severity === 'critical'
                              ? 'bg-error-container text-on-error-container'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          [{String(idx + 1).padStart(2, '0')}]{' '}
                          {isResolved
                            ? isApplied
                              ? 'REMEDIED'
                              : isDismissed
                              ? 'DISMISSED'
                              : 'MANUALLY REVIEWED'
                            : finding.severity.toUpperCase()}
                        </span>
                        <span className="font-mono text-[10px] text-on-surface-variant">
                          Source: {finding.source === 'both' ? 'Proof + Caption' : finding.source.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="font-sans text-sm font-bold text-on-surface leading-tight pt-1">
                        Matched Phrase: “{finding.matchedText}”
                      </h3>
                    </div>

                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isResolved
                          ? 'bg-secondary-container text-secondary'
                          : finding.severity === 'critical'
                          ? 'bg-error-container text-error'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isResolved ? 'verified' : finding.severity === 'critical' ? 'gavel' : 'info'}
                      </span>
                    </div>
                  </div>

                  {/* Rule Source Citation & Explanation */}
                  <div className="mt-2.5 p-2.5 rounded-lg bg-surface-container-low border border-surface-container-high space-y-1">
                    <div className="flex items-center gap-1.5 text-secondary font-mono text-[11px] font-bold">
                      <span className="material-symbols-outlined text-[14px]">rule</span>
                      <span>{finding.ruleSource}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      {finding.explanation}
                    </p>
                  </div>

                  {/* Suggested Correction Box */}
                  {finding.suggestedCorrection && !isResolved && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-secondary-container/30 border border-secondary-fixed-dim/50 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-secondary uppercase tracking-wider">
                          Suggested Correction:
                        </span>
                        <span className="font-mono text-[10px] text-secondary font-bold">
                          From saved rule
                        </span>
                      </div>
                      <div className="font-serif text-xs text-on-surface italic font-medium">
                        “{finding.suggestedCorrection}”
                      </div>
                    </div>
                  )}

                  {/* Dismissed note if present */}
                  {finding.dismissNote && (
                    <div className="mt-2 p-2 rounded bg-surface-container-high border border-surface-container-highest text-[11px] text-on-surface-variant">
                      <strong className="text-on-surface">Review note:</strong> {finding.dismissNote}
                    </div>
                  )}

                  {/* Interactive Decision Actions */}
                  <div className="mt-3 pt-2.5 border-t border-surface-container-high flex items-center gap-1.5 flex-wrap">
                    {!isResolved ? (
                      <>
                        {finding.suggestedCorrection && (
                          <button
                            type="button"
                            onClick={() => handleApplySuggestion(finding)}
                            className="flex-1 min-w-[120px] px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-all flex items-center justify-center gap-1 shadow-xs"
                          >
                            <span className="material-symbols-outlined text-[15px]">auto_fix_high</span>
                            Apply Suggestion
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenDismissModal(finding, (note) => {
                            setFindings((previous) => previous.map((item) => item.id === finding.id ? { ...item, status: 'dismissed', dismissNote: note } : item));
                            setAutosaveStatus('Unsaved decision');
                          })}
                          className="px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-medium border border-surface-container-high transition-colors"
                        >
                          Dismiss w/ Note
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkManualReviewed(finding.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-medium border border-surface-container-high transition-colors"
                        >
                          Mark Reviewed
                        </button>
                      </>
                    ) : (
                      <div className="w-full flex items-center justify-between">
                        <span className="text-xs text-secondary font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[15px]">check_circle</span>
                          Decision set · save to keep
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUndoFinding(finding.id)}
                          className="text-xs text-on-surface-variant hover:text-error underline py-0.5"
                        >
                          Undo Decision
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4. Future Capabilities Callout (Planned Area) */}
          <div
            onClick={() => onOpenPlannedModal('Automated Safe-Zone & Co-Signatures')}
            className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high cursor-pointer hover:bg-surface-container transition-all flex items-start gap-3 shadow-xs"
          >
            <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-secondary flex-shrink-0">
              <span className="material-symbols-outlined text-[18px]">science</span>
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.2 rounded bg-secondary-fixed text-on-secondary-fixed font-mono text-[10px] font-bold">
                  PLANNED • v2.6
                </span>
                <span className="font-sans text-xs font-bold text-on-surface">
                  Automated Safe-Zone & Co-Signatures
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                A planned feature only. It is not available or used in the current review flow.
              </p>
            </div>
          </div>

          {/* 5. Sticky Review Finalization Bar */}
          <div className="sticky bottom-4 z-30 p-3.5 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-md border border-surface-container-high shadow-xl space-y-2">
            <div className="flex items-center justify-between text-xs px-1">
              <span
                className={`font-semibold flex items-center gap-1 ${
                  compliance.criticalOpen > 0 ? 'text-error' : 'text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {compliance.criticalOpen > 0 ? 'warning' : 'fact_check'}
                </span>
                {applicableRuleCount === 0
                  ? 'No enabled database rules are available for this brand'
                  : compliance.criticalOpen > 0
                    ? `${compliance.criticalOpen} critical finding(s) still open`
                    : 'Review record will reflect the findings above'}
              </span>
              <span className="font-mono text-[11px] text-on-surface-variant">
                {hasRunAudit ? 'Rule check has been run' : 'Run a rule check before filing'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!hasRunAudit || applicableRuleCount === 0}
                onClick={() => onOpenApproveModal(activeCampaign, currentCaption, findings)}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                  !hasRunAudit || applicableRuleCount === 0
                    ? 'bg-surface-container text-on-surface-variant/60 cursor-not-allowed border border-surface-container-high'
                    : 'bg-primary text-on-primary hover:bg-primary-container cursor-pointer'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                <span>Save Review Record</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
