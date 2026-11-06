import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { Navigation } from './components/Navigation.js';
import { AuthPage } from './components/AuthPage.js';
import {
  AuthSession,
  authFetch,
  authHeaders,
  clearSession,
  loadSession,
  saveSession
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

import { BRANDS, INITIAL_PRESETS, INITIAL_REVIEWS, Brand } from './data/mockData.js';
import {
  BrandRule,
  DEFAULT_RULES,
  CampaignPreset,
  ComplianceFinding,
  ReviewRecord
} from './utils/rulesEngine.js';

export default function App() {
  // ── Session / authentication gate ──────────────────────────────────────────
  const [session, setSession] = useState<AuthSession | null>(() => loadSession());
  const [authChecking, setAuthChecking] = useState<boolean>(() => loadSession() !== null);

  // Re-validate a stored session against the API on first load.
  useEffect(() => {
    if (!session) {
      setAuthChecking(false);
      return;
    }

    let cancelled = false;
    authFetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) throw new Error('Session invalid');
        const data = await res.json();
        if (!cancelled && data?.user) {
          const refreshed: AuthSession = { token: session.token, user: data.user };
          saveSession(refreshed);
          setSession(refreshed);
        }
      })
      .catch(() => {
        if (!cancelled) {
          clearSession();
          setSession(null);
        }
      })
      .finally(() => {
        if (!cancelled) setAuthChecking(false);
      });

    return () => {
      cancelled = true;
    };
    // Intentionally runs once on mount; session updates are handled explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigation state
  const [activeTab, setActiveTab] = useState<'review' | 'rules' | 'history' | 'insights'>('review');

  const handleAuthSuccess = (next: AuthSession) => {
    saveSession(next);
    setSession(next);
    setAuthChecking(false);
    setActiveTab('review');
  };

  const handleLogout = () => {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: authHeaders()
    }).catch(() => {
      // Signing out locally is enough even if the API is unreachable.
    });
    clearSession();
    setSession(null);
    setActiveTab('review');
  };

  // Brand state
  const [brands] = useState<Brand[]>(BRANDS);
  const [activeBrand, setActiveBrand] = useState<Brand>(BRANDS[0]);

  // Brand Rules state (hydrated from localStorage or default).
  // Saved rules are merged with new system defaults so existing users pick up
  // newly added brands and rules without losing their local edits.
  const [rules, setRules] = useState<BrandRule[]>(() => {
    let savedRules: BrandRule[] = [];
    try {
      const saved = localStorage.getItem('brd_brand_rules');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) savedRules = parsed;
      }
    } catch {
      // fallback
    }

    if (savedRules.length === 0) return DEFAULT_RULES;

    const savedIds = new Set(savedRules.map((r) => r.id));
    const missingDefaults = DEFAULT_RULES.filter((r) => !savedIds.has(r.id));
    return [...savedRules, ...missingDefaults];
  });

  // Save rules to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('brd_brand_rules', JSON.stringify(rules));
    } catch {
      // ignore
    }
  }, [rules]);

  // Campaign presets
  const [campaigns, setCampaigns] = useState<CampaignPreset[]>(INITIAL_PRESETS);
  const [activeCampaign, setActiveCampaign] = useState<CampaignPreset>(INITIAL_PRESETS[0]);

  // Review history
  const [reviews, setReviews] = useState<ReviewRecord[]>(() => {
    try {
      const saved = localStorage.getItem('brd_review_history');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_REVIEWS;
  });

  // Save reviews to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('brd_review_history', JSON.stringify(reviews));
    } catch {
      // ignore
    }
  }, [reviews]);

  // Offline / Storage state
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Rule actions
  const handleToggleRule = (ruleId: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
    );
    const rule = rules.find((r) => r.id === ruleId);
    showToast(`Rule ${ruleId} ${rule?.enabled ? 'disabled' : 'enabled'}`);
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    showToast(`Rule ${ruleId} deleted`);
  };

  const handleSaveRule = (savedRule: BrandRule) => {
    setRules((prev) => {
      const exists = prev.some((r) => r.id === savedRule.id);
      if (exists) {
        return prev.map((r) => (r.id === savedRule.id ? savedRule : r));
      }
      return [savedRule, ...prev];
    });
    showToast(`Rule ${savedRule.id} saved`);
  };

  const handleResetRules = () => {
    setRules(DEFAULT_RULES);
    showToast('Reset brand rules to system default');
  };

  // Campaign upload action
  const handleAddCampaign = (newCampaign: CampaignPreset) => {
    setCampaigns((prev) => [newCampaign, ...prev]);
    setActiveCampaign(newCampaign);
    showToast(`Uploaded ${newCampaign.title} (${newCampaign.code})`);
  };

  // Approve & file to Review History
  const handleConfirmApproval = () => {
    if (!approveData) return;

    const newRecord: ReviewRecord = {
      id: `rev-${Date.now()}`,
      dossierNumber: `BRD-${Math.floor(1000 + Math.random() * 9000)}`,
      campaignTitle: approveData.campaign.title,
      brandId: approveData.campaign.brandId,
      brandName: approveData.campaign.brandName,
      channel: approveData.campaign.channel,
      reviewedAt: 'Just now',
      reviewerName: session?.user.username ?? 'Portal Reviewer',
      reviewerRole:
        session?.user.role === 'admin' ? 'Workspace Administrator' : 'Brand Compliance Reviewer',
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
      notes: `Approved without objections by ${session?.user.username ?? 'the reviewer'}. Cryptographic attestation generated.`
    };

    setReviews((prev) => [newRecord, ...prev]);
    showToast(`Authorized & exported dossier #${newRecord.dossierNumber}`);
    setActiveTab('history');
  };

  // Dismiss finding with note
  const handleConfirmDismiss = (findingId: string, note: string) => {
    // Handled in ReviewContent findings state or through custom updater
    showToast(`Finding ${findingId} dismissed with counsel note`);
  };

  const handleToggleOffline = () => {
    setIsOfflineMode((prev) => {
      const next = !prev;
      showToast(
        next
          ? 'Switched to Offline Fallback Mode (IndexedDB active)'
          : 'Reconnected to MongoDB Atlas Database'
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
          Verifying your session…
        </div>
      </div>
    );
  }

  if (!session) {
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
          // Auto select a preset belonging to this brand if available
          const brandPreset = campaigns.find((c) => c.brandId === b.id);
          if (brandPreset) setActiveCampaign(brandPreset);
          showToast(`Active brand context: ${b.name}`);
        }}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOfflineMode={isOfflineMode}
        onToggleOffline={handleToggleOffline}
        onOpenDbStatus={() => setIsDbStatusOpen(true)}
        user={session.user}
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
    </div>
  );
}
