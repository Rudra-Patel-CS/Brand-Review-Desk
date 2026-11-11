import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EvidenceDocument,
  DEFAULT_EVIDENCE_LIBRARY,
  evidenceStatus,
  findEvidenceForClaim,
  summarizeClaimEvidence,
  parseEvidenceDate,
  formatEvidenceDate
} from '../src/utils/evidenceLibrary.js';

const NOW = new Date('2026-11-11T00:00:00Z');

function doc(partial: Partial<EvidenceDocument>): EvidenceDocument {
  return {
    id: 'EVD-TEST',
    brandId: 'freshbites',
    claimKeywords: ['organic'],
    title: 'Test Document',
    docType: 'certificate',
    ...partial
  };
}

test('fixture "current certificate": evidence expiring after the 30-day window is current', () => {
  assert.equal(evidenceStatus(doc({ expiresAt: '2026-12-31' }), NOW), 'current');
});

test('fixture "expiring certificate": evidence inside the 30-day window is expiring_soon', () => {
  assert.equal(evidenceStatus(doc({ expiresAt: '2026-11-20' }), NOW), 'expiring_soon');
});

test('fixture "expired report": evidence dated in the past is expired', () => {
  assert.equal(evidenceStatus(doc({ expiresAt: '2026-09-30' }), NOW), 'expired');
});

test('fixture "standing policy link": no expiry date means no_expiry, never expired', () => {
  assert.equal(evidenceStatus(doc({ expiresAt: null }), NOW), 'no_expiry');
  assert.equal(evidenceStatus(doc({}), NOW), 'no_expiry');
});

test('fixture "corrupted date": invalid date strings fall back to no_expiry instead of crashing', () => {
  assert.equal(evidenceStatus(doc({ expiresAt: 'not-a-date' }), NOW), 'no_expiry');
  assert.equal(parseEvidenceDate('garbage'), null);
  assert.equal(formatEvidenceDate('garbage'), '');
});

test('fixture "keyword match": claim text matches documents case-insensitively', () => {
  const library = DEFAULT_EVIDENCE_LIBRARY;
  const matches = findEvidenceForClaim('Cold-Pressed Organic', library);
  assert.ok(matches.some((d) => d.id === 'EVD-FB-ORGANIC-2026'));
});

test('fixture "unrelated claim": a claim with no library entry returns no documents', () => {
  const matches = findEvidenceForClaim('100% Detox miracle cleanse', DEFAULT_EVIDENCE_LIBRARY);
  assert.equal(matches.length, 0);
});

test('fixture "missing evidence summary": unmatched claims are flagged for human review', () => {
  const summary = summarizeClaimEvidence('100% Detox', DEFAULT_EVIDENCE_LIBRARY, NOW);
  assert.equal(summary.state, 'missing');
  assert.equal(summary.flaggedForHumanReview, true);
});

test('fixture "expired evidence summary": expired lab study is flagged for human review', () => {
  const summary = summarizeClaimEvidence('immunity in 24 hours', DEFAULT_EVIDENCE_LIBRARY, NOW);
  assert.equal(summary.state, 'expired');
  assert.equal(summary.flaggedForHumanReview, true);
});

test('fixture "current evidence summary": current certificate is not flagged', () => {
  const summary = summarizeClaimEvidence('Cold-Pressed Organic', DEFAULT_EVIDENCE_LIBRARY, NOW);
  assert.equal(summary.state, 'ok');
  assert.equal(summary.flaggedForHumanReview, false);
});

test('fixture "expiring evidence summary": battery report inside window surfaces expiring state', () => {
  const summary = summarizeClaimEvidence('30h playtime battery', DEFAULT_EVIDENCE_LIBRARY, NOW);
  assert.equal(summary.state, 'expiring');
  assert.equal(summary.flaggedForHumanReview, false);
});

test('fixture "empty claim": blank claim text yields missing, not a crash', () => {
  const summary = summarizeClaimEvidence('', DEFAULT_EVIDENCE_LIBRARY, NOW);
  assert.equal(summary.state, 'missing');
});
