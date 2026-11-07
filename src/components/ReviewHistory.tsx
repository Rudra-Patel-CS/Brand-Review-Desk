import React, { useState } from 'react';
import { ReviewRecord } from '../utils/rulesEngine.js';
import { downloadBlob } from '../utils/download.js';

interface ReviewHistoryProps {
  reviews: ReviewRecord[];
}

export const ReviewHistory: React.FC<ReviewHistoryProps> = ({ reviews }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'conditional' | 'rejected'>('all');
  const [selectedRecord, setSelectedRecord] = useState<ReviewRecord | null>(null);

  // Filter reviews
  const filtered = reviews.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        r.dossierNumber.toLowerCase().includes(q) ||
        r.campaignTitle.toLowerCase().includes(q) ||
        r.brandName.toLowerCase().includes(q) ||
        r.reviewerName.toLowerCase().includes(q) ||
        r.sha256Hash.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const sampleReviews = reviews.filter((review) => review.isSample);

  const handleDownloadDossier = (record: ReviewRecord) => {
    const dataStr = JSON.stringify(record, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    downloadBlob(blob, `dossier-${record.dossierNumber}.json`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* 1. Header Overview & Audit Metrics */}
      <section className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <h1 className="font-serif text-2xl sm:text-3xl font-medium text-primary tracking-tight">
              Compliance Review Archive
            </h1>
            <p className="text-xs text-on-surface-variant max-w-2xl leading-relaxed">
              {reviews.some((review) => review.isSample)
                ? 'Sample entries are illustrative, not verified legal decisions or immutable server records.'
                : 'Review history and exports reflect records available to this workspace; automated checks are not legal certification.'}
            </p>
          </div>
          <span className="font-mono text-xs text-secondary bg-surface-container-low px-3 py-1 rounded-lg border border-surface-container-high self-start sm:self-auto">
            {reviews.length} Dossiers Logged
          </span>
        </div>

        {/* Stats Summary Bento Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-surface-container-low p-3.5 rounded-xl border border-surface-container-high flex flex-col justify-center">
            <span className="font-mono text-[11px] text-on-surface-variant uppercase">Sample Records</span>
            <span className="font-serif text-2xl text-primary font-medium">{sampleReviews.length}</span>
            <span className="text-[11px] text-secondary font-medium mt-0.5">Illustrative only; not verified approvals</span>
          </div>

          <div className="bg-surface-container-low p-3.5 rounded-xl border border-surface-container-high flex flex-col justify-center">
            <span className="font-mono text-[11px] text-on-surface-variant uppercase">Avg Decision Time</span>
            <span className="font-serif text-2xl text-on-surface font-medium">Not measured</span>
            <span className="text-[11px] text-on-surface-variant mt-0.5">No timing data collected</span>
          </div>

          <div className="bg-surface-container-low p-3.5 rounded-xl border border-surface-container-high flex flex-col justify-center">
            <span className="font-mono text-[11px] text-on-surface-variant uppercase">Sample Escalations</span>
            <span className="font-serif text-2xl text-error font-medium">
              {sampleReviews.filter((r) => r.status === 'rejected' || r.status === 'conditional').length}
            </span>
            <span className="text-[11px] text-on-surface-variant mt-0.5">From illustrative sample records</span>
          </div>
        </div>
      </section>

      {/* 2. Interactive Search & Filtering Controls */}
      <section className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-sm space-y-3">
        <div className="relative flex items-center">
          <span className="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[20px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dossier number, campaign name, or reviewer..."
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-surface-container-low text-xs text-on-surface placeholder:text-outline border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 p-1 text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {/* Filter Matrix */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          {[
            { id: 'all', label: 'Status: All' },
            { id: 'approved', label: 'Approved Only' },
            { id: 'conditional', label: 'Conditional Waivers' },
            { id: 'rejected', label: 'Rejected / Halts' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id as any)}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors shadow-xs ${
                statusFilter === item.id
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-on-surface border border-surface-container-high'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* 3. Dossier Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((record) => {
          return (
            <article
              key={record.id}
              className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm overflow-hidden flex flex-col justify-between hover:border-primary/40 transition-all duration-150"
            >
              <div>
                {/* Artwork Preview Header */}
                <div className="relative w-full h-44 bg-surface-container-highest overflow-hidden">
                  <img
                    src={record.imageUrl}
                    alt={record.campaignTitle}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent flex items-end p-3">
                    <div className="flex items-center gap-1.5 bg-surface-container-lowest/90 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-mono shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                      <span className="font-bold text-primary">#{record.dossierNumber}</span>
                      <span className="text-on-surface-variant">• {record.brandName}</span>
                    </div>
                  </div>

                  <div className="absolute top-2.5 right-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold shadow-sm inline-flex items-center gap-1 ${
                        record.status === 'approved'
                          ? 'bg-secondary-container text-on-secondary-container'
                          : record.status === 'conditional'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-error-container text-on-error-container'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {record.status === 'approved'
                          ? 'verified'
                          : record.status === 'conditional'
                          ? 'warning'
                          : 'cancel'}
                      </span>
                      {record.status === 'approved'
                        ? 'Approved & Filed'
                        : record.status === 'conditional'
                        ? 'Conditional Pass'
                        : 'Rejected'}
                    </span>
                  </div>
                </div>

                {/* Content Details */}
                <div className="p-4 space-y-3">
                  <div>
                    <h2 className="font-serif text-lg font-medium text-on-surface leading-snug">
                      {record.campaignTitle}
                    </h2>
                    {record.isSample && (
                      <span className="inline-flex mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                        Illustrative sample
                      </span>
                    )}
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-on-surface-variant mt-0.5">
                      <span className="truncate">{record.channel}</span>
                      <span>•</span>
                      <span className="font-mono text-[11px]">{record.reviewedAt}</span>
                    </div>
                  </div>

                  {/* Reviewer Attribution */}
                  <div className="p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary flex-shrink-0">
                        <span className="material-symbols-outlined text-[16px]">gavel</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-on-surface truncate">{record.reviewerName}</span>
                        <span className="text-[10px] text-on-surface-variant truncate font-mono">
                          {record.auditId}
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-secondary text-[18px]">lock</span>
                  </div>

                  {/* Findings Tally */}
                  <div className="flex items-center justify-between text-xs text-on-surface-variant pt-1 border-t border-surface-container-high">
                    <span className="font-semibold">Findings Cleared</span>
                    <span className="font-mono text-secondary font-bold">
                      {record.clearedCount} of {record.findingsCount} Resolved
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(record)}
                  className="py-2 px-3 rounded-xl bg-primary text-on-primary text-xs font-semibold flex items-center justify-center gap-1 hover:bg-primary-container transition-colors shadow-xs"
                >
                  <span className="material-symbols-outlined text-[16px]">summarize</span>
                  Audit Proof
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadDossier(record)}
                  className="py-2 px-3 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold border border-surface-container-high flex items-center justify-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Export
                </button>
              </div>
            </article>
          );
        })}
      </section>

      {/* 4. Interactive Detail Drawer / Inspection Snippet Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-xl rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary">
                  <span className="material-symbols-outlined text-[18px]">verified_user</span>
                </div>
                <div>
                  <h3 className="font-serif text-lg font-medium text-on-surface">
                    Review Dossier #{selectedRecord.dossierNumber}
                  </h3>
                  <span className="font-mono text-xs text-secondary">
                    {selectedRecord.isSample
                      ? 'Illustrative sample · no cryptographic attestation'
                      : selectedRecord.isPublicDemo
                        ? 'Local SHA-256 digest · not server-attested'
                        : `SHA-256: ${selectedRecord.sha256Hash.slice(0, 20)}...`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Campaign Snapshot */}
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1">
                <div className="font-bold text-sm text-primary">{selectedRecord.campaignTitle}</div>
                <div className="text-on-surface-variant">
                  Brand: <strong className="text-on-surface">{selectedRecord.brandName}</strong> • Channel: {selectedRecord.channel}
                </div>
                <div className="text-on-surface-variant font-mono text-[11px]">
                  Timestamp: {selectedRecord.reviewedAt}
                </div>
              </div>

              {/* Copy Diff Inspection */}
              {selectedRecord.oldCopy && selectedRecord.newCopy && (
                <div className="space-y-1.5">
                  <span className="font-semibold text-on-surface-variant uppercase tracking-wider text-[11px] block">
                    Copy Diff Inspection (Redline):
                  </span>
                  <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high font-mono space-y-2">
                    <div className="text-error bg-error-container/40 p-2 rounded">
                      <span className="font-bold mr-1">- [ORIGINAL]:</span>
                      <span className="line-through">{selectedRecord.oldCopy}</span>
                    </div>
                    <div className="text-secondary bg-secondary-container/40 p-2 rounded">
                      <span className="font-bold mr-1">+ [REMEDIATED]:</span>
                      <span>{selectedRecord.newCopy}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Electronic Signature Attestation Block */}
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high space-y-2">
                <span className="font-semibold text-on-surface-variant uppercase tracking-wider text-[11px] block">
                  {selectedRecord.isSample ? 'Illustrative Sample Record' : 'Review Record'}
                </span>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-on-surface">{selectedRecord.reviewerName}</div>
                    <div className="text-on-surface-variant text-[11px]">{selectedRecord.reviewerRole}</div>
                  </div>
                  <span className="material-symbols-outlined text-secondary text-[26px]">draw</span>
                </div>
                <div className="pt-1 border-t border-surface-container-high flex items-center justify-between font-mono text-[11px] text-on-surface-variant">
                  <span>
                    {selectedRecord.isSample ? 'Sample ID' : 'Audit ID'}: {selectedRecord.auditId}
                  </span>
                  <span className="text-secondary font-bold">STATUS: {selectedRecord.status.toUpperCase()}</span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 bg-surface-container-low border-t border-surface-container-high flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => handleDownloadDossier(selectedRecord)}
                className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">cloud_download</span>
                Download Dossier (JSON)
              </button>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="px-3 py-1.5 rounded text-xs text-on-surface-variant hover:text-on-surface"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Honest record guidance */}
      <aside className="p-4 rounded-2xl bg-surface-container-lowest border border-surface-container-high flex items-center gap-3 shadow-xs">
        <span className="material-symbols-outlined text-secondary text-[24px]">info</span>
        <div className="text-xs">
          <span className="font-bold text-on-surface block">About these records</span>
          <span className="text-on-surface-variant">
            Sample entries are illustrative. Records created in the public demo exist only in the current browser session and are lost on refresh; they are not server-stored, cryptographically attested, or legal certification.
          </span>
        </div>
      </aside>
    </div>
  );
};
