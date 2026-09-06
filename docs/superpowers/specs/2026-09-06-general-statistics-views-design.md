# General Statistics Views — Architecture Design

> **Date:** 2026-09-06
> **Status:** approved (brainstorming consensus)
> **Branch:** `claude/statistic-views-architecture-ywef1h`
> **Scope:** Architecture for career-wide "general" stat cards (not tied to one game type) and the doc/view restructure that hosts them. No implementation in this task.
> **Out of scope:** actually creating the migration/views/modules (separate plan); widening `v_double_out_checkout_darts` beyond 501+VISUAL_BOARD (owned by `claude/x01-doubles-accuracy-ljbk6c`); any UI/stat-card component work.
>
> **Status note (2026-09-06, during plan-writing):** win-rate's full-engine-replay approach needs session-replay-from-persisted-facts (reconstructing any of the 9 engines' `EngineFacts` from `v_game_replay` rows and calling `create()`), which does not exist anywhere in the codebase yet — every engine today is driven from live in-memory state, never rehydrated from DB rows. That capability is a substantial, separate undertaking. The implementation plan for this design covers all 16 other stat cards; win-rate is split into its own follow-up plan built around designing session replay properly.

---

## Context

`05-Database/06-Spec/05-Read-Model-Layer.md` names `v_player_statistics`/`v_player_dashboard` as planned-but-unimplemented future views. This design is that plan for the first slice: general, cross-game stat cards. It also folds in a related structural change — `05-Views.md` becomes a directory so per-domain view catalogs (general, X01, …) don't all pile into one growing file.

## Final stat list (17 cards)

| Stat | Grain | Scope |
| --- | --- | --- |
| Total games played | session | any game, any mode |
| Total play time | session | any game, any mode |
| Favorite / most-played game type | session | any game, any mode |
| Longest play streak | session date | any game, any mode |
| Current play streak | session date | any game, any mode |
| Total darts thrown | turn | any game, any mode (best-effort) |
| 100+ / 120+ / 140+ hit counts | turn | any game, any mode |
| 180s hit | turn | any game, any mode |
| Median visit score | turn | any game, any mode |
| Highest avg during a game | turn → session | any game, any mode |
| First-9 average (career) | turn | any game, any mode |
| Scoring avg (excl. double attempts) | turn, refined by dart | any game; doubles-exclusion only applies where classifiable (X01) |
| Best leg (least darts to complete) | leg | X01 only (501/121/TUOD — only games with a `LEG` stage) |
| Average darts per leg | leg | X01 only |
| Double accuracy | dart | X01 only, currently 501+VISUAL_BOARD (see Dependencies) |
| Highest checkout, with repeat count (e.g. "170 ×3") | dart | X01 only, same scope as double accuracy |
| Win rate | session (replayed) | 1v1 sessions only (exactly 2 participants), any game type |

Dropped from the brainstorm: bogey count, biggest single-session improvement (both out of scope per user).

## Decisions made during brainstorming

1. **Capture-mode mixing:** best-effort across all sessions. Stats that only need `turns.total_score` include every session regardless of capture mode. Stats that need real per-dart facts (darts thrown, best leg, double accuracy, doubles-excluded avg) silently narrow their own denominator to sessions/legs that actually have dart rows — no fabricated counts for `QUICK_SCORE` turns where exactness matters (best leg, avg darts/leg). Best-effort approximation (real count where present, else `max_darts_per_turn`) is acceptable only for the plain "total darts thrown" card, where being a running total rather than a precision metric makes the approximation harmless.
2. **Double-attempt reuse:** build on `v_double_out_checkout_darts` / `double-attempt.module.ts` as landed today (501+VISUAL_BOARD only). Do not widen its scope here — that is `claude/x01-doubles-accuracy-ljbk6c`'s job (steps 4–5 of its own rollout order, not yet done). Double accuracy and highest-checkout cards report 501-only until that lands, then widen automatically with no change needed here, since this design never re-implements or forks the classifier.
3. **Win rate:** full engine replay for every 1v1 game type (not just X01), reusing the existing `match-outcome.module.ts` functions (`raceWinner`/`eliminationWinner`/`scoreCompareWinner`) against `v_game_replay`'s fact reconstruction. Accepted cost: this is real per-session compute, done on demand, not cached (see Performance below).

## Doc restructure

`docs/architecture/05-Database/05-Views.md` becomes a directory:

```
05-Database/05-Views/
  00-Overview.md          # today's 05-Views.md content, verbatim
  01-General-Views.md     # new — this design's views
  02-X01-Views.md         # future, not created now
```

Every file that references the old path is updated in the same commit: `00-Context-Map.md`'s "New view / analytics query" pack row, `00-File-Inventory.md`, `06-Database-Specification.md`, `10-Database-Agent-Guide.md`, and any other cross-reference the `check-doc-links.sh` gate finds. `check-context-budget.sh` re-baselines the split file sizes.

## View catalog (`01-General-Views.md`)

Both new views are **Analytics** category, scoped to the session's owning participant (same pattern as `v_dart_analytics`/`v_dart_locations`/`v_double_out_checkout_darts` — a guest's darts never enter the owner's stats).

### `v_player_visit_facts`

One row per turn, every game type and capture mode.

- **Sources:** turns → exercise_stages → exercise_sessions → participants, game_types, exercise_configurations (for `max_darts_per_turn`), darts (LEFT JOIN, for a real count).
- **Exposes:** `session_id`, `player_id`, `game_type_key`, `stage_id`, `stage_type_key`, turn `sequence_number`, `total_score`, `completed_at`, `dart_count` (COUNT of real dart rows, 0 when none), `configured_max_darts_per_turn` (from the JSONB snapshot). No band/average computed here — plain per-row facts only.
- **Backs:** total darts thrown, 100/120/140+/180 counts, median visit score, highest avg during a game, first-9 average, the turn-total half of scoring avg.
- **Design rationale:** one view instead of per-stat views because every consumer above needs the identical row shape (a turn plus its real-vs-configured dart count) — splitting further would just be the same join repeated, which `05-Views.md` already warns against (deep/duplicated view chains).

### `v_player_leg_facts`

One row per `LEG`-type stage, **only** where every turn thrown by the owning participant in that leg has real dart rows.

- **Sources:** exercise_stages (`stage_type_key = 'LEG'`) → turns → darts, exercise_sessions → participants, game_types.
- **Exposes:** `session_id`, `player_id`, `game_type_key`, `stage_id`, `total_darts_in_leg` (SUM of real dart counts across the leg's turns for that participant).
- **Filtering:** a leg where any of the participant's turns has zero dart rows is excluded entirely — narrowing the population, never approximating a real-looking-but-fake count. Same precedent as `v_dart_analytics`'s "both intended target and zone present" filter.
- **Backs:** best leg (MIN), average darts per leg (AVG).

### Reused, unchanged

- `v_session_overview` — total games played (COUNT status = COMPLETED), total play time (SUM `duration_seconds`), favorite game type (`MODE() WITHIN GROUP`), and the distinct play-date list streak calculations run over.
- `v_game_replay` — win-rate's engine-replay input, filtered to sessions with exactly 2 participants.
- `v_double_out_checkout_darts` — double accuracy and highest-checkout, as landed (501+VISUAL_BOARD).

## App-layer modules

New, under `modules/game/` (mirroring `double-attempt.module.ts`'s house style — one pure function, generic over facts, no capture-mode branching inside it):

- **`highest-checkout.module.ts`** — walks `v_double_out_checkout_darts` rows the same way `classifyDoubleAttempts` does (tracking `remaining` per visit), but returns the finishing value and a count of how many times that exact value was hit, not a hit/miss tally. Does not modify or fork `double-attempt.module.ts`.
- **`win-rate.module.ts`** — filters `v_game_replay` to 2-participant sessions, replays each through the matching game type's existing outcome function from `match-outcome.module.ts`, aggregates win/loss/tie per player.
- **Streak calculation** — gap-and-islands over `v_session_overview`'s distinct play dates (`started_at::date`) for the player; app layer, not SQL, since finding consecutive-day runs is iterative logic rather than a single aggregate.
- **Score-banding (100/120/140+/180)** — a plain SQL `CASE`/`FILTER` threshold check directly against `v_player_visit_facts.total_score`, computed independently of `play-visit-stats.ts`'s `visitScoreBandCounts` (which serves the live in-session view). This is a deliberate exception to "one classifier, two callers": band thresholds are fixed public darts convention (not a heuristic subject to drift, unlike double-attempt classification or board geometry), so duplication risk is negligible and colocating it in SQL avoids pulling every historical turn back into the app layer just to bucket a number.
- **Scoring avg (excl. doubles)** — computed in the read layer: base numerator/denominator from `v_player_visit_facts` (turn totals, effective darts), refined for sessions that also have `v_double_out_checkout_darts` rows by subtracting classified double-attempt dart scores/counts from both sides before dividing. Non-X01 sessions and X01 sessions without dart-level data pass through unrefined.

## Performance stance

Win-rate's full engine replay is real per-session cost. Given this is a personal-scale app (per root `CLAUDE.md`), on-demand computation at read time is the starting point — no caching or materialized view. If it's ever measured slow, `05-Views.md`'s own order applies before reaching for a materialized view: query structure, then indexes, then materialization — and a materialized view would still need a defined refresh strategy and would still keep win/loss judgment out of the view itself (a materialized view refresh could shell out to the same app-layer replay, but that's a future task, not this one).

## Dependencies / sequencing

- Waits on nothing to land this design; the general views/modules can be built independently.
- Double accuracy and highest-checkout cards are functionally limited to 501+VISUAL_BOARD until `claude/x01-doubles-accuracy-ljbk6c` extends `v_double_out_checkout_darts` to 121/TUOD. No code in this design needs to change when that happens — the app layer already queries the view generically by game type.

## Testing (per `app/CLAUDE.md`, when implementation is planned)

- Migration tests for `v_player_visit_facts`/`v_player_leg_facts` — shape, owning-participant scope, the leg-completeness filter — mirroring existing view migration tests.
- Unit tests for `highest-checkout.module.ts` and `win-rate.module.ts` per game type's outcome shape.
- Streak and score-banding logic unit-tested against constructed date/turn fixtures, including boundary cases (single-day streak, gap of exactly one day, a 125 landing only in `hundredPlus` not `sixtyPlus`).

## Docs & decisions (when implementation is planned)

- Register both new views in `01-General-Views.md` and the Read-Model-Layer chapter.
- Append-only entry in `decisions/database.md` (view directory split) and `decisions/game-engine.md` (win-rate's full-replay choice, scoring-avg's refinement rule) via `DECISIONS.md`'s routing table.
- `context-maintenance` skill once implementation lands.

## Rollout order (for the follow-up plan)

1. Doc restructure (`05-Views.md` → directory) as its own small task — mechanical, no schema change, unblocks everything else.
2. `v_player_visit_facts` migration + tests.
3. `v_player_leg_facts` migration + tests.
4. Simple SQL-aggregate stats (games played, play time, favorite game type, streaks, darts thrown, score bands, median, highest avg, first-9).
5. `highest-checkout.module.ts` (reuses landed 501-only view).
6. `win-rate.module.ts` (reuses `v_game_replay` + `match-outcome.module.ts`).
7. Scoring-avg refinement wiring.
8. Docs/decisions, `context-maintenance`, full `validate:app`/`validate:database` pass.
