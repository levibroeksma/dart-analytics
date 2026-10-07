# Home redesign (static pass) — design

**Date:** 2026-10-07 · **Status:** implemented · **Branch:** `feat/home-redesign` · **Decision:** D425 (`decisions/frontend/style.md`)

Source design: Claude Design project `cdea52ee-4746-4efb-b646-81448a40c033`,
`Darts Home.dc.html`, options 2a (game in progress), 2b (training done),
2c (no game).

## Goal

Overhaul `app/src/pages/index.astro` to match the new homepage design.
This pass is static: the new stat sections show fixture values. The live
weekly-plan wiring that exists today is kept. A later data pass swaps the
fixture for real reads without touching markup.

## Scope

- In: home page content, six home section components, one Alpine
  fixture factory, the `play-rounded.svg` icon, moving `LogoutButton` to
  Profile, the tokens the design needs.
- Out: API/view work, real stats, an active-game read, per-day done or
  missed markers and the weekly "2/4" ring (need weekly completion
  history that `homeWeek()` lacks — data pass), changes to the app shell
  (`BaseLayout` background, `BottomNav`, which already match the design).

## Units

### 1. `homeSnapshot()` — fixture factory

- `app/src/lib/home/home-snapshot.data.ts`, registered with the other
  route data factories (`register-route-data.ts`).
- Returns a typed, readonly snapshot with the design's 2a values:
  - `hero`: label `FIRST-9 AVERAGE`, value `72.4`, delta `1.8`, window
    `last 30 days`.
  - `resume`: game `501`, detail `vs Dartbot · Leg 3 of 5 · 2–0`,
    remaining `141`, started `18 MIN AGO`, href `/games`.
  - `careerTiles` (3): `BEST AVG 84.6 / 501 · Sep 12`,
    `TOP OUT 121 / Hit 1×`, `DARTS 18,342 / Career`.
  - `dailyAverage`: seven `{ day, value }` (M–S:
    61.2, 66.8, 58.4, 70.3, 74.1, 68.9, 71.5); `peak` derived
    (max, two decimals → `PEAK 74.10`); each bar's height derived as a
    percentage (`(v - 50) / 25`, clamped 0–100).
  - `landing`: `window` `LAST 30 DAYS`, `stamps: HeatStamp[]` — a short
    hardcoded list clustered on T20 / S20 / S1 / S5 / bull, fractions
    0–1 of the board.
- Derivations (peak, bar heights) are pure exported functions so they
  are testable and survive the data pass.
- No fetch, no `init()`. The data pass replaces the constant with a
  fetch; the returned shape is the contract.

### 2. Page composition

`index.astro` (still `prerender = true`):

1. Header: `LogoLockup` only (left-aligned, per design). No logout.
2. Wrapper `x-data="homeSnapshot()"` holding, in order:
   `HomeHero`, `ResumeGameCard`, `CareerTiles`, `DailyAverageCard`.
3. Weekly plan, in its existing `x-data="homeWeek()"` scope.
4. `LandingHeatmapCard`, inside the `homeSnapshot()` scope.

Spacing: 12px gap between cards, hero padded as in design.

### 3. Section components (`components/layout/home/`)

All read from the enclosing `homeSnapshot()` scope via `x-text`/`x-for`/
`:style`; no props beyond `class`. Each gets a JSDoc header naming the
scope it reads.

| Component | Renders |
| --------- | ------- |
| `HomeHero.astro` | Mono eyebrow, Michroma 72px value, "Up **1.8** in the last 30 days" (delta in accent) |
| `ResumeGameCard.astro` | Accent-gradient card: `IN PROGRESS` / started; game + detail left, remaining + `TO GO` right; full-width glass `Button` "Resume game" with `play-rounded` icon, linking to `resume.href`. Always shown this pass |
| `CareerTiles.astro` | 3-column grid of glass tiles: mono key, Michroma value, muted hint |
| `DailyAverageCard.astro` | Glass card, title "Daily average", `PEAK …`; 7 CSS bars (height from snapshot), peak bar full accent, others accent-muted; day letters below. No Chart.js |
| `LandingHeatmapCard.astro` | Glass card, title "Where you land", window label; `StatsDensityHeatmap` with `stampsExpr="landing.stamps"`, max width 290px |

### 4. Weekly plan (live, restyled)

- `TodayRoutineCard.astro` start state → design layout: Michroma
  "Weekly plan" title, muted `routineName · N min`, round 44px glass play
  button (`play-rounded`) calling `start()`; `WeekdayStrip` sits inside
  the same card. Rest day: muted "Rest day" in place of routine line, no
  play button. Link to `/training/schedules` kept.
- Done state → design 2b card: accent gradient, `COMPLETED` eyebrow,
  "You're on fire!" and `routineName` done for today. The 64px ring and
  "2 of 4" copy are deferred (see Scope).
- `WeekdayStrip.astro` → design sizes: 34px circles, today 42px with
  accent glow ring; scheduled day = white-50 border, rest day = faint
  border. Check/cross markers deferred.
- `homeWeek()` logic unchanged. Without an active schedule the weekly
  card renders nothing, as today.

### 5. Styling

- Glass utilities (`glass`, `glass-raised`) and existing tokens first.
- New values the design needs that no token covers (resume/completed
  accent gradient, accent glow ring on today, bar track) go into
  `global.css` as tokens or `@layer components` classes. No raw oklch or
  palette utilities in components.
- Typography per Style Guide: Michroma for titles/values, `font-mono`
  only for eyebrows/labels, never `font-medium`.

### 6. Icon

- Add `app/src/icons/play-rounded.svg` from the design project, with the
  embedded C2PA metadata removed; `fill`/`stroke` = `currentColor`.

### 7. Logout

- `LogoutButton` moves to `app/src/pages/profile/index.astro`, after
  `AppModeForm`. Home no longer imports it.

## Testing

- `app/tests/lib/home/home-snapshot.data.test.ts`: snapshot shape (3
  tiles, 7 days), peak derivation, bar-height clamp, every stamp's
  `x`/`y`/`radius` within 0–1.
- Markup is not unit-tested (no Astro component runner, D101); verified
  by `npm run validate:app`, `scripts/check-astro-conventions.sh`, and a
  visual check of the running app against design 2a/2b/2c at 390px.

## Docs

- Component Inventory (`07-Frontend/08-Component-Inventory.md`)
  `layout/home/` table: add the five new rows, update `WeekdayStrip` and
  `TodayRoutineCard`.
- Decision entry in the frontend decisions file (static fixture factory
  as the home's data seam).
- Context-maintenance skill run before completion.
