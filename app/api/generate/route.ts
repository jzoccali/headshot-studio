import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

// Uses Grok / xAI Imagine for reference-based editing (preserve likeness from your uploaded photos
// while applying the exact premium clothing, lighting, expression, and background variations).
// Calls the public xAI API with XAI_API_KEY. Supports up to 3 reference images per edit for strong composite identity lock.

// Prompt system: each final prompt = IDENTITY preamble + per-category STYLE (wardrobe/pose/expression/mood)
// + per-background SCENE (environment AND its own lighting design) + shared FINISH (lens + editorial grade).
// Lighting lives with the scene, not the category, so all 16 combinations feel like 16 genuinely
// different shoots instead of one flat studio session with four wall colors.

const IDENTITY_PREAMBLE = `Using all the provided reference photos as strong visual references to maintain the exact facial structure, identity, and key features of the subject consistently across variations. Edit this image. I need a high-resolution, professional headshot, maintaining the exact facial structure, identity, and key features of the person in the input image. CRITICAL — preserve the subject's true age and real skin exactly as shown in the reference photos: keep every natural smile line, crow's feet, forehead crease, under-eye texture, neck texture, pore, and slight facial asymmetry. Do NOT smooth, retouch, airbrush, de-age, slim, or beautify the face in any way — this person earned every line and the photo must look honestly like them, not like a wax figure or a heavily filtered portrait. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The camera is at the subject's eye level, creating a direct, equal, engaging connection with the viewer.`;

const FINISH = `Captured on an 85mm f/1.8 lens with a shallow depth of field, sharp focus on the eyes, and natural background bokeh. Documentary-grade realism: this must look like a minimally retouched RAW frame straight from a professional photographer's camera — real skin with visible pores, fine lines, natural color unevenness and subsurface warmth; individual gray and white hairs rendered faithfully; absolutely no airbrushed smoothing, no plastic sheen, no porcelain skin, no uniform digital-painting flatness. Rich but honest color grade: confident contrast, deep tones, luminous natural highlights — never faded or washed out, and never artificially perfected. Crisp micro-contrast in skin, hair, and fabric. The result should be indistinguishable from a real photograph of this real person taken at a premium 2026 personal-brand shoot.`;

// Per-category STYLE: modern wardrobe, pose, expression, mood. No lighting here (the scene owns it).
const CATEGORY_STYLES: Record<string, string> = {
  'venture-capitalist': `The person looks directly at the camera with a confident, composed expression and the faint beginning of a knowing smile. The subject's body is positioned at a relaxed 3/4 angle with strong, easy posture. They are styled in a 2026 executive look: an impeccably tailored midnight-navy Italian wool suit with a crisp white dress shirt, open collar, no tie — modern power dressing, sharp and current. The atmosphere exudes presence, decisiveness, and quiet authority.`,

  'thought-leader': `The person looks directly at the camera with a warm, genuine, open smile that reaches the eyes. The subject faces the camera directly with relaxed, open posture. They are styled in a 2026 modern-authority look: a deep forest-green unstructured blazer in softly textured wool over a fine-gauge black merino crewneck — rich, contemporary, approachable. The atmosphere exudes warmth, credibility, and magnetic trustworthiness.`,

  'digital-architect': `The person looks directly at the camera with an alert, slightly smiling, switched-on expression. The subject is naturally positioned with one shoulder subtly forward, relaxed and modern. They are styled in a 2026 founder look: a matte-black fine-merino mock-neck sweater with clean minimal lines — the uniform of someone building the future, sleek and intentional. The atmosphere exudes intelligence, momentum, and effortless modern confidence.`,

  'arts-administrator': `The person looks directly at the camera with a calm, focused, quietly magnetic expression. The subject is positioned at a subtle, elegant angle with poised posture. They are styled in a 2026 creative-director look: a sharply tailored all-black ensemble — structured black blazer over a black silk crew-neck top, with a single minimal brushed-silver accent. The atmosphere exudes taste, vision, and understated creative power.`,
};

// Per-background SCENE: each backdrop brings its own environment AND lighting design.
// IDs are unchanged so the frontend keeps working; the looks are completely new.
const BACKGROUND_SCENES: Record<string, string> = {
  dark: `The setting is a dark editorial studio: a deep charcoal-to-black gradient backdrop with subtle smoky falloff. Lighting is low-key and dramatic — a single large softbox key at 45 degrees sculpting the face with gentle shadow modeling, plus a fine silver rim light tracing the shoulders and hair to separate the subject from the darkness. Defined catchlights in the eyes. Deep, velvety blacks with cinematic depth.`,

  white: `The setting is a bright modern office: floor-to-ceiling glass partitions, warm wood and matte-white architectural details dissolved into soft creamy bokeh far behind the subject. Lighting is soft directional daylight pouring in from large windows to one side, gently modeling the face with airy, natural shadow and a clean bright catchlight. Fresh, energetic, expensive — the look of a flagship headquarters.`,

  'warm-greige': `The setting is an exterior golden-hour scene: warm late-afternoon sunlight with softly blurred upscale architecture and hints of green foliage melting into amber bokeh. Lighting is golden-hour backlight catching the hair and shoulders like a halo, with a soft warm key filling the face naturally. Glowing, flattering, alive — the warmest light of the day.`,

  'cool-bluegray': `The setting is a high-rise office at the window: a floor-to-ceiling pane with a city skyline softened into elegant cool-blue bokeh behind the subject. Lighting is cool diffused daylight from the expansive glass, crisp and contemporary, with clean catchlights and gentle shadow depth. Polished, metropolitan, commanding — the corner-office view.`,
};

export async function POST(request: Request) {
  try {
    if (!process.env.XAI_API_KEY) {
      console.error('XAI_API_KEY is not set in environment');
      return NextResponse.json({ 
        error: 'XAI_API_KEY is not configured. Add XAI_API_KEY in Vercel environment variables (and .env.local for local dev) and redeploy. [xai-v3b3dbd8]' 
      }, { status: 500 });
    }

    const body = await request.json();
    const { references, categoryId, backgroundId, label } = body as {
      references: string[];
      categoryId: string;
      backgroundId: string;
      label?: string;
    };

    if (!references || references.length === 0) {
      return NextResponse.json({ error: 'No reference images provided' }, { status: 400 });
    }
    if (!categoryId || !backgroundId) {
      return NextResponse.json({ error: 'Missing category or background' }, { status: 400 });
    }

    const style = CATEGORY_STYLES[categoryId];
    if (!style) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const scene = BACKGROUND_SCENES[backgroundId];
    if (!scene) {
      return NextResponse.json({ error: 'Invalid background' }, { status: 400 });
    }

    const fullPrompt = `${IDENTITY_PREAMBLE} ${style} ${scene} ${FINISH}`;

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
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        referenceImages.push(`data:image/jpeg;base64,${base64}`);
      } catch (e) {
        return NextResponse.json({ 
          error: 'Failed to process one of your source photos. Please re-upload your original photos and try again.' 
        }, { status: 400 });
      }
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
