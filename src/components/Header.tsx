import React from 'react';
import { Brand } from '../data/mockData.js';

interface HeaderProps {
  brands: Brand[];
  activeBrand?: Brand;
  onSelectBrand: (brand: Brand) => void;
  activeTab: 'review' | 'rules' | 'history' | 'insights';
  onSelectTab: (tab: 'review' | 'rules' | 'history' | 'insights') => void;
  databaseConnected: boolean;
  onOpenDbStatus: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  brands,
  activeBrand,
  onSelectBrand,
  activeTab,
  onSelectTab,
  databaseConnected,
  onOpenDbStatus
}) => {
  const screenTitles = {
    review: 'Review Content',
    rules: 'Brand Rules',
    history: 'Review History',
    insights: 'Insights'
  };
  const tabs: Array<{ id: HeaderProps['activeTab']; label: string; icon: string }> = [
    { id: 'review', label: 'Review', icon: 'fact_check' },
    { id: 'rules', label: 'Rules', icon: 'policy' },
    { id: 'history', label: 'History', icon: 'history_edu' },
    { id: 'insights', label: 'Insights', icon: 'monitoring' }
  ];

  return (
    <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high shadow-[0_1px_8px_rgba(0,0,0,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-20 flex items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-sm border border-primary-container">
            <span className="material-symbols-outlined text-on-primary text-[22px]">policy</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-serif text-xl sm:text-2xl text-primary font-medium tracking-tight truncate leading-tight">Brand Review Desk</span>
              <span className="text-on-surface-variant/40 hidden sm:inline">•</span>
              <span className="font-sans text-sm font-semibold text-on-surface hidden sm:inline truncate">{screenTitles[activeTab]}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {brands.length > 0 && activeBrand && (
                <div className="relative flex items-center">
                  <select
                    aria-label="Active Brand"
                    value={activeBrand.id}
                    onChange={(event) => {
                      const brand = brands.find((item) => item.id === event.target.value);
                      if (brand) onSelectBrand(brand);
                    }}
                    className="appearance-none bg-surface-container-low pl-2.5 pr-7 py-0.5 rounded text-on-surface font-sans text-xs font-semibold hover:bg-surface-container focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer border border-surface-container-high"
                  >
                    {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}{brand.isDemo ? ' · sample' : ''}</option>)}
                  </select>
                  <span className="material-symbols-outlined absolute right-1.5 pointer-events-none text-on-surface-variant text-[14px]">expand_more</span>
                </div>
              )}
              <button
                type="button"
                onClick={onOpenDbStatus}
                title="View live database connection and record counts"
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[11px] border ${databaseConnected ? 'bg-secondary-container/40 text-secondary border-surface-container-high' : 'bg-amber-50 text-amber-900 border-amber-200'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${databaseConnected ? 'bg-secondary' : 'bg-amber-600'}`} />
                {databaseConnected ? 'MongoDB live' : 'Database unavailable'}
              </button>
              {activeBrand?.isDemo && <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-semibold">Sample data</span>}
            </div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 bg-surface-container-low p-1 rounded-lg border border-surface-container-high">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${activeTab === tab.id ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'}`}
            >
              <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>{tab.label}
            </button>
          ))}
        </nav>
        <button type="button" onClick={onOpenDbStatus} aria-label="Database status" className="w-9 h-9 rounded-full bg-surface-container-low text-primary flex items-center justify-center border border-surface-container-high md:hidden">
          <span className="material-symbols-outlined text-[18px]">database</span>
        </button>
      </div>
    </header>
  );
};
