import React, { useState, useEffect } from 'react';
import { CampaignPreset, WorkflowEvent } from '../../utils/rulesEngine.js';

interface EventHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: CampaignPreset;
  onAddComment?: (comment: string) => Promise<void>;
}

export const EventHistoryModal: React.FC<EventHistoryModalProps> = ({
  isOpen,
  onClose,
  campaign,
  onAddComment
}) => {
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (!isOpen || !campaign.id) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/workspace/campaigns/${encodeURIComponent(campaign.id)}/events`, {
      credentials: 'include'
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setEvents(Array.isArray(data) ? data : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Could not load event history.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, campaign.id]);

  if (!isOpen) return null;

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !onAddComment) return;

    setSubmittingComment(true);
    try {
      await onAddComment(newComment.trim());
      setNewComment('');
      // Reload events
      const res = await fetch(`/api/workspace/campaigns/${encodeURIComponent(campaign.id)}/events`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setEvents(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error posting comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleExportJson = () => {
    window.open(`/api/workspace/campaigns/${encodeURIComponent(campaign.id)}/export`, '_blank');
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'campaign_created':
        return { label: 'Created', color: 'bg-surface-container-high text-on-surface' };
      case 'campaign_submitted':
        return { label: 'Submitted for Review', color: 'bg-blue-100 text-blue-900' };
      case 'changes_requested':
        return { label: 'Changes Requested', color: 'bg-amber-100 text-amber-900' };
      case 'approved':
        return { label: 'Approved', color: 'bg-emerald-100 text-emerald-900' };
      case 'rejected':
        return { label: 'Rejected', color: 'bg-rose-100 text-rose-900' };
      case 'critical_override':
        return { label: 'Critical Finding Override', color: 'bg-purple-100 text-purple-900' };
      case 'comment_added':
        return { label: 'Comment', color: 'bg-stone-100 text-stone-800' };
      default:
        return { label: action.replace(/_/g, ' '), color: 'bg-surface-container text-on-surface-variant' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">history</span>
            <div>
              <h3 className="font-serif text-lg font-medium text-on-surface">
                Event History & Audit Log
              </h3>
              <span className="font-mono text-xs text-on-surface-variant">
                {campaign.code} • {campaign.title}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-colors shadow-xs"
              title="Download structured review audit packet in JSON"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export Audit JSON</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        </div>

        {/* Timeline Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-error-container text-on-error-container text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined animate-spin text-[24px] text-primary">sync</span>
              <span>Loading chronological event history…</span>
            </div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center text-xs text-on-surface-variant space-y-1">
              <span className="material-symbols-outlined text-[32px] text-outline/50 block mx-auto">
                event_busy
              </span>
              <p className="font-semibold text-on-surface">No workflow events recorded yet</p>
              <p>State transitions, reviewer comments, and sign-offs will appear here chronologically.</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container-highest">
              {events.map((evt, idx) => {
                const badge = getActionBadge(evt.actionType);
                const dateStr = new Date(evt.timestamp).toLocaleString();

                return (
                  <div key={evt.id || idx} className="relative group">
                    {/* Circle marker */}
                    <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-surface-container-lowest border-2 border-primary ring-4 ring-surface" />

                    <div className="bg-surface-container-low p-3.5 rounded-xl border border-surface-container-high space-y-2 shadow-xs">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badge.color}`}>
                            {badge.label}
                          </span>
                          <span className="text-xs font-semibold text-on-surface">
                            {evt.user?.username || 'System'}{' '}
                            <span className="text-[11px] font-mono text-on-surface-variant font-normal">
                              ({evt.user?.role || 'reviewer'})
                            </span>
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-on-surface-variant">
                          {dateStr}
                        </span>
                      </div>

                      {/* Transition info */}
                      {evt.fromStatus && evt.toStatus && (
                        <div className="text-xs font-mono text-on-surface-variant flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-surface-container">
                            {evt.fromStatus}
                          </span>
                          <span>→</span>
                          <span className="px-1.5 py-0.5 rounded bg-surface-container font-semibold text-on-surface">
                            {evt.toStatus}
                          </span>
                        </div>
                      )}

                      {/* Specific Details */}
                      {evt.details?.criticalOverrideReason && (
                        <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs text-purple-950 space-y-1">
                          <div className="flex items-center gap-1 font-bold text-purple-900">
                            <span className="material-symbols-outlined text-[15px]">gavel</span>
                            <span>Documented Critical Override Reason:</span>
                          </div>
                          <p className="font-mono text-[11px]">{evt.details.criticalOverrideReason}</p>
                        </div>
                      )}

                      {evt.details?.requestedChanges && (
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-950 space-y-1">
                          <span className="font-bold text-amber-900 block">Requested Editorial Changes:</span>
                          <p className="text-[11px] leading-relaxed">{evt.details.requestedChanges}</p>
                        </div>
                      )}

                      {evt.details?.rejectionReason && (
                        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-950 space-y-1">
                          <span className="font-bold text-rose-900 block">Rejection Rationale:</span>
                          <p className="text-[11px] leading-relaxed">{evt.details.rejectionReason}</p>
                        </div>
                      )}

                      {evt.details?.notes && !evt.details?.requestedChanges && (
                        <p className="text-xs text-on-surface-variant leading-relaxed">
                          {evt.details.notes}
                        </p>
                      )}

                      {evt.details?.comment && (
                        <p className="text-xs text-on-surface bg-surface-container-lowest p-2 rounded border border-surface-container font-sans leading-relaxed">
                          “{evt.details.comment}”
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Reviewer Comment Form */}
          {onAddComment && (
            <form onSubmit={handlePostComment} className="pt-4 border-t border-surface-container-high space-y-2">
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Add Reviewer / Approver Comment
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Record observation, compliance query, or verification note..."
                  className="flex-1 px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !newComment.trim()}
                  className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors disabled:opacity-50 shrink-0"
                >
                  {submittingComment ? 'Posting…' : 'Post Note'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
