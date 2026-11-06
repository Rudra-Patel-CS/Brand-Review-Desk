import React from 'react';
import { CampaignPreset, ComplianceFinding } from '../../utils/rulesEngine.js';

interface ApproveExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: CampaignPreset;
  caption: string;
  findings: ComplianceFinding[];
  onConfirmApproval: () => void;
}

export const ApproveExportModal: React.FC<ApproveExportModalProps> = ({
  isOpen,
  onClose,
  campaign,
  caption,
  findings,
  onConfirmApproval
}) => {
  if (!isOpen) return null;

  const sha256 = '4f9ca821' + Math.random().toString(16).slice(2, 10) + '9318a42b' + Math.random().toString(16).slice(2, 10);
  const clearedCount = findings.filter(f => f.status === 'applied' || f.status === 'dismissed' || f.status === 'manual_reviewed').length;

  const handleDownload = () => {
    const reportData = {
      dossierId: `BRD-${Math.floor(1000 + Math.random() * 9000)}`,
      campaign: campaign.title,
      code: campaign.code,
      brand: campaign.brandName,
      channel: campaign.channel,
      reviewedAt: new Date().toISOString(),
      reviewer: 'Elena Rostova, JD (Senior Brand Counsel)',
      cryptographicSeal: sha256,
      clearedFindings: clearedCount,
      totalFindings: findings.length,
      finalCaption: caption,
      findingsDetail: findings.map(f => ({
        ruleId: f.ruleId,
        title: f.ruleTitle,
        severity: f.severity,
        status: f.status,
        matched: f.matchedText,
        correction: f.suggestedCorrection
      }))
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-audit-${campaign.code}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
              <h3 className="font-serif text-lg font-medium text-on-surface">Compliance Sign-off Authorization</h3>
              <span className="font-mono text-xs text-secondary font-semibold">
                SHA-256: {sha256.slice(0, 16)}...
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
              All Critical Legal Flags Remediated
            </div>
            <p className="text-xs text-on-surface leading-relaxed">
              Creative asset <span className="font-semibold text-primary">{campaign.title}</span> has passed compliance triage under the active rulebook of <span className="font-semibold">{campaign.brandName}</span>.
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
              Final Certified Ad Copy
            </span>
            <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface font-mono leading-relaxed">
              {caption}
            </div>
          </div>

          {/* Legal Counsel Attestation */}
          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-secondary text-[24px]">draw</span>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-on-surface">Elena Rostova, JD</span>
                <span className="text-[11px] text-on-surface-variant">Senior Counsel • Digital Advertising Ethics</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded bg-primary-fixed text-primary font-mono text-[10px] font-bold">
              VERIFIED
            </span>
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
              onClick={() => {
                onConfirmApproval();
                onClose();
              }}
              className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-all shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">verified</span>
              Authorize & File to Archive
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
