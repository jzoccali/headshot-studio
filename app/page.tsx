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
  { id: 'venture-capitalist', name: 'Venture Capitalist / Urban Strategist', description: 'LinkedIn, VC pitches, executive networks - charcoal wool suit, analytical prestige' },
  { id: 'thought-leader', name: 'Thought Leader / Non-Profit Director', description: 'Academic, consulting, foundations - camel blazer + rollneck, warm compassionate authority' },
  { id: 'digital-architect', name: 'Digital Architect / Tech Lead', description: 'Startup tech leads, engineering - technical knit polo, modern innovative energy' },
  { id: 'arts-administrator', name: 'Arts Administrator / Cultural Consultant', description: 'Creative directors, cultural leaders - minimalist black blazer + silk, sophisticated gallery style' },
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

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const newOnes: SourcePhoto[] = [];
    const newBlobUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
      const { url } = await uploadRes.json();

      const id = `src-${Date.now()}-${i}`;
      newOnes.push({ id, name: file.name, previewUrl: URL.createObjectURL(file) });
      newBlobUrls.push(url);
    }

    setSources(prev => [...prev, ...newOnes]);
    setReferenceUrls(prev => [...prev, ...newBlobUrls]);
    setSubjectReady(false);
    toast.success(`Added ${newOnes.length} photo(s)`);
  };

  const removeSource = (id: string) => {
    setSources(prev => {
      const s = prev.find(x => x.id === id);
      if (s) URL.revokeObjectURL(s.previewUrl);
      return prev.filter(x => x.id !== id);
    });
    setSubjectReady(false);
  };

  const buildSubject = () => {
    if (sources.length === 0) {
      toast.error("Upload some photos first");
      return;
    }
    setSubjectReady(true);
    toast.success(`Consistent subject created from ${sources.length} photos (all will be used as references for face consistency)`);
  };

  const generateVariation = async (cat: Category, bg: Background) => {
    if (referenceUrls.length === 0) {
      toast.error("Upload and build subject from your photos first");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          references: referenceUrls, // all photos for composite / consistent subject
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
      toast.error(err.message || 'Generation failed. Make sure REPLICATE_API_TOKEN is set in Vercel.');
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
          <p className="text-zinc-400 mt-1">
            Upload photos of the subject. The app creates a consistent rendition from all of them. 
            Generate professional variations by changing clothes and backgrounds. Download real photos directly from the site.
          </p>
        </header>

        {/* 1. Upload */}
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg font-medium">1. Upload photos of the subject</div>
              <div className="text-sm text-zinc-400">Multiple photos (different angles/lighting) help create a better consistent rendition.</div>
            </div>
            <label className="cursor-pointer flex items-center gap-2 px-5 py-2 bg-white text-black rounded-2xl text-sm font-medium hover:bg-zinc-200 active:bg-white">
              <Upload className="w-4 h-4" /> Add Photos
              <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
            </label>
          </div>

          {sources.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3 mb-4">
              {sources.map(s => (
                <div key={s.id} className="relative group rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
                  <img src={s.previewUrl} className="w-full aspect-square object-cover" alt={s.name} />
                  <div className="p-2 text-[10px] truncate bg-black/60">{s.name}</div>
                  <button onClick={() => removeSource(s.id)} className="absolute top-2 right-2 bg-black/70 p-1 rounded-full opacity-0 group-hover:opacity-100">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={buildSubject}
            disabled={sources.length === 0}
            className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 rounded-2xl text-sm font-medium"
          >
            Create consistent rendition of the subject from these photos
          </button>
          {subjectReady && (
            <div className="mt-2 text-emerald-400 text-sm">
              ✓ Consistent subject ready. All uploaded photos will be used as references for face consistency.
            </div>
          )}
        </section>

        {/* 2. Generate variations */}
        <section className="mb-10">
          <div className="mb-4">
            <div className="text-lg font-medium">2. Generate variations (different clothes &amp; backgrounds)</div>
            <div className="text-sm text-zinc-400">Click any button to generate a real photo. The app uses your uploaded photos as references + the professional style prompt.</div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {CATEGORIES.map(cat => (
              <div key={cat.id} className="rounded-2xl border border-zinc-800 p-4 bg-zinc-900">
                <div className="font-semibold">{cat.name}</div>
                <div className="text-xs text-zinc-400 mb-3">{cat.description}</div>
                <div className="grid grid-cols-2 gap-2">
                  {BACKGROUNDS.map(bg => (
                    <button
                      key={bg.id}
                      onClick={() => generateVariation(cat, bg)}
                      disabled={isGenerating || !subjectReady}
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
            <div className="mt-4 text-sm text-blue-400">Generating photo... (this can take 10-30s depending on the model)</div>
          )}
        </section>

        {/* 3. Results - download from here */}
        {generatedResults.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-medium">3. Your generated photos (download from the site)</div>
                <div className="text-sm text-zinc-400">Real photos generated by the app. Add more by clicking the buttons above.</div>
              </div>
              <button
                onClick={async () => {
                  if (generatedResults.length === 0) return;
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
                className="px-4 py-2 bg-white text-black rounded-2xl text-sm font-medium flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Download All as ZIP
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {generatedResults.map((r, idx) => (
                <div key={idx} className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900">
                  <img src={r.imageUrl} className="w-full aspect-square object-cover" alt={r.label} />
                  <div className="p-3 text-sm">
                    <div className="font-medium">{r.label}</div>
                    <a href={r.imageUrl} download={`${r.label}.jpg`} className="text-xs text-blue-400 hover:underline">Download JPG</a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="text-center text-xs text-zinc-500 mt-12">
          Upload photos → consistent subject from all of them (used as references) → click to generate variations (clothes + backgrounds per the 6 styles) → download real photos from this site.
        </div>
      </div>
    </div>
  );
}
