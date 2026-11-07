import React, { useState } from 'react';
import { CampaignPreset, ComplianceFinding } from '../../utils/rulesEngine.js';
import { AuthUser } from '../../utils/auth.js';

export type WorkflowModalAction = 'submit' | 'request_changes' | 'approve' | 'reject';

interface WorkflowActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: WorkflowModalAction;
  campaign: CampaignPreset;
  currentUser: AuthUser;
  findings: ComplianceFinding[];
  onConfirm: (data: {
    targetStatus: string;
    notes?: string;
    requestedChanges?: string;
    criticalOverrideReason?: string;
    allowSelfApproval?: boolean;
  }) => Promise<void>;
}

export const WorkflowActionModal: React.FC<WorkflowActionModalProps> = ({
  isOpen,
  onClose,
  action,
  campaign,
  currentUser,
  findings,
  onConfirm
}) => {
  const [notes, setNotes] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [allowSelfApproval, setAllowSelfApproval] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const openCriticalFindings = findings.filter(
    (f) => f.severity === 'critical' && f.status === 'open'
  );

  const isSelf =
    (campaign.creatorId && String(campaign.creatorId) === String(currentUser.id)) ||
    (campaign.createdBy && campaign.createdBy.toLowerCase() === currentUser.username.toLowerCase()) ||
    (campaign.reviewerId && String(campaign.reviewerId) === String(currentUser.id)) ||
    (campaign.reviewedBy && campaign.reviewedBy.toLowerCase() === currentUser.username.toLowerCase());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let targetStatus = 'draft';
    if (action === 'submit') targetStatus = 'in_review';
    if (action === 'request_changes') targetStatus = 'changes_requested';
    if (action === 'approve') targetStatus = 'approved';
    if (action === 'reject') targetStatus = 'rejected';

    if (action === 'request_changes' && !notes.trim()) {
      setError('Please provide specific details on the changes required.');
      return;
    }

    if (action === 'reject' && !notes.trim()) {
      setError('Please provide a reason for rejecting this campaign.');
      return;
    }

    if (action === 'approve' && openCriticalFindings.length > 0 && !overrideReason.trim()) {
      setError(
        `This campaign has ${openCriticalFindings.length} unresolved critical finding(s). A documented written override justification is required.`
      );
      return;
    }

    if (action === 'approve' && isSelf && currentUser.role !== 'admin' && !allowSelfApproval) {
      setError('Self-approval policy requires a separate approver sign-off.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        targetStatus,
        notes: notes.trim() || undefined,
        requestedChanges: action === 'request_changes' ? notes.trim() : undefined,
        criticalOverrideReason: overrideReason.trim() || undefined,
        allowSelfApproval
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (action) {
      case 'submit':
        return 'Submit Campaign for Review';
      case 'request_changes':
        return 'Request Editorial Changes';
      case 'approve':
        return 'Approve Campaign Sign-Off';
      case 'reject':
        return 'Reject Campaign Creative';
    }
  };

  const getButtonText = () => {
    if (isSubmitting) return 'Processing...';
    switch (action) {
      case 'submit':
        return 'Submit for Review';
      case 'request_changes':
        return 'Submit Change Request';
      case 'approve':
        return openCriticalFindings.length > 0 ? 'Sign & Override Critical Findings' : 'Sign & Approve';
      case 'reject':
        return 'Confirm Rejection';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`material-symbols-outlined text-[22px] ${
                  action === 'approve'
                    ? 'text-emerald-700'
                    : action === 'reject'
                    ? 'text-error'
                    : action === 'request_changes'
                    ? 'text-amber-700'
                    : 'text-primary'
                }`}
              >
                {action === 'approve'
                  ? 'verified'
                  : action === 'reject'
                  ? 'cancel'
                  : action === 'request_changes'
                  ? 'assignment_return'
                  : 'send'}
              </span>
              <div>
                <h3 className="font-serif text-lg font-medium text-on-surface">{getTitle()}</h3>
                <span className="font-mono text-xs text-on-surface-variant">
                  Campaign: {campaign.code} • Signed by: {currentUser.username} ({currentUser.role})
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <div className="p-5 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-error-container text-on-error-container text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">error</span>
                <span>{error}</span>
              </div>
            )}

            {/* Self-approval Warning */}
            {action === 'approve' && isSelf && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900">
                  <span className="material-symbols-outlined text-[18px] text-amber-700">warning</span>
                  <span>Co-Approval Policy: Self-Approval Detected</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900/90">
                  You are the creator or designated reviewer of this campaign. Corporate policy requires a separate approver sign-off to ensure objective compliance oversight.
                </p>
                {currentUser.role === 'admin' ? (
                  <label className="flex items-center gap-2 pt-1 font-semibold text-amber-900 text-[11px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowSelfApproval}
                      onChange={(e) => setAllowSelfApproval(e.target.checked)}
                      className="rounded border-amber-600 text-primary"
                    />
                    <span>Administrator Override: Explicitly permit self-approval for this audit</span>
                  </label>
                ) : (
                  <p className="text-[11px] font-semibold text-error">
                    Only an Administrator can permit self-approval. Please assign a peer approver.
                  </p>
                )}
              </div>
            )}

            {/* Critical Findings Override Required */}
            {action === 'approve' && openCriticalFindings.length > 0 && (
              <div className="p-3.5 rounded-xl bg-error-container/40 border border-error/40 text-xs text-on-surface space-y-2">
                <div className="flex items-center gap-2 font-bold text-error">
                  <span className="material-symbols-outlined text-[18px]">gavel</span>
                  <span>
                    Unresolved Critical Compliance Findings ({openCriticalFindings.length})
                  </span>
                </div>
                <ul className="text-[11px] space-y-1 list-disc pl-5 text-on-surface-variant font-mono">
                  {openCriticalFindings.map((f) => (
                    <li key={f.id}>
                      <strong>{f.ruleId}:</strong> {f.matchedText}
                    </li>
                  ))}
                </ul>
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-on-surface uppercase tracking-wider mb-1">
                    Written Override Justification <span className="text-error">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Document legal counsel advice, substantiated claims filing, or approved variance rationale..."
                    className="w-full p-2.5 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <p className="text-[11px] text-on-surface-variant mt-1">
                    This override justification will be permanently stored on the approval record and logged in the event audit history.
                  </p>
                </div>
              </div>
            )}

            {/* General Notes or Requested Changes */}
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                {action === 'request_changes'
                  ? 'Requested Revisions'
                  : action === 'reject'
                  ? 'Rejection Rationale'
                  : 'Review Notes & Comments (Optional)'}
                {(action === 'request_changes' || action === 'reject') && (
                  <span className="text-error"> *</span>
                )}
              </label>
              <textarea
                rows={3}
                required={action === 'request_changes' || action === 'reject'}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  action === 'request_changes'
                    ? 'List specific copy edits, disclaimers, or artwork replacements required from the team...'
                    : action === 'reject'
                    ? 'Explain non-compliance grounds or regulatory violations causing rejection...'
                    : 'Add audit context, review notes, or verification comments...'
                }
                className="w-full p-2.5 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3.5 bg-surface-container-low border-t border-surface-container-high flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-1.5 rounded text-xs font-medium text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                (action === 'approve' && isSelf && currentUser.role !== 'admin' && !allowSelfApproval)
              }
              className={`px-4 py-2 rounded text-xs font-semibold text-white transition-all shadow-sm flex items-center gap-1.5 ${
                action === 'approve'
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : action === 'reject'
                  ? 'bg-rose-700 hover:bg-rose-800'
                  : action === 'request_changes'
                  ? 'bg-amber-700 hover:bg-amber-800'
                  : 'bg-primary hover:bg-primary-container'
              } disabled:opacity-50`}
            >
              {getButtonText()}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

