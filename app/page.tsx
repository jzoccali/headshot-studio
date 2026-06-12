"use client";

import React, { useState, useEffect } from 'react';
import { Upload, X, Download } from 'lucide-react';
import JSZip from 'jszip';
import { toast } from 'sonner';

type SourcePhoto = {
  id: string;
  name: string;
  previewUrl: string;
};

type Look = {
  id: string;
  label: string;
  description: string;
};

type Category = {
  id: string;
  name: string;
  description: string;
  looks: Look[];
};

// 16 unique looks — every photo has its own outfit AND its own setting.
// Look ids map to the LOOKS table in /api/generate.
const CATEGORIES: Category[] = [
  {
    id: 'boardroom', name: 'Boardroom', description: 'Four distinct executive looks — from full suit & tie to rolled sleeves at the startup HQ.',
    looks: [
      { id: 'navy-suit-tie', label: 'Navy Suit & Tie', description: 'Classic power — glass conference room' },
      { id: 'skyline-no-tie', label: 'Charcoal, Skyline', description: 'Open collar — corner-office city view' },
      { id: 'black-editorial', label: 'Black on Black', description: 'Turtleneck + blazer — dark studio drama' },
      { id: 'startup-office', label: 'Rolled Sleeves', description: 'White shirt, no jacket — bright startup HQ' },
    ],
  },
  {
    id: 'smart-casual', name: 'Smart Casual', description: 'Approachable but sharp — coffee shop, library, rooftop, creative loft.',
    looks: [
      { id: 'coffee-shop', label: 'Coffee Shop', description: 'Shawl cardigan — warm café bokeh' },
      { id: 'library-knit', label: 'Library', description: 'Knit polo — book-lined study' },
      { id: 'rooftop-golden', label: 'Rooftop Golden Hour', description: 'Suede overshirt — sunset terrace' },
      { id: 'creative-loft', label: 'Creative Loft', description: 'All-black casual — white-brick studio' },
    ],
  },
  {
    id: 'weekend', name: 'Weekend', description: 'The life shots — sailing, beach, trail, café patio.',
    looks: [
      { id: 'sailing', label: 'Sailing', description: 'Quarter-zip on deck — sun-sparkled water' },
      { id: 'beach-linen', label: 'Beach Linen', description: 'White linen — golden-hour surf' },
      { id: 'field-jacket', label: 'On the Trail', description: 'Field jacket — dappled forest light' },
      { id: 'cafe-patio', label: 'Café Patio', description: 'Merino polo — sunlit European street' },
    ],
  },
  {
    id: 'editorial', name: 'Bold & Editorial', description: 'Magazine energy — leather, blue hour, denim, crimson backdrop.',
    looks: [
      { id: 'leather-moody', label: 'Leather, Moody', description: 'Black leather — sculpted studio shadows' },
      { id: 'evening-city', label: 'Evening City', description: 'Wool topcoat — blue-hour street lights' },
      { id: 'industrial-denim', label: 'Industrial Denim', description: 'Indigo shirt — brick & steel loft' },
      { id: 'crimson-editorial', label: 'Crimson Editorial', description: 'Navy tailoring — deep red backdrop' },
    ],
  },
];

type GeneratedResult = {
  imageUrl: string;
  label: string;
  categoryName: string;
  backgroundLabel: string;
};

export default function HeadshotStudio() {
  const [sources, setSources] = useState<SourcePhoto[]>([]);
  const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
  const [subjectReady, setSubjectReady] = useState(false);
  const [generatedResults, setGeneratedResults] = useState<GeneratedResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [consent, setConsent] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [failedVariations, setFailedVariations] = useState<Array<{categoryId: string, backgroundId: string, label: string}>>([]);
  const [needsReupload, setNeedsReupload] = useState(false);
  const [masterReferenceUrl, setMasterReferenceUrl] = useState<string | null>(null);
  const [isBuildingSubject, setIsBuildingSubject] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  // GPT won the A/B (sharper, more realistic) — it's the default; Grok stays as fallback.
  const [engine, setEngine] = useState<'xai' | 'openai'>('openai');

  // Restore the session from localStorage so navigating away (e.g. opening an image)
  // or reloading doesn't wipe the gallery — losing 15 images forced costly regenerations.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('headshot-session-v1');
      if (saved) {
        const s = JSON.parse(saved);
        if (Array.isArray(s.generatedResults)) setGeneratedResults(s.generatedResults);
        if (Array.isArray(s.referenceUrls) && s.referenceUrls.length > 0) {
          setReferenceUrls(s.referenceUrls);
          // Rebuild the source-photo cards from their public URLs (object URLs don't survive reloads)
          setSources(s.referenceUrls.map((u: string, i: number) => ({
            id: `restored-${i}`,
            name: `photo ${i + 1}`,
            previewUrl: u,
          })));
        }
        if (typeof s.masterReferenceUrl === 'string' && s.masterReferenceUrl) setMasterReferenceUrl(s.masterReferenceUrl);
        if (s.subjectReady === true) setSubjectReady(true);
      }
    } catch {
      // corrupted session data — start fresh
    }
    setHydrated(true);
  }, []);

  // Persist the session whenever it changes (after initial hydration, so we don't
  // clobber a saved session with the empty first render).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem('headshot-session-v1', JSON.stringify({
        generatedResults,
        referenceUrls,
        masterReferenceUrl,
        subjectReady,
      }));
    } catch {
      // storage full or unavailable — non-fatal
    }
  }, [hydrated, generatedResults, referenceUrls, masterReferenceUrl, subjectReady]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;

    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: validFiles.length });

    let successCount = 0;
    let failCount = 0;
    let lastUploadError = '';

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const id = `src-${Date.now()}-${i}`;
      const previewUrl = URL.createObjectURL(file);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          console.error('Upload failed for', file.name, errData);
          lastUploadError = errData.error || `HTTP ${uploadRes.status}`;
          failCount++;
          URL.revokeObjectURL(previewUrl);
          continue;
        }

        const data = await uploadRes.json();
        if (!data.url || typeof data.url !== 'string') {
          lastUploadError = 'Invalid response from server';
          failCount++;
          URL.revokeObjectURL(previewUrl);
          continue;
        }

        // Add the photo card immediately when its upload succeeds (live feedback)
        const source: SourcePhoto = { id, name: file.name, previewUrl };
        setSources(prev => [...prev, source]);
        setReferenceUrls(prev => [...prev, data.url]);
        setSubjectReady(false);

        successCount++;
        setUploadProgress(p => ({ ...p, current: p.current + 1 }));
      } catch (e: any) {
        console.error('Upload error for', file.name, e);
        lastUploadError = e.message || 'Network error';
        failCount++;
        URL.revokeObjectURL(previewUrl);
      }
    }

    setIsUploading(false);
    setUploadProgress({ current: 0, total: 0 });

    if (successCount > 0) {
      toast.success(`Added ${successCount} photo(s)`);
    }
    if (failCount > 0) {
      const detail = lastUploadError ? ` (${lastUploadError})` : '';
      toast.error(`${failCount} photo(s) failed to upload${detail}. Please try uploading again.`);
    }
  };

  const removeSource = (id: string) => {
    setSources(prevSources => {
      const index = prevSources.findIndex(x => x.id === id);
      if (index === -1) return prevSources;

      const photo = prevSources[index];
      if (photo) URL.revokeObjectURL(photo.previewUrl);

      // Keep referenceUrls in sync (they are parallel arrays by upload order)
      setReferenceUrls(prevRefs => prevRefs.filter((_, i) => i !== index));

      return prevSources.filter((_, i) => i !== index);
    });
    setSubjectReady(false);
  };

  const buildSubject = async () => {
    if (sources.length < 2) {
      toast.error("Upload at least 2-4 photos for a good consistent composite (more angles/lighting = better results)");
      return;
    }
    setIsBuildingSubject(true);
    setSubjectReady(false);  // ensure checkmark doesn't show until build completes

    const validRefs = referenceUrls.filter((r): r is string => typeof r === 'string' && r.startsWith('http'));
    if (validRefs.length === 0) {
      toast.error("No valid reference photos. Please re-upload your source images and try again.");
      setIsBuildingSubject(false);
      return;
    }

    try {
      // Generate a "master" consistent reference image using all your uploaded photos.
      // This bakes in the composite identity from all sources into a single strong reference.
      // All subsequent variations will use this master as their single reference for better reliability and consistency.
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          references: validRefs,
          categoryId: 'master',
          backgroundId: 'master', // dedicated neutral identity-anchor look
          label: 'Master Reference',
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMasterReferenceUrl(data.imageUrl);
      setSubjectReady(true);
      toast.success(`Consistent subject rendition created from ${sources.length} photos. All variations will now use this master reference for strong identity lock.`);
    } catch (err: any) {
      console.error('Failed to build master reference', err);
      toast.error(`Failed to build consistent subject: ${err.message}. Please try again or re-upload photos.`);
      setMasterReferenceUrl(null);
    } finally {
      setIsBuildingSubject(false);
    }
  };

  const generateVariation = async (cat: Category, bg: Look) => {
    if (!subjectReady) {
      toast.error("Upload photos and build the subject first");
      return;
    }
    if (!consent) {
      toast.error("Please check the consent box to proceed (biometric data processing)");
      return;
    }
    if (generatedResults.length >= 24) {
      toast.error("Session limit reached (24 images). Start a new session or download what you have.");
      return;
    }

    // Master first (identity lock) + up to 2 original photos (anchors real skin texture,
    // fights the faded second-generation softness of editing an AI image alone). Max 3 refs.
    const realPhotos = referenceUrls.filter((r): r is string => typeof r === 'string' && r.startsWith('http'));
    const refsToUse = masterReferenceUrl ? [masterReferenceUrl, ...realPhotos].slice(0, 3) : realPhotos;
    if (refsToUse.length === 0) {
      toast.error("No valid reference photos. Please re-upload your source images and try again.");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          references: refsToUse,
          categoryId: cat.id,
          backgroundId: bg.id,
          label: `${cat.name} - ${bg.label}${engine === 'openai' ? ' (GPT)' : ''}`,
          engine,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setGeneratedResults(prev => [...prev, {
        imageUrl: data.imageUrl,
        label: data.label || `${cat.name} - ${bg.label}`,
        categoryName: cat.name,
        backgroundLabel: bg.label,
      }]);

      toast.success(`Generated: ${cat.name} - ${bg.label}`);
    } catch (err: any) {
      toast.error(err.message || 'Generation failed. Check XAI_API_KEY in Vercel env vars. [xai-v3b3dbd8]');
    } finally {
      setIsGenerating(false);
    }
  };

  // Bulk generation for all 4 categories × 4 backgrounds = 16 variations
  const generateAllVariations = async () => {
    if (!subjectReady || referenceUrls.length === 0) {
      toast.error("Upload photos and build the subject first");
      return;
    }
    if (!consent) {
      toast.error("Please check the consent box to proceed (biometric data processing)");
      return;
    }

    // Master first (identity lock) + up to 2 original photos (anchors real skin texture,
    // fights the faded second-generation softness of editing an AI image alone). Max 3 refs.
    const realPhotos = referenceUrls.filter((r): r is string => typeof r === 'string' && r.startsWith('http'));
    const refsToUse = masterReferenceUrl ? [masterReferenceUrl, ...realPhotos].slice(0, 3) : realPhotos;
    if (refsToUse.length === 0) {
      toast.error("No valid reference photos. Please re-upload your source images and try again.");
      return;
    }

    setIsGenerating(true);
    setFailedVariations([]);
    let generatedThisRun = 0;
    const currentFailed: Array<{categoryId: string, backgroundId: string, label: string}> = [];

    // Build the work queue up front: skip variations we already have, respect the session cap.
    const existing = new Set(generatedResults.map(r => r.label));
    const queue: Array<{cat: Category, bg: Look, label: string}> = [];
    for (const cat of CATEGORIES) {
      for (const bg of cat.looks) {
        const label = `${cat.name} - ${bg.label}${engine === 'openai' ? ' (GPT)' : ''}`;
        if (!existing.has(label)) queue.push({ cat, bg, label });
      }
    }
    const remainingSlots = Math.max(0, 24 - generatedResults.length);
    if (queue.length > remainingSlots) {
      toast.error(`Session limit is 24 images — generating the first ${remainingSlots}.`);
      queue.length = remainingSlots;
    }

    // GPT renders take 60-120s each, so run 3 at a time (cuts a 16-batch from ~25min to ~8min).
    // xAI stays sequential with a courtesy delay — its edits endpoint is rate-limit sensitive.
    const concurrency = engine === 'openai' ? 3 : 1;
    let next = 0;

    const generateOne = async (item: {cat: Category, bg: Look, label: string}) => {
      const { cat, bg, label } = item;
      let success = false;
      for (let attempt = 0; attempt < 3 && !success; attempt++) {  // up to 2 retries
        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              references: refsToUse,
              categoryId: cat.id,
              backgroundId: bg.id,
              label,
              engine,
            }),
          });

          const data = await res.json();
          if (data.error) throw new Error(data.error);

          setGeneratedResults(prev => [...prev, {
            imageUrl: data.imageUrl,
            label: data.label || label,
            categoryName: cat.name,
            backgroundLabel: bg.label,
          }]);

          generatedThisRun++;
          success = true;
        } catch (err: any) {
          console.error(`Failed to generate ${label} (attempt ${attempt + 1})`, err);
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, 1000 * Math.pow(1.5, attempt)));  // exponential backoff
          } else {
            currentFailed.push({categoryId: cat.id, backgroundId: bg.id, label});
            toast.error(`Failed ${label}: ${err.message}`);
            if (err.message && (err.message.includes("Fetching image failed") || err.message.includes("source photos is no longer accessible") || err.message.includes("404"))) {
              setNeedsReupload(true);
            }
          }
        }
      }
    };

    const worker = async () => {
      while (next < queue.length) {
        const item = queue[next++];
        await generateOne(item);
        if (engine !== 'openai' && next < queue.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, () => worker()));

      if (currentFailed.length > 0) {
        setFailedVariations(currentFailed);
        toast.error(`Generated ${generatedThisRun} new variations. ${currentFailed.length} failed – use Retry button below.`);
      } else {
        toast.success(`Generated ${generatedThisRun} new variations!`);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const retryFailedVariations = async () => {
    if (failedVariations.length === 0) return;
    const toRetry = [...failedVariations];
    setFailedVariations([]);
    setIsGenerating(true);
    let generatedThisRun = 0;
    const stillFailed: Array<{categoryId: string, backgroundId: string, label: string}> = [];

    try {
      for (const item of toRetry) {
        const cat = CATEGORIES.find(c => c.id === item.categoryId)!;
        const bg = cat.looks.find(b => b.id === item.backgroundId)!;
        const label = item.label;

        if (generatedResults.some(r => r.label === label)) continue;

        let success = false;
        for (let attempt = 0; attempt < 3 && !success; attempt++) {
          try {
            const retryPhotos = referenceUrls.filter((r): r is string => typeof r === 'string' && r.startsWith('http'));
            const currentValid = masterReferenceUrl ? [masterReferenceUrl, ...retryPhotos].slice(0, 3) : retryPhotos;
            const res = await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                references: currentValid,
                categoryId: cat.id,
                backgroundId: bg.id,
                label,
                engine,
              }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setGeneratedResults(prev => [...prev, {
              imageUrl: data.imageUrl,
              label: data.label || label,
              categoryName: cat.name,
              backgroundLabel: bg.label,
            }]);
            generatedThisRun++;
            success = true;
          } catch (err: any) {
            if (attempt === 2) {
              stillFailed.push(item);
              toast.error(`Retry failed ${label}: ${err.message}`);
              if (err.message && (err.message.includes("Fetching image failed") || err.message.includes("source photos is no longer accessible") || err.message.includes("404"))) {
                setNeedsReupload(true);
              }
            }
            await new Promise(r => setTimeout(r, 1000 * Math.pow(1.5, attempt)));
          }
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      if (stillFailed.length > 0) {
        setFailedVariations(stillFailed);
      }
      toast.success(`Retried and generated ${generatedThisRun} more!`);
    } finally {
      setIsGenerating(false);
    }
  };

  // helper to get current valid refs (since state)
  const validRefsFromState = () => referenceUrls.filter((r): r is string => typeof r === 'string' && r.startsWith('http'));

  // Generate all 4 backgrounds for one specific category (for finer control)
  const generateAllForCategory = async (cat: Category) => {
    if (!subjectReady || referenceUrls.length === 0) {
      toast.error("Upload photos and build the subject first");
      return;
    }
    if (!consent) {
      toast.error("Please check the consent box to proceed (biometric data processing)");
      return;
    }

    // Master first (identity lock) + up to 2 original photos (anchors real skin texture,
    // fights the faded second-generation softness of editing an AI image alone). Max 3 refs.
    const realPhotos = referenceUrls.filter((r): r is string => typeof r === 'string' && r.startsWith('http'));
    const refsToUse = masterReferenceUrl ? [masterReferenceUrl, ...realPhotos].slice(0, 3) : realPhotos;
    if (refsToUse.length === 0) {
      toast.error("No valid reference photos. Please re-upload your source images and try again.");
      return;
    }

    setIsGenerating(true);
    let generatedThisRun = 0;

    try {
      for (const bg of cat.looks) {
        const label = `${cat.name} - ${bg.label}${engine === 'openai' ? ' (GPT)' : ''}`;

        if (generatedResults.some(r => r.label === label)) continue;
        if (generatedResults.length >= 24) break;

        let success = false;
        for (let attempt = 0; attempt < 2 && !success; attempt++) {
          try {
            const res = await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                references: refsToUse,
                categoryId: cat.id,
                backgroundId: bg.id,
                label,
                engine,
              }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setGeneratedResults(prev => [...prev, {
              imageUrl: data.imageUrl,
              label: data.label || label,
              categoryName: cat.name,
              backgroundLabel: bg.label,
            }]);

            generatedThisRun++;
            success = true;
          } catch (err: any) {
            console.error(`Failed to generate ${label} (attempt ${attempt + 1})`, err);
            if (attempt === 1) {
              toast.error(`Failed ${label}: ${err.message}`);
            }
            if (attempt === 0) await new Promise(r => setTimeout(r, 800));
          }
        }

        if (generatedThisRun < cat.looks.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      toast.success(`Generated ${generatedThisRun} variations for ${cat.name}!`);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAll = async () => {
    if (generatedResults.length === 0) {
      toast.error("Generate some photos first");
      return;
    }
    const zip = new JSZip();
    for (const r of generatedResults) {
      const res = await fetch(r.imageUrl);
      const buf = await res.arrayBuffer();
      zip.file(`${r.label.replace(/\s+/g, '-')}.jpg`, buf);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `headshots-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-semibold tracking-tight">Headshot Studio</h1>
          <p className="text-zinc-400 mt-1">Upload multiple photos of yourself. The app creates a consistent rendition of you from all of them. Generate professional variations by changing clothes and backgrounds. Download real photos from the site.</p>
          <div className="mt-2 text-xs text-amber-400">AI-generated images. For personal use. Disclose as AI-generated when used professionally.</div>
        </header>

        {/* 1. Upload + Consent + Subject */}
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg font-medium">1. Upload 4-6 photos of yourself</div>
              <div className="text-sm text-zinc-400">Different angles, lighting, and expressions give the best consistent composite result.</div>
            </div>
            <label className={`flex items-center gap-2 px-5 py-2 bg-white text-black rounded-2xl text-sm font-medium ${isUploading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-zinc-200 active:bg-white'}`}>
              <Upload className="w-4 h-4" /> {isUploading ? 'Uploading...' : 'Add Photos'}
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                disabled={isUploading}
                onChange={(e) => handleFiles(e.target.files)} 
              />
            </label>
          </div>

          {isUploading && (
            <div className="mb-4 p-3 bg-blue-950/40 border border-blue-900 rounded-2xl text-sm text-blue-400 flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              <span>
                Uploading photos to server... {uploadProgress.current} of {uploadProgress.total}
                <span className="text-blue-300"> — this can take 30–90 seconds for 6 photos</span>
              </span>
            </div>
          )}

          {sources.length > 0 && (
            <>
              <div className="flex justify-between items-center mb-1">
                <div className="text-xs text-zinc-400">Your source photos (used as references)</div>
                <button
                  onClick={() => {
                    // Best-effort privacy cleanup: delete the uploaded source photos
                    // (and the master reference) from Blob storage now that we're done.
                    const urlsToDelete = [
                      ...referenceUrls.filter((r): r is string => typeof r === 'string' && r.startsWith('http')),
                      ...(masterReferenceUrl ? [masterReferenceUrl] : []),
                    ];
                    if (urlsToDelete.length > 0) {
                      fetch('/api/cleanup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ urls: urlsToDelete }),
                      }).catch(() => {});
                    }
                    sources.forEach(s => URL.revokeObjectURL(s.previewUrl));
                    setSources([]);
                    setReferenceUrls([]);
                    setSubjectReady(false);
                    setMasterReferenceUrl(null);
                    setNeedsReupload(false);
                    setFailedVariations([]);
                    toast.info("Sources cleared and deleted from storage. Re-upload your photos.");
                  }}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear all sources & re-upload
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
                {sources.map(s => (
                  <div key={s.id} className="relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
                    <img src={s.previewUrl} className="w-full aspect-square object-cover" alt={s.name} />
                    <div className="p-2 text-[10px] truncate bg-black/60">{s.name}</div>
                    <button onClick={() => removeSource(s.id)} className="absolute top-2 right-2 bg-black/70 p-1 rounded-full"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mb-4 p-4 border border-amber-600 bg-amber-950/30 rounded-2xl text-sm">
            <label className="flex items-start gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={consent} 
                onChange={(e) => setConsent(e.target.checked)} 
                className="mt-1" 
              />
              <span>
                I consent to the processing of my facial images (biometric data) solely for generating headshot variations. 
                My source photos will be used only for this generation and automatically deleted afterward. 
                I understand all outputs are AI-generated and I will disclose them as such if used professionally. 
                This tool is for self-use only.
              </span>
            </label>
            <div className="text-[10px] text-amber-400 mt-2 ml-6">Source photos are deleted after generation. No data is used for training.</div>
          </div>

          <button
            onClick={buildSubject}
            disabled={sources.length < 2 || isUploading || isBuildingSubject}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 rounded-2xl text-sm font-medium"
          >
            {isBuildingSubject ? 'Building consistent rendition...' : 'Create consistent rendition of the subject from these photos (recommended: 4-6 photos)'}
          </button>
          {isBuildingSubject && (
            <div className="mt-2 text-emerald-400 text-sm flex items-center gap-2">
              <span className="animate-pulse">●</span> Preparing consistent subject from your photos...
            </div>
          )}
          {subjectReady && !isGenerating && !isBuildingSubject && <div className="mt-2 text-emerald-400 text-sm">✓ Consistent subject ready. All photos will be used as references for face consistency.</div>}
          {isGenerating && (
            <div className="mt-2 text-blue-400 text-sm flex items-center gap-2">
              <span className="animate-pulse">●</span> 
              Generating your professional headshots...
              {generatedResults.length > 0 && ` (${generatedResults.length} complete so far)`}
              <span className="text-xs text-blue-300 ml-2">(this can take a few minutes — images will appear as they finish)</span>
            </div>
          )}
        </section>

        {/* 2. Variations */}
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-lg font-medium">2. Generate variations — different clothes &amp; backgrounds</div>
              <div className="text-sm text-zinc-400">The app changes clothing, pose, and background per the professional style while keeping your face consistent using your photos as strong visual references.</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-2xl border border-zinc-700 p-0.5 text-xs" title="A/B test: same prompts, different image engine">
                <button
                  onClick={() => setEngine('xai')}
                  className={`px-3 py-1.5 rounded-xl font-medium ${engine === 'xai' ? 'bg-zinc-200 text-black' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  Grok
                </button>
                <button
                  onClick={() => setEngine('openai')}
                  className={`px-3 py-1.5 rounded-xl font-medium ${engine === 'openai' ? 'bg-zinc-200 text-black' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  GPT
                </button>
              </div>
              <button
                onClick={generateAllVariations}
                disabled={isGenerating || !subjectReady || !consent}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 rounded-2xl text-sm font-medium whitespace-nowrap"
              >
                Generate All 16 Variations
              </button>
            </div>
            {failedVariations.length > 0 && !isGenerating && (
              <button
                onClick={retryFailedVariations}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-2xl text-xs font-medium whitespace-nowrap ml-2"
              >
                Retry {failedVariations.length} failed
              </button>
            )}
          </div>

          {needsReupload && (
            <div className="mb-4 p-4 bg-red-950/40 border border-red-800 rounded-2xl text-sm text-red-400">
              <strong>Some source photos couldn't be used for generation.</strong><br />
              Please re-upload your photos above, then use the Retry button for the ones that failed.
              <button onClick={() => setNeedsReupload(false)} className="ml-2 text-xs underline">Dismiss</button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {CATEGORIES.map(cat => (
              <div key={cat.id} className="rounded-2xl border border-zinc-800 p-4 bg-zinc-900">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold">{cat.name}</div>
                  <button
                    onClick={() => generateAllForCategory(cat)}
                    disabled={isGenerating || !subjectReady || !consent}
                    className="text-[10px] px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-400"
                  >
                    All 4 backgrounds
                  </button>
                </div>
                <div className="text-xs text-zinc-400 mb-3">{cat.description}</div>
                <div className="grid grid-cols-2 gap-2">
                  {cat.looks.map(bg => (
                    <button
                      key={bg.id}
                      onClick={() => generateVariation(cat, bg)}
                      disabled={isGenerating || !subjectReady || !consent || isUploading}
                      className="text-left text-sm border border-zinc-700 hover:border-zinc-500 rounded-xl px-3 py-2 disabled:opacity-50 hover:bg-zinc-800"
                    >
                      <div className="font-medium">Generate {bg.label}</div>
                      <div className="text-[10px] text-zinc-400">{bg.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {isGenerating && (
            <div className="mt-3 text-sm text-blue-400 flex items-center gap-2">
              <span className="animate-pulse">●</span> Generating your headshots...
              {generatedResults.length > 0 && ` (${generatedResults.length} so far)`}
            </div>
          )}
        </section>

        {/* 3. Your generated photos — download from the site */}
        {generatedResults.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-medium">3. Your photos (download from here)</div>
                <div className="text-sm text-zinc-400">Real AI-generated headshots. All images include "AI-generated" disclosure.</div>
              </div>
              <button
                onClick={async () => {
                  if (generatedResults.length === 0 || isGenerating) return;
                  const zip = new JSZip();
                  for (const r of generatedResults) {
                    const res = await fetch(r.imageUrl);
                    const buf = await res.arrayBuffer();
                    zip.file(`${r.label.replace(/\s+/g, '-')}.jpg`, buf);
                  }
                  const blob = await zip.generateAsync({ type: "blob" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `headshots-${Date.now()}.zip`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                disabled={isGenerating}
                className="px-4 py-2 bg-white text-black rounded-2xl text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" /> Download All as ZIP
              </button>
            </div>

            {isGenerating && generatedResults.length > 0 && (
              <div className="text-xs text-amber-400 -mt-2 mb-3">
                Waiting for all generations to complete before the full ZIP is available. Individual JPG downloads work immediately.
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {generatedResults.map((r, idx) => (
                <div key={idx} className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900">
                  <img src={r.imageUrl} className="w-full aspect-square object-cover" alt={r.label} />
                  <div className="p-3 text-sm">
                    <div className="font-medium">{r.label}</div>
                    <div className="text-[10px] text-amber-400 mb-1">AI-generated headshot</div>
                    <button
                      onClick={async () => {
                        // Cross-origin <a download> is ignored by browsers and NAVIGATES to the
                        // image instead — which used to blow away the whole gallery. Fetch the
                        // bytes and download locally so the user never leaves the page.
                        try {
                          const res = await fetch(r.imageUrl);
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${r.label.replace(/\s+/g, '-')}.jpg`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch {
                          toast.error('Download failed — try again');
                        }
                      }}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      Download JPG
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="text-center text-xs text-zinc-500 mt-12">
          Self-use only • Source photos deleted after generation • All outputs are AI-generated — disclose when used professionally • 4-6 varied photos recommended for best results
        </div>
      </div>
    </div>
  );
}
