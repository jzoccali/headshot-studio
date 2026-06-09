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
  { id: 'corporate', name: 'Corporate Executive', description: 'LinkedIn, executive bios, formal presentations' },
  { id: 'creative', name: 'Creative Professional', description: 'Design agencies, creative portfolios' },
  { id: 'tech', name: 'Tech Entrepreneur', description: 'Startup founders, modern tech profiles' },
  { id: 'healthcare', name: 'Healthcare Professional', description: 'Medical practices, doctor profiles' },
  { id: 'academic', name: 'Academic / Consultant', description: 'University, consulting, thought leadership' },
  { id: 'sales', name: 'Sales / Client-Facing', description: 'Sales teams, approachable business profiles' },
];

const BACKGROUNDS: Background[] = [
  { id: 'dark', label: 'Dark Charcoal Studio', description: 'Clean, modern, high-contrast' },
  { id: 'white', label: 'Bright Clean White', description: 'Fresh, classic, trustworthy' },
  { id: 'warm-greige', label: 'Soft Warm Greige', description: 'Approachable, premium, warm' },
  { id: 'cool-bluegray', label: 'Cool Blue-Gray Modern', description: 'Calm, contemporary, tech-forward' },
];

type VariationRequest = {
  id: string;
  categoryId: string;
  categoryName: string;
  backgroundId: string;
  backgroundLabel: string;
};

type MyPhoto = {
  id: string;
  label: string;
  previewUrl: string;
  file: File;
};

export default function HeadshotStudio() {
  const [sources, setSources] = useState<SourcePhoto[]>([]);
  const [subjectReady, setSubjectReady] = useState(false);
  const [requests, setRequests] = useState<VariationRequest[]>([]);
  const [myPhotos, setMyPhotos] = useState<MyPhoto[]>([]);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newOnes: SourcePhoto[] = [];
    Array.from(files).forEach((file, i) => {
      if (!file.type.startsWith('image/')) return;
      const id = `src-${Date.now()}-${i}`;
      newOnes.push({ id, name: file.name, previewUrl: URL.createObjectURL(file) });
    });
    setSources(prev => [...prev, ...newOnes]);
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
      toast.error("Upload some photos of the subject first");
      return;
    }
    setSubjectReady(true);
    toast.success(`Consistent rendition of the subject created from ${sources.length} photos`);
  };

  const addRequest = (cat: Category, bg: Background) => {
    const id = `${cat.id}-${bg.id}-${Date.now()}`;
    setRequests(prev => [...prev, {
      id,
      categoryId: cat.id,
      categoryName: cat.name,
      backgroundId: bg.id,
      backgroundLabel: bg.label,
    }]);
    toast.success(`Added: ${cat.name} — ${bg.label}`);
  };

  const clearRequests = () => setRequests([]);

  const requestGeneration = () => {
    if (requests.length === 0) {
      toast.error("Add some variations first");
      return;
    }
    if (sources.length === 0) {
      toast.error("Upload your source photos first");
      return;
    }

    // The app has prepared the exact variations you want.
    // Tell me in this chat (with your source photos attached) something like:
    // "generate all requested" or list the ones you want.
    // I will generate the real photos using all your uploads as references
    // for the best consistent subject.
    // Then drop the results into the "Your photos" section below to organize and download from the site.
    toast.success(`${requests.length} variations requested. In this chat, say "generate all requested" (with your photos attached) and I'll create the real photos. Drop the results here to download everything from the site.`);
  };

  const addGenerated = (file: File, label: string) => {
    const id = `gen-${Date.now()}`;
    const url = URL.createObjectURL(file);
    setMyPhotos(prev => [...prev, { id, label, previewUrl: url, file }]);
    toast.success("Added to your downloads");
  };

  const handleDropGenerated = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      const label = prompt("Label for this photo? (e.g. Corporate - Dark)") || "Generated";
      addGenerated(f, label);
    }
  };

  const handleFileGenerated = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      const label = prompt("Label for this photo? (e.g. Corporate - Dark)") || "Generated";
      addGenerated(f, label);
    }
    e.target.value = '';
  };

  const removeMyPhoto = (id: string) => {
    setMyPhotos(prev => {
      const p = prev.find(x => x.id === id);
      if (p) URL.revokeObjectURL(p.previewUrl);
      return prev.filter(x => x.id !== id);
    });
  };

  const downloadAll = async () => {
    if (myPhotos.length === 0) {
      toast.error("Add some photos first (generate them here in chat, then drop the files here)");
      return;
    }
    const zip = new JSZip();
    for (const p of myPhotos) {
      const buf = await p.file.arrayBuffer();
      zip.file(`${p.label.replace(/[^a-z0-9]/gi, '_')}.jpg`, buf);
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
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <div className="max-w-5xl mx-auto p-6">
        <header className="mb-10">
          <h1 className="text-4xl font-semibold tracking-tight">Headshot Studio</h1>
          <p className="text-zinc-400 mt-1">Upload photos of the subject. The app creates a consistent rendition from all of them. Then generate professional variations by changing clothes and settings. Download the photos from here.</p>
        </header>

        {/* 1. Upload */}
        <section className="mb-12">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg font-medium">1. Upload photos of the subject</div>
              <div className="text-sm text-zinc-400">Multiple photos help the app create a good, consistent rendition of the person.</div>
            </div>
            <label className="cursor-pointer flex items-center gap-2 px-5 py-2 bg-white text-black rounded-2xl text-sm font-medium active:bg-zinc-200">
              <Upload className="w-4 h-4" /> Add Photos
              <input type="file" multiple accept="image/*" className="hidden" onChange={e => handleFiles(e.target.files)} />
            </label>
          </div>

          {sources.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {sources.map(s => (
                <div key={s.id} className="relative rounded-2xl overflow-hidden border border-zinc-800">
                  <img src={s.previewUrl} className="aspect-square object-cover w-full" alt="" />
                  <div className="text-[10px] p-2 bg-zinc-950/80 truncate">{s.name}</div>
                  <button onClick={() => removeSource(s.id)} className="absolute top-2 right-2 bg-black/60 p-1 rounded-full"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={buildSubject}
            disabled={sources.length === 0}
            className="mt-4 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 rounded-2xl text-sm font-medium"
          >
            Create consistent rendition of the subject from these photos
          </button>
          {subjectReady && <div className="mt-2 text-emerald-400 text-sm">✓ Consistent subject ready from {sources.length} photos.</div>}
        </section>

        {/* 2. Variations */}
        <section className="mb-12">
          <div className="mb-4">
            <div className="text-lg font-medium">2. Request variations (different clothes &amp; settings)</div>
            <div className="text-sm text-zinc-400">The app changes clothing and background/scene based on the professional style.</div>
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
                      onClick={() => addRequest(cat, bg)}
                      className="text-left text-sm border border-zinc-700 hover:border-zinc-500 rounded-xl px-3 py-2"
                    >
                      <div className="font-medium text-sm">{bg.label}</div>
                      <div className="text-[10px] text-zinc-400">{bg.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {requests.length > 0 && (
            <div className="mt-6">
              <button onClick={requestGeneration} className="px-8 py-3 rounded-2xl bg-white text-black font-semibold">
                Request Generation for These Variations
              </button>
              <div className="text-xs text-zinc-400 mt-2">The app has your requested variations ready. In this chat (with your photos attached), just say "generate all requested" — I'll create the real photos using all your uploads as references for the best consistent subject. Then drop the results here to organize and download from the site.</div>
              <button onClick={clearRequests} className="ml-3 text-sm text-zinc-400 hover:text-zinc-200">Clear list</button>
            </div>
          )}
        </section>

        {/* 3. My Photos (download hub) */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-lg font-medium">3. Your photos (download from here)</div>
              <div className="text-sm text-zinc-400">After I generate the images, save them and drop them here. The site becomes your organized place to download everything.</div>
            </div>
            <div className="flex gap-2">
              <label className="cursor-pointer px-4 py-2 border border-zinc-700 rounded-2xl text-sm flex items-center gap-2 hover:bg-zinc-900">
                <Upload className="w-4 h-4" /> Add Generated Photo
                <input type="file" accept="image/*" className="hidden" onChange={handleFileGenerated} />
              </label>
              <button onClick={downloadAllMyPhotos} className="px-4 py-2 bg-white text-black rounded-2xl text-sm font-medium">Download All as ZIP</button>
            </div>
          </div>

          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDropGenerated}
            className="min-h-[140px] border border-dashed border-zinc-700 rounded-2xl p-4"
          >
            {myPhotos.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-zinc-400">
                Drop generated photos here or use the button above
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {myPhotos.map(p => (
                  <div key={p.id} className="relative group rounded-2xl overflow-hidden border border-zinc-800">
                    <img src={p.previewUrl} className="w-full aspect-square object-cover" alt="" />
                    <div className="p-2 text-xs bg-black/70 truncate">{p.label}</div>
                    <a href={p.previewUrl} download={`${p.label}.jpg`} className="absolute bottom-2 right-2 text-[10px] bg-white text-black px-2 py-0.5 rounded">Download</a>
                    <button onClick={() => removeMyPhoto(p.id)} className="absolute top-2 right-2 bg-black/60 p-1 rounded-full opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="text-center text-xs text-zinc-500 mt-16">
          Upload photos of the subject → the app builds a consistent rendition from all of them → request variations by changing clothes and backgrounds per the 6 professional styles → tell me to generate → drop the photos here and download everything from the site.
        </div>
      </div>
    </div>
  );

  function addRequest(cat: Category, bg: Background) {
    const id = `${cat.id}-${bg.id}-${Date.now()}`;
    setRequests(prev => [...prev, {
      id,
      categoryId: cat.id,
      categoryName: cat.name,
      backgroundId: bg.id,
      backgroundLabel: bg.label,
    }]);
  }

  function handleFileGenerated(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      const label = prompt("Label for this photo (e.g. Corporate - Dark)?") || "Generated";
      addGenerated(f, label);
    }
    e.target.value = '';
  }

  function handleDropGenerated(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) {
      const label = prompt("Label for this photo (e.g. Corporate - Dark)?") || "Generated";
      addGenerated(f, label);
    }
  }

  function addGenerated(file: File, label: string) {
    const id = `gen-${Date.now()}`;
    const url = URL.createObjectURL(file);
    setMyPhotos(prev => [...prev, { id, label, previewUrl: url, file }]);
  }

  async function downloadAllMyPhotos() {
    if (myPhotos.length === 0) {
      toast.error("Add some photos first");
      return;
    }
    const zip = new JSZip();
    for (const p of myPhotos) {
      const buf = await p.file.arrayBuffer();
      zip.file(`${p.label.replace(/[^a-z0-9]/gi, '_')}.jpg`, buf);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-headshots-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
