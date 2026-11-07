/* Brand Review Desk - Database-Backed Agency Scorecards & Analytics Engine
   Calculates compliance intelligence directly from MongoDB collections (campaigns, events, reviews)
   with query filtering, agency scorecards, cross-brand comparisons, turnaround tracking,
   sample data segregation, and CSV / JSON export generation.
*/

const { normalizeStatus, WORKFLOW_STATUSES } = require('./workflow');

/**
 * Parses a timeframe query parameter into a startDate threshold.
 */
function parseTimeframe(timeframe) {
  const now = new Date();
  switch (timeframe) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
    case 'q3':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case 'ytd':
      return new Date(now.getFullYear(), 0, 1);
    case 'all':
      return null;
    default:
      if (timeframe && !isNaN(Date.parse(timeframe))) {
        return new Date(timeframe);
      }
      return null;
  }
}

/**
 * Calculates genuine analytics from campaign and event records.
 */
async function calculateAnalytics(options = {}) {
  const { database, memoryStore, filters = {} } = options;

  let allCampaigns = [];
  let allEvents = [];

  if (database && options.isConnected !== false) {
    try {
      allCampaigns = await database.collection('campaigns').find({}).toArray();
      allEvents = await database.collection('events').find({}).toArray();
    } catch (err) {
      console.warn('Database query error in calculateAnalytics, falling back to memory store:', err.message);
      if (memoryStore) {
        allCampaigns = memoryStore.campaigns || [];
        allEvents = memoryStore.events || [];
      }
    }
  } else if (memoryStore) {
    allCampaigns = memoryStore.campaigns || [];
    allEvents = memoryStore.events || [];
  }

  // Determine sample vs production inclusion
  const includeSample = filters.includeSample !== false && filters.includeSample !== 'false';
  const brandFilter = filters.brand && filters.brand !== 'all' ? String(filters.brand).toLowerCase().trim() : null;
  const agencyFilter = filters.agency && filters.agency !== 'all' ? String(filters.agency).toLowerCase().trim() : null;
  const statusFilter = filters.status && filters.status !== 'all' ? normalizeStatus(filters.status) : null;
  const startDate = parseTimeframe(filters.timeframe || filters.dateRange);

  // Filter campaigns
  const filteredCampaigns = allCampaigns.filter((c) => {
    // 1. Sample segregation
    const isSample = Boolean(c.isDemo || c.referenceOnly);
    if (!includeSample && isSample) {
      return false;
    }

    // 2. Brand filter
    if (brandFilter) {
      const cBrandId = String(c.brandId || '').toLowerCase();
      const cBrandName = String(c.brandName || '').toLowerCase();
      if (cBrandId !== brandFilter && cBrandName !== brandFilter) {
        return false;
      }
    }

    // 3. Agency filter
    if (agencyFilter) {
      const cAgency = String(c.agency || 'Unassigned').toLowerCase();
      if (cAgency !== agencyFilter) {
        return false;
      }
    }

    // 4. Status filter
    if (statusFilter) {
      const cStatus = normalizeStatus(c.status);
      if (cStatus !== statusFilter) {
        return false;
      }
    }

    // 5. Date filter
    if (startDate) {
      const cDate = c.createdAt ? new Date(c.createdAt) : null;
      if (cDate && cDate < startDate) {
        return false;
      }
    }

    return true;
  });

  const totalCampaigns = filteredCampaigns.length;
  const sampleCampaignsCount = filteredCampaigns.filter((c) => Boolean(c.isDemo || c.referenceOnly)).length;
  const productionCampaignsCount = totalCampaigns - sampleCampaignsCount;

  // Handle Insufficient Data state cleanly without inventing fake numbers
  if (totalCampaigns === 0) {
    return {
      insufficientData: true,
      message: 'No campaign records match the specified filters. Adjust filters or upload campaigns to generate compliance intelligence.',
      timeframe: filters.timeframe || '30d',
      includeSample,
      filters,
      totalCampaigns: 0,
      sampleCampaignsCount: 0,
      productionCampaignsCount: 0,
      outcomes: {
        draft: 0,
        in_review: 0,
        changes_requested: 0,
        approved: 0,
        rejected: 0,
        approvalRate: 0,
        rejectionRate: 0
      },
      findingsSummary: {
        total: 0,
        resolved: 0,
        open: 0,
        resolutionRate: 0,
        critical: 0,
        warning: 0,
        advisory: 0
      },
      turnaround: {
        averageMinutes: null,
        averageDisplay: 'No data',
        completedReviewsCount: 0,
        message: 'No completed review decisions exist to compute turnaround speed.'
      },
      agencyScorecards: [],
      crossBrandComparison: [],
      channelRiskIndex: [],
      topInfractions: []
    };
  }

  // 1. Review Outcomes breakdown
  let draftCount = 0;
  let inReviewCount = 0;
  let changesRequestedCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;

  for (const c of filteredCampaigns) {
    const st = normalizeStatus(c.status);
    if (st === WORKFLOW_STATUSES.APPROVED) approvedCount++;
    else if (st === WORKFLOW_STATUSES.REJECTED) rejectedCount++;
    else if (st === WORKFLOW_STATUSES.CHANGES_REQUESTED) changesRequestedCount++;
    else if (st === WORKFLOW_STATUSES.IN_REVIEW) inReviewCount++;
    else draftCount++;
  }

  const resolvedDecisionsCount = approvedCount + rejectedCount;
  const approvalRate = resolvedDecisionsCount > 0
    ? Math.round((approvedCount / resolvedDecisionsCount) * 1000) / 10
    : 0;
  const rejectionRate = resolvedDecisionsCount > 0
    ? Math.round((rejectedCount / resolvedDecisionsCount) * 1000) / 10
    : 0;

  // 2. Findings and resolution metrics
  let totalFindings = 0;
  let resolvedFindings = 0;
  let openFindings = 0;
  let criticalFindings = 0;
  let warningFindings = 0;
  let advisoryFindings = 0;
  let copyFindingsCount = 0;
  let ocrFindingsCount = 0;

  const infractionCounts = {};

  for (const c of filteredCampaigns) {
    const findings = Array.isArray(c.initialFindings) ? c.initialFindings : [];
    for (const f of findings) {
      totalFindings++;
      const isResolved = f.status && f.status !== 'open';
      if (isResolved) {
        resolvedFindings++;
      } else {
        openFindings++;
      }

      if (f.severity === 'critical') criticalFindings++;
      else if (f.severity === 'advisory') advisoryFindings++;
      else warningFindings++;

      if (f.source === 'ocr') ocrFindingsCount++;
      else if (f.source === 'caption') copyFindingsCount++;
      else {
        // Both
        copyFindingsCount++;
        ocrFindingsCount++;
      }

      // Track infraction top rules
      const ruleKey = f.ruleId || 'GENERAL';
      if (!infractionCounts[ruleKey]) {
        infractionCounts[ruleKey] = {
          id: ruleKey,
          title: f.ruleTitle || f.explanation || ruleKey,
          count: 0
        };
      }
      infractionCounts[ruleKey].count++;
    }
  }

  const findingResolutionRate = totalFindings > 0
    ? Math.round((resolvedFindings / totalFindings) * 1000) / 10
    : 100;

  // Ranked Top Infractions
  const topInfractions = Object.values(infractionCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
      share: totalFindings > 0 ? Math.round((item.count / totalFindings) * 100) : 0
    }));

  // Detection source split
  const totalDetectedTokens = copyFindingsCount + ocrFindingsCount;
  const copyShare = totalDetectedTokens > 0
    ? Math.round((copyFindingsCount / totalDetectedTokens) * 100)
    : 50;
  const ocrShare = totalDetectedTokens > 0 ? 100 - copyShare : 50;

  // 3. Genuine Turnaround Time Calculation using real timestamps
  const campaignDurations = [];
  const campaignIdsSet = new Set(filteredCampaigns.map((c) => String(c.id)));

  // Group events by campaignId
  const eventsByCampaign = {};
  for (const evt of allEvents) {
    const cId = String(evt.campaignId);
    if (!campaignIdsSet.has(cId)) continue;
    if (!eventsByCampaign[cId]) eventsByCampaign[cId] = [];
    eventsByCampaign[cId].push(evt);
  }

  for (const c of filteredCampaigns) {
    const cId = String(c.id);
    const evts = eventsByCampaign[cId] || [];

    // Find submission time (from event or campaign creation)
    const submitEvt = evts.find((e) => e.actionType === 'campaign_submitted');
    const submitTime = submitEvt ? new Date(submitEvt.timestamp) : (c.createdAt ? new Date(c.createdAt) : null);

    // Find decision time (from approval/rejection event or campaign fields)
    const decisionEvt = evts
      .filter((e) => e.actionType === 'campaign_approved' || e.actionType === 'campaign_rejected')
      .pop();

    const decisionTime = decisionEvt
      ? new Date(decisionEvt.timestamp)
      : (c.approvedAt ? new Date(c.approvedAt) : null);

    if (submitTime && decisionTime && decisionTime >= submitTime) {
      const durationMs = decisionTime.getTime() - submitTime.getTime();
      const durationMins = Math.round(durationMs / 60000);
      campaignDurations.push({
        campaignId: c.id,
        durationMinutes: durationMins,
        decision: c.status
      });
    }
  }

  let averageMinutes = null;
  let averageDisplay = 'No completed reviews';
  if (campaignDurations.length > 0) {
    const sumMins = campaignDurations.reduce((acc, curr) => acc + curr.durationMinutes, 0);
    averageMinutes = Math.round(sumMins / campaignDurations.length);
    if (averageMinutes >= 60) {
      const hours = (averageMinutes / 60).toFixed(1);
      averageDisplay = `${hours} hrs`;
    } else {
      averageDisplay = `${averageMinutes} mins`;
    }
  }

  // 4. Agency Scorecards Aggregation
  const agencyGroups = {};
  for (const c of filteredCampaigns) {
    const agName = (c.agency && c.agency.trim()) || 'Unassigned';
    if (!agencyGroups[agName]) {
      agencyGroups[agName] = {
        agencyName: agName,
        campaignsHandled: 0,
        approvedCount: 0,
        rejectedCount: 0,
        changesRequestedCount: 0,
        inReviewCount: 0,
        draftCount: 0,
        totalFindings: 0,
        criticalFindings: 0,
        durations: []
      };
    }

    const g = agencyGroups[agName];
    g.campaignsHandled++;
    const st = normalizeStatus(c.status);
    if (st === WORKFLOW_STATUSES.APPROVED) g.approvedCount++;
    else if (st === WORKFLOW_STATUSES.REJECTED) g.rejectedCount++;
    else if (st === WORKFLOW_STATUSES.CHANGES_REQUESTED) g.changesRequestedCount++;
    else if (st === WORKFLOW_STATUSES.IN_REVIEW) g.inReviewCount++;
    else g.draftCount++;

    const findings = Array.isArray(c.initialFindings) ? c.initialFindings : [];
    g.totalFindings += findings.length;
    g.criticalFindings += findings.filter((f) => f.severity === 'critical').length;

    const matchedDuration = campaignDurations.find((d) => d.campaignId === c.id);
    if (matchedDuration) {
      g.durations.push(matchedDuration.durationMinutes);
    }
  }

  const agencyScorecards = Object.values(agencyGroups).map((g) => {
    const decisions = g.approvedCount + g.rejectedCount;
    const rate = decisions > 0 ? Math.round((g.approvedCount / decisions) * 1000) / 10 : 0;
    const critRate = g.totalFindings > 0 ? Math.round((g.criticalFindings / g.totalFindings) * 1000) / 10 : 0;
    const avgTurnaround = g.durations.length > 0
      ? Math.round(g.durations.reduce((a, b) => a + b, 0) / g.durations.length)
      : null;

    let grade = 'B';
    if (decisions === 0) grade = 'Pending';
    else if (rate >= 80 && critRate <= 10) grade = 'A';
    else if (rate >= 60) grade = 'B';
    else grade = 'C';

    return {
      agencyName: g.agencyName,
      campaignsHandled: g.campaignsHandled,
      approvedCount: g.approvedCount,
      rejectedCount: g.rejectedCount,
      approvalRate: rate,
      totalFindings: g.totalFindings,
      criticalFindings: g.criticalFindings,
      criticalFindingsRate: critRate,
      averageTurnaroundMinutes: avgTurnaround,
      grade
    };
  }).sort((a, b) => b.campaignsHandled - a.campaignsHandled);

  // 5. Cross-Brand Comparison Aggregation
  const brandGroups = {};
  for (const c of filteredCampaigns) {
    const bId = c.brandId || 'global';
    const bName = c.brandName || 'Reference library';
    if (!brandGroups[bId]) {
      brandGroups[bId] = {
        brandId: bId,
        brandName: bName,
        totalCampaigns: 0,
        approvedCount: 0,
        rejectedCount: 0,
        totalFindings: 0,
        criticalFindings: 0
      };
    }

    const bg = brandGroups[bId];
    bg.totalCampaigns++;
    const st = normalizeStatus(c.status);
    if (st === WORKFLOW_STATUSES.APPROVED) bg.approvedCount++;
    else if (st === WORKFLOW_STATUSES.REJECTED) bg.rejectedCount++;

    const findings = Array.isArray(c.initialFindings) ? c.initialFindings : [];
    bg.totalFindings += findings.length;
    bg.criticalFindings += findings.filter((f) => f.severity === 'critical').length;
  }

  const crossBrandComparison = Object.values(brandGroups).map((bg) => {
    const decisions = bg.approvedCount + bg.rejectedCount;
    const rate = decisions > 0 ? Math.round((bg.approvedCount / decisions) * 1000) / 10 : 0;
    const freq = bg.totalCampaigns > 0 ? Math.round((bg.totalFindings / bg.totalCampaigns) * 10) / 10 : 0;

    return {
      brandId: bg.brandId,
      brandName: bg.brandName,
      totalCampaigns: bg.totalCampaigns,
      approvedCount: bg.approvedCount,
      rejectedCount: bg.rejectedCount,
      approvalRate: rate,
      totalFindings: bg.totalFindings,
      criticalFindings: bg.criticalFindings,
      findingFrequency: freq
    };
  }).sort((a, b) => b.totalCampaigns - a.totalCampaigns);

  // 6. Channel Risk Distribution
  const channelGroups = {};
  for (const c of filteredCampaigns) {
    const ch = c.channel || 'Image reference';
    if (!channelGroups[ch]) {
      channelGroups[ch] = {
        channel: ch,
        total: 0,
        approved: 0,
        findings: 0
      };
    }
    channelGroups[ch].total++;
    if (normalizeStatus(c.status) === WORKFLOW_STATUSES.APPROVED) channelGroups[ch].approved++;
    channelGroups[ch].findings += (c.initialFindings || []).length;
  }

  const channelRiskIndex = Object.values(channelGroups).map((cg) => ({
    channel: cg.channel,
    totalCampaigns: cg.total,
    clearanceRate: cg.total > 0 ? Math.round((cg.approved / cg.total) * 100) : 0,
    totalFindings: cg.findings
  }));

  return {
    insufficientData: false,
    generatedAt: new Date().toISOString(),
    timeframe: filters.timeframe || '30d',
    includeSample,
    filters: {
      brand: brandFilter || 'all',
      agency: agencyFilter || 'all',
      status: statusFilter || 'all',
      timeframe: filters.timeframe || '30d'
    },
    totalCampaigns,
    sampleCampaignsCount,
    productionCampaignsCount,
    outcomes: {
      draft: draftCount,
      in_review: inReviewCount,
      changes_requested: changesRequestedCount,
      approved: approvedCount,
      rejected: rejectedCount,
      approvalRate,
      rejectionRate
    },
    findingsSummary: {
      total: totalFindings,
      resolved: resolvedFindings,
      open: openFindings,
      resolutionRate: findingResolutionRate,
      critical: criticalFindings,
      warning: warningFindings,
      advisory: advisoryFindings,
      copyShare,
      ocrShare
    },
    turnaround: {
      averageMinutes,
      averageDisplay,
      completedReviewsCount: campaignDurations.length,
      message: campaignDurations.length > 0 ? null : 'No completed review decisions to calculate turnaround time.'
    },
    topInfractions,
    agencyScorecards,
    crossBrandComparison,
    channelRiskIndex,
    campaigns: filteredCampaigns.map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      brandId: c.brandId,
      brandName: c.brandName,
      agency: c.agency || 'Unassigned',
      channel: c.channel,
      format: c.format,
      status: normalizeStatus(c.status),
      isDemo: Boolean(c.isDemo || c.referenceOnly),
      createdAt: c.createdAt || null,
      findingsCount: (c.initialFindings || []).length,
      criticalCount: (c.initialFindings || []).filter((f) => f.severity === 'critical').length,
      resolvedCount: (c.initialFindings || []).filter((f) => f.status && f.status !== 'open').length
    }))
  };
}

/**
 * Generates CSV string for export.
 */
function generateAnalyticsCsv(analyticsData) {
  const headers = [
    'Campaign Code',
    'Title',
    'Brand Name',
    'Agency',
    'Channel',
    'Format',
    'Status',
    'Is Demo / Sample',
    'Created At',
    'Total Findings',
    'Critical Findings',
    'Resolved Findings'
  ];

  const campaigns = analyticsData.campaigns || [];
  const rows = campaigns.map((c) => [
    `"${String(c.code || '').replace(/"/g, '""')}"`,
    `"${String(c.title || '').replace(/"/g, '""')}"`,
    `"${String(c.brandName || '').replace(/"/g, '""')}"`,
    `"${String(c.agency || 'Unassigned').replace(/"/g, '""')}"`,
    `"${String(c.channel || '').replace(/"/g, '""')}"`,
    `"${String(c.format || '').replace(/"/g, '""')}"`,
    `"${c.status}"`,
    c.isDemo ? 'Yes' : 'No',
    c.createdAt ? `"${new Date(c.createdAt).toISOString()}"` : '""',
    c.findingsCount || 0,
    c.criticalCount || 0,
    c.resolvedCount || 0
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

module.exports = {
  calculateAnalytics,
  generateAnalyticsCsv,
  parseTimeframe
};

