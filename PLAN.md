# Murder Mystery Party 2026 — Master Plan

> Working plan for the third edition. Synthesizes what worked in **2022**
> (complex, narrative, character-driven) and **2024** (icebreaker-driven, real
> people), and fixes the one big complaint from 2022: *"I got to know the
> fictional characters, not the actual people."*
>
> Host: Javan. Venue: ~1200 sqft townhome (kitchen, living, dining, walkout
> basement, backyard + BBQ). Date: **mid-July, Toronto** (hot — design around it).

---

## 1. What we learned from the last two events

### 2022 "Wedding Reception" — the complex one (the template we're building on)
- ~28 fully-written character cards. Each card had a fixed shape:
  **Character name · Title · Background · Act I (Introduction) · Act II (Action) · Act III (Clue/Outcome) · props/notes.**
- Three acts + a conclusion (everyone votes on the murderer → tally → arrest → reveal).
- Host played **Jarvis the butler / Storyteller** — narrator who paces the acts.
- Casting inputs from the intake form:
  - **Roleplay comfort, 1–5** ("The Extra → The Cameo → Recurring → Supporting → Main"). *Excellent signal — keep it.*
  - **Trope preferences** (free text: "detective", "drug dealer", "con artist"…). *Keep it.*
  - Gender, dietary, potluck dish, contact method.
- Strong mechanics worth reusing:
  - **Props** as physical clues: prop money, fake "coke"/meds baggies, ring-pop "diamonds", an empty baggie left at a location = a clue.
  - **Factions**: an undercover FBI trio (recognized each other via a passphrase + crossed utensils), a crime family, a cartel. Built-in reasons to seek specific people out.
  - **"Recommended guests to get to know"** printed on each card — the entanglement engine that forced interaction.
- **The flaw:** every card was 100% fiction. Nothing tied "Lunette the murderous lawyer" to the real person playing her. People bonded with masks.

### 2024 "Mixer" — the simplified one (the real-intimacy engine)
- Murder clues were built from **icebreaker questions** instead of a scripted plot.
- Questions that produced genuinely revealing, warm, funny answers:
  - *"When/where would you visit with a time machine?"*
  - *"Worst job you've ever had?"*
  - *"A hobby you're passionate about?"*
  - *"An opinion you've held that has **changed** over time?"*
  - *"Something people are surprised to learn about you."*
  - (DnD-flavored: favorite class — this group skews tabletop/nerdy.)
- **Murderer recruited by opt-in:** the form asked *"Are you interested in being the Murderer? (won't lose composure under pressure / has social-deception experience)"* — Very interested / Not sure / Not interested. *Brilliant. Keep it.*
- The answers were the gold: people wrote paragraphs of real, vulnerable, specific life story. **This is the raw material 2022 was missing.**
- **The flaw:** without a narrative spine, it was a mixer with a whodunit bolted on — less memorable as a *story*.

### The thesis for 2026
> **Build 2022's narrative depth on top of 2024's real-person revelation.**
> Each fictional character is *seeded from true things about the player*, and the
> night ends with an explicit out-of-character reveal of "what was actually true."
> The mask becomes a lens, not a hiding place.

---

## 2. The core innovation: "Two-Layer Characters"

Every character card carries two intertwined layers:

1. **Fiction layer** — the 2022-style role: name, title, background, per-act actions, secret/motive, props, recommended people to meet.
2. **Truth layer** — 1–3 *real* things about the player, harvested quietly from the intake form and woven into the fiction so that performing the character also reveals the person.

**How the weaving works (host's job during story planning):**
- A player's real "worst job" becomes their character's backstory grievance.
- A real hobby becomes the character's cover identity or party small-talk.
- A real "opinion that changed" becomes a line of dialogue the character delivers in Act II.
- A real "surprise fact" becomes a clue another player has to surface about them.

**Truth tags & the reveal.** Each woven clue is tagged on the card with a small
marker: *"(this part is actually true about you — share it if you're comfortable)."*
Players choose, in the moment, whether to drop the mask on that beat. Then:

- **The Debrief (new closing beat, after the reveal of the murderer):** a short
  round — "Mask Off." Everyone shares **one true thing** they smuggled into their
  character tonight. This is the structural fix for the 2022 complaint. Low
  pressure, opt-in depth, and it reframes the whole night retroactively: *"wait,
  that was real?"*

**Entanglements seeded by real compatibility.** Use intake answers to deliberately
pair two *real* people who'd click (shared niche hobby, complementary energy,
both opted into high roleplay) and give their *characters* a shared storyline, so
they must interact deeply. The fiction is the excuse; the friendship is the point.

---

## 3. Intake form design

Two-part form. Part A is logistics + casting signal (fast). Part B is the
truth-harvest (the fun part, optional-depth). All answers are private to the host
except where noted.

### Part A — Logistics & casting (keep short)
| Field | Type | Purpose |
|---|---|---|
| Preferred name | short text | identity |
| Contact method | short text | reach them about the party |
| **Roleplay comfort (1–5)** | single-select | central casting signal (Extra→Main). *From 2022.* |
| Trope/character wishlist | long text | "detective, con artist, washed-up rockstar…" *From 2022.* |
| **Murderer appetite** | single-select | Very interested / Could try / Please no. *From 2024.* |
| Dietary constraints | short text | potluck safety |
| Potluck dish (category) | single-select + text | balance the spread (appetizer/main/dessert/side/drink) |
| Hard limits / topics to avoid | long text | safety — no real trauma weaponized as a clue |

### Part B — The truth harvest (this is where intimacy is engineered)
Each maps to a way of weaving the person into their character. Framed as
"the more you give me, the more *you* shows up in your character."

| Question | Becomes… |
|---|---|
| Something people are surprised to learn about you | a clue others must surface |
| Worst job / most chaotic work story | character's grievance or cover job |
| A hobby you could talk about for an hour | character's small-talk + a recommended-meet hook |
| An opinion of yours that **changed** over time | a line of dialogue / a character's arc |
| A small, harmless secret you'd be fine "outing" in-character | the character's secret, defused & fictionalized |
| Who here do you already know well? Who would you like to know better? | drives entanglement pairing + avoids casting close friends as obvious allies |
| A skill you could believably fake on the spot (accent, lockpicking, palm-reading…) | a character party-trick / Act II action |
| How much do you want the night to reveal the *real* you? (1–5) | **consent dial** — controls how much truth layer they get |

> **Consent is a first-class input.** Nobody gets truth-woven beyond the dial they
> set. A "1" plays a purely fictional character (2022-style); a "5" gets a
> character that's 60% them in a wig.

---

## 4. Tech architecture

**Constraints:** no server costs, hosted on **GitHub Pages** (static only),
unknown headcount, per-person editable links, partial visibility of others.

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Pages (static)  — one Vite/React build                │
│                                                               │
│   /?p=<token>     participant view  (intake + self-edit +     │
│                   partial view of others)                     │
│   /host           host planning app (canvas, casting,         │
│                   story acts, card generation)  [token-gated] │
└───────────────────────────┬───────────────────────────────────┘
                            │  supabase-js (anon key, public-safe)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase (free tier) — Postgres + Row Level Security         │
│   participants · intake_answers · characters · relationships  │
│   · story_acts · public_settings                              │
└─────────────────────────────────────────────────────────────┘
```

**Why this is safe with a public anon key on a static site:** all access control
lives in **Row Level Security** policies, not in the client. The participant's
token is the credential. Policies enforce:
- a token can `SELECT` + `UPDATE` **its own** participant row and intake answers;
- a token can `SELECT` only **whitelisted public columns** of *other* participants
  (e.g. preferred name, public bio, potluck dish, RSVP) — never their secrets,
  contact, truth-layer, or the plot;
- nobody but the host (separate authenticated role / service usage) can read the
  `characters.secret`, `story_acts`, or the murderer assignment.

**Token model:** each participant gets an unguessable token (e.g. 16-char
base62). The link is `username.github.io/murder-mystery/?p=<token>`. Tokens are
opaque; RLS matches `token = current_setting('request.token')` via a Postgres
RPC that sets the token from a header/param. (Exact mechanism specified in the
schema task — likely a security-definer RPC layer so the anon key can't bypass.)

**Existing code we keep:** the repo already has the host planning app — infinite
canvas, character nodes + relationship edges, intake/guest/planning tabs, story
acts, all in React 19 + Zustand + Immer + Framer Motion, persisted to
localStorage. We **extend** it: swap localStorage for Supabase as the source of
truth, add the participant route, add card generation.

---

## 5. The host's sequential workflow (this is "story planning")

1. **Send intake** → responses land in Supabase, visible in the Guest tab.
2. **Cast** → match people to characters using comfort (1–5), tropes, murderer
   appetite, and the social graph ("knows / wants to know").
3. **Build the web** → on the relationship canvas, draw character entanglements;
   seed real-compatibility pairs.
4. **Weave truth** → for each character, pull the player's Part-B answers into the
   Background / per-act actions / secret, respecting their consent dial. Tag the
   true beats.
5. **Generate cards** → per-character printable card (Background, Act I/II/III,
   recommended-meets, props, truth tags).
6. **Open participant links** → people review their character, can edit logistics
   and re-confirm, and see the partial public roster (who's coming, dishes, public
   bios) to build anticipation.
7. **Party night** → run acts as Storyteller; close with the "Mask Off" debrief.

---

## 6. Venue & heat design (mid-July Toronto, 1200 sqft townhome)

- **Zones as stage:** kitchen (the bar/Jarvis station + autopsy bit), living room
  (main mingling / speeches), dining (potluck spread), **walkout basement
  (coolest room — make it a key Act II location)**, backyard + BBQ (Act I arrival
  + food, *not* where people are forced to linger in peak heat).
- **Heat safety:** keep AC zones (basement, interior) as the "story core";
  treat the backyard as an *optional* warm-up/cool-down space, not a required
  stage. Hydration station at the bar (in-fiction: Jarvis serves drinks). Avoid
  scripted actions that trap people outdoors mid-afternoon.
- **Timing:** start late-afternoon/early-evening so Act III lands after sundown
  when the yard is usable and pleasant.
- **Capacity:** unknown headcount; design the cast to scale — a core ~12 plotted
  characters + a flexible bench of lighter "Cameo/Extra" roles (low-comfort folks)
  that can expand or contract without breaking the plot.

---

## 7. Open creative decisions (host to confirm)

- **2026 premise/theme.** Proposing a fresh frame, *not* a repeat wedding. Leading
  candidates: a **gallery opening / art-world gala**, a **reunion** (built-in
  "knowing each other" excuse), or an **awards night**. (Default if unspecified:
  a reunion-flavored gala — best fit for the real-intimacy goal.)
- **Headline intimacy mechanic** to feature: the **"Mask Off" debrief** + **truth
  tags** are the core; optionally add a mid-game "two truths" side-quest.
- **Scale target** (rough headcount) to size the cast.

---

## 8. Build order (tracked in the task list)

1. ✅ This plan.
2. **Supabase schema + RLS** — the data model & access rules.
3. **Participant flow** — intake, self-edit, partial roster, on GitHub Pages.
4. **Host app → Supabase** — casting, weaving, card generation.

> Decisions are being made autonomously per host's request; this doc is the record
> of *why*. Anything in §7 can be overridden anytime.

---

## 9. Decisions log (autonomous build, 2026-06-04)

Shipped the full host workspace in one session. Key calls made without oversight:

- **Theme resolved: Reunion gala** (§7). Best fit for the real-intimacy goal — a
  reunion gives a built-in, in-fiction excuse for guests to actually learn about
  each other ("catching up"), which is exactly the 2022 gap we're closing.
- **Host auth = passcode, not service key.** A static site can't safely hold a
  master key, and shipping one would defeat the whole RLS model. Instead the host
  proves itself with a bcrypt-hashed passcode (`host.sql`) checked inside
  SECURITY-DEFINER RPCs. One unlock, stored in `localStorage`, reused across host
  tabs. Trade-off: anyone with the passcode has full host access — fine for a
  one-host party tool; rotate by re-running the insert in `host.sql`.
- **Two source-of-truth split.** The Supabase-backed tabs (Responses, Casting,
  Settings) are the real system. The original localStorage canvas (Canvas / Guest
  List / Q-Planner tabs) stays as an *optional brainstorming scratchpad* — not
  migrated to async Supabase, because full migration is high-risk and low-value
  for a single host. The Casting tab is what participants actually see.
- **`released` gate on cards.** Players can't see their character until the host
  flips Release — so cards can be drafted/revised privately. `get_my_character`
  now requires `ch.released`.
- **Two-layer auto-seed** (`src/host/seedCharacter.ts`). Drafting a card pulls the
  guest's real answers into a reunion-gala persona, with how much truth shows
  through gated by their consent dial (1 Mask → 5 Wig). Never touches
  `hard_limits`; only surfaces `outable_secret` at dial 5. It's a strong first
  draft the host then edits — not a finished card.
- **Privacy:** the local `Murder Mystery Planning/` folder (real people's past
  responses, incl. a 74 MB PDF) is gitignored — never committed/published.
- **Deploy:** GitHub Pages via Actions (`.github/workflows/deploy.yml`), Vite
  `base` = `/<repo>/`. The publishable key is embedded as a workflow default
  because it is public by design (overridable via repo Variables).

### Still open / nice-to-have (not built)
- "Mask Off" debrief as an in-app screen (currently a hosting ritual, see §5).
- Migrating the relationship canvas to live Supabase characters (today it's local).
- A host "generate all cards" bulk action + cast-balance view (murderer spread,
  comfort distribution).
