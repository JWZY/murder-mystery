# Prompt Journal

How this project was built, in the order the prompts happened. Someone could
replay these to reproduce the build. (Concise by design — minor back-and-forth
omitted.)

---

### 2026-06-03 — Kickoff

> I'm planning a murder mystery party (3rd edition). Participants fill an intake
> form; afterward I plan the story sequentially. Each person needs a unique link
> to see their own entry, a partial view of what others filled out, and to edit
> their own. No server costs but I need storage; unknown headcount; hosted on
> GitHub Pages. Make it complex/character-driven like 2022, not the simplified
> 2024 version. The big problem to fix: last time people got to know the fictional
> characters, not each other as real people. [+ link to past-events Drive folder]

Decisions captured: GitHub Pages + Supabase (free tier), static-only. Core goal =
**real intimacy between guests**, not just good fiction.

### 2026-06-03 — Constraints + autonomy

> The 2022 one was a murder mystery *at an actual wedding reception* (not a
> wedding theme). Venue ~1200 sqft townhome, mid-July Toronto (hot). Go ahead and
> plan + read the past data. Make decisions autonomously, minimal oversight.

→ Wrote `PLAN.md`: 2022/2024 learnings, the **Two-Layer Characters** thesis
(fiction seeded from real intake answers, gated by a per-person consent dial,
revealed in a "Mask Off" debrief), the full intake form, venue/heat plan.

### 2026-06-03 — Theme

> (choosing among options) Theme = **Reunion gala**.

### 2026-06-03 — Backend

> Build the Supabase schema + the per-person link flow. (Plus corrections: the
> anon key is legacy — use the new **publishable key**; here's the project URL.)

→ `supabase/schema.sql`: 5 sealed tables (RLS on, no anon policies) + 6
SECURITY-DEFINER RPCs as the only public surface; opaque 22-char tokens. Built
the participant app (intake → self-edit → partial roster → "your character").
Verified live with `scripts/smoke-test.mjs` (all checks pass).

### 2026-06-04 — Wire the host app + "ship everything"

> Start wiring the host planning app to the real responses. Then: ship everything
> you can, full auto, don't wait for approval — I'll check back in a few hours.

→ Built the host workspace against Supabase:
- `supabase/host.sql` — passcode-gated host access (bcrypt hash; no master key in
  the static site). **Responses** tab reads every submission.
- `supabase/casting.sql` — host CRUD RPCs for characters/relationships/acts/
  settings + a `released` gate so players only see a card once the host ships it.
- **Casting** tab — cast guests, flag the murderer, and **auto-draft a two-layer
  character card from each guest's real answers, gated by their consent dial**
  (`src/host/seedCharacter.ts`), then Release to the player.
- **Settings** tab — open/close intake, roster visibility, title/blurb, share links.
- GitHub Pages deploy: `vite.config.ts` base path + `.github/workflows/deploy.yml`.
- Privacy: gitignored the local `Murder Mystery Planning/` folder (real people's
  past answers — never published).
