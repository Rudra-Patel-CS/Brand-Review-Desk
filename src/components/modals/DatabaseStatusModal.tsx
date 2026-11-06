import React from 'react';

interface DatabaseStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOfflineMode: boolean;
  onToggleOffline: () => void;
}

export const DatabaseStatusModal: React.FC<DatabaseStatusModalProps> = ({
  isOpen,
  onClose,
  isOfflineMode,
  onToggleOffline
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">database</span>
            <div>
              <h3 className="font-serif text-lg font-medium text-on-surface">Data Store &amp; Storage Engine</h3>
              <span className="text-xs text-on-surface-variant font-mono">Vault: Brand_Review_Desk • v2.0</span>
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
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${
              isOfflineMode
                ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                : 'bg-secondary-container/30 border-secondary-fixed-dim text-on-surface'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5 ${
                isOfflineMode ? 'text-amber-700' : 'text-secondary'
              }`}
            >
              {isOfflineMode ? 'wifi_off' : 'cloud_sync'}
            </span>
            <div className="text-xs space-y-0.5">
              <span className="font-bold block">
                {isOfflineMode ? 'Offline Resilient Mode Enabled' : 'Cloud Database Online & Synchronized'}
              </span>
              <p className="text-[11px] opacity-90 leading-relaxed">
                {isOfflineMode
                  ? 'App is operating autonomously from local cache storage. OCR models and brand rules run in-browser without remote network dependency.'
                  : 'Live audit records, rule edits, and campaign snapshots are synchronized to the compliance database.'}
              </p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-on-surface-variant">Primary Database:</span>
              <span className="font-mono font-medium text-on-surface">Cloud Enterprise Database (Connected)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-on-surface-variant">Database Vault:</span>
              <span className="font-mono text-secondary font-semibold">Brand_Review_Desk</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-on-surface-variant">Active Collections:</span>
              <span className="font-mono text-on-surface">rules, campaigns, reviews, brands</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-on-surface-variant">OCR Engine Engine:</span>
              <span className="font-mono text-on-surface">Tesseract Client WASM Offline Bundle</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-on-surface-variant">Roundtrip Latency:</span>
              <span className="font-mono text-secondary">
                {isOfflineMode ? '0 ms (Local cache)' : '18 ms (Low-latency cluster)'}
              </span>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={onToggleOffline}
              className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm ${
                isOfflineMode
                  ? 'bg-secondary text-on-secondary hover:bg-secondary-fixed'
                  : 'bg-surface-container-highest hover:bg-surface-container text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {isOfflineMode ? 'cloud_upload' : 'cloud_off'}
              </span>
              {isOfflineMode ? 'Reconnect to Cloud Database' : 'Simulate Offline Air-Gapped Mode'}
            </button>
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
