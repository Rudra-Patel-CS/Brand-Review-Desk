import React from 'react';

interface DatabaseStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  connected: boolean;
  database: string;
  error: string | null;
  lastUpdated: string | null;
  counts: { brands: number; rules: number; campaigns: number; reviews: number };
  onRetry: () => void;
}

export const DatabaseStatusModal: React.FC<DatabaseStatusModalProps> = ({
  isOpen,
  onClose,
  connected,
  database,
  error,
  lastUpdated,
  counts,
  onRetry
}) => {
  if (!isOpen) return null;
  const rows = [
    ['Brands', counts.brands],
    ['Rules', counts.rules],
    ['Campaigns and references', counts.campaigns],
    ['Reviews', counts.reviews]
  ] as const;

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">database</span>
            <div>
              <h3 className="font-serif text-lg font-medium text-on-surface">Database connection</h3>
              <span className="text-xs text-on-surface-variant font-mono">{database}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${connected ? 'bg-secondary-container/30 border-secondary-fixed-dim text-on-surface' : 'bg-amber-50 border-amber-200 text-amber-950'}`}>
            <span className={`material-symbols-outlined text-[20px] ${connected ? 'text-secondary' : 'text-amber-700'}`}>{connected ? 'cloud_done' : 'cloud_off'}</span>
            <div className="text-xs space-y-0.5">
              <span className="font-bold block">{connected ? 'Connected to MongoDB' : 'Not connected'}</span>
              <p className="text-[11px] leading-relaxed">{connected ? 'The visible workspace records come from the database. The app checks for changes every 10 seconds.' : error || 'The database could not be reached.'}</p>
            </div>
          </div>
          <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high space-y-2 text-xs">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-on-surface-variant">{label}</span>
                <span className="font-mono font-semibold text-on-surface">{value}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-surface-container-high">
              <span className="text-on-surface-variant">Last successful refresh</span>
              <span className="font-mono text-on-surface">{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never'}</span>
            </div>
          </div>
          {!connected && <button type="button" onClick={onRetry} className="w-full py-2.5 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container">Retry database connection</button>}
        </div>
        <div className="px-5 py-3.5 bg-surface-container-low border-t border-surface-container-high flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-1.5 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container">Close</button>
        </div>
      </div>
    </div>
  );
};
