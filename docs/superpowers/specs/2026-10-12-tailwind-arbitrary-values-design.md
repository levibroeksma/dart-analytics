# Tailwind arbitrary values → tokens, utilities and a gate

## Goal

Remove hand-rolled Tailwind arbitrary values (`prop-[…]`, `/[…]`, `variant-[…]:`)
from `app/src`, so every design value comes from a stock v4 class, a
`global.css` token, or a named `@utility`. Then make
`scripts/check-style-tokens.sh` ban new ones, so agents cannot drift from the
convention. Visual change is limited to the snaps listed below.

Source: `docs/superpowers/handoffs/2026-10-12-tailwind-arbitrary-values-audit.md`
(190 `.astro` hits in 72 files). This spec widens the scope to `.ts` class
strings and `@apply` in `global.css`. All near-miss decisions below were made
one by one with the user.

## Evidence

- The Style Guide says tokens and primitives are defined once in
  `global.css` (D428: "a new value enters `global.css` as a token before any
  component uses it"). The audit shows this is not enforced.
- Arbitrary values also exist outside `.astro`:
  - `lib/ui/play-display.ts`: 8 cqw clamps (D432)
  - `training-week.data.ts:23`: `text-[15px]`
  - `global.css` `@apply`: `text-[9px]`, `text-[11px]/[normal]`,
    `tracking-[0.08em]`, `tracking-[0.14em]`, `bg-radial-[at_50%_0%]`
- Compile-verified against Tailwind 4.3.2: `@theme --grid-template-columns-<name>`
  → `grid-cols-<name>`; `@utility border-medium`; `--text-<name>` holding a
  `clamp()` with `--line-height`.

## Decisions

| # | Topic | Decision |
| - | ----- | -------- |
| 1 | Gate strictness | Ban every arbitrary value, modifier and variant. Exceptions only through an allowlist |
| 2 | Gate scan | `app/src/**/*.astro`, `app/src/**/*.ts` (not `*.test.ts`), `@apply` lines in `app/src/styles/*.css` |
| 3 | Allowlist form | `path\|exact-class` rows in the script, one `# reason` each. No inline markers, no patterns |
| 4 | New font tokens | Named by role; each bundles size, line-height and tracking |
| 5 | Transitions | `Link`, `IconBtn`, `Button`, `Input`, `BoardInputPanel` → `transition`; `ScheduleFormModal`, `CheckoutConfirm` → `transition-colors` |
| 6 | Line-height of new tokens | Explicit unitless values: 1.3 for sans text, 1.2 for mono/caps, 1 for numerals. Never `normal` |
| 7 | Hand-rolled existing tokens | Swap to `text-title` / `text-card-title` / `text-eyebrow` / `text-hero`; line-height moves to the token value |
| 8 | 15px text | Rename `text-button` → `text-control` (15px / 1.3 / 0); use it for all 15px control text |
| 9 | 0.14em eyebrows | All → `text-eyebrow-lg` (`HomeHero:11`, `ResumeSessionDeck:55,84`, `ResumeSessionCard:19`, `.section-eyebrow` in `global.css`) |
| 10 | Unpaired 10px | Tracked labels (`CareerTiles:15`, `ResumeSessionDeck:129`, `UserSection:34`) → `text-eyebrow`; `RoutineRow:26`, `LegBars:42` → `text-micro` |
| 11 | Numerals | See the token table; `ScoreInput:71` and `Stepper:68` → `text-value` (Stepper 32→30px) |
| 12 | `leading-[1.55]` | `leading-relaxed` (`InfoSection:35,64`) |
| 13 | Odd radius/blur/border | `CardStack` slabs → `stack-slab-1/2`; `ScoreInput:79` → `rounded-xl`; `StatsHeatmap:33` → `rounded-xs`; `Select:60` → `backdrop-blur-xs`; `border-[1.5px]` → `border-medium` |
| 14 | cqw clamps | `text-numeral-1…6` tokens; `play-display.ts` maps lengths to them |
| 15 | Tracking | No `--tracking-*` tokens. Tracking lives in `--text-*` bundles or stock steps. 0.02 → `tracking-wide` (`SlideToStart:63`, `SetupShell:39`); 0.06 → `tracking-wider` (`GameLayout:47`); 0.01 → dropped (`GameRow:35`, `RoutineStepRow:48`); `.mode-pill` in `global.css` → `text-caption tracking-widest` |
| 16 | Composites | Grid and safe-area/nav tokens + utilities (see below) |
| 17 | Delivery | One branch, one PR; the gate lands already green |
| 18 | 9px tag (post-audit) | Already exists as `text-eyebrow-sm` (9px / 1.2 / 0.1em, D450), so there is no `text-tag`. D450 also already moved the 9px and tracked-10px labels |
| 19 | `/[…]` on stock sizes (post-audit) | `text-xs/[normal]`, `text-base/[normal]`, `text-lg/[normal]` → `/tight` (1.25, the nearest stock value to `normal`); `text-xs/[1.5]` → `text-xs/normal` (exact); `text-eyebrow/[normal]` and `text-eyebrow/[1.3]` → `text-eyebrow` (token line-height) |
| 20 | Number-input spinners (post-audit) | `RoutineStepRow:64`: `[appearance:textfield]` plus the two `[&::-webkit-*-spin-button]:appearance-none` → `@utility input-number-plain` |
| 21 | `after:content-['']` (post-audit) | Drop it: v4 `after:` already emits `content: var(--tw-content)` (initial `""`). Compile-verified |

## Design

### 1. `global.css` additions

`@theme` text bundles (size / line-height / letter-spacing):

| Token | Value | Replaces |
| ----- | ----- | -------- |
| `text-body-sm` | 0.8125rem / 1.3 / 0 | 13px text not paired with 0.06em (audit C, 17 hits) |
| `text-caption` | 0.6875rem / 1.2 / 0 | `text-[11px]` (audit C, 12 hits) and `.mode-pill` |
| `text-micro` | 0.625rem / 1.2 / 0 | `RoutineRow:26`, `LegBars:42` |
| `text-key` | 1.625rem / 1 / 0 | `InputButton:48` |
| `text-key-label` | 1.375rem / 1.2 / 0.08em | `SinglesRecreationalInput:78`, `DoublesPathRecreationalInput:34` |
| `text-stat` | 1.0625rem / 1 / 0 | `TargetGrid:43`, `PlayStatTile:35` |
| `text-summary` | 2.5rem / 1 / 0 | `ComparisonSummary:91`, `SinglePlayerSummary` sm |
| `text-summary-lg` | 3.25rem / 1 / 0 | `SinglePlayerSummary` lg |
| `text-numeral-1` … `-6` | D432 clamps (45/30/18/15/11/10 cqw, caps 5.25/4/2.875rem) / 1 / -0.02em | `play-display.ts`; `tracking-[-0.02em]` at `SplitScoreboardHalf:70`, `SinglePlayerDisplay:53` |
| `text-control` (renamed from `text-button`) | 0.9375rem / 1.3 / 0 | all 15px sites + the existing `text-button` refs |

Numeral mapping, distinct clamps only:

| Token | Clamp |
| ----- | ----- |
| `numeral-1` | `clamp(2.5rem,45cqw,5.25rem)` |
| `numeral-2` | `clamp(2rem,30cqw,4rem)` |
| `numeral-3` | `clamp(1.5rem,18cqw,2.875rem)` |
| `numeral-4` | `clamp(1.25rem,15cqw,2.875rem)` |
| `numeral-5` | `clamp(1.125rem,11cqw,2.875rem)` |
| `numeral-6` | `clamp(1rem,10cqw,2.875rem)` |

Other `@theme`:

- `--grid-template-columns-mirror: minmax(0,1fr) auto minmax(0,1fr)`, replacing
  `StatRowComparison:23` and `ComparisonSummary:66,100`
- `--grid-template-columns-scoreboard: 1.3fr 1fr`, replacing
  `SplitScoreboardHalf:52` and `SinglePlayerDisplay:42`

`:root`:

- `--nav-bottom: max(0.5rem, calc(env(safe-area-inset-bottom) - 0.5rem))`
- `--nav-clearance: 5.5rem`

`@utility`:

| Utility | CSS | Replaces |
| ------- | --- | -------- |
| `stack-slab-1` | bottom radius 19px, `bg-stack-1`, inset top-light shadow 0.15 | `CardStack:48` |
| `stack-slab-2` | bottom radius 18px, `bg-stack-2`, inset shadow 0.12 | `CardStack:38` |
| `border-medium` | `border-width: 1.5px` | `ScheduleFormModal:114`, `AddGuestButton:34` |
| `pt-safe` / `pb-safe` | `calc(env(safe-area-inset-top/bottom) + 1rem)` | `Modal:60`, `ExpandingModal:62` |
| `bottom-nav` | `bottom: var(--nav-bottom)` | `BottomNav:27` |
| `bottom-above-nav` | `bottom: calc(var(--nav-bottom) + var(--nav-clearance))` | `SlideToStart:35` |
| `pb-nav` | `padding-bottom: calc(env(safe-area-inset-bottom) + var(--nav-clearance))` | `AppLayout:16` (keeps its current formula) |
| `input-number-plain` | `appearance: textfield`; `::-webkit-inner/outer-spin-button { appearance: none }` | `RoutineStepRow:64` |

No `--tracking-*`, `--leading-*` or new `--radius-*` tokens.

### 2. Migration

- **Audit A:** every rename as listed (spacing/size steps, `h-lh`,
  `scale-106`, `flex-2`, `group-has-focus`, `tracking-widest`).
- **Audit B:** radius → `rounded-key` / `rounded-row` / `rounded-switch`;
  typography per decisions 7 and 9.
- **Audit C and D:** per the tables above and decisions 10–16.
- `/[normal]`, `/[1.3]`, `/[1.5]` modifiers disappear: a role token supplies
  the line-height, and where no token applies a stock `leading-*` does.
- Accepted visual change:
  - sub-pixel line-height shifts
  - 11→12px and 10→12px eyebrows
  - `Stepper` 32→30px
  - `ScoreInput` submit radius 17→16px
  - heatmap cell radius 1→2px
  - `Select` picked blur 2→4px
  - tracking snaps of ±0.02em or less
  - transitions now also animate opacity/filter for 150ms

### 3. Gate (`scripts/check-style-tokens.sh`)

A new `ARBITRARY` block after `NEG_ARBITRARY`, in the same style.

- **Matches:**
  - arbitrary values: `[a-z][a-z0-9-]*-\[[^]]+\]`, including variant
    position (`group-has-[…]:`)
  - arbitrary modifiers: `/\[[^]]+\]`
  - bare arbitrary properties `[prop:value]`, inside class strings only
    (TS index signatures must not match)
- **Files:** `app/src` `*.astro` and `*.ts` (excluding `*.test.ts`), plus lines
  containing `@apply` in `app/src/styles/*.css`.
- **`ARBITRARY_ALLOW`:** an array of `path|exact-class` rows, each preceded by a
  `# reason` comment. Initial rows:
  - `GrowingCard` `transition-[top,left,width,height]`
  - `Select` `grid-rows-[0fr]`, `group-data-open:grid-rows-[1fr]`,
    `transition-[grid-template-rows]`, `max-h-[60dvh]`
  - `SlideToStart` `motion-safe:transition-[left,scale]`
  - `Modal` `max-h-[calc(100dvh-2rem)]`
  - one-off grids: `FiveOhOneSetupForm:88,125`, `SinglePlayerSummary:62`,
    `SetupShell:30`
  - `app/src/styles/global.css|bg-radial-[at_50%_0%]`
  - `.ts` false positives found in the sweep (regex literals, e.g.
    `routine-scope.module.ts`)
- **Stale rows:** a row with no match in its file fails the gate.
- **Failure message:** lists the hits, then the fix ladder: stock v4 class →
  existing `@theme` token → new token in `global.css` (D428) → `@utility` for
  a repeated composite → allowlist row with a reason (last resort, reviewed).
  It points to Style Guide §Arbitrary values.
- **OK message** gains "or unlisted arbitrary value".
- **CI:** unchanged (`quality.yml` already runs the script).

### 4. Docs and decision

- `decisions/frontend/style.md`: D451 covers:
  - the arbitrary-value ban, the allowlist mechanism and stale-row rule
  - role-named `--text-*` bundles; no tracking/leading tokens
  - `text-button` → `text-control`
  - D432 numeral clamps moved to `text-numeral-*`

  It cites D428 and D432 and supersedes nothing.
- `docs/architecture/07-Frontend/07-Style-Guide.md` → 0.5.0:
  - type-scale row lists the new tokens
  - L127 numeral row uses `text-numeral-*`
  - new "Arbitrary values" subsection under §Tailwind v4 class syntax: the
    ladder and the allowlist; the Container-queries paragraph points to
    `text-numeral-*` instead of prescribing `text-[clamp(…)]`
  - Anti-patterns gains a row
  - Primitives table gains `stack-slab-*`, `border-medium`, `pt/pb-safe`,
    `bottom-nav`, `bottom-above-nav`, `pb-nav`, `input-number-plain`
- `app/src/components/CLAUDE.md` §Style non-negotiables: one line ("no
  arbitrary values; see Style Guide §Arbitrary values; gated by
  `check-style-tokens.sh`").
- `07-Frontend/10-Frontend-Agent-Guide.md` L118 rule paragraph and L147
  checklist: add "no arbitrary values (ladder; allowlist)".
- Gate header comment cites D451.
- The audit handoff stays as non-canonical source material.

## Testing

- **Gate proof by hand, recorded in the PR:** plant one violation of each kind
  (value, modifier, variant, `@apply`, `.ts` string, stale allowlist row),
  confirm FAIL, revert, confirm OK. No new harness.
- **Runs:** `bash scripts/check-style-tokens.sh`, the `run-all-gates` skill,
  the `validate-app` skill (astro check, `npm test`).
- **Before vs after grep:** zero unlisted arbitrary values.
- **Device check (user):** home, games setup, play (501, cricket, singles),
  summaries, training, profile, login, and modals.

## Out of scope

- `:style=` Alpine bindings (runtime values).
- A new gate test harness.
- Arbitrary values in `global.css` outside `@apply` (token/utility definitions
  are the definition site).
