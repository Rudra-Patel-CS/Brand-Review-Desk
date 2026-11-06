import React, { useState } from 'react';
import { Brand } from '../data/mockData.js';

interface InsightsAnalyticsProps {
  activeBrand: Brand;
  onOpenPlannedModal: (title: string) => void;
}

export const InsightsAnalytics: React.FC<InsightsAnalyticsProps> = ({
  activeBrand,
  onOpenPlannedModal
}) => {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | 'q3' | 'ytd'>('30d');
  const [advisoryDismissed, setAdvisoryDismissed] = useState(false);
  const [exportState, setExportState] = useState<'idle' | 'compiling' | 'saved'>('idle');

  // Multiplier adjustments for timeframe
  const multiplier = timeframe === '7d' ? 0.25 : timeframe === 'q3' ? 2.8 : timeframe === 'ytd' ? 4.5 : 1;
  const auditedAssets = Math.round(148 * multiplier);
  const risksIntercepted = Math.round(42 * multiplier);
  const firstPassRate = timeframe === '7d' ? 82.1 : timeframe === 'q3' ? 76.5 : 78.4;
  const triageLag = timeframe === '7d' ? 11 : 14;

  const handleExport = () => {
    setExportState('compiling');
    setTimeout(() => {
      setExportState('saved');

      const data = {
        title: `Compliance Analytics Audit - ${activeBrand.name}`,
        timeframe,
        scope: `${activeBrand.name} (${activeBrand.rulebookVersion})`,
        generatedAt: new Date().toISOString(),
        metrics: {
          firstPassRate: `${firstPassRate}%`,
          auditedAssets,
          triageLag: `${triageLag} mins`,
          risksIntercepted
        },
        topInfractions: [
          { code: 'FB-012', title: 'Unsubstantiated Health Claims', share: '34%' },
          { code: 'FB-019', title: 'Comparative Superlatives', share: '22%' },
          { code: 'NT-008', title: 'Missing Pricing Disclaimer', share: '18%' },
          { code: 'AF-014', title: 'Allergen Advisory Placement', share: '14%' },
          { code: 'GN-003', title: 'Low Contrast Poster Text', share: '12%' }
        ]
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-analytics-${activeBrand.id}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setTimeout(() => setExportState('idle'), 2500);
    }, 700);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 1. Control & Filter Bar */}
      <section className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="font-serif text-2xl sm:text-3xl font-medium text-primary tracking-tight">
              Compliance Intelligence & Analytics
            </h1>
            <p className="text-xs text-on-surface-variant">
              Systemic policy infraction ledger, dual OCR-copy clearance ratios, and channel risk indices.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Timeframe Toggle */}
            <div className="relative flex items-center bg-surface-container-low rounded-xl px-3 py-1.5 border border-surface-container-high shadow-xs">
              <span className="material-symbols-outlined text-[16px] text-secondary mr-2">
                calendar_today
              </span>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value as any)}
                className="bg-transparent font-sans text-xs font-semibold text-on-surface focus:outline-none appearance-none pr-6 cursor-pointer"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days (Active)</option>
                <option value="q3">Q3 Review Cycle</option>
                <option value="ytd">Year-to-Date</option>
              </select>
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant absolute right-2 pointer-events-none">
                expand_more
              </span>
            </div>

            {/* Export Report Button */}
            <button
              type="button"
              onClick={handleExport}
              disabled={exportState !== 'idle'}
              className="px-3.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:bg-primary-container transition-all"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  exportState === 'compiling' ? 'animate-spin' : ''
                }`}
              >
                {exportState === 'saved' ? 'check' : exportState === 'compiling' ? 'sync' : 'download'}
              </span>
              <span>
                {exportState === 'compiling'
                  ? 'Compiling...'
                  : exportState === 'saved'
                  ? 'Saved Report'
                  : 'Export Ledger'}
              </span>
            </button>
          </div>
        </div>

        {/* Active Corpus Scope Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-surface-container-high text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="text-on-surface-variant truncate font-mono text-[11px]">
              Active Scope: <strong className="text-on-surface">{activeBrand.name}</strong> ({activeBrand.rulebookVersion})
            </span>
          </div>
          <span className="font-mono text-[11px] text-secondary font-bold flex-shrink-0">
            99.8% Parsed
          </span>
        </div>
      </section>

      {/* 2. Performance Ledger Metrics (2x2 Tactile Card Grid) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* First-Pass Rate */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              First-Pass Rate
            </span>
            <span className="inline-flex items-center gap-0.5 bg-secondary-container text-on-secondary-container px-1.5 py-0.5 rounded text-[10px] font-bold">
              <span className="material-symbols-outlined text-[12px]">trending_up</span>+5.2%
            </span>
          </div>
          <div className="mt-3">
            <div className="font-serif text-3xl sm:text-4xl text-primary font-medium tracking-tight">
              {firstPassRate}%
            </div>
            <p className="text-xs text-outline mt-0.5">Approved without revision</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-surface-container-high">
            <div className="h-full bg-primary" style={{ width: `${firstPassRate}%` }} />
          </div>
        </div>

        {/* Audited Assets */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Audited Assets
            </span>
            <span className="material-symbols-outlined text-[18px] text-outline">photo_library</span>
          </div>
          <div className="mt-3">
            <div className="font-serif text-3xl sm:text-4xl text-on-surface font-medium tracking-tight">
              {auditedAssets}
            </div>
            <p className="text-xs text-outline mt-0.5">Across active channels</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-surface-container-high">
            <div className="h-full bg-secondary" style={{ width: '64%' }} />
          </div>
        </div>

        {/* Avg Triage Lag */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Avg Triage Lag
            </span>
            <span className="material-symbols-outlined text-[18px] text-outline">speed</span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-3xl sm:text-4xl text-on-surface font-medium tracking-tight">
                {triageLag}
              </span>
              <span className="text-xs font-semibold text-on-surface-variant">mins</span>
            </div>
            <p className="text-xs text-outline mt-0.5">-6m vs Q2 benchmark</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-surface-container-high">
            <div className="h-full bg-primary-fixed-dim" style={{ width: '82%' }} />
          </div>
        </div>

        {/* Risks Intercepted */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between">
            <span className="font-mono text-[10px] text-error uppercase tracking-wider font-bold">
              Risks Intercepted
            </span>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-error-container text-on-error-container text-xs font-bold">
              !
            </span>
          </div>
          <div className="mt-3">
            <div className="font-serif text-3xl sm:text-4xl text-error font-medium tracking-tight">
              {risksIntercepted}
            </div>
            <p className="text-xs text-outline mt-0.5">Pre-publication halts</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-surface-container-high">
            <div className="h-full bg-error" style={{ width: '42%' }} />
          </div>
        </div>
      </section>

      {/* 3. Editorial Action Advisory Banner */}
      {!advisoryDismissed && (
        <section className="bg-surface-container-low rounded-2xl p-5 border border-surface-container-high shadow-sm relative overflow-hidden">
          <div className="flex gap-4 items-start">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0 text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[20px]">auto_fix_high</span>
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-secondary uppercase tracking-wider">
                  Legal Counsel Intelligence Advisory
                </span>
                <span className="w-1 h-1 rounded-full bg-outline" />
                <span className="text-[11px] text-on-surface-variant">Actionable</span>
              </div>
              <p className="text-xs text-on-surface leading-relaxed">
                <strong className="text-primary font-bold">34% of creative rejections</strong> stem from unverified wellness efficacy terminology (<em className="font-serif text-primary">"detox"</em>, <em className="font-serif text-primary">"cure"</em>, <em className="font-serif text-primary">"miracle"</em>). Updating agency briefing guidelines could slash editorial review cycles by <strong className="text-primary font-bold">30%</strong>.
              </p>
              <div className="pt-2 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleExport}
                  className="bg-primary text-on-primary text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xs hover:bg-primary-container transition-colors"
                >
                  Export Redline Glossary
                </button>
                <button
                  type="button"
                  onClick={() => setAdvisoryDismissed(true)}
                  className="text-xs text-secondary hover:text-on-surface px-2.5 py-1.5 rounded-lg hover:bg-surface-container transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. Infractions Ledger & Source Breakdown (Split View) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Frequent Rule Infractions Ledger */}
        <section className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-surface-container-high shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-serif text-xl font-medium text-primary">Rule Infraction Ledger</h2>
              <p className="text-xs text-on-surface-variant">Ranked frequency across 112 defect tags</p>
            </div>
            <span className="font-mono text-xs text-secondary bg-surface-container-low px-2 py-0.5 rounded border border-surface-container-high">
              Top 5
            </span>
          </div>

          <div className="space-y-3.5 pt-1">
            {[
              { id: 'FB-012', title: 'Unsubstantiated Health Claims', share: 34, count: 38, color: 'bg-error' },
              { id: 'FB-019', title: 'Comparative Superlatives', share: 22, count: 25, color: 'bg-secondary' },
              { id: 'NT-008', title: 'Missing Pricing Asterisk / Disclaimer', share: 18, count: 20, color: 'bg-primary-container' },
              { id: 'AF-014', title: 'Allergen Advisory Placement', share: 14, count: 16, color: 'bg-outline' },
              { id: 'GN-003', title: 'Low Contrast Poster Text (OCR)', share: 12, count: 13, color: 'bg-outline-variant' }
            ].map((item, idx) => (
              <div key={item.id} className="space-y-1">
                <div className="flex items-baseline justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="font-mono text-[11px] text-on-surface-variant flex-shrink-0">
                      0{idx + 1}
                    </span>
                    <span className="font-semibold text-on-surface truncate">{item.title}</span>
                    <span className="font-mono text-[10px] text-outline flex-shrink-0 bg-surface-container px-1.5 py-0.2 rounded font-bold">
                      {item.id}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 flex-shrink-0 font-mono">
                    <span className="font-bold text-on-surface">{item.share}%</span>
                    <span className="text-[10px] text-outline">({item.count}×)</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Detection Source Breakdown & Proof Cards */}
        <section className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-surface-container-high shadow-sm space-y-4">
          <div>
            <h2 className="font-serif text-xl font-medium text-primary">Detection Source Distribution</h2>
            <p className="text-xs text-on-surface-variant">Dual visual-copy inspection engines are mandatory</p>
          </div>

          {/* Segmented Split Gauge Bar */}
          <div className="space-y-2">
            <div className="h-4 w-full rounded-lg overflow-hidden flex bg-surface-container">
              <div
                className="h-full bg-primary flex items-center justify-center text-[10px] text-on-primary font-mono font-bold"
                style={{ width: '56%' }}
              >
                56%
              </div>
              <div
                className="h-full bg-secondary flex items-center justify-center text-[10px] text-on-secondary font-mono font-bold"
                style={{ width: '44%' }}
              >
                44%
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 text-xs pt-1">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-primary flex-shrink-0" />
                <div>
                  <div className="font-semibold text-on-surface">Caption & Body Copy</div>
                  <span className="text-[11px] text-outline font-mono">56% of total flagged rules</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-left sm:text-right">
                <div>
                  <div className="font-semibold text-on-surface">Poster Artwork OCR</div>
                  <span className="text-[11px] text-outline font-mono">44% baked into imagery</span>
                </div>
                <div className="w-3 h-3 rounded bg-secondary flex-shrink-0" />
              </div>
            </div>
          </div>

          {/* Contextual Asset Proof Cards */}
          <div className="pt-2 grid grid-cols-2 gap-3">
            <div className="bg-surface-container-low rounded-xl p-2.5 border border-surface-container-high space-y-2">
              <div className="relative w-full h-24 rounded-lg overflow-hidden bg-surface-container">
                <img
                  src="/assets/aistudio/screen_81b71146.png"
                  alt="Packaging label"
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-1.5 left-1.5 bg-inverse-surface/90 text-inverse-on-surface font-mono text-[10px] px-1.5 py-0.5 rounded">
                  OCR: FB-012
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface truncate">Revive Avocado Glow</span>
                <span className="text-error font-mono text-[11px] font-bold">Flagged</span>
              </div>
            </div>

            <div className="bg-surface-container-low rounded-xl p-2.5 border border-surface-container-high space-y-2">
              <div className="relative w-full h-24 rounded-lg overflow-hidden bg-surface-container">
                <img
                  src="/assets/aistudio/screen_d1dae6af.png"
                  alt="Harvest proof"
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-1.5 left-1.5 bg-inverse-surface/90 text-inverse-on-surface font-mono text-[10px] px-1.5 py-0.5 rounded">
                  Copy: AF-014
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface truncate">Harvest Feast Promo</span>
                <span className="text-secondary font-mono text-[11px] font-bold">Cleared</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 5. Channel Risk Index */}
      <section className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-surface-container-high shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-serif text-xl font-medium text-primary">Channel Risk Index</h2>
            <p className="text-xs text-on-surface-variant">Compliance clearance rate by marketing distribution surface</p>
          </div>
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">share</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Instagram / TikTok */}
          <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0 text-on-surface">
                <span className="material-symbols-outlined text-[18px]">smartphone</span>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-on-surface block truncate">Instagram & TikTok</span>
                <span className="text-[11px] text-error font-medium">Highest Risk: Exaggerated Copy</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0 pl-2">
              <div className="font-serif text-xl text-error font-bold">68%</div>
              <span className="text-[10px] text-outline font-mono">Clearance</span>
            </div>
          </div>

          {/* Paid Display Ads */}
          <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0 text-on-surface">
                <span className="material-symbols-outlined text-[18px]">ad_units</span>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-on-surface block truncate">Paid Display Ads</span>
                <span className="text-[11px] text-on-surface-variant">Moderate Disclaimer Gaps</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0 pl-2">
              <div className="font-serif text-xl text-on-surface font-bold">81%</div>
              <span className="text-[10px] text-outline font-mono">Clearance</span>
            </div>
          </div>

          {/* Print & Packaging */}
          <div className="bg-surface-container-low p-4 rounded-xl border border-surface-container-high flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center flex-shrink-0 text-on-surface">
                <span className="material-symbols-outlined text-[18px]">print</span>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-on-surface block truncate">Print & Packaging</span>
                <span className="text-[11px] text-secondary font-medium">Pre-vetted in R&D cycle</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0 pl-2">
              <div className="font-serif text-xl text-primary font-bold">92%</div>
              <span className="text-[10px] text-outline font-mono">Clearance</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Planned Roadmap Module: v2.6 Capabilities */}
      <section
        onClick={() => onOpenPlannedModal('Agency Scorecards & Cross-Brand Compliance Benchmarking')}
        className="bg-surface-container-low rounded-2xl p-5 sm:p-6 border border-surface-container-high shadow-sm cursor-pointer hover:bg-surface-container transition-all space-y-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-secondary">compass_calibration</span>
            <span className="font-mono text-xs text-secondary uppercase font-bold tracking-wider">
              Roadmap Intelligence
            </span>
          </div>
          <span className="font-mono text-[11px] text-on-primary bg-primary px-2.5 py-0.5 rounded shadow-xs">
            Planned v2.6
          </span>
        </div>

        <h3 className="font-serif text-lg font-medium text-on-surface pt-1">
          Agency Scorecards & Cross-Brand Compliance Benchmarking
        </h3>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Automated vendor accountability matrices to score agency roster performance, recurring violation rates, and turnaround speeds across external design partners.
        </p>

        {/* Locked Card Mockup Preview */}
        <div className="mt-3 bg-surface-container-lowest p-3 rounded-xl border border-surface-container-high flex flex-wrap items-center justify-between gap-2 opacity-80">
          <div className="flex items-center gap-3 min-w-0">
            <span className="material-symbols-outlined text-outline text-[22px] flex-shrink-0">lock_clock</span>
            <div className="flex flex-col text-xs min-w-0">
              <span className="font-bold text-on-surface">Creative Agency Alpha (Grade: B+)</span>
              <span className="text-outline text-[11px]">Cohort parity vs Arka Foods & NovaTech</span>
            </div>
          </div>
          <span className="text-[11px] font-mono font-semibold text-secondary bg-secondary-container/60 px-2.5 py-1 rounded">
            Beta Invite
          </span>
        </div>
      </section>
    </div>
  );
};
