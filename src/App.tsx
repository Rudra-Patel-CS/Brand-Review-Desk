import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Header } from './components/Header.js';
import { Navigation } from './components/Navigation.js';
import { ReviewContent } from './components/ReviewContent.js';
import { BrandRules } from './components/BrandRules.js';
import { ReviewHistory } from './components/ReviewHistory.js';
import { InsightsAnalytics } from './components/InsightsAnalytics.js';
import { OcrTextModal } from './components/modals/OcrTextModal.js';
import { UploadCreativeModal } from './components/modals/UploadCreativeModal.js';
import { NewRuleModal } from './components/modals/NewRuleModal.js';
import { ApproveExportModal } from './components/modals/ApproveExportModal.js';
import { DismissNoteModal } from './components/modals/DismissNoteModal.js';
import { DatabaseStatusModal } from './components/modals/DatabaseStatusModal.js';
import { PlannedFeatureModal } from './components/modals/PlannedFeatureModal.js';
import { Brand } from './data/mockData.js';
import { BrandRule, CampaignPreset, ComplianceFinding, ReviewRecord } from './utils/rulesEngine.js';

type Tab = 'review' | 'rules' | 'history' | 'insights';
interface WorkspaceSnapshot {
  connected: boolean;
  database: string;
  updatedAt: string;
  brands: Brand[];
  rules: BrandRule[];
  campaigns: CampaignPreset[];
  reviews: ReviewRecord[];
}

async function requestApi<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body as T;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('review');
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const lastRecordsRef = useRef('');
  const [activeBrandId, setActiveBrandId] = useState('');
  const [activeCampaignId, setActiveCampaignId] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isOcrOpen, setIsOcrOpen] = useState(false);
  const [ocrModalData, setOcrModalData] = useState({ text: '' });
  const [saveOcrText, setSaveOcrText] = useState<((text: string) => Promise<void>) | null>(null);
  const [isNewRuleOpen, setIsNewRuleOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState<BrandRule | null>(null);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveData, setApproveData] = useState<{
    campaign: CampaignPreset;
    caption: string;
    findings: ComplianceFinding[];
  } | null>(null);
  const [dismissFinding, setDismissFinding] = useState<ComplianceFinding | null>(null);
  const [dismissAction, setDismissAction] = useState<((note: string) => void) | null>(null);
  const [isDbStatusOpen, setIsDbStatusOpen] = useState(false);
  const [isPlannedOpen, setIsPlannedOpen] = useState(false);
  const [plannedTitle, setPlannedTitle] = useState('Planned Feature');

  const brands = workspace?.brands || [];
  const rules = workspace?.rules || [];
  const campaigns = workspace?.campaigns || [];
  const reviews = workspace?.reviews || [];
  const activeBrand = brands.find((brand) => brand.id === activeBrandId) || brands[0];
  const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId && (campaign.brandId === activeBrand?.id || campaign.brandId === 'global'))
    || campaigns.find((campaign) => campaign.brandId === activeBrand?.id || campaign.brandId === 'global');

  const refreshWorkspace = useCallback(async () => {
    try {
      const snapshot = await requestApi<WorkspaceSnapshot>('/api/workspace');
      const recordSignature = JSON.stringify([snapshot.brands, snapshot.rules, snapshot.campaigns, snapshot.reviews]);
      if (recordSignature !== lastRecordsRef.current) {
        lastRecordsRef.current = recordSignature;
        setWorkspace(snapshot);
      } else if (!workspace) {
        setWorkspace(snapshot);
      }
      setConnectionError(null);
      setLastSync(new Date().toISOString());
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Could not read the database');
    } finally {
      setIsLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    void refreshWorkspace();
    const timer = window.setInterval(() => void refreshWorkspace(), 10000);
    return () => window.clearInterval(timer);
  }, [refreshWorkspace]);

  useEffect(() => {
    if (activeBrand && !activeBrandId) setActiveBrandId(activeBrand.id);
  }, [activeBrand, activeBrandId]);

  useEffect(() => {
    if (activeCampaign && activeCampaign.id !== activeCampaignId) setActiveCampaignId(activeCampaign.id);
  }, [activeCampaign, activeCampaignId]);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 3200);
  };

  const saveCampaign = async (campaign: CampaignPreset, method: 'POST' | 'PUT' = 'PUT') => {
    const url = method === 'POST'
      ? '/api/workspace/campaigns'
      : `/api/workspace/campaigns/${encodeURIComponent(campaign.id)}`;
    await requestApi(url, { method, body: JSON.stringify(campaign) });
    await refreshWorkspace();
  };

  const handleToggleRule = async (ruleId: string) => {
    const rule = rules.find((item) => item.id === ruleId);
    if (!rule) return;
    try {
      await requestApi(`/api/workspace/rules/${encodeURIComponent(rule.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ ...rule, enabled: !rule.enabled })
      });
      await refreshWorkspace();
      showToast(`Saved ${rule.id} to the database`);
    } catch (error) {
      showToast(`Rule was not saved: ${error instanceof Error ? error.message : 'database error'}`);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    const rule = rules.find((item) => item.id === ruleId);
    if (!rule) return;
    try {
      await requestApi(`/api/workspace/rules/${encodeURIComponent(ruleId)}?brand=${encodeURIComponent(rule.brand)}`, { method: 'DELETE' });
      await refreshWorkspace();
      showToast(`Deleted ${ruleId} from the database`);
    } catch (error) {
      showToast(`Rule was not deleted: ${error instanceof Error ? error.message : 'database error'}`);
    }
  };

  const handleSaveRule = async (savedRule: BrandRule) => {
    try {
      await requestApi(`/api/workspace/rules/${encodeURIComponent(savedRule.id)}`, {
        method: 'PUT',
        body: JSON.stringify(savedRule)
      });
      await refreshWorkspace();
      showToast(`Saved ${savedRule.id} to the database`);
    } catch (error) {
      showToast(`Rule was not saved: ${error instanceof Error ? error.message : 'database error'}`);
    }
  };

  const handleAddCampaign = async (newCampaign: CampaignPreset) => {
    try {
      await saveCampaign(newCampaign, 'POST');
      setActiveCampaignId(newCampaign.id);
      setActiveBrandId(newCampaign.brandId === 'global' ? (activeBrand?.id || '') : newCampaign.brandId);
      setIsUploadOpen(false);
      showToast(`Saved ${newCampaign.title} to the database`);
    } catch (error) {
      showToast(`Campaign was not saved: ${error instanceof Error ? error.message : 'database error'}`);
      throw error;
    }
  };

  const handleConfirmApproval = async () => {
    if (!approveData) return;
    const { campaign, caption, findings } = approveData;
    const clearedCount = findings.filter((finding) => finding.status !== 'open').length;
    const openCount = findings.length - clearedCount;
    const dossierNumber = `BRD-${Date.now()}`;
    const record: ReviewRecord = {
      id: `review-${Date.now()}`,
      dossierNumber,
      campaignTitle: campaign.title,
      brandId: campaign.brandId,
      brandName: campaign.brandName,
      channel: campaign.channel,
      reviewedAt: new Date().toISOString(),
      reviewerName: 'Reviewer not recorded',
      reviewerRole: '',
      auditId: '',
      sha256Hash: '',
      status: openCount ? 'conditional' : 'approved',
      findingsCount: findings.length,
      clearedCount,
      openCount,
      imageUrl: campaign.imageUrl,
      oldCopy: campaign.caption,
      newCopy: caption,
      findings,
      isDemo: Boolean(campaign.isDemo),
      notes: 'Review record created from the workspace.'
    };

    try {
      await saveCampaign({ ...campaign, caption, initialFindings: findings, status: openCount ? 'under_review' : 'approved' });
      await requestApi('/api/workspace/reviews', { method: 'POST', body: JSON.stringify(record) });
      await refreshWorkspace();
      setIsApproveOpen(false);
      setApproveData(null);
      setActiveTab('history');
      showToast(`Saved review ${dossierNumber}`);
    } catch (error) {
      showToast(`Review was not saved: ${error instanceof Error ? error.message : 'database error'}`);
    }
  };

  const handleConfirmDismiss = (_findingId: string, note: string) => {
    dismissAction?.(note);
    setDismissAction(null);
    setDismissFinding(null);
    showToast('Decision updated. Save and evaluate the campaign to keep it in the database.');
  };

  const handleOcrModalClose = async () => {
    try {
      await saveOcrText?.(ocrModalData.text);
      setIsOcrOpen(false);
      setSaveOcrText(null);
      showToast('Artwork text saved to the database');
    } catch (error) {
      showToast(`Artwork text was not saved: ${error instanceof Error ? error.message : 'database error'}`);
    }
  };

  const connected = Boolean(workspace?.connected && !connectionError);
  const recordCounts = {
    brands: brands.length,
    rules: rules.length,
    campaigns: campaigns.length,
    reviews: reviews.length
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans text-on-surface antialiased selection:bg-secondary-container selection:text-on-secondary-container">
      {toastMessage && (
        <div className="fixed top-22 right-4 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs border border-outline/30 animate-in fade-in slide-in-from-top-2 duration-150">
          <span className="material-symbols-outlined text-[16px] text-secondary-fixed">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <Header
        brands={brands}
        activeBrand={activeBrand}
        onSelectBrand={(brand) => {
          setActiveBrandId(brand.id);
          const firstCampaign = campaigns.find((campaign) => campaign.brandId === brand.id);
          if (firstCampaign) setActiveCampaignId(firstCampaign.id);
        }}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        databaseConnected={connected}
        onOpenDbStatus={() => setIsDbStatusOpen(true)}
      />

      {connectionError && (
        <div className="mx-auto mt-4 w-[calc(100%-2rem)] max-w-7xl rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex items-center justify-between gap-3">
          <span>{workspace ? 'Database connection lost. Showing the last records received.' : `Cannot load the workspace: ${connectionError}`}</span>
          <button type="button" onClick={() => void refreshWorkspace()} className="shrink-0 underline font-semibold">Retry</button>
        </div>
      )}

      <main className="flex-1 w-full pb-20 md:pb-12">
        {isLoading && !workspace ? (
          <div className="max-w-7xl mx-auto px-6 py-24 text-center text-on-surface-variant">Connecting to the database…</div>
        ) : !workspace ? (
          <section className="max-w-xl mx-auto px-6 py-24 text-center space-y-4">
            <span className="material-symbols-outlined text-error text-4xl">cloud_off</span>
            <h1 className="font-serif text-2xl text-primary">Database connection required</h1>
            <p className="text-sm text-on-surface-variant">The app did not load local or sample records. Check the server’s MongoDB connection, then try again.</p>
            <button type="button" onClick={() => void refreshWorkspace()} className="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold">Retry connection</button>
          </section>
        ) : (
          <>
            {activeTab === 'review' && (
              activeCampaign && activeBrand ? (
                <ReviewContent
                  activeBrand={activeBrand}
                  campaigns={campaigns.filter((campaign) => campaign.brandId === activeBrand.id || campaign.brandId === 'global')}
                  activeCampaign={activeCampaign}
                  onSelectCampaign={(campaign) => setActiveCampaignId(campaign.id)}
                  rules={rules}
                  onSaveCampaign={saveCampaign}
                  onOpenUpload={() => setIsUploadOpen(true)}
                  onOpenOcrText={(text, saveText) => {
                    setOcrModalData({ text });
                    setSaveOcrText(() => saveText);
                    setIsOcrOpen(true);
                  }}
                  onOpenApproveModal={(campaign, caption, findings) => {
                    setApproveData({ campaign, caption, findings });
                    setIsApproveOpen(true);
                  }}
                  onOpenDismissModal={(finding, applyDecision) => {
                    setDismissFinding(finding);
                    setDismissAction(() => applyDecision);
                  }}
                  onOpenPlannedModal={(title) => {
                    setPlannedTitle(title);
                    setIsPlannedOpen(true);
                  }}
                  onShowToast={showToast}
                />
              ) : (
                <section className="max-w-3xl mx-auto px-6 py-24 text-center space-y-3">
                  <span className="material-symbols-outlined text-secondary text-4xl">photo_library</span>
                  <h1 className="font-serif text-2xl text-primary">No campaign images in the database yet</h1>
                  <p className="text-sm text-on-surface-variant">Add a campaign record to the campaigns collection or run <code>npm run import:images</code> to add openly licensed reference images.</p>
                  {activeBrand && <button type="button" onClick={() => setIsUploadOpen(true)} className="mt-2 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold">Add your first campaign</button>}
                </section>
              )
            )}

            {activeTab === 'rules' && activeBrand && (
              <BrandRules
                brands={brands}
                activeBrand={activeBrand}
                onSelectBrand={(brand) => setActiveBrandId(brand.id)}
                rules={rules}
                onToggleRule={handleToggleRule}
                onDeleteRule={handleDeleteRule}
                onOpenNewRule={(rule) => {
                  setRuleToEdit(rule || null);
                  setIsNewRuleOpen(true);
                }}
                databaseConnected={connected}
              />
            )}

            {activeTab === 'rules' && !activeBrand && (
              <div className="max-w-3xl mx-auto px-6 py-24 text-center text-on-surface-variant">No brand records are available in MongoDB.</div>
            )}

            {activeTab === 'history' && <ReviewHistory reviews={reviews} />}

            {activeTab === 'insights' && (
              <InsightsAnalytics activeBrand={activeBrand} campaigns={campaigns} reviews={reviews} rules={rules} />
            )}
          </>
        )}
      </main>

      <Navigation activeTab={activeTab} onSelectTab={setActiveTab} />

      <OcrTextModal
        isOpen={isOcrOpen}
        onClose={() => void handleOcrModalClose()}
        ocrText={ocrModalData.text}
        onUpdateOcrText={(text) => setOcrModalData({ text })}
      />

      {activeBrand && (
      <UploadCreativeModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        brands={brands}
        activeBrand={activeBrand}
        onAddCampaign={handleAddCampaign}
      />
      )}

      {activeBrand && (
        <NewRuleModal
          isOpen={isNewRuleOpen}
          onClose={() => {
            setIsNewRuleOpen(false);
            setRuleToEdit(null);
          }}
          brands={brands}
          activeBrand={activeBrand}
          ruleToEdit={ruleToEdit}
          onSaveRule={handleSaveRule}
        />
      )}

      {approveData && (
        <ApproveExportModal
          isOpen={isApproveOpen}
          onClose={() => {
            setIsApproveOpen(false);
            setApproveData(null);
          }}
          campaign={approveData.campaign}
          caption={approveData.caption}
          findings={approveData.findings}
          onConfirmApproval={handleConfirmApproval}
        />
      )}

      <DismissNoteModal
        isOpen={Boolean(dismissFinding)}
        onClose={() => {
          setDismissFinding(null);
          setDismissAction(null);
        }}
        finding={dismissFinding}
        onConfirmDismiss={handleConfirmDismiss}
      />

      <DatabaseStatusModal
        isOpen={isDbStatusOpen}
        onClose={() => setIsDbStatusOpen(false)}
        connected={connected}
        database={workspace?.database || 'Unknown'}
        error={connectionError}
        lastUpdated={lastSync}
        counts={recordCounts}
        onRetry={() => void refreshWorkspace()}
      />

      <PlannedFeatureModal
        isOpen={isPlannedOpen}
        onClose={() => setIsPlannedOpen(false)}
        featureTitle={plannedTitle}
      />
    </div>
  );
}
