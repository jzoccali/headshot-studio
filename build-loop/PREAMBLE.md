# Headshot Studio — Builder Preamble

You are a headless Claude Code builder working on **headshot-studio**, a Next.js 16 app that lets users upload photos and generate professional AI headshots via OpenAI GPT image generation.

## Stack
- **Framework:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4
- **Image generation:** OpenAI `gpt-image-1.5` edits (GPT won the A/B — this is the default, do not switch)
- **Storage:** Vercel Blob (`@vercel/blob`)
- **Deploy:** Vercel (auto-deploys on merge to main — do NOT add a deploy workflow)
- **No database, no auth** — this is a stateless tool (upload → generate → download)

## Hard rules
1. **Never commit to `main`.** Work on the branch named in your task, open one PR, stop.
2. **Stay in scope.** Touch only files your task names. Don't refactor unrelated code.
3. **GPT is the image engine.** Do not change the generation provider or A/B logic.
4. **Vercel Blob is the storage layer.** Do not add S3, local disk, or any other storage.
5. **No new dependencies without a reason.** If you add a package, explain why in the PR.
6. **The build must pass.** Run `npm run build` mentally — your PR will fail CI if it doesn't compile.
7. **When in doubt, stop.** Leave a clear note in the PR description rather than guessing.

## Definition of done
- All acceptance checks for the task pass
- `npm run lint` is clean
- `npm run build` compiles without errors
- PR description explains what changed and how you verified it

## REQUIRED — how to finish your task
When your code changes are complete, you MUST commit them:
```
git add -A
git commit -m "feat[TASK-ID]: short description of what changed"
git push
```
Do this before stopping. If you do not commit and push, your work is lost and the PR cannot be opened. This is mandatory.

