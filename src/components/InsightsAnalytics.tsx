import React, { useEffect, useMemo, useState } from 'react';
import { Brand } from '../data/mockData.js';
import { CampaignPreset, ReviewRecord } from '../utils/rulesEngine.js';
import { downloadBlob } from '../utils/download.js';

interface InsightsAnalyticsProps {
  activeBrand: Brand;
  brands?: Brand[];
  campaigns?: CampaignPreset[];
  reviews?: ReviewRecord[];
  onOpenPlannedModal?: (title: string) => void;
  isDemoMode?: boolean;
}

export const InsightsAnalytics: React.FC<InsightsAnalyticsProps> = ({
  activeBrand,
  brands = [],
  campaigns = [],
  reviews = [],
  isDemoMode = false
}) => {
  const [selectedBrandId, setSelectedBrandId] = useState<string>('all');
  const [selectedAgency, setSelectedAgency] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<string>('30d');
  const [includeSample, setIncludeSample] = useState<boolean>(true);

  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(!isDemoMode);
  const [error, setError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<'idle' | 'downloading' | 'saved'>('idle');

  const demoAnalytics = useMemo(() => {
    if (!isDemoMode) return null;
    const scoped = campaigns.filter(
      (campaign) =>
        (selectedBrandId === 'all' || campaign.brandId === selectedBrandId) &&
        (includeSample || !campaign.isDemoSample)
    );
    const total = scoped.length;
    const approved = scoped.filter((c) => c.status === 'approved').length;
    const rejected = scoped.filter((c) => c.status === 'rejected').length;
    const decided = approved + rejected;
    const allFindings = scoped.flatMap((c) => c.initialFindings || []);
    const openFindings = allFindings.filter((f) => f.status === 'open').length;
    const critical = allFindings.filter((f) => f.severity === 'critical').length;
    const resolved = allFindings.filter((f) => f.status !== 'open').length;
    const byRule = new Map<string, { id: string; title: string; count: number }>();
    allFindings.forEach((f) => {
      const prev = byRule.get(f.ruleId) || { id: f.ruleId, title: f.ruleTitle, count: 0 };
      prev.count += 1;
      byRule.set(f.ruleId, prev);
    });
    const topInfractions = Array.from(byRule.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((r, i) => ({ ...r, rank: i + 1, share: allFindings.length ? Math.round((r.count / allFindings.length) * 100) : 0 }));
    const sampleCampaignsCount = scoped.filter((campaign) => campaign.isDemoSample).length;
    return {
      totalCampaigns: total,
      productionCampaignsCount: 0,
      sampleCampaignsCount,
      outcomes: {
        approvalRate: decided ? Math.round((approved / decided) * 100) : 0,
        approved,
        rejected
      },
      findingsSummary: {
        critical,
        resolutionRate: allFindings.length ? Math.round((resolved / allFindings.length) * 100) : 100,
        copyShare: 0,
        ocrShare: 0
      },
      turnaround: { averageDisplay: 'Not measured', completedReviewsCount: reviews.filter((r) => r.isPublicDemo).length },
      agencyScorecards: [],
      crossBrandComparison: [],
      topInfractions,
      channelRiskIndex: [],
      insufficientData: total === 0,
      message: total === 0 ? 'No campaigns in this demo session yet.' : undefined,
      openFindings
    };
  }, [isDemoMode, campaigns, selectedBrandId, includeSample, reviews]);

  // Fetch genuine analytics from database API
  const fetchAnalytics = async () => {
    if (isDemoMode) return;
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedBrandId !== 'all') params.set('brand', selectedBrandId);
      if (selectedAgency !== 'all') params.set('agency', selectedAgency);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (timeframe !== 'all') params.set('timeframe', timeframe);
      params.set('includeSample', String(includeSample));

      const res = await fetch(`/api/workspace/analytics?${params.toString()}`, {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error(`Failed to load compliance analytics (HTTP ${res.status})`);
      }

      const data = await res.json();
      setAnalytics(data);
    } catch (err: any) {
      setError(err.message || 'Error loading compliance analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isDemoMode) {
      setAnalytics(demoAnalytics);
      setLoading(false);
      return;
    }
    fetchAnalytics();
  }, [selectedBrandId, selectedAgency, selectedStatus, timeframe, includeSample, isDemoMode, demoAnalytics]);

  // Export analytics as genuine CSV or JSON
  const handleExport = async (format: 'json' | 'csv') => {
    if (isDemoMode) {
      if (!demoAnalytics) {
        setError('Public demo analytics are unavailable.');
        return;
      }
      const payload = demoAnalytics;
      const blob = new Blob(
        [
          format === 'json'
            ? JSON.stringify(payload, null, 2)
            : `metric,value\ncampaigns,${payload.totalCampaigns || 0}`
        ],
        { type: format === 'json' ? 'application/json' : 'text/csv' }
      );
      downloadBlob(blob, `demo-analytics.${format}`);
      return;
    }
    try {
      setExportState('downloading');
      const params = new URLSearchParams();
      if (selectedBrandId !== 'all') params.set('brand', selectedBrandId);
      if (selectedAgency !== 'all') params.set('agency', selectedAgency);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (timeframe !== 'all') params.set('timeframe', timeframe);
      params.set('includeSample', String(includeSample));
      params.set('format', format);

      const res = await fetch(`/api/workspace/analytics/export?${params.toString()}`, {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error(`Export failed (HTTP ${res.status})`);
      }

      const blob = await res.blob();
      downloadBlob(blob, `brand-compliance-analytics-${selectedBrandId}-${Date.now()}.${format}`);

      setExportState('saved');
      setTimeout(() => setExportState('idle'), 2500);
    } catch (err: any) {
      setError(err.message || 'Export error');
      setExportState('idle');
    }
  };

  // Derive unique agencies from analytics or presets
  const availableAgencies = Array.from(
    new Set((analytics?.agencyScorecards || []).map((s: any) => s.agencyName))
  ).filter(Boolean);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 1. Header & Filter Bar */}
      <section className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="font-serif text-2xl sm:text-3xl font-medium text-primary tracking-tight">
              Compliance Intelligence & Agency Scorecards
            </h1>
            <p className="text-xs text-on-surface-variant">
              {isDemoMode
                ? 'Session-local metrics from campaigns and decisions in this browser tab. No database is used.'
                : 'Database-backed audit metrics, agency performance scorecards, real turnaround speeds, and cross-brand comparisons.'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            {/* Export CSV */}
            <button
              type="button"
              onClick={() => handleExport('csv')}
              disabled={exportState !== 'idle' || loading || (!isDemoMode && analytics?.insufficientData)}
              className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold flex items-center gap-1.5 border border-surface-container-high shadow-xs transition-all disabled:opacity-50"
              title="Download filtered campaign audit ledger in CSV"
            >
              <span className="material-symbols-outlined text-[16px]">table_view</span>
              <span>Export CSV</span>
            </button>

            {/* Export JSON */}
            <button
              type="button"
              onClick={() => handleExport('json')}
              disabled={exportState !== 'idle' || loading || (!isDemoMode && analytics?.insufficientData)}
              className="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:bg-primary-container transition-all disabled:opacity-50"
              title="Download complete database analytics packet in JSON"
            >
              <span
                className={`material-symbols-outlined text-[16px] ${
                  exportState === 'downloading' ? 'animate-spin' : ''
                }`}
              >
                {exportState === 'saved' ? 'check' : exportState === 'downloading' ? 'sync' : 'download'}
              </span>
              <span>
                {exportState === 'downloading'
                  ? 'Compiling…'
                  : exportState === 'saved'
                  ? 'Saved'
                  : 'Export JSON'}
              </span>
            </button>
          </div>
        </div>

        {/* Multi-Dimensional Filter Controls */}
        <div className="pt-2 border-t border-surface-container-high grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Brand Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              Brand Filter
            </label>
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="w-full text-xs bg-surface-container-low border border-surface-container-high rounded-xl px-2.5 py-1.5 text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
            >
              <option value="all">All Brands (Enterprise)</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Agency Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              Agency / Vendor
            </label>
            <select
              value={selectedAgency}
              onChange={(e) => setSelectedAgency(e.target.value)}
              className="w-full text-xs bg-surface-container-low border border-surface-container-high rounded-xl px-2.5 py-1.5 text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
            >
              <option value="all">All Agencies</option>
              {availableAgencies.map((ag: any) => (
                <option key={ag} value={ag}>
                  {ag}
                </option>
              ))}
            </select>
          </div>

          {/* Review Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              Review Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs bg-surface-container-low border border-surface-container-high rounded-xl px-2.5 py-1.5 text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="in_review">In Review</option>
              <option value="changes_requested">Changes Requested</option>
              <option value="rejected">Rejected</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          {/* Timeframe Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              Date Horizon
            </label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full text-xs bg-surface-container-low border border-surface-container-high rounded-xl px-2.5 py-1.5 text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-xs"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days / Q3</option>
              <option value="ytd">Year-to-Date</option>
              <option value="all">All-Time Database History</option>
            </select>
          </div>

          {/* Sample / Demo Segregation Toggle */}
          <div className="space-y-1 flex flex-col justify-end">
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              Sample Data Segregation
            </label>
            <button
              type="button"
              onClick={() => setIncludeSample(!includeSample)}
              className={`w-full text-xs py-1.5 px-2.5 rounded-xl font-semibold border flex items-center justify-between gap-1 transition-colors shadow-xs ${
                includeSample
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200'
                  : 'bg-surface-container border-surface-container-high text-on-surface-variant'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px]">
                  {includeSample ? 'filter_alt' : 'filter_alt_off'}
                </span>
                <span>Include Demo Presets</span>
              </div>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-black/10">
                {includeSample ? 'ON' : 'OFF'}
              </span>
            </button>
          </div>
        </div>

        {/* Data Segregation Banner */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                includeSample ? 'bg-amber-500' : 'bg-secondary'
              }`}
            />
            <span className="text-on-surface-variant font-mono text-[11px]">
              {includeSample ? (
                isDemoMode ? (
                  <>
                    Demo session only: <strong>{analytics?.totalCampaigns ?? 0} campaigns</strong>, including{' '}
                    <strong>{analytics?.sampleCampaignsCount ?? 0} illustrative presets</strong>. Not production reporting.
                  </>
                ) : (
                  <>
                    Dataset includes <strong>{analytics?.sampleCampaignsCount ?? 0} sample / Wikimedia reference</strong> records and{' '}
                    <strong>{analytics?.productionCampaignsCount ?? 0} production</strong> campaigns.
                  </>
                )
              ) : (
                isDemoMode ? (
                  <>Demo presets are not included in this session view.</>
                ) : (
                  <>
                    Segregated Mode Active: Displaying strictly <strong>production data ({analytics?.productionCampaignsCount ?? 0} records)</strong>. Demo presets excluded.
                  </>
                )
              )}
            </span>
          </div>

          {loading && (
            <span className="text-primary font-mono text-[11px] flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>
              Querying MongoDB…
            </span>
          )}
        </div>
      </section>

      {/* Error Notice */}
      {error && (
        <div className="bg-error-container text-on-error-container p-4 rounded-2xl border border-error/30 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">error</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="font-bold underline text-xs"
          >
            Retry Query
          </button>
        </div>
      )}

      {/* Insufficient Data State */}
      {analytics?.insufficientData ? (
        <section className="bg-surface-container-lowest rounded-2xl p-8 border border-surface-container-high shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-container mx-auto flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-[32px]">query_stats</span>
          </div>
          <div className="space-y-1 max-w-lg mx-auto">
            <h2 className="font-serif text-xl font-medium text-on-surface">
              Insufficient Data for Selected Filters
            </h2>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {analytics.message} No simulated or synthetic numbers are generated.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectedBrandId('all');
                setSelectedAgency('all');
                setSelectedStatus('all');
                setTimeframe('all');
                setIncludeSample(true);
              }}
              className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold shadow-xs hover:bg-primary-container transition-colors"
            >
              Reset Filters to All Records
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* 2. Real Database Performance Ledger Metrics */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Approval Rate */}
            <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-start justify-between">
                <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Review Approval Rate
                </span>
                <span className="material-symbols-outlined text-[18px] text-secondary">
                  verified
                </span>
              </div>
              <div className="mt-3">
                <div className="font-serif text-3xl sm:text-4xl text-primary font-medium tracking-tight">
                  {analytics?.outcomes?.approvalRate ?? 0}%
                </div>
                <p className="text-xs text-outline mt-0.5 font-mono text-[11px]">
                  {analytics?.outcomes?.approved ?? 0} approved /{' '}
                  {(analytics?.outcomes?.approved ?? 0) + (analytics?.outcomes?.rejected ?? 0)} decided
                </p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-surface-container-high">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, analytics?.outcomes?.approvalRate || 0)}%` }}
                />
              </div>
            </div>

            {/* Total Audited Campaigns */}
            <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-start justify-between">
                <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Audited Campaigns
                </span>
                <span className="material-symbols-outlined text-[18px] text-outline">photo_library</span>
              </div>
              <div className="mt-3">
                <div className="font-serif text-3xl sm:text-4xl text-on-surface font-medium tracking-tight">
                  {analytics?.totalCampaigns ?? 0}
                </div>
                <p className="text-xs text-outline mt-0.5 font-mono text-[11px]">
                  {isDemoMode
                    ? `${(analytics?.totalCampaigns ?? 0) - (analytics?.sampleCampaignsCount ?? 0)} session • ${analytics?.sampleCampaignsCount ?? 0} presets`
                    : `${analytics?.productionCampaignsCount ?? 0} prod • ${analytics?.sampleCampaignsCount ?? 0} sample`}
                </p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-surface-container-high">
                <div className="h-full bg-secondary" style={{ width: '100%' }} />
              </div>
            </div>

            {/* Genuine Turnaround Time */}
            <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-start justify-between">
                <span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
                  Avg Turnaround Speed
                </span>
                <span className="material-symbols-outlined text-[18px] text-outline">speed</span>
              </div>
              <div className="mt-3">
                <div className="font-serif text-3xl sm:text-4xl text-on-surface font-medium tracking-tight">
                  {analytics?.turnaround?.averageDisplay ?? 'No data'}
                </div>
                <p className="text-xs text-outline mt-0.5 font-mono text-[11px]">
                  {analytics?.turnaround?.completedReviewsCount
                    ? `${analytics.turnaround.completedReviewsCount} completed review audits`
                    : 'Awaiting first completed review'}
                </p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-surface-container-high">
                <div className="h-full bg-primary-fixed-dim" style={{ width: '70%' }} />
              </div>
            </div>

            {/* Critical Intercepts & Resolution */}
            <div className="bg-surface-container-lowest rounded-2xl p-4 sm:p-5 border border-surface-container-high shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="flex items-start justify-between">
                <span className="font-mono text-[10px] text-error uppercase tracking-wider font-bold">
                  Critical Risks
                </span>
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-error-container text-on-error-container text-xs font-bold">
                  !
                </span>
              </div>
              <div className="mt-3">
                <div className="font-serif text-3xl sm:text-4xl text-error font-medium tracking-tight">
                  {analytics?.findingsSummary?.critical ?? 0}
                </div>
                <p className="text-xs text-outline mt-0.5 font-mono text-[11px]">
                  {analytics?.findingsSummary?.resolutionRate ?? 100}% finding resolution rate
                </p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-surface-container-high">
                <div className="h-full bg-error" style={{ width: `${Math.min(100, analytics?.findingsSummary?.critical ? 50 : 0)}%` }} />
              </div>
            </div>
          </section>

          {/* 3. Agency Compliance Scorecards (Real Database-Backed Matrix) */}
          <section className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-surface-container-high shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-serif text-xl font-medium text-primary">
                  Agency Compliance Scorecards
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Vendor accountability metrics calculated directly from database records
                </p>
              </div>
              <span className="font-mono text-xs text-secondary bg-surface-container-low px-2 py-0.5 rounded border border-surface-container-high">
                {analytics?.agencyScorecards?.length ?? 0} Partner Cohorts
              </span>
            </div>

            {analytics?.agencyScorecards && analytics.agencyScorecards.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-surface-container-high text-on-surface-variant font-mono uppercase text-[10px]">
                      <th className="py-2.5 px-3">Agency Partner</th>
                      <th className="py-2.5 px-3 text-center">Campaigns</th>
                      <th className="py-2.5 px-3 text-center">Approval Rate</th>
                      <th className="py-2.5 px-3 text-center">Critical Finding Rate</th>
                      <th className="py-2.5 px-3 text-center">Avg Turnaround</th>
                      <th className="py-2.5 px-3 text-right">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high">
                    {analytics.agencyScorecards.map((scorecard: any) => (
                      <tr key={scorecard.agencyName} className="hover:bg-surface-container-low transition-colors">
                        <td className="py-3 px-3 font-semibold text-on-surface flex items-center gap-2">
                          <span className="material-symbols-outlined text-[18px] text-secondary">
                            business
                          </span>
                          <span>{scorecard.agencyName}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-medium">
                          {scorecard.campaignsHandled}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-medium">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              scorecard.approvalRate >= 80
                                ? 'bg-secondary/15 text-secondary'
                                : scorecard.approvalRate >= 60
                                ? 'bg-primary/15 text-primary'
                                : 'bg-error-container text-on-error-container'
                            }`}
                          >
                            {scorecard.approvalRate}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-medium">
                          <span
                            className={`text-[11px] ${
                              scorecard.criticalFindingsRate > 0 ? 'text-error font-bold' : 'text-on-surface-variant'
                            }`}
                          >
                            {scorecard.criticalFindingsRate}% ({scorecard.criticalFindings} critical)
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-on-surface-variant">
                          {scorecard.averageTurnaroundMinutes !== null
                            ? `${scorecard.averageTurnaroundMinutes} mins`
                            : 'Pending decisions'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold ${
                              scorecard.grade === 'A'
                                ? 'bg-secondary text-on-secondary'
                                : scorecard.grade === 'B'
                                ? 'bg-primary text-on-primary'
                                : scorecard.grade === 'C'
                                ? 'bg-error-container text-on-error-container'
                                : 'bg-surface-container text-on-surface-variant'
                            }`}
                          >
                            Grade: {scorecard.grade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface-variant">
                No agency attribution data recorded yet. Assign agencies when uploading or editing campaigns.
              </div>
            )}
          </section>

          {/* 4. Cross-Brand Comparison & Infractions (Split View) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cross-Brand Comparison */}
            <section className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-surface-container-high shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-serif text-xl font-medium text-primary">Cross-Brand Benchmark</h2>
                  <p className="text-xs text-on-surface-variant">Compliance clearance across brand portfolios</p>
                </div>
                <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                  compare_arrows
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {analytics?.crossBrandComparison?.map((brandMetric: any) => (
                  <div key={brandMetric.brandId} className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-on-surface">{brandMetric.brandName}</span>
                        <span className="font-mono text-[10px] text-outline">
                          ({brandMetric.totalCampaigns} campaigns)
                        </span>
                      </div>
                      <span className="font-mono font-bold text-primary">
                        {brandMetric.approvalRate}% Clearance
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
                      <span>Total Findings: {brandMetric.totalFindings}</span>
                      <span>Frequency: {brandMetric.findingFrequency} / campaign</span>
                    </div>

                    <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.min(100, brandMetric.approvalRate || 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Top Infractions Ledger */}
            <section className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-surface-container-high shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-serif text-xl font-medium text-primary">Frequent Defect Ledger</h2>
                  <p className="text-xs text-on-surface-variant">Top recurring brand policy infractions</p>
                </div>
                <span className="font-mono text-xs text-secondary bg-surface-container-low px-2 py-0.5 rounded border border-surface-container-high">
                  Top 5 Infractions
                </span>
              </div>

              <div className="space-y-3 pt-1">
                {analytics?.topInfractions && analytics.topInfractions.length > 0 ? (
                  analytics.topInfractions.map((item: any) => (
                    <div key={item.id} className="space-y-1">
                      <div className="flex items-baseline justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <span className="font-mono text-[11px] text-on-surface-variant flex-shrink-0">
                            0{item.rank}
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
                        <div
                          className="h-full bg-error rounded-full"
                          style={{ width: `${Math.min(100, item.share || 0)}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-on-surface-variant py-4 text-center">
                    No infractions recorded in this timeframe. All assets fully compliant!
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* 5. Dual Detection Source Split & Channel Clearance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Detection Source Split */}
            <section className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-surface-container-high shadow-sm space-y-4">
              <div>
                <h2 className="font-serif text-xl font-medium text-primary">Detection Source Distribution</h2>
                <p className="text-xs text-on-surface-variant">Dual visual-copy inspection distribution</p>
              </div>

              <div className="space-y-2">
                <div className="h-4 w-full rounded-lg overflow-hidden flex bg-surface-container">
                  <div
                    className="h-full bg-primary flex items-center justify-center text-[10px] text-on-primary font-mono font-bold"
                    style={{ width: `${analytics?.findingsSummary?.copyShare ?? 50}%` }}
                  >
                    {analytics?.findingsSummary?.copyShare ?? 50}%
                  </div>
                  <div
                    className="h-full bg-secondary flex items-center justify-center text-[10px] text-on-secondary font-mono font-bold"
                    style={{ width: `${analytics?.findingsSummary?.ocrShare ?? 50}%` }}
                  >
                    {analytics?.findingsSummary?.ocrShare ?? 50}%
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 text-xs pt-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-primary flex-shrink-0" />
                    <div>
                      <div className="font-semibold text-on-surface">Caption & Body Copy</div>
                      <span className="text-[11px] text-outline font-mono">
                        {analytics?.findingsSummary?.copyShare ?? 50}% of flagged rules
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-left sm:text-right">
                    <div>
                      <div className="font-semibold text-on-surface">Artwork OCR Extraction</div>
                      <span className="text-[11px] text-outline font-mono">
                        {analytics?.findingsSummary?.ocrShare ?? 50}% baked into imagery
                      </span>
                    </div>
                    <div className="w-3 h-3 rounded bg-secondary flex-shrink-0" />
                  </div>
                </div>
              </div>
            </section>

            {/* Channel Clearance Rate */}
            <section className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-surface-container-high shadow-sm space-y-4">
              <div>
                <h2 className="font-serif text-xl font-medium text-primary">Channel Risk Index</h2>
                <p className="text-xs text-on-surface-variant">Compliance clearance rate by marketing distribution surface</p>
              </div>

              <div className="space-y-2.5">
                {analytics?.channelRiskIndex && analytics.channelRiskIndex.length > 0 ? (
                  analytics.channelRiskIndex.map((ch: any) => (
                    <div key={ch.channel} className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-semibold text-on-surface block">{ch.channel}</span>
                        <span className="text-[11px] text-on-surface-variant font-mono">
                          {ch.totalCampaigns} campaigns • {ch.totalFindings} findings
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-serif text-lg font-bold text-primary">
                          {ch.clearanceRate}%
                        </span>
                        <span className="text-[10px] text-outline block font-mono">Clearance</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-on-surface-variant py-2">
                    No channel data available for selected filter range.
                  </p>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};
