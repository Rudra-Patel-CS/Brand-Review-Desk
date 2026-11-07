import React, { useState, useEffect } from 'react';

interface OcrTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  extractedText: string;
  correctedText?: string;
  confidence: number;
  linesCount?: number;
  wordsCount?: number;
  onSaveCorrections: (correctedText: string) => void;
}

export const OcrTextModal: React.FC<OcrTextModalProps> = ({
  isOpen,
  onClose,
  extractedText,
  correctedText,
  confidence,
  linesCount,
  wordsCount,
  onSaveCorrections
}) => {
  const [editText, setEditText] = useState(correctedText || extractedText || '');
  const [showOriginal, setShowOriginal] = useState(false);

  useEffect(() => {
    setEditText(correctedText || extractedText || '');
  }, [extractedText, correctedText, isOpen]);

  if (!isOpen) return null;

  const isModified = editText.trim() !== (extractedText || '').trim();
  const currentWordsCount = editText.trim().length > 0 ? editText.trim().split(/\s+/).length : 0;

  const handleApply = () => {
    onSaveCorrections(editText.trim());
    onClose();
  };

  const handleResetToExtracted = () => {
    setEditText(extractedText || '');
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-xl rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">text_fields</span>
            <div>
              <h3 className="font-serif text-lg font-medium text-on-surface">Artwork OCR Text Review</h3>
              <div className="flex items-center gap-2 text-xs font-mono">
                {confidence > 0 ? (
                  <span className="text-secondary font-semibold">
                    Engine Confidence: {confidence}%
                  </span>
                ) : (
                  <span className="text-on-surface-variant font-medium">
                    No confidence score recorded
                  </span>
                )}
                {typeof linesCount === 'number' && linesCount > 0 && (
                  <span className="text-on-surface-variant">
                    • {linesCount} line{linesCount === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Transparency Advisory Notice */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined text-[16px] text-amber-700">gavel</span>
              <span>OCR Transparency & Verification Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed text-on-surface-variant">
              Optical Character Recognition may miss or misread text due to font styling, contrast, or artwork curvature. Extracted text must be reviewed by a human and is not an automated compliance certification. You can manually inspect and correct extracted text below before brand rules are audited.
            </p>
          </div>

          {/* Editable Artwork Text */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Artwork Copy {isModified && <span className="text-primary font-bold">(Manually Corrected)</span>}
              </label>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="font-mono text-on-surface-variant">
                  {currentWordsCount} words · {editText.length} chars
                </span>
                {isModified && (
                  <button
                    type="button"
                    onClick={handleResetToExtracted}
                    className="text-secondary hover:text-primary underline font-medium"
                  >
                    Reset to Extracted
                  </button>
                )}
              </div>
            </div>
            <textarea
              rows={5}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="No text detected in this artwork asset. Enter or correct artwork copy here..."
              className="w-full p-3 rounded-lg bg-surface-container-low border border-surface-container-high font-mono text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest leading-relaxed"
            />
          </div>

          {/* Collapsible Original Extracted Text */}
          <div className="border border-surface-container-high rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowOriginal(!showOriginal)}
              className="w-full px-4 py-2.5 bg-surface-container-low hover:bg-surface-container flex items-center justify-between text-xs text-on-surface-variant transition-colors"
            >
              <span className="font-medium flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">history_edu</span>
                Original Raw OCR Output
              </span>
              <span className="material-symbols-outlined text-[16px] transition-transform">
                {showOriginal ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {showOriginal && (
              <div className="p-3 bg-surface-container-lowest border-t border-surface-container-high font-mono text-xs text-on-surface-variant whitespace-pre-wrap max-h-36 overflow-y-auto">
                {extractedText ? extractedText : 'No text was extracted by the OCR engine for this image.'}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-surface-container-low border-t border-surface-container-high flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            Save Corrections & Re-audit
          </button>
        </div>
      </div>
    </div>
  );
};
