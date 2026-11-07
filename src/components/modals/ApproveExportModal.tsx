import React, { useEffect, useState } from 'react';
import { CampaignPreset, ComplianceFinding } from '../../utils/rulesEngine.js';
import { downloadBlob } from '../../utils/download.js';

interface ApproveExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: CampaignPreset;
  caption: string;
  findings: ComplianceFinding[];
  reviewerName: string;
  onConfirmApproval: () => void;
  isDemoMode?: boolean;
}

export const ApproveExportModal: React.FC<ApproveExportModalProps> = ({
  isOpen,
  onClose,
  campaign,
  caption,
  findings,
  reviewerName,
  onConfirmApproval,
  isDemoMode = false
}) => {
  const [visualReviewed, setVisualReviewed] = useState(false);
  const [factsVerified, setFactsVerified] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setVisualReviewed(false);
      setFactsVerified(false);
    }
  }, [isOpen]);
  if (!isOpen) return null;

  const clearedCount = findings.filter(f => f.status === 'applied' || f.status === 'dismissed' || f.status === 'manual_reviewed').length;
  const unresolvedFindings = findings.filter((finding) => finding.status === 'open');
  const queuedCreative = findings.filter((f) => f.queuedCreativeCorrection && f.status !== 'applied' && f.status !== 'dismissed' && f.status !== 'manual_reviewed');
  const openCritical = unresolvedFindings.filter((f) => f.severity === 'critical');
  const canConfirm = visualReviewed && factsVerified && queuedCreative.length === 0 && unresolvedFindings.length === 0;

  const handleDownload = () => {
    const reportData = {
      campaign: campaign.title,
      code: campaign.code,
      brand: campaign.brandName,
      channel: campaign.channel,
      exportedAt: new Date().toISOString(),
      workflowStatus: 'awaiting_confirmation',
      reviewer: reviewerName,
      cryptographicSeal: null,
      clearedFindings: clearedCount,
      totalFindings: findings.length,
      finalCaption: caption,
      demo: isDemoMode,
      disclaimer: 'This is a review preview, not a legal certification or completed approval.',
      findingsDetail: findings.map(f => ({
        ruleId: f.ruleId,
        title: f.ruleTitle,
        severity: f.severity,
        status: f.status,
        matched: f.matchedText,
        correction: f.suggestedCorrection,
        reason: f.explanation,
        ruleSource: f.ruleSource,
        dismissNote: f.dismissNote
      }))
    };

    downloadBlob(
      new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' }),
      `compliance-audit-${campaign.code}.json`
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-on-secondary shadow-sm">
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
            </div>
            <div>
              <h3 className="font-serif text-lg font-medium text-on-surface">
                {isDemoMode ? 'Demo Review Sign-off' : 'Compliance Sign-off Authorization'}
              </h3>
              <span className="font-mono text-xs text-secondary font-semibold">
                {isDemoMode ? 'Local demo · no server attestation' : 'Review preview · not yet approved'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Attestation Banner */}
          <div className="p-3.5 rounded-xl bg-secondary-container/40 border border-secondary-fixed-dim/60 space-y-1">
            <div className="flex items-center gap-1.5 text-secondary font-semibold text-xs">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              {isDemoMode ? 'Public Demo — Not a Legal Certification' : 'Review Preview — Approval Not Yet Filed'}
            </div>
            <p className="text-xs text-on-surface leading-relaxed">
              {isDemoMode
                ? <>This local-only demo record does not represent a legal certification or server-verified approval. Creative asset <span className="font-semibold text-primary">{campaign.title}</span> is shown for workflow demonstration only.</>
                : <>Review preview for <span className="font-semibold text-primary">{campaign.title}</span> against the configured rules for <span className="font-semibold">{campaign.brandName}</span>. This is not a legal certification.</>}
            </p>
          </div>

          {/* Campaign Details Recap */}
          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Campaign Code:</span>
              <span className="font-mono font-semibold text-on-surface">{campaign.code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Distribution Channel:</span>
              <span className="font-semibold text-on-surface">{campaign.channel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Cleared Findings:</span>
              <span className="font-mono font-bold text-secondary">{clearedCount} of {findings.length} Cleared</span>
            </div>
          </div>

          {/* Approved Final Caption */}
          <div>
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">
              Final Caption Preview
            </span>
            <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface font-mono leading-relaxed">
              {caption}
            </div>
          </div>

          {queuedCreative.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950">
              <strong>Creative replacement required:</strong> {queuedCreative.length} image finding(s) have queued copy changes. Upload the corrected artwork and re-run OCR/checks before filing approval.
            </div>
          )}

          {unresolvedFindings.length > 0 && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container text-xs">
              <strong>Resolve or dismiss every finding before approval:</strong>{' '}
              {unresolvedFindings.map((finding) => finding.ruleId).join(', ')}
            </div>
          )}

          {openCritical.length > 0 && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-950">
              <strong>Unresolved critical findings:</strong> {openCritical.length} critical issue(s) remain open. Resolve them, dismiss with a documented reason, mark manual review where appropriate, or use the workflow override path before approval can be filed.
            </div>
          )}

          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high space-y-2 text-xs">
            <span className="font-semibold text-on-surface block">Human confirmation (required)</span>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={visualReviewed} onChange={(e) => setVisualReviewed(e.target.checked)} className="mt-0.5" />
              <span>I manually reviewed visual layout, safe zones, contrast, logos, and anything OCR or rules cannot verify.</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={factsVerified} onChange={(e) => setFactsVerified(e.target.checked)} className="mt-0.5" />
              <span>I verified claims/terms/facts against approved evidence where required; configured rule checks are not independent fact verification.</span>
            </label>
          </div>

        </div>

        <div className="px-5 py-3.5 bg-surface-container-low border-t border-surface-container-high flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-xs text-secondary font-semibold hover:text-primary py-1 px-2"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            Download Audit JSON
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => {
                if (!canConfirm) return;
                onConfirmApproval();
                onClose();
              }}
              className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              {canConfirm ? 'Confirm Approval & File' : 'Complete Checklist to Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
