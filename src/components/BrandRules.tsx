import React, { useMemo, useState } from 'react';
import { Brand } from '../data/mockData.js';
import { BrandRule, filterBrandRules } from '../utils/rulesEngine.js';

interface BrandRulesProps {
  brands: Brand[];
  activeBrand: Brand;
  onSelectBrand: (brand: Brand) => void;
  rules: BrandRule[];
  onToggleRule: (ruleId: string) => void;
  onDeleteRule: (ruleId: string) => void;
  onOpenNewRule: (ruleToEdit?: BrandRule) => void;
  databaseConnected: boolean;
}

export const BrandRules: React.FC<BrandRulesProps> = ({
  brands,
  activeBrand,
  onSelectBrand,
  rules,
  onToggleRule,
  onDeleteRule,
  onOpenNewRule,
  databaseConnected
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSeverity, setActiveSeverity] = useState('all');
  const [copyToCheck, setCopyToCheck] = useState('');
  const [exported, setExported] = useState(false);
  const filtered = filterBrandRules(rules, {
    brandId: activeBrand.id,
    category: activeCategory,
    severity: activeSeverity,
    search: searchQuery
  });
  const activeCount = rules.filter((rule) => rule.enabled && (rule.brand === activeBrand.id || rule.brand === 'global')).length;
  const matches = useMemo(() => rules
    .filter((rule) => rule.enabled && (rule.brand === activeBrand.id || rule.brand === 'global'))
    .flatMap((rule) => {
      try {
        const match = new RegExp(rule.pattern, rule.flags || 'i').exec(copyToCheck);
        return match ? [{ rule, text: match[0] }] : [];
      } catch {
        return [];
      }
    }), [rules, activeBrand.id, copyToCheck]);

  const exportRules = () => {
    const data = rules.filter((rule) => rule.brand === activeBrand.id || rule.brand === 'global');
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `brand-rules-${activeBrand.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setExported(true);
    window.setTimeout(() => setExported(false), 1800);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <section className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-medium text-primary tracking-tight">Brand rules</h1>
            <p className="text-xs text-on-surface-variant mt-1">Rules shown here are loaded from MongoDB. Check their source and wording before relying on them.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-secondary bg-surface-container-low px-2.5 py-1 rounded-lg border border-surface-container-high">{activeCount} active rules</span>
            <span className={`font-mono text-[11px] px-2.5 py-1 rounded-lg border ${databaseConnected ? 'text-secondary border-surface-container-high bg-surface-container-low' : 'text-amber-900 border-amber-200 bg-amber-50'}`}>
              {databaseConnected ? 'Live database' : 'Connection lost'}
            </span>
            {activeBrand.isDemo && <span className="font-mono text-[11px] px-2.5 py-1 rounded-lg border border-amber-200 text-amber-900 bg-amber-50">Sample brand data</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {brands.map((brand) => (
            <button key={brand.id} type="button" onClick={() => onSelectBrand(brand)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${brand.id === activeBrand.id ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant border border-surface-container-high'}`}>
              {brand.name}{brand.isDemo ? ' · sample' : ''}
            </button>
          ))}
        </div>
      </section>

      <section className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button type="button" onClick={() => onOpenNewRule()} className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">add_circle</span>New rule
        </button>
        <button type="button" onClick={exportRules} className="px-3.5 py-2 rounded-xl bg-surface-container-lowest text-on-surface text-xs font-semibold flex items-center gap-1.5 border border-surface-container-high">
          <span className="material-symbols-outlined text-[18px]">file_download</span>{exported ? 'Exported' : 'Export rules'}
        </button>
      </section>

      <section className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3">
        <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search ID, title, text, source…" className="md:col-span-1 px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
        <select value={activeCategory} onChange={(event) => setActiveCategory(event.target.value)} className="px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs">
          <option value="all">All categories</option>
          <option value="health">Health</option><option value="trademark">Trademark</option><option value="disclaimers">Disclaimers</option><option value="pricing">Pricing</option><option value="general">General</option>
        </select>
        <select value={activeSeverity} onChange={(event) => setActiveSeverity(event.target.value)} className="px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs">
          <option value="all">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="advisory">Advisory</option>
        </select>
      </section>

      <section className="space-y-3">
        {filtered.length ? filtered.map((rule) => (
          <article key={`${rule.brand}-${rule.id}`} className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container-high shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">{rule.id}</span>
                  <span className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded ${rule.severity === 'critical' ? 'bg-error-container text-on-error-container' : rule.severity === 'warning' ? 'bg-amber-100 text-amber-900' : 'bg-secondary-container text-on-secondary-container'}`}>{rule.severity}</span>
                  {rule.isDemo && <span className="text-[10px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">Sample rule</span>}
                </div>
                <h2 className="font-serif text-lg font-medium text-on-surface">{rule.title}</h2>
                <p className="text-xs text-on-surface-variant leading-relaxed">{rule.explanation || 'No explanation is stored for this rule.'}</p>
                <p className="text-[11px] text-secondary break-words"><strong>Source stored in database:</strong> {rule.source || 'Not provided'}</p>
                <div className="text-[11px] text-on-surface-variant font-mono break-all"><strong>Match pattern:</strong> {rule.pattern}</div>
                {rule.suggestedRemedy && <p className="text-xs text-on-surface-variant"><strong>Suggested correction in database:</strong> {rule.suggestedRemedy}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => onOpenNewRule(rule)} className="px-3 py-1.5 rounded-lg bg-surface-container-low text-xs font-semibold border border-surface-container-high">Edit</button>
                <button type="button" onClick={() => onToggleRule(rule.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${rule.enabled ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'}`}>{rule.enabled ? 'Enabled' : 'Disabled'}</button>
                <button type="button" onClick={() => onDeleteRule(rule.id)} aria-label={`Delete ${rule.id}`} className="px-2.5 py-1.5 rounded-lg text-error bg-error-container/60 text-xs font-semibold">Delete</button>
              </div>
            </div>
          </article>
        )) : (
          <div className="bg-surface-container-lowest p-8 rounded-2xl border border-dashed border-surface-container-high text-center text-sm text-on-surface-variant">No saved rules match these filters.</div>
        )}
      </section>

      <section id="pattern-sandbox" className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-sm space-y-3">
        <div>
          <h2 className="font-serif text-xl font-medium text-primary">Try the saved rules on copy</h2>
          <p className="text-xs text-on-surface-variant">Enter text to see which enabled MongoDB rules match. This does not change or certify the copy.</p>
        </div>
        <textarea rows={3} value={copyToCheck} onChange={(event) => setCopyToCheck(event.target.value)} placeholder="Paste caption or artwork text…" className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
        {copyToCheck && (matches.length ? <ul className="space-y-2">{matches.map(({ rule, text }) => <li key={rule.id} className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950"><strong>{rule.title}</strong> matched “{text}”. <span className="font-mono">{rule.id}</span></li>)}</ul> : <p className="text-xs text-secondary">No enabled saved rule matched this text.</p>)}
      </section>
    </div>
  );
};
