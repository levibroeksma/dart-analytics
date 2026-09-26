# Statistics Phase 3 — Checkout Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship rollout phase 3 of the detailed statistics pages: the 501, 121 and Ten Up One Down pages.
- **Server folds:** `checkout-rate`, `double-performance`, `checkout-path`, `bust-rate`, `ladder-progress`, `leg-stats`.
- **SQL:** `scoring-trend`, `treble-rate`. Score Training gets these too, through its `scoring` tag.

**Architecture:** No migration planned.
- Server sections read `v_x01_checkout_darts`, joined to phase 1's `v_stats_session_facts` for scope and bucket.
- They fold each session through the existing checkout-visit builders (`checkout-visits.module.ts` via `x01-checkout-sessions.module.ts`), so remaining-before-dart keeps one definition.
- Each server request is bounded by a dart cap. The client asks for server sections in calendar-month chunks, and caches closed chunks forever (phase 1 cache).
- SQL sections read `v_player_visit_facts` (joined to `v_stats_session_facts`) and `v_stats_dart_facts`.
- One pure module per section shapes rows or visits into phase 1's `Series` contract.

**Tech Stack:** TypeScript, Astro, Alpine, Vitest, Drizzle ORM, PostgreSQL (Neon), zod, IndexedDB.

**Spec:** `docs/architecture/10-Statistics/00-Overview.md`, `01-Section-Catalog.md` (canonical). The phase 1b plan (`2026-09-26-statistics-phase-1b-foundation.md`) owns the registry, route, series helpers and cache. The phase 2 plan (`2026-09-26-statistics-phase-2-board-sections.md`) owns `SectionHandler = { load, shape }`, `dartScopeWhere`, `TargetKey` and `MIN_TARGET_SAMPLE`.

**Prerequisite:** Phases 1 and 2 are merged. If a name differs from what this plan says, follow the code and note the difference in the PR body.

## Plan-level decisions

Each is written into the canonical docs in Task 10 under decision **D369** (confirm with `bash scripts/next-decision-id.sh`; D367 and D368 belong to phases 1 and 2).

1. **Server folds are bounded by a dart cap.** Before loading, a server section sums `dart_count` over the scoped sessions in `v_stats_session_facts`. Above `MAX_FOLD_DARTS` (start at `20_000`; Task 8 Step 4 measures it) the request fails with `VALIDATION_FAILED`, and the `reason` names the cap. That is the `00-Overview.md` §4 bound, made mechanical.
   - The cap counts darts, not sessions: the 121 and TUOD builders refold the prefix for every visit, so cost grows with darts in a session, not with session count.
2. **Server sections are fetched in chunks.** The client splits a server section's range into chunk windows:
   - the bucket unit for `day`, `week` and `month`
   - calendar months in `tz` for `none` and `year`

   Each chunk is its own cached request. Closed chunks are never refetched (phase 1 `closed` rule), so an all-time view costs one fold per month, once. Every server metric is additive (decision 3), so the client merges chunks exactly. `year` is a client regroup of months.
3. **Server metrics are exact-value counts; banding is display.**
   - Metrics are keyed by the exact remaining score or target (`"32"`, `"121"`), not by band.
   - Band edges are a client constant, so rebanding needs no refetch and no version bump.
   - The only non-sum field is `maxTarget`, which merges by `max` and re-aggregates exactly, like phase 1's `min`/`max`.
4. **`checkout-rate` is per visit; `double-performance` is per dart.**
   - **checkout-rate:** a *chance* is a visit whose `startingRemaining` is reachable within 3 darts (`isCheckoutReachable(r, 3)`). *Finished* means the visit holds a finishing dart.
   - **double-performance:** `classifyDart` (`double-attempt.module.ts`) per dart, keyed by the double the remaining required: `50` → `INNER_BULL:25`, even `r ≤ 40` → `DOUBLE:r/2`. The key format is phase 2's `TargetKey`. It is the existing career Checkout % split per double.
   - The favourite double is client-derived (best rate with `attempts ≥ MIN_TARGET_SAMPLE`), as phase 2 does for `target-accuracy`.
5. **One definition for finishing and for remaining-before-dart.**
   - `highest-checkout.module.ts`'s private `isFinishingDart` is exported and reused.
   - `double-attempt.module.ts` gains `checkoutDarts(visit)`, which yields `{ remaining, dart }` in throw order. `classifyDoubleAttempts` is rewritten onto it under green tests. Every new module walks darts through it, never with its own `remaining -= score` loop.
6. **A bust is the shared double-out rule only.** A visit busts when `resolveCheckoutAttempt` (`checkout-bust.module.ts`), applied dart by dart via `checkoutDarts`, reports `busted` before any checkout.
   - Ruleset early busts (121's final-visit rule, TUOD's one-dart rule) are forfeits the engine imposes, not overthrows, so they are not counted.
   - `turns.total_score = 0` is not used: TUOD writes 0 for every failed attempt, so it cannot tell a bust from a miss.
   - Only visits with `startingRemaining ≤ 180` are counted, since no visit can bust above that.
7. **`leg-stats` moves from site `sql` to `server`.** `v_player_leg_facts` has no winner column. It counts lost 1v1 legs and the abandoned final leg as legs, which breaks "darts per leg" and "best leg".
   - A leg counts only when the owner's visits in that `LEG` stage hold a finishing dart.
   - Metric: a histogram `Record<darts, legs>`. Best leg, average and distribution derive from it and stay additive.
   - It reuses the checkout fold, so it costs no extra read path.
8. **Ladder attempts.**
   - **121:** an attempt is one `ROUND` stage, and its target is the first visit's `startingRemaining`. The engine resets `remainingInAttempt` to `currentTarget` at each attempt.
   - **TUOD:** an attempt is one visit (one `EXERCISE_BLOCK` stage per session), and its target is the visit's `startingRemaining`.
   - Success means the attempt holds a finishing dart.
   - Metrics: `targets: Record<target, { attempts, successes }>`, `maxTarget`, `afterMiss` (attempts following a failed attempt in the same session), `recovered` (of those, successes).
9. **Ruleset versions.**
   - The checkout sections, `scoring-trend`, `treble-rate` and `leg-stats` pool versions. A dart at remaining 32 is the same fact under 121 V1 and V2, which differ only in duration modes.
   - `ladder-progress` declares `configSensitive: ["ruleset_version_key"]`, because 121 V2's Rounds/Timed modes cap how far a session can climb. Catalog §2.2 is clarified to say it governs result-shaped sections.
10. **`scoring-trend`** (SQL, rule-free):
    - Points are `SUM(turns.total_score)` (counted, so a bust scores 0) and darts are `SUM(dart_count)`.
    - First nine: turns with `turn_sequence ≤ 3` inside a `LEG` stage. Games without `LEG` stages report zeros, and the client hides the line.
    - Score bands are exclusive bins over turn totals, from `SCORE_BANDS = [100, 140, 180]`, bound as parameters. The bins are `[100,140)`, `[140,180)` and `180`.
11. **`treble-rate`** (SQL, rule-free): per hit number (`"1"`–`"20"`, `"25"`, `"MISS"`): `{ darts, trebles }`. The client reads the T20/T19 beds and the overall rate. There is no intent in X01 or Score Training, so "thrown at the scoring beds" is read as "landed in that bed's segment".
12. **Status and context follow phase 1.** Only `status=completed` is accepted: none of these sections has `includesAbandoned`.

## Global Constraints

- TDD: write the failing test, run it, watch it fail, then implement (`app/CLAUDE.md` §Test-Driven Development).
- `cd app && npm test` runs the whole suite. Finish every task with the full suite.
- No migration is planned. Task 3 Step 4 measures the query plans. If it fails, add migration `0044` (+ verification + spec update) as its own task, never by editing `0001`–`0043`.
- Reads go through views only: `vX01CheckoutDarts`, `vPlayerVisitFacts`, `vStatsSessionFacts`, `vStatsDartFacts`.
- No game rules in SQL. Remaining score, bust, finish and ladder all stay in TS. Score-band edges reach SQL only as bound parameters.
- Refactors of `x01-checkout-sessions`, `double-attempt` and `highest-checkout` must leave their existing tests unedited and green. The career Checkout % on `/statistics` must not move.
- NUMERIC arrives as a string: wrap every sum in `Number(nonNull(…))`.
- JSDoc only (`check-no-inline-comments.sh`). Exported types go in the barrels (`check-type-barrels.sh`). No `x-init`.
- `npm run format` before every commit.
- Branch: `feat/statistics-checkout-sections` from `main` after phase 2 has merged.
- Anything noticed that this plan does not ask for → GitHub issue via `capturing-discovered-work`, never fixed in the same pass.

## File map

| Action | Path | Responsibility |
| ------ | ---- | -------------- |
| Modify | `app/src/lib/stats/types.ts`, `section-registry.ts` | eight section ids, page order, `MAX_FOLD_DARTS` |
| Create | `app/src/lib/stats/merge-metrics.ts` | chunk merge per section |
| Modify | `app/src/pages/api/statistics/types.ts` | eight metric schemas |
| Modify | `app/src/repositories/statistics.repository.ts`, `app/src/modules/types.ts` | scope dart count, fold rows, visit scoring, hit-number cells |
| Modify | `app/src/modules/game/double-attempt.module.ts`, `highest-checkout.module.ts` | `checkoutDarts`, export `isFinishingDart` |
| Modify | `app/src/modules/stats/x01-checkout-sessions.module.ts` | `sessionCheckoutVisits` (stage-tagged visits per session) |
| Create | `app/src/modules/stats/sections/{checkout-rate,double-performance,checkout-path,bust-rate,ladder-progress,leg-stats,scoring-trend,treble-rate}.module.ts` | visits/rows → metrics |
| Modify | `app/src/services/statistics.service.ts` | server handlers, dart-cap gate, per-session bucketing |
| Modify | `app/src/lib/client/stats-cache/*`, `app/src/stores/game-stats.store.ts`, `app/src/pages/statistics/index.astro` | chunked reads, merge, cards |
| Tests | mirror each path under `app/tests/` | |
| Docs | Task 10 list | |

---

### Task 1: Registry entries

**Files:**
- Modify: `app/src/lib/stats/types.ts`, `app/src/lib/stats/section-registry.ts`
- Test: `app/tests/lib/stats/section-registry.test.ts` (extend)

**Interfaces:**
- `SectionId` gains `"scoring-trend" | "ladder-progress" | "checkout-rate" | "double-performance" | "checkout-path" | "bust-rate" | "leg-stats" | "treble-rate"`.
- `MAX_FOLD_DARTS = 20_000` is exported from `section-registry.ts`.

- [ ] **Step 1: Failing tests.**
  - Entries:

    | id | requires | site | bucketable | configSensitive |
    | -- | -------- | ---- | ---------- | --------------- |
    | `scoring-trend` | `[scoring]` | sql | true | `[]` |
    | `ladder-progress` | `[ladder]` | server | true | `["ruleset_version_key"]` |
    | `checkout-rate` | `[checkout]` | server | true | `[]` |
    | `double-performance` | `[checkout]` | server | true | `[]` |
    | `checkout-path` | `[checkout]` | server | false | `[]` |
    | `bust-rate` | `[checkout]` | server | true | `[]` |
    | `leg-stats` | `[leg]` | server | true | `[]` |
    | `treble-rate` | `[scoring, board]` | sql | true | `[]` |

    Every entry has `includesAbandoned: false`, `params: []` and `version: 1`.
  - Page order (catalog §2):
    - `501`: `scoring-trend, checkout-rate, double-performance, checkout-path, bust-rate, leg-stats, treble-rate, heatmap, session-result, completion, volume`.
    - `ONE_TWENTY_ONE` and `TUOD`: `ladder-progress, checkout-rate, double-performance, checkout-path, bust-rate, heatmap, session-result, completion, volume`.
    - `SCORE_TRAINING`: `scoring-trend, treble-rate, heatmap, session-result, completion, volume`.
    - `DOUBLES_TRAINING` and `BOBS27`: phase 2's order, unchanged.

- [ ] **Step 2: Implement.** Declare the entries in the one order that satisfies every page: `scoring-trend, ladder-progress, checkout-rate, double-performance, checkout-path, bust-rate, leg-stats, treble-rate`, then phase 2's intent sections, then `heatmap, session-result, completion, volume`.

- [ ] **Step 3:** Green, full suite. Commit: `feat(stats): checkout family registry entries`

---

### Task 2: Response contracts

**Files:**
- Modify: `app/src/pages/api/statistics/types.ts`
- Test: `app/tests/pages/api/statistics/types.test.ts` (extend)

**Interfaces** (additive, `00-Overview.md` §5.1). `ValueRecord<T> = z.record(z.string().regex(/^\d+$/), T)`; `TargetRecord` is phase 2's.

```ts
const HitCount = z.object({ attempts: z.number().int(), hits: z.number().int() });
const CheckoutRateMetrics = ValueRecord(z.object({ chances: z.number().int(), finished: z.number().int() }));
const DoublePerformanceMetrics = TargetRecord(HitCount);
const CheckoutPathMetrics = ValueRecord(z.record(z.string(), z.object({ visits: z.number().int(), finished: z.number().int() })));
const BustRateMetrics = ValueRecord(z.object({ visits: z.number().int(), busts: z.number().int() }));
const LegStatsMetrics = ValueRecord(z.number().int());
const LadderProgressMetrics = z.object({
  targets: ValueRecord(z.object({ attempts: z.number().int(), successes: z.number().int() })),
  maxTarget: z.number().int().nullable(),
  afterMiss: z.number().int(),
  recovered: z.number().int(),
});
const ScoringTrendMetrics = z.object({
  points: z.number().int(), darts: z.number().int(),
  firstNinePoints: z.number().int(), firstNineDarts: z.number().int(),
  bands: z.object({ ton: z.number().int(), tonForty: z.number().int(), oneEighty: z.number().int() }),
});
const TrebleRateMetrics = z.record(z.string().regex(/^(\d+|MISS)$/), z.object({ darts: z.number().int(), trebles: z.number().int() }));
```

- `CheckoutPathMetrics`' inner key is the route label: dart labels in throw order, joined by a space, in `checkout-path.module.ts`'s vocabulary (`20`, `T20`, `D16`, `BULL`), plus `25` for the outer bull and `MISS`.
- Each metric is wrapped in phase 1's `Series` response schema, and the inferred types are exported through the barrel.

- [ ] **Step 1: Failing tests.** One valid sample of each schema parses. A `ValueRecord` key `"abc"` is rejected. A `LadderProgressMetrics` sample without `maxTarget` is rejected.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(api): checkout family contracts`

---

### Task 3: Repository readers

**Files:**
- Modify: `app/src/repositories/statistics.repository.ts`, `app/src/modules/types.ts` (or `modules/stats/types.ts`, per where the row types already live)
- Test: `app/tests/repositories/statistics.repository.test.ts` (extend; `render-sql.ts`)

**Shared session scope:** the filters phase 1 applies to `vStatsSessionFacts`:
- `player_id`, `game_type_key`, `completed_at` in `[from, to)`
- `status_key`, `context_key`, `input_mode_key = 'VISUAL_BOARD'`

Factor them into `sessionScopeWhere(scope)` if phase 1 inlined them. That extraction is required work.

**Interfaces:**
- `findScopeDartCount(db, scope): Promise<number>`: `COALESCE(SUM(dart_count), 0)::integer` over `vStatsSessionFacts`.
- `findX01FoldRows(db, q: SessionScope & { bucket; tz }): Promise<X01FoldRow[]>`.
  - `X01FoldRow = X01CheckoutDartRow & { bucketStart: string; bucketEnd: string }`.
  - It selects every `findX01CheckoutDarts` column from `vX01CheckoutDarts`, inner-joined to `vStatsSessionFacts` on `session_id` under `sessionScopeWhere`.
  - Bucket bounds come from phase 1's whitelisted bucket expressions over `vStatsSessionFacts.completedAt`; `bucket = none` echoes `from`/`to`.
  - Order: `session_id, stage_sequence, turn_sequence, dart_number` (the same order `findX01CheckoutDarts` pins).
- `findVisitScoring(db, q: SessionScope & { bucket; tz; bands: readonly [number, number, number] }): Promise<VisitScoringRow[]>`: `vPlayerVisitFacts` joined to `vStatsSessionFacts` on `session_id`, grouped by bucket. It returns:

```sql
SUM(total_score)::integer AS points,
SUM(dart_count)::integer AS darts,
COALESCE(SUM(total_score) FILTER (WHERE stage_type_key = 'LEG' AND turn_sequence <= 3), 0)::integer AS first_nine_points,
COALESCE(SUM(dart_count) FILTER (WHERE stage_type_key = 'LEG' AND turn_sequence <= 3), 0)::integer AS first_nine_darts,
COUNT(*) FILTER (WHERE total_score >= $b1 AND total_score < $b2)::integer AS ton,
COUNT(*) FILTER (WHERE total_score >= $b2 AND total_score < $b3)::integer AS ton_forty,
COUNT(*) FILTER (WHERE total_score >= $b3)::integer AS one_eighty
```

- `findHitNumberCells(db, q: DartScope & { bucket; tz }): Promise<HitNumberCellRow[]>`: over `vStatsDartFacts` with phase 2's `dartScopeWhere`. It groups by bucket plus `COALESCE(hit_target_number::text, 'MISS')`, and returns `darts = COUNT(*)` and `trebles = COUNT(*) FILTER (WHERE hit_zone_key = 'TREBLE')`.

- [ ] **Step 1: Failing tests** (rendered SQL + fake chain):
  - `findX01FoldRows` reads `vX01CheckoutDarts` joined to `vStatsSessionFacts`, filters `status_key` and `completed_at`, and orders by the four columns.
  - `findVisitScoring` binds all three band edges as parameters: the rendered SQL contains no literal `140`.
  - `findHitNumberCells` uses `dartScopeWhere`.
  - `findScopeDartCount` returns `0` for an empty scope.
  - Sums parse from strings.
- [ ] **Step 2: Implement** with Drizzle `sql` fragments.
- [ ] **Step 3:** Green, full suite.
- [ ] **Step 4: Measure** (needs `DATABASE_URL`; without it, ask the owner to run it and paste the plans). Run `EXPLAIN (ANALYZE, BUFFERS)` for the heaviest real player on:
  - `findX01FoldRows` over one month
  - `findScopeDartCount` over one month
  - `findVisitScoring` over all time (`from = 2000-01-01`)

  **Pass** means all three hold:
  - Entry through `idx_exercise_sessions_player_game_completed`.
  - No seq scan on `darts` or `turns`.
  - `v_stats_session_facts`' LATERAL counts run only for in-range sessions.

  **On fail:** stop. Add migration `0044` as its own task first: an index, or a lateral-free `v_stats_session_scope` view if the laterals are the cost, + verification + spec. Record the plan summaries in the PR body.
- [ ] **Step 5:** Commit: `feat(stats): readers for checkout and scoring sections`

---

### Task 4: One walk, one finish rule

**Files:**
- Modify: `app/src/modules/game/double-attempt.module.ts`, `app/src/modules/game/highest-checkout.module.ts`
- Tests: `app/tests/modules/game/double-attempt.module.test.ts`, `highest-checkout.module.test.ts` (extend only)

**Interfaces:**
- `checkoutDarts(visit: CheckoutVisitDarts): { remaining: number; dart: DartFact }[]`: the remaining before each dart, in throw order (`remaining -= dart.score` after each).
- `isFinishingDart(remaining, dart)` is exported unchanged.

- [ ] **Step 1: Failing tests.**
  - `checkoutDarts` of a visit opening at 81 with T19/D12 yields remainings `81, 24`.
  - `isFinishingDart(50, INNER_BULL)` is true; `isFinishingDart(32, DOUBLE:8)` is false.
- [ ] **Step 2: Implement.** Rewrite `classifyDoubleAttempts` onto `checkoutDarts`. The existing test files stay unedited apart from the new cases, and green.
- [ ] **Step 3:** Full suite. Commit: `refactor(game): shared checkout dart walk and finish rule`

---

### Task 5: Stage-tagged session fold

**Files:**
- Modify: `app/src/modules/stats/x01-checkout-sessions.module.ts`
- Test: `app/tests/modules/stats/x01-checkout-sessions.module.test.ts` (extend; reuse its fixtures)

**Interfaces:**
- `StagedVisit = CheckoutVisitTotals & { stageId: string; stageTypeKey: string }`.
- `SessionCheckoutVisits = { sessionId: string; gameTypeKey: string; rulesetVersionKey: string; visits: StagedVisit[] }`.
- `sessionCheckoutVisits(rows: readonly X01CheckoutDartRow[]): SessionCheckoutVisits[]`: one entry per session, in first-row order. A session `visitsForSession` skips (no snapshot, undecodable snapshot, seatless 121/TUOD) yields `visits: []`.
- `checkoutVisitsFromRows` becomes `sessionCheckoutVisits(rows).flatMap((s) => s.visits)` with the extra fields stripped. Its output is unchanged.

Every builder maps `seatTurns` one-to-one in order (`checkout-visits.module.ts`). So `visits[i]` takes `stageId` from `seatTurns[i].stageClientKey`, and `stageTypeKey` from the rebuilt stage list.

- [ ] **Step 1: Failing tests.**
  - A two-leg 501 fixture tags each visit with its own leg's stage id.
  - A 121 fixture with two `ROUND` stages tags visits per round.
  - A snapshot-less session yields `{ visits: [] }`.
  - `checkoutVisitsFromRows` output deep-equals the pre-change output for every existing fixture.
- [ ] **Step 2: Implement.** Existing tests stay unedited and green. Commit: `refactor(stats): stage-tagged checkout visits per session`

---

### Task 6: Checkout section modules

**Files:**
- Create: `app/src/modules/stats/sections/{checkout-rate,double-performance,checkout-path,bust-rate}.module.ts`
- Tests: the four matching `*.module.test.ts`

**Interfaces** (pure, isomorphic, `now` injected). Each takes `(sessions: BucketedSession[], ctx) => Bucket<M>[]`, with `BucketedSession = SessionCheckoutVisits & { bucketStart; bucketEnd }`, built in Task 8. `sampleSize` is the number of visits counted, and empty buckets are not emitted.
- **checkout-rate** (decision 4): per visit where `isCheckoutReachable(v.startingRemaining, 3)`, `chances += 1`, and `finished += 1` when some `checkoutDarts` step satisfies `isFinishingDart`.
- **double-performance** (decision 4): per `checkoutDarts` step, `classifyDart(remaining, dart)`. `HIT`/`MISS` count against `doubleTargetKey(remaining)`; `NOT_ATTEMPT` is skipped.
  - `doubleTargetKey(r)` returns `INNER_BULL:25` for 50, `DOUBLE:r/2` for even `2 ≤ r ≤ 40`, else `null`.
  - A non-null key is guaranteed for every attempt: assert it, and throw if a future `classifyDart` change breaks that.
- **checkout-path:** per chance visit (the same predicate as checkout-rate), `routeLabel(v.darts)` → `visits += 1`, plus `finished += 1` when it finished.
  - `dartLabel(dart)` gives: `SINGLE`/`INNER_SINGLE`/`OUTER_SINGLE` → `"n"`, `TREBLE` → `"Tn"`, `DOUBLE` → `"Dn"`, `INNER_BULL` → `"BULL"`, `OUTER_BULL` → `"25"`, `MISS` → `"MISS"`.
  - Only darts thrown before the finish count (a finished visit has no later darts anyway).
- **bust-rate** (decision 6): per visit with `startingRemaining ≤ 180`, `visits += 1`. `busts += 1` when a `checkoutDarts` step gives `resolveCheckoutAttempt(remaining, dart.score, isFinishingZone(dart)).busted` before any finish. `isFinishingZone` is `DOUBLE | INNER_BULL`, taken from `highest-checkout.module.ts`'s `FINISHING_ZONES` export (export it; no copy).

- [ ] **Step 1: Failing tests.**
  - checkout-rate:
    - A visit at 170 finishing T20/T20/BULL gives `{ "170": { chances: 1, finished: 1 } }`.
    - A visit at 169 (bogey) counts nothing.
    - A visit at 32 with S16/S8/MISS gives one chance and none finished.
  - double-performance:
    - At 32, D16 gives `DOUBLE:16` 1/1.
    - At 32, S16 then a D8 miss (remaining 16) gives `DOUBLE:16` 0/1 and `DOUBLE:8` 0/1.
    - A lay-up at 45 is not counted.
  - checkout-path: the route `"T20 T20 BULL"` under `"170"`. A 2-dart finish at 81 gives the key `"T19 D12"`.
  - bust-rate:
    - 40 → S20, S19 (remaining 1) is a bust.
    - 40 → S20, S20 (0 not on a double) is a bust.
    - 40 → D20 is no bust.
    - A visit at 301 is not counted.
    - A TUOD failed attempt with three misses is no bust (decision 6).
  - Two sessions in the same bucket sum; sessions in two buckets split.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(stats): checkout-rate, double-performance, checkout-path and bust-rate modules`

---

### Task 7: Ladder, leg and SQL-shaped modules

**Files:**
- Create: `app/src/modules/stats/sections/{ladder-progress,leg-stats,scoring-trend,treble-rate}.module.ts`
- Tests: the four matching `*.module.test.ts`

**Interfaces:**
- `ladderAttempts(session: SessionCheckoutVisits): { target: number; success: boolean }[]` (decision 8):
  - For `ONE_TWENTY_ONE`, visits are grouped by `stageId` in order; the target is the group's first `startingRemaining`.
  - For `TUOD`, each visit is one attempt.
  - Success means some `checkoutDarts` step `isFinishingDart`.
- `ladderProgressBuckets(sessions, ctx)` folds attempts per session in order:
  - It fills `targets[target]`.
  - `maxTarget` is the max target attempted, `null` with no attempts.
  - After a failed attempt, the next attempt in the same session does `afterMiss += 1`, plus `recovered += 1` if it succeeds.
- `legDarts(session): number[]`: for each `LEG` stage whose visits hold a finishing dart, the owner's dart count across those visits (decision 7). `legStatsBuckets` fills `Record<darts, legs>`.
- `scoringTrendBuckets(rows: VisitScoringRow[], ctx)` and `trebleRateBuckets(rows: HitNumberCellRow[], ctx)` reshape rows. `SCORE_BANDS = [100, 140, 180] as const` lives in `scoring-trend.module.ts`.

- [ ] **Step 1: Failing tests.**
  - TUOD attempts at 41 (success), 51 (fail), 50 (success) give `maxTarget = 51`, `afterMiss = 1`, `recovered = 1`.
  - A 121 round of three visits finishing on the third is one attempt at 121, successful.
  - `afterMiss` does not carry across sessions.
  - leg-stats:
    - A finished 501 leg of 18 darts plus an unfinished last leg gives `{ "18": 1 }`.
    - A 1v1 leg the opponent won (no owner finishing dart) is excluded.
  - scoring-trend maps row fields one-to-one. treble-rate keys `"MISS"`.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(stats): ladder-progress, leg-stats, scoring-trend and treble-rate modules`

---

### Task 8: Service dispatch and the fold bound

**Files:**
- Modify: `app/src/services/statistics.service.ts`
- Test: `app/tests/services/statistics.service.test.ts` (extend)

**Change:**
- **SQL sections:** `scoring-trend.load` = `findVisitScoring` with `SCORE_BANDS`; `treble-rate.load` = `findHitNumberCells`.
- **Server sections:** one shared `foldLoad`:
  1. `findScopeDartCount(scope)` → above `MAX_FOLD_DARTS`: `VALIDATION_FAILED` with `reason: "range holds N darts; server sections fold at most MAX_FOLD_DARTS — request a shorter range"`.
  2. `findX01FoldRows`.
  3. Group rows by session, run `sessionCheckoutVisits`, and attach each session's `bucketStart`/`bucketEnd` (identical on every row of the session) → `BucketedSession[]`.

  Each server handler's `shape` is its Task 6/7 module.

- [ ] **Step 1: Failing tests.**
  - Each of the eight sections dispatches and shapes.
  - A scope count of `MAX_FOLD_DARTS + 1` → `VALIDATION_FAILED`, and `findX01FoldRows` is never called.
  - `ladder-progress` on `501` → `NOT_FOUND`; `leg-stats` on `TUOD` → `NOT_FOUND`.
  - `checkout-path` with `bucket=month` → `VALIDATION_FAILED` (not bucketable).
  - The phase 1 and 2 section tests are still green without edits.
  - `getStatisticsOverview`'s Checkout % is unchanged on its existing fixture.
- [ ] **Step 2: Implement.** Green, full suite. Add one route test for `checkout-rate`, then run `npm run validate:app`.
- [ ] **Step 3: Measure the cap** (local, not a test). Build a synthetic TUOD session log of `MAX_FOLD_DARTS` darts (100-round sessions), time `sessionCheckoutVisits` plus the six shapes with `performance.now()`, and record it in the PR body.
  - Target: under 50 ms total.
  - If slower, lower `MAX_FOLD_DARTS` to fit and update the registry test. TUOD is the worst case: its per-visit refold is quadratic within a session.
- [ ] **Step 4:** Commit: `feat(stats): dispatch checkout family with fold bound`

---

### Task 9: Chunked client reads, store and page

**Files:**
- Create: `app/src/lib/stats/merge-metrics.ts`
- Modify: `app/src/lib/client/stats-cache/*` (the phase 1 `readSection` path), `app/src/stores/game-stats.store.ts`, `app/src/pages/statistics/index.astro`
- Tests: `app/tests/lib/stats/merge-metrics.test.ts`, the cache and store tests (extend)

**Interfaces:**
- `chunkWindows(from, to, bucket, tz): { from; to }[]` (decision 2). Month windows use the same calendar math the client already uses for bucket boundaries (phase 1). It lives in `lib/stats/` and is isomorphic.
- `mergeMetrics(sectionId, a, b)`:
  - numeric leaves sum
  - `maxTarget` merges by `max`, with `null` as the identity
  - records merge by key

  One exhaustive `Record<ServerSectionId, merger>`, so a new server section cannot miss one.
- `readSection` gains the server path. For `computeSite === "server"` it:
  1. reads cached chunks
  2. fetches the missing chunks sequentially (one Worker fold at a time)
  3. merges `bucket=none` results across chunks, or concatenates bucket lists; a `year` view regroups months with `mergeMetrics`

  On `VALIDATION_FAILED` it shows the card error state, and never auto-splits further.

**Store getters** (client-derived from components; band edges are client constants, decision 3):
- `checkoutRateBands`: remaining bands 2–40, 41–60, 61–80, 81–100, 101–130, 131–170.
- `doubleRows`, plus `favoriteDouble`/`weakestDouble` (`MIN_TARGET_SAMPLE`).
- `pathsFor(remaining)`: routes sorted by use, each with its finish rate and the chart route `checkoutPathFor(remaining)` for comparison.
- `bustRateBands`.
- `ladderSummary`: highest target, success rate per 10-target band, recovery rate.
- `legHistogram`, `bestLeg`, `averageLegDarts`.
- `threeDartAverage`, `firstNineAverage`, `bandCounts` per bucket.
- `trebleRate("20")`, `trebleRate("19")`, `trebleRateAll`.

**Page cards:**

| Section | Card |
| ------- | ---- |
| `scoring-trend` | average and first-nine lines over buckets; band counts |
| `ladder-progress` | highest target, success by target band, recovery after a miss |
| `checkout-rate` | conversion per remaining band + trend |
| `double-performance` | per-double hit rate, favourite and weakest called out |
| `checkout-path` | a remaining picker, the routes taken vs the chart route |
| `bust-rate` | busts per remaining band + trend |
| `leg-stats` | darts-per-leg histogram, best leg, average |
| `treble-rate` | T20/T19/overall treble share + trend |

Sparse samples show "not enough data yet" below `MIN_TARGET_SAMPLE`, never a rate.

- [ ] **Step 1: Load the `dataviz` skill** before any chart code or colour choice. Then read `07-Frontend/10-Frontend-Agent-Guide.md`. Colours come from style tokens (`check-style-tokens.sh`).
- [ ] **Step 2: Failing tests.**
  - `chunkWindows` gives 12 windows for a calendar year in `Europe/Amsterdam`, with the March/October DST month edges at local midnight.
  - `mergeMetrics` sums `checkout-rate` and max-merges `maxTarget`.
  - `readSection` for a server section with 11 cached closed months fetches only the open one.
  - `favoriteDouble` ignores doubles under the minimum sample.
- [ ] **Step 3: Implement the cache path, then the store, then the page.**
- [ ] **Step 4:** Full suite, `npm run validate:app`, then the full `app/` gate set from `run-all-gates`. Commit: `feat(stats): checkout family cards and chunked server reads`

---

### Task 10: Docs, decision, gates

**Files:**
- `decisions/api.md`: **D369** covering decisions 1–12. Confirm the id with `bash scripts/next-decision-id.sh`.
- `docs/architecture/10-Statistics/01-Section-Catalog.md`:
  - `leg-stats` row: site `server`, reason "finished legs need the checkout fold; `v_player_leg_facts` counts lost and abandoned legs".
  - `checkout-rate` row: per-visit chances.
  - `double-performance` row: per-dart, keyed per double.
  - `bust-rate` row: the shared double-out rule only.
  - `treble-rate` row: per landed segment.
  - `scoring-trend` row: exclusive bands.
  - §2.2: `configSensitive` governs result-shaped sections (`session-result`, `ladder-progress`); checkout facts pool versions.
  - Status line: these eight sections are built.
- `docs/architecture/10-Statistics/00-Overview.md`:
  - §4: the dart cap (`MAX_FOLD_DARTS`) and client month chunking as the `server` bound mechanism.
  - §7: chunked cache reads for server sections.
  - §12: phase 3 is done.
  - Version bump 1.3.0, citing D369.
- `docs/architecture/06-API/04-Endpoint-Contracts.md`: the eight section ids, their metric shapes, and the fold-bound `VALIDATION_FAILED` reason.
- If Task 3 Step 4 added `0044`: the views/spec rationale, and the migration range in `docs/CLAUDE.md`, root `CLAUDE.md` and `database/CLAUDE.md`.

- [ ] **Step 1:** Make the doc edits: minimal diffs, canonical doc first.
- [ ] **Step 2:** Run the `context-maintenance` skill.
- [ ] **Step 3:** Run the `run-all-gates` skill: the Always-run set, the `app/` set and `check-decision-ids.sh` (plus `check-constraint-mirror.sh` if `0044` exists). Report each result. `check-doc-sync.sh` is satisfied by the Step 1 edits, because `modules/game` and `modules/stats` changed.
- [ ] **Step 4:** Commit `docs(stats): phase 3 checkout family and D369`, then run `superpowers:finishing-a-development-branch` with `finishing-a-dart-branch` (push + PR).

---

## Out of scope (later phases)

- Intent-derived sections, `bobs27-survival`, `shanghai-count` and `atc-darts-per-target` (phase 4).
- A materialized `(player, game, month)` rollup: only if Task 8 Step 3 or production shows the chunked fold is too slow (`00-Overview.md` §4 escalation).
- Batching several server sections into one fold per request. Each section folds on its own today; merging them is an optimisation to take only if measured.
- `session-result` for 121/TUOD (`resultDirection: null` since phase 1): `ladder-progress.maxTarget` covers the insight; the phase 1 issue stays open.
- Career-wide doubles (catalog §3). QUICK_SCORE X01 sessions are outside every section here (`v_x01_checkout_darts` is VISUAL_BOARD-only).
