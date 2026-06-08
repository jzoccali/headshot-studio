"use client";

import React, { useState, useRef } from 'react';
import { Upload, X, Download, Copy, Play, AlertCircle } from 'lucide-react';
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
  baseClothing: string;
  basePrompt: string;
};

type Background = {
  id: string;
  label: string;
  description: string;
  sentence: string;
};

const CATEGORIES: Category[] = [
  {
    id: 'corporate',
    name: 'Corporate Executive',
    description: 'LinkedIn, executive bios, formal presentations',
    baseClothing: 'premium navy business suit, crisp white dress shirt, understated tie',
    basePrompt: `Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a confident, authoritative expression, and the subject’s body is positioned at a slight 3/4 angle to the camera. They are styled for a professional photo studio shoot, wearing a premium navy business suit with a crisp white dress shirt and understated tie.`
  },
  {
    id: 'creative',
    name: 'Creative Professional',
    description: 'Design agencies, creative portfolios, artistic profiles',
    baseClothing: 'well-fitted black turtleneck with contemporary texture',
    basePrompt: `Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a warm, creative expression, and the subject’s body is positioned at a subtle angle with one shoulder slightly forward. They are styled for a professional photo studio shoot, wearing a well-fitted black turtleneck with a contemporary texture.`
  },
  {
    id: 'tech',
    name: 'Tech Entrepreneur',
    description: 'Startup founders, tech company profiles, modern business',
    baseClothing: 'modern henley shirt in heather gray with rolled sleeves',
    basePrompt: `Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a relaxed, approachable expression, and the subject’s body is casually positioned with a slight lean. They are styled for a professional photo studio shoot, wearing a modern henley shirt in heather gray with rolled sleeves.`
  },
  {
    id: 'healthcare',
    name: 'Healthcare Professional',
    description: 'Medical practices, healthcare websites, doctor profiles',
    baseClothing: 'crisp white medical coat over a light blue collared shirt',
    basePrompt: `Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a trustworthy, compassionate expression, and the subject’s body is positioned directly facing the camera with excellent posture. They are styled for a professional photo studio shoot, wearing a crisp white medical coat over a light blue collared shirt.`
  },
  {
    id: 'academic',
    name: 'Academic / Consultant',
    description: 'University profiles, consulting, thought leadership',
    baseClothing: 'classic tweed sport coat over a cream-colored sweater',
    basePrompt: `Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a thoughtful, intellectual expression, and the subject’s body is positioned with a slight thoughtful tilt. They are styled for a professional photo studio shoot, wearing a classic tweed sport coat over a cream-colored sweater.`
  },
  {
    id: 'sales',
    name: 'Sales / Client-Facing',
    description: 'Sales teams, customer success, approachable business profiles',
    baseClothing: 'smart business casual cardigan in charcoal over a white blouse',
    basePrompt: `Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a warm, welcoming smile, and the subject’s body is positioned with an open, approachable stance. They are styled for a professional photo studio shoot, wearing a smart business casual cardigan in charcoal over a white blouse.`
  }
];

const BACKGROUNDS: Background[] = [
  {
    id: 'dark',
    label: 'Dark Charcoal Studio',
    description: 'Solid #141414 — clean, modern, high-contrast',
    sentence: "The background is a solid ‘#141414’ dark neutral studio."
  },
  {
    id: 'white',
    label: 'Bright Clean White',
    description: 'Seamless white — fresh, classic, trustworthy',
    sentence: "The background is a clean bright white seamless studio backdrop with soft even illumination."
  },
  {
    id: 'warm-greige',
    label: 'Soft Warm Greige',
    description: 'Warm neutral beige — approachable, premium',
    sentence: "The background is a soft warm neutral greige studio wall with gentle light falloff and subtle texture."
  },
  {
    id: 'cool-bluegray',
    label: 'Cool Blue-Gray Modern',
    description: 'Soft contemporary blue-gray — calm, tech-forward',
    sentence: "The background is a modern cool soft blue-gray studio wall with faint architectural depth."
  }
];

type Job = {
  id: string;
  sourceId: string;
  sourceName: string;
  categoryId: string;
  categoryName: string;
  backgroundId: string;
  backgroundLabel: string;
  prompt: string;
};

export default function HeadshotStudio() {
  const [sources, setSources] = useState<SourcePhoto[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(CATEGORIES.map(c => c.id));
  const [selectedBackgroundIds, setSelectedBackgroundIds] = useState<string[]>(BACKGROUNDS.map(b => b.id));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const newSources: SourcePhoto[] = [];

    Array.from(files).forEach((file, index) => {
      if (!file.type.startsWith('image/')) return;

      const id = `src-${Date.now()}-${index}`;
      const previewUrl = URL.createObjectURL(file);

      newSources.push({
        id,
        name: file.name,
        previewUrl,
      });
    });

    setSources(prev => [...prev, ...newSources]);
    toast.success(`Added ${newSources.length} photo${newSources.length > 1 ? 's' : ''}`);
  };

  const removeSource = (id: string) => {
    setSources(prev => {
      const toRemove = prev.find(s => s.id === id);
      if (toRemove) {
        URL.revokeObjectURL(toRemove.previewUrl);
      }
      return prev.filter(s => s.id !== id);
    });
    // Also remove any jobs using this source
    setJobs(prev => prev.filter(j => j.sourceId !== id));
  };

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleBackground = (id: string) => {
    setSelectedBackgroundIds(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const selectAllCategories = () => setSelectedCategoryIds(CATEGORIES.map(c => c.id));
  const clearCategories = () => setSelectedCategoryIds([]);

  const selectAllBackgrounds = () => setSelectedBackgroundIds(BACKGROUNDS.map(b => b.id));
  const clearBackgrounds = () => setSelectedBackgroundIds([]);

  const buildJobs = () => {
    if (sources.length === 0) {
      toast.error("Please upload at least one source photo");
      return;
    }
    if (selectedCategoryIds.length === 0 || selectedBackgroundIds.length === 0) {
      toast.error("Please select at least one category and one background");
      return;
    }

    setIsPreparing(true);

    const newJobs: Job[] = [];

    sources.forEach(source => {
      selectedCategoryIds.forEach(catId => {
        const category = CATEGORIES.find(c => c.id === catId)!;
        
        selectedBackgroundIds.forEach(bgId => {
          const background = BACKGROUNDS.find(b => b.id === bgId)!;

          // Inject background into the prompt
          const fullPrompt = `${category.basePrompt} ${background.sentence} Shot from a high angle with bright and airy soft, diffused studio lighting, gently illuminating the face and creating a subtle catchlight in the eyes. Captured on an 85mm f/1.8 lens with a shallow depth of field, exquisite focus on the eyes, and beautiful, soft bokeh. Observe crisp detail on the fabric texture, individual strands of hair, and natural, realistic skin texture. The atmosphere exudes confidence and professionalism. Clean and bright cinematic color grading with subtle warmth and balanced tones.`;

          newJobs.push({
            id: `job-${source.id}-${catId}-${bgId}`,
            sourceId: source.id,
            sourceName: source.name,
            categoryId: catId,
            categoryName: category.name,
            backgroundId: bgId,
            backgroundLabel: background.label,
            prompt: fullPrompt,
          });
        });
      });
    });

    setJobs(newJobs);
    setIsPreparing(false);

    toast.success(`Prepared ${newJobs.length} generation jobs`);
  };

  const downloadPromptPackage = async () => {
    if (jobs.length === 0) {
      toast.error("Build jobs first");
      return;
    }

    const zip = new JSZip();
    const folder = zip.folder("headshot-jobs");

    if (!folder) return;

    jobs.forEach((job, index) => {
      const filename = `${(index + 1).toString().padStart(3, '0')}-${job.categoryId}-${job.backgroundId}.txt`;
      folder.file(filename, job.prompt);
    });

    // Add a manifest
    const manifest = {
      totalJobs: jobs.length,
      sources: sources.map(s => s.name),
      categories: selectedCategoryIds,
      backgrounds: selectedBackgroundIds,
      generatedAt: new Date().toISOString(),
    };
    folder.file("manifest.json", JSON.stringify(manifest, null, 2));

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `headshot-jobs-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Downloaded prompt package with ${jobs.length} jobs`);
  };

  const copyBatchForGrok = () => {
    if (jobs.length === 0 || sources.length === 0) {
      toast.error("Build jobs first");
      return;
    }

    let message = `Please generate the following professional headshot variations using my source photos.\n\n`;
    message += `Source photos (${sources.length}):\n`;
    sources.forEach((s, i) => {
      message += `${i + 1}. ${s.name}\n`;
    });
    message += `\nTotal jobs: ${jobs.length}\n\n`;
    message += `Instructions: For each job below, use the corresponding source photo as the reference image and apply the full prompt exactly. Maintain the exact facial structure and identity. Use the 85mm f/1.8 style described.\n\n`;

    jobs.forEach((job, index) => {
      message += `--- Job ${index + 1} ---\n`;
      message += `Source: ${job.sourceName}\n`;
      message += `Category: ${job.categoryName}\n`;
      message += `Background: ${job.backgroundLabel}\n`;
      message += `Prompt:\n${job.prompt}\n\n`;
    });

    message += `Please generate them as high-quality professional JPGs and show me the results.`;

    navigator.clipboard.writeText(message).then(() => {
      toast.success("Batch instructions copied! Paste this in the chat and attach your source photos.");
    }).catch(() => {
      // fallback
      prompt("Copy this text:", message);
    });
  };

  const clearAll = () => {
    sources.forEach(s => URL.revokeObjectURL(s.previewUrl));
    setSources([]);
    setJobs([]);
    setSelectedCategoryIds(CATEGORIES.map(c => c.id));
    setSelectedBackgroundIds(BACKGROUNDS.map(b => b.id));
    toast.info("Cleared everything");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <div className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Headshot Studio</h1>
            <p className="text-sm text-zinc-400 -mt-0.5">Upload sources → prepare rich prompt jobs → get real photos</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full">
              Prompts only in local app • Photos via Grok image model
            </div>
            <button
              onClick={clearAll}
              className="px-4 py-1.5 rounded-full border border-zinc-700 hover:bg-zinc-900 text-sm flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Clear All
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Explanation */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 text-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium text-amber-300">How this works</div>
              <div className="text-zinc-400 mt-1 leading-relaxed">
                This app prepares high-quality <strong>prompt jobs</strong> (the creative instructions).<br />
                The actual JPG photos are generated by sending the jobs + your source photos to me (Grok) in this chat, where I use the image model.
                The old localhost thing only ever made text files — this new version is much clearer about that.
              </div>
            </div>
          </div>
        </div>

        {/* Upload */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-medium">Source Photos</div>
              <div className="text-xs text-zinc-400">Upload 1–6 photos of the same person (different angles/lighting is fine)</div>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-2xl text-sm font-medium hover:bg-zinc-200 active:bg-white transition"
            >
              <Upload className="w-4 h-4" /> Upload Photos
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {sources.length === 0 ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-3xl h-48 flex flex-col items-center justify-center cursor-pointer text-center"
            >
              <Upload className="w-8 h-8 mb-3 text-zinc-400" />
              <div>Drop photos here or click to upload</div>
              <div className="text-xs text-zinc-500 mt-1">Best results with clear, well-lit faces</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {sources.map(source => (
                <div key={source.id} className="relative group bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                  <img src={source.previewUrl} alt={source.name} className="w-full aspect-square object-cover" />
                  <div className="p-3 text-xs truncate border-t border-zinc-800 bg-zinc-950/80">{source.name}</div>
                  <button
                    onClick={() => removeSource(source.id)}
                    className="absolute top-2 right-2 bg-black/70 hover:bg-black p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Categories */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium">Categories (6 professional looks)</div>
            <div className="flex gap-2 text-xs">
              <button onClick={selectAllCategories} className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 rounded-full border border-zinc-700">All</button>
              <button onClick={clearCategories} className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 rounded-full border border-zinc-700">None</button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {CATEGORIES.map(cat => {
              const isSelected = selectedCategoryIds.includes(cat.id);
              return (
                <div
                  key={cat.id}
                  onClick={() => toggleCategory(cat.id)}
                  className={`border rounded-2xl p-4 cursor-pointer transition ${isSelected ? 'border-blue-500 bg-zinc-900' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950'}`}
                >
                  <div className="font-semibold">{cat.name}</div>
                  <div className="text-xs text-zinc-400 mt-1">{cat.description}</div>
                  <div className="text-[10px] mt-2 text-zinc-500">Clothing: {cat.baseClothing}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Backgrounds */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-medium">Background Variations</div>
              <div className="text-xs text-zinc-400">Choose which studio backgrounds to generate</div>
            </div>
            <div className="flex gap-2 text-xs">
              <button onClick={selectAllBackgrounds} className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 rounded-full border border-zinc-700">All 4</button>
              <button onClick={clearBackgrounds} className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 rounded-full border border-zinc-700">None</button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {BACKGROUNDS.map(bg => {
              const isSelected = selectedBackgroundIds.includes(bg.id);
              return (
                <div
                  key={bg.id}
                  onClick={() => toggleBackground(bg.id)}
                  className={`border rounded-2xl p-4 cursor-pointer transition ${isSelected ? 'border-blue-500 bg-zinc-900' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950'}`}
                >
                  <div className="font-semibold text-sm">{bg.label}</div>
                  <div className="text-xs text-zinc-400 mt-1">{bg.description}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={buildJobs}
            disabled={sources.length === 0 || selectedCategoryIds.length === 0 || selectedBackgroundIds.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-2xl font-semibold disabled:opacity-50 hover:bg-zinc-200 transition"
          >
            <Play className="w-4 h-4" /> Build Job List ({sources.length} sources × {selectedCategoryIds.length} categories × {selectedBackgroundIds.length} backgrounds)
          </button>

          <button
            onClick={downloadPromptPackage}
            disabled={jobs.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-2xl disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Download Prompt Package (ZIP)
          </button>

          <button
            onClick={copyBatchForGrok}
            disabled={jobs.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl font-medium disabled:opacity-50"
          >
            <Copy className="w-4 h-4" /> Copy Batch Instructions for Grok
          </button>
        </div>

        {/* Jobs Preview */}
        {jobs.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-semibold">Prepared Jobs — {jobs.length} total</div>
                <div className="text-xs text-zinc-400">Each job = one source photo + one category + one background</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[520px] overflow-auto pr-2 custom-scroll">
              {jobs.map((job, idx) => (
                <div key={job.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{job.categoryName}</div>
                      <div className="text-xs text-zinc-400">{job.backgroundLabel}</div>
                    </div>
                    <div className="text-[10px] text-zinc-500">#{idx + 1}</div>
                  </div>
                  <div className="text-xs mt-2 text-zinc-400">Source: {job.sourceName}</div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-blue-400 hover:text-blue-300">View full prompt</summary>
                    <div className="mt-2 text-[10px] text-zinc-400 whitespace-pre-wrap font-mono bg-black/40 p-3 rounded max-h-48 overflow-auto">
                      {job.prompt}
                    </div>
                  </details>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-black/40 border border-zinc-800 rounded-2xl text-sm">
              <div className="font-medium mb-2">Next step to get the actual JPG photos:</div>
              <ol className="list-decimal list-inside text-zinc-300 space-y-1 text-sm">
                <li>Click “Copy Batch Instructions for Grok” above</li>
                <li>Attach your source photo(s) in this chat</li>
                <li>Paste the instructions and send</li>
              </ol>
              <div className="text-xs text-zinc-500 mt-3">
                I will then run the image edits in batches and return the real generated headshots.
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-zinc-500 pt-8">
          This is the proper foundation for the small SaaS you described. We can add real image API integration (Replicate / Fal / xAI), auth, storage, and billing later.
        </div>
      </div>
    </div>
  );
}
