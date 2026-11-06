import React, { useState } from 'react';
import { Brand } from '../data/mockData.js';

interface HeaderProps {
  brands: Brand[];
  activeBrand: Brand;
  onSelectBrand: (brand: Brand) => void;
  activeTab: 'review' | 'rules' | 'history' | 'insights';
  onSelectTab: (tab: 'review' | 'rules' | 'history' | 'insights') => void;
  isOfflineMode: boolean;
  onToggleOffline: () => void;
  onOpenDbStatus: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  brands,
  activeBrand,
  onSelectBrand,
  activeTab,
  onSelectTab,
  isOfflineMode,
  onOpenDbStatus
}) => {
  const [profileOpen, setProfileOpen] = useState(false);

  const getScreenTitle = () => {
    switch (activeTab) {
      case 'review':
        return 'Review Content';
      case 'rules':
        return 'Brand Rules';
      case 'history':
        return 'Review History';
      case 'insights':
        return 'Insights Analytics';
    }
  };

  return (
    <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high shadow-[0_1px_8px_rgba(0,0,0,0.03)] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
        {/* Left: Brand Desk Identity & Context */}
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Logo Monogram */}
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-sm border border-primary-container">
            <span className="material-symbols-outlined text-on-primary text-[22px]">policy</span>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-serif text-xl sm:text-2xl text-primary font-medium tracking-tight truncate leading-tight">
                Brand Review Desk
              </span>
              <span className="text-on-surface-variant/40 hidden sm:inline">•</span>
              <span className="font-sans text-sm font-semibold text-on-surface hidden sm:inline truncate">
                {getScreenTitle()}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {/* Brand Selector Dropdown */}
              <div className="relative flex items-center">
                <select
                  aria-label="Active Brand Context"
                  value={activeBrand.id}
                  onChange={(e) => {
                    const found = brands.find((b) => b.id === e.target.value);
                    if (found) onSelectBrand(found);
                  }}
                  className="appearance-none bg-surface-container-low pl-2.5 pr-7 py-0.5 rounded text-on-surface font-sans text-xs font-semibold hover:bg-surface-container focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer border border-surface-container-high transition-colors"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-1.5 pointer-events-none text-on-surface-variant text-[14px]">
                  expand_more
                </span>
              </div>

              {/* DB Status Badge with Clickable Dialog */}
              <button
                type="button"
                onClick={onOpenDbStatus}
                title="Click to view database connection status and offline/online controls"
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] border transition-all ${
                  isOfflineMode
                    ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                    : 'bg-surface-container-low text-secondary border-surface-container-high hover:bg-surface-container'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOfflineMode ? 'bg-amber-600 animate-pulse' : 'bg-secondary animate-pulse'
                  }`}
                />
                <span>
                  {isOfflineMode ? 'Offline • Local Fallback' : 'Connected • MongoDB Atlas'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Center: Desktop Navigation Bar */}
        <nav className="hidden md:flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-surface-container-high">
          <button
            type="button"
            onClick={() => onSelectTab('review')}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'review'
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">fact_check</span>
            Review
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('rules')}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'rules'
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">policy</span>
            Rules
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('history')}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'history'
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">history_edu</span>
            History
          </button>
          <button
            type="button"
            onClick={() => onSelectTab('insights')}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'insights'
                ? 'bg-surface-container-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">monitoring</span>
            Insights
          </button>
        </nav>

        {/* Right: Counsel Profile Menu */}
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            aria-label="Senior Brand Counsel Profile"
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-container-low transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[18px]">gavel</span>
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-on-surface leading-tight">Elena Rostova, JD</span>
              <span className="text-[10px] text-on-surface-variant">Senior Brand Counsel</span>
            </div>
            <span className="material-symbols-outlined text-[16px] text-on-surface-variant hidden lg:inline">
              expand_more
            </span>
          </button>

          {profileOpen && (
            <div className="absolute right-0 top-12 w-64 bg-surface-container-lowest rounded-xl shadow-xl border border-surface-container-high p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-surface-container-high">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary">
                  <span className="material-symbols-outlined text-[20px]">person</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-on-surface truncate">Elena Rostova, JD</span>
                  <span className="text-[11px] text-on-surface-variant truncate">Global Compliance Desk</span>
                </div>
              </div>
              <div className="py-2 text-xs space-y-1.5 text-on-surface-variant">
                <div className="flex justify-between">
                  <span>Signoff Authority:</span>
                  <span className="font-semibold text-secondary">Level 3 (Final)</span>
                </div>
                <div className="flex justify-between">
                  <span>Cryptographic Seal:</span>
                  <span className="font-mono text-[10px] text-primary">#E8F-21-SECURE</span>
                </div>
              </div>
              <div className="pt-2 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => {
                    onOpenDbStatus();
                    setProfileOpen(false);
                  }}
                  className="w-full text-left text-xs text-primary hover:underline font-semibold py-1"
                >
                  Configure Storage & Offline Mode
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
