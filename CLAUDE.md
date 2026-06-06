# Murder Mystery — Project Instructions

## Typography (HARD RULES — do not violate)

The type system in `src/styles/tokens.css` is deliberately tiny. **Do not add to it without removing something.** When you add new components or UI, you must stay inside this set:

**Families — 3 only**
- `--font-title` (Special Elite)
- `--font-heading` (Special Elite)
- `--font-body` (Crimson Pro)

**Sizes — 4 only, one per role**
- `--text-title` — the page masthead. There is no `-xl` size.
- `--text-heading` — section headings, large form questions. There is no `-lg` size.
- `--text-body` — everything else.
- `--text-body-small` — reserved for dense utility lines + tab labels. Not a general "small body" — if you reach for it for prose, you're wrong.

**Weights — 2 only**
- `--weight-body` (400)
- `--weight-bold` (600)

Do **not** introduce `--weight-title`, `--weight-heading`, `--weight-body-bold`, or any literal `font-weight: 300/500/700/800` value. Special Elite is single-weight anyway — heading-faced text uses `--weight-body`.

**Tracking — 3**
- `--tracking-title`, `--tracking-heading`, `--tracking-eyebrow` (small uppercase labels)

**Leading — 4**
- `--leading-flush` (1), `--leading-tight` (1.05), `--leading-snug` (1.4), `--leading-body` (1.5)

### Forbidden patterns

- Literal pixel sizes (`font-size: 18px`) — always use a token
- Literal `font-weight` values — always `var(--weight-body)` or `var(--weight-bold)`
- `clamp()` font sizes — they belong inside the token, not at the call site
- New per-component size/weight tokens (e.g. `--text-card-title`) — pick the closest existing token instead
- `--text-md`, `--text-lg`, `--text-sm`, `--text-xs` — these do not exist and silently fall back to browser default

For small uppercase labels above a value, use `.eyebrow` from `src/styles/ui.module.css` (font-heading · text-body-small · weight-bold · tracking-eyebrow · muted).

### When in doubt

Reach for `.title`, `.heading`, `.body`, `.bodyBold`, or `.eyebrow` from `ui.module.css` before writing new font CSS. Reduce, don't add.
