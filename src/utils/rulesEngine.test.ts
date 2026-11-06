import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RULES,
  runComplianceAudit,
  calculateComplianceScore,
  applyCorrectionToCaption,
  filterBrandRules
} from './rulesEngine.js';

test('runComplianceAudit identifies critical detox claim in caption', () => {
  const caption = 'Revive your day with 100% Detox cold-pressed glow!';
  const ocrText = 'REVIVE AVOCADO GLOW Organic';
  const findings = runComplianceAudit(caption, ocrText, DEFAULT_RULES, 'freshbites');

  const detoxFinding = findings.find(f => f.ruleId === 'FB-012');
  assert.ok(detoxFinding, 'FB-012 rule should trigger');
  assert.equal(detoxFinding.severity, 'critical');
  assert.equal(detoxFinding.source, 'caption');
});

test('runComplianceAudit detects time-bound efficacy warning', () => {
  const caption = 'Supercharge your immunity in 24 hours with our special blend.';
  const ocrText = '100% Raw';
  const findings = runComplianceAudit(caption, ocrText, DEFAULT_RULES, 'freshbites');

  const timeFinding = findings.find(f => f.ruleId === 'FB-028');
  assert.ok(timeFinding, 'FB-028 should trigger');
  assert.equal(timeFinding.severity, 'warning');
});

test('calculateComplianceScore accurately penalizes unresolved issues and changes status', () => {
  const mockFindings: Array<{
    id: string;
    ruleId: string;
    ruleTitle: string;
    matchedText: string;
    severity: 'critical' | 'warning' | 'advisory';
    source: 'caption' | 'ocr' | 'both';
    ruleSource: string;
    explanation: string;
    status: 'open' | 'applied' | 'dismissed' | 'manual_reviewed';
  }> = [
    {
      id: '1',
      ruleId: 'FB-012',
      ruleTitle: 'Detox Claim',
      matchedText: '100% Detox',
      severity: 'critical',
      source: 'caption',
      ruleSource: 'FDA',
      explanation: 'No detox claims',
      status: 'open'
    },
    {
      id: '2',
      ruleId: 'FB-028',
      ruleTitle: 'Time Claim',
      matchedText: 'in 24 hours',
      severity: 'warning',
      source: 'caption',
      ruleSource: 'NAD',
      explanation: 'No time claims',
      status: 'open'
    }
  ];

  const scoreBefore = calculateComplianceScore(mockFindings);
  assert.equal(scoreBefore.status, 'critical');
  assert.equal(scoreBefore.criticalOpen, 1);
  assert.equal(scoreBefore.warningOpen, 1);
  assert.equal(scoreBefore.score, 50); // 100 - 35 - 15 = 50

  // Resolve the critical issue
  mockFindings[0].status = 'applied';
  const scoreAfter = calculateComplianceScore(mockFindings);
  assert.equal(scoreAfter.status, 'action_required');
  assert.equal(scoreAfter.criticalOpen, 0);
  assert.equal(scoreAfter.totalResolved, 1);
  assert.equal(scoreAfter.score, 85); // 100 - 15 = 85
});

test('applyCorrectionToCaption properly substitutes flagged phrases', () => {
  const initial = 'Try our 100% detox juice today!';
  const updated = applyCorrectionToCaption(initial, '100% detox', 'Revitalizing wellness blend');
  assert.equal(updated, 'Try our Revitalizing wellness blend juice today!');
});

test('filterBrandRules filters by search, category, and severity', () => {
  const healthRules = filterBrandRules(DEFAULT_RULES, { category: 'health' });
  assert.ok(healthRules.every(r => r.category === 'health'));

  const criticalRules = filterBrandRules(DEFAULT_RULES, { severity: 'critical' });
  assert.ok(criticalRules.every(r => r.severity === 'critical'));

  const searchResults = filterBrandRules(DEFAULT_RULES, { search: 'organic' });
  assert.ok(searchResults.length >= 1);
  assert.ok(searchResults.some(r => r.id === 'FB-004'));
});
