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

export const ApproveExportModal: React.FC<ApproveExportModalProps> = ({ isOpen, onClose, campaign, caption, findings, onConfirmApproval }) => {
  if (!isOpen) return null;
  const resolved = findings.filter((finding) => finding.status !== 'open').length;
  const open = findings.length - resolved;
  const reviewRecord = {
    campaign: campaign.title,
    campaignCode: campaign.code,
    brand: campaign.brandName,
    channel: campaign.channel,
    savedAt: new Date().toISOString(),
    status: open ? 'conditional' : 'approved',
    findingsCount: findings.length,
    resolvedFindings: resolved,
    openFindings: open,
    finalCaption: caption,
    findings: findings.map((finding) => ({
      ruleId: finding.ruleId,
      title: finding.ruleTitle,
      severity: finding.severity,
      status: finding.status,
      matchedText: finding.matchedText,
      note: finding.dismissNote
    }))
  };

  const handleDownload = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(reviewRecord, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `review-${campaign.code}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary"><span className="material-symbols-outlined text-[18px]">fact_check</span></div>
            <div>
              <h3 className="font-serif text-lg font-medium text-on-surface">Save review record</h3>
              <span className="text-xs text-on-surface-variant">This records the current review in MongoDB.</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface"><span className="material-symbols-outlined text-[18px]">close</span></button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {campaign.isDemo && <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950">This campaign is marked as sample data. Its review will also be marked as sample data.</div>}
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2 text-xs">
            <div className="flex justify-between gap-3"><span className="text-on-surface-variant">Campaign</span><strong className="text-on-surface text-right">{campaign.title}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-on-surface-variant">Brand</span><span className="text-on-surface">{campaign.brandName}</span></div>
            <div className="flex justify-between gap-3"><span className="text-on-surface-variant">Findings resolved</span><span className="font-mono text-on-surface">{resolved} / {findings.length}</span></div>
            <div className="flex justify-between gap-3"><span className="text-on-surface-variant">Findings still open</span><span className="font-mono text-on-surface">{open}</span></div>
            <div className="flex justify-between gap-3"><span className="text-on-surface-variant">Record status</span><span className="font-semibold text-primary">{open ? 'Conditional' : 'Approved'}</span></div>
          </div>
          <div>
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1">Caption saved with this review</span>
            <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface font-mono leading-relaxed whitespace-pre-wrap">{caption || 'No caption entered.'}</div>
          </div>
          <p className="text-[11px] text-on-surface-variant">The record does not include a verified reviewer identity or digital signature.</p>
        </div>

        <div className="px-5 py-3.5 bg-surface-container-low border-t border-surface-container-high flex items-center justify-between gap-2 flex-wrap">
          <button type="button" onClick={handleDownload} className="flex items-center gap-1.5 text-xs text-secondary font-semibold hover:text-primary py-1 px-2"><span className="material-symbols-outlined text-[16px]">file_download</span>Download JSON</button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1.5 rounded text-xs text-on-surface-variant hover:text-on-surface">Cancel</button>
            <button type="button" onClick={onConfirmApproval} className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">save</span>Save to history</button>
          </div>
        </div>
      </div>
    </div>
  );
};
