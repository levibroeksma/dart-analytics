# Track Wave T2 — Design

Date: 2026-10-21. Parent spec: `2026-10-17-track-kernel-design.md` (§8 Phase 2, wave T2).
Model: `2026-10-17-track-wave-t1-design.md` (shared helpers, touch-lists, testing).
Rules (closed 2026-10-21, branch `docs/track-t2-rules`, commit c9a6471):
`docs/game-rules/training/exercises/halve-it.md`,
`docs/game-rules/training/exercises/doubles-snakes-and-ladders.md`,
`docs/game-rules/rulesets/nine-lives.md`,
`docs/game-rules/rulesets/around-the-clock.md` (Nine Lives row).

## 1. Goal

Ship three new playable V1s on the Track kernel, one PR each, each end to end:

| PR | Subject | Execution model | Entry point |
| --- | --- | --- | --- |
| T2.1 | Halve-It | exercise | routine step |
| T2.2 | Doubles Snakes & Ladders | exercise | routine step |
| T2.3 | Nine Lives | game (Around the Clock V3) | standalone |

### Decided (2026-10-21)

- Rules rulings: Halve-It halves rounding up (95 → 48), the bullseye counts in
  Any double, the list repeats (pass) until time ends with the total carried,
  and it stays an exercise. Doubles S&L uses the same move table at the bull
  level; a run cut by time reports highest level + rounds; pressure SETBACK.
  Nine Lives keeps the literal life rule (any hit in a visit saves the life),
  ships as an Around the Clock setting (single seat; path settings combine;
  Easy, untimed), pressure LIVES (new `TAGS.md` key).
- Nine Lives entry: its own CLASSICS card opening ATC setup with lives on,
  plus a Lives toggle on the ATC setup form.
- PR order: Halve-It, Doubles S&L, Nine Lives (the shipped game with live data
  last). Stack cap: one branch on another at most.
- Seed per engine PR, as T1.
- No new duplication (user, 2026-10-21): every piece reuses an existing
  component or helper (§2.0); where T1 left copy-paste the new subject would
  extend, T2.1 extracts the shared piece first. Reuse audit 2026-10-21.
- Nine Lives card shows Around the Clock's tags and difficulty (cards are
  keyed by game type, `pages/games/index.astro:58-65`); card-level tags are
  discovered work.
- Zone-class targets live in a separate `ZoneTarget` type (§2.1), reached
  through a defaulted `TTarget` parameter on `TrackRules`. Rejected: widening
  `BoardTarget` (33 type errors in 20 files, 12 in append-only tests).

## 2. Shared additions

### 2.0 Reuse prep (T2.1, first commit, no behaviour change)

Extractions that stop the 13th/14th copies of T1 boilerplate:

| Extraction | Replaces | Where |
| --- | --- | --- |
| `dartExerciseAdapter({ key, headerLabel, title, panel, rulesetKey, slot, engineClass, summarise })`, mirroring `gameAdapter` (`adapters/game.adapter.ts:69`) | 11 near-identical exercise adapters (e.g. `hit-count.adapter.ts`, `doubles-lock.adapter.ts`, differ only in names) | `lib/training/routines/adapters/` |
| `expireTimer` / `onComplete` loop over `DART_ENGINE_RECORDERS` slots | per-engine lists in `routine-play.data.ts` (recorders 106-119, `expireTimer` 714-725) and identical timer-only `record*Dart` bodies | `routine-play.data.ts` |
| `targetLabelOf(target?)`, `rateOf(hits, darts)` | the repeated `x === undefined ? "" : boardTargetLabel(x)` getters and hit-rate getters | `routine-play.data.ts` helpers |
| `EmptyV1Config` (`z.object({}).strict()`) | three copies in `lib/training/exercises/rulesets/types.ts` (222, 292, 303) | same file; T1 configs alias it |
| one `ExerciseTypeKeyEnum` | the same `z.enum` twice in `pages/api/training-sessions/types.ts` (10-24, 52-66) | same file |

Existing shared pieces the new exercises use as-is: `trackExerciseSpec`,
`makeConfigValidator`, `doublesPath()`, `doubleTargetIntent`,
`ExercisePanelShell` (+ `RouteChips`, `windowPage`/`windowIndex`),
`accuracyDisplay`, `hitRateRow` / `NO_VALUE` / `stepMetrics`,
`judgeIntendedBed`, `hitCountCaptions`, the generic `STEP_REPLAY_PRESENTERS`.
Each exercise also lands in `DART_WRITING_RULESET_VERSION_KEYS`
(`services/exercise-rulesets/registry.ts:46-59`), missing from T1 §6's list.

### 2.1 `ZoneTarget` ANY_DOUBLE / ANY_TREBLE (T2.1)

`ZoneTarget = { kind: "ANY_DOUBLE" } | { kind: "ANY_TREBLE" }` and
`TrackTarget = BoardTarget | ZoneTarget`. `BoardTarget` is unchanged.
`TrackRules`, `JudgedDart`, `applyTrackDart` / `foldTrackSeats` /
`foldTrackDarts`, `TrackExerciseDefinition` and `trackExerciseSpec` gain
`TTarget extends TrackTarget = BoardTarget`; the default leaves every
existing engine and test untouched. `isHitOn`, `boardTargetLabel`,
`targetAt`, `pathTarget`, `anyRingEitherBull`, `tallyOnTarget` and
`boardScorePoints` accept `TrackTarget`. `isHitOn`: ANY_DOUBLE = zone
`DOUBLE` on any number **or** `INNER_BULL`; ANY_TREBLE = zone `TREBLE` on any
number. Labels "Any double", "Any treble". `sectionOf` and `pointsTable` stay
`BoardTarget`. The test helper `observationOn` handles zones. Decision D478.

### 2.2 Policies (each with its first caller, D468)

| Policy | Kind | First caller | Behaviour |
| --- | --- | --- | --- |
| `halveOnBlank` (exists) | onVisitClose | Halve-It | reused unchanged: `Math.round(score / 2)` on a blank visit = rounds half up |
| `moveTable(table)` | onVisitClose | Doubles S&L | `targetIndex += table[hitsThisVisit]`, floor 0, cap at last index; `ext.highestIndex = max` |
| `finishOnHits(n, index)` | onVisitClose | Doubles S&L | at `index` with `hitsThisVisit ≥ n`: status `DONE` (runs before `moveTable`) |
| `loseLifeOnBlank` | onVisitClose | Nine Lives | `hitsThisVisit === 0`: `ext.lives - 1`; at 0, status `OUT` |

Halve-It's pass wrap is `passOnWrap(8)` after the advance; `score` (the
total) is not reset by the wrap.

## 3. Kernel-config rows

| Subject | path | hit | points | onDart | onVisitClose | visitOpen | ext | outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Halve-It | `HALVE_IT_PATH`: 20, 16, ANY_DOUBLE, 17, 18, ANY_TREBLE, 19, 20, BULL | NUMBER / BULL: `anyRingEitherBull`; ANY_*: `isHitOn` | `boardScorePoints` on hit | `tallyOnTarget` | engine-local `countHalving` → `halveOnBlank` → `advanceAfterDarts(3)` → `passOnWrap(8)` (Hit Count's shape) | `closeAfter(3)` | `TargetTallyExt` + `passes`, `halvings` | timer only |
| Doubles S&L | `doublesPath()` D1→D20, BULL (inner) | `isHitOn` | `noPoints` | `tallyOnTarget` | `finishOnHits(3, 20)` → `moveTable({0:-2,1:-1,2:0,3:1})` | `closeAfter(3)` | `TargetTallyExt` + `highestIndex` | `DONE` on finish, else timer |
| Nine Lives | ATC V2 path (direction, odds first) | ATC V2 segment rule, Easy | 0 | ATC Easy advance | `loseLifeOnBlank` | ATC | ATC ext + `lives` | single seat: `COMPLETE` on bull or `OUT` |

Halve-It: type `HALVE_IT`, ruleset `HALVE_IT_V1`; config the empty strict
object `{}` (list and start total locked in V1). Path is an engine constant.

Doubles S&L: type `DOUBLES_SNAKES_LADDERS`, ruleset `DOUBLES_SNAKES_LADDERS_V1`
(not the rules file's proposed `HIT_COUNT_LADDER`); config `{}`. Move table
and finish are engine constants `DOUBLES_SL_MOVES`, `DOUBLES_SL_FINISH = 3`.

Nine Lives: ruleset `AROUND_THE_CLOCK_V3` on game type `AROUND_THE_CLOCK`.
V3 config = V2 fields + `lives: z.literal(3).nullable()`; `superRefine`:
`lives` set ⇒ `difficulty` EASY and `duration_type` UNTIMED. Seat count 1
when lives are set is enforced by the session-seat check for V3 (cap 2
otherwise, as V2). V1 and V2 snapshots and engines are untouched (D243:
live data). With `lives: null`, V3 plays exactly as V2.

## 4. Readouts (projections)

| Subject | State fields |
| --- | --- |
| Halve-It | `currentTarget` (`BoardTarget`), `round` (1–9), `total`, `passes`, `halvings`, `hits`, `dartsThrown`, `status` |
| Doubles S&L | `currentLevel` (`BoardTarget`), `levelIndex`, `highestLevel`, `rounds`, `finished`, `hits`, `dartsThrown`, `status` |
| Nine Lives | ATC fields + `lives`, `out` (bool); result adds lives left and, when out, the target stood on |

Every field is derived from the fold; nothing is stored (Hard Invariant).
`hits` = sum of `ext.hitsPerTarget` from the fold for both exercises — never
from intent (Halve-It's NUMBER/BULL intent is null, so an intent compare
would count an off-board dart as a hit), and not via a copy of Doubles Lock's
private `onIntendedDouble` (it misses the bull level).

UI and stats, all on existing pieces:

| Piece | Halve-It | Doubles S&L |
| --- | --- | --- |
| Panel | `ExercisePanelShell`: score `TOTAL`, route chip of the 9 targets (Switching's `windowPage` pattern), tiles Round, Pass, Rate | `ExercisePanelShell`: score `LEVEL`, ladder chip, tiles Highest, Rounds, Rate |
| Preview judge | new family judging each visit against `HALVE_IT_PATH[visitIndex % 9]` with `isHitOn`/`anyRingEitherBull`; `judgeExerciseDart` gains the visit index (small signature change) | `hitCount` family (`judgeIntendedBed`), **not** `judgeDouble` (scores a bullseye as a miss); captions `hitCountCaptions` |
| Summary | `hitRateRow`, per-target rows as `summariseHitCount` | `hitRateRow`; Highest level, Rounds, Finished |
| Step metrics | `{ points, halvings, darts, hits }`, headline `points` higher | `{ highestLevel: "max", rounds, finishes, darts, hits }`, headline `highestLevel` higher |
| Recorder | timer-only (shared loop, §2.0) | completes on `isComplete()`, the `checkoutSequence` branch (`routine-play.data.ts:800-806`) |

## 5. Persistence (named before implementation)

| Subject | Capture / input | Stage | turns / darts |
| --- | --- | --- | --- |
| Halve-It, Doubles S&L | analytics, `ANALYTICS` + `VISUAL_BOARD` | one `EXERCISE_BLOCK` per run | one `turns` row per visit; one `darts` row per throw, intended target/zone from `intent`, hit number/zone, board `score` |
| Nine Lives | as ATC (`DETAILED_DARTS` and `VISUAL_BOARD`) | one `EXERCISE_BLOCK` per seat (`PER_SEAT`) | as ATC; lives are folded, never stored |

Intent: Halve-It NUMBER / BULL → none (both null; any ring scores); ANY_DOUBLE
→ number null, zone `DOUBLE`; ANY_TREBLE → number null, zone `TREBLE`
(`chk_dart_target_consistency` admits a zone without a number). Doubles S&L →
`doubleTargetIntent` (number + `DOUBLE`, or 25 + `INNER_BULL`). Nine Lives →
`NO_INTENT`, as ATC. No schema change.

## 6. Touch-lists

### Exercise PRs (T2.1, T2.2)

As T1 §6 "Exercise PR", via `trackExerciseSpec`. Seeds
`database/seeds/00NN_<name>_exercise_type.sql` + verification SQL; tags from
the rules file via `npm run tags:generate` (seed 0042) once the rules file's
`Current version:` flips to V1.

### Nine Lives PR (T2.3)

Reuse, no fork: `AroundTheClockSetupForm.astro` gains a Lives `Switch` like
Odds first, inside the no-guest block, hiding difficulty and duration while
on; `around-the-clock-setup.data.ts` `rulesetVersionKey` returns V3 **only
when lives are on** (V2 otherwise) and `addGuest`/`addBot` turn lives off;
`interfaces/AroundTheClock.astro` adds a Lives tile via `showWhen`;
`AroundTheClockResults.astro` adds a `LIVES_ROWS` variant via `x-if` (as
`TIMED_ROWS`), reusing `targetAtEnd` for "out on". The card preset uses a new
**generic** `setupPresetFromLocation` in `lib/game/setup-controller.ts`
(pattern: `lib/training/routines/routine-route.ts`), not ATC-only code; no
card carries a query today.

ATC engine: V3 key in `rulesetVersionKeys`, `keyOf` reads `lives`; V3 Zod
config + `RULESET_CONFIGS`; capabilities rows for V3 (seed 0007 parity and
its verification counts); validator; setup form Lives toggle; new
`games-visibility.ts` CLASSICS card "Nine Lives" (ATC setup with `lives=3`
preset); ATC interface lives readout; results modal lives row; stats replay
presenter and progress for V3; seed `00NN_around_the_clock_v3_ruleset.sql`
(ruleset version + capability rows) + verification; `nine-lives.md`
`Current version:` → V1 and ATC `Current version:` → V3; tag seed
regenerated; docs. `check-game-wiring.sh` must pass.

Seed numbers are fixed at plan time from what has landed (next free today:
0047).

## 7. Testing

As T1 §7. Per PR: TDD per policy (RED → GREEN) with two mutation checks each;
engine tests over the rules files' worked examples; undo inverse of record;
aimed goldens; existing goldens re-run unchanged (BoardTarget additions are
additive). Boundary cases:

- Halve-It: blank visit on an odd total (95 → 48); halving at 0; bullseye in
  Any double scores 50; outer bull in Any double is a blank; pass 2 starts at
  20 with the total carried.
- Doubles S&L: 0 hits at D1 and D2 (floor); 3 hits at D20 → bull level;
  0 hits at the bull level → D19; 3 bullseyes → `DONE`; highest level after a
  slide.
- Nine Lives: hit on dart 1 then two misses keeps the life; third blank visit
  → `OUT` with darts refused; bull hit with lives left → `COMPLETE`; V2
  snapshot replays identically through the V3 engine path with `lives: null`;
  V3 config refuses lives with HARD or timed.
- Duplication: `npx fallow dupes --mode semantic --min-tokens 30` on the
  touched files before and after each PR; clone groups must not rise. The
  fallow gate cannot catch it (`.fallowrc.jsonc` sets no duplicate
  threshold; default mode flags none of the T1 copies).
- Routine-stats integration fixture: Halve-It step 15, Doubles S&L step 16
  (itest step count rises by one each).

## 8. Decision entry

D478 (T2.1): zone targets via the defaulted `TTarget` parameter. ATC V3
follows D243's version-not-widen rule. If a plan needs another, the id comes from
`bash scripts/next-decision-id.sh`, re-run before each PR.

## 9. Out of scope

- Every V2+ / Deferred rules-file row (Halve-It multiplayer, start total 40,
  Count-Up lists, Double Down; S&L singles/trebles, adjusted par,
  head-to-head; Nine Lives multiplayer, other lives counts, Grand National).
- Standalone exercise entry.
- Schema changes (none needed).
- Wave T3.
- Folded into T2.1 by user approval: #1048 (`stepMetrics` field map), #1049
  (one parameterised seed-verification SQL), #1050 (engine-tail helper).
  Still discovered work, owned by T2.3: #1051 card-level tags.

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| ANY_* kinds alter shipped judging | additive union cases; phase-1 and T1 goldens re-run |
| ATC V3 leaks into V1/V2 sessions | V1/V2 keys, schemas and factories untouched; V2-through-V3 replay test |
| `moveTable` index off by one at the bull level | boundary tests at D20 ↔ bull and the D1 floor |
| Nine Lives card bypasses the seat cap | V3 seat check refuses 2 seats with lives set; test |

## 11. T2.1 plan refinements (2026-10-21)

Detail in `docs/superpowers/plans/2026-10-21-track-t2-halve-it.md`:

- Halve-It's hit is `anyRingEitherBull` alone; it defers zones to `isHitOn`.
- `rateOf` is the existing `checkoutPercentageDisplay`; `targetLabelOf` stays
  local to `routine-play.data.ts`.
- `dartExerciseAdapter` lives in `adapters/dart-exercise.adapter.ts`; the
  per-kind adapter files stay as one call each. `record…Dart` methods are
  generated from `DART_ENGINE_RECORDERS`; `COMPLETES_ON_DART` replaces the
  hand-written completion branch.
- `HALVE_IT_V1` validates through `makeConfigValidator(HalveItV1Config)`
  inline in the registry.
- `0042_catalog_tags.sql` runs before `0047`; the tag generator skips a type
  not yet seeded (`WHERE v.exercise_type_id IS NOT NULL`) and the second seed
  pass links it.
- `HalveItState` adds `targetIndex` and `hitsPerTarget`; `halvings` counts
  every blank visit.
- `judgeDart(family, dart, visitIndex)`; the `halveIt` family judges against
  `HALVE_IT_PATH[visitIndex % 9]`.
- Route chip parts use a no-break space.
- Integration fixture: Halve-It is step 15.

## 12. T2.2 plan refinements (2026-10-22)

Detail in `docs/superpowers/plans/2026-10-22-track-t2-snakes-ladders.md`:

- Finish needs a shell hook: `DartExerciseSpec` and `TrackExerciseDefinition`
  gain optional `ends?(state)`; the shell's `isComplete()` and `record()`
  honour it (D479). `snakesLaddersEngine` joins `COMPLETES_ON_DART`.
- `moveTable(table, lastIndex)` and `finishOnHits(hits, index)` over
  `LadderTrackExt = { highestIndex }`; the engine composes
  `move(finish(seat))`. `stepBackBelowHits` stays untouched.
- `SnakesLaddersState`: `currentLevel`, `levelIndex`, `highestLevel`,
  `highestLevelNumber` (1-21), `rounds` (closed visits), `finishes` (0/1),
  `hits`, `dartsThrown`, `status`. No per-level rows.
- Preview reuses the `hitCount` family; no new family.
- Reuse prep: `tallyTotals`, `hitRateOf`, `routeChipsOf`, and a label-getter
  table replace inline copies.
- Stats: `highestLevel` max; `rounds`, `finishes`, `darts`, `hits` sum;
  headline `highestLevel`. Integration fixture: S&L is step 16.
- Rules file flips to V1; type `DOUBLES_SNAKES_LADDERS`, ruleset
  `DOUBLES_SNAKES_LADDERS_V1`, seed `0048`; no new tag key, ids do not shift.
