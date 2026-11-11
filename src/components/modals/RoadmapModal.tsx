import React from 'react';

interface RoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DELIVERED = [
  'Evidence library with expiry tracking and human-review flags for missing/expired substantiation',
  'Visual checks: WCAG contrast, reference-logo match, clear space, and text visibility from real pixels',
  'Express/MongoDB persistence with JSON backup and restore routes',
  'Deterministic rules engine with genuine browser OCR (Tesseract.js)'
];

const NEXT = [
  'Multi-counsel co-signature workflows and review delegation',
  'Per-brand reference logo registry with automatic artwork comparison on upload',
  'Agency scorecards with recurring-mistake analytics feeding rule-clarity reports',
  'Digital asset management (DAM) bidirectional sync'
];

/**
 * Product roadmap: what the platform does today and what is planned next.
 * Replaces the earlier placeholder "planned feature" dialog.
 */
export const RoadmapModal: React.FC<RoadmapModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">map</span>
            <h3 className="font-serif text-lg font-medium text-on-surface">Product Roadmap</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-secondary uppercase tracking-wider">Delivered in this build</span>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-on-surface-variant leading-relaxed">
              {DELIVERED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Planned next</span>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-on-surface-variant leading-relaxed">
              {NEXT.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-surface-container-low border-t border-surface-container-high flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
