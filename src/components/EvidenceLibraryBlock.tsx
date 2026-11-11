import React from 'react';
import { ComplianceFinding } from '../utils/rulesEngine.js';
import {
  EvidenceDocument,
  evidenceStatus,
  findEvidenceForClaim,
  formatEvidenceDate
} from '../utils/evidenceLibrary.js';

interface EvidenceLibraryBlockProps {
  finding: ComplianceFinding;
  library: EvidenceDocument[];
}

const DOC_ICONS: Record<EvidenceDocument['docType'], string> = {
  certificate: 'workspace_premium',
  lab_report: 'lab_profile',
  policy: 'policy',
  license: 'badge',
  terms: 'gavel',
  registration: 'app_registration'
};

function StatusBadge({ doc }: { doc: EvidenceDocument }) {
  const status = evidenceStatus(doc);
  if (status === 'expired') {
    return (
      <span className="px-1.5 py-0.5 rounded bg-error-container text-on-error-container font-mono text-[10px] font-bold shrink-0">
        Expired {formatEvidenceDate(doc.expiresAt)}
      </span>
    );
  }
  if (status === 'expiring_soon') {
    return (
      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold shrink-0">
        Expiring {formatEvidenceDate(doc.expiresAt)}
      </span>
    );
  }
  if (status === 'current') {
    return (
      <span className="px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-mono text-[10px] font-bold shrink-0">
        Expires {formatEvidenceDate(doc.expiresAt)}
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-mono text-[10px] font-bold shrink-0">
      No expiry
    </span>
  );
}

/**
 * Evidence Library block rendered inside a finding card, under the action
 * buttons. Links the flagged claim to substantiation documents and flags
 * missing or expired evidence for human review before approval.
 */
export const EvidenceLibraryBlock: React.FC<EvidenceLibraryBlockProps> = ({ finding, library }) => {
  const claimText = `${finding.matchedText} ${finding.ruleTitle}`;
  const docs = findEvidenceForClaim(claimText, library);
  const hasExpired = docs.some((d) => evidenceStatus(d) === 'expired');

  return (
    <div className="mt-3 pt-2.5 border-t border-surface-container-high space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          <span className="material-symbols-outlined text-[14px] text-secondary">inventory_2</span>
          Evidence Library
        </span>
        <span className="font-mono text-[10px] text-on-surface-variant">
          {docs.length} record{docs.length === 1 ? '' : 's'}
        </span>
      </div>

      {docs.length === 0 ? (
        <div className="p-2.5 rounded-lg border border-dashed border-amber-500/70 bg-amber-500/5 flex items-start gap-2">
          <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0 mt-0.5">folder_off</span>
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-amber-900">
                No evidence on file for “{finding.matchedText}”
              </span>
              <span className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 font-mono text-[10px] font-bold">
                Missing
              </span>
            </div>
            <p className="text-[10px] text-amber-900/80 leading-relaxed">
              Flagged for human review before approval — this claim cannot be auto-cleared without a substantiation record.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-surface-container-low border border-surface-container-high"
            >
              <span className="material-symbols-outlined text-[16px] text-secondary shrink-0">
                {DOC_ICONS[doc.docType] || 'description'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {doc.url ? (
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-secondary hover:text-primary underline truncate"
                    >
                      {doc.title}
                    </a>
                  ) : (
                    <span className="text-[11px] font-semibold text-on-surface truncate">{doc.title}</span>
                  )}
                  <StatusBadge doc={doc} />
                </div>
                {doc.reference && (
                  <span className="block font-mono text-[10px] text-on-surface-variant truncate">
                    {doc.reference}
                  </span>
                )}
              </div>
            </div>
          ))}
          {hasExpired && (
            <p className="text-[10px] text-error font-semibold flex items-center gap-1 pt-0.5">
              <span className="material-symbols-outlined text-[13px]">flag</span>
              Expired evidence — flagged for human review before approval.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
