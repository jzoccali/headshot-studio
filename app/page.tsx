"use client";

import React, { useState } from 'react';
import { Upload, X, Download } from 'lucide-react';
import JSZip from 'jszip';
import { toast } from 'sonner';

type SourcePhoto = {
  id: string;
  name: string;
  previewUrl: string;
};

type Category = {
  id: string;
  name: string;
  description: string;
};

type Background = {
  id: string;
  label: string;
  description: string;
};

const CATEGORIES: Category[] = [
  { id: 'venture-capitalist', name: 'Venture Capitalist / Urban Strategist', description: 'LinkedIn, VC pitches, executive networks — charcoal wool suit, analytical prestige' },
  { id: 'thought-leader', name: 'Thought Leader / Non-Profit Director', description: 'Academic, consulting, foundations — camel blazer + rollneck, warm compassionate authority' },
  { id: 'digital-architect', name: 'Digital Architect / Tech Lead', description: 'Startup tech leads, engineering — technical knit polo, modern innovative energy' },
  { id: 'arts-administrator', name: 'Arts Administrator / Cultural Consultant', description: 'Creative directors, cultural leaders — minimalist black blazer + silk, sophisticated gallery style' },
];

const BACKGROUNDS: Background[] = [
  { id: 'dark', label: 'Dark Charcoal Studio', description: 'Clean, modern, high-contrast' },
  { id: 'white', label: 'Bright Clean White', description: 'Fresh, classic, trustworthy' },
  { id: 'warm-greige', label: 'Soft Warm Greige', description: 'Approachable, premium, warm' },
  { id: 'cool-bluegray', label: 'Cool Blue-Gray Modern', description: 'Calm, contemporary, tech-forward' },
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
          categoryId: 'venture-capitalist', // neutral starting style for the master; clothing overridden in variations
          backgroundId: 'dark',
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

  const generateVariation = async (cat: Category, bg: Background) => {
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

    const refsToUse = masterReferenceUrl ? [masterReferenceUrl] : referenceUrls.filter((r): r is string => typeof r === 'string' && r.startsWith('http'));
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
          label: `${cat.name} - ${bg.label}`,
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

    const refsToUse = masterReferenceUrl ? [masterReferenceUrl] : referenceUrls.filter((r): r is string => typeof r === 'string' && r.startsWith('http'));
    if (refsToUse.length === 0) {
      toast.error("No valid reference photos. Please re-upload your source images and try again.");
      return;
    }

    setIsGenerating(true);
    setFailedVariations([]);
    let generatedThisRun = 0;
    const total = CATEGORIES.length * BACKGROUNDS.length;
    const currentFailed: Array<{categoryId: string, backgroundId: string, label: string}> = [];

    try {
      for (const cat of CATEGORIES) {
        for (const bg of BACKGROUNDS) {
          const label = `${cat.name} - ${bg.label}`;

          // Skip if we already have this exact variation from a previous run
          if (generatedResults.some(r => r.label === label)) {
            continue;
          }

          if (generatedResults.length >= 24) {
            toast.error("Session limit reached (24 images).");
            break;
          }

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
              const delay = 1000 * Math.pow(1.5, attempt);  // exponential backoff
              if (attempt < 2) {
                await new Promise(r => setTimeout(r, delay));
              } else {
                currentFailed.push({categoryId: cat.id, backgroundId: bg.id, label});
                toast.error(`Failed ${label}: ${err.message}`);
                if (err.message && (err.message.includes("Fetching image failed") || err.message.includes("source photos is no longer accessible") || err.message.includes("404"))) {
                  setNeedsReupload(true);
                }
              }
            }
          }

          // Rate-limit friendly delay (xAI image edits can be sensitive)
          if (generatedThisRun < total) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
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
        const bg = BACKGROUNDS.find(b => b.id === item.backgroundId)!;
        const label = item.label;

        if (generatedResults.some(r => r.label === label)) continue;

        let success = false;
        for (let attempt = 0; attempt < 3 && !success; attempt++) {
          try {
            const currentValid = masterReferenceUrl ? [masterReferenceUrl] : referenceUrls.filter((r): r is string => typeof r === 'string' && r.startsWith('http'));
            const res = await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                references: currentValid,
                categoryId: cat.id,
                backgroundId: bg.id,
                label,
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

    const refsToUse = masterReferenceUrl ? [masterReferenceUrl] : referenceUrls.filter((r): r is string => typeof r === 'string' && r.startsWith('http'));
    if (refsToUse.length === 0) {
      toast.error("No valid reference photos. Please re-upload your source images and try again.");
      return;
    }

    setIsGenerating(true);
    let generatedThisRun = 0;

    try {
      for (const bg of BACKGROUNDS) {
        const label = `${cat.name} - ${bg.label}`;

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

        if (generatedThisRun < BACKGROUNDS.length) {
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
                    sources.forEach(s => URL.revokeObjectURL(s.previewUrl));
                    setSources([]);
                    setReferenceUrls([]);
                    setSubjectReady(false);
                    setMasterReferenceUrl(null);
                    setNeedsReupload(false);
                    setFailedVariations([]);
                    toast.info("Sources cleared. Re-upload your photos.");
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
            <button
              onClick={generateAllVariations}
              disabled={isGenerating || !subjectReady || !consent}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 rounded-2xl text-sm font-medium whitespace-nowrap"
            >
              Generate All 16 Variations
            </button>
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
                  {BACKGROUNDS.map(bg => (
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
                    <a href={r.imageUrl} download={`${r.label}.jpg`} className="text-xs text-blue-400 hover:underline">Download JPG</a>
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
