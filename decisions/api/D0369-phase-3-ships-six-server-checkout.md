---
id: D0369
status: accepted
date: 2026-09-26
origin: contemporaneous
original-date:
tags: [api, endpoint, session, status]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Phase 3 ships six server checkout folds and two SQL sections behind a measured dart cap, exact-value metrics, and a pooled ruleset-version fact

## Context and Problem Statement
the plan's own placeholder for `MAX_FOLD_DARTS` (20,000) was explicitly provisional — "Task 8 Step 4 measures it" — because TUOD's per-visit refold within a session is quadratic in darts, the one server fold whose cost is not bounded by session count. Measuring before shipping, rather than trusting the placeholder, is what the compute-site rule's "bounded input only" hard constraint (`00-Overview.md` §4) actually requires; publishing an unverified cap would have been the same mistake in the other direction. Folding `leg-stats` and the ladder/bust/double sections through the one `checkoutDarts` walk (decision 5) is what keeps "remaining before dart" and "is this a finish" defined exactly once across six sections that each need it, instead of six near-identical loops drifting apart the way the pre-D330/D338 checkout code once did. Grouping all twelve into one decision follows D367/D368's own precedent: they are one build's worth of related calls, not independent choices worth separately numbering.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "twelve decisions for the phase 3 build (`docs/superpowers/plans/2026-09-26-statistics-phase-3-checkout-sections.md`):
1. Server folds (`checkout-rate`, `double-performance`, `checkout-path`, `bust-rate`, `ladder-progress`, `leg-stats`) are bounded by a dart cap: before loading, `findScopeDartCount` sums `dart_count` over the scoped `v_stats_session_facts` rows, and a scope above `MAX_FOLD_DARTS` fails `VALIDATION_FAILED` naming the cap in `reason`. Task 8 Step 3 timed a synthetic worst-case TUOD session log (the quadratic-refold case) with `performance.now()` against the plan's placeholder of 20,000 darts — ~128ms, over the 50ms budget — and again at 5,000 darts — ~30ms. `MAX_FOLD_DARTS` ships as the measured **5,000**, not the plan's placeholder, and `section-registry.test.ts` asserts that value.
2. Server sections are fetched in chunk windows (the bucket unit for `day`/`week`/`month`, calendar months in `tz` for `none`/`year`); closed chunks are cached forever, and every server metric is additive (decision 3), so the client merges chunks exactly; `year` is a client regroup of months.
3. Server metrics are exact-value counts keyed by the exact remaining score or target, never by band; band edges are a client constant, so rebanding needs no refetch. `maxTarget` is the one non-sum field, merged by `max`.
4. `checkout-rate` is per visit — a chance is a visit whose `startingRemaining` is reachable within 3 darts (`isCheckoutReachable(r, 3)`); finished means the visit holds a finishing dart. `double-performance` is per dart, keyed by the double the remaining requires (`doubleTargetKey`, `50` → `INNER_BULL:25`, even `r ≤ 40` → `DOUBLE:r/2`), reusing phase 2's `TargetKey` format; the favourite double is client-derived (best rate above `MIN_TARGET_SAMPLE`).
5. One definition for finishing and for remaining-before-dart: `highest-checkout.module.ts`'s private `isFinishingDart` is exported unchanged; `double-attempt.module.ts` gains `checkoutDarts(visit)` (remaining-before-dart in throw order), and `classifyDoubleAttempts` is rewritten onto it. Every new section module walks darts through `checkoutDarts`, never its own `remaining -= score` loop.
6. A bust is the shared double-out rule only: a visit busts when `resolveCheckoutAttempt` (`checkout-bust.module.ts`), applied dart by dart via `checkoutDarts`, reports `busted` before any checkout. Ruleset early busts (121's final-visit rule, TUOD's one-dart rule) are forfeits the engine imposes, not overthrows, and are not counted; only visits with `startingRemaining ≤ 180` are counted, since no visit can bust above that.
7. `leg-stats` moves from the catalog's earlier `sql` site to `server`: `v_player_leg_facts` has no winner column and counts lost 1v1 legs and the abandoned final leg as legs, which breaks "darts per leg" and "best leg". A leg counts only when the owner's visits in that `LEG` stage hold a finishing dart; the metric is a histogram `Record<darts, legs>`, and it reuses the checkout fold rather than reading a second path.
8. Ladder attempts: for `ONE_TWENTY_ONE` an attempt is one `ROUND` stage, its target the group's first visit's `startingRemaining`; for TUOD an attempt is one visit. Success means some `checkoutDarts` step is a finishing dart. Metrics: `targets: Record<target, {attempts, successes}>`, `maxTarget`, `afterMiss` (an attempt following a failed one in the same session), `recovered` (of those, successes).
9. The checkout sections, `scoring-trend`, `treble-rate` and `leg-stats` pool ruleset versions — a dart at remaining 32 is the same fact under 121 V1 and V2, which differ only in duration modes. `ladder-progress` alone declares `configSensitive: ["ruleset_version_key"]`, because 121 V2's Rounds/Timed modes cap how far a session can climb; `01-Section-Catalog.md` §2.2 is clarified to say `configSensitive` governs result-shaped sections (`session-result`, `ladder-progress`), while checkout facts pool versions.
10. `scoring-trend` (SQL, rule-free): points are `SUM(turns.total_score)` (a bust counts as 0) and darts are `SUM(dart_count)`; first-nine is turns with `turn_sequence ≤ 3` inside a `LEG` stage (zero for games with no `LEG` stages, and the client hides the line); score bands are exclusive bins `[100,140)`, `[140,180)`, `180+` over `SCORE_BANDS = [100, 140, 180]`, bound as SQL parameters, never literals.
11. `treble-rate` (SQL, rule-free): per hit number (`"1"`–`"20"`, `"25"`, `"MISS"`), `{darts, trebles}`. Neither X01 nor Score Training stores intent, so "thrown at the scoring beds" is read as "landed in that bed's segment".
12. Status and context follow phase 1: none of these eight sections declares `includesAbandoned`, so only `status=completed` is accepted.".

### Consequences
`10-Statistics/00-Overview.md` §4 (dart cap + client month-chunking as the `server` bound mechanism), §7 (chunked cache reads) and §12 (phase 3 done) are corrected/extended to match this block (version bump 1.3.0). `01-Section-Catalog.md` gains rows/notes for `leg-stats`, `checkout-rate`, `double-performance`, `bust-rate`, `treble-rate` and `scoring-trend`, and its status line now lists seventeen sections built. `06-API/04-Endpoint-Contracts.md` gains the eight section ids' metric shapes and the fold-bound `VALIDATION_FAILED` reason text (`"range holds N darts; server sections fold at most 5000 — request a shorter range"`). `merge-metrics.ts`'s exhaustive `Record<ServerSectionId, merger>` is what makes a future ninth server section a compile error if its merger is forgotten, rather than a silently-wrong chunk merge. Task 3 Step 4's `EXPLAIN` measurement (this plan's own repository-reader query plans) needed `DATABASE_URL`, unavailable in the implementing session's container, for the same reason D368's Consequences record — logged as a known limitation in the PR rather than skipped silently; this phase adds no migration, so the D344 carve-out does not apply. Filed as `discovered-work`: issue #620, a pre-existing phase-2 bug where `game-stats.store.ts`'s generic chunk-load loop sends `bucket=month` to `bucketable: false` sections (`heatmap`/`confusion`/`miss-direction`), which always reject a non-`none` bucket — found incidentally while wiring phase 3's own chunked reads, not fixed here.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-26
Refines: D368
