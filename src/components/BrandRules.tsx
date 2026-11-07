import React, { useRef, useState } from 'react';
import { Brand, APPROVED_CLAIMS } from '../data/mockData.js';
import { BrandRule, filterBrandRules } from '../utils/rulesEngine.js';
import { isPublicDemoMode } from '../utils/publicDemo.js';
import { downloadBlob } from '../utils/download.js';

interface BrandRulesProps {
  brands: Brand[];
  activeBrand: Brand;
  onSelectBrand: (brand: Brand) => void;
  rules: BrandRule[];
  onToggleRule: (ruleId: string) => void;
  onDeleteRule: (ruleId: string) => void;
  onOpenNewRule: (ruleToEdit?: BrandRule) => void;
  onResetRules: () => void;
  onImportRules?: (rules: BrandRule[]) => void;
  onSaveRule?: (rule: BrandRule) => void;
}

export const BrandRules: React.FC<BrandRulesProps> = ({
  brands,
  activeBrand,
  onSelectBrand,
  rules,
  onToggleRule,
  onDeleteRule,
  onOpenNewRule,
  onResetRules,
  onImportRules
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeSeverity, setActiveSeverity] = useState<string>('all');
  const [sampleCopy, setSampleCopy] = useState('Try our 100% detox green juice today! Guaranteed cure.');
  const [claimsExpanded, setClaimsExpanded] = useState(true);
  const [exportToast, setExportToast] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  // Filtered rules
  const filtered = filterBrandRules(rules, {
    brandId: activeBrand.id,
    category: activeCategory,
    severity: activeSeverity,
    search: searchQuery
  });

  const activeCount = rules.filter((r) => r.enabled && (r.brand === activeBrand.id || r.brand === 'global')).length;
  const brandClaims = APPROVED_CLAIMS.filter((c) => c.brandId === activeBrand.id);

  const brandIcon = (brandId: string) => {
    switch (brandId) {
      case 'freshbites': return 'eco';
      case 'arka': return 'restaurant';
      case 'novatech': return 'devices';
      case 'aurora': return 'dermatology';
      case 'verdant': return 'cleaning_services';
      case 'peakform': return 'fitness_center';
      case 'lumina': return 'account_balance';
      case 'terratrail': return 'travel_explore';
      case 'bytebloom': return 'school';
      case 'solstice': return 'local_bar';
      case 'nimbus': return 'cloud';
      case 'petalpine': return 'child_care';
      case 'forgeflame': return 'outdoor_grill';
      default: return 'policy';
    }
  };

  // Live pattern test logic
  const runLiveTest = () => {
    const text = sampleCopy.toLowerCase();
    const matched = rules.filter((r) => {
      if (!r.enabled) return false;
      try {
        const rx = new RegExp(r.pattern, r.flags || 'i');
        return rx.test(text);
      } catch {
        return false;
      }
    });

    return matched;
  };

  const sandboxMatches = runLiveTest();

  // Export JSON
  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `brand-rules-${activeBrand.id}.json`);
    setExportToast(true);
    setTimeout(() => setExportToast(false), 2200);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setImportError(null);
      const parsed = JSON.parse(await file.text()) as unknown;
      const list = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).rules) ? (parsed as any).rules : null);
      if (!list) throw new Error('JSON must be an array of rules or an object with a rules array.');
      const valid = list.filter((r: any) => r && typeof r.id === 'string' && typeof r.pattern === 'string' && typeof r.title === 'string') as BrandRule[];
      if (!valid.length) throw new Error('No valid rules found. Each rule needs id, title, and pattern.');
      onImportRules?.(valid);
      setExportToast(true);
      setTimeout(() => setExportToast(false), 2200);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not import rules.');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 1. Status & Brand Overview Ribbon */}
      <section className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="font-serif text-2xl sm:text-3xl font-medium text-primary tracking-tight">
              Brand Rules Repository
            </h1>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant flex-wrap">
              <span className="font-mono text-secondary font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                {activeCount} Active {activeCount === 1 ? 'Rule' : 'Rules'}
              </span>
              <span>•</span>
              <span>{brandClaims.length} Certified {brandClaims.length === 1 ? 'Claim' : 'Claims'}</span>
              <span>•</span>
              <span className="font-mono text-[11px]">{activeBrand.rulebookVersion}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-on-surface-variant bg-surface-container-low px-2.5 py-1 rounded-lg border border-surface-container-high">
              {isPublicDemoMode ? 'Local demo workspace' : 'Synced to MongoDB'}
            </span>
          </div>
        </div>

        {/* Brand Switcher Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar pt-1 md:flex-wrap md:overflow-visible md:pb-0">
          {brands.map((b) => {
            const isSelected = b.id === activeBrand.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => onSelectBrand(b)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shadow-xs ${
                  isSelected
                    ? 'bg-primary text-on-primary ring-1 ring-primary-container'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container border border-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {brandIcon(b.id)}
                </span>
                {b.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Action Toolbar */}
      <section className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => onOpenNewRule()}
          className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:bg-primary-container active:scale-[0.98] transition-all whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          New Rule
        </button>

        <a
          href="#pattern-sandbox"
          className="px-3.5 py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container-low text-on-surface text-xs font-semibold flex items-center gap-1.5 border border-surface-container-high shadow-xs transition-colors whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[18px] text-secondary">terminal</span>
          Test Copy Sandbox
        </a>

        <button
          type="button"
          onClick={handleExportJson}
          className="px-3.5 py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container-low text-on-surface text-xs font-semibold flex items-center gap-1.5 border border-surface-container-high shadow-xs transition-colors whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">file_download</span>
          {exportToast ? 'Exported JSON!' : 'Export JSON'}
        </button>

        <button
          type="button"
          onClick={() => importRef.current?.click()}
          className="px-3.5 py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container-low text-on-surface text-xs font-semibold flex items-center gap-1.5 border border-surface-container-high shadow-xs transition-colors whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">file_upload</span>
          Import JSON
        </button>
        <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportJson} />

        <button
          type="button"
          onClick={onResetRules}
          title="Restore default rules"
          className="px-3.5 py-2 rounded-xl bg-surface-container-lowest hover:bg-red-50 hover:text-error text-on-surface-variant text-xs font-semibold flex items-center gap-1.5 border border-surface-container-high shadow-xs transition-colors whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[18px]">restart_alt</span>
          {isPublicDemoMode ? 'Reset to Defaults' : 'Reset Demo'}
        </button>
      </section>
      {importError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">{importError}</div>
      )}

      {/* 3. Search & Filters Bar */}
      <section className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-sm space-y-3">
        {/* Search Input */}
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-3.5 text-outline text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            placeholder="Search rules by title, regex pattern, regulatory source, or explanation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 p-1 text-outline hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {/* Filter Categories Ribbon */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: 'all', label: 'All Categories' },
            { id: 'health', label: 'Health & Claims' },
            { id: 'trademark', label: 'Trademark & Logo' },
            { id: 'disclaimers', label: 'Disclaimers' },
            { id: 'pricing', label: 'Pricing & Promo' }
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shadow-xs ${
                activeCategory === cat.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-surface-container-high'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Severity Toggle Pills */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-surface-container-high flex-wrap">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-on-surface-variant">
            Severity Filter:
          </span>
          <div className="flex items-center gap-1.5">
            {[
              { id: 'all', label: 'All', color: 'bg-surface-container' },
              { id: 'critical', label: 'Critical', color: 'bg-error-container text-on-error-container' },
              { id: 'warning', label: 'Warning', color: 'bg-amber-100 text-amber-900' },
              { id: 'advisory', label: 'Advisory', color: 'bg-secondary-container text-on-secondary-container' }
            ].map((sev) => (
              <button
                key={sev.id}
                type="button"
                onClick={() => setActiveSeverity(sev.id)}
                className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-semibold transition-all ${
                  activeSeverity === sev.id
                    ? 'ring-2 ring-primary shadow-xs'
                    : 'opacity-80 hover:opacity-100'
                } ${sev.color}`}
              >
                {sev.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Interactive Rules Cards Deck */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-on-surface-variant px-1">
          <span>Showing {filtered.length} active heuristics</span>
          <span>Click switch to enable or disable in live engine</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((rule) => {
            return (
              <article
                key={rule.id}
                className={`bg-surface-container-lowest p-5 rounded-2xl border transition-all duration-150 shadow-sm flex flex-col justify-between ${
                  rule.enabled ? 'border-surface-container-high' : 'border-surface-container opacity-60 bg-surface-container-low/40'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                          rule.severity === 'critical'
                            ? 'bg-error-container text-on-error-container'
                            : rule.severity === 'warning'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-secondary-container text-on-secondary-container'
                        }`}
                      >
                        [{rule.severity.toUpperCase()}] {rule.id}
                      </span>
                      <span className="text-xs text-on-surface-variant capitalize">
                        {rule.category}
                      </span>
                    </div>

                    {/* Enable / Disable Toggle Switch */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={() => onToggleRule(rule.id)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                    </label>
                  </div>

                  <h3 className="font-serif text-lg font-medium text-on-surface leading-snug">
                    {rule.title}
                  </h3>

                  {/* Regex Pattern Box */}
                  <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high">
                    <div className="flex items-center justify-between text-outline text-[11px] mb-0.5">
                      <span className="font-semibold uppercase tracking-wider">Pattern Trigger</span>
                      <span className="font-mono text-[10px]">Regex /{rule.flags || 'i'}/</span>
                    </div>
                    <code className="font-mono text-xs text-primary font-bold break-all block">
                      /{rule.pattern}/
                    </code>
                  </div>

                  {/* Legal Citation & Explanation */}
                  <div className="space-y-1.5 text-xs text-on-surface-variant">
                    <div className="flex items-start gap-1.5 text-secondary font-mono text-[11px]">
                      <span className="material-symbols-outlined text-[15px] flex-shrink-0 mt-0.5">gavel</span>
                      <span className="leading-snug">{rule.source}</span>
                    </div>
                    <p className="text-xs text-on-surface leading-relaxed">
                      {rule.explanation}
                    </p>
                  </div>

                  {/* Suggested Alternative */}
                  {rule.suggestedRemedy && (
                    <div className="p-2.5 rounded-xl bg-secondary-container/30 border border-secondary-fixed-dim/40 text-xs">
                      <strong className="text-secondary font-semibold block mb-0.5">
                        Pre-Approved Remedy:
                      </strong>
                      <span className="font-serif text-on-surface italic">
                        “{rule.suggestedRemedy}”
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                <div className="mt-4 pt-3 border-t border-surface-container-high flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] text-outline">
                    {rule.appliesTo.join(' + ').toUpperCase()}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenNewRule(rule)}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
                      title="Edit Rule"
                    >
                      <span className="material-symbols-outlined text-[18px]">edit_note</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRule(rule.id)}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-surface-container transition-colors"
                      title="Delete Rule"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete_outline</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* 5. Live Pattern Sandbox Section */}
      <section id="pattern-sandbox" className="bg-surface-container-low p-5 sm:p-6 rounded-2xl border border-surface-container-high shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[22px]">bug_report</span>
            <h2 className="font-serif text-xl font-medium text-primary">Live Pattern Sandbox</h2>
          </div>
          <span className="font-mono text-xs text-secondary bg-surface-container px-2 py-0.5 rounded border border-surface-container-high">
            Heuristic Engine v2.4
          </span>
        </div>

        <p className="text-xs text-on-surface-variant leading-relaxed">
          Evaluate draft creative ad copy or poster slogans in real-time against active regulatory heuristics for <strong className="text-on-surface">{activeBrand.name}</strong>.
        </p>

        <div>
          <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
            Input Sample Ad Copy
          </label>
          <textarea
            rows={2}
            value={sampleCopy}
            onChange={(e) => setSampleCopy(e.target.value)}
            className="w-full p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
          />
        </div>

        {/* Live Feedback Terminal Box */}
        <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high shadow-xs space-y-2">
          {sandboxMatches.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-error font-semibold text-xs">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                <span>Flagged by {sandboxMatches.length} Brand Rule(s)</span>
              </div>
              {sandboxMatches.map((match) => (
                <div key={match.id} className="p-2.5 rounded-lg bg-surface-container-low text-xs space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-bold text-primary">{match.title} ({match.id})</span>
                    <span className="font-mono text-[10px] text-error font-bold uppercase">
                      {match.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant">{match.explanation}</p>
                  {match.suggestedRemedy && (
                    <div className="text-[11px] text-secondary font-medium">
                      ✓ Remedy: “{match.suggestedRemedy}”
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-secondary font-semibold text-xs">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Clean Copy - No Active Regulatory Rules Flagged</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => setSampleCopy('Supercharge your vitality with 100% detox and instant immunity!')}
            className="px-3 py-1.5 rounded-lg bg-surface-container text-xs font-semibold text-on-surface-variant hover:text-on-surface"
          >
            Load Sample Flagged Copy
          </button>
          <button
            type="button"
            onClick={() => setSampleCopy('Refresh your day with daily organic wellness support. Certified organic.')}
            className="px-3 py-1.5 rounded-lg bg-surface-container text-xs font-semibold text-on-surface-variant hover:text-on-surface"
          >
            Load Sample Clean Copy
          </button>
        </div>
      </section>

      {/* 6. Approved Product Claims Accordion */}
      <section className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setClaimsExpanded(!claimsExpanded)}
          className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-surface-container-low transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="material-symbols-outlined text-secondary text-[24px] flex-shrink-0">verified</span>
            <div className="min-w-0 text-left">
              <h3 className="font-serif text-lg font-medium text-on-surface">Approved Product Claims Codex</h3>
              <span className="font-mono text-xs text-outline">
                {brandClaims.length} Certified {brandClaims.length === 1 ? 'Claim' : 'Claims'} on File
              </span>
            </div>
          </div>
          <span
            className={`material-symbols-outlined text-on-surface-variant transition-transform duration-200 flex-shrink-0 ${
              claimsExpanded ? 'rotate-180' : ''
            }`}
          >
            expand_more
          </span>
        </button>

        {claimsExpanded && (
          <div className="px-5 pb-5 pt-1 space-y-2.5 border-t border-surface-container-high">
            {brandClaims.map((claim) => (
              <div
                key={claim.id}
                className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-wrap items-start justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 font-bold text-on-surface">
                    <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                    <span>{claim.title}</span>
                  </div>
                  <p className="font-mono text-[11px] text-outline">{claim.details}</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-surface-container-high text-secondary font-mono text-[11px] font-semibold whitespace-nowrap">
                  {claim.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
