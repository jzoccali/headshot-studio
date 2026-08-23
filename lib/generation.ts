export type OpenAIVariant = 'legacy' | 'image2';

export type OpenAIEditParams = {
  model: 'gpt-image-1.5' | 'gpt-image-2';
  size: '1024x1024' | '1024x1536';
  quality: 'high';
  input_fidelity?: 'high';
};

export const AB_LOOK_IDS = [
  'navy-suit-tie',
  'coffee-shop',
  'sailing',
  'crimson-editorial',
] as const;

export const IDENTITY_PREAMBLE = `Using all the provided reference photos as strong visual references to maintain the exact facial structure, identity, and key features of the subject consistently across variations. Edit this image. I need a high-resolution, professional headshot, maintaining the exact facial structure, identity, and key features of the person in the input image. CRITICAL — preserve the subject's true age and real skin exactly as shown in the reference photos: keep every natural smile line, crow's feet, forehead crease, under-eye texture, neck texture, pore, and slight facial asymmetry. Do NOT smooth, retouch, airbrush, de-age, slim, or beautify the face in any way — this person earned every line and the photo must look honestly like them, not like a wax figure or a heavily filtered portrait. FRAMING RULE (strict): the subject is framed from the chest up with generous headroom — the ENTIRE head and ALL of the hair must be fully inside the frame with clear empty space above the topmost hair, roughly 10-15% of the frame height. Never crop the scalp, hairline, or top of the head, even slightly. If in doubt, zoom out. The camera is at the subject's eye level, creating a direct, equal, engaging connection with the viewer.`;

export const FINISH = `Shot on a full-frame mirrorless camera with an 85mm f/1.8 lens: shallow depth of field, tack-sharp focus on the eyes, natural optical bokeh. TRUE PHOTOGRAPHIC REALISM, not an illustration: a barely-perceptible layer of fine photographic grain across the frame; slightly imperfect, asymmetric real-world lighting (real light is never perfectly even); authentic candid energy as if captured between posed frames. Real skin with visible pores, fine lines, natural color unevenness, faint redness where real skin has it, and subsurface warmth; individual gray and white hairs rendered faithfully; fabric with true weave texture and natural wrinkles where the body bends. Absolutely no airbrushed smoothing, no plastic sheen, no porcelain skin, no uniform digital-painting flatness, no CGI render quality. Honest color grade: confident contrast, deep tones, luminous natural highlights — never faded, never artificially perfected. The result must be indistinguishable from a frame a real photographer actually took of this real person.`;

export const LOOKS: Record<string, string> = {
  master: `The person has a natural, relaxed expression with a slight easy smile, facing the camera directly. They wear a simple dark-charcoal crewneck sweater. The setting is a neutral mid-gray seamless studio backdrop. Lighting is soft, even, and balanced — a clean identity portrait with clear detail across the whole face.`,
  'navy-suit-tie': `The person looks directly at the camera with confident, settled authority and a hint of a smile. They wear a classic tailored navy suit, crisp white spread-collar shirt, and a textured burgundy silk tie — the full traditional power look, impeccably knotted. The setting is a glass-walled executive conference room dissolved into cool bokeh — hints of a long table and city light beyond. Lighting is polished corporate daylight with soft directional modeling.`,
  'skyline-no-tie': `The person looks directly at the camera, composed and quietly commanding, faint knowing smile. They wear an impeccably tailored charcoal suit with a crisp white shirt, open collar, no tie — modern executive. The setting is a high-rise corner office: floor-to-ceiling glass with the city skyline melted into elegant cool-blue bokeh. Lighting is crisp diffused daylight from the expansive windows.`,
  'black-editorial': `The person looks directly at the camera with calm, magnetic intensity. They wear a fine black turtleneck under a structured black blazer — sleek monochrome. The setting is a dark editorial studio: deep charcoal-to-black gradient with smoky falloff. Lighting is low-key and dramatic — a single large softbox sculpting the face, a fine silver rim light tracing the shoulders, velvety cinematic blacks.`,
  'startup-office': `The person looks directly at the camera with an energized, approachable, slightly smiling expression, one shoulder relaxed forward. They wear a crisp white dress shirt with the sleeves casually rolled, no jacket, top button open — hands-on leadership. The setting is a bright modern startup office: glass, blond wood, and greenery in creamy bokeh. Lighting is airy natural daylight.`,
  'coffee-shop': `The person looks at the camera mid-warm-laugh, candid and genuine. They wear a textured charcoal shawl-collar cardigan over a clean white tee. The setting is a specialty coffee shop: espresso machine, hanging pendant lights, and shelves of ceramics softened into warm amber bokeh. Lighting is honeyed window light from the side with cozy ambient warmth.`,
  'library-knit': `The person looks directly at the camera with thoughtful warmth and an easy smile. They wear a navy fine-knit polo, relaxed and intelligent. The setting is a handsome study: walls of books in rich wood shelving rendered as soft warm bokeh. Lighting is gentle lamplight mixed with soft daylight — the trusted-advisor look.`,
  'rooftop-golden': `The person looks directly at the camera with a relaxed, sun-warmed smile. They wear an olive suede overshirt over a white henley — elevated casual. The setting is a rooftop terrace at golden hour: blurred skyline edges and string lights catching the low sun in amber bokeh. Lighting is golden-hour backlight haloing the hair with a soft warm fill on the face.`,
  'creative-loft': `The person looks directly at the camera with a poised, intrigued half-smile. They wear an all-black relaxed crew-neck with one minimal silver accent — gallery-owner cool. The setting is a white-brick creative loft with large industrial windows and hints of framed art in pale bokeh. Lighting is broad soft north-facing daylight, clean and dimensional.`,
  sailing: `The person looks at the camera with a wind-blown, exhilarated grin, hair naturally tousled by the breeze. They wear a navy performance quarter-zip over a white tee, sleeves pushed up. The setting is the deck of a sailboat underway: rigging, white sail edges, and glittering open water in sun-sparkled bokeh. Lighting is brilliant midday marine sun with natural bounce off the water.`,
  'beach-linen': `The person looks directly at the camera with an unhurried, warm vacation smile. They wear a relaxed white linen shirt, open collar, sleeves rolled. The setting is a quiet beach at golden hour: soft dunes, sea grass, and surf dissolved into peach-and-gold bokeh. Lighting is low warm sun kissing one side of the face with a gentle glow.`,
  'field-jacket': `The person looks directly at the camera with a grounded, easy confidence. They wear a waxed-cotton field jacket over a heathered henley — weekend-outdoors classic. The setting is a tree-lined trail in late afternoon: layered green foliage in deep natural bokeh. Lighting is dappled sunlight filtering through leaves with a soft warm key on the face.`,
  'cafe-patio': `The person looks at the camera with a relaxed, sociable smile, caught in a candid moment. They wear a light stone-colored merino polo. The setting is a European café patio: rattan chairs, marble table edges, and a sunlit street softened into bright pastel bokeh. Lighting is bright open-shade afternoon light, fresh and flattering.`,
  'leather-moody': `The person looks directly at the camera with quiet edge and self-assurance. They wear a matte black leather jacket over a charcoal tee. The setting is a moody studio with a smoky slate-blue gradient backdrop. Lighting is hard-edged key light with deep sculpted shadows and a cool rim — confident editorial drama.`,
  'evening-city': `The person looks directly at the camera, composed and cinematic, slight smile. They wear a charcoal wool topcoat over a black crewneck. The setting is a city street at blue hour: cool dusk sky with warm shop and traffic lights blooming into rich bokeh. Lighting is soft cool ambient dusk with warm practical accents catching the face.`,
  'industrial-denim': `The person looks directly at the camera with an unforced, capable smile. They wear a dark indigo denim shirt, top button open — honest and strong. The setting is an industrial loft: weathered brick and steel-framed windows in muted bokeh. Lighting is raking window light with rich texture and warm-neutral tones.`,
  'crimson-editorial': `The person looks directly at the camera with bold, magnetic presence. They wear a midnight-navy suit over a black crewneck, no tie — fashion-forward tailoring. The setting is a deep crimson-burgundy seamless studio backdrop with subtle gradient falloff. Lighting is dramatic directional key with a soft fill — a striking magazine-cover portrait.`,

  'tan-blazer-courtyard': `The person looks directly at the camera with an easy, open-collar confidence. They wear a camel unstructured linen-blend blazer over a white oxford, no tie. The setting is a sunlit brick courtyard with terracotta pots and a pale stucco wall dissolved into warm bokeh. Lighting is late-morning sun with a soft bounce from the pale walls.`,
  'rust-cord-bookstore': `The person looks at the camera with a quiet, curious smile. They wear a rust corduroy overshirt over a cream henley. The setting is an independent bookstore: wood shelves, warm paper spines, and a reading-lamp glow in honeyed bokeh. Lighting is mixed lamp and window light, intimate and unhurried.`,
  'knit-cabin': `The person looks directly at the camera with a grounded, winter-weekend ease. They wear a charcoal merino shawl-collar pullover. The setting is a timber cabin interior: a stone fireplace and wood grain melted into warm amber bokeh. Lighting is firelight mixed with cool window light.`,
  'cream-turtleneck-gallery': `The person looks directly at the camera with calm, gallery-owner presence. They wear an ivory fine-knit turtleneck, no jacket. The setting is a white-box art gallery: pale walls, a single large painting in soft focus, polished concrete floor. Lighting is museum-even daylight, clean and dimensional.`,
  'seersucker-porch': `The person looks at the camera with a relaxed Southern-afternoon smile. They wear a pale-blue seersucker sport coat over a white open-collar shirt. The setting is a screened Florida porch: ceiling fan, painted wood, and greenery beyond the screen in bright open-shade bokeh. Lighting is open shade, fresh and even.`,
  'golf-clubhouse': `The person looks directly at the camera with an approachable, just-off-the-course ease. They wear a muted sage performance polo. The setting is a golf clubhouse veranda: fairway green and white railings softened into daylight bokeh. Lighting is bright open-shade afternoon light.`,
  'waterfront-sportcoat': `The person looks directly at the camera with composed waterfront energy. They wear a navy cotton sport coat over a light-blue oxford, open collar. The setting is a Tampa Bay waterfront walk: water, masts, and sky melted into cool sparkling bokeh. Lighting is late-day sun with a gentle fill from the water.`,
  'chambray-workshop': `The person looks at the camera with a capable, hands-on half-smile. They wear a light-wash chambray work shirt, sleeves rolled. The setting is a wood shop: maple benches, hand tools, and sawdust motes in a shaft of window light. Lighting is raking workshop daylight with honest texture.`,
};

function lookOrThrow(lookId: string): string {
  const look = LOOKS[lookId];
  if (!look) {
    throw new Error(`Invalid look: ${lookId}`);
  }
  return look;
}

export function buildPrompt(lookId: string, variant: OpenAIVariant): string {
  const look = lookOrThrow(lookId);
  if (variant === 'legacy') {
    return `${IDENTITY_PREAMBLE} ${look} ${FINISH}`;
  }

  return [
    'IDENTITY (do not violate):',
    'Keep the same person as the reference photos. Same facial structure, age, skin texture, hair, and asymmetries.',
    'Do NOT smooth, retouch, airbrush, de-age, slim, or beautify the face. No wax-figure skin.',
    '',
    'LOOK:',
    look,
    '',
    'CAMERA:',
    'Portrait headshot, 1024x1536, chest up, entire head and all hair inside the frame with 10-15% headroom.',
    'Eye-level 85mm f/1.8, tack-sharp eyes, natural optical bokeh. Never crop the scalp.',
    '',
    'FINISH:',
    FINISH,
  ].join('\n');
}

export function parseImageEditStream(sseText: string): string {
  let completed: string | null = null;
  const blocks = sseText.split('\n\n');
  for (const block of blocks) {
    const lines = block.split('\n');
    const event = lines.find((l) => l.startsWith('event:'))?.slice(6).trim();
    const data = lines.filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
    if (!data) continue;
    let parsed: { type?: string; b64_json?: string };
    try {
      parsed = JSON.parse(data);
    } catch {
      continue;
    }
    if ((event === 'image_edit.completed' || parsed.type === 'image_edit.completed') && parsed.b64_json) {
      completed = parsed.b64_json;
    }
  }
  if (!completed) {
    throw new Error('No completed image in edit stream');
  }
  return completed;
}

export function openaiEditParams(variant: OpenAIVariant): OpenAIEditParams {
  if (variant === 'image2') {
    return {
      model: 'gpt-image-2',
      size: '1024x1536',
      quality: 'high',
    };
  }
  return {
    model: 'gpt-image-1.5',
    size: '1024x1024',
    quality: 'high',
    input_fidelity: 'high',
  };
}
