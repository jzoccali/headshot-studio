import Replicate from 'replicate';
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Using a solid IP-Adapter Flux model for good face consistency + prompt control for clothing/background.
// Change this to any other Replicate model you prefer that supports image references.
const MODEL = 'fofr/flux-dev-ipadapter';

// Premium base prompts for each category (extracted from the high-quality user-provided templates).
// The background sentence is injected modularly from BACKGROUND_SENTENCES for flexibility (4 backgrounds per look).
// Prepended with multi-reference instruction for best composite consistency from multiple source photos.
const CATEGORY_BASES: Record<string, string> = {
  'venture-capitalist': `Edit this image. I need a high-resolution, professional profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a confident, slightly analytical expression. The subject's body is positioned at a clear 3/4 angle. They are styled for a premium photo studio shoot, wearing a tailored charcoal grey worsted wool suit, a white pocket square, and a charcoal knit tie with a neat, precise knot.`,

  'thought-leader': `Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a warm, open, and compassionate smile. The subject's body is positioned directly facing the camera with excellent, open posture. They are styled for a professional photo studio shoot, wearing a tailored camel hair blazer over a fine-gauge, ivory rollneck sweater.`,

  'digital-architect': `Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with an accessible, slightly smiling, and innovative expression. The subject's body is naturally positioned with one shoulder slightly forward. They are styled for a professional photo studio shoot, wearing a modern, textured technical knit zip-up polo in dark navy with subtle ribbing.`,

  'arts-administrator': `Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a calm, focused, and discerning expression. The subject's body is positioned at a subtle, elegant angle. They are styled for a professional photo studio shoot, wearing a tailored, minimalist black blazer over a simple, elegant dark gray silk top, paired with a small, sculptural silver accessory.`,
};

// Background sentences to inject.
const BACKGROUND_SENTENCES: Record<string, string> = {
  dark: "The background is a solid ‘#141414’ dark neutral studio.",
  white: "The background is a clean bright white seamless studio backdrop with soft even illumination.",
  'warm-greige': "The background is a soft warm neutral greige studio wall with gentle light falloff and subtle texture.",
  'cool-bluegray': "The background is a modern cool soft blue-gray studio wall with faint architectural depth.",
};

const COMMON_ENDING = ` Shot from a high angle with bright and airy soft, diffused studio lighting, gently illuminating the face and creating a subtle catchlight in the eyes. Captured on an 85mm f/1.8 lens with a shallow depth of field, exquisite focus on the eyes, and beautiful, soft bokeh. Observe crisp detail on the fabric texture, individual strands of hair, and natural, realistic skin texture. The atmosphere exudes confidence and professionalism. Clean and bright cinematic color grading with subtle warmth and balanced tones, ensuring a polished and contemporary feel.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      references,
      categoryId,
      backgroundId,
      label,
    } = body as {
      references: string[];
      categoryId: string;
      backgroundId: string;
      label?: string;
    };

    if (!references || references.length === 0) {
      return NextResponse.json({ error: 'No reference images' }, { status: 400 });
    }
    if (!categoryId || !backgroundId) {
      return NextResponse.json({ error: 'Missing category or background' }, { status: 400 });
    }

    const base = CATEGORY_BASES[categoryId];
    const bgSentence = BACKGROUND_SENTENCES[backgroundId];

    if (!base || !bgSentence) {
      return NextResponse.json({ error: 'Invalid category or background' }, { status: 400 });
    }

    const fullPrompt = `Using all the provided reference photos as strong visual references to maintain the exact facial structure, identity, and key features of the subject consistently across variations. ${base} ${bgSentence}${COMMON_ENDING}`;

    // Use the first reference as the main image for face consistency.
    // (All references are available; the model will lock identity from the main one + the detailed prompt.)
    const mainReference = references[0];

    const output = await replicate.run(
      MODEL as `${string}/${string}`,
      {
        input: {
          prompt: fullPrompt,
          image: mainReference,
          image_strength: 0.72, // Good balance: follow face strongly, allow clothing/background changes from prompt.
          num_outputs: 1,
          guidance_scale: 3.5,
          num_inference_steps: 28,
        },
      }
    );

    const generatedUrl = Array.isArray(output) ? output[0] : output;

    if (!generatedUrl || typeof generatedUrl !== 'string') {
      throw new Error('Model did not return an image URL');
    }

    // Store the result in Vercel Blob for a stable, public URL the user can download from the site.
    const imageResponse = await fetch(generatedUrl);
    const imageBlob = await imageResponse.blob();

    const filename = `generated/${Date.now()}-${(label || `${categoryId}-${backgroundId}`).replace(/\s+/g, '-')}.jpg`;

    const blob = await put(filename, imageBlob, {
      access: 'public',
      contentType: 'image/jpeg',
    });

    return NextResponse.json({
      imageUrl: blob.url,
      label: label || `${categoryId} - ${backgroundId}`,
    });
  } catch (error: any) {
    console.error('Generate error:', error);
    return NextResponse.json(
      { error: error.message || 'Generation failed' },
      { status: 500 }
    );
  }
}
