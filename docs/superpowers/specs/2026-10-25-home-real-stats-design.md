# Home real stats — design

**Date:** 2026-10-25 · **Status:** draft · **Branch:** `feat/home-real-stats` · **Issue:** #808

Supersedes the data-pass notes in `2026-10-07-home-redesign-design.md`
(units 1 and Out-of-scope). Decision: D493 (provisional; re-derive before the PR)
(api domain file).

## Goal

Replace the three fixtures left in `homeSnapshot()` with the player's own
numbers: the hero (first-9 average and its 30-day change), the
daily-average card, and the landing heatmap. The returned shape of
`homeSnapshot()` stays the contract; markup is untouched.

## State of #808 today

- Career tiles: wired to `GET /api/statistics/overview` (done).
- Resume card: replaced by `ResumeSessionDeck` (done, D442).
- Weekly done/missed markers and ring: done in `trainingWeek()` /
  `TrainingScheduleCard`.
- Left: hero, daily average, landing heatmap. This spec covers only those.

## Scope

- Sessions in: completed sessions of game types `501` and `SCORE_TRAINING`
  (the games whose rulesets carry the `scoring` tag), `VISUAL_BOARD` input,
  any context (standalone and routine).
- Out: Cricket, Tactics, Baseball, Bob's 27 and other non-scoring games;
  abandoned sessions; a per-game filter; caching; changes to
  `/api/statistics/overview`.

## Units

### 1. Repository — `statistics.repository.ts`

One new scope type, `HomeScope = { playerId; gameTypeKeys: GameTypeKey[]; from; to }`
(`modules/stats/types.ts`). Two readers, added beside the existing ones; the
existing per-game scopes and readers are not widened.

- `findHomeScoring(db, scope, tz)`: from `v_player_visit_facts` joined to
  `v_stats_session_facts`, `status = COMPLETED`, `input_mode_key = VISUAL_BOARD`,
  `game_type_key IN gameTypeKeys`, `completed_at` in `[from, to)`. Returns
  per local day (in `tz`): `points`, `darts`, `firstNinePoints`,
  `firstNineDarts`. First nine = the owner's first three visits per `LEG` or
  `EXERCISE_BLOCK` stage, the same definition `findVisitScoring` uses
  (section `scoring-trend` v2, D385). The `bucketExprs` day expression is
  reused, not copied.
- `findHomeHeatmapCells(db, scope, cellMm)`: `v_stats_dart_facts`, same
  scope filter, grouped by `FLOOR(location / cellMm)`. Darts without a
  location are excluded.

The visit-scoring body is shared with `findVisitScoring` by extracting the
common select; if extraction would change that function's output, copy the
first-nine clause instead and note it. No migration, no new view.

### 2. Module — `modules/stats/home-stats.module.ts` (pure)

- `firstNineAverage(rows)`: `3 × Σ firstNinePoints / Σ firstNineDarts`,
  `null` when `Σ firstNineDarts = 0`. Same arithmetic as the career
  `firstNineCareerAverage`.
- `firstNineDelta(current, previous)`: `current − previous`, `null` if either
  is `null`.
- `dailyAverages(rows, days)`: one entry per local day in the 7-day window,
  `{ date, weekday, value | null }`; `value = 3 × points / darts`, `null`
  on a day with no darts.

### 3. Service — `statistics.service.ts`

`getHomeStats(playerId, { now, tz })` computes the windows from `now` and
`tz`: current = last 30 days, previous = the 30 days before it, daily = the
last 7 local days ending today, landing = the current 30-day window. It runs
the readers in parallel and shapes the response with the module.

### 4. Route — `GET /api/statistics/home`

Protected, caller is `me`. Query: `tz` (IANA name, required, validated
against the same alphabet as `bucketExprs`). The server derives the windows
from `now`; no `from`/`to` (a fixed-window summary endpoint, so the §5 range
contract does not apply). Anything else is `VALIDATION_FAILED`.

```
{
  firstNine: { current: number|null, previous: number|null, delta: number|null },
  daily:     [{ date: "YYYY-MM-DD", weekday: 1..7, value: number|null }] x7,
  landing:   { cellMm: 4, cells: [ix, iy, darts][] }
}
```

The route is view-backed (D63): `v_player_visit_facts`, `v_stats_session_facts`,
`v_stats_dart_facts`. No raw tables.

### 5. Client — `home-snapshot.data.ts`

- New `fetchStatisticsHome(tz)` in `lib/client/api/statistics.ts`.
- `init()` runs it in parallel with `fetchStatisticsOverview()`; each failure
  degrades independently.
- Pure shapers (exported, tested): `heroFromStats`, `dailyFromStats`,
  `landingFromStats`. `heatStamps` / `dailyBars` / `dailyPeak` stay.
- Fixtures `DAILY` and `LANDING` and the hardcoded hero are deleted.

## Behaviour

| Case | Result |
| ---- | ------ |
| `firstNine.current = null` | hero value `—`, delta line hidden |
| `delta = null` (no previous window) | value shown, delta line hidden |
| Delta sign | "Up X" for positive, "Down X" for negative (absolute value), hidden at 0.0 |
| Day with no darts | no bar (zero height), skipped for the peak; all seven empty → peak `—` |
| Bar scale | unchanged: 50–75 mapped to 0–100%, clamped |
| Landing with no cells | landing card hidden |
| Fetch fails or is pending | dashes, bars and landing card hidden (as the career tiles) |

`HomeHero` and `LandingHeatmapCard` gain `x-show`/`x-cloak` hooks for the
hidden states; the hero delta text becomes a derived string.

## Testing

TDD for the logic; `.astro` markup has no runner (D101).

- `home-stats.module` unit tests: averages, null on zero darts, delta nulls,
  seven-day shape, empty days.
- `home-snapshot.data` tests: shapers for each case in the table above;
  `init()` degrades each fetch independently.
- Service test with fake readers: window arithmetic across a `tz`, DST day.
- Route test: `tz` validation, envelope shape.
- Repository: an integration test in `tests/integration/` for `findHomeScoring`
  and `findHomeHeatmapCells` against a seeded 501 and Score Training session
  (scope filter: a Cricket session and an abandoned session are excluded).

## Docs

- `10-Statistics/00-Overview.md` §6: add the route row.
- `06-API/04-Endpoint-Contracts.md` and `06-API/00-Overview.md`: contract.
- `07-Frontend/08-Component-Inventory.md`: `HomeHero`, `LandingHeatmapCard`.
- `docs/superpowers/specs/2026-10-07-home-redesign-design.md`: header note
  pointing here.
- Decision entry; context-maintenance run before completion.

## Risks

- First-9 across `501` and Score Training mixes two sources; the scope
  question was settled (all X01 + scoring). The label stays "FIRST-9 AVERAGE".
- A 30-day dart read is bounded by volume, not by `MAX_FOLD_DARTS`, because
  the readers aggregate in SQL and return at most a few hundred cells.
