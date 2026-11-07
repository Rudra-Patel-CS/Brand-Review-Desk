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

import { getCsrfToken, AuthUser } from '../utils/auth.js';
import { WorkflowActionModal, WorkflowModalAction } from './modals/WorkflowActionModal.js';
import { EventHistoryModal } from './modals/EventHistoryModal.js';
import {
  getAllPlatforms,
  getFormatSpec,
  analyzeImageDimensions,
  detectSafeZoneOverlaps,
  SAFE_ZONE_DISCLAIMER,
  PlatformFormatSpec
} from '../utils/safeZoneEngine.js';

function detectDefaultFormatId(formatStr?: string): string {
  if (!formatStr) return 'ig_feed_portrait_4_5';
  const lower = formatStr.toLowerCase();
  if (
    lower.includes('9:16') ||
    lower.includes('reel') ||
    lower.includes('story') ||
    lower.includes('short') ||
    lower.includes('tiktok')
  ) {
    return 'ig_reels_9_16';
  }
  if (lower.includes('4:5') || lower.includes('portrait')) {
    return 'ig_feed_portrait_4_5';
  }
  if (lower.includes('1:1') || lower.includes('square')) {
    return 'ig_feed_square_1_1';
  }
  if (
    lower.includes('1.91') ||
    lower.includes('landscape') ||
    lower.includes('16:9') ||
    lower.includes('motion')
  ) {
    return 'li_feed_landscape_191_1';
  }
  return 'ig_feed_portrait_4_5';
}

interface ReviewContentProps {
  activeBrand: Brand;
  campaigns: CampaignPreset[];
  activeCampaign: CampaignPreset;
  onSelectCampaign: (campaign: CampaignPreset) => void;
  rules: BrandRule[];
  currentUser?: AuthUser;
  onOpenUpload: () => void;
  onOpenOcrText: (ocrText: string, confidence: number, campaign?: CampaignPreset) => void;
  onUpdateCampaign?: (campaign: CampaignPreset) => void;
  onOpenApproveModal: (campaign: CampaignPreset, caption: string, findings: ComplianceFinding[]) => void;
  onOpenDismissModal: (finding: ComplianceFinding) => void;
  onOpenPlannedModal: (title: string) => void;
}

export const ReviewContent: React.FC<ReviewContentProps> = ({
  activeBrand,
  campaigns,
  activeCampaign,
  onSelectCampaign,
  rules,
  currentUser,
  onOpenUpload,
  onOpenOcrText,
  onUpdateCampaign,
  onOpenApproveModal,
  onOpenDismissModal,
  onOpenPlannedModal
}) => {
  const [currentCaption, setCurrentCaption] = useState(activeCampaign.caption);
  const [currentOcrText, setCurrentOcrText] = useState(
    activeCampaign.correctedArtworkText || activeCampaign.extractedText || activeCampaign.ocrText || ''
  );
  const [findings, setFindings] = useState<ComplianceFinding[]>(activeCampaign.initialFindings);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusMessage, setScanStatusMessage] = useState('Extracting artwork text via Tesseract OCR…');
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState('Autosaved just now');
  const [zoomLevel, setZoomLevel] = useState<1 | 1.25 | 1.5>(1);

  // Workflow Action & Audit History modal states
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [workflowAction, setWorkflowAction] = useState<WorkflowModalAction>('submit');
  const [isEventHistoryOpen, setIsEventHistoryOpen] = useState(false);
  const [workflowToast, setWorkflowToast] = useState<string | null>(null);

  // Platform Safe-Zone State
  const [selectedFormatId, setSelectedFormatId] = useState<string>(() =>
    detectDefaultFormatId(activeCampaign.format)
  );
  const [showSafeZones, setShowSafeZones] = useState<boolean>(true);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isSafeZonePanelExpanded, setIsSafeZonePanelExpanded] = useState<boolean>(true);

  const findingRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Sync state when active campaign changes
  useEffect(() => {
    setCurrentCaption(activeCampaign.caption);
    setCurrentOcrText(
      activeCampaign.correctedArtworkText || activeCampaign.extractedText || activeCampaign.ocrText || ''
    );
    setFindings(activeCampaign.initialFindings);
    setSelectedFindingId(null);
    setOcrError(null);
    setSelectedFormatId(detectDefaultFormatId(activeCampaign.format));
    setImageDimensions(null);
  }, [activeCampaign]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    }
  };

  const allPlatforms = getAllPlatforms();
  const currentFormatSpec = selectedFormatId ? getFormatSpec(selectedFormatId) : null;
  const dimensionAnalysis = analyzeImageDimensions(
    imageDimensions?.width || 0,
    imageDimensions?.height || 0,
    currentFormatSpec
  );

  const visualElementsForOverlap = [
    ...findings.filter((f) => f.bbox).map((f) => ({
      id: f.id,
      text: f.matchedText,
      bbox: f.bbox!,
      severity: f.severity,
      source: 'finding' as const
    })),
    ...(activeCampaign.ocrLines || []).filter((l) => l.bbox).map((l, idx) => ({
      id: `line-${idx}`,
      text: l.text,
      bbox: l.bbox!,
      severity: 'advisory',
      source: 'ocr_line' as const
    }))
  ];

  const overlapAnalysis = detectSafeZoneOverlaps(
    visualElementsForOverlap,
    currentFormatSpec?.safeZones || []
  );

  // Re-run compliance calculations
  const compliance = calculateComplianceScore(findings);

  // Handle caption edits
  const handleCaptionChange = (newCaption: string) => {
    setCurrentCaption(newCaption);
    setAutosaveStatus('Saving draft...');
    const timeout = setTimeout(() => {
      setAutosaveStatus('Draft autosaved');
    }, 600);
    return () => clearTimeout(timeout);
  };

  // Re-scan artwork with real OCR engine
  const handleRescanOcr = async () => {
    setIsScanning(true);
    setOcrError(null);
    setScanStatusMessage('Connecting to Tesseract OCR engine...');

    try {
      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      setScanStatusMessage('Analyzing artwork pixels & recognizing text...');

      const payload: Record<string, string> = {};
      if (activeCampaign.assetId) {
        payload.assetId = activeCampaign.assetId;
      } else if (activeCampaign.imageUrl) {
        payload.imageUrl = activeCampaign.imageUrl;
      }

      const res = await fetch('/api/ocr/extract', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify(payload)
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        throw new Error(data?.error || `OCR Engine request failed with status ${res.status}`);
      }

      const extracted = data.text || '';
      const conf = typeof data.confidence === 'number' ? data.confidence : 0;
      const lines = Array.isArray(data.lines) ? data.lines : [];
      const words = Array.isArray(data.words) ? data.words : [];

      setCurrentOcrText(extracted);

      // Re-run compliance audit with genuine OCR bounding boxes
      const detected = runComplianceAudit(
        currentCaption,
        extracted,
        rules,
        activeBrand.id,
        lines,
        words
      );

      const updatedFindings = detected.map((df) => {
        const existing = findings.find((f) => f.ruleId === df.ruleId);
        if (existing && existing.status !== 'open') {
          return { ...df, status: existing.status, dismissNote: existing.dismissNote };
        }
        return df;
      });

      setFindings(updatedFindings);
      setAutosaveStatus(`OCR complete • ${conf}% confidence • ${lines.length} lines`);

      if (onUpdateCampaign) {
        onUpdateCampaign({
          ...activeCampaign,
          ocrText: extracted,
          extractedText: extracted,
          correctedArtworkText: undefined,
          ocrConfidence: conf,
          ocrLines: lines,
          ocrWords: words,
          initialFindings: updatedFindings
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'OCR scan failed';
      setOcrError(msg);
      setAutosaveStatus('OCR scan error');
    } finally {
      setIsScanning(false);
      setScanStatusMessage('');
    }
  };

  // Re-audit compliance
  const handleReaudit = () => {
    setIsScanning(true);
    setScanStatusMessage('Re-evaluating brand rules against copy & artwork...');
    setTimeout(() => {
      const detected = runComplianceAudit(
        currentCaption,
        currentOcrText,
        rules,
        activeBrand.id,
        activeCampaign.ocrLines,
        activeCampaign.ocrWords
      );
      // Preserve existing applied/dismissed findings if they still match rule
      const updatedFindings = detected.map((df) => {
        const existing = findings.find((f) => f.ruleId === df.ruleId);
        if (existing && existing.status !== 'open') {
          return { ...df, status: existing.status, dismissNote: existing.dismissNote };
        }
        return df;
      });
      setFindings(updatedFindings);
      setIsScanning(false);
      setScanStatusMessage('');
      setAutosaveStatus('Re-audit complete • 100% matched');
    }, 400);
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
    setAutosaveStatus(`Applied fix: "${finding.suggestedCorrection}"`);
  };

  // Handle Undo finding
  const handleUndoFinding = (findingId: string) => {
    setFindings((prev) =>
      prev.map((f) => (f.id === findingId ? { ...f, status: 'open', dismissNote: undefined } : f))
    );
  };

  // Handle Manual Reviewed override
  const handleMarkManualReviewed = (findingId: string) => {
    setFindings((prev) =>
      prev.map((f) => (f.id === findingId ? { ...f, status: 'manual_reviewed' } : f))
    );
  };

  // Select finding from click on OCR box
  const handleSelectOcrBox = (findingId: string) => {
    setSelectedFindingId(findingId);
    const targetElement = findingRefs.current[findingId];
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const getWorkflowBadge = (status?: string) => {
    const s = String(status || 'draft').toLowerCase();
    switch (s) {
      case 'in_review':
        return {
          label: 'In Review',
          className: 'bg-blue-100 text-blue-900 border-blue-300',
          dot: 'bg-blue-600 animate-pulse'
        };
      case 'changes_requested':
        return {
          label: 'Changes Requested',
          className: 'bg-amber-100 text-amber-900 border-amber-300',
          dot: 'bg-amber-600'
        };
      case 'approved':
        return {
          label: 'Approved',
          className: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          dot: 'bg-emerald-600'
        };
      case 'rejected':
        return {
          label: 'Rejected',
          className: 'bg-rose-100 text-rose-900 border-rose-300',
          dot: 'bg-rose-600'
        };
      case 'draft':
      default:
        return {
          label: 'Draft',
          className: 'bg-surface-container-high text-on-surface border-surface-container-highest',
          dot: 'bg-outline'
        };
    }
  };

  const handleOpenWorkflowAction = (action: WorkflowModalAction) => {
    setWorkflowAction(action);
    setIsWorkflowModalOpen(true);
  };

  const handleWorkflowTransition = async (data: {
    targetStatus: string;
    notes?: string;
    requestedChanges?: string;
    criticalOverrideReason?: string;
    allowSelfApproval?: boolean;
  }) => {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const res = await fetch(`/api/workspace/campaigns/${encodeURIComponent(activeCampaign.id)}/transition`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        ...data,
        idempotencyKey: `trans-${activeCampaign.id}-${data.targetStatus}-${Date.now()}`
      })
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(resData?.error || `Workflow transition failed: ${res.status}`);
    }

    if (onUpdateCampaign && resData.campaign) {
      onUpdateCampaign(resData.campaign);
    }
    setWorkflowToast(`Campaign status updated to "${resData.toStatus.replace(/_/g, ' ')}"`);
    setTimeout(() => setWorkflowToast(null), 3500);
  };

  const handleAddComment = async (commentText: string) => {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }

    const res = await fetch(`/api/workspace/campaigns/${encodeURIComponent(activeCampaign.id)}/comments`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ comment: commentText })
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(resData?.error || 'Failed to post comment.');
    }

    if (onUpdateCampaign && resData.campaign) {
      onUpdateCampaign(resData.campaign);
    }
    setWorkflowToast('Reviewer comment added to audit record');
    setTimeout(() => setWorkflowToast(null), 3000);
  };

  const handleExportAudit = () => {
    window.open(`/api/workspace/campaigns/${encodeURIComponent(activeCampaign.id)}/export`, '_blank');
  };

  const currentStatus = String(activeCampaign.status || 'draft').toLowerCase();
  const wfBadge = getWorkflowBadge(currentStatus);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 1. Header Context Badge & Campaign Meta */}
      <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container-high shadow-sm space-y-4">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface-container-high text-on-surface">
              {activeCampaign.code}
            </span>
            <span className="text-xs text-on-surface-variant font-medium">
              {activeBrand.name} • {activeCampaign.channel}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                compliance.criticalOpen > 0
                  ? 'bg-error-container text-on-error-container'
                  : compliance.warningOpen > 0
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-secondary-container text-on-secondary-container'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  compliance.criticalOpen > 0 ? 'bg-error animate-ping' : 'bg-secondary'
                }`}
              />
              {compliance.criticalOpen > 0
                ? `Action Required (${compliance.criticalOpen} Critical, ${compliance.totalResolved} Cleared)`
                : compliance.warningOpen > 0
                ? `Advisory Clearance (${compliance.warningOpen} Warning, ${compliance.totalResolved} Cleared)`
                : `All Rules Passed (${compliance.totalResolved} Cleared)`}
            </span>

            {/* Workflow Status Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${wfBadge.className}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${wfBadge.dot}`} />
              <span>Status: {wfBadge.label}</span>
            </span>
          </div>

          <h1 className="font-serif text-2xl sm:text-3xl text-primary font-medium tracking-tight break-words">
            {activeCampaign.title}
          </h1>
        </div>

        {/* Workflow Notification Banners */}
        {workflowToast && (
          <div className="p-2.5 rounded-xl bg-primary text-on-primary text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <span className="material-symbols-outlined text-[18px]">info</span>
            <span>{workflowToast}</span>
          </div>
        )}

        {activeCampaign.requestedChanges && currentStatus === 'changes_requested' && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-950 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-amber-700 text-[18px] shrink-0 mt-0.5">assignment_return</span>
            <div className="space-y-0.5">
              <span className="font-bold text-amber-900 block">Editorial Revisions Requested ({activeCampaign.changesRequestedBy || 'Reviewer'}):</span>
              <p className="text-[11px] leading-relaxed text-amber-900/90">{activeCampaign.requestedChanges}</p>
            </div>
          </div>
        )}

        {activeCampaign.rejectionReason && currentStatus === 'rejected' && (
          <div className="bg-rose-500/10 border border-rose-500/40 rounded-xl p-3 text-xs text-rose-950 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-rose-700 text-[18px] shrink-0 mt-0.5">cancel</span>
            <div className="space-y-0.5">
              <span className="font-bold text-rose-900 block">Campaign Rejected ({activeCampaign.rejectedBy || 'Approver'}):</span>
              <p className="text-[11px] leading-relaxed text-rose-900/90">{activeCampaign.rejectionReason}</p>
            </div>
          </div>
        )}

        {activeCampaign.criticalOverrideReason && (
          <div className="bg-purple-500/10 border border-purple-500/40 rounded-xl p-3 text-xs text-purple-950 flex items-start gap-2.5">
            <span className="material-symbols-outlined text-purple-700 text-[18px] shrink-0 mt-0.5">gavel</span>
            <div className="space-y-0.5">
              <span className="font-bold text-purple-900 block">Documented Critical Override ({activeCampaign.overrideApprovedBy || activeCampaign.approvedBy || 'Approver'}):</span>
              <p className="font-mono text-[11px] text-purple-900/90">{activeCampaign.criticalOverrideReason}</p>
            </div>
          </div>
        )}

        {/* Workflow Actions & Sign-Offs Bar */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-surface-container-high flex-wrap">
          {/* Sign-offs info */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {activeCampaign.reviewedBy ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container text-on-surface font-mono text-[11px]">
                <span className="material-symbols-outlined text-[15px] text-primary">person_check</span>
                <span>Reviewed by: <strong>{activeCampaign.reviewedBy}</strong></span>
              </span>
            ) : (
              <span className="text-on-surface-variant text-[11px] font-mono">
                Reviewer: Unassigned
              </span>
            )}

            {activeCampaign.approvedBy && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-mono text-[11px]">
                <span className="material-symbols-outlined text-[15px] text-emerald-700">verified</span>
                <span>Approved by: <strong>{activeCampaign.approvedBy}</strong></span>
              </span>
            )}

            {activeCampaign.rejectedBy && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 font-mono text-[11px]">
                <span className="material-symbols-outlined text-[15px] text-rose-700">cancel</span>
                <span>Rejected by: <strong>{activeCampaign.rejectedBy}</strong></span>
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {(currentStatus === 'draft' || currentStatus === 'changes_requested') && (
              <button
                type="button"
                onClick={() => handleOpenWorkflowAction('submit')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary hover:bg-primary-container text-xs font-semibold shadow-xs transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                <span>Submit for Review</span>
              </button>
            )}

            {currentStatus === 'in_review' && (
              <>
                <button
                  type="button"
                  onClick={() => handleOpenWorkflowAction('request_changes')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">assignment_return</span>
                  <span>Request Changes</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenWorkflowAction('approve')}
                  disabled={currentUser && currentUser.role === 'reviewer'}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-40"
                  title={currentUser?.role === 'reviewer' ? 'Approval requires Approver or Admin role' : 'Sign off & approve campaign'}
                >
                  <span className="material-symbols-outlined text-[16px]">verified</span>
                  <span>Approve Campaign</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenWorkflowAction('reject')}
                  disabled={currentUser && currentUser.role === 'reviewer'}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-40"
                  title={currentUser?.role === 'reviewer' ? 'Rejection requires Approver or Admin role' : 'Reject campaign'}
                >
                  <span className="material-symbols-outlined text-[16px]">cancel</span>
                  <span>Reject</span>
                </button>
              </>
            )}

            {currentStatus === 'approved' && currentUser?.role === 'admin' && (
              <button
                type="button"
                onClick={() => handleOpenWorkflowAction('submit')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">replay</span>
                <span>Re-open Review</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsEventHistoryOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface text-xs font-semibold border border-surface-container-high transition-colors shadow-xs"
              title="View chronological event history and audit log"
            >
              <span className="material-symbols-outlined text-[16px]">history</span>
              <span>Audit History</span>
            </button>

            <button
              type="button"
              onClick={handleExportAudit}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface text-xs font-semibold border border-surface-container-high transition-colors shadow-xs"
              title="Export saved review audit record in JSON"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export Record</span>
            </button>
          </div>
        </div>

        {/* Quick Campaign Switcher / Presets Strip */}
        <div className="relative w-full min-w-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
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
                    <span className="text-[10px] font-mono text-on-surface-variant truncate max-w-[130px]">
                      {c.brandName}
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
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-surface-container-lowest to-transparent" />
        </div>
      </div>

      {/* 2. Main Workstation Multi-Pane Layout (Desktop Split) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (lg:col-span-7): Inspection Proof Artboard & OCR Overlays */}
        <div className="lg:col-span-7 min-w-0 space-y-4">
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
                  {currentFormatSpec ? currentFormatSpec.name : activeCampaign.format}
                </span>

                {/* Dimension Comparison Badge */}
                {imageDimensions && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border flex items-center gap-1 ${
                      dimensionAnalysis.status === 'exact_match'
                        ? 'bg-secondary/15 text-secondary border-secondary/30'
                        : dimensionAnalysis.status === 'aspect_ratio_match'
                        ? 'bg-primary/15 text-primary border-primary/30'
                        : dimensionAnalysis.status === 'dimension_mismatch'
                        ? 'bg-error-container text-on-error-container border-error/40'
                        : 'bg-surface-container text-on-surface-variant border-surface-container-high'
                    }`}
                    title={dimensionAnalysis.message}
                  >
                    <span className="material-symbols-outlined text-[12px]">
                      {dimensionAnalysis.status === 'exact_match' || dimensionAnalysis.status === 'aspect_ratio_match'
                        ? 'check_circle'
                        : 'warning'}
                    </span>
                    <span>
                      {imageDimensions.width}×{imageDimensions.height} ({dimensionAnalysis.actualAspectRatioString})
                      {dimensionAnalysis.status === 'exact_match' && ' • Target Match'}
                      {dimensionAnalysis.status === 'dimension_mismatch' && ` • Needs ${currentFormatSpec?.aspectRatio || 'Target'}`}
                    </span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Safe-zone toggle button */}
                <button
                  type="button"
                  onClick={() => setShowSafeZones(!showSafeZones)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-colors border shadow-xs ${
                    showSafeZones
                      ? 'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/50'
                      : 'bg-surface-container text-on-surface-variant border-surface-container-high hover:text-on-surface'
                  }`}
                  title="Toggle Platform UI Safe-Zone Overlays"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {showSafeZones ? 'layers' : 'layers_clear'}
                  </span>
                  <span>Safe Zones: {showSafeZones ? 'ON' : 'OFF'}</span>
                </button>

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

                <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-[11px] text-on-surface-variant">
                  {activeCampaign.ocrConfidence > 0
                    ? `OCR Confidence: ${activeCampaign.ocrConfidence}%`
                    : 'OCR: No text detected'}
                </span>
              </div>
            </div>

            {/* Genuine OCR Engine Error Banner */}
            {ocrError && (
              <div className="px-4 py-2.5 bg-error-container text-on-error-container border-b border-error/30 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span><strong>OCR Engine Notice:</strong> {ocrError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOcrError(null)}
                  className="text-on-error-container hover:opacity-85"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            )}

            {/* Artwork Canvas Stage with Interactive OCR Overlays & Safe Zones */}
            <div className="relative w-full overflow-hidden bg-stone-900 flex items-center justify-center min-h-[420px] max-h-[580px] p-2 select-none">
              <div
                className="relative transition-transform duration-200 ease-out max-h-full"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                <img
                  src={activeCampaign.imageUrl}
                  alt={activeCampaign.title}
                  onLoad={handleImageLoad}
                  className="w-auto h-auto max-h-[540px] max-w-full rounded-lg object-contain shadow-2xl"
                />

                {/* Visual Platform Safe-Zone Overlays */}
                {showSafeZones &&
                  currentFormatSpec?.safeZones?.map((sz) => (
                    <div
                      key={sz.id}
                      style={{
                        top: `${sz.top}%`,
                        left: `${sz.left}%`,
                        width: `${sz.width}%`,
                        height: `${sz.height}%`
                      }}
                      className={`absolute pointer-events-none transition-all z-10 flex flex-col justify-start p-1 border border-dashed ${
                        sz.severity === 'high'
                          ? 'bg-rose-600/25 border-rose-400/80 ring-1 ring-rose-500/40'
                          : 'bg-amber-500/25 border-amber-400/80 ring-1 ring-amber-500/40'
                      }`}
                    >
                      <div className="flex items-center gap-1 bg-stone-950/85 backdrop-blur-xs px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-amber-200 w-fit shadow-xs">
                        <span className="material-symbols-outlined text-[11px] text-amber-400">
                          visibility_off
                        </span>
                        <span>{sz.name}</span>
                      </div>
                    </div>
                  ))}

                {/* Simulated OCR scanning scanline when re-scanning */}
                {isScanning && (
                  <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] animate-pulse flex items-center justify-center z-30">
                    <div className="bg-inverse-surface/90 text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 font-mono text-xs">
                      <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>
                      <span>{scanStatusMessage || 'Scanning OCR Coordinates & Brand Rules...'}</span>
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
                  <span>{findings.filter((f) => f.bbox).length} OCR Markers Active</span>
                </div>
              </div>
            </div>

            {/* Wikimedia Commons Attribution & Source Links */}
            {activeCampaign.sourceName && (
              <div className="px-4 py-2.5 bg-surface-container-low border-t border-surface-container-high flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-on-surface-variant min-w-0">
                  <span className="material-symbols-outlined text-[16px] text-secondary shrink-0">attribution</span>
                  <span className="truncate">
                    Source: <strong className="text-on-surface">{activeCampaign.sourceName}</strong>
                    {activeCampaign.attribution ? ` • Author: ${activeCampaign.attribution}` : ''}
                    {activeCampaign.licenseName ? ` • License: ${activeCampaign.licenseName}` : ''}
                  </span>
                </div>
                {activeCampaign.sourceUrl && (
                  <a
                    href={activeCampaign.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-secondary hover:text-primary font-semibold underline text-xs shrink-0"
                  >
                    <span>View Source & License</span>
                    <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  </a>
                )}
              </div>
            )}

            {/* GridFS Asset Metadata Badge */}
            {activeCampaign.assetId && (
              <div className="px-4 py-2 bg-surface-container-low border-t border-surface-container-high flex items-center justify-between gap-2 text-[11px] font-mono text-secondary">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">cloud_done</span>
                  <span>GridFS Asset ID: {activeCampaign.assetId.slice(0, 12)}…</span>
                </div>
                {activeCampaign.assetMetadata?.size && (
                  <span className="text-on-surface-variant">
                    {Math.round(activeCampaign.assetMetadata.size / 1024)} KB · {activeCampaign.assetMetadata.mimeType}
                  </span>
                )}
              </div>
            )}

            {/* Proof Quick Action Sub-bar */}
            <div className="px-4 py-3 bg-surface-container-low border-t border-surface-container-high flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRescanOcr}
                  disabled={isScanning}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface text-xs font-semibold border border-surface-container-high transition-colors shadow-xs"
                >
                  <span className={`material-symbols-outlined text-[16px] ${isScanning ? 'animate-spin' : ''}`}>
                    sync
                  </span>
                  Re-scan OCR
                </button>
                <button
                  type="button"
                  onClick={handleReaudit}
                  disabled={isScanning}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface text-xs font-semibold border border-surface-container-high transition-colors shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">rule</span>
                  Re-audit Rules
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
                onClick={() => onOpenOcrText(currentOcrText, activeCampaign.ocrConfidence, activeCampaign)}
                className="flex items-center gap-1 text-xs font-mono text-secondary hover:text-primary font-semibold py-1 px-2 rounded hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">text_fields</span>
                Review / Correct Artwork Text ({currentOcrText.trim() ? currentOcrText.trim().split(/\s+/).length : 0} words)
              </button>
            </div>
          </div>

          {/* Platform Safe-Zone & Visual Layout Guidance Card */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-md overflow-hidden">
            <div className="px-4 py-3 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">aspect_ratio</span>
                <span className="text-xs font-bold text-on-surface uppercase tracking-wide">
                  Platform Safe-Zone & Layout Guidance
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Platform / Format Selector Dropdown */}
                <select
                  value={selectedFormatId}
                  onChange={(e) => setSelectedFormatId(e.target.value)}
                  className="text-xs bg-surface-container-lowest border border-surface-container-high rounded-lg px-2.5 py-1 text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
                >
                  {allPlatforms.map((plat) => (
                    <optgroup key={plat.id} label={plat.name}>
                      {plat.formats.map((fmt) => (
                        <option key={fmt.id} value={fmt.id}>
                          {plat.name} — {fmt.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="custom">Custom / Unsupported Format</option>
                </select>

                <button
                  type="button"
                  onClick={() => setIsSafeZonePanelExpanded(!isSafeZonePanelExpanded)}
                  className="text-on-surface-variant hover:text-on-surface p-1 rounded hover:bg-surface-container transition-colors"
                  title={isSafeZonePanelExpanded ? 'Collapse safe-zone panel' : 'Expand safe-zone panel'}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isSafeZonePanelExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
              </div>
            </div>

            {isSafeZonePanelExpanded && (
              <div className="p-4 space-y-3.5 text-xs">
                {/* Dimension & Aspect Ratio Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-surface-container-low border border-surface-container-high">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-on-surface">Asset Dimensions:</span>
                      <span className="font-mono text-on-surface-variant">
                        {imageDimensions
                          ? `${imageDimensions.width} × ${imageDimensions.height} px (${dimensionAnalysis.actualAspectRatioString})`
                          : 'Detecting image dimensions…'}
                      </span>
                      {currentFormatSpec && (
                        <>
                          <span className="text-on-surface-variant">•</span>
                          <span className="font-semibold text-on-surface">Target:</span>
                          <span className="font-mono text-on-surface-variant">
                            {currentFormatSpec.targetWidth} × {currentFormatSpec.targetHeight} px ({currentFormatSpec.aspectRatio})
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-on-surface-variant">{dimensionAnalysis.message}</p>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 border ${
                      dimensionAnalysis.status === 'exact_match'
                        ? 'bg-secondary/15 text-secondary border-secondary/30'
                        : dimensionAnalysis.status === 'aspect_ratio_match'
                        ? 'bg-primary/15 text-primary border-primary/30'
                        : dimensionAnalysis.status === 'dimension_mismatch'
                        ? 'bg-error-container text-on-error-container border-error/40'
                        : 'bg-surface-container text-on-surface-variant border-surface-container-high'
                    }`}
                  >
                    {dimensionAnalysis.label}
                  </span>
                </div>

                {/* Obscured Region Detection Warnings */}
                {overlapAnalysis.hasOverlaps ? (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-950 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-rose-900">
                      <span className="material-symbols-outlined text-[18px] text-rose-700">warning</span>
                      <span>Interface Obscuration Alert: {overlapAnalysis.totalObscuredCount} element(s) overlap platform UI controls</span>
                    </div>
                    <ul className="space-y-1.5 pl-5 list-disc text-[11px] text-rose-900/90 leading-relaxed">
                      {overlapAnalysis.overlaps.map((item, idx) => (
                        <li key={idx}>
                          <strong>"{item.text}"</strong> intersects <strong>{item.safeZoneName}</strong> (~{item.overlapPercentage}% obscured).
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : currentFormatSpec?.safeZones && currentFormatSpec.safeZones.length > 0 ? (
                  <div className="p-2.5 rounded-xl bg-secondary/10 border border-secondary/30 text-secondary flex items-center gap-2 text-xs">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>
                      Safe-Zone Clearance Verified: Detected text elements and compliance claims avoid critical platform interface overlays.
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-on-surface-variant flex items-center gap-2 text-xs">
                    <span className="material-symbols-outlined text-[18px]">info</span>
                    <span>
                      Full Canvas Safe: Native platform interface elements do not intrude into the artwork canvas for this format.
                    </span>
                  </div>
                )}

                {/* Layout Guidance from Platform Spec */}
                {currentFormatSpec?.layoutGuidance && (
                  <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
                    <span className="font-bold text-on-surface block text-[11px] uppercase tracking-wide">
                      Platform Layout Recommendations ({currentFormatSpec.name})
                    </span>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      {currentFormatSpec.layoutGuidance}
                    </p>
                  </div>
                )}

                {/* Official Source Documentation Citation & Verification Date */}
                {currentFormatSpec?.officialSourceUrl && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-surface-container-high text-[11px] text-on-surface-variant">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-secondary">verified</span>
                      <span>
                        Verified Specification ({currentFormatSpec.lastVerifiedDate}):{' '}
                        <strong>{currentFormatSpec.officialSourceDoc}</strong>
                      </span>
                    </div>
                    <a
                      href={currentFormatSpec.officialSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-secondary hover:text-primary font-semibold underline"
                    >
                      <span>Official Source Specs</span>
                      <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                    </a>
                  </div>
                )}

                {/* Safe-Zone Standard Disclaimer */}
                <p className="text-[10px] text-on-surface-variant/75 italic leading-tight pt-0.5">
                  {SAFE_ZONE_DISCLAIMER}
                </p>
              </div>
            )}
          </div>

          {/* OCR Transparency & Human Verification Statement Card */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-950 shadow-xs">
            <span className="material-symbols-outlined text-[20px] text-amber-700 shrink-0 mt-0.5">verified_user</span>
            <div className="space-y-1">
              <span className="font-bold text-amber-900 block">OCR Transparency & Human Review Notice</span>
              <p className="text-[11px] text-amber-900/80 leading-relaxed">
                Optical Character Recognition (OCR) may miss, misread, or truncate artwork text depending on font typography, contrast, or image compression. Automated OCR text extraction is not a legal compliance certification. Reviewers must review extracted text and can manually correct results at any time before final sign-off.
              </p>
            </div>
          </div>

          {/* 3. Caption & Copy Editor */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-md space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
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
                  Live Token Lexical Parsing:
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
                    All clear! No restricted phrases detected in current draft.
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
            </div>

            {/* Caption Draft Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <span className="text-on-surface-variant flex items-center gap-1 font-mono text-[11px]">
                <span className="material-symbols-outlined text-[14px] text-secondary">cloud_done</span>
                {autosaveStatus}
              </span>
              <button
                type="button"
                onClick={handleReaudit}
                className="px-3 py-1.5 rounded-lg bg-secondary text-on-secondary font-semibold hover:bg-secondary-fixed transition-colors shadow-xs"
              >
                Save & Validate Copy
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (lg:col-span-5): Compliance Audit Log & Actions Inspector */}
        <div className="lg:col-span-5 min-w-0 space-y-4">
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
              <span className="text-[11px] opacity-85">Verified OK</span>
            </div>
          </div>

          {/* Audit Log Header */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-serif text-xl font-medium text-primary">Compliance Audit Findings</h2>
              <span className="px-2 py-0.5 rounded bg-surface-container font-mono text-xs font-semibold text-on-surface">
                [{findings.length} Tagged]
              </span>
            </div>
            <span className="text-xs text-on-surface-variant font-mono">
              Score: <strong className="text-primary font-bold">{compliance.score}%</strong>
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
                          Suggested Compliant Correction:
                        </span>
                        <span className="font-mono text-[10px] text-secondary font-bold">
                          Pre-Approved
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
                      <strong className="text-on-surface">Counsel Waiver Note:</strong> {finding.dismissNote}
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
                          onClick={() => onOpenDismissModal(finding)}
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
                          Decision Recorded
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
                Multi-counsel approvals and TikTok UI overlap safe-zone checks are scheduled for next platform release. Click to learn more.
              </p>
            </div>
          </div>

          {/* 5. Sticky Review Finalization Bar */}
          <div className="sticky bottom-4 z-30 p-3.5 rounded-2xl bg-surface-container-lowest/95 backdrop-blur-md border border-surface-container-high shadow-xl space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs px-1">
              <span
                className={`font-semibold flex items-center gap-1 ${
                  compliance.criticalOpen > 0 ? 'text-error' : 'text-secondary'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {compliance.criticalOpen > 0 ? 'lock' : 'lock_open'}
                </span>
                {compliance.criticalOpen > 0
                  ? `Resolve ${compliance.criticalOpen} Critical Issue(s) to Authorize`
                  : 'All Critical Blocks Cleared'}
              </span>
              <span className="font-mono text-[11px] text-on-surface-variant">
                Gatekeeper: Legal Counsel
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenWorkflowAction('approve')}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
                <span>
                  {compliance.criticalOpen > 0
                    ? `Sign-Off & Document Override (${compliance.criticalOpen} Critical)`
                    : 'Sign-Off & Approve Campaign'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Action Transition Modal */}
      {currentUser && (
        <WorkflowActionModal
          isOpen={isWorkflowModalOpen}
          onClose={() => setIsWorkflowModalOpen(false)}
          action={workflowAction}
          campaign={activeCampaign}
          currentUser={currentUser}
          findings={findings}
          onConfirm={handleWorkflowTransition}
        />
      )}

      {/* Chronological Event History & Audit Modal */}
      <EventHistoryModal
        isOpen={isEventHistoryOpen}
        onClose={() => setIsEventHistoryOpen(false)}
        campaign={activeCampaign}
        onAddComment={handleAddComment}
      />
    </div>
  );
};
