import React, { useState } from 'react';
import { Brand } from '../../data/mockData.js';
import { CampaignPreset } from '../../utils/rulesEngine.js';

interface UploadCreativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  brands: Brand[];
  activeBrand: Brand;
  onAddCampaign: (newCampaign: CampaignPreset) => void;
}

export const UploadCreativeModal: React.FC<UploadCreativeModalProps> = ({
  isOpen,
  onClose,
  brands,
  activeBrand,
  onAddCampaign
}) => {
  const [title, setTitle] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState(activeBrand.id);
  const [channel, setChannel] = useState('IG / TikTok Reels (9:16)');
  const [format, setFormat] = useState('Short-Form Video Ad');
  const [caption, setCaption] = useState('Fresh organic selections made for your healthy lifestyle! 100% pure quality. #CleanNutrition');
  const [previewUrl, setPreviewUrl] = useState<string>('/assets/aistudio/screen_81b71146.png');
  const [isScanning, setIsScanning] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsScanning(true);

    setTimeout(() => {
      const brand = brands.find((b) => b.id === selectedBrandId) || activeBrand;
      const campaignCode = `CAMPAIGN-${Math.floor(1000 + Math.random() * 9000)}`;
      
      const newPreset: CampaignPreset = {
        id: `custom-${Date.now()}`,
        code: campaignCode,
        title: title.trim() || 'Untitled Campaign Asset',
        brandId: brand.id,
        brandName: brand.name,
        channel,
        format,
        aspectRatio: '4/5',
        imageUrl: previewUrl,
        caption,
        ocrText: 'RAW ORGANIC COLD PRESSED 100% PURE INGREDIENTS SHOP NOW AT OUR STORES',
        ocrConfidence: 97.5,
        status: 'action_required',
        initialFindings: [
          {
            id: `f-${Date.now()}-1`,
            ruleId: 'FB-012',
            ruleTitle: 'Health Claim Verification',
            matchedText: '100% pure',
            severity: 'warning',
            source: 'both',
            ruleSource: 'FDA/FTC Advertising Compliance Framework',
            explanation: 'Substantiation record required for absolute purity declarations.',
            suggestedCorrection: 'High Quality Verified Ingredients',
            status: 'open',
            bbox: { top: 45.0, left: 35.0, width: 30.0, height: 8.0 }
          }
        ]
      };

      onAddCampaign(newPreset);
      setIsScanning(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">add_photo_alternate</span>
            <div>
              <h3 className="font-serif text-lg font-medium text-on-surface">Upload Campaign Creative</h3>
              <span className="text-xs text-on-surface-variant">
                Upload image proof and run automated OCR compliance check
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
          {/* File Upload Zone */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
              Creative Asset Artwork
            </label>
            <div className="border-2 border-dashed border-surface-container-highest rounded-xl p-4 text-center hover:bg-surface-container-low transition-colors relative flex flex-col items-center justify-center">
              {previewUrl ? (
                <div className="w-full h-36 rounded-lg overflow-hidden relative bg-surface-container-high mb-2">
                  <img src={previewUrl} alt="Upload preview" className="w-full h-full object-cover" />
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-inverse-surface/80 text-inverse-on-surface text-[10px] font-mono">
                    Ready for OCR
                  </span>
                </div>
              ) : (
                <div className="py-6 flex flex-col items-center">
                  <span className="material-symbols-outlined text-outline text-[32px] mb-1">cloud_upload</span>
                  <p className="text-xs text-on-surface font-medium">Drag and drop file here, or browse</p>
                  <p className="text-[11px] text-outline mt-0.5">PNG, JPG, WebP up to 25MB</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Campaign Title */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
              Campaign Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Summer Spark Energy Launch"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest"
            />
          </div>

          {/* Brand & Channel Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
                Brand
              </label>
              <select
                value={selectedBrandId}
                onChange={(e) => setSelectedBrandId(e.target.value)}
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
                Distribution Channel
              </label>
              <select
                value={channel}
                onChange={(e) => {
                  setChannel(e.target.value);
                  setFormat(e.target.value.includes('Reels') ? 'Short-Form Video (9:16)' : 'Display Banner');
                }}
                className="w-full px-2.5 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="IG / TikTok Reels (9:16)">IG / TikTok Reels (9:16)</option>
                <option value="Paid Social & Display Banner">Paid Social & Display</option>
                <option value="Print & Packaging">Print & Packaging</option>
                <option value="Point of Sale Retail Banner">Retail POP Poster</option>
              </select>
            </div>
          </div>

          {/* Ad Caption Copy */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
              Initial Ad Caption Copy
            </label>
            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="px-5 py-3.5 -mx-5 -mb-5 bg-surface-container-low border-t border-surface-container-high flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isScanning}
              className="px-3 py-1.5 rounded text-xs font-medium text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isScanning}
              className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-all flex items-center gap-1.5 shadow-sm"
            >
              {isScanning ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  Scanning OCR...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">document_scanner</span>
                  Upload & Run Audit
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
