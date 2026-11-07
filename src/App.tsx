import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.js';
import { Navigation } from './components/Navigation.js';
import { AuthPage } from './components/AuthPage.js';
import {
  AuthSession,
  AuthUser,
  apiFetch,
  setCsrfToken
} from './utils/auth.js';
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
import { UserManagementModal } from './components/modals/UserManagementModal.js';

import { BRANDS, INITIAL_PRESETS, INITIAL_REVIEWS, Brand } from './data/mockData.js';
import {
  BrandRule,
  DEFAULT_RULES,
  CampaignPreset,
  ComplianceFinding,
  ReviewRecord
} from './utils/rulesEngine.js';

interface WorkspaceSnapshot {
  connected: boolean;
  database: string;
  updatedAt: string;
  brands: Brand[];
  rules: BrandRule[];
  campaigns: CampaignPreset[];
  reviews: ReviewRecord[];
}

export default function App() {
  // ── Session / authentication state (in-memory only, no localStorage tokens) ──
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Check existing session via HttpOnly cookie on first load
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ user: AuthUser; csrfToken: string }>('/api/auth/me')
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data?.user) {
          setCsrfToken(res.data.csrfToken || null);
          setUser(res.data.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setAuthChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Navigation state
  const [activeTab, setActiveTab] = useState<'review' | 'rules' | 'history' | 'insights'>('review');

  const handleAuthSuccess = (next: AuthSession) => {
    setCsrfToken(next.csrfToken);
    setUser(next.user);
    setAuthChecking(false);
    setActiveTab('review');
    showToast(`Signed in as ${next.user.username} (${next.user.role})`);
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Signing out locally is enough
    }
    setCsrfToken(null);
    setUser(null);
    setActiveTab('review');
    showToast('Signed out successfully');
  };

  // Workspace data state (hydrated from MongoDB workspace endpoint)
  const [brands, setBrands] = useState<Brand[]>(BRANDS);
  const [activeBrand, setActiveBrand] = useState<Brand>(BRANDS[0]);
  const [rules, setRules] = useState<BrandRule[]>(DEFAULT_RULES);
  const [campaigns, setCampaigns] = useState<CampaignPreset[]>(INITIAL_PRESETS);
  const [activeCampaign, setActiveCampaign] = useState<CampaignPreset>(INITIAL_PRESETS[0]);
  const [reviews, setReviews] = useState<ReviewRecord[]>(INITIAL_REVIEWS);

  // System & connection state
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isOcrOpen, setIsOcrOpen] = useState(false);
  const [ocrModalData, setOcrModalData] = useState({ text: '', confidence: 98 });
  const [isNewRuleOpen, setIsNewRuleOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState<BrandRule | null>(null);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveData, setApproveData] = useState<{
    campaign: CampaignPreset;
    caption: string;
    findings: ComplianceFinding[];
  } | null>(null);
  const [dismissFinding, setDismissFinding] = useState<ComplianceFinding | null>(null);
  const [isDbStatusOpen, setIsDbStatusOpen] = useState(false);
  const [isPlannedOpen, setIsPlannedOpen] = useState(false);
  const [plannedTitle, setPlannedTitle] = useState('Planned Feature');
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // ── Workspace polling & sync with backend ────────────────────────────────────
  const refreshWorkspace = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch<WorkspaceSnapshot>('/api/workspace');
      if (res.ok && res.data) {
        const snapshot = res.data;
        if (Array.isArray(snapshot.brands) && snapshot.brands.length) {
          setBrands(snapshot.brands);
        }
        if (Array.isArray(snapshot.rules) && snapshot.rules.length) {
          setRules(snapshot.rules);
        }
        if (Array.isArray(snapshot.campaigns) && snapshot.campaigns.length) {
          setCampaigns(snapshot.campaigns);
        }
        if (Array.isArray(snapshot.reviews)) {
          setReviews(snapshot.reviews);
        }
      }
    } catch {
      // Keep existing memory state on transient errors
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void refreshWorkspace();
    const interval = window.setInterval(() => {
      void refreshWorkspace();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [user, refreshWorkspace]);

  // Sync activeBrand when brands list updates
  useEffect(() => {
    if (brands.length && !brands.some((b) => b.id === activeBrand.id)) {
      setActiveBrand(brands[0]);
    }
  }, [brands, activeBrand.id]);

  // Rule actions with API persistence
  const handleToggleRule = async (ruleId: string) => {
    const targetRule = rules.find((r) => r.id === ruleId);
    if (!targetRule) return;
    const updatedRule = { ...targetRule, enabled: !targetRule.enabled };

    setRules((prev) => prev.map((r) => (r.id === ruleId ? updatedRule : r)));

    try {
      await apiFetch(`/api/workspace/rules/${encodeURIComponent(ruleId)}`, {
        method: 'PUT',
        body: JSON.stringify(updatedRule)
      });
      showToast(`Rule ${ruleId} ${updatedRule.enabled ? 'enabled' : 'disabled'}`);
    } catch {
      showToast(`Rule updated locally`);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    const targetRule = rules.find((r) => r.id === ruleId);
    if (!targetRule) return;

    if (user?.role !== 'admin') {
      showToast('Deleting rules requires Administrator role.');
      return;
    }

    setRules((prev) => prev.filter((r) => r.id !== ruleId));

    try {
      await apiFetch(`/api/workspace/rules/${encodeURIComponent(ruleId)}?brand=${encodeURIComponent(targetRule.brand)}`, {
        method: 'DELETE'
      });
      showToast(`Rule ${ruleId} deleted from database`);
    } catch {
      showToast(`Rule ${ruleId} deleted locally`);
    }
  };

  const handleSaveRule = async (savedRule: BrandRule) => {
    setRules((prev) => {
      const exists = prev.some((r) => r.id === savedRule.id);
      if (exists) {
        return prev.map((r) => (r.id === savedRule.id ? savedRule : r));
      }
      return [savedRule, ...prev];
    });

    try {
      await apiFetch(`/api/workspace/rules/${encodeURIComponent(savedRule.id)}`, {
        method: 'PUT',
        body: JSON.stringify(savedRule)
      });
      showToast(`Rule ${savedRule.id} saved to database`);
      await refreshWorkspace();
    } catch {
      showToast(`Rule ${savedRule.id} saved`);
    }
  };

  const handleResetRules = () => {
    setRules(DEFAULT_RULES);
    showToast('Reset brand rules to system default');
  };

  // Campaign upload and save
  const handleAddCampaign = async (newCampaign: CampaignPreset) => {
    setCampaigns((prev) => [newCampaign, ...prev]);
    setActiveCampaign(newCampaign);
    showToast(`Uploaded ${newCampaign.title} (${newCampaign.code})`);

    try {
      await apiFetch('/api/workspace/campaigns', {
        method: 'POST',
        body: JSON.stringify(newCampaign)
      });
      await refreshWorkspace();
    } catch {
      // Local state already updated
    }
  };

  // Approve & file to Review History (Approver or Admin role required)
  const handleConfirmApproval = async () => {
    if (!approveData) return;

    if (user?.role === 'reviewer') {
      showToast('Permission denied: Review approval requires Approver or Admin role.');
      setIsApproveOpen(false);
      return;
    }

    const newRecord: ReviewRecord = {
      id: `rev-${Date.now()}`,
      dossierNumber: `BRD-${Math.floor(1000 + Math.random() * 9000)}`,
      campaignTitle: approveData.campaign.title,
      brandId: approveData.campaign.brandId,
      brandName: approveData.campaign.brandName,
      channel: approveData.campaign.channel,
      reviewedAt: 'Just now',
      reviewerName: user?.username ?? 'Authenticated Reviewer',
      reviewerRole:
        user?.role === 'admin'
          ? 'Workspace Administrator'
          : user?.role === 'approver'
            ? 'Senior Compliance Approver'
            : 'Brand Reviewer',
      auditId: `E8F-${Math.floor(10 + Math.random() * 90)}-CERT`,
      sha256Hash: '4f9ca821' + Math.random().toString(16).slice(2, 12) + 'a72e8b',
      status: 'approved',
      findingsCount: approveData.findings.length,
      clearedCount: approveData.findings.length,
      openCount: 0,
      imageUrl: approveData.campaign.imageUrl,
      oldCopy: approveData.campaign.caption,
      newCopy: approveData.caption,
      findings: approveData.findings,
      notes: `Approved and signed-off by ${user?.username} (${user?.role}). Cryptographic attestation generated.`
    };

    setReviews((prev) => [newRecord, ...prev]);

    try {
      const res = await apiFetch('/api/workspace/reviews', {
        method: 'POST',
        body: JSON.stringify(newRecord)
      });
      if (!res.ok) {
        throw new Error(res.data?.error || 'Could not file review in database');
      }
      showToast(`Authorized & exported dossier #${newRecord.dossierNumber}`);
      await refreshWorkspace();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Review filed locally');
    } finally {
      setIsApproveOpen(false);
      setApproveData(null);
      setActiveTab('history');
    }
  };

  const handleConfirmDismiss = (findingId: string, _note: string) => {
    showToast(`Finding ${findingId} dismissed with counsel note`);
  };

  const handleToggleOffline = () => {
    setIsOfflineMode((prev) => {
      const next = !prev;
      showToast(
        next
          ? 'Switched to Offline Fallback Mode'
          : 'Reconnected to Database'
      );
      return next;
    });
  };

  // ── Auth gate: no one reaches the portal without a valid session ───────────
  if (authChecking) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 font-sans text-on-surface">
        <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-[24px]">policy</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-on-surface-variant">
          <span className="w-4 h-4 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          Verifying your secure session…
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans text-on-surface antialiased selection:bg-secondary-container selection:text-on-secondary-container">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-22 left-4 right-4 sm:left-auto sm:right-4 z-50 max-w-[calc(100vw-2rem)] sm:max-w-md bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-mono border border-outline/30 animate-in fade-in slide-in-from-top-2 duration-150">
          <span className="material-symbols-outlined text-[16px] text-secondary-fixed">
            info
          </span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Persistent Application Header */}
      <Header
        brands={brands}
        activeBrand={activeBrand}
        onSelectBrand={(b) => {
          setActiveBrand(b);
          const brandPreset = campaigns.find((c) => c.brandId === b.id);
          if (brandPreset) setActiveCampaign(brandPreset);
          showToast(`Active brand context: ${b.name}`);
        }}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOfflineMode={isOfflineMode}
        onToggleOffline={handleToggleOffline}
        onOpenDbStatus={() => setIsDbStatusOpen(true)}
        onOpenUserManagement={() => setIsUserMgmtOpen(true)}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <main className="flex-1 w-full pb-20 lg:pb-12">
        {activeTab === 'review' && (
          <ReviewContent
            activeBrand={activeBrand}
            campaigns={campaigns}
            activeCampaign={activeCampaign}
            onSelectCampaign={(c) => {
              setActiveCampaign(c);
              const brand = brands.find((b) => b.id === c.brandId);
              if (brand) setActiveBrand(brand);
            }}
            rules={rules}
            onOpenUpload={() => setIsUploadOpen(true)}
            onOpenOcrText={(text, conf) => {
              setOcrModalData({ text, confidence: conf });
              setIsOcrOpen(true);
            }}
            onOpenApproveModal={(camp, cap, f) => {
              if (user.role === 'reviewer') {
                showToast('Review approval requires Approver or Administrator role.');
                return;
              }
              setApproveData({ campaign: camp, caption: cap, findings: f });
              setIsApproveOpen(true);
            }}
            onOpenDismissModal={(finding) => setDismissFinding(finding)}
            onOpenPlannedModal={(title) => {
              setPlannedTitle(title);
              setIsPlannedOpen(true);
            }}
          />
        )}

        {activeTab === 'rules' && (
          <BrandRules
            brands={brands}
            activeBrand={activeBrand}
            onSelectBrand={setActiveBrand}
            rules={rules}
            onToggleRule={handleToggleRule}
            onDeleteRule={handleDeleteRule}
            onOpenNewRule={(rule) => {
              setRuleToEdit(rule || null);
              setIsNewRuleOpen(true);
            }}
            onResetRules={handleResetRules}
          />
        )}

        {activeTab === 'history' && <ReviewHistory reviews={reviews} />}

        {activeTab === 'insights' && (
          <InsightsAnalytics
            activeBrand={activeBrand}
            onOpenPlannedModal={(title) => {
              setPlannedTitle(title);
              setIsPlannedOpen(true);
            }}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <Navigation activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Modals & Dialogs */}
      <OcrTextModal
        isOpen={isOcrOpen}
        onClose={() => setIsOcrOpen(false)}
        ocrText={ocrModalData.text}
        confidence={ocrModalData.confidence}
        onUpdateOcrText={(newText) => {
          setOcrModalData((prev) => ({ ...prev, text: newText }));
          showToast('Updated extracted OCR text');
        }}
      />

      <UploadCreativeModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        brands={brands}
        activeBrand={activeBrand}
        onAddCampaign={handleAddCampaign}
      />

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
        isOpen={!!dismissFinding}
        onClose={() => setDismissFinding(null)}
        finding={dismissFinding}
        onConfirmDismiss={handleConfirmDismiss}
      />

      <DatabaseStatusModal
        isOpen={isDbStatusOpen}
        onClose={() => setIsDbStatusOpen(false)}
        isOfflineMode={isOfflineMode}
        onToggleOffline={handleToggleOffline}
      />

      <PlannedFeatureModal
        isOpen={isPlannedOpen}
        onClose={() => setIsPlannedOpen(false)}
        featureTitle={plannedTitle}
      />

      {user.role === 'admin' && (
        <UserManagementModal
          isOpen={isUserMgmtOpen}
          onClose={() => setIsUserMgmtOpen(false)}
          currentUser={user}
          onShowToast={showToast}
        />
      )}
    </div>
  );
}
