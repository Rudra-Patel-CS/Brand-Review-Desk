import React, { useState, useEffect } from 'react';
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

import { BRANDS, INITIAL_PRESETS, INITIAL_REVIEWS, Brand } from './data/mockData.js';
import {
  BrandRule,
  DEFAULT_RULES,
  CampaignPreset,
  ComplianceFinding,
  ReviewRecord
} from './utils/rulesEngine.js';

export default function App() {
  // Navigation state
  const [activeTab, setActiveTab] = useState<'review' | 'rules' | 'history' | 'insights'>('review');

  // Brand state
  const [brands] = useState<Brand[]>(BRANDS);
  const [activeBrand, setActiveBrand] = useState<Brand>(BRANDS[0]);

  // Brand Rules state (hydrated from localStorage or default)
  const [rules, setRules] = useState<BrandRule[]>(() => {
    try {
      const saved = localStorage.getItem('brd_brand_rules');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_RULES;
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
      reviewerName: 'Elena Rostova, JD',
      reviewerRole: 'Senior Brand Counsel, Global Food Group',
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
      notes: 'Approved without objections by Elena Rostova. Cryptographic attestation generated.'
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

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans text-on-surface antialiased selection:bg-secondary-container selection:text-on-secondary-container">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-22 right-4 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs font-mono border border-outline/30 animate-in fade-in slide-in-from-top-2 duration-150">
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
      />

      {/* Main View Area */}
      <main className="flex-1 w-full pb-20 md:pb-12">
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
