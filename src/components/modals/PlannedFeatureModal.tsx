import React from 'react';

interface PlannedFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureTitle?: string;
}

export const PlannedFeatureModal: React.FC<PlannedFeatureModalProps> = ({
  isOpen,
  onClose,
  featureTitle = 'Planned Capability (v2.6 Roadmap)'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">science</span>
            <div>
              <h3 className="font-serif text-lg font-medium text-on-surface">Roadmap Feature</h3>
              <span className="px-1.5 py-0.2 rounded bg-secondary-fixed text-on-secondary-fixed font-mono text-[10px] font-bold">
                PLANNED • COMING SOON
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

        <div className="p-5 space-y-3">
          <h4 className="font-serif text-base text-primary font-medium">{featureTitle}</h4>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            This module is planned for an upcoming platform milestone (v2.6). The current system rigorously validates ad caption copy, OCR poster typography, and regulatory compliance rules. Visual aesthetic judgments (such as automated logo clearspace, color palettes, and mobile UI overlap safe-zones) are performed manually by brand counsel.
          </p>

          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high space-y-1.5 text-xs text-on-surface-variant">
            <div className="font-semibold text-on-surface">Planned Milestone Deliverables:</div>
            <ul className="list-disc pl-4 space-y-1 text-[11px]">
              <li>Multi-counsel co-signature workflows and review delegation</li>
              <li>TikTok & Instagram UI overlay safe-zone simulation masks</li>
              <li>Automated agency scorecard matrices and recurring penalty tracking</li>
              <li>Digital asset management (DAM) bidirectional sync</li>
            </ul>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-surface-container-low border-t border-surface-container-high flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
