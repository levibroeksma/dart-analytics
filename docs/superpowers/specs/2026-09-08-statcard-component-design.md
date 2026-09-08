# StatCard Component + Statistics Page Wiring — Design

> **Date:** 2026-09-08
> **Status:** approved (brainstorming consensus)
> **Branch:** `claude/statcard-component-nlvknl`
> **Scope:** a reusable `StatCard` UI component, and wiring the (currently empty) Statistics page to `GET /api/statistics/overview` using it.
> **Out of scope:** carousel/slide usage (explicitly future); win rate (not in the API response yet); any change to the statistics API/service/repository layer, which already exists and is not touched by this task.

---

## Context

`GET /api/statistics/overview` (merged) returns `StatisticsOverviewResponseData` — 18 fields, several nullable, one (`highestCheckout`) an object. The Statistics page (`app/src/pages/statistics/index.astro`) is currently just a bare `<h1>`. This design builds the card primitive to display these stats and wires the page to real data.

The user supplied a conceptual starting component (label/value/hint/hintAccent props, `class:list`, legacy tokens `surface`/`text-fg-subtle`/`text-accent-400`). None of those tokens or `class:list` exist in this repo's style system (`07-Frontend/07-Style-Guide.md` — semantic tokens only, `cn()` only) — this design translates the concept, not the literal code.

## Component

### `StatCard.astro` (`app/src/components/ui/StatCard.astro`)

```ts
interface Props {
  label: string; // static text
  valueExpr: string; // Alpine expression, bound via x-text
  hintExpr?: string; // Alpine expression, bound via x-text
  class?: string;
  [key: string]: unknown;
}
```

- `label` is plain text rendered directly (not `x-text`) — matches `SettingRow.astro`'s static `label` vs. its Alpine `valueExpr`.
- `valueExpr`/`hintExpr` follow the `*Expr` naming already established by `SettingRow.valueExpr`, `Button.loadingExpr`, `ErrorAlert.showExpr`/`textExpr` — these are Alpine expression strings evaluated reactively, not literal display values. Needed because the Statistics page's data loads async from a store; a plain string prop can't update after Astro's server render.
- No `hintAccent`. Every hint renders `text-xs text-muted-foreground` — nothing in this dataset has a meaningful positive/negative judgement to accent, and the style guide's "Anti-patterns" table already forbids the example's legacy `text-fg-subtle`/`text-accent-400` tokens outright.
- Sizing: `w-full`, no forced height (`h-full` dropped) — the component has no width opinion; a parent `grid`/`flex` container decides 50% vs. 100% (`col-span-2` for full-width), and height follows content so two cards side by side don't stretch to match a taller sibling awkwardly.
- No loading state inside the component — pairs with a sibling `StatCardSkeleton.astro`, matching the existing `StatRow`/`StatRowSkeleton` split, so the component itself stays a pure display primitive.
- Markup/classes:

```html
<div class={cn("w-full rounded-2xl border border-border bg-surface-raised p-4", classNameProp)} {...props}>
  <p class="text-xs text-muted-foreground">{label}</p>
  <p class="mt-2 text-2xl font-bold tabular-nums font-mono text-foreground" x-text={valueExpr}></p>
  {hintExpr && <p class="mt-1 text-xs text-muted-foreground" x-text={hintExpr}></p>}
</div>
```

Card surface follows the style guide's "Surfaces & nesting" table (`bg-surface-raised` for a raised panel) and radius scale (`rounded-2xl` = "Cards").

### `StatCardSkeleton.astro` (same folder)

```ts
interface Props { label: string; class?: string; }
```

Same shell, a pulsing bar (`bg-muted-foreground/80 animate-pulse rounded`, per `StatRowSkeleton`'s own placeholder class) instead of the value; no hint slot — a skeleton doesn't need to preview hint content.

## Statistics page & data flow

### `lib/client/api/statistics.ts`

`fetchStatisticsOverview(): Promise<StatisticsOverviewResponseData>`, mirrors `profile.ts` exactly (`apiRequest("/api/statistics/overview")`, throws `StatisticsApiError` on failure). `StatisticsOverviewResponseData` is re-exported through `lib/client/api/types.ts` from `@routes/types` (already exported there; only the browser-facing re-export barrel needs the addition).

### `lib/stats/format-statistics-overview.ts`

Pure function `formatStatisticsOverview(data: StatisticsOverviewResponseData): FormattedStatisticsOverview`, all fields formatted to display strings (no Alpine/DOM concerns — plain unit-testable function per `app/CLAUDE.md` TDD rule). Formatting rules:

| Field(s) | Format |
| --- | --- |
| `totalGamesPlayed`, `totalDartsThrown`, `hundredPlusCount`, `oneTwentyPlusCount`, `oneFortyPlusCount`, `oneEightiesCount` | plain integer string |
| `totalPlayTimeSeconds` | `"{h}h {m}m"` (omit `h` segment under 1 hour) |
| `favoriteGameTypeKey` | looked up through a new small `game_type_key → title` map (values are `implementation_key`s like `501`/`TUOD`/`SINGLES_TRAINING`/`SCORE_TRAINING`/`BOBS27`/`DOUBLES_TRAINING`/`SHANGHAI`/`121`/`AROUND_THE_CLOCK` — these don't match `GAME_CARDS`' `rulesetVersionKey`s, e.g. `SINGLES_V1`, so this cannot be derived from `games-visibility.ts` and needs its own table); `"—"` when `null` |
| `currentPlayStreakDays`, `longestPlayStreakDays` | `"{n} day(s)"` each, combined into one card (see below) |
| `medianVisitScore`, `highestGameAverage`, `firstNineCareerAverage`, `scoringAverageExcludingDoubles` | 1 decimal place |
| `bestLegDarts` | `"{n} darts"`, `"—"` when `null` |
| `averageDartsPerLeg` | 1 decimal, `"—"` when `null` |
| `doubleAccuracy` | `"{n×100 rounded}%"`, `"—"` when `null` |
| `highestCheckout` | value → `"{value}"`, `"—"` when `null`; separate hint text `"Hit {timesHit}× "` (omitted when null) |

### `stores/stats.store.ts`

Mirrors `profile.store.ts`: `loading`/`error` flags, `init()` calling `load()`, `load()` calls `fetchStatisticsOverview()` then `formatStatisticsOverview()` and assigns the formatted strings as plain store fields (no getters — formatting runs once per load, values don't need live recomputation). Registered in `lib/client/alpine/register-stores.ts` as `Alpine.store("stats", statsStore())`.

### Page (`pages/statistics/index.astro`)

A `statCards: readonly { label: string; key: string; hintKey?: string; full?: boolean }[]` config array (same shape convention as `SinglePlayerSummary.astro`'s `statRows`), mapped into two parallel `grid grid-cols-2 gap-3` blocks — a skeleton grid (`StatCardSkeleton`, `x-show="$store.stats.loading"`) and a real grid (`StatCard`, `x-show="!$store.stats.loading"`), both `x-cloak`, exactly mirroring `SinglePlayerSummary`'s dual `x-show` blocks. `full: true` rows get `class="col-span-2"`.

Cards (17 — `currentPlayStreakDays`/`longestPlayStreakDays` combine into one):

Games played, Total play time, Favorite game (full), Play streak (value=current, hint=longest), Darts thrown, 100+, 120+, 140+, 180s, Median visit, Highest game avg, First-9 avg, Scoring avg, Best leg, Avg darts/leg, Double accuracy, Highest checkout (hint=times hit).

`ErrorAlert` rendered above the grids with `showExpr="$store.stats.error"` `textExpr="$store.stats.error"`.

## Testing

- `format-statistics-overview.test.ts` — every formatting rule above, including all-null/zero input and the game-type lookup miss case.
- `statistics.test.ts` (client API) — mirrors `profile.test.ts`'s success/error-envelope cases.
- `stats.store.test.ts` — mirrors `profile.store.test.ts`'s load success/failure cases.

No Astro-component test (per `app/CLAUDE.md`: `.astro` markup logic is not unit-tested).

## Files touched

- New: `components/ui/StatCard.astro`, `components/ui/StatCardSkeleton.astro`, `lib/client/api/statistics.ts`, `lib/stats/format-statistics-overview.ts`, `stores/stats.store.ts`, and their tests.
- Edited: `pages/statistics/index.astro`, `lib/client/alpine/register-stores.ts`, `lib/client/api/types.ts`.

## Docs & decisions

Context-maintenance pass after implementation: register the two new components/store/module in the relevant context-map pack rows and file inventory; no new architectural decision needed (no pattern deviation — this follows existing StatRow/profile-store/SettingRow precedent throughout).
