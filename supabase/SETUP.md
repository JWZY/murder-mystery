# Supabase setup (one-time, ~10 min)

This is the only step that needs your Supabase account. Everything else I build
against the keys you paste here.

## 1. Create the project
1. Go to <https://supabase.com> → sign in → **New project** (free tier).
2. Name it (e.g. `murder-mystery-2026`), pick a region near Toronto
   (`East US (North Virginia)` is closest/fast enough), set a DB password.
3. Wait for it to provision (~2 min).

## 2. Apply the SQL (in this order)
Open **SQL Editor** → **New query** and run each file's full contents in turn:

1. [`schema.sql`](./schema.sql) — tables, RLS, the 6 participant RPCs, grants.
2. [`patch-01-token-fn.sql`](./patch-01-token-fn.sql) — token-generator fix for
   Supabase's `extensions` schema. *(Already folded into schema.sql for fresh
   installs; run it only if you applied an older schema.sql.)*
3. [`host.sql`](./host.sql) — **edit the passcode on the last line first**, then
   run. Adds the host passcode + the Responses read RPCs.
4. [`casting.sql`](./casting.sql) — host CRUD RPCs for casting + the two-layer
   cards, and the `released` gate on `get_my_character`. Idempotent.

Each should report "Success." After step 4 the host **Casting** and **Settings**
tabs work. Verify with `node scripts/host-smoke-test.mjs "<your passcode>"`.

## 3. Grab the two public values for the static site
**Project Settings → API**:
- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public key** → `VITE_SUPABASE_ANON_KEY`

These are safe to ship in the GitHub Pages build — access control lives in RLS +
the RPCs, not in the client. Paste them into a local `.env` (and into the GitHub
Pages build env / repo secret) like:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> ⚠️ The **service_role** key (also on that page) is the host master key — it
> bypasses RLS. NEVER put it in the static site or commit it. You only need it if
> you later want the host app to read/write secrets directly; otherwise manage the
> plot from the Supabase dashboard.

## 4. (Later) Open / close the intake
The `public_settings` row controls the form:
- `intake_open = false` → `submit_intake` refuses new submissions.
- `roster_visible = false` → hides the "who else is coming" partial.

Flip these from **Table Editor → public_settings** when you want to lock things.

## Security note
The model assumes the anon key is public (it is). An attacker with it can only:
- read public party settings,
- submit a new intake (rate-limit/▸ turn off when closed),
- with a **valid token**: read/edit *that person's own* answers, see the curated
  public roster, and (once released) read *that person's own* character.

They cannot read anyone's secrets, contact info, truth-layer answers, the plot,
or who the murderer is — those columns are not in any anon-callable function.
Consider running `/security-review` on `schema.sql` before going live.
