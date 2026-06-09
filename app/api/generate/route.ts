import Replicate from 'replicate';
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// Using a solid IP-Adapter Flux model for good face consistency + prompt control for clothing/background.
// Change this to any other Replicate model you prefer that supports image references.
const MODEL = 'fofr/flux-dev-ipadapter';

// Base prompts for each category (the part before background).
// These are the refined prompts from our earlier work.
const CATEGORY_BASES: Record<string, string> = {
  corporate: `Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a confident, authoritative expression, and the subject’s body is positioned at a slight 3/4 angle to the camera. They are styled for a professional photo studio shoot, wearing a premium navy business suit with a crisp white dress shirt and understated tie.`,

  creative: `Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a warm, creative expression, and the subject’s body is positioned at a subtle angle with one shoulder slightly forward. They are styled for a professional photo studio shoot, wearing a well-fitted black turtleneck with a contemporary texture.`,

  tech: `Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a relaxed, approachable expression, and the subject’s body is casually positioned with a slight lean. They are styled for a professional photo studio shoot, wearing a modern henley shirt in heather gray with rolled sleeves.`,

  healthcare: `Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a trustworthy, compassionate expression, and the subject’s body is positioned directly facing the camera with excellent posture. They are styled for a professional photo studio shoot, wearing a crisp white medical coat over a light blue collared shirt.`,

  academic: `Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a thoughtful, intellectual expression, and the subject’s body is positioned with a slight thoughtful tilt. They are styled for a professional photo studio shoot, wearing a classic tweed sport coat over a cream-colored sweater.`,

  sales: `Edit this image. I need a professional, high-resolution, profile photo, maintaining the exact facial structure, identity, and key features of the person in the input image. The subject is framed from the chest up, with ample headroom and negative space above their head, ensuring the top of their head is not cropped. The person looks directly at the camera with a warm, welcoming smile, and the subject’s body is positioned with an open, approachable stance. They are styled for a professional photo studio shoot, wearing a smart business casual cardigan in charcoal over a white blouse.`,
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

    const fullPrompt = `${base} ${bgSentence}${COMMON_ENDING}`;

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
