import React from 'react';

interface OcrTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  ocrText: string;
  onUpdateOcrText: (text: string) => void;
}

export const OcrTextModal: React.FC<OcrTextModalProps> = ({ isOpen, onClose, ocrText, onUpdateOcrText }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">text_fields</span>
            <div>
              <h3 className="font-serif text-lg font-medium text-on-surface">Artwork text</h3>
              <span className="text-xs text-on-surface-variant">Enter or correct text that should be checked.</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <textarea
            rows={7}
            value={ocrText}
            onChange={(event) => onUpdateOcrText(event.target.value)}
            placeholder="Type or paste the words shown in the image…"
            className="w-full p-3 rounded-lg bg-surface-container-low border border-surface-container-high font-mono text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest"
          />
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 leading-relaxed">
            This build does not extract text from the image automatically. Save the text you enter here, then run the saved brand rules against it.
          </div>
        </div>
        <div className="px-5 py-3.5 bg-surface-container-low border-t border-surface-container-high flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container">Save artwork text</button>
        </div>
      </div>
    </div>
  );
};
