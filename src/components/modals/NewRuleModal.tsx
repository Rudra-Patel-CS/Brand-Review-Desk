import React, { useState, useEffect } from 'react';
import { BrandRule } from '../../utils/rulesEngine.js';
import { Brand } from '../../data/mockData.js';

interface NewRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  brands: Brand[];
  activeBrand: Brand;
  ruleToEdit?: BrandRule | null;
  onSaveRule: (rule: BrandRule) => void;
}

export const NewRuleModal: React.FC<NewRuleModalProps> = ({
  isOpen,
  onClose,
  brands,
  activeBrand,
  ruleToEdit,
  onSaveRule
}) => {
  const [ruleId, setRuleId] = useState('');
  const [title, setTitle] = useState('');
  const [brandId, setBrandId] = useState(activeBrand.id);
  const [category, setCategory] = useState<'health' | 'trademark' | 'disclaimers' | 'pricing' | 'general'>('health');
  const [severity, setSeverity] = useState<'critical' | 'warning' | 'advisory'>('warning');
  const [pattern, setPattern] = useState('');
  const [source, setSource] = useState('');
  const [explanation, setExplanation] = useState('');
  const [suggestedRemedy, setSuggestedRemedy] = useState('');

  useEffect(() => {
    if (ruleToEdit) {
      setRuleId(ruleToEdit.id);
      setTitle(ruleToEdit.title);
      setBrandId(ruleToEdit.brand);
      setCategory(ruleToEdit.category);
      setSeverity(ruleToEdit.severity);
      setPattern(ruleToEdit.pattern);
      setSource(ruleToEdit.source);
      setExplanation(ruleToEdit.explanation);
      setSuggestedRemedy(ruleToEdit.suggestedRemedy || '');
    } else {
      const prefix = activeBrand.id === 'freshbites' ? 'FB' : activeBrand.id === 'arka' ? 'AF' : 'NT';
      setRuleId(`${prefix}-${Math.floor(100 + Math.random() * 900)}`);
      setTitle('');
      setBrandId(activeBrand.id);
      setCategory('health');
      setSeverity('warning');
      setPattern('');
      setSource('FTC / Regulatory Standard');
      setExplanation('');
      setSuggestedRemedy('');
    }
  }, [ruleToEdit, activeBrand, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleId || !title || !pattern) return;

    const savedRule: BrandRule = {
      id: ruleId.trim().toUpperCase(),
      brand: brandId,
      title: title.trim(),
      category,
      severity,
      pattern: pattern.trim(),
      flags: 'i',
      source: source.trim() || 'Internal Brand Standard',
      explanation: explanation.trim() || 'Mandatory compliance check.',
      suggestedRemedy: suggestedRemedy.trim(),
      enabled: ruleToEdit ? ruleToEdit.enabled : true,
      appliesTo: ['caption', 'ocr']
    };

    onSaveRule(savedRule);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">policy</span>
            <div>
              <h3 className="font-serif text-lg font-medium text-on-surface">
                {ruleToEdit ? 'Edit Brand Rule' : 'Create New Brand Rule'}
              </h3>
              <span className="text-xs text-on-surface-variant">
                Define regex heuristics, regulatory citations, and suggested remedies
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                Rule ID
              </label>
              <input
                type="text"
                required
                value={ruleId}
                onChange={(e) => setRuleId(e.target.value)}
                placeholder="FB-099"
                className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high font-mono text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                Brand
              </label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full px-2.5 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="advisory">Advisory</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
              Rule Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Unsubstantiated Immunity Claims"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-2.5 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="health">Health & Claims</option>
                <option value="trademark">Trademark & Logo</option>
                <option value="disclaimers">Disclaimers</option>
                <option value="pricing">Pricing & Promo</option>
                <option value="general">General Governance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                Regulatory Source
              </label>
              <input
                type="text"
                placeholder="FDA 21 CFR §101.93"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
              Matching Regex Pattern
            </label>
            <input
              type="text"
              required
              placeholder="100%\\s*detox|cure\\s*disease"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high font-mono text-xs text-primary font-bold focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-[11px] text-on-surface-variant mt-1">
              Case-insensitive regex. Will evaluate across caption copy and extracted poster OCR.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
              Legal Explanation & Counsel Guidance
            </label>
            <textarea
              rows={2}
              placeholder="Explain the legal or brand risk if this phrase appears..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
              Suggested correction text
            </label>
            <input
              type="text"
              placeholder="e.g. Daily Refreshing Wellness Support"
              value={suggestedRemedy}
              onChange={(e) => setSuggestedRemedy(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="px-5 py-3.5 -mx-5 -mb-5 bg-surface-container-low border-t border-surface-container-high flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs font-medium text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-all shadow-sm"
            >
              {ruleToEdit ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
