import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import {
  LOOKS,
  buildPrompt,
  openaiEditParams,
  parseImageEditStream,
  type OpenAIVariant,
} from '@/lib/generation';

export const maxDuration = 300;

// Uses Grok / xAI Imagine for reference-based editing (preserve likeness from your uploaded photos
// while applying the exact premium clothing, lighting, expression, and background variations).
// Calls the public xAI API with XAI_API_KEY. Supports up to 3 reference images per edit for strong composite identity lock.

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      references,
      categoryId,
      backgroundId,
      label,
      engine = 'xai',
      openaiVariant = 'legacy',
    } = body as {
      references: string[];
      categoryId: string;
      backgroundId: string;
      label?: string;
      engine?: 'xai' | 'openai';
      openaiVariant?: OpenAIVariant;
    };
    const variant: OpenAIVariant = openaiVariant === 'image2' ? 'image2' : 'legacy';

    if (engine === 'openai' && !process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        error: 'OPENAI_API_KEY is not configured. Add it in Vercel environment variables and redeploy to use the GPT engine.'
      }, { status: 500 });
    }
    if (engine !== 'openai' && !process.env.XAI_API_KEY) {
      console.error('XAI_API_KEY is not set in environment');
      return NextResponse.json({
        error: 'XAI_API_KEY is not configured. Add XAI_API_KEY in Vercel environment variables (and .env.local for local dev) and redeploy. [xai-v3b3dbd8]'
      }, { status: 500 });
    }

    if (!references || references.length === 0) {
      return NextResponse.json({ error: 'No reference images provided' }, { status: 400 });
    }
    if (!categoryId || !backgroundId) {
      return NextResponse.json({ error: 'Missing category or background' }, { status: 400 });
    }

    // backgroundId carries the look id; categoryId is the collection (labeling only).
    if (!LOOKS[backgroundId]) {
      return NextResponse.json({ error: 'Invalid look' }, { status: 400 });
    }

    const fullPrompt = buildPrompt(backgroundId, engine === 'openai' ? variant : 'legacy');

    // Sanitize: only keep real string URLs (frontend can send bad data on upload failures or removes).
    // xAI requires actual http(s) strings for image.url — null/undefined/empty will 422.
    const validReferences: string[] = (references || []).filter(
      (r): r is string => typeof r === 'string' && r.length > 0 && r.startsWith('http')
    );

    if (validReferences.length === 0) {
      return NextResponse.json({ 
        error: 'No valid reference photos. Please re-upload your source images and try again.' 
      }, { status: 400 });
    }

    const refUrls = validReferences.slice(0, 3);

    // Pre-validate references (HEAD) and convert to inline base64 data URIs.
    // This way xAI never has to fetch the URLs itself (avoids the "Fetching image failed 404" errors
    // when the Blob store the photos live in is not the currently connected one, or transient access issues).
    // If any reference is bad, we give a clear message telling the user to re-upload after the correct store is connected.
    const referenceImages: string[] = [];
    const referenceBuffers: ArrayBuffer[] = [];
    for (const refUrl of refUrls) {
      try {
        const head = await fetch(refUrl, { method: 'HEAD' });
        if (!head.ok) {
          return NextResponse.json({ 
            error: `One of your source photos is no longer accessible (HTTP ${head.status}). This usually means the photos were uploaded before the correct Blob store was connected in the Vercel dashboard. Please re-upload your original photos now (after confirming the "headshot-photos" store is connected with the read-write token), then try generating again.` 
          }, { status: 400 });
        }

        const imgRes = await fetch(refUrl);
        if (!imgRes.ok) {
          return NextResponse.json({ 
            error: `Failed to read one of your source photos (HTTP ${imgRes.status}). Please re-upload.` 
          }, { status: 400 });
        }
        const arrayBuffer = await imgRes.arrayBuffer();
        referenceBuffers.push(arrayBuffer);
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        referenceImages.push(`data:image/jpeg;base64,${base64}`);
      } catch (e) {
        return NextResponse.json({ 
          error: 'Failed to process one of your source photos. Please re-upload your original photos and try again.' 
        }, { status: 400 });
      }
    }

    // ── GPT engine (OpenAI gpt-image-1.5) — A/B alternative to xAI ──
    // input_fidelity 'high' tells the model to stay faithful to the reference faces.
    if (engine === 'openai') {
      // OpenAI strictly validates reference files (rejects HEIC, CMYK, odd modes — formats
      // xAI tolerates). Normalize every reference to a clean sRGB JPEG; skip any that can't
      // be decoded rather than failing the whole generation.
      const sharp = (await import('sharp')).default;
      const normalized: Buffer[] = [];
      for (const buf of referenceBuffers) {
        try {
          const jpeg = await sharp(Buffer.from(buf))
            .rotate() // respect EXIF orientation
            .flatten({ background: '#ffffff' }) // remove alpha
            .jpeg({ quality: 95 })
            .toBuffer();
          normalized.push(jpeg);
        } catch (e) {
          console.warn('Skipping reference OpenAI cannot read (unsupported format):', e);
        }
      }
      if (normalized.length === 0) {
        return NextResponse.json({
          error: 'None of your reference photos are in a format the GPT engine can read. Please re-upload as JPG or PNG.'
        }, { status: 400 });
      }

      const oaParams = openaiEditParams(variant);
      const form = new FormData();
      form.append('model', oaParams.model);
      form.append('prompt', fullPrompt);
      form.append('size', oaParams.size);
      form.append('quality', oaParams.quality);
      if (oaParams.input_fidelity) {
        form.append('input_fidelity', oaParams.input_fidelity);
      }
      if (variant === 'image2') {
        form.append('stream', 'true');
        form.append('partial_images', '2');
      }
      normalized.forEach((buf, i) => {
        form.append('image[]', new Blob([new Uint8Array(buf)], { type: 'image/jpeg' }), `reference-${i}.jpg`);
      });

      const oaRes = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body: form,
      });

      if (!oaRes.ok) {
        const errText = await oaRes.text().catch(() => '');
        throw new Error(`OpenAI edit failed (${oaRes.status}): ${errText.slice(0, 300)}`);
      }

      let b64: string | undefined;
      if (variant === 'image2') {
        b64 = parseImageEditStream(await oaRes.text());
      } else {
        const oaJson = await oaRes.json();
        b64 = oaJson?.data?.[0]?.b64_json;
      }
      if (!b64) throw new Error('No image returned from OpenAI');

      const oaBlob = new Blob([Buffer.from(b64, 'base64')], { type: 'image/jpeg' });
      const oaFilename = `generated/${Date.now()}-${(label || `${categoryId}-${backgroundId}`).replace(/\s+/g, '-')}.jpg`;
      const stored = await put(oaFilename, oaBlob, { access: 'public', contentType: 'image/jpeg' });

      return NextResponse.json({
        imageUrl: stored.url,
        label: label || `${categoryId} - ${backgroundId}`,
      });
    }

    const model = 'grok-imagine-image-quality';

    const editBody: any = {
      model,
      prompt: fullPrompt,
      aspect_ratio: '1:1', // square works well for the headshot gallery + consistent display
    };

    // Send references as base64 data URIs using the standard object format.
    // This tells xAI it's a data URI so it doesn't try to HTTP fetch it (prevents the 404 "Fetching image failed").
    if (referenceImages.length === 1) {
      editBody.image = { url: referenceImages[0], type: "image_url" };
    } else {
      editBody.images = referenceImages.map((b64) => ({ url: b64, type: "image_url" }));
    }

    // Call xAI with retry for transient fetch/404 errors on the reference images
    let xaiRes;
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      xaiRes = await fetch('https://api.x.ai/v1/images/edits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        },
        body: JSON.stringify(editBody),
      });

      if (xaiRes.ok) break;

      const errText = await xaiRes.text().catch(() => '');
      lastErr = new Error(`xAI edit failed (${xaiRes.status}): ${errText}`);

      // Only retry on 4xx/5xx that look like fetch/image problems (e.g. 404 on reference)
      if (!errText.includes('Fetching image failed') && !errText.includes('404')) {
        break;
      }

      if (attempt < 2) {
        const backoff = 800 * (attempt + 1);
        await new Promise(r => setTimeout(r, backoff));
      }
    }

    if (!xaiRes || !xaiRes.ok) {
      throw lastErr || new Error('xAI edit failed after retries');
    }

    const xaiJson = await xaiRes.json();
    // xAI responses typically expose .url directly (or OpenAI-compat data[0].url). Handle both.
    let generatedUrl: string | undefined =
      xaiJson?.url ||
      xaiJson?.data?.[0]?.url ||
      (Array.isArray(xaiJson) ? xaiJson[0] : undefined);

    if (!generatedUrl || typeof generatedUrl !== 'string') {
      // Fallback for base64 responses if the API returned b64_json instead of url
      const b64 = xaiJson?.b64_json || xaiJson?.data?.[0]?.b64_json;
      if (b64) {
        // Convert base64 to a blob we can store (rare for this endpoint but defensive)
        const byteCharacters = atob(b64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const imageBlob = new Blob([byteArray], { type: 'image/jpeg' });
        const filename = `generated/${Date.now()}-${(label || `${categoryId}-${backgroundId}`).replace(/\s+/g, '-')}.jpg`;
        const blob = await put(filename, imageBlob, { access: 'public', contentType: 'image/jpeg' });

        // NOTE: do NOT delete the references here. Every variation reuses the same
        // master reference, so deleting after one generation breaks all the rest.
        // Source cleanup happens via /api/cleanup when the user clears/starts over.

        return NextResponse.json({
          imageUrl: blob.url,
          label: label || `${categoryId} - ${backgroundId}`,
        });
      }
      throw new Error('No image URL (or base64) returned from xAI');
    }

    // Store the xAI result in Vercel Blob so the site has a stable public URL for downloads
    const imageResponse = await fetch(generatedUrl);
    const imageBlob = await imageResponse.blob();
    const filename = `generated/${Date.now()}-${(label || `${categoryId}-${backgroundId}`).replace(/\s+/g, '-')}.jpg`;
    const blob = await put(filename, imageBlob, {
      access: 'public',
      contentType: 'image/jpeg',
    });

    // NOTE: do NOT delete the references here. Every variation reuses the same
    // master reference, so deleting after one generation breaks all the rest
    // (causes the "source photos no longer accessible / 404" failures).
    // Privacy cleanup is handled explicitly via /api/cleanup when the user
    // clears their sources or starts a new session.

    return NextResponse.json({
      imageUrl: blob.url,
      label: label || `${categoryId} - ${backgroundId}`,
    });
  } catch (error: any) {
    console.error('Generation error:', error);
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
}
