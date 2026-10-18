# Track Wave T1 — Design

Date: 2026-10-17. Parent spec: `2026-10-17-track-kernel-design.md` (§8 Phase 2, wave T1).
Rules (closed 2026-10-17, branch `docs/track-t1-rules`):
`docs/game-rules/training/exercises/hit-count.md`, `switchblade.md`,
`doubles-lock.md`, `docs/game-rules/rulesets/baseball-darts.md`.

## 1. Goal

Ship four new playable V1s on the Track kernel, one PR each, each end to end
(engine, seed, validator, routine/game wiring, stats, docs):

| PR | Subject | Execution model | Entry point |
| --- | --- | --- | --- |
| T1.1 | Hit Count | exercise | routine step |
| T1.2 | SwitchBlade | exercise | routine step |
| T1.3 | Doubles Lock | exercise | routine step |
| T1.4 | Baseball Darts | game | standalone |

### Decided in brainstorming (2026-10-17)

- Rules rulings: the three exercises repeat their list/path (**pass**) until
  routine time ends; Doubles Lock retreats to D20 before any lock and pays the
  bonus on every lock; Hit Count V1 darts-per-target is a multiple of three.
- Each subject is its own type (no merges into Switching, 170 Practice,
  Doubles S&L or Shanghai).
- One wave spec, one PR per engine, merged in order (stack cap: one branch on
  another at most).
- Seeds: one seed file per engine PR, not one per wave (refines parent §8
  "One seed file … per wave"); each PR ships a playable type.
- Approach A: a `trackExerciseSpec` helper lands in T1.1 (the third Track
  exercise reopens parent §3's PR-7 deferral). Target Scoring and Switching
  Target Scoring are not retrofitted in this wave.

## 2. Shared additions

### 2.1 `trackExerciseSpec` (T1.1)

`app/src/modules/training/exercises/track-exercise-spec.module.ts`:

```ts
trackExerciseSpec<TConfig, TExt, TState>({
  exerciseRulesetVersionKey,
  parse(raw): TConfig,
  rules(config): TrackRules<TExt>,
  initialExt(config): TExt,
  project(seat: TrackSeat<TExt>, config, expired: boolean, facts): TState,
  intent(state: TState, config): DartIntent,
}): DartExerciseSpec<TConfig, TState>
```

Its `fold` is `project(foldTrackDarts(turns, initialTrackSeat(SOLO, initialExt(config), rules.startScore), rules(config)), config, expired, facts)`
(`facts` lets the projection count darts thrown without a dart counter in ext); `isVisitOpen(turn)` is
`turn.darts.length < 3` (all three exercises close visits at three darts,
`closeAfter(3)`). It returns a plain `DartExerciseSpec`, bound with the existing
`dartExerciseEngineClass` / `dartExerciseEngineFactory`. No shell change.
`scripts/check-engine-kernels.sh` accepts `<kernel>-exercise-spec.module` as
the binding import for a KERNEL_BOUND engine (refined 2026-10-17, T1.1 plan).

### 2.2 `BoardTarget` TREBLE (T1.1)

`BoardTarget` gains `{ kind: "TREBLE"; number: number }`. `isHitOn`,
`sectionOf` and every exhaustive switch over the union handle it (a treble
hit is zone `TREBLE` on the number). Existing callers never build it, so
shipped behaviour is unchanged; their goldens prove it.

### 2.3 Policies (each with its first caller, D468)

| Policy | Kind | First caller | Behaviour |
| --- | --- | --- | --- |
| `tallyOnTarget` | onDart | Hit Count | `ext.dartsOnTarget + 1`; on a hit, `ext.hitsPerTarget[targetIndex] + 1` |
| `advanceAfterDarts(n)` | onVisitClose | Hit Count | advance once `n` darts were thrown at the target (`ext.dartsOnTarget`) |
| `passOnWrap(lastIndex)` | onVisitClose / onDart | Hit Count | past `lastIndex`: index 0, `ext.passes + 1` (generalises `lapOnWrap`; both share a private `wrapToStart(lastIndex, bump)`, ATC behaviour unchanged) |
| `advanceEveryDart` | onDart | SwitchBlade | `targetIndex + 1` per dart |
| `tallyRoundPoints(dartsPerRound)` | onDart | SwitchBlade | `ext.roundTotals[floor(targetIndex / dartsPerRound)] += points` (before the advance) |
| `lockCheckpoint(bonus)` | onVisitClose | Doubles Lock | `bonus[hits]` defined: lock, bonus to `score`, advance; else hits > 0: advance; 0: index = `ext.lastLock ?? 0` (`{2:50,3:100}` = hits ≥ 2; `LockTrackExt = { lastLock: index \| null; locks }`) |

Doubles Lock's pass wrap also clears `lastLock` and appends the pass's darts
to `ext.dartsPerPass`; it composes `passOnWrap` with its own ext reset.
Refined (T1.3 plan, approved 2026-10-18): ext gains `dartsThisPass`; engine-local
`tallyPassDarts` adds `dartsThisVisit` at visit close (the kernel resets visit
counters after `onVisitClose`), and engine-local `closePass(19)` runs
`passOnWrap(19)` then appends `dartsThisPass` to `dartsPerPass`, zeroes it and
clears `lastLock`. onVisitClose = `closePass ∘ lockCheckpoint ∘ tallyPassDarts`.

### 2.4 Per-dart intent (T1.2)

The shell already computes `intent(state, config)` before each dart from
the state folded so far (`dart-exercise-shell.module.ts:51`). SwitchBlade's
state exposes the current slot, so intent changes mid-visit with no shell
change.

## 3. Kernel-config rows

| Subject | path | hit | points | onDart | onVisitClose | visitOpen | ext | outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hit Count | config `targets` (TREBLE / DOUBLE / BULL) | `isHitOn` (inner bull for BULL) | 1 on hit | track `dartsOnTarget` | `advanceAfterDarts(n)` → `passOnWrap` | `closeAfter(3)` | `dartsOnTarget`, `passes`, `hitsPerTarget[]` | timer only |
| SwitchBlade | 15 fixed slots (`SWITCHBLADE_PATH`, a code constant) | `anyRingEitherBull` | `boardScorePoints` on hit | `tallyRoundPoints(3)` → `advanceEveryDart` → `passOnWrap(14)` | — | `closeAfter(3)` | `passes`, `roundTotals[5]` | timer only |
| Doubles Lock | `doublesPath` D20→D1 | `isHitOn` | 0 (bonus via `lockCheckpoint`) | — | `lockCheckpoint({2:50,3:100})` → pass wrap | `closeAfter(3)` | `lastLock`, `passes`, `dartsPerPass[]`, `locks` | timer only |
| Baseball | `numbersPath` 1–9 | `anyRingEitherBull` (path has no bull) | `pointsTable` S1 / D2 / T3 | `tallyRoundPoints(1)` | `advanceToEnd(8)` | `closeAfter(3)` | `roundTotals[9]` | none (one seat): `COMPLETE` after inning 9, `winningSideKey: null` |

Hit Count config: `{ targets: HitCountTarget[]; dartsPerTarget: number }`,
`HitCountTarget = TREBLE | DOUBLE | BULL` (no `NUMBER`; `BULL` = bullseye only),
validated 1–21 targets and `dartsPerTarget` a multiple of 3 in 3–99. V1 seeds the Big
Trebles template only (T20, T19, T18, T17 × 9).

SwitchBlade: type `SWITCHBLADE`, ruleset `SWITCHBLADE_V1`; config is the empty
strict object `{}` (the path is locked in V1). A perfect pass scores 872.
(Refinements approved 2026-10-18.)

Doubles Lock: type `DOUBLES_LOCK`, ruleset `DOUBLES_LOCK_V1` (not the rules
file's `LOCK_LADDER`); config is the empty strict object `{}`. Path and bonus
are engine constants `DOUBLES_LOCK_PATH` and `DOUBLES_LOCK_BONUS = { 2: 50, 3: 100 }`.
V2 Strict Lock becomes `{ 3: 100 }` with no new policy. (Refinements approved 2026-10-18.)

Baseball: type `BASEBALL`, ruleset `BASEBALL_V1`, slug `baseball`; config is the
empty strict object `{}`; preset "Baseball Darts — Nine Innings". Mode pairs
`RECREATIONAL` + `DETAILED_DARTS` and `ANALYTICS` + `VISUAL_BOARD`; stats tags
`["board"]`; no Dartbot, no `SEAT_CAPS` entry; `NO_INTENT`. `advanceToEnd(8)`
finishes the seat on inning 9's close, so no `doneOnWrap`. Stats: `HEATMAP_ONLY_LAYOUTS`,
`RESULT_DIRECTION` `"higher"`, replay Inning / Runs / Total, progress
`Inning n of 9` with a RUNS headline. Card in `CLASSICS` after Around the Clock,
caption "Nine innings, runs by the ring." Results: Runs, Accuracy, Best inning,
then a "Runs per inning" `TargetGrid` (new optional `title` prop). (Refinements approved 2026-10-18.)

## 4. Readouts (projections)

| Subject | State fields |
| --- | --- |
| Hit Count | `currentTarget`, `targetIndex`, `dartsLeftOnTarget`, `hits`, `dartsThrown`, `hitsPerTarget[]`, `passes`, `status` (hit rate derived by `accuracyDisplay`, not stored in state) |
| SwitchBlade | `currentSlot`, `slotIndex`, `round`, `total`, `roundTotals[5]`, `passes`, `hits`, `dartsThrown`, `status` (hits = darts on the intended number, from facts) |
| Doubles Lock | `currentDouble` (`BoardTarget`), `targetIndex`, `lastLock` (`BoardTarget \| null`), `bonus`, `locks`, `passes`, `dartsPerPass[]`, `bestPassDarts` (fewest darts of a completed pass, or null), `dartsThisPass` (incl. open visit), `hits` (DOUBLE on the intended number, from facts), `dartsThrown`, `status` |
| Baseball | per-seat `inning`, `runs`, `runsPerInning[9]`, status; result = runs |

Every field is derived from the fold; nothing is stored (Hard Invariant).

## 5. Persistence (named before implementation)

| Subject | Capture / input | Stage | turns / darts |
| --- | --- | --- | --- |
| Exercises | analytics, `ANALYTICS` + `VISUAL_BOARD` | one `EXERCISE_BLOCK` per run | one `turns` row per visit; one `darts` row per throw with intended target/zone from `intent`, hit number/zone, board `score` |
| Baseball | as Shanghai (`VISUAL_BOARD`, game shell) | one `EXERCISE_BLOCK` per seat (`PER_SEAT`) | one `turns` row per inning (`totalScore` = runs via `closedVisitTotal`), `darts` per throw |

Intended zone per target: TREBLE → `TREBLE`, DOUBLE → `DOUBLE`, BULL →
`INNER_BULL` (Hit Count); SwitchBlade slot → `TREBLE` or `INNER_BULL`;
Doubles Lock → `DOUBLE` (`doubleTargetIntent`). All in `DartZoneKey`; no
schema change.

## 6. Touch-lists

### Exercise PR (T1.1–T1.3), Random Checkout as the model

Engine + spec; `ExerciseRulesetVersionKey` + Zod config
(`lib/training/exercises/rulesets/types.ts`); validator +
`services/exercise-rulesets/registry.ts`; exercise-type key unions
(`services/types.ts`, `pages/api/training-sessions/types.ts`) and the
allowed-key list (`training-session.service.ts`); step adapter + adapter
registry + `panel` union; `routine-play.data.ts` engine slot and readouts;
`exercise-preview.ts`; `<Name>Panel.astro` mounted in
`pages/training/routines/play/index.astro`; `routine-summary.module.ts`;
stats (`modules/stats/types.ts`, `step-metrics.module.ts`,
`sections/step-result.module.ts`, `lib/stats/replay-fold.ts`,
`replay-presenters.ts`); `scripts/engine-kernels.txt` row (TRACK,
KERNEL_BOUND); seed `database/seeds/00NN_<name>_exercise_type.sql` (type,
ruleset version, template, `ON CONFLICT DO NOTHING`) + verification SQL
(D193); `database/README.md` seed list; docs (`modules/training/CLAUDE.md`,
`09-Training/01-Routines.md`, `10-Statistics/01-Section-Catalog.md`,
`08-Component-Inventory.md`, File Inventory, history row); rules file
`Current version:` → V1.

### Game PR (T1.4), Shanghai / Tactics as the model

Per `docs/architecture/07-Frontend/09-Adding-A-Game.md`: engine
(`DartGameSpec`, game shell) + validator in the same commit
(`check-game-engines.sh`); `lib/game/rulesets/{types,capabilities,games-visibility}.ts`;
setup/play data + Alpine registration; `BaseballSetupForm.astro`,
`interfaces/Baseball.astro`, `result-modals/BaseballResults.astro`; pages
`games/baseball/{setup,play}`; stats (`lib/stats/{constants,section-registry,replay-fold,replay-presenters}.ts`);
seed `00NN_baseball_game_engine_reference.sql` + capability rows +
verification; kernel row; docs. `check-game-wiring.sh` must pass.

Seed numbers are fixed at plan time from what has landed (next free today:
0038).

## 7. Testing

No legacy engine exists, so no differential oracle. Per PR:

- TDD per policy (RED → GREEN), boundary cases from the rules file
  (pass wrap, retreat before any lock, re-lock bonus, bull slot, inning 9).
- Engine tests over the rules file's worked examples; undo inverse of
  record.
- Aimed goldens (`aimedOnCurrentTarget`) as regression snapshots.
- Two mutation checks per new policy, recorded in the PR.
- Existing goldens re-run unchanged (TREBLE addition is additive).
- The routine-stats integration fixture gains Hit Count as step 12, after
  the 501 step, so existing steps keep their numbers; SwitchBlade is
  step 13 (the itest's step count 12 → 13 keeps one step per kind).
- SwitchBlade board preview: family `switchblade`, judge `judgeOnTarget`,
  captions = the visit's three slot labels; the golden helper
  `aimedOnCurrentBoardTarget(rate, field)` reads `currentSlot`.
- Doubles Lock is fixture step 14 (itest 13 → 14). Step metrics
  `{ bonus, locks, darts, hits }`, all `sum`, headline `bonus` higher, rate
  `hits/darts`; best pass is summary-only (no `min` aggregation). Preview
  family `doublesLock`: `judgeDouble`, captions `hitCountCaptions` fed by
  `hitCountTargetLabel() || doublesLockTargetLabel()`. The golden helper gains
  `aimedOnCurrentBoardTarget(rate, field, ring = anyRing)`; Doubles Lock aims
  `DOUBLE`. (Refinements approved 2026-10-18.)

## 8. Decision entry

One D-entry in T1.1 (`decisions/game-engine.md`): `trackExerciseSpec` and
seed-per-engine for Track waves. Id via `bash scripts/next-decision-id.sh`,
re-run before each PR.

## 9. Out of scope

- Retrofitting Target Scoring / Switching Target Scoring onto
  `trackExerciseSpec` (discovered-work issue).
- Every V2+ / Deferred rules-file row (templates beyond Big Trebles,
  head-to-head, standalone exercise entry, Baseball multiplayer, variants).
- Schema changes (none needed).
- Waves T2, T3.

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| TREBLE target alters shipped judging | additive union case; phase-1 goldens re-run |
| `trackExerciseSpec` fits Hit Count only | T1.2/T1.3 use it; if one cannot, it binds by hand and the plan records why |
| Pass bookkeeping off by one at wrap | boundary tests at last target's last dart and first dart of pass 2 |
| Baseball UI scope grows | single seat only; reuse Shanghai components where shape matches |
