import React, { useMemo, useState } from 'react';
import { Brand } from '../data/mockData.js';
import { BrandRule, CampaignPreset, ReviewRecord } from '../utils/rulesEngine.js';

interface InsightsAnalyticsProps {
  activeBrand?: Brand;
  campaigns: CampaignPreset[];
  reviews: ReviewRecord[];
  rules: BrandRule[];
}

export const InsightsAnalytics: React.FC<InsightsAnalyticsProps> = ({ activeBrand, campaigns, reviews, rules }) => {
  const [exported, setExported] = useState(false);
  const brandCampaigns = useMemo(
    () => campaigns.filter((campaign) => !activeBrand || campaign.brandId === activeBrand.id || campaign.brandId === 'global'),
    [campaigns, activeBrand]
  );
  const brandReviews = useMemo(
    () => reviews.filter((review) => !activeBrand || review.brandId === activeBrand.id),
    [reviews, activeBrand]
  );
  const activeRules = useMemo(
    () => rules.filter((rule) => rule.enabled && (!activeBrand || rule.brand === activeBrand.id || rule.brand === 'global')),
    [rules, activeBrand]
  );
  const findings = brandReviews.flatMap((review) => review.findings || []);
  const findingCounts = findings.reduce<Record<string, number>>((totals, finding) => {
    totals[finding.ruleId] = (totals[finding.ruleId] || 0) + 1;
    return totals;
  }, {});
  const topRules = Object.entries(findingCounts)
    .map(([id, count]) => ({ id, count, title: activeRules.find((rule) => rule.id === id)?.title || id }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
  const resolvedCount = findings.filter((finding) => finding.status !== 'open').length;
  const openCount = findings.length - resolvedCount;
  const sampleCount = [...brandCampaigns, ...brandReviews].filter((record) => record.isDemo).length;
  const referenceCount = brandCampaigns.filter((campaign) => campaign.referenceOnly).length;

  const exportData = () => {
    const data = {
      brand: activeBrand?.name || 'All brands',
      exportedAt: new Date().toISOString(),
      source: 'MongoDB workspace records',
      totals: {
        campaigns: brandCampaigns.length,
        referenceImages: referenceCount,
        reviews: brandReviews.length,
        activeRules: activeRules.length,
        findings: findings.length,
        openFindings: openCount,
        resolvedFindings: resolvedCount
      },
      findingsByRule: topRules
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `workspace-insights-${activeBrand?.id || 'all'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setExported(true);
    window.setTimeout(() => setExported(false), 1800);
  };

  const metrics = [
    { label: 'Campaign records', value: brandCampaigns.length, icon: 'photo_library', color: 'text-primary' },
    { label: 'Reference images', value: referenceCount, icon: 'image_search', color: 'text-secondary' },
    { label: 'Saved reviews', value: brandReviews.length, icon: 'fact_check', color: 'text-primary' },
    { label: 'Active rules', value: activeRules.length, icon: 'policy', color: 'text-secondary' }
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <section className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-medium text-primary tracking-tight">Workspace insights</h1>
          <p className="text-xs text-on-surface-variant mt-1">Counts are calculated from the current MongoDB records{activeBrand ? ` for ${activeBrand.name}` : ''}.</p>
          {sampleCount > 0 && <p className="text-[11px] text-amber-800 mt-2">Includes {sampleCount} record(s) marked as sample data.</p>}
        </div>
        <button type="button" onClick={exportData} className="px-3.5 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto">
          <span className="material-symbols-outlined text-[16px]">download</span>{exported ? 'Exported' : 'Export current data'}
        </button>
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">{metric.label}</span>
              <span className={`material-symbols-outlined text-[19px] ${metric.color}`}>{metric.icon}</span>
            </div>
            <div className="font-serif text-3xl sm:text-4xl text-on-surface font-medium tracking-tight mt-3">{metric.value}</div>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <article className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-surface-container-high shadow-sm space-y-4">
          <div>
            <h2 className="font-serif text-xl font-medium text-primary">Review findings</h2>
            <p className="text-xs text-on-surface-variant">Counts come from findings saved with review records.</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ['Total', findings.length],
              ['Open', openCount],
              ['Resolved', resolvedCount]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface-container-low p-3 border border-surface-container-high">
                <div className="font-serif text-2xl text-primary">{value}</div>
                <div className="text-[10px] text-on-surface-variant uppercase tracking-wide">{label}</div>
              </div>
            ))}
          </div>
          {topRules.length > 0 ? (
            <div className="space-y-3 pt-1">
              {topRules.map((item) => (
                <div key={item.id}>
                  <div className="flex justify-between gap-3 text-xs mb-1">
                    <span className="font-semibold text-on-surface truncate">{item.title} <span className="font-mono text-[10px] text-outline">{item.id}</span></span>
                    <span className="font-mono text-on-surface-variant">{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(5, (item.count / topRules[0].count) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-surface-container-high p-6 text-center text-xs text-on-surface-variant">No saved review findings for this brand yet.</div>
          )}
        </article>

        <article className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-surface-container-high shadow-sm space-y-4">
          <div>
            <h2 className="font-serif text-xl font-medium text-primary">Images in this workspace</h2>
            <p className="text-xs text-on-surface-variant">Preview thumbnails and source pages stored with campaign records.</p>
          </div>
          {brandCampaigns.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {brandCampaigns.slice(0, 9).map((campaign) => (
                <a key={campaign.id} href={campaign.sourceUrl || undefined} target={campaign.sourceUrl ? '_blank' : undefined} rel={campaign.sourceUrl ? 'noreferrer' : undefined} className="group overflow-hidden rounded-xl border border-surface-container-high bg-surface-container-low">
                  <div className="h-24 overflow-hidden bg-surface-container-high">
                    <img src={campaign.imageUrl} alt={campaign.title} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  </div>
                  <div className="p-2">
                    <div className="text-[11px] font-semibold text-on-surface truncate">{campaign.title}</div>
                    <div className="text-[10px] text-on-surface-variant truncate">{campaign.referenceOnly ? 'Image reference' : campaign.channel}</div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-surface-container-high p-6 text-center text-xs text-on-surface-variant">No campaign image records are available yet.</div>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-on-surface-variant border-t border-surface-container-high pt-3">
            <span>{brandCampaigns.length} campaign record(s)</span>
            <span>{referenceCount} reference image(s)</span>
            <span>{brandReviews.length} review record(s)</span>
          </div>
        </article>
      </section>
    </div>
  );
};
