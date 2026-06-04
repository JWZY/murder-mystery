# Murder Mystery Planner

A $0, static-site toolkit for hosting a potluck murder-mystery party — an intake
form guests fill out, per-person editable links, and a host workspace that turns
those answers into a cast and a story.

Its headline idea — **Two-Layer Characters** — fixes the recurring complaint from
past years (*"I got to know the fictional characters, but not the real people"*):
every character is grown from a guest's real intake answers, and how much truth
shows through is set by that guest's own consent dial.

![Stack](https://img.shields.io/badge/stack-React_19_%7C_Vite_%7C_Supabase_%7C_GitHub_Pages-blue)

## Two surfaces (one static build)

Routing is a simple hash check (`src/App.tsx`):

- **Participant site** (default route) — open intake form → on submit, the guest
  gets a permanent private link `?p=<token>`. From it they edit their own answers,
  see a curated partial roster of who else is coming, and (once released) read
  their own character card. `src/participant/*`.
- **Host workspace** (`/#host`) — passcode-gated tabs backed by Supabase:
  - **Responses** — every submission, host eyes only.
  - **Casting** — cast each guest, flag the murderer, and **auto-draft a
    two-layer character card from their real answers** (gated by their consent
    dial), then **Release** it to the player.
  - **Settings** — open/close intake, roster visibility, party title/blurb, links.
  - **Canvas / Guest List / Q-Planner** — the original localStorage brainstorming
    scratchpad (relationship graph, etc.). Optional; not the source of truth.

## Security model (read before deploying)

The site is static, so the Supabase **publishable** key ships in the client and is
public by design. Nothing is protected by hiding the key:

- RLS is **on** for every table with **no anon policies** → tables are sealed.
- The public client can only call a handful of `SECURITY DEFINER` RPCs, each
  scoped by a per-person **token** (participant) or the host **passcode** (host).
- Secrets, contacts, the plot, and the murderer are never in any anon-callable
  function. The host passcode is stored bcrypt-hashed; no master key is shipped.

See `supabase/schema.sql`, `supabase/host.sql`, `supabase/casting.sql`.

## Setup

1. **Supabase** — follow [`supabase/SETUP.md`](./supabase/SETUP.md). Run, in order:
   `schema.sql` → `host.sql` (set your passcode) → `casting.sql`.
2. **Env** — copy `.env.example` → `.env`, fill `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (the *publishable* key).
3. **Run**:
   ```bash
   pnpm install
   pnpm dev        # http://localhost:5173/  (participant)  ·  /#host  (host)
   pnpm build      # type-check + production build to dist/
   pnpm preview
   ```
4. **Verify the backend**:
   ```bash
   node scripts/smoke-test.mjs                       # participant RPCs (anon)
   node scripts/host-smoke-test.mjs "<passcode>"     # host RPCs
   ```

## Deploy (GitHub Pages)

A workflow (`.github/workflows/deploy.yml`) builds and publishes on every push to
`main`. To ship:

```bash
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
```

Then in the repo: **Settings → Pages → Source = GitHub Actions**. The site lands at
`https://<you>.github.io/<repo>/`. The build sets Vite's `base` to `/<repo>/`
automatically; the publishable Supabase values are baked in as workflow defaults
(override with repo **Variables** `SUPABASE_URL` / `SUPABASE_ANON_KEY`).

> The local `Murder Mystery Planning/` folder (real people's past responses) is
> gitignored and must never be committed or published.

## Architecture

```
src/
├── App.tsx                  # hash route: participant vs #host; host tab switch
├── lib/
│   ├── supabase.ts          # client (publishable key, no session persistence)
│   ├── api.ts               # the 6 participant RPC wrappers
│   └── hostApi.ts           # passcode-gated host RPC wrappers + types
├── participant/             # intake form, self-edit, partial roster, my-character
├── host/
│   ├── hostContext.tsx      # shared passcode unlock gate
│   ├── ResponsesTab.tsx     # live submissions (read)
│   ├── CastingTab.tsx       # cast + murderer + two-layer card editor + release
│   ├── SettingsTab.tsx      # public_settings knobs
│   └── seedCharacter.ts     # two-layer card auto-draft (consent-dialed)
├── store/ + components/ + hooks/   # legacy localStorage canvas (scratchpad)
└── styles/
supabase/                    # schema.sql, host.sql, casting.sql, SETUP.md
scripts/                     # smoke-test.mjs, host-smoke-test.mjs
```

See [`PLAN.md`](./PLAN.md) for the design thesis and decisions log, and
[`PROMPTS.md`](./PROMPTS.md) for how it was built.
