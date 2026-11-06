import React, { useMemo, useState } from 'react';
import { ReviewRecord } from '../utils/rulesEngine.js';

interface ReviewHistoryProps {
  reviews: ReviewRecord[];
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export const ReviewHistory: React.FC<ReviewHistoryProps> = ({ reviews }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'conditional' | 'rejected'>('all');
  const [selectedRecord, setSelectedRecord] = useState<ReviewRecord | null>(null);
  const filtered = useMemo(() => reviews.filter((record) => {
    if (statusFilter !== 'all' && record.status !== statusFilter) return false;
    const query = searchQuery.trim().toLowerCase();
    return !query || [record.dossierNumber, record.campaignTitle, record.brandName, record.reviewerName]
      .some((value) => String(value || '').toLowerCase().includes(query));
  }), [reviews, searchQuery, statusFilter]);

  const downloadRecord = (record: ReviewRecord) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `review-${record.dossierNumber || record.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <section className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-medium text-primary tracking-tight">Review history</h1>
            <p className="text-xs text-on-surface-variant max-w-2xl leading-relaxed mt-1">Saved review records read from MongoDB. This archive does not create legal signatures or immutable audit logs.</p>
          </div>
          <span className="font-mono text-xs text-secondary bg-surface-container-low px-3 py-1 rounded-lg border border-surface-container-high">{reviews.length} records</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            ['Approved', reviews.filter((record) => record.status === 'approved').length],
            ['Conditional', reviews.filter((record) => record.status === 'conditional').length],
            ['Rejected', reviews.filter((record) => record.status === 'rejected').length]
          ].map(([label, count]) => <div key={label} className="bg-surface-container-low p-3 rounded-xl border border-surface-container-high"><div className="font-serif text-2xl text-primary">{count}</div><div className="text-[10px] uppercase tracking-wide text-on-surface-variant">{label}</div></div>)}
        </div>
      </section>

      <section className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high shadow-sm space-y-3">
        <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search campaign, brand, reviewer, or record ID…" className="w-full px-3 py-2 rounded-xl bg-surface-container-low text-xs border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary" />
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          {[
            { id: 'all', label: 'All records' }, { id: 'approved', label: 'Approved' }, { id: 'conditional', label: 'Conditional' }, { id: 'rejected', label: 'Rejected' }
          ].map((item) => <button key={item.id} type="button" onClick={() => setStatusFilter(item.id as typeof statusFilter)} className={`px-3 py-1 rounded-lg font-semibold ${statusFilter === item.id ? 'bg-primary text-on-primary' : 'bg-surface-container-low text-on-surface-variant border border-surface-container-high'}`}>{item.label}</button>)}
        </div>
      </section>

      {filtered.length ? (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((record) => (
            <article key={record.id} className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                <div className="relative w-full h-44 bg-surface-container-highest overflow-hidden">
                  {record.imageUrl ? <img src={record.imageUrl} alt={record.campaignTitle} loading="lazy" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-on-surface-variant"><span className="material-symbols-outlined text-4xl">image</span></div>}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10 flex items-end justify-between gap-2">
                    <span className="bg-surface-container-lowest/90 px-2 py-1 rounded text-[11px] font-mono text-primary">{record.dossierNumber || record.id}</span>
                    {record.isDemo && <span className="bg-amber-100 text-amber-950 px-2 py-1 rounded text-[10px] font-semibold">Sample data</span>}
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div>
                    <h2 className="font-serif text-lg font-medium text-on-surface leading-snug">{record.campaignTitle}</h2>
                    <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-1"><span>{record.brandName}</span><span>·</span><span>{record.channel}</span></div>
                    <div className="text-[11px] text-on-surface-variant mt-1">{record.reviewedAt ? formatDate(record.reviewedAt) : 'Time not recorded'}</div>
                  </div>
                  <div className="flex items-center justify-between text-xs border-t border-surface-container-high pt-2">
                    <span className="text-on-surface-variant">Findings resolved</span>
                    <span className="font-mono text-on-surface font-semibold">{record.clearedCount || 0} of {record.findingsCount || 0}</span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant">Reviewer: {record.reviewerName || 'Not recorded'}</div>
                </div>
              </div>
              <div className="p-4 pt-0 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setSelectedRecord(record)} className="py-2 px-3 rounded-xl bg-primary text-on-primary text-xs font-semibold flex items-center justify-center gap-1"><span className="material-symbols-outlined text-[16px]">summarize</span>View record</button>
                <button type="button" onClick={() => downloadRecord(record)} className="py-2 px-3 rounded-xl bg-surface-container-low text-on-surface text-xs font-semibold border border-surface-container-high flex items-center justify-center gap-1"><span className="material-symbols-outlined text-[16px]">download</span>Export JSON</button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="bg-surface-container-lowest p-10 rounded-2xl border border-dashed border-surface-container-high text-center">
          <span className="material-symbols-outlined text-secondary text-4xl">history</span>
          <h2 className="font-serif text-xl text-primary mt-2">No review records found</h2>
          <p className="text-xs text-on-surface-variant mt-1">Records saved through the review flow will appear here.</p>
        </section>
      )}

      {selectedRecord && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-xl rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
              <div><h3 className="font-serif text-lg font-medium text-on-surface">Review record {selectedRecord.dossierNumber}</h3><span className="font-mono text-xs text-on-surface-variant">{selectedRecord.status}</span></div>
              <button type="button" onClick={() => setSelectedRecord(null)} aria-label="Close" className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">close</span></button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high space-y-1"><div className="font-bold text-sm text-primary">{selectedRecord.campaignTitle}</div><div>Brand: <strong>{selectedRecord.brandName}</strong> · Channel: {selectedRecord.channel}</div><div>Reviewed at: {selectedRecord.reviewedAt ? formatDate(selectedRecord.reviewedAt) : 'Not recorded'}</div></div>
              {(selectedRecord.oldCopy || selectedRecord.newCopy) && <div className="space-y-2"><strong>Copy stored with this review</strong><div className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high space-y-2"><div><span className="text-on-surface-variant">Previous:</span> {selectedRecord.oldCopy || '—'}</div><div><span className="text-on-surface-variant">Saved:</span> {selectedRecord.newCopy || '—'}</div></div></div>}
              <div className="space-y-2"><strong>Findings ({selectedRecord.findings?.length || 0})</strong>{selectedRecord.findings?.length ? selectedRecord.findings.map((finding) => <div key={finding.id} className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high"><div className="font-semibold">{finding.ruleTitle} <span className="font-mono text-on-surface-variant">{finding.ruleId}</span></div><div>Matched: “{finding.matchedText}” · {finding.status}</div>{finding.dismissNote && <div className="mt-1">Note: {finding.dismissNote}</div>}</div>) : <p className="text-on-surface-variant">No finding details were saved.</p>}</div>
              {selectedRecord.notes && <div className="p-3 rounded-lg bg-surface-container-low border border-surface-container-high"><strong>Notes:</strong> {selectedRecord.notes}</div>}
              <div className="text-on-surface-variant">Reviewer: {selectedRecord.reviewerName || 'Not recorded'}{selectedRecord.reviewerRole ? ` · ${selectedRecord.reviewerRole}` : ''}</div>
            </div>
            <div className="px-5 py-3.5 bg-surface-container-low border-t border-surface-container-high flex justify-between gap-2">
              <button type="button" onClick={() => downloadRecord(selectedRecord)} className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-semibold">Download JSON</button>
              <button type="button" onClick={() => setSelectedRecord(null)} className="px-3 py-1.5 rounded text-xs text-on-surface-variant">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
