# Statistics Overview API — Design

> **Date:** 2026-09-06
> **Status:** approved (brainstorming consensus)
> **Branch:** `claude/statistic-views-architecture-ywef1h`
> **Scope:** `GET /api/statistics/overview` — the first statistics endpoint, filling the route D63 reserved. Backed by `v_session_overview`, `v_player_visit_facts`, `v_player_leg_facts`, `v_double_out_checkout_darts`. Builds the five pure stat modules the earlier general-views design specified but never implemented (that plan was narrowed to SQL-only at the user's request).
> **Out of scope:** win rate (needs session-replay-from-persisted-facts, which doesn't exist for any engine — separate future plan); `GET /api/statistics/trends` and `/checkouts` (still deferred); any UI/stat-card component work; widening `v_double_out_checkout_darts` past 501+VISUAL_BOARD (owned by `claude/x01-doubles-accuracy-ljbk6c`).

---

## Context

`docs/architecture/06-API/00-Overview.md` lists `GET /api/statistics/overview` as a named, reserved route (D63: "Statistics endpoints ... fully deferred post-v1; each must be view-backed when built"). The four views this endpoint reads (`v_session_overview`, `v_player_visit_facts`, `v_player_leg_facts`, `v_double_out_checkout_darts`) already exist and are migrated (`0009`, `0025`, `0026`, `0024`). This design is the implementation of that reserved route.

The general-statistics-views design (`2026-09-06-general-statistics-views-design.md`) specified five pure computation modules (`career-summary`, `visit-stats`, `leg-stats`, `highest-checkout`, `scoring-average`) as the layer that turns view rows into stat numbers. Its implementation plan was deliberately narrowed to SQL-only at the user's request — those modules were never written. This design builds them now, as the service layer backing this endpoint, reusing the exact function signatures, row shapes, and math already worked out (and unit-tested on paper) in that cut plan.

## Decisions made during brainstorming

1. **One endpoint, flat response.** `GET /api/statistics/overview` returns every general stat as a sibling field on one object — matches existing DTO style (`SessionOverview`, `PlayerSettingsResponse`) and the doc's own single reserved route name. No per-view endpoint split.
2. **Partial-data fields stay in, as nullable.** `doubleAccuracy` and `highestCheckout` are real fields in the response now, computed from whatever `v_double_out_checkout_darts` currently returns (501+VISUAL_BOARD only). They read correctly today and widen automatically — with no API or code change here — once `claude/x01-doubles-accuracy-ljbk6c` extends that view to 121/TUOD.
3. **Win rate is not in this response shape at all** — not a null stub, not deferred-in-place. It needs a capability (session-replay-from-persisted-facts) that doesn't exist for any engine; adding it later is an additive field, not a breaking change.
4. **Aggregation stays in the application layer**, not SQL. The four views return row-level facts; the service composes them through the five pure modules. This continues the already-committed design rationale in `05-Views/01-General-Views.md`: the view never fabricates an approximation it can't prove, so the read layer owns that judgment. A future performance concern (loading a full history of rows per request) is accepted for now as a personal-scale app, same stance already taken for win-rate's on-demand replay — revisit via query/index/materialize, in that order, only if measured slow.

## Route & layers

```
GET /api/statistics/overview
  → pages/api/statistics/overview.ts   (controller)
  → services/statistics.service.ts     (orchestration)
  → repositories/statistics.repository.ts (SQL against the 4 views)
```

**Auth:** standard protected route class — JWT-verified, player resolved by middleware (`locals.auth.playerId`). No path parameter; the caller is always `me`, matching `/api/players/me`'s convention.

### Repository (`repositories/statistics.repository.ts`)

Four functions, each a parameterized Drizzle query against one view, filtered to `playerId`, returning the row array as-is (camelCase via Drizzle's schema mapping, per `03-Shared-Conventions.md`'s snake→camel rule). No joins across views, no aggregation:

```ts
async function findSessionSummaries(db: Db, playerId: string): Promise<PlayerSessionSummaryRow[]>
async function findVisitFacts(db: Db, playerId: string): Promise<PlayerVisitFactRow[]>
async function findLegFacts(db: Db, playerId: string): Promise<PlayerLegFactRow[]>
async function findDoubleOutVisits(db: Db, playerId: string): Promise<CheckoutVisitDarts[]>
```

`findDoubleOutVisits` reshapes `v_double_out_checkout_darts`' flat per-dart rows (grouped by `stage_id`/turn) into `CheckoutVisitDarts[]` (`{ startingRemaining, darts: DartFact[] }`) — the same shape `double-attempt.module.ts` already consumes. `startingRemaining` for the first dart of a stage is the session's `exercise_configurations.starting_score` (loaded from the config snapshot); for every later dart it's that same `starting_score` minus the view's `prior_scored_in_stage` running sum, exactly as `06-Spec/05-Read-Model-Layer.md`'s `v_double_out_checkout_darts` entry specifies. This reshaping is plain arithmetic (a subtraction), not judgment — it belongs in the repository, mirroring how `v_double_out_checkout_darts` itself was designed to keep JSONB-parsing arithmetic out of SQL and in the one read layer that already has the snapshot.

### Service (`services/statistics.service.ts`)

One function, `getStatisticsOverview(playerId: string): Promise<StatisticsOverview>`, that:

1. Calls all four repository functions (independent reads, can run concurrently via `Promise.all`).
2. Feeds the results through the five pure modules.
3. Assembles the flat DTO.

```ts
export async function getStatisticsOverview(
  playerId: string,
): Promise<StatisticsOverview> {
  const db = getDb();
  const [sessions, visits, legs, doubleOutVisits] = await Promise.all([
    findSessionSummaries(db, playerId),
    findVisitFacts(db, playerId),
    findLegFacts(db, playerId),
    findDoubleOutVisits(db, playerId),
  ]);

  const bands = scoreBandCounts(visits);
  const checkout = highestCheckout(doubleOutVisits);
  const { hits, misses } = classifyDoubleAttempts(doubleOutVisits);

  return {
    totalGamesPlayed: totalGamesPlayed(sessions),
    totalPlayTimeSeconds: totalPlayTimeSeconds(sessions),
    favoriteGameTypeKey: favoriteGameTypeKey(sessions),
    longestPlayStreakDays: longestPlayStreakDays(sessions),
    currentPlayStreakDays: currentPlayStreakDays(sessions),
    totalDartsThrown: totalDartsThrown(visits),
    hundredPlusCount: bands.hundredPlus,
    oneTwentyPlusCount: bands.oneTwentyPlus,
    oneFortyPlusCount: bands.oneFortyPlus,
    oneEightiesCount: bands.oneEighties,
    medianVisitScore: medianVisitScore(visits),
    highestGameAverage: highestGameAverage(visits),
    firstNineCareerAverage: firstNineCareerAverage(visits),
    scoringAverageExcludingDoubles: scoringAverageExcludingDoubles(visits, doubleOutVisits),
    bestLegDarts: bestLegDarts(legs),
    averageDartsPerLeg: averageDartsPerLeg(legs),
    doubleAccuracy: hits + misses === 0 ? null : hits / (hits + misses),
    highestCheckout: checkout,
  };
}
```

`classifyDoubleAttempts` is the existing export from `double-attempt.module.ts` (no change to that file at all — no new export, no logic touched). `doubleAccuracy` is `hits / (hits + misses)` computed here in the service, not a formatted string (formatting is a client concern, matching every other raw numeric field in the DTO).

### Controller (`pages/api/statistics/overview.ts`)

No request body, no query params, no path params. Calls the service with `locals.auth.playerId`, wraps the result in `ok()`. Uncaught errors fall through the existing API error boundary (`SERVICE_UNAVAILABLE`/`INTERNAL_ERROR`, per `02-Middleware-And-Layering.md` rule 8) — no new error handling code.

## Response DTO

```ts
const StatisticsOverviewResponse = z.object({
  totalGamesPlayed: z.number().int(),
  totalPlayTimeSeconds: z.number().int(),
  favoriteGameTypeKey: z.string().nullable(),
  longestPlayStreakDays: z.number().int(),
  currentPlayStreakDays: z.number().int(),
  totalDartsThrown: z.number().int(),
  hundredPlusCount: z.number().int(),
  oneTwentyPlusCount: z.number().int(),
  oneFortyPlusCount: z.number().int(),
  oneEightiesCount: z.number().int(),
  medianVisitScore: z.number(),
  highestGameAverage: z.number(),
  firstNineCareerAverage: z.number(),
  scoringAverageExcludingDoubles: z.number(),
  bestLegDarts: z.number().int().nullable(),
  averageDartsPerLeg: z.number().nullable(),
  doubleAccuracy: z.number().min(0).max(1).nullable(),
  highestCheckout: z
    .object({ value: z.number().int(), timesHit: z.number().int() })
    .nullable(),
});
type StatisticsOverviewResponse = z.infer<typeof StatisticsOverviewResponse>;
```

Every field is always present — no partial response, no omitted keys. `null` means "not enough data to compute," never "field not implemented."

## Error contract

No new error codes. Failure modes are exactly the standard protected-route set from `03-Shared-Conventions.md`'s registry:

- `401 UNAUTHORIZED` — missing/invalid/expired token (middleware).
- `403 PLAYER_NOT_PROVISIONED` — valid token, no player row (middleware).
- `500 INTERNAL_ERROR` / `503 SERVICE_UNAVAILABLE` — uncaught failure, API error boundary.

No request input exists to validate, so `VALIDATION_FAILED` and `NOT_FOUND` never apply to this endpoint.

## Modules built by this work

All five, under `app/src/modules/stats/` (career-summary, visit-stats, leg-stats, scoring-average) and `app/src/modules/game/` (highest-checkout, sibling to `double-attempt.module.ts`) — same file layout, row types, and function signatures as drafted in the (unimplemented) `2026-09-06-general-statistics-views.md` plan before it was narrowed:

- `career-summary.module.ts` — `totalGamesPlayed`, `totalPlayTimeSeconds`, `favoriteGameTypeKey`, `longestPlayStreakDays`, `currentPlayStreakDays`.
- `visit-stats.module.ts` — `effectiveDartsForVisit`, `totalDartsThrown`, `scoreBandCounts`, `medianVisitScore`, `highestGameAverage`, `firstNineCareerAverage`.
- `leg-stats.module.ts` — `bestLegDarts`, `averageDartsPerLeg`.
- `highest-checkout.module.ts` — `highestCheckout`.
- `scoring-average.module.ts` — `scoringAverageExcludingDoubles`, which needs each dart's own classification (not just the `{ hits, misses }` totals) to subtract the right darts' scores from the numerator/denominator.

`doubleAccuracy` needs no change to `double-attempt.module.ts` — it's computed directly from the existing `classifyDoubleAttempts` export's `{ hits, misses }`. `scoring-average.module.ts` needs one small additive change to that file: its private `classifyDart` function and `DartOutcome` type become exported (the type moves to `modules/game/types.ts`, per the type-barrel rule that exported types can't live in an implementation file). No classification rule changes, no touch to the game-type filter or per-game wiring the other in-flight branch owns — purely making an existing private function reusable, the same "one classifier, two callers" precedent that module's own design doc already establishes for exactly this kind of reuse.

## Testing

- Repository: mocked Drizzle client per existing repository test style (`tests/repositories/statistics.repository.test.ts`), asserting the query shape and the `CheckoutVisitDarts` reshaping.
- Each pure module: unit tests over constructed row fixtures, TDD — same test cases already drafted in the cut general-statistics-views plan (reused verbatim where still applicable).
- Service: unit test composing mocked repository output through the real modules, asserting the final DTO shape and the null/zero fallbacks for no-data cases.
- Controller: existing route-handler test pattern (mock service, assert `ok()` envelope, assert error-boundary passthrough).

## Docs & decisions

- `06-API/00-Overview.md`: move `GET /api/statistics/overview` out of "Deferred" into the routed Statistics section; update the v1-implementation-status note.
- `06-API/02-Middleware-And-Layering.md`: add the `statistics/` route folder to the recommended folder structure; remove/update the "Statistics (deferred)" note.
- `06-API/03-Shared-Conventions.md`: no change expected (no new error codes, no new pagination shape).
- `06-API/04-Endpoint-Contracts.md`: add the full request/response contract (this design's DTO) under a new "Statistics Overview" section, plus the read-contract table row.
- Append-only entry in `decisions/api.md` (routed via `DECISIONS.md`) recording: D63's deferral is now partially closed for `overview` (not `trends`/`checkouts`), the endpoint composes 4 views without a dedicated `v_statistics_overview` aggregate view (aggregation stays in application code per the general-views design's own rationale), and win-rate is excluded from the response shape entirely pending session-replay design.
- `context-maintenance` skill once implementation lands.

## Rollout order

1. Five pure modules + unit tests (no consumers yet, provable correct in isolation) — `career-summary`, `visit-stats`, `leg-stats`, `highest-checkout`, `scoring-average`, plus `double-attempt.module.ts`'s additive `doubleAttemptTotals` export.
2. `repositories/statistics.repository.ts` + tests (the four view reads, including the `CheckoutVisitDarts` reshaping).
3. `services/statistics.service.ts` + tests (composition).
4. `pages/api/statistics/overview.ts` (controller) + route test.
5. Docs (`06-API/00`, `02`, `04`), decision entry, `context-maintenance`, full `validate:app`.
