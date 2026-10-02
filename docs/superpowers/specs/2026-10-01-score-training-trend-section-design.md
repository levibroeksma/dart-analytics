# Score Training statistics — Score trend section (design)

Date: 2026-10-01 · Branch: `feat/score-training-trend-section`

## Intent

The generic `/statistics` Games tab is not satisfying for any game. Start a dedicated statistics layout for Score Training only, one section at a time, built so each section is independently fetched, failed and maintained. This spec covers the first section: the score trend.

## Decisions taken in brainstorming

- No new route. All statistics stay on `/statistics`. Selecting Score Training in the existing game `Select` renders `ScoreTrainingStatsOverview.astro` in place of the generic cards.
- Each section is its own Astro component with its own Alpine `*.data.ts` factory that owns its fetch.
- Fetch on mount only. Default page state (Games tab, Score Training) fetches only the score trend section — no other section, no session list.
- Per-section factory on a shared cached loader (approach A); no per-section stores, no uncached direct fetches.
- "Current" average = selected range, with delta vs the immediately preceding equal period. All time has no delta.
- First 9 for Score Training = the owner's first 3 visits of each session.

## Section content

Shows:
- Line chart of the scoring trend; default range Last 30 Days.
- Range options: Last 30 Days, Last 90 Days, Last Year, All Time.
- 3-dart average and first-9 average for the range, each with a delta.

Does not show: the chart's "Table view" disclosure (`Chart.astro` gains a `table` prop, default `true`; this section passes `false`), the 100+/140+/180 band counts.

## §1 Structure and files

**Page wiring — `app/src/pages/statistics/index.astro`**
- `<template x-if="game === 'SCORE_TRAINING_V1'">` wraps `<ScoreTrainingStatsOverview />` inside the Games tab. `x-if` (not `x-show`) so the section DOM, and its `init()`, exist only while selected.
- Generic `GameSectionCards` and the Sessions list are wrapped in `x-if="game !== 'SCORE_TRAINING_V1'"`.
- `gameStats.selectGame('SCORE_TRAINING_V1')` performs no fetch (no sections, no session list). Other games are unchanged.

**Components — `app/src/components/layout/games/statistics/`**
- `ScoreTrainingStatsOverview.astro` — ordered list of section components; fix the import to a default import.
- `ScoreTrentSection.astro` → renamed `ScoreTrendSection.astro`. Root `x-data="scoreTrendSection()"`; contains the range `Select`, two stat tiles (value + delta), `Chart.astro`, a skeleton, and its own `ErrorAlert`.

**Logic — `app/src/lib/stats/`**
- `load-game-section.ts` — `loadGameSection(gameTypeKey, sectionId, query)`: wraps `readSection` (`@client/stats-cache/cache`) and `fetchGameSection` (`@client/api/statistics`). `game-stats.store.ts` is re-pointed to it so one fetch path exists.
- `sections/score-trend.data.ts` — `scoreTrendSection()` factory: state `range`, `loading`, `error`; `init()`, `setRange(key)`; getters for averages, deltas, `chart`; request-token guard against stale responses. Registered in `app/src/lib/client/alpine/register-route-data.ts`.
- `sections/score-trend-window.ts` — pure functions: range key → query `{from, to, bucket, tz}` over the doubled window; previous/current bucket split; additive fold into averages; month-vs-week span rule; empty-bucket drop.

**Backend — `app/src/repositories/statistics.repository.ts` (`findVisitScoring`)**
- First 9 = the owner's first 3 visits per stage where `stage_type_key IN ('LEG', 'EXERCISE_BLOCK')`, numbered with `ROW_NUMBER() OVER (PARTITION BY stage_id ORDER BY turn_sequence)` over the owner's own turns. Replaces `stage_type_key = 'LEG' AND turn_sequence <= 3`, which never matches Score Training (`EXERCISE_BLOCK`, `turn-log.module.ts:118`) and may under-count when `turn_sequence` interleaves opponent turns. Query-only; no migration.
- Verified: `turns.sequence_number` is session-wide (`turns.length + 1`, `turn-log.module.ts:82`), so 1v1 interleaves seats and the old clause under-counts there too. Numbering runs in a scoped subquery (after the session `WHERE`), and the aggregate reads from it.

**Docs and context**
- `docs/architecture/10-Statistics/01-Section-Catalog.md` — Score Training page composition.
- `docs/architecture/10-Statistics/00-Overview.md` §7 — client loading model: section factory fetches on mount through `loadGameSection`.
- New decision in `decisions/frontend/alpine.md` — per-section factory pattern; refines D379.

## §2 Data flow and range math

Time zone: browser IANA zone. `to` = now + 1 minute (as `defaultRange()`). Status/context filters keep the store's current defaults.

| Range | Request | Current period | Previous period (delta) |
|---|---|---|---|
| Last 30 Days | `day`, from now − 60 d | buckets ending after now − 30 d | the rest |
| Last 90 Days | `week`, from now − 182 d | buckets ending after now − 91 d | the rest |
| Last Year | `month`, from now − 24 months | buckets ending after now − 12 months | the rest |
| All Time | `month`, from now − 119 months | all | none — no delta |

The server floors `from` to its bucket start, so the client never aligns dates itself. A bucket is current when its `end` is after the boundary. All requests stay within the 120-bucket cap (All Time: 119 months back → at most 120 buckets).

**Month→week fallback (Last Year, All Time only).** After the month fetch, find the first month bucket with darts. If the span from that month to the current month, both counted, in the browser zone, is under 4 months, refetch `week` buckets from that bucket's start to `to`. There is no earlier data in that case, so the delta is `null` and hidden.

**Derived values (pure, from additive components only).**
- 3-dart average = Σ`points` / Σ`darts` × 3 over current-period buckets.
- First-9 average = Σ`firstNinePoints` / Σ`firstNineDarts` × 3.
- Either is `null` when its dart sum is 0.
- Delta = current − previous, 1 decimal, signed; `text-success` when up, `text-error` when down; `null` when the previous period has 0 darts.

**Chart.**
- Current period only.
- Two series: 3-dart average (`sky`), first-9 (`orange`).
- Buckets with 0 darts are dropped at every granularity; the line connects real sessions.
- X labels: day `3 Sep`, week `w36`, month `Sep 26`.

**Lifecycle.**
- `init()` sets range Last 30 Days and calls `load()`; `setRange(key)` calls `load()` again.
- `load()` takes a request token; a response for a superseded token is discarded.
- Reads go through the IndexedDB cache: closed buckets reused, open bucket refetched.
- Unmount (game switch) needs no cleanup; remount refetches through the cache.

**States.**
- loading → skeleton.
- error → in-card `ErrorAlert`, isolated to this section.
- empty (no darts in current period) → "No sessions in range."

## §3 Testing and gates

TDD per `app/CLAUDE.md` (red → green). Tests mirror `src/` under `app/tests/`.

- `score-trend-window`:
  - query per range (bucket kind, count, alignment, DST edge in zone);
  - previous/current split;
  - average fold, including 0 darts → `null`;
  - month→week rule at 3 vs 4 data months;
  - empty-bucket drop;
  - delta sign and `null`.
- `scoreTrendSection()` with `loadGameSection` mocked:
  - `init` loads 30 d;
  - `setRange` reloads;
  - a stale response is ignored;
  - an error sets `error` and clears `loading`;
  - the fallback issues a second request only for Last Year/All Time under 4 data months.
- `loadGameSection`:
  - delegates to `readSection` with the correct scope and meta;
  - existing `game-stats.store` tests stay green after the store is re-pointed;
  - new store test: `selectGame('SCORE_TRAINING_V1')` makes zero fetches.
- `findVisitScoring` first 9:
  - Score Training `EXERCISE_BLOCK` counts the owner's first 3 visits;
  - 1v1 with interleaved opponent turns;
  - X01 `LEG` regression.
  - Run in the stats SQL itest suite (#680); fall back to unit tests on the query when no DB is available.
- `.astro` markup is not unit-tested (D101); covered by `astro check`.

Before done: `validate:app`, `run-all-gates`, `npm run format`, `context-maintenance`.

## Out of scope (follow-ups, not built here)

- Remaining Score Training sections (treble rate, heatmap, session result, completion, volume).
- Session list for Score Training.
- Dedicated layouts for other games.
