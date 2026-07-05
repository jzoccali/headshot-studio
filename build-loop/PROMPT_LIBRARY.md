# Headshot Studio — Prompt Library
# One ## heading per task. ID must match queue.yml exactly.
# We'll fill these in together before running the loop.

## UI-01 UI cleanup and UX audit

**Goal:** Review the entire user-facing flow (upload → generate → results) and fix the most broken/confusing parts.

**Acceptance checks:**
- The upload flow is clear — user knows exactly what to do
- Generation progress is visible (not a blank screen)
- Results are displayed cleanly with all 6 categories visible
- No console errors during a normal flow
- `npm run lint` clean, `npm run build` passes

**Scope:** `app/` directory UI components only. Do not touch generation logic, Vercel Blob calls, or API routes.

**Notes:** This is the first task — be conservative. Fix what's clearly broken. Flag anything that needs a bigger decision in the PR description rather than guessing.

---

## UI-02 Loading states and progress indicators

**Goal:** Add clear loading/progress feedback during the image generation phase so users don't think the app is frozen.

**Acceptance checks:**
- A spinner or progress bar is visible while images are generating
- Each category shows its status (pending / generating / done)
- Error states are handled gracefully (show message, offer retry)
- `npm run build` passes

**Precondition:** UI-01 merged.

---

## UI-03 Mobile responsiveness

**Goal:** Make the app fully usable on a phone screen (375px width minimum).

**Acceptance checks:**
- Upload area works on mobile (tap to select photo)
- Results grid reflows to single column on small screens
- Download buttons are tappable (min 44px touch targets)
- No horizontal scroll on any screen under 375px wide
- `npm run build` passes

**Precondition:** UI-01 merged.

---

## FEAT-01 Download all as ZIP

**Goal:** Add a "Download all" button that packages all generated headshots into a single ZIP file using the existing `jszip` dependency.

**Acceptance checks:**
- "Download all" button appears on the results page
- ZIP contains all generated images named by category (e.g. `executive-white.jpg`)
- Works in Chrome and Safari
- `npm run build` passes

**Precondition:** UI-01 merged.

---

## FEAT-02 Error handling and retry

**Goal:** Add robust error handling for generation failures — network errors, API timeouts, invalid image formats.

**Acceptance checks:**
- Failed categories show a clear error message with a retry button
- Retrying a single category works without re-generating the others
- Invalid/unsupported image uploads show an error before hitting the API
- `npm run build` passes

**Precondition:** UI-01 merged.
