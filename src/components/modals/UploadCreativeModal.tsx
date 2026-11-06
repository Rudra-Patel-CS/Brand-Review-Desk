import React, { useEffect, useState } from 'react';
import { Brand } from '../../data/mockData.js';
import { CampaignPreset } from '../../utils/rulesEngine.js';

interface UploadCreativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  brands: Brand[];
  activeBrand?: Brand;
  onAddCampaign: (newCampaign: CampaignPreset) => Promise<void> | void;
}

export const UploadCreativeModal: React.FC<UploadCreativeModalProps> = ({ isOpen, onClose, brands, activeBrand, onAddCampaign }) => {
  const [title, setTitle] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState(activeBrand?.id || brands[0]?.id || '');
  const [channel, setChannel] = useState('Social media');
  const [format, setFormat] = useState('Image');
  const [caption, setCaption] = useState('');
  const [artworkText, setArtworkText] = useState('');
  const [imageData, setImageData] = useState('');
  const [imageName, setImageName] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setSelectedBrandId(activeBrand?.id || brands[0]?.id || '');
  }, [isOpen, activeBrand?.id, brands]);

  if (!isOpen) return null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > 1200 * 1024) {
      setError('Image is too large for this database upload. Choose a file under 1.2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('Could not read this image. Try another file.');
        return;
      }
      setImageData(reader.result);
      setImageName(file.name);
      setError('');
      if (!title) setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    };
    reader.onerror = () => setError('Could not read this image. Try another file.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const brand = brands.find((item) => item.id === selectedBrandId);
    if (!brand || !imageData || !title.trim()) {
      setError(!brand ? 'Add a brand record to MongoDB before uploading.' : !imageData ? 'Select an image file first.' : 'Enter a campaign name.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const now = new Date().toISOString();
      const campaign: CampaignPreset = {
        id: `campaign-${Date.now()}`,
        code: `CAM-${Date.now().toString().slice(-6)}`,
        title: title.trim(),
        brandId: brand.id,
        brandName: brand.name,
        channel,
        format,
        aspectRatio: 'original',
        imageUrl: imageData,
        caption: caption.trim(),
        ocrText: artworkText.trim(),
        ocrConfidence: 0,
        initialFindings: [],
        status: 'action_required',
        isDemo: false,
        referenceOnly: false,
        createdAt: now,
        updatedAt: now
      };
      await onAddCampaign(campaign);
      setTitle('');
      setCaption('');
      setArtworkText('');
      setImageData('');
      setImageName('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not save this campaign.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 bg-surface-container-low border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[22px]">add_photo_alternate</span>
            <div>
              <h3 className="font-serif text-lg font-medium text-on-surface">Add campaign image</h3>
              <span className="text-xs text-on-surface-variant">The image and entered text are saved in MongoDB.</span>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">Image</label>
            <div className="border-2 border-dashed border-surface-container-highest rounded-xl p-4 text-center relative flex flex-col items-center justify-center">
              {imageData ? (
                <div className="w-full h-36 rounded-lg overflow-hidden relative bg-surface-container-high mb-2">
                  <img src={imageData} alt="Campaign preview" className="w-full h-full object-contain" />
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-inverse-surface/80 text-inverse-on-surface text-[10px]">{imageName}</span>
                </div>
              ) : (
                <div className="py-5 flex flex-col items-center">
                  <span className="material-symbols-outlined text-outline text-[32px] mb-1">cloud_upload</span>
                  <p className="text-xs text-on-surface font-medium">Choose a campaign image</p>
                  <p className="text-[11px] text-outline mt-0.5">PNG, JPG, or WebP · up to 1.2 MB</p>
                </div>
              )}
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Choose image file" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Campaign name</label>
            <input type="text" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Spring product launch" className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-on-surface-variant">Brand
              <select required value={selectedBrandId} onChange={(event) => setSelectedBrandId(event.target.value)} className="mt-1 w-full px-2.5 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface">
                {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-on-surface-variant">Channel
              <select value={channel} onChange={(event) => setChannel(event.target.value)} className="mt-1 w-full px-2.5 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface">
                <option>Social media</option><option>Paid display</option><option>Print</option><option>Packaging</option><option>Website</option>
              </select>
            </label>
          </div>

          <label className="block text-xs font-semibold text-on-surface-variant">Format
            <input value={format} onChange={(event) => setFormat(event.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface" />
          </label>
          <label className="block text-xs font-semibold text-on-surface-variant">Caption or body copy
            <textarea rows={3} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Paste the campaign copy to check…" className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface" />
          </label>
          <label className="block text-xs font-semibold text-on-surface-variant">Text shown in the image
            <textarea rows={3} value={artworkText} onChange={(event) => setArtworkText(event.target.value)} placeholder="Type or paste text from the image. Automatic OCR is not available yet." className="mt-1 w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface" />
          </label>

          {error && <p role="alert" className="text-xs text-error bg-error-container/50 border border-error-container rounded-lg p-2.5">{error}</p>}
          <div className="-mx-5 -mb-5 px-5 py-3.5 bg-surface-container-low border-t border-surface-container-high flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isSaving} className="px-3 py-1.5 rounded text-xs font-medium text-on-surface-variant">Cancel</button>
            <button type="submit" disabled={isSaving || !brands.length} className="px-4 py-2 rounded bg-primary text-on-primary text-xs font-semibold disabled:opacity-60 flex items-center gap-1.5">
              {isSaving ? <><span className="material-symbols-outlined text-[16px] animate-spin">sync</span>Saving…</> : <><span className="material-symbols-outlined text-[16px]">save</span>Save campaign</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
