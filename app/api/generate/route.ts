import Replicate from 'replicate';
import { put, del } from '@vercel/blob';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Good IP-Adapter model for face consistency from reference photos while allowing clothing and background changes via prompt.
const MODEL = 'fofr/flux-dev-ipadapter';

// The 4 premium full prompts with the dark '#141414' background (as provided by user).
// We will swap the background sentence for modularity (4 backgrounds per category).
const FULL_PROMPTS_DARK: Record<string, string> = {
  'venture-capitalist': `Using all the provided reference photos as strong visual references to maintain the exact facial structure, identity, and key features of the subject consistently across variations. Edit this image. I need a high-resolution, professional profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a confident, slightly analytical expression. The subject's body is positioned at a clear 3/4 angle. They are styled for a premium photo studio shoot, wearing a tailored charcoal grey worsted wool suit, a white pocket square, and a charcoal knit tie with a neat, precise knot. The background is a solid '#141414' neutral studio. Shot from a high angle with bright and airy soft, diffused studio lighting, gently illuminating the face and creating a defined catchlight in the eyes, conveying expertise and deep insight. Captured on an 85mm f/1.8 lens with a shallow depth of field, exquisite focus on the eyes, and beautiful, soft bokeh. Observe crisp detail on the fine wool texture of the suit, individual strands of hair, and natural, realistic skin texture. The atmosphere exudes confidence, prestige, and executive presence. Clean and bright cinematic color grading with balanced, cool-leaning tones, ensuring a polished and modern professional feel.`,

  'thought-leader': `Using all the provided reference photos as strong visual references to maintain the exact facial structure, identity, and key features of the subject consistently across variations. Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a warm, open, and compassionate smile. The subject's body is positioned directly facing the camera with excellent, open posture. They are styled for a professional photo studio shoot, wearing a tailored camel hair blazer over a fine-gauge, ivory rollneck sweater. The background is a solid '#141414' neutral studio. Shot from a high angle with bright and airy soft, diffused studio lighting, gently illuminating the face and creating a clear catchlight in the eyes, conveying trustworthy authority and warmth. Captured on an 85mm f/1.8 lens with a shallow depth of field, exquisite focus on the eyes, and beautiful, soft bokeh. Observe crisp detail on the rich texture of the blazer, the fine knit of the sweater, individual strands of hair, and natural, realistic skin texture. The atmosphere exudes confidence, compassionate wisdom, and high-level professionalism. Clean and bright cinematic color grading with a subtle, golden warmth, ensuring a polished and engaging contemporary feel.`,

  'digital-architect': `Using all the provided reference photos as strong visual references to maintain the exact facial structure, identity, and key features of the subject consistently across variations. Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with an accessible, slightly smiling, and innovative expression. The subject's body is naturally positioned with one shoulder slightly forward. They are styled for a professional photo studio shoot, wearing a modern, textured technical knit zip-up polo in dark navy with subtle ribbing. The background is a solid '#141414' neutral studio. Shot from a high angle with bright and airy soft, diffused studio lighting, gently illuminating the face and creating a distinct catchlight in the eyes, conveying a sense of intellectual energy and forward-thinking expertise. Captured on an 85mm f/1.8 lens with a shallow depth of field, exquisite focus on the eyes, and beautiful, soft bokeh. Observe crisp detail on the technical knit fabric, individual strands of hair, and natural, realistic skin texture. The atmosphere exudes confidence, modern tech acumen, and accessible professionalism. Clean and bright cinematic color grading with balanced tones and enhanced clarity, ensuring a polished and highly contemporary digital feel.`,

  'arts-administrator': `Using all the provided reference photos as strong visual references to maintain the exact facial structure, identity, and key features of the subject consistently across variations. Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a calm, focused, and discerning expression. The subject's body is positioned at a subtle, elegant angle. They are styled for a professional photo studio shoot, wearing a tailored, minimalist black blazer over a simple, elegant dark gray silk top, paired with a small, sculptural silver accessory. The background is a solid '#141414' neutral studio. Shot from a high angle with bright and airy soft, diffused studio lighting, gently illuminating the face and creating a subtle catchlight in the eyes, conveying sophisticated taste and quiet confidence. Captured on an 85mm f/1.8 lens with a shallow depth of field, exquisite focus on the eyes, and beautiful, soft bokeh. Observe crisp detail on the blazer fabric, the soft sheen of the silk, individual strands of hair, and natural, realistic skin texture. The atmosphere exudes confidence, cultural authority, and high-end artistic professionalism. Clean and bright cinematic color grading with subtle, rich warmth and balanced tones, ensuring a polished, gallery-ready, and contemporary feel.`,
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
    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('REPLICATE_API_TOKEN is not set in environment');
      return NextResponse.json({ 
        error: 'Replicate API key is not configured. Please add REPLICATE_API_TOKEN in Vercel environment variables and redeploy.' 
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

    // Swap the background sentence for the chosen one (keeps the premium wording for that archetype)
    fullPrompt = fullPrompt.replace("The background is a solid '#141414' neutral studio.", bgSentence);

    // Use first reference as main for the model; the prompt emphasizes using all for composite.
    const mainReference = references[0];

    const output = await replicate.run(MODEL as `${string}/${string}`, {
      input: {
        prompt: fullPrompt,
        image: mainReference,
        image_strength: 0.72,
        num_outputs: 1,
        guidance_scale: 3.5,
        num_inference_steps: 28,
      },
    });

    const generatedUrl = Array.isArray(output) ? output[0] : output;
    if (!generatedUrl || typeof generatedUrl !== 'string') {
      throw new Error('No image returned from model');
    }

    // Store in Blob for permanent public URL on the site
    const imageResponse = await fetch(generatedUrl);
    const imageBlob = await imageResponse.blob();
    const filename = `generated/${Date.now()}-${(label || `${categoryId}-${backgroundId}`).replace(/\s+/g, '-')}.jpg`;
    const blob = await put(filename, imageBlob, {
      access: 'public',
      contentType: 'image/jpeg',
    });

    // Auto-delete source photos after generation for privacy (biometric best practice)
    try {
      await del(references);
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
