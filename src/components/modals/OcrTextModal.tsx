import React from 'react';

interface OcrTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  ocrText: string;
  confidence: number;
  onUpdateOcrText: (text: string) => void;
}

export const OcrTextModal: React.FC<OcrTextModalProps> = ({
  isOpen,
  onClose,
  ocrText,
  confidence,
  onUpdateOcrText
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">text_fields</span>
            <div>
              <h3 className="font-serif text-lg font-medium text-on-surface">Extracted Artwork OCR</h3>
              <span className="font-mono text-xs text-secondary font-semibold">
                Tesseract v5.3 • {confidence}% Confidence
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

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
              Detected Poster Text
            </label>
            <textarea
              rows={6}
              value={ocrText}
              onChange={(e) => onUpdateOcrText(e.target.value)}
              className="w-full p-3 rounded-lg bg-surface-container-low border border-surface-container-high font-mono text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest"
            />
            <p className="text-[11px] text-on-surface-variant mt-1">
              You can adjust detected text tokens manually if reflection, curvature, or low contrast impacted the OCR extraction.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high space-y-1.5">
            <span className="text-xs font-semibold text-primary block">OCR Verification Notes:</span>
            <div className="text-xs text-on-surface-variant space-y-1">
              <div className="flex items-center justify-between">
                <span>Bounding Box Mapping:</span>
                <span className="font-mono text-secondary">Active • 2 Regions Pinpointed</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Lexical Language Model:</span>
                <span className="font-mono">EN-US Commercial Food & Drug</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-3.5 bg-surface-container-low border-t border-surface-container-high flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm"
          >
            Done & Apply
          </button>
        </div>
      </div>
    </div>
  );
};
