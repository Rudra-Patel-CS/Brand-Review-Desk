import React from 'react';

interface NavigationProps {
  activeTab: 'review' | 'rules' | 'history' | 'insights';
  onSelectTab: (tab: 'review' | 'rules' | 'history' | 'insights') => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onSelectTab }) => {
  const tabs = [
    { id: 'review', label: 'Review', icon: 'fact_check' },
    { id: 'rules', label: 'Rules', icon: 'policy' },
    { id: 'history', label: 'History', icon: 'history_edu' },
    { id: 'insights', label: 'Insights', icon: 'monitoring' }
  ] as const;

  return (
    <nav className="lg:hidden fixed bottom-0 w-full z-40 bg-surface/90 backdrop-blur-xl border-t border-surface-container-high shadow-[0_-2px_12px_rgba(0,0,0,0.06)] pb-safe">
      <div className="h-16 px-4 flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] transition-colors ${
                isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[22px]">{tab.icon}</span>
              <span className="text-[11px] font-sans mt-0.5 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
