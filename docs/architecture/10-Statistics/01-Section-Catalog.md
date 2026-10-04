<!--
status: canonical
scope: architecture/statistics/sections
read-when: adding, changing, or choosing insight sections for a statistics game page
updated: 2026-10-04
-->

# Statistics — Section Catalog

> **Version:** 1.6.5 (2026-10-04, D406; prior 1.6.4 2026-10-03, D402; prior 1.6.3 2026-10-03, D401; prior 1.6.2 2026-10-03, D399; prior 1.6.1 2026-10-03, D397; prior 1.6.0 2026-10-03, D396)
>
> The shared insight-section library and the section list of each game page.
> Registry fields, tags, compute sites and the query contract are defined once in
> `00-Overview.md`; this file only applies them. Status: `session-result`,
> `completion`, `volume`, `heatmap`, `target-accuracy`, `confusion`,
> `grouping`, `miss-direction`, `loose-darts`, `checkout-rate`,
> `double-performance`, `checkout-path`, `bust-rate`, `leg-stats`,
> `ladder-progress`, `scoring-trend`, `treble-rate`, `shanghai-count`,
> `atc-darts-per-target`, `bobs27-survival` and `training-result` are **built**
> (phase 1 + 2 + 3 + 4, #738); every other section below is still designed, not built. Phase 4
> (D370) also widens `target-accuracy`, `confusion`, `miss-direction` and
> `loose-darts` onto the `intent-derived` family (Singles Training, Shanghai,
> Around the Clock) — those four were already built in phase 2 for
> `intent-stored`. Phase 6 (D372) adds the Routines tab's four sections
> (§3), all built.

---

# 1. Shared Section Library

Sections are reusable across games; a page picks them by capability tag
(`00-Overview.md` §3). "Site" follows `00-Overview.md` §4.

| Section | Requires | Site | Reason for site | Bucketable | Insight |
| ------- | -------- | ---- | --------------- | ---------- | ------- |
| `heatmap` | `board` | sql | grid binning of coordinates collapses months of darts to a fixed grid | no | where darts land in the range; filter by target where intent exists |
| `grouping` | `board` + `intent-stored` | sql | position moment sums (Σx, Σy, Σx², Σy², Σxy) re-aggregate exactly across buckets; mean/spread/bias are derived isomorphically against `zoneCentroid` (D368) | yes | spread size and bias per target ("pulls low-left on D16") |
| `miss-direction` | `board` + `intent-*` | sql (stored) / server (derived) | angle sectors are arithmetic against reference points TS binds as parameters (D368); derived intent needs the engine fold | no | direction of misses per target, inside/within/outside the intended ring band |
| `loose-darts` | `board` + `intent-*` (stored: sql; derived: server) | sql (stored) / server (derived) | SQL counts intended × hit cells; TS classifies each aggregated cell with board geometry, so geometry stays single-sourced (D368) | yes | loose-dart rate per target and its trend |
| `target-accuracy` | `intent-*` | sql (stored) / server (derived) | hit counts per target and ring | yes | hit rate per target/ring; strongest and weakest targets |
| `confusion` | `intent-*` | sql (stored) / server (derived) | intended × hit counts | no | where aims at a target actually land (e.g. D16 → D8/D7) |
| `scoring-trend` | `scoring` | sql | sums and counts per bucket; first-nine is the owner's first three visits per `LEG` or `EXERCISE_BLOCK` stage (section version 2, D385); score bands are exclusive bins, not cumulative thresholds (D369) | yes | 3-dart average, first-nine average, score bands (100+/140+/180) |
| `treble-rate` | `scoring` + `board` | sql | ring counts inside the scoring beds; counted per landed segment, not per aimed target — X01 and Score Training store no intent (D369) | yes | treble share of darts thrown at the scoring beds |
| `checkout-rate` | `checkout` | server | remaining score is a ladder fold (`checkout-visits.module.ts`); a chance is counted per visit, not per dart (D369) | yes | checkout % overall and by remaining-score band |
| `double-performance` | `checkout` | server | double attempts need remaining-before-dart (`double-attempt.module.ts`); counted per dart, keyed per double the remaining requires (D369) | yes | darts at double, hit rate per double, **favorite double** (best rate above a minimum sample) |
| `checkout-path` | `checkout` | server | route per remaining needs the fold | no | **preferred path by setup shot**: from remaining X, the route taken and how often it finished |
| `bust-rate` | `checkout` | server | bust is a fold outcome; the shared double-out rule only — a ruleset's early-bust forfeit (121's final-visit rule, TUOD's one-dart rule) is not counted (D369) | yes | busts per remaining-score band |
| `leg-stats` | `leg` | server | finished legs need the checkout fold; `v_player_leg_facts` has no winner column and counts lost 1v1 legs and the abandoned final leg as legs, which breaks "darts per leg"/"best leg" (D369) | yes | darts per leg, best leg (with its session, version 2, D397), distribution |
| `ladder-progress` | `ladder` | server | target per attempt is a ladder fold | yes | highest target reached, success rate per target band, recovery after a miss |
| `session-result` | any | sql | rule-free components (`counted_score`, `dart_count`, `turn_count`, min/max per bucket); PB direction per game (`RESULT_DIRECTION`, D367); the best per-session average as a `points`/`darts` pair with its date (`bestAverage`, section version 2, D390) | yes | the session's game-specific result with the personal-best line, where the game's headline is a pure function of the rule-free components |
| `completion` | any | sql | status counts per bucket | yes | abandon rate; where the player quits (progress and score state at quit); "never started" separated |
| `volume` | any | sql | counts and durations | yes | sessions, darts, time; standalone vs routine split |

`Requires: intent-*` is `{ anyOf: ["intent-stored", "intent-derived"] }`
(D370 decision 5) — a section declaring it is offered on both families, and
`SectionMeta.siteByTag` picks `server` for a game carrying `intent-derived`
(Singles Training, Shanghai, Around the Clock) while every `intent-stored`
game (Doubles Training, Bob's 27) keeps the `sql` site from phase 2.
`sectionSite(meta, gameTypeKey)` is the one place that resolves it, read by
both the service dispatcher and the client's chunking choice.

`completion` is the only section with `includesAbandoned = true`.
`session-result`, `completion`, `volume`, `heatmap`, `target-accuracy`,
`confusion`, `grouping`, `miss-direction`, `loose-darts`, `checkout-rate`,
`double-performance`, `checkout-path`, `bust-rate`, `leg-stats`,
`ladder-progress`, `scoring-trend`, `treble-rate`, `shanghai-count`,
`atc-darts-per-target` and `bobs27-survival` are built (phase 1 + 2 + 3 + 4);
every other row above is planned.

## 1.1 Loose darts

A dart with stored intent (Doubles Training, Bob's 27) is classified by where
it lands relative to the intended bed (D368 decision 9):

| Class | Rule |
| ----- | ---- |
| `on-target` | the hit pair equals the intended pair |
| `near-miss` | the same ring in either neighbouring sector (`SECTOR_ORDER`), or the neighbouring ring in the same sector. Ring order: `INNER_SINGLE`, `TREBLE`, `OUTER_SINGLE`, `DOUBLE`. For `INNER_BULL` the near-miss is `OUTER_BULL`, and the reverse |
| `loose` | anywhere else, including `MISS` — off the board |

SQL counts intended × hit cells over `v_stats_dart_facts`; TS classifies each
**aggregated cell** against board geometry (`loose-darts.module.ts`,
`board-geometry.module.ts`'s `SECTOR_ORDER`) — the same geometry the
`isHitOn`/`classify` functions use, never a second copy in SQL. The adjacency
rule is a constant in the section module; changing it bumps the section
`version`.

A dart aimed at a whole number or a bull (`NUMBER`/`BULL`, §1.2) is classified
against the same three classes, adjacency read off the number/bull instead of
a stored zone pair (D370 decision 8):

| Aim | Class | Rule |
| --- | ----- | ---- |
| `NUMBER:n` | `on-target` | `isAimHit` — any ring of `n` except `MISS` |
| `NUMBER:n` | `near-miss` | any ring of a neighbouring number (`SECTOR_ORDER`) |
| `NUMBER:n` | `loose` | anywhere else, bull and `MISS` included |
| `BULL:25` | `on-target` | either bull ring |
| `BULL:25` | `near-miss` | `INNER_SINGLE` of any number |
| `BULL:25` | `loose` | anywhere else |

## 1.2 Derived intent

For `intent-derived` rulesets (Singles Training, Shanghai, Around the Clock)
the aimed target is the engine's own active target immediately before the
dart: each engine exports `activeTargetOf(state, config)`, and its reducer
calls it, so the aim is never a second implementation of "what was this dart
aimed at" (D370 decision 1). The target maps to an aim key:

| Game | `NUMBER` target | `BULL` target |
| ---- | --------------- | ------------- |
| Singles Training (V1–V3) | `NUMBER:n` (any ring) | `BULL:25` (either ring) |
| Shanghai (V1/V2) | `NUMBER:n` | never reached |
| Around the Clock, `segmentRule = ANY` | `NUMBER:n` | `BULL:25` |
| Around the Clock, `segmentRule = OUTER_SINGLE` | `OUTER_SINGLE:n` | `BULL:25` |

For Singles Training every ring on the current number is a valid aim (D367),
unlike Shanghai/Around the Clock where the active number also changes across
the visit. It is recovered by folding the session's facts through the
engine — the same pure engine the play page runs — in the `server` site, over
a bounded range. It is never written back as stored intent.

The fold is single-seat over the owner's own darts (D370 decision 3): every
reducer in scope is per seat (`foldSeatStates`), and `v_stats_dart_facts`
carries only the owner's own darts, so the walker (`foldSeatSteps`,
`derived-aims.module.ts`) builds a one-seat config off the decoded snapshot
with a synthetic seat and never reads the session's stored `seats` — a
seatless historical snapshot folds exactly the same as one that named real
seats. The synthetic seat has the shape of a real solo
seat — `sideKey` `"A"`, as `session.service.ts` seats a solo participant —
so no `sideKey` exists in the fold that a stored seat cannot have (2026-09-30,
issue #633).

A session the fold cannot honestly replay contributes nothing, rather than
being guessed at (D370 decision 4): it is skipped when it has no snapshot, the
snapshot does not decode, its fold row count differs from
`v_stats_session_facts.dart_count` (a dart without coordinates would shift
every later aim), or the reducer throws (a dart fed after a terminal state).
Skips are counted in the result as `skippedSessions`, an optional field on
every server-site `Series` response, so a card can say "N sessions could not
be replayed" rather than silently under-counting.

---

# 2. Game Pages

Order is the page order. Every page also lists its sessions with a link to the
replay route (`02-Replay.md`).

| Game (ruleset family) | Sections |
| --------------------- | -------- |
| **501** | scoring-trend, checkout-rate, double-performance, checkout-path, bust-rate, leg-stats, treble-rate, heatmap, session-result, completion, volume |
| **121** | ladder-progress, checkout-rate, double-performance, checkout-path, bust-rate, heatmap, session-result, completion, volume |
| **Ten Up One Down** | ladder-progress, checkout-rate, double-performance, checkout-path, bust-rate, heatmap, session-result, completion, volume |
| **Score Training** | scoring-trend, treble-rate, heatmap, completion |
| **Singles Training** | `training-result`, target-accuracy (per ring), confusion, miss-direction, loose-darts, heatmap, session-result, completion, volume |
| **Doubles Training** | `training-result`, target-accuracy (per double; favorite and weakest double), confusion, grouping, miss-direction (inside vs outside the wire), loose-darts, heatmap, session-result, completion, volume |
| **Bob's 27** | target-accuracy (per double), `bobs27-survival`, confusion, grouping, miss-direction, loose-darts, heatmap, session-result, completion, volume |
| **Shanghai** | target-accuracy (per number and ring), `shanghai-count`, points-per-round via session-result, confusion, miss-direction, loose-darts, heatmap, completion, volume |
| **Around the Clock** | `atc-darts-per-target`, target-accuracy, confusion, miss-direction, loose-darts, heatmap, session-result, completion, volume |

Score Training renders a dedicated layout on `/statistics` (`ScoreTrainingStatsOverview.astro`) instead of the generic cards: an ordered list of self-fetching section components. Built so far: `scoring-trend` as the score-trend section (reads the page-level Period select Last 30 Days / Last 90 Days / Last Year / All Time, shared by every section, D386; period 3-dart and first-nine averages with percent change vs the preceding equal period; no band counts), plus a "Personal best" card (the cards are square glass; grid rows: 3-dart average, first nine / personal best, session result, D404): the highest single-session 3-dart average and the date it was set, from one all-time un-bucketed `session-result` request made on mount only — a per-session ratio, so a 5-minute and a 100-visit session compare fairly (D390). First nine is the owner's first three visits of each `LEG` or `EXERCISE_BLOCK` stage. `heatmap` as the heatmap section (`GameHeatmapSection.astro`): one un-bucketed request over the period's current span only (the trend's boundary to now; all time from the trend's all-time start), no target, rendered as a density layer — radial stamps per 5 mm cell accumulated on a canvas and recoloured blue→green→yellow→red — through `StatsDensityHeatmap.astro` rather than the per-cell squares of `StatsHeatmap.astro` (D387). `treble-rate` is not rendered on Score Training (D404). Score Training has no `session-result` section: sessions differ in length and mode, so a mean score across them says nothing (D402). `completion` as the session-result doughnut (`ScoreCompletionSection.astro`, a `Chart.astro` doughnut): a square glass card in the overview's 2x2 grid with a thick ring (cutout 34%, D402), of completed (green) against abandoned (red) games, with the abandon rate as abandoned over started; never-started sessions are never shown or counted (D401). `volume` has no Score Training section (D401). The replay list is its own section (`scoreSessionList()`): completed sessions only, 10 per page with previous/next over the current period, each a card like the game cards with a play icon linking to its replay, inside a glass container (`ReplayCard.astro`, reusable across statistics pages, D401). Dartless sessions are left out of the list (D405). Page order: 2x2 grid (averages, personal best, completion), scoring-trend chart, heatmap, replay. Temporarily, the Routines tab and every game not named below show a placeholder on `/statistics` (D385). 501, 121, Ten Up One Down, Singles Training, Shanghai and Around the Clock render the plain heatmap alone (`HeatmapStatsOverview.astro`, `HEATMAP_ONLY_LAYOUTS`, D406): the same `GameHeatmapSection` as Score Training, resolved from the page-level game and period, with no `target`. Doubles Training and Bob's 27 stay on the placeholder until their target picker lands; Singles, Shanghai and Around the Clock get no per-target heatmap, since their aim is derived and `target` is rejected there.

X01 and Score Training carry no `grouping`/`miss-direction`/`loose-darts`: they
store no intent (`00-Overview.md` §3). Singles Training, Shanghai and Around
the Clock carry `miss-direction`/`loose-darts`/`target-accuracy`/`confusion`
(derived, `server`) but never `grouping`: a whole-number aim has no aim
point, so a spread around the wedge measures ring choice, not skill (D370
decision 6).

## 2.1 Game-specific sections

`SectionMeta.games` gates each of these to exactly the named game(s), on top
of its tags (D370 decision 10); `PAGE_ORDER_OVERRIDES` places `shanghai-count`
and `session-result` in Shanghai's page order (decision 11).

| Section | Game | Site | Reason for site | Insight |
| ------- | ---- | ---- | ---------------- | ------- |
| `bobs27-survival` | Bob's 27 | server | resolved-visit fold over `doublesPath()`, grouped by config | the double where runs die; running-score curve per session |
| `shanghai-count` | Shanghai | server | a Shanghai is S+D+T of the *active* number in one visit, and the active number is itself a fold — a SQL pattern over three darts would risk counting the wrong number (D370 decision 12) | Shanghai (S+D+T in one round) frequency per bucket |
| `atc-darts-per-target` | Around the Clock | server | darts-per-target needs the fold's own clear/lap/`COMPLETE` transitions | darts needed per target; slowest targets |
| `training-result` | Singles Training, Doubles Training | server | the headline (training points, doubles hit) is a fold outcome, not a sum of `turns.total_score`; board-captured sessions only, as for every dart fold (D396) | best, mean and session count per config group; the personal best |

Metrics (all additive; grouped by `configGroupKey`, D370 decision 13):

- **`shanghai-count`**: `{ sessions, shanghais, byRound: Record<round, count> }`
  per bucket. `configSensitive: []` — Shanghai V1/V2 pool (Hard mode changes
  scoring, not the Shanghai rule).
- **`training-result`**: `Record<configGroupKey, { sessions, total, best }>`.
  The headline is the last fold step's `totalPoints` (Singles Training) or the
  count of hit visits (Doubles Training); `sessions`/`total` sum and `best`
  takes the max, so the mean (`total / sessions`) is derived client-side and
  higher is better for both games. `configSensitive: ["ruleset_version_key",
  "difficulty", "scoring_mode"]` — Hard/Extreme and Accuracy runs never blend
  into one personal best (D396).
- **`atc-darts-per-target`**: `Record<configGroupKey, Record<TargetKey, {
  darts, cleared }>>`. A dart counts against the aim before it; a target
  *clears* when the fold moves past it (next path index, a lap, or
  `COMPLETE` — a V2 step-back is not a clear). Darts on a target never
  cleared stay in `darts`, the true cost of that target. Darts per target is
  `darts / cleared`, derived client-side. `configSensitive:
  ["ruleset_version_key", "difficulty", "segment_rule"]`.
- **`bobs27-survival`**: `Record<configGroupKey, { runs, completed,
  reached: Record<TargetKey, runs>, died: Record<TargetKey, runs>,
  scoreAfter: Record<TargetKey, { runs, sum, min, max }> }>`. `reached`/`died`
  are counted at the target whose visit resolved (`died` only when the seat
  status is `LOST`); `scoreAfter` is the score once that visit resolved.
  `completed` counts a session whose last step's seat status is `WON`.
  `configSensitive: ["ruleset_version_key", "start_score",
  "miss_penalty_multiplier", "bull_hit_value"]`.

## 2.2 Ruleset versions

Versions that change scoring or difficulty (Singles V1–V3, Shanghai V1/V2, 121
V1/V2, Around the Clock V1/V2) put `ruleset_version_key` in `configSensitive`:
results are grouped or filtered per version, never blended. `configSensitive`
governs **result-shaped** sections — `session-result` and `ladder-progress`,
whose headline result depends on which version's rules produced it (D369).
The checkout family, `scoring-trend`, `treble-rate` and `leg-stats` are
**fact-shaped**: a dart at remaining 32 or a landed treble is the same fact
under any ruleset version, so those sections pool versions instead (D369
decision 9).

---

# 3. Routine Sections

The Routines tab's own registry, `ROUTINE_SECTIONS`
(`lib/stats/section-registry.ts`, D372 decision 6), sits beside `SECTIONS`.
An entry is a `RoutineSectionMeta`: `SectionMeta`'s fields, with `id` a
`RoutineSectionId` (disjoint from the game-only `SectionId`), `requires: []`
(no tag gates one) and `surface` (`routine` or `step`). A response is a
`RoutineSeries<M>`: `Series<M>` with that `sectionId`.

| Section | Surface | Site | Reason for site | Bucketable | `includesAbandoned` | Metrics |
| ------- | ------- | ---- | --------------- | ---------- | ------------------- | ------- |
| `routine-volume` | routine | sql | counts, duration sums and extremes per bucket | yes | no | `runs`, `durationSeconds`, `minDurationSeconds`, `maxDurationSeconds`, `darts` |
| `routine-completion` | routine | sql | status counts per bucket | yes | yes | `completed`, `abandoned`, `neverStarted`, `stepsCompletedAtAbandon: Record<n, runs>` |
| `step-volume` | step | sql | counts and durations; non-game steps only (a GAME step's own `volume` covers it) | yes | no | `sessions`, `durationSeconds`, `darts` |
| `step-result` | step | server | per-kind metrics need the exercise engine's fold (§3.1); non-game dart steps only | yes | no | `metrics`, `headlineMin`, `headlineMax`, `sessions`, `skippedSessions` |

- Runs bucket by the activity's `completed_at`, step sections by the
  session's.
- A run with no step session is "never started" (`00-Overview.md` §9): it
  counts in `neverStarted`, not `abandoned`, and stays out of
  `stepsCompletedAtAbandon`, which counts started abandons only.
- Durations are whole seconds on the wire: a minutes float does not re-add
  exactly across chunks (`00-Overview.md` §5.1). The client converts.
- **Page lists:** a routine shows `routine-volume`, `routine-completion`
  (`sectionsForRoutine()`). A step's list is `sectionsForStep(step)`: a GAME
  step shows exactly `sectionsForGame(gameTypeKey)` — its game's own
  `volume` covers the step, so `step-volume` is not added; a non-game step
  whose exercise type is a dart exercise kind shows `step-result`,
  `step-volume`; any other non-game step shows `step-volume` only. Warm-Up
  throws no darts, so it gets `step-volume` only; it is told apart by its
  exercise type, not its input mode.

## 3.1 Step result

`STEP_METRIC_SPECS: Record<DartExerciseKind, StepMetricSpec>`
(`modules/stats/step-metrics.module.ts`, D372 decision 7) is the one
definition of each kind's metrics: their keys, their merge (`sum` or `max`),
the headline and its direction, and the rate pairs the client divides.

| Kind | Metrics (merge) | Headline | Rates |
| ---- | --------------- | -------- | ----- |
| SWITCHING | points, darts, hits (sum) | points ↑ | hits/darts |
| DOUBLE_PATTERN | hits, darts (sum) | hits ↑ | hits/darts |
| TARGET_SCORING | bestChain (max); darts, hits (sum) | bestChain ↑ | hits/darts |
| SWITCHING_TARGET_SCORING | bestChain (max); sequences, darts, hits (sum) | bestChain ↑ | hits/darts |
| SCORE_THRESHOLD | beats, visits, darts (sum) | beats ↑ | beats/visits |
| BULLSEYE_CHECKOUT | checkouts, visits, darts (sum) | checkouts ↑ | checkouts/visits |
| BULL_UP | throws, bullseyes, bulls (sum) | bullseyes ↑ | bullseyes/throws, bulls/throws |

- `stepMetrics(kind, state, facts)` reads engine state the way the routine
  summary modal does: `routine-summary.module.ts`'s `summarise*` functions
  run on it, so the modal and the statistics page cannot disagree.
  Switching's hits come from the same fact walk.
- The fold runs on the server (`step-result.module.ts`). `findStepFoldRows`
  reads `v_game_replay` joined to the step's sessions, each row tagged with
  the bucket its session's `completed_at` falls in. Per session:
  `stageOrder`, `rowsToTurns` and `replayFacts`
  (`modules/stats/replay.module.ts`), then the engine from
  `getDartExerciseEngineFactory(exerciseRulesetVersionKey)`, built with
  `create(configuration, facts)` over the session's own snapshot, its
  `state()` read by `stepMetrics`.
- It is bounded like any `server` section: `MAX_FOLD_DARTS` over the step's
  scoped `dart_count` (`findStepScopeDartCount`) before any fold row is read,
  fetched in client chunk windows (`00-Overview.md` §4).
- A session with no registered engine, whose engine throws (its own
  configuration decode included), or whose state lacks the kind's fields is
  skipped and counted in `skippedSessions`, never guessed.
- Per bucket: the merged metrics, plus `headlineMin`/`headlineMax` of the
  headline per session. Chunks re-aggregate exactly through
  `mergeStepResult`: metrics by their spec, extremes by `min`/`max` with
  `null` as the identity, session counts summed.

---

# 4. Deferred

- **Career-wide doubles:** Doubles Training, Bob's 27 and X01 checkout darts
  measure one skill; a combined career section is additive later.
- **Recreational-mode sections** (`QUICK_SCORE`, `DETAILED_DARTS`).
- **Dart-level sections for non-game steps** (heat map, per-target
  accuracy): they need a non-game dart fact view, which is additive later
  (D372 decision 13). Comparisons across routines and adaptive-training
  statistics are deferred too.
