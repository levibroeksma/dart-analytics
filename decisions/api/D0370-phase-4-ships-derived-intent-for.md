---
id: D0370
status: accepted
date: 2026-09-27
origin: contemporaneous
original-date:
tags: [api, endpoint, envelope, session, status]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Phase 4 ships derived intent for Singles/Shanghai/Around the Clock and three game-specific sections; `TargetKey` gains `NUMBER`/`BULL`, and `requires`/site resolution gain per-game overrides

## Context and Problem Statement
recovering the aim from each engine's own reducer (decision 1), instead of re-deriving visit-index arithmetic in stats code, is what decision 2's parity tests can hold the play page and the stats page to the same answer with — a second implementation of "what was this dart aimed at" is exactly the drift the parity tests exist to catch. Building the fold on one synthetic seat (decision 3) and skipping a session the fold cannot honestly replay rather than guessing (decision 4) keeps the derived numbers honest about what they can and cannot see. Threading the OR/site-override mechanism through the registry (decision 5) instead of special-casing three games' worth of sections in the service dispatcher is what lets the same four board-family sections serve both the stored and the derived intent families without forking their modules. `shanghai-count`'s move to `server` (decision 12) and grouping's SQL-only ceiling (decision 6) both follow the same "no game rules in SQL" constraint phase 2/3 already established; the deferred derived heatmap filter (decision 16) is that constraint's other edge, drawn rather than quietly worked around.

## Decision Drivers
* Singles Training, Shanghai and Around the Clock store no intended target, so the aimed target must be recovered by folding each session through its engine's reducer.
* Parity tests pin `isAimHit` against each engine's own hit rule, so the section never disagrees with the play page.
* No game rules in SQL.
* A whole-number aim has no aim point: a spread around the wedge measures ring choice, not skill.
* Configs that change difficulty are never blended.

## Considered Options
* Recover the aim from each engine's own `activeTargetOf` and reducer (chosen).
* Keep `shanghai-count` at site `sql` with a SQL pattern over 3 darts.
* Keep `grouping` for derived games.

## Decision Outcome
Chosen option: "sixteen decisions for the phase 4 build (`docs/superpowers/plans/2026-09-26-statistics-phase-4-derived-intent-sections.md`):
1. The aim is the engine's own active target before the dart: Singles, Shanghai and Around the Clock each export `activeTargetOf(state, config)`, and their reducers call it — no stats code rebuilds a path. The target maps to an aim key (Singles/Shanghai `NUMBER:n`, Shanghai never reaching `BULL`; Around the Clock `ANY` → `NUMBER:n`/`BULL:25`, `OUTER_SINGLE` → `OUTER_SINGLE:n`/`BULL:25`). Never written back as stored intent.
2. `TargetKey`/`IntentZoneKey` gain `NUMBER` (any ring of 1-20) and `BULL` (either bull ring, 25). `isAimHit(aim, hit)`: `NUMBER:n` is any ring of `n` except `MISS`; `BULL:25` is either bull ring; every other (stored) zone keeps phase 2's exact-pair rule. Parity-tested against each engine's own hit rule so the section never disagrees with the play page.
3. The fold is single-seat over the owner's own darts: every reducer in scope is per-seat (`foldSeatStates`), and the walker (`foldSeatSteps`) builds a one-seat config off the decoded snapshot with a synthetic seat, never the session's stored `seats` — a seatless historical snapshot folds exactly the same.
4. A session the fold cannot replay contributes nothing, never guessed: no snapshot, a snapshot that does not decode, a fold row count differing from `v_stats_session_facts.dart_count`, or the reducer throwing are each skipped and counted in `skippedSessions`, returned on every server-site response (optional field, so phase 1-3 results stay valid).
5. `requires` gains OR: `Requirement = StatsTag | { anyOf: readonly StatsTag[] }`. The four widened sections (`target-accuracy`, `confusion`, `miss-direction`, `loose-darts`) require `{ anyOf: [intent-stored, intent-derived] }` (+ `board` where phase 2 had it). `SectionMeta.siteByTag` overrides `computeSite` per game tag (these four set `{ intent-derived: server }`); `sectionSite(meta, gameTypeKey)` is the one resolver the service and the client both use.
6. `grouping` stays stored-only: a whole-number aim has no aim point, so a spread around the wedge measures ring choice, not skill. Singles Training's catalog row drops `grouping`.
7. Miss direction gets two new references: `NUMBER:n` uses a new `wedgeNearestPoint(n, point)` (`board-geometry.module.ts`), banded `[outerBull, doubleOuter]`; `BULL:25` uses the board centre, banded `[0, outerBull]`; stored-zone aims keep phase 2's `missReferences` row. The bearing is always phase 2's `missSector`, so both paths share `MissSectorRow`.
8. Loose darts for the new aim zones (constants in `loose-darts.module.ts`; changing them bumps `version`): `NUMBER:n` — on = `isAimHit`, near = any ring of a neighbouring number, loose = anything else (bull and `MISS` included); `BULL:25` — on = either bull ring, near = `INNER_SINGLE` of any number, loose = anything else. Stored zones keep phase 2's rule.
9. Per-ring accuracy (catalog's Singles "per ring", Shanghai "per number and ring") is a client getter reading `confusion`'s existing `NUMBER:n` cross-tab — no extra metric, and no trend (confusion is not bucketable).
10. `SectionMeta.games?: readonly GameTypeKey[]` gates a section to named games on top of its tags — how the three game-specific sections attach to exactly one game each.
11. `PAGE_ORDER_OVERRIDES: Partial<Record<GameTypeKey, readonly SectionId[]>>` holds Shanghai only, where catalog §2 puts `session-result` right after `shanghai-count`; a test asserts every override is a permutation of the tag-derived set, so an override can reorder but never add or drop a section.
12. `shanghai-count` moves from site `sql` to `server`: a Shanghai is S+D+T of the *active* number in one visit, and the active number is itself a fold — a SQL pattern over three darts would put a game rule in SQL and could count S+D+T of the wrong number. It reads the engine's own `SHANGHAI` seat status off the same fold every derived section walks. Metrics: `{ sessions, shanghais, byRound }`. Versions pool (V2's Hard mode changes scoring, not the Shanghai rule).
13. Game-specific metrics group by `configGroupKey(fields, session)`: `ruleset_version_key` plus the named snapshot fields, in declared order, joined as `field=value` pairs; a field missing from the snapshot renders as `field=` rather than throwing. `atc-darts-per-target`: `configSensitive: ["ruleset_version_key", "difficulty", "segment_rule"]`; `bobs27-survival`: `["ruleset_version_key", "start_score", "miss_penalty_multiplier", "bull_hit_value"]`.
14. `atc-darts-per-target`: a dart counts against the aim before it; a target is *cleared* when the fold moves past it (next index, a lap, or `COMPLETE` — a V2 step-back is not a clear). Metrics per group and aim: `{ darts, cleared }`. Darts on a target never cleared stay in `darts`, since they are the true cost of that target.
15. `bobs27-survival` (additive, per config group): `runs`, `completed` (seat `WON`); `reached`/`died` per `TargetKey` (`died` on seat `LOST`); `scoreAfter` per target (`{ runs, sum, min, max }`), taken once that target's visit resolves. A single session's own survival curve is phase 5's job.
16. Bounds, status and context follow phase 3: server sections check `MAX_FOLD_DARTS` first and are fetched in month chunks; only `status=completed` is accepted; the `target` parameter stays limited to `heatmap` on `intent-stored` games — a derived heatmap filter would need the fold for a SQL-site section, deferred rather than built here.".

### Consequences
`10-Statistics/00-Overview.md` §2 (`requires`'s `anyOf` shape, `siteByTag`, `games`, page-order override fields), §3 (`NUMBER`/`BULL` aim zones) and §12 (phase 4 done) are corrected/extended to match this block (version bump 1.4.0). `01-Section-Catalog.md` §1 (site column), §1.1 (`NUMBER`/`BULL` adjacency), §1.2 (aim map, single-seat fold, skip rules, `skippedSessions`), §2 (Singles Training drops `grouping`) and §2.1 (`shanghai-count`'s site and reason, all three sections' metric shapes and `configSensitive`) are updated; its status line now lists twenty sections built. `06-API/04-Endpoint-Contracts.md` gains the three new section ids' metric shapes, `skippedSessions` on the shared envelope, and the per-game site rule. Resolved as part of this branch's own Definition-of-Done gate, not left as discovered work: issue #623, two Task 6 functions (`classifyLanding`, `aimMissRows`) exceeding fallow-gate's cognitive-complexity threshold, fixed by extracting per-branch helper functions with no behavior change. Filed as `discovered-work`, not fixed here: issue #624, Shanghai Hard mode's swindle halving never reaching the persisted `turns.total_score` column that `pointsPerRound` and `session-result` both read, found while wiring the former. Task 5 Step 4's `EXPLAIN` measurement needed `DATABASE_URL`, unavailable in the implementing session's container, for the same reason D368/D369's Consequences record; recorded as a known limitation in the PR, with the index-adequacy check Task 5's own on-fail plan names still to be run by someone with database access before this phase closes out. Task 8 Step 3 timed the derived fold (`sessionSteps` + `aimCellRows`) over a synthetic `MAX_FOLD_DARTS`-dart Around the Clock log at ~26-28ms, well under the 50ms budget carried over from D369.
* Good, because the aim is the engine's own answer, so no stats code rebuilds a path.
* Good, because a session the fold cannot replay is skipped and counted in `skippedSessions` instead of guessed, so a card can say how many sessions could not be replayed.
* Neutral, because Singles Training drops `grouping`.
* Neutral, because a derived `heatmap` target filter is deferred: it would need the fold for a SQL-site section.

### Confidence
Rationale unknown — no source found.

### Revisit When
A per-session materialized aim cache is added only if Task 8 Step 3 or production shows the fold is too slow.

### Confirmation
`app/tests/lib/stats/section-registry.test.ts` asserts that every `PAGE_ORDER_OVERRIDES` entry is a permutation of the tag-derived set for its game. `app/tests/lib/stats/target-key.test.ts` covers `isAimHit`.

## Pros and Cons of the Options
### Recover the aim from the engine's reducer
* Good, because no stats code rebuilds a path.
* Good, because parity tests can hold the play page and the stats page to the same answer.

### `shanghai-count` as a SQL pattern over 3 darts
* Bad, because it puts a game rule in SQL and could count S+D+T of the wrong number: the active number is itself a fold.

### `grouping` for derived games
* Bad, because a whole-number aim has no aim point, so a spread around the wedge measures ring choice, not skill.

## Evidence / More Information
Decided: 2026-09-27
Refines: D369
Referenced by D0560's `Supersedes:` line.

* `docs/superpowers/plans/2026-09-26-statistics-phase-4-derived-intent-sections.md` (Plan-level decisions 1-16, Global Constraints, Out of scope): rebuilt Decision Drivers, Considered Options, Consequences, Revisit When, Confirmation and Pros and Cons.
* Commit `4e5706a7` (2026-09-27, adds the D370 row).
* Applied in: `docs/superpowers/specs/2026-11-17-near-miss-distance-rule-design.md`, `docs/superpowers/specs/2026-11-11-x01-inferred-aim-statistics-design.md`, `docs/superpowers/plans/2026-09-26-statistics-phase-5b-replay.md`.
