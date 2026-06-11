import { put, del } from '@vercel/blob';
import { NextResponse } from 'next/server';

// Uses Grok / xAI Imagine for reference-based editing (preserve likeness from your uploaded photos
// while applying the exact premium clothing, lighting, expression, and background variations).
// Calls the public xAI API with XAI_API_KEY. Supports up to 3 reference images per edit for strong composite identity lock.

// The 4 premium full prompts with the dark '#141414' background (as provided by user).
// We will swap the background sentence for modularity (4 backgrounds per category).
const FULL_PROMPTS_DARK: Record<string, string> = {
  'venture-capitalist': `Using all the provided reference photos as strong visual references to maintain the exact facial structure, identity, and key features of the subject consistently across variations. Edit this image. I need a high-resolution, professional profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a confident, slightly analytical expression. The subject's body is positioned at a clear 3/4 angle. They are styled for a premium photo studio shoot, wearing a tailored charcoal grey worsted wool suit, a white pocket square, and a charcoal knit tie with a neat, precise knot. The background is a solid '#141414' neutral studio. Shot from a high angle with bright and airy soft, diffused studio lighting, gently illuminating the face and creating a defined catchlight in the eyes, conveying expertise and deep insight. Captured on an 85mm f/1.8 lens with a shallow depth of field, exquisite focus on the eyes, and beautiful, soft bokeh. Observe crisp detail on the fine wool texture of the suit, individual strands of hair, and natural, realistic skin texture with healthy vibrant natural skin tones, subtle lifelike warmth and color variation — not pale, flat or washed out. The atmosphere exudes confidence, prestige, and executive presence. Ultra sharp high-resolution details, crisp focus, vibrant natural colors, high contrast, photorealistic clarity and rich textures throughout for a clean, professional studio look.`,

  'thought-leader': `Using all the provided reference photos as strong visual references to maintain the exact facial structure, identity, and key features of the subject consistently across variations. Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a warm, open, and compassionate smile. The subject's body is positioned directly facing the camera with excellent, open posture. They are styled for a professional photo studio shoot, wearing a tailored camel hair blazer over a fine-gauge, ivory rollneck sweater. The background is a solid '#141414' neutral studio. Shot from a high angle with bright and airy soft, diffused studio lighting, gently illuminating the face and creating a clear catchlight in the eyes, conveying trustworthy authority and warmth. Captured on an 85mm f/1.8 lens with a shallow depth of field, exquisite focus on the eyes, and beautiful, soft bokeh. Observe crisp detail on the rich texture of the blazer, the fine knit of the sweater, individual strands of hair, and natural, realistic skin texture with healthy vibrant natural skin tones, subtle lifelike warmth and color variation — not pale, flat or washed out. The atmosphere exudes confidence, compassionate wisdom, and high-level professionalism. Ultra sharp high-resolution details, crisp focus, vibrant natural colors, high contrast, photorealistic clarity and rich textures throughout for a clean, professional studio look.`,

  'digital-architect': `Using all the provided reference photos as strong visual references to maintain the exact facial structure, identity, and key features of the subject consistently across variations. Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with an accessible, slightly smiling, and innovative expression. The subject's body is naturally positioned with one shoulder slightly forward. They are styled for a professional photo studio shoot, wearing a modern, textured technical knit zip-up polo in dark navy with subtle ribbing. The background is a solid '#141414' neutral studio. Shot from a high angle with bright and airy soft, diffused studio lighting, gently illuminating the face and creating a distinct catchlight in the eyes, conveying a sense of intellectual energy and forward-thinking expertise. Captured on an 85mm f/1.8 lens with a shallow depth of field, exquisite focus on the eyes, and beautiful, soft bokeh. Observe crisp detail on the technical knit fabric, individual strands of hair, and natural, realistic skin texture with healthy vibrant natural skin tones, subtle lifelike warmth and color variation — not pale, flat or washed out. The atmosphere exudes confidence, modern tech acumen, and accessible professionalism. Ultra sharp high-resolution details, crisp focus, vibrant natural colors, high contrast, photorealistic clarity and rich textures throughout for a clean, professional studio look.`,

  'arts-administrator': `Using all the provided reference photos as strong visual references to maintain the exact facial structure, identity, and key features of the subject consistently across variations. Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a calm, focused, and discerning expression. The subject's body is positioned at a subtle, elegant angle. They are styled for a professional photo studio shoot, wearing a tailored, minimalist black blazer over a simple, elegant dark gray silk top, paired with a small, sculptural silver accessory. The background is a solid '#141414' neutral studio. Shot from a high angle with bright and airy soft, diffused studio lighting, gently illuminating the face and creating a subtle catchlight in the eyes, conveying sophisticated taste and quiet confidence. Captured on an 85mm f/1.8 lens with a shallow depth of field, exquisite focus on the eyes, and beautiful, soft bokeh. Observe crisp detail on the blazer fabric, the soft sheen of the silk, individual strands of hair, and natural, realistic skin texture with healthy vibrant natural skin tones, subtle lifelike warmth and color variation — not pale, flat or washed out. The atmosphere exudes confidence, cultural authority, and high-end artistic professionalism. Ultra sharp high-resolution details, crisp focus, vibrant natural colors, high contrast, photorealistic clarity and rich textures throughout for a clean, professional studio look.`,
};

// Background sentences for modularity (4 per category)
const BACKGROUND_SENTENCES: Record<string, string> = {
  dark: "The background is a solid '#141414' neutral studio.",
  white: "The background is a clean bright white seamless studio backdrop with soft even illumination.",
  'warm-greige': "The background is a soft warm neutral greige studio wall with gentle light falloff and subtle texture.",
  'cool-bluegray': "The background is a modern cool soft blue-gray studio wall with faint architectural depth.",
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

    let fullPrompt = FULL_PROMPTS_DARK[categoryId];
    if (!fullPrompt) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const bgSentence = BACKGROUND_SENTENCES[backgroundId];
    if (!bgSentence) {
      return NextResponse.json({ error: 'Invalid background' }, { status: 400 });
    }

    // Swap the background sentence for the chosen one (keeps the exact premium wording + engineering secrets for that archetype)
    fullPrompt = fullPrompt.replace("The background is a solid '#141414' neutral studio.", bgSentence);

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

    // Pass up to 3 of the uploaded photos as direct visual references to the Grok Imagine edit model.
    // Use the public Blob URLs directly. These should be stable and publicly fetchable.
    // This gives strong "composite" identity lock (exact facial structure + features) while the prompt
    // controls clothing, expression, pose, lighting, and background. (Upload 4-6 varied photos for best results;
    // the prompt text still references "all" conceptually; pixel refs are capped at the API's current multi-edit limit.)
    const refUrls = validReferences.slice(0, 3);

    const model = 'grok-imagine-image-quality';

    const editBody: any = {
      model,
      prompt: fullPrompt,
      aspect_ratio: '1:1', // square works well for the headshot gallery + consistent display
    };

    if (refUrls.length === 1) {
      editBody.image = { url: refUrls[0], type: 'image_url' };
    } else {
      editBody.images = refUrls.map((u) => ({ url: u, type: 'image_url' }));
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

        try { await del(validReferences); } catch (e) { console.warn('Could not delete source references:', e); }

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

    // Privacy: auto-delete the source photos the user uploaded (BIPA-style best practice)
    // Only the valid ones we actually received.
    try {
      await del(validReferences);
    } catch (e) {
      console.warn('Could not delete source references:', e);
    }

    return NextResponse.json({
      imageUrl: blob.url,
      label: label || `${categoryId} - ${backgroundId}`,
    });
  } catch (error: any) {
    console.error('Generation error:', error);
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
}
