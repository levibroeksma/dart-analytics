# Design: DartBot level-select stats

## Problem

`OpponentChooserModal.astro`'s level step (`2026-09-03-dartbot-level-picker-design.md`)
offers a bare 1–15 slider with a drag-only tooltip. `08-DartBot.md`'s D-L refit
explicitly deferred "the level-picker average/checkout UI" pending a
brainstorm, since a shown number needs a defined data source — which now
exists: `LEVEL_SKILL_TABLE` is refit against the measured population prior
(D-L), so per-level simulation output is meaningful, not placeholder.

This design adds two stat rows (three-dart average, checkout %) above the
slider, replaces the drag tooltip with a persistent level pill, and titles
the step "Difficulty" — visual reference: a screenshot of an unrelated app's
difficulty-config screen, used for layout/style only (its Dutch labels and
third "scoring average" stat are not carried over).

## Stats shown

Two, both real harness outputs — no invented "scoring average":

- **Three-dart average** — band from simulated visit totals at T20 treble.
- **Checkout %** — band from simulated single-dart D20 attempts.

## Data: precomputed today, swappable later

### Generation (one-off, today)

`app/scripts/dartbot-level-select-stats.ts` (mirrors
`dartbot-level-curve-refit.ts`). `app/tests/modules/dartbot/harness/simulate-tier.ts`
gains `simulateTierStatsDetailed()`, returning everything `simulateTierStats`
does plus the raw `visitTotals: number[]` and per-attempt
`checkoutOutcomes: boolean[]` — no new RNG logic, just exposing arrays the
function already builds internally.

Per level 1–15, seed `800000 + level`, `N = 5000`:

- **Average band** = 25th/75th percentile of `visitTotals`, rounded to the
  nearest integer.
- **Checkout band** = 25th/75th percentile of per-batch checkout rate, where
  `checkoutOutcomes` is split into 20 batches of 250 attempts each — a rate
  needs batching to have a distribution at all; batching is what turns a
  single pass/fail stream into a spread. Rounded to the nearest whole
  percentage point (stored as `0..100`, not `0..1`, to match the display
  string directly).

The script prints JSON (existing one-off convention — not imported by
production code); the printed table is hand-copied into the module below,
exactly how `LEVEL_SKILL_TABLE` was populated from the curve-refit script's
output.

### Storage and access (the swap seam)

`app/src/modules/dartbot/level-select-stats.module.ts`:

```ts
export type LevelSelectStats = {
  averageLow: number;
  averageHigh: number;
  checkoutLow: number; // 0..100
  checkoutHigh: number; // 0..100
};

export const LEVEL_SELECT_STATS_TABLE: Readonly<Record<number, LevelSelectStats>> = { 1: {...}, ..., 15: {...} };

export function allLevelSelectStats(): Readonly<Record<number, LevelSelectStats>> {
  return LEVEL_SELECT_STATS_TABLE;
}

export function levelSelectStatsForLevel(level: number): LevelSelectStats {
  // clamp 1..15 + lookup, mirrors skillProfileForLevel
}
```

`LevelSelectStats` is added to `types.ts` (module type barrel, per
`08-DartBot.md` §Module Boundary).

**`allLevelSelectStats()` is the only access point the UI calls.** Today it
returns the constant table synchronously. A future swap — live DB lookup or
on-the-fly compute — replaces this one function's body (Astro frontmatter
already supports top-level `await`, so the function can turn async without
touching its call site's shape) and touches nothing downstream: same
per-level fields, same caller, same one call site. No repository/interface
layer is added now — one function is the whole boundary, and building more
before a second implementation exists is speculative (YAGNI).

The call happens once, in `OpponentChooserModal.astro`'s frontmatter, for
all 15 levels at once (not per-level, not on every slider tick) — matching
`Toggle.astro`'s existing precedent of serializing Astro-computed config
into Alpine via `JSON.stringify`:

```astro
const levelSelectStats = allLevelSelectStats();
```

```html
<div x-data={`{ levelSelectStats: ${JSON.stringify(levelSelectStats)} }`}>
  ...
  x-text="`${levelSelectStats[pendingBotLevel].averageLow}–${levelSelectStats[pendingBotLevel].averageHigh}`"
</div>
```

The template only ever indexes the already-serialized object by
`pendingBotLevel` — a plain client-side lookup, so the slider stays instant
with no loading state, whether the table behind it was static or fetched
once at render time.

## UI — `OpponentChooserModal.astro` level step

- `<h2>` text for the level step changes from `'DartBot level'` to
  `'Difficulty'` (English — matches the app's existing UI language; the
  screenshot's Dutch labels are style reference only).
- The drag-only floating tooltip (`<p class="glass ... peer-active:opacity-100" x-text="Level ${pendingBotLevel}">`)
  is removed outright and replaced by a persistent `Badge` pill
  (`variant="accent"`, `Lv. {n}`) placed beside the title, bound
  `x-text="pendingBotLevel"` — always visible, not drag-gated.
- Two stat rows are added above the slider, in order: three-dart average,
  then checkout %. Each row: label (`text-sm text-foreground`) + numeric
  range (`text-sm font-semibold`, e.g. `"37–47"` / `"10–35%"`), then a range
  bar beneath:
  - Track: `h-2 rounded-full bg-surface-overlay overflow-hidden relative`.
  - Filled segment: `absolute h-full rounded-full bg-accent`, positioned
    `left`/`width` as percentages of a fixed domain — `0–180` for the
    average (three darts at treble 20, the real ceiling, not an arbitrary
    max), `0–100` for checkout %. This encodes the same low–high band the
    text shows, not a decorative fill.
  - Both rows hand-rolled inline in the modal frontmatter/markup — no
    existing Component Inventory primitive is a range bar, and this shape
    is single-use today (D101 precedent: variant markup stays inline where
    nothing reusable fits).
- No question-mark/info affordance is added.
- No new color: pill and bars use only `accent` / `accent-muted` /
  `surface-overlay` tokens already in the style guide — brand-consistent
  without a token change.
- Footer (Cancel / Add DartBot) is unchanged.

## Testing (D224 — every touched runtime `.ts` needs a covering test)

- `app/tests/modules/dartbot/level-select-stats.module.test.ts` —
  `levelSelectStatsForLevel`'s clamping/lookup (mirrors
  `skill-profile.module.test.ts`), plus static monotonicity assertions over
  `LEVEL_SELECT_STATS_TABLE` (`averageLow`/`averageHigh`/`checkoutLow`/
  `checkoutHigh` each non-decreasing level-over-level) and `allLevelSelectStats()`
  returning the same table.
- `app/tests/scripts/dartbot-level-select-stats.test.ts` — the script's
  pure percentile/batching helpers, given a stub array of visit totals /
  checkout outcomes.
- `app/tests/modules/dartbot/harness/simulate-tier.ts`'s new
  `simulateTierStatsDetailed()` is test-harness code (not production),
  exempt from D224 same as the rest of `harness/` — covered indirectly by
  `tier-bands.test.ts` continuing to pass and by the new script test above
  exercising its output shape.
- `.astro` markup (pill, stat rows, bars) is exempt from a component test
  runner (D101) — verified by running the app and exercising the DartBot
  level step on a DartBot-enabled setup screen (e.g. `/games/bobs-27/setup`).

## Non-goals

- The third screenshot stat ("scoring average") — no defined distinct
  meaning from three-dart average; not built.
- `fitProfile()`, D-K (auto level) — untouched.
- A repository/service/interface layer for the future DB swap — deferred
  until a second implementation actually exists.
- Any change to `LEVEL_SKILL_TABLE`, the throw pipeline, or the slider's
  1–15 domain itself.
