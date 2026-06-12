import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

// Uses Grok / xAI Imagine for reference-based editing (preserve likeness from your uploaded photos
// while applying the exact premium clothing, lighting, expression, and background variations).
// Calls the public xAI API with XAI_API_KEY. Supports up to 3 reference images per edit for strong composite identity lock.

// Prompt system: each final prompt = IDENTITY preamble + per-category STYLE (wardrobe/pose/expression/mood)
// + per-background SCENE (environment AND its own lighting design) + shared FINISH (lens + editorial grade).
// Lighting lives with the scene, not the category, so all 16 combinations feel like 16 genuinely
// different shoots instead of one flat studio session with four wall colors.

const IDENTITY_PREAMBLE = `Using all the provided reference photos as strong visual references to maintain the exact facial structure, identity, and key features of the subject consistently across variations. Edit this image. I need a high-resolution, professional headshot, maintaining the exact facial structure, identity, and key features of the person in the input image. CRITICAL — preserve the subject's true age and real skin exactly as shown in the reference photos: keep every natural smile line, crow's feet, forehead crease, under-eye texture, neck texture, pore, and slight facial asymmetry. Do NOT smooth, retouch, airbrush, de-age, slim, or beautify the face in any way — this person earned every line and the photo must look honestly like them, not like a wax figure or a heavily filtered portrait. FRAMING RULE (strict): the subject is framed from the chest up with generous headroom — the ENTIRE head and ALL of the hair must be fully inside the frame with clear empty space above the topmost hair, roughly 10-15% of the frame height. Never crop the scalp, hairline, or top of the head, even slightly. If in doubt, zoom out. The camera is at the subject's eye level, creating a direct, equal, engaging connection with the viewer.`;

const FINISH = `Shot on a full-frame mirrorless camera with an 85mm f/1.8 lens: shallow depth of field, tack-sharp focus on the eyes, natural optical bokeh. TRUE PHOTOGRAPHIC REALISM, not an illustration: a barely-perceptible layer of fine photographic grain across the frame; slightly imperfect, asymmetric real-world lighting (real light is never perfectly even); authentic candid energy as if captured between posed frames. Real skin with visible pores, fine lines, natural color unevenness, faint redness where real skin has it, and subsurface warmth; individual gray and white hairs rendered faithfully; fabric with true weave texture and natural wrinkles where the body bends. Absolutely no airbrushed smoothing, no plastic sheen, no porcelain skin, no uniform digital-painting flatness, no CGI render quality. Honest color grade: confident contrast, deep tones, luminous natural highlights — never faded, never artificially perfected. The result must be indistinguishable from a frame a real photographer actually took of this real person.`;

// 16 UNIQUE LOOKS — every single photo gets its own complete outfit + environment + lighting,
// from boardroom suit-and-tie to weekend sailing. Keyed by look id (sent as backgroundId by the
// frontend; categoryId identifies the collection for labeling only). Plus a neutral 'master' look
// used once to build the consistent identity reference.
const LOOKS: Record<string, string> = {
  master: `The person has a natural, relaxed expression with a slight easy smile, facing the camera directly. They wear a simple dark-charcoal crewneck sweater. The setting is a neutral mid-gray seamless studio backdrop. Lighting is soft, even, and balanced — a clean identity portrait with clear detail across the whole face.`,

  // ── Boardroom collection ──
  'navy-suit-tie': `The person looks directly at the camera with confident, settled authority and a hint of a smile. They wear a classic tailored navy suit, crisp white spread-collar shirt, and a textured burgundy silk tie — the full traditional power look, impeccably knotted. The setting is a glass-walled executive conference room dissolved into cool bokeh — hints of a long table and city light beyond. Lighting is polished corporate daylight with soft directional modeling.`,

  'skyline-no-tie': `The person looks directly at the camera, composed and quietly commanding, faint knowing smile. They wear an impeccably tailored charcoal suit with a crisp white shirt, open collar, no tie — modern executive. The setting is a high-rise corner office: floor-to-ceiling glass with the city skyline melted into elegant cool-blue bokeh. Lighting is crisp diffused daylight from the expansive windows.`,

  'black-editorial': `The person looks directly at the camera with calm, magnetic intensity. They wear a fine black turtleneck under a structured black blazer — sleek monochrome. The setting is a dark editorial studio: deep charcoal-to-black gradient with smoky falloff. Lighting is low-key and dramatic — a single large softbox sculpting the face, a fine silver rim light tracing the shoulders, velvety cinematic blacks.`,

  'startup-office': `The person looks directly at the camera with an energized, approachable, slightly smiling expression, one shoulder relaxed forward. They wear a crisp white dress shirt with the sleeves casually rolled, no jacket, top button open — hands-on leadership. The setting is a bright modern startup office: glass, blond wood, and greenery in creamy bokeh. Lighting is airy natural daylight.`,

  // ── Smart Casual collection ──
  'coffee-shop': `The person looks at the camera mid-warm-laugh, candid and genuine. They wear a textured charcoal shawl-collar cardigan over a clean white tee. The setting is a specialty coffee shop: espresso machine, hanging pendant lights, and shelves of ceramics softened into warm amber bokeh. Lighting is honeyed window light from the side with cozy ambient warmth.`,

  'library-knit': `The person looks directly at the camera with thoughtful warmth and an easy smile. They wear a navy fine-knit polo, relaxed and intelligent. The setting is a handsome study: walls of books in rich wood shelving rendered as soft warm bokeh. Lighting is gentle lamplight mixed with soft daylight — the trusted-advisor look.`,

  'rooftop-golden': `The person looks directly at the camera with a relaxed, sun-warmed smile. They wear an olive suede overshirt over a white henley — elevated casual. The setting is a rooftop terrace at golden hour: blurred skyline edges and string lights catching the low sun in amber bokeh. Lighting is golden-hour backlight haloing the hair with a soft warm fill on the face.`,

  'creative-loft': `The person looks directly at the camera with a poised, intrigued half-smile. They wear an all-black relaxed crew-neck with one minimal silver accent — gallery-owner cool. The setting is a white-brick creative loft with large industrial windows and hints of framed art in pale bokeh. Lighting is broad soft north-facing daylight, clean and dimensional.`,

  // ── Weekend collection ──
  'sailing': `The person looks at the camera with a wind-blown, exhilarated grin, hair naturally tousled by the breeze. They wear a navy performance quarter-zip over a white tee, sleeves pushed up. The setting is the deck of a sailboat underway: rigging, white sail edges, and glittering open water in sun-sparkled bokeh. Lighting is brilliant midday marine sun with natural bounce off the water.`,

  'beach-linen': `The person looks directly at the camera with an unhurried, warm vacation smile. They wear a relaxed white linen shirt, open collar, sleeves rolled. The setting is a quiet beach at golden hour: soft dunes, sea grass, and surf dissolved into peach-and-gold bokeh. Lighting is low warm sun kissing one side of the face with a gentle glow.`,

  'field-jacket': `The person looks directly at the camera with a grounded, easy confidence. They wear a waxed-cotton field jacket over a heathered henley — weekend-outdoors classic. The setting is a tree-lined trail in late afternoon: layered green foliage in deep natural bokeh. Lighting is dappled sunlight filtering through leaves with a soft warm key on the face.`,

  'cafe-patio': `The person looks at the camera with a relaxed, sociable smile, caught in a candid moment. They wear a light stone-colored merino polo. The setting is a European café patio: rattan chairs, marble table edges, and a sunlit street softened into bright pastel bokeh. Lighting is bright open-shade afternoon light, fresh and flattering.`,

  // ── Bold & Editorial collection ──
  'leather-moody': `The person looks directly at the camera with quiet edge and self-assurance. They wear a matte black leather jacket over a charcoal tee. The setting is a moody studio with a smoky slate-blue gradient backdrop. Lighting is hard-edged key light with deep sculpted shadows and a cool rim — confident editorial drama.`,

  'evening-city': `The person looks directly at the camera, composed and cinematic, slight smile. They wear a charcoal wool topcoat over a black crewneck. The setting is a city street at blue hour: cool dusk sky with warm shop and traffic lights blooming into rich bokeh. Lighting is soft cool ambient dusk with warm practical accents catching the face.`,

  'industrial-denim': `The person looks directly at the camera with an unforced, capable smile. They wear a dark indigo denim shirt, top button open — honest and strong. The setting is an industrial loft: weathered brick and steel-framed windows in muted bokeh. Lighting is raking window light with rich texture and warm-neutral tones.`,

  'crimson-editorial': `The person looks directly at the camera with bold, magnetic presence. They wear a midnight-navy suit over a black crewneck, no tie — fashion-forward tailoring. The setting is a deep crimson-burgundy seamless studio backdrop with subtle gradient falloff. Lighting is dramatic directional key with a soft fill — a striking magazine-cover portrait.`,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { references, categoryId, backgroundId, label, engine = 'xai' } = body as {
      references: string[];
      categoryId: string;
      backgroundId: string;
      label?: string;
      engine?: 'xai' | 'openai';
    };

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
    const look = LOOKS[backgroundId];
    if (!look) {
      return NextResponse.json({ error: 'Invalid look' }, { status: 400 });
    }

    const fullPrompt = `${IDENTITY_PREAMBLE} ${look} ${FINISH}`;

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

      const form = new FormData();
      form.append('model', 'gpt-image-1.5');
      form.append('prompt', fullPrompt);
      form.append('size', '1024x1024');
      form.append('quality', 'high');
      form.append('input_fidelity', 'high');
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

      const oaJson = await oaRes.json();
      const b64 = oaJson?.data?.[0]?.b64_json;
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
