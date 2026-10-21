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
- Approach A for zone-class targets: `BoardTarget` gains number-less kinds
  (§2.1). Rejected: widening `TrackRules.target` to a generic type (touches the
  kernel and every engine).

## 2. Shared additions

### 2.1 `BoardTarget` ANY_DOUBLE / ANY_TREBLE (T2.1)

`BoardTarget` gains `{ kind: "ANY_DOUBLE" }` and `{ kind: "ANY_TREBLE" }`.
`isHitOn`: ANY_DOUBLE = zone `DOUBLE` on any number **or** `INNER_BULL`;
ANY_TREBLE = zone `TREBLE` on any number. `sectionOf` and every exhaustive
switch over the union handle them. Existing callers never build them, so
shipped behaviour is unchanged; their goldens prove it.

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
| Halve-It | `HALVE_IT_PATH`: 20, 16, ANY_DOUBLE, 17, 18, ANY_TREBLE, 19, 20, BULL | NUMBER / BULL: `anyRingEitherBull`; ANY_*: `isHitOn` | `boardScorePoints` on hit | — | `halveOnBlank` → advance → `passOnWrap(8)` | `closeAfter(3)` | `passes`, `halvings` | timer only |
| Doubles S&L | `doublesPath` D1→D20, BULL (inner) | `isHitOn` | 0 | — | `finishOnHits(3, 20)` → `moveTable({0:-2,1:-1,2:0,3:1})` | `closeAfter(3)` | `highestIndex` | `DONE` on finish, else timer |
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
- Routine-stats integration fixture: Halve-It step 15, Doubles S&L step 16
  (itest step count rises by one each).

## 8. Decision entry

None planned: zone-class targets follow the T1 TREBLE addition; ATC V3
follows D243's version-not-widen rule. If a plan needs one, the id comes from
`bash scripts/next-decision-id.sh`, re-run before each PR.

## 9. Out of scope

- Every V2+ / Deferred rules-file row (Halve-It multiplayer, start total 40,
  Count-Up lists, Double Down; S&L singles/trebles, adjusted par,
  head-to-head; Nine Lives multiplayer, other lives counts, Grand National).
- Standalone exercise entry.
- Schema changes (none needed).
- Wave T3.

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| ANY_* kinds alter shipped judging | additive union cases; phase-1 and T1 goldens re-run |
| ATC V3 leaks into V1/V2 sessions | V1/V2 keys, schemas and factories untouched; V2-through-V3 replay test |
| `moveTable` index off by one at the bull level | boundary tests at D20 ↔ bull and the D1 floor |
| Nine Lives card bypasses the seat cap | V3 seat check refuses 2 seats with lives set; test |
