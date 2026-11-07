import React, { useEffect, useRef, useState } from 'react';
import { Brand } from '../../data/mockData.js';
import { CampaignPreset, BrandRule, DEFAULT_RULES, runComplianceAudit } from '../../utils/rulesEngine.js';
import { getCsrfToken } from '../../utils/auth.js';
import { isPublicDemoMode, publicAssetUrl } from '../../utils/publicDemo.js';
import { recognizeInBrowser } from '../../utils/browserOcr.js';

interface UploadCreativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  brands: Brand[];
  activeBrand: Brand;
  rules?: BrandRule[];
  onAddCampaign: (newCampaign: CampaignPreset) => void;
  replaceCampaign?: CampaignPreset | null;
  onReplaceCampaign?: (campaign: CampaignPreset) => void;
}

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export const UploadCreativeModal: React.FC<UploadCreativeModalProps> = ({
  isOpen,
  onClose,
  brands,
  activeBrand,
  rules = DEFAULT_RULES,
  onAddCampaign,
  replaceCampaign = null,
  onReplaceCampaign
}) => {
  const [title, setTitle] = useState('');
  const [agency, setAgency] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState(activeBrand.id);
  const [channel, setChannel] = useState('IG / TikTok Reels (9:16)');
  const [format, setFormat] = useState('Short-Form Video Ad');
  const [caption, setCaption] = useState('Fresh organic selections made for your healthy lifestyle! 100% pure quality. #CleanNutrition');
  const [previewUrl, setPreviewUrl] = useState<string>(publicAssetUrl('assets/aistudio/screen_81b71146.png'));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const selectedPreviewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(replaceCampaign?.title || '');
    setAgency(replaceCampaign?.agency || '');
    setSelectedBrandId(replaceCampaign?.brandId || activeBrand.id);
    setChannel(replaceCampaign?.channel || 'IG / TikTok Reels (9:16)');
    setFormat(replaceCampaign?.format || 'Short-Form Video Ad');
    setCaption(replaceCampaign?.caption || 'Fresh organic selections made for your healthy lifestyle! 100% pure quality. #CleanNutrition');
    setPreviewUrl(replaceCampaign?.imageUrl || publicAssetUrl('assets/aistudio/screen_81b71146.png'));
    setSelectedFile(null);
    setUploadError(null);
  }, [isOpen, activeBrand.id, replaceCampaign]);

  useEffect(() => {
    return () => {
      if (selectedPreviewUrlRef.current) {
        URL.revokeObjectURL(selectedPreviewUrlRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const handleClose = () => {
    if (selectedPreviewUrlRef.current) {
      URL.revokeObjectURL(selectedPreviewUrlRef.current);
      selectedPreviewUrlRef.current = null;
    }
    setSelectedFile(null);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_SIZE_BYTES) {
        setUploadError(`File is too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum allowed size is 15MB.`);
        setSelectedFile(null);
        if (selectedPreviewUrlRef.current) {
          URL.revokeObjectURL(selectedPreviewUrlRef.current);
          selectedPreviewUrlRef.current = null;
        }
        setPreviewUrl(replaceCampaign?.imageUrl || publicAssetUrl('assets/aistudio/screen_81b71146.png'));
        return;
      }

      if (selectedPreviewUrlRef.current) {
        URL.revokeObjectURL(selectedPreviewUrlRef.current);
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      selectedPreviewUrlRef.current = url;
      setPreviewUrl(url);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setIsUploading(true);
    setUploadStep(isPublicDemoMode ? 'Preparing this creative in your browser...' : 'Storing asset in MongoDB GridFS...');

    try {
      let finalImageUrl = previewUrl;
      let assetId: string | undefined = undefined;
      let assetMetadata: any = undefined;

      const csrfToken = getCsrfToken();
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }

      // If a real local file was chosen, upload it to MongoDB GridFS
      if (selectedFile && !isPublicDemoMode) {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const res = await fetch('/api/assets/upload', {
          method: 'POST',
          credentials: 'include',
          headers,
          body: formData
        });

        let data: any = null;
        try {
          data = await res.json();
        } catch {
          data = null;
        }

        if (!res.ok) {
          throw new Error(data?.error || `Upload failed with status ${res.status}`);
        }

        finalImageUrl = data.url;
        assetId = data.assetId;
        assetMetadata = data.metadata;
      } else if (selectedFile) {
        finalImageUrl = previewUrl;
        assetMetadata = {
          mimeType: selectedFile.type,
          size: selectedFile.size,
          extension: selectedFile.name.split('.').pop(),
          uploadedAt: new Date().toISOString()
        };
      }

      // Perform genuine Optical Character Recognition on the creative image
      setUploadStep('Extracting artwork text with Optical Character Recognition...');
      let ocrText = '';
      let ocrConfidence = 0;
      let ocrLines: any[] = [];
      let ocrWords: any[] = [];

      try {
        if (isPublicDemoMode && (selectedFile || finalImageUrl)) {
          const result = await recognizeInBrowser(selectedFile || finalImageUrl);
          ocrText = result.text;
          ocrConfidence = result.confidence;
          ocrLines = result.lines;
          ocrWords = result.words;
        } else if (assetId || finalImageUrl) {
          const ocrPayload: Record<string, string> = assetId
            ? { assetId }
            : { imageUrl: finalImageUrl };
          const ocrRes = await fetch('/api/ocr/extract', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
            },
            body: JSON.stringify(ocrPayload)
          });

          const ocrData = await ocrRes.json().catch(() => null);
          if (!ocrRes.ok) {
            throw new Error(ocrData?.error || `OCR failed with status ${ocrRes.status}`);
          }
          ocrText = ocrData?.text || '';
          ocrConfidence = typeof ocrData?.confidence === 'number' ? ocrData.confidence : 0;
          ocrLines = ocrData?.lines || [];
          ocrWords = ocrData?.words || [];
        }
      } catch (ocrErr) {
        throw new Error(
          `OCR could not be completed, so this creative was not added. ${
            ocrErr instanceof Error ? ocrErr.message : 'Unknown OCR error'
          }`
        );
      }

      const brand = brands.find((b) => b.id === selectedBrandId) || activeBrand;
      const campaignCode = `CAMPAIGN-${Math.floor(1000 + Math.random() * 9000)}`;

      // Run brand rules against caption and extracted artwork text with coordinates
      const initialFindings = runComplianceAudit(
        caption,
        ocrText,
        rules,
        brand.id,
        ocrLines,
        ocrWords
      );

      const newPreset: CampaignPreset = {
        ...(replaceCampaign || {}),
        id: replaceCampaign?.id || `campaign-${Date.now()}`,
        code: replaceCampaign?.code || campaignCode,
        isDemoSample: false,
        title: title.trim() || 'Untitled Campaign Asset',
        brandId: brand.id,
        brandName: brand.name,
        agency: agency.trim() || undefined,
        channel,
        format,
        aspectRatio: replaceCampaign?.aspectRatio || '4/5',
        imageUrl: finalImageUrl,
        assetId,
        assetMetadata,
        caption,
        ocrText,
        extractedText: ocrText,
        ocrConfidence,
        ocrLines,
        ocrWords,
        status: initialFindings.some((f) => f.severity === 'critical') ? 'action_required' : 'under_review',
        initialFindings,
        reviewedBy: undefined,
        reviewerId: undefined,
        approvedBy: undefined,
        approverId: undefined,
        approvedAt: undefined,
        rejectedBy: undefined,
        rejectedAt: undefined,
        rejectionReason: undefined,
        criticalOverrideReason: undefined,
        requestedChanges: undefined
      };

      if (replaceCampaign && onReplaceCampaign) onReplaceCampaign(newPreset);
      else onAddCampaign(newPreset);
      if (selectedPreviewUrlRef.current === finalImageUrl) {
        selectedPreviewUrlRef.current = null;
      }
      handleClose();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error uploading creative asset');
    } finally {
      setIsUploading(false);
      setUploadStep('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">add_photo_alternate</span>
            <div>
              <h3 className="font-serif text-lg font-medium text-on-surface">
                {replaceCampaign ? 'Replace Campaign Creative' : 'Upload Campaign Creative'}
              </h3>
              <span className="text-xs text-on-surface-variant">
                {isPublicDemoMode ? 'Image and OCR are processed in this browser only' : 'Stores image asset securely in MongoDB GridFS'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {uploadError && (
            <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{uploadError}</span>
            </div>
          )}

          {/* File Upload Zone */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Creative Asset Artwork
              </label>
              <span className="text-[10px] font-mono text-secondary font-medium">
                {isPublicDemoMode ? 'Local demo · Max 15MB' : 'MongoDB GridFS Storage · Max 15MB'}
              </span>
            </div>
            <div className="border-2 border-dashed border-surface-container-highest rounded-xl p-4 text-center hover:bg-surface-container-low transition-colors relative flex flex-col items-center justify-center">
              {previewUrl ? (
                <div className="w-full h-36 rounded-lg overflow-hidden relative bg-surface-container-high mb-2">
                  <img src={previewUrl} alt="Upload preview" className="w-full h-full object-cover" />
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-inverse-surface/80 text-inverse-on-surface text-[10px] font-mono">
                    {selectedFile ? `${Math.round(selectedFile.size / 1024)} KB` : 'Preview'}
                  </span>
                </div>
              ) : (
                <div className="py-6 flex flex-col items-center">
                  <span className="material-symbols-outlined text-outline text-[32px] mb-1">cloud_upload</span>
                  <p className="text-xs text-on-surface font-medium">Choose an image file from your computer</p>
                  <p className="text-[11px] text-outline mt-0.5">PNG, JPEG, WebP, GIF up to 15MB</p>
                </div>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                required={Boolean(replaceCampaign)}
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

          {/* Agency Attribution */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">
              Creative Agency / Vendor Partner (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Vanguard Creative, PixelCraft Studio, or In-House"
              value={agency}
              onChange={(e) => setAgency(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest"
            />
          </div>

          {/* Brand & Channel Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              Ad Caption Copy
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
              onClick={handleClose}
              disabled={isUploading}
              className="px-3 py-1.5 rounded text-xs font-medium text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-all flex items-center gap-1.5 shadow-sm"
            >
              {isUploading ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  <span>{uploadStep || 'Processing asset…'}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                  {replaceCampaign ? 'Replace Creative Asset' : 'Upload Creative Asset'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
