<!-- begin-factory-block -->
# AGENTS.md — this repo (Codex / any agent)

This is a **Build Factory** app. Do not load `~/BuilderOS` or retired BuilderOS trees.

Joey never memorizes slash commands. Map his English to the skill.

## Load order

1. `./CLAUDE.md` — project charter
2. `./docs/handoffs/NEXT_PACKET.md` or `./packets/CURRENT.md` — current scope, if present
3. Deglaze: execute LuciferDono deglaze (`~/.claude/skills/deglaze/SKILL.md` or `~/.codex/skills/deglaze/SKILL.md`). When Joey challenges done, run the protocol — do not only name the path.

## Non-negotiables

- One user · one loop · Build Gate · scope fence
- **Done** = strong evidence + full deglaze
- **Tier ≥ 2 done** also requires **CI green** + review + demo/preview
- Secrets never in git or CI YAML
- If delivery scaffold missing on Tier ≥ 1: run
  `~/Projects/fns-build-factory/scripts/install-delivery.sh "$(pwd)" <tier>`
  in-session — do not only recommend

## Boundaries

- Do not modify unrelated files or widen scope beyond the request.
- Do not add dependencies without asking.
- Never commit secrets, API keys, or `.env` files.
- Follow the patterns already in neighboring files. Do not reformat code you are not changing.
- Do not add comments that restate the code.
- Never delete, weaken, or rewrite a test to make a change pass.
- Do not claim that an interrupted or timed-out run passed.
- Do not add "Generated with Claude Code" or co-author footers to commits or PRs.
- Never commit to `main`. Interactive session: do not commit, push, or open a PR unless asked. Headless build-loop: one branch, one PR, then stop — as `CLAUDE.md` says.
- If a command fails, report the failure. Do not guess or present assumptions as confirmed results.

## Handback

Lead with unfinished/unverified. One job at a time.
<!-- end-factory-block -->

<!-- begin-commands -->
## Commands

```bash
npm install
npm test                           # node --experimental-strip-types --test lib/generation.test.ts
npm run lint
npm run build
```

- Single test is that same `npm test` file. Do not invent a vitest runner.
<!-- end-commands -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
