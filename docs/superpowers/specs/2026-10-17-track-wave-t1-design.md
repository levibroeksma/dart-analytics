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
  project(seat: TrackSeat<TExt>, config, expired: boolean): TState,
  intent(state: TState, config): DartIntent,
}): DartExerciseSpec<TConfig, TState>
```

Its `fold` is `project(foldTrackDarts(turns, initialTrackSeat(SOLO, initialExt(config)), rules(config)), config, expired)`; `isVisitOpen(turn)` is
`turn.darts.length < 3` (all three exercises close visits at three darts,
`closeAfter(3)`). It returns a plain `DartExerciseSpec`, bound with the existing
`dartExerciseEngineClass` / `dartExerciseEngineFactory`. No shell change.

### 2.2 `BoardTarget` TREBLE (T1.1)

`BoardTarget` gains `{ kind: "TREBLE"; number: number }`. `isHitOn`,
`sectionOf` and every exhaustive switch over the union handle it (a treble
hit is zone `TREBLE` on the number). Existing callers never build it, so
shipped behaviour is unchanged; their goldens prove it.

### 2.3 Policies (each with its first caller, D468)

| Policy | Kind | First caller | Behaviour |
| --- | --- | --- | --- |
| `advanceAfterDarts(n)` | onVisitClose | Hit Count | advance once `n` darts were thrown at the target (`ext.dartsOnTarget`) |
| `passOnWrap(lastIndex)` | onVisitClose / onDart | Hit Count | past `lastIndex`: index 0, `ext.passes + 1` (generalises `lapOnWrap`; ATC keeps `lapOnWrap`) |
| `advanceEveryDart` | onDart | SwitchBlade | `targetIndex + 1` per dart |
| `lockCheckpoint(bonus)` | onVisitClose | Doubles Lock | hits ≥ 2: lock, bonus to `score`, advance; 1: advance; 0: index = `ext.lastLock ?? 0` |

Doubles Lock's pass wrap also clears `lastLock` and appends the pass's darts
to `ext.dartsPerPass`; it composes `passOnWrap` with its own ext reset.

### 2.4 Per-dart intent (T1.2)

The shell already computes `intent(state, config)` before each dart from
the state folded so far (`dart-exercise-shell.module.ts:51`). SwitchBlade's
state exposes the current slot, so intent changes mid-visit with no shell
change.

## 3. Kernel-config rows

| Subject | path | hit | points | onDart | onVisitClose | visitOpen | ext | outcome |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Hit Count | config `targets` (TREBLE / DOUBLE / BULL) | `isHitOn` (inner bull for BULL) | 1 on hit | track `dartsOnTarget` | `advanceAfterDarts(n)` → `passOnWrap` | `closeAfter(3)` | `dartsOnTarget`, `passes`, `hitsPerTarget[]` | timer only |
| SwitchBlade | 15 fixed slots | number any ring; bull slot either bull | `boardScorePoints` on hit | `advanceEveryDart` → `passOnWrap(14)` | — | `closeAfter(3)` | `passes`, `roundTotals[5]` | timer only |
| Doubles Lock | `doublesPath` D20→D1 | `isHitOn` | 0 (bonus via `lockCheckpoint`) | — | `lockCheckpoint({2:50,3:100})` → pass wrap | `closeAfter(3)` | `lastLock`, `passes`, `dartsPerPass[]`, `locks` | timer only |
| Baseball | `numbersPath` 1–9 | number any ring (no bull) | `pointsTable` S1 / D2 / T3 | — | `advanceToEnd` → `doneOnWrap(8)` | `closeAfter(3)` | none | scoreCompare HIGH (one seat) |

Hit Count config: `{ targets: BoardTarget[]; dartsPerTarget: number }`,
validated non-empty and `dartsPerTarget % 3 === 0`, `> 0`. V1 seeds the Big
Trebles template only (T20, T19, T18, T17 × 9).

## 4. Readouts (projections)

| Subject | State fields |
| --- | --- |
| Hit Count | `currentTarget`, `dartsLeftOnTarget`, `hits`, `darts`, `hitRate`, `hitsPerTarget[]`, `passes` |
| SwitchBlade | `currentSlot`, `round`, `total`, `roundTotals[5]`, `passes` |
| Doubles Lock | `currentDouble`, `lastLock`, `bonus`, `locks`, `passes`, `bestPassDarts`, `dartsThisPass` |
| Baseball | per-seat `inning`, `runs`, `runsPerInning[9]`, status; result = runs |

Every field is derived from the fold; nothing is stored (Hard Invariant).

## 5. Persistence (named before implementation)

| Subject | Capture / input | Stage | turns / darts |
| --- | --- | --- | --- |
| Exercises | analytics, `ANALYTICS` + `VISUAL_BOARD` | one `EXERCISE_BLOCK` per run | one `turns` row per visit; one `darts` row per throw with intended target/zone from `intent`, hit number/zone, board `score` |
| Baseball | as Shanghai (`VISUAL_BOARD`, game shell) | one `LEG` stage | one `turns` row per inning (`totalScore` = runs via `closedVisitTotal`), `darts` per throw |

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
