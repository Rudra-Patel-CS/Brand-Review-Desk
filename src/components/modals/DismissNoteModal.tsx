import React, { useState } from 'react';
import { ComplianceFinding } from '../../utils/rulesEngine.js';

interface DismissNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  finding: ComplianceFinding | null;
  onConfirmDismiss: (findingId: string, note: string) => void;
}

export const DismissNoteModal: React.FC<DismissNoteModalProps> = ({
  isOpen,
  onClose,
  finding,
  onConfirmDismiss
}) => {
  const [note, setNote] = useState('Reviewed by counsel. Exemption granted under documented brand indemnity.');

  if (!isOpen || !finding) return null;

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-outline text-[20px]">notes</span>
            <div>
              <h3 className="font-serif text-base font-medium text-on-surface">Dismiss Finding with Note</h3>
              <span className="text-xs text-on-surface-variant font-mono">{finding.ruleId}</span>
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
          <p className="text-xs text-on-surface-variant">
            Document legal justification or business exception for bypassing{' '}
            <span className="font-semibold text-on-surface">{finding.ruleTitle}</span>.
          </p>

          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Specify reason for waiver or contextual exception..."
            className="w-full p-2.5 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="px-5 py-3.5 bg-surface-container-low border-t border-surface-container-high flex items-center justify-end gap-2">
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
              onConfirmDismiss(finding.id, note);
              onClose();
            }}
            className="px-4 py-2 rounded bg-surface-container-highest hover:bg-surface-container-high text-on-surface text-xs font-semibold shadow-sm"
          >
            Record Note & Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
