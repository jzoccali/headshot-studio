import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  AB_LOOK_IDS,
  buildPrompt,
  openaiEditParams,
  parseImageEditStream,
  type OpenAIVariant,
} from '../lib/generation.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'ab-results');
const VARIANTS: OpenAIVariant[] = ['legacy', 'image2'];
const SOURCE_PATHS = [
  '/Users/jzoccali/Projects/joeyzoccali-site/public/images/joey-desk.jpg',
  '/Users/jzoccali/Projects/joeyzoccali-site/public/images/joey-coaching.jpg',
];

function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eq = trimmed.indexOf('=');
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

async function normalizeJpeg(filePath: string): Promise<Buffer> {
  return sharp(filePath)
    .rotate()
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function generateOne(
  apiKey: string,
  lookId: string,
  variant: OpenAIVariant,
  refs: Buffer[],
): Promise<{ bytes: Buffer; ms: number; error?: string }> {
  const params = openaiEditParams(variant);
  const prompt = buildPrompt(lookId, variant);

  const started = Date.now();
  let lastError = 'unknown error';
  for (let attempt = 0; attempt < 3; attempt++) {
    const form = new FormData();
    form.append('model', params.model);
    form.append('prompt', prompt);
    form.append('size', params.size);
    form.append('quality', params.quality);
    if (params.input_fidelity) {
      form.append('input_fidelity', params.input_fidelity);
    }
    if (variant === 'image2') {
      form.append('stream', 'true');
      form.append('partial_images', '2');
    }
    refs.forEach((buf, i) => {
      form.append('image[]', new Blob([new Uint8Array(buf)], { type: 'image/jpeg' }), `ref-${i}.jpg`);
    });
    try {
      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
      const ms = Date.now() - started;
      if (!res.ok) {
        const errText = await res.text();
        lastError = errText.slice(0, 300) || `HTTP ${res.status}`;
        if (res.status >= 500 || res.status === 429) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        return { bytes: Buffer.alloc(0), ms, error: lastError };
      }
      if (variant === 'image2') {
        const sseText = await res.text();
        const b64 = parseImageEditStream(sseText);
        return { bytes: Buffer.from(b64, 'base64'), ms };
      }
      const json = await res.json() as {
        error?: { message?: string };
        data?: Array<{ b64_json?: string }>;
      };
      if (!json.data?.[0]?.b64_json) {
        lastError = json.error?.message || `HTTP ${res.status}`;
        return { bytes: Buffer.alloc(0), ms, error: lastError };
      }
      return { bytes: Buffer.from(json.data[0].b64_json, 'base64'), ms };
    } catch (err: any) {
      lastError = err?.cause?.code || err?.message || String(err);
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  return { bytes: Buffer.alloc(0), ms: Date.now() - started, error: lastError };
}

function writeCompareHtml(rows: Array<{
  lookId: string;
  legacyFile: string | null;
  image2File: string | null;
  legacyMs: number;
  image2Ms: number;
  legacyError?: string;
  image2Error?: string;
}>) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Headshot A/B — GPT 1.5 square vs GPT 2 portrait</title>
  <style>
    body { margin: 0; background: #111; color: #eee; font-family: ui-sans-serif, system-ui, sans-serif; }
    header { padding: 24px 32px; border-bottom: 1px solid #333; }
    h1 { margin: 0 0 8px; font-size: 22px; }
    p { margin: 0; color: #aaa; max-width: 720px; }
    .refs { display: flex; gap: 12px; padding: 20px 32px; }
    .refs img { height: 160px; border-radius: 12px; object-fit: cover; }
    .row { display: grid; grid-template-columns: 180px 1fr 1fr; gap: 16px; padding: 20px 32px; border-top: 1px solid #2a2a2a; align-items: start; }
    .row h2 { margin: 0 0 6px; font-size: 16px; }
    .meta { color: #888; font-size: 12px; }
    figure { margin: 0; }
    figcaption { margin-top: 8px; font-size: 12px; color: #aaa; }
    img.result { width: 100%; border-radius: 12px; background: #1a1a1a; }
    .err { color: #f66; font-size: 13px; }
  </style>
</head>
<body>
  <header>
    <h1>Four-look A/B</h1>
    <p>Same two source photos. Left: current app (gpt-image-1.5, 1024×1024, prose prompt). Right: GPT Image 2 portrait (1024×1536, identity-first protocol).</p>
  </header>
  <div class="refs">
    <img src="refs/joey-desk.jpg" alt="source desk" />
    <img src="refs/joey-coaching.jpg" alt="source coaching" />
  </div>
  ${rows.map((row) => `
  <div class="row">
    <div>
      <h2>${row.lookId}</h2>
      <div class="meta">legacy ${row.legacyMs}ms<br/>image2 ${row.image2Ms}ms</div>
    </div>
    <figure>
      ${row.legacyFile ? `<img class="result" src="${row.legacyFile}" alt="${row.lookId} 1.5" />` : `<div class="err">${row.legacyError || 'missing'}</div>`}
      <figcaption>1.5 square</figcaption>
    </figure>
    <figure>
      ${row.image2File ? `<img class="result" src="${row.image2File}" alt="${row.lookId} 2" />` : `<div class="err">${row.image2Error || 'missing'}</div>`}
      <figcaption>2 portrait</figcaption>
    </figure>
  </div>`).join('')}
</body>
</html>`;
  fs.writeFileSync(path.join(OUT_DIR, 'compare.html'), html);
}

async function main() {
  loadEnv(path.join(ROOT, '.env.local'));
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  fs.mkdirSync(path.join(OUT_DIR, 'refs'), { recursive: true });
  const refs: Buffer[] = [];
  for (const src of SOURCE_PATHS) {
    const buf = await normalizeJpeg(src);
    const destName = path.basename(src).replace(/jpeg$/i, 'jpg');
    fs.writeFileSync(path.join(OUT_DIR, 'refs', destName), buf);
    refs.push(buf);
  }

  const rows = [];
  for (const lookId of AB_LOOK_IDS) {
    const row: {
      lookId: string;
      legacyFile: string | null;
      image2File: string | null;
      legacyMs: number;
      image2Ms: number;
      legacyError?: string;
      image2Error?: string;
    } = {
      lookId,
      legacyFile: null,
      image2File: null,
      legacyMs: 0,
      image2Ms: 0,
    };

    for (const variant of VARIANTS) {
      const file = `${lookId}--${variant}.jpg`;
      const existing = path.join(OUT_DIR, file);
      if (fs.existsSync(existing) && fs.statSync(existing).size > 0) {
        console.log(`Skipping ${file} (already exists)`);
        if (variant === 'legacy') row.legacyFile = file;
        else row.image2File = file;
        continue;
      }
      console.log(`Generating ${lookId} / ${variant}...`);
      const result = await generateOne(apiKey, lookId, variant, refs);
      const key = variant === 'legacy' ? 'legacy' : 'image2';
      row[`${key}Ms` as 'legacyMs' | 'image2Ms'] = result.ms;
      if (result.error) {
        console.error(`  FAIL ${lookId}/${variant}: ${result.error}`);
        if (variant === 'legacy') row.legacyError = result.error;
        else row.image2Error = result.error;
      } else {
        const file = `${lookId}--${variant}.jpg`;
        fs.writeFileSync(path.join(OUT_DIR, file), result.bytes);
        console.log(`  ok ${file} (${result.ms}ms, ${result.bytes.length} bytes)`);
        if (variant === 'legacy') row.legacyFile = file;
        else row.image2File = file;
      }
    }
    rows.push(row);
    writeCompareHtml(rows);
  }

  writeCompareHtml(rows);
  console.log(`Wrote ${path.join(OUT_DIR, 'compare.html')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
