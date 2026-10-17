# Track Kernel — Design

Date: 2026-10-17
Status: approved in brainstorming, pending written-spec review
Parent: `2026-10-15-rule-kernels-design.md` (umbrella, §5 Track row, §8 item 2)
Branch: `docs/track-kernel-spec`

## 1. Goal

Define the Track rule kernel — "walk a target path, hit-test each dart, score,
judge the visit, end the seat, pick a winner" — and move the seven shipped
Track engines onto it with no behaviour change (phase 1). Assign every
candidate unbuilt game to Track or out of it, with its kernel-config row, so
the new-game waves (phase 2) need no further design.

### Decided in brainstorming

| # | Decision |
| --- | --- |
| T1 | `TrackRules` is a **record of named policy functions**, built per read from the config snapshot by the game's mapper — not a pure-data enum config (§3). |
| T2 | Kernel stays match-level (umbrella Q3); it folds each seat's own darts through the policies, then calls `outcome` once. |
| T3 | Each migrated engine keeps its exported fold and `state()` shape via a `project(match) → legacy state` function (§3). |
| T4 | Shell gaps (timer on the game shell, several ruleset keys per engine, visit-total write) land with the first engine that needs each (§6). |
| T5 | Suspected quirks in shipped engines are preserved by the refactor and filed as `discovered-work`; never fixed in a migration PR (§7). |
| T6 | Scope now: phase 1 (seven migration PRs) is built. Phase 2 waves get their own plans later (§8). |

## 2. Current state

All seven shipped Track engines fold per seat (`foldSeatStates`) and decide
the match afterwards (`activeSeat`, `match-outcome`). The exercises fold one
flat dart stream with no seats.

| Engine | Lines | On shell? | Exported fold (callers) |
| --- | --- | --- | --- |
| Doubles Training | 214 | yes (game) | `foldDoublesTrainingState` (play.data, session-progress) |
| Bob's 27 | 203 | yes (game) | `foldBobs27State` (play.data, session-progress) |
| Singles Training | 488 | no — V1/V2/V3 keys | `foldSinglesTrainingState` (play.data, session-progress) |
| Around the Clock | 463 | no — `expireTimer`, V1/V2 | `foldAroundTheClockState` (play.data, session-progress) |
| Shanghai | 410 | no — `turn.totalScore` write, V1/V2 | `foldShanghaiState` (play.data, session-progress) |
| Target Scoring | 182 | yes (exercise) | `foldTargetScoringState` (own module) |
| Switching Target Scoring | 212 | no — hand-copied shell | `foldSwitchingTargetScoringState` (own module) |

Per-seat reducers are exported too (`applyXDart`, used by `derived-aims`,
`replay-presenters`); they keep their signatures as thin adapters.

## 3. Kernel contract

The Track kernel implements the umbrella `RuleKernel<TRules, TMatch>`.

```ts
interface JudgedDart { dart: DartObservation; hit: boolean; points: number }

interface TrackSeat<TExt> {
  targetIndex: number;
  score: number;
  darts: number;
  visit: JudgedDart[];                 // darts of the open visit
  status: "IN_PROGRESS" | "DONE" | "OUT";
  ext: TExt;                           // game-owned: laps, chain, lives, checkpoint, outcomes[]
}

interface TrackMatch<TExt> { seats: TrackSeat<TExt>[]; timerExpired: boolean }

interface TrackRules<TExt> {
  path: (seat: number) => readonly BoardTarget[];
  cycle: boolean;                      // wrap at path end (exercises, timed ATC)
  hit: (target: BoardTarget, dart: DartObservation) => boolean;
  points: (target: BoardTarget, dart: DartObservation, hit: boolean) => number;
  onDart?: (seat: TrackSeat<TExt>, d: JudgedDart, r: TrackRules<TExt>) => TrackSeat<TExt>;
  onVisitClose?: (seat: TrackSeat<TExt>, visit: readonly JudgedDart[], r: TrackRules<TExt>) => TrackSeat<TExt>;
  visitOpen: (seat: TrackSeat<TExt>) => boolean;
  initExt: () => TExt;
  outcome: (m: TrackMatch<TExt>) => { status: string; winningSideKey: string | null };
}
```

- `applyDart`: judge (`hit`, `points`) → `onDart` → if `!visitOpen`, `onVisitClose`
  and clear `visit`. `seatDone` = `status !== "IN_PROGRESS"`.
- `TrackRules` is derived on every read from the config snapshot; never stored.
- `project(match, config) → legacy state` per engine keeps `state()` and the
  exported fold byte-identical in shape.
- **Policies** live in `app/src/modules/game/track-policies.ts` as small named
  builders. A policy lands only with its first caller (fallow dead-code gate).
- **L2 adapter:** `trackGameSpec(...)` / `trackExerciseSpec(...)` produce a
  `DartGameSpec` / `DartExerciseSpec`. Shells change only per §6.
- **Persistence (Hard Invariant):** unchanged. `EXERCISE_BLOCK` stage, one
  `turns` row per visit, one `darts` row per dart; capture/input
  `DETAILED_DARTS` or `VISUAL_BOARD`. No new fact columns.
- **Fallow:** the kernel reducer keeps cognitive complexity ≤ 15 because
  branching lives in policies, not in a generic switch.

## 4. Policy library (phase 1)

| Policy | Kind | First caller |
| --- | --- | --- |
| `isHitOnTarget` (wraps `isHitOn`) | hit | Doubles Training |
| `anyRingEitherBull`, `outerSingleOnly`, `sdtBucket`, `singleOrTreble` | hit | Singles / ATC / Shanghai / Target Scoring |
| `noPoints`, `fixedValue`, `pointsTable`, `boardScorePoints` | points | Doubles / Bob's 27 / Singles / Shanghai |
| `closeOnHitOrThree`, `threeDartVisit` | visitOpen | Doubles / all others |
| `advanceRecordingOutcome` | onVisitClose | Doubles Training |
| `penaltyOnBlank(mult)` + `outAtOrBelowZero` | onVisitClose | Bob's 27 |
| `outBelowHits(n)` | onVisitClose | Singles Training |
| `advanceOnHit` (n = 0), `stepBackBelowHits(n)`, `lapOnWrap` | onDart / onVisitClose | Around the Clock |
| `shanghaiWin`, `halveOnBlank` | onVisitClose | Shanghai |
| `chainOnTarget` | onDart | Target Scoring |
| `resetOnMiss` | onDart | Switching Target Scoring |
| outcomes: `scoreCompareBy(metric, dir)`, `eliminationOnOut`, `raceThenScore`, `timerOnly` | outcome | per engine (wrap `match-outcome`) |

Names are indicative; the plan fixes them. Each preserves the existing
engine's exact branch, quirks included.

## 5. Kernel-config rows

### Shipped (migrate, no behaviour change)

| Game | path / cycle | hit | points | onDart | onVisitClose | visitOpen | outcome |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Doubles Training | `doublesPath(order)` | `isHitOn` | 0 | — | record outcome, advance | close on hit or 3 | scoreCompare HIGH (hits) |
| Bob's 27 | `doublesPath()` | `isHitOn` | value | — | `penaltyOnBlank(mult)`, ≤ 0 → OUT; BULL → DONE | 3 | elimination |
| Singles Training | `numbersPath(order)` | any ring / either bull | `pointsTable` STD/ACC | — | `outBelowHits(n)`, advance | 3 | OUT → elimination, else scoreCompare HIGH |
| Around the Clock | `clockPath`; cycles when timed (`ext.laps`) | ANY / OUTER_SINGLE | 0 | advance on hit (n = 0) | `stepBackBelowHits(n)` | 3 | scoreCompare LOW (darts) |
| Shanghai | `numbersPath` 1–20 | S/D/T bucket | `boardScore` | — | `shanghaiWin`; `halveOnBlank` (HARD); advance | 3 | race SHANGHAI → scoreCompare HIGH |
| Target Scoring | config list, cycles | number, S/T | 1 / 3 | `chainOnTarget` | — | 3 (bookkeeping) | timer only |
| Switching TS | 3 targets, cycles | same | same | `resetOnMiss`, `ext.sequences` | — | 3 | timer only |

### Unbuilt — in Track

| Game | path | hit | points | policies | New setting |
| --- | --- | --- | --- | --- | --- |
| Hit Count | template list | named bed | 1 / hit | `advanceAfterDarts(9)` | none |
| SwitchBlade | 15-slot list | number, any bed | `boardScore` | advance every dart | none |
| Baseball | 1–9 | number, graded | 1 / 2 / 3 | advance per visit | none |
| Doubles Lock | D20 → D1 | double | lock bonus | `lockCheckpoint`, hit-count table | none (SETBACK) |
| Halve-It | mixed list incl. zone classes | number / any D / any T / bull | board value on hit | `halveOnBlank`, advance | zone-class target |
| Nine Lives | 1–20, bull | any ring | 0 | advance on hit; `loseLifeOnBlank(3)` | `livesLedger` |
| Doubles S&L | D1 → D20, bull | double / bullseye | 0 | `moveTable(-2,-1,0,+1)`; finish = 3 hits | `moveTable` |
| Mikko's Megatrain | 20-entry list | named bed | 0 | `advanceIfHits(2)` + burn-dart carry | carry |
| Steeplechase | clockwise + bull | per-target filter | 0 | one advance per visit; `strikeOut(3)` | per-target filter, strikes |
| JDC Challenge | 3 phases | per phase | per phase + Shanghai bonus | per-entry budget / points | per-entry overrides |

### Moved out of Track

| Game | Goes to | Why |
| --- | --- | --- |
| Prisoner | Elimination or hand-written | per-seat dart arsenal, shared board state, captures across seats |
| Hare and Hounds | Elimination or hand-written | target frozen per visit, asymmetric starts, per-dart catch across seats |
| Neighbours | Marks | set-marking in any order; picks need a fact column that does not exist |
| A1 Routine | Marks | marks per target, close at 5, round-robin skips closed |
| Bullseye 500 | Visit points | goal-on-score accumulator, no walk |
| Bullseye Checkout | Checkout | free-aim visit total + final-dart zone |
| Golf, DOLF | Visit points | voluntary short / bonus-extended visits; visit-judged score |

Bull-Up (shipped) is a degenerate fit; it is not migrated. Switching and
Double Pattern (shipped, no rules file) are re-checked when their exercise
shells are next touched; not in phase 1.

### Rules-file gaps (close before each wave, via `authoring-game-rules`)

- Open questions remain in Nine Lives, Halve-It, Hit Count, JDC Challenge,
  Mikko's Megatrain, Doubles Lock, Doubles S&L and Steeplechase.
- Pressure tag ≠ mechanic: Nine Lives (PENALTY → lives), Steeplechase
  (PENALTY → elimination), Doubles S&L (RESET → setback). Policies follow the
  mechanic, not the tag; the tags are corrected in the rules files.

## 6. Shell changes

| Change | Shell | Lands in |
| --- | --- | --- |
| `rulesetVersionKeys` (several keys, one spec) | game | PR 3 (Singles V1–V3) |
| `expireTimer` + `timerExpired` passed to `fold` | game | PR 4 (Around the Clock) |
| `onVisitClosed(turn, before, after)` hook to write `turn.totalScore` | game | PR 5 (Shanghai) |

Each is additive: existing specs compile unchanged.

## 7. Migration method (per PR)

1. **Commit 1** — copy the old engine to the test tree as `legacy`; add the
   oracle test against it (passes trivially against itself until commit 2).
2. **Commit 2** — rebind the engine onto the kernel. Oracle: seeded random
   darts, undos interleaved, rehydration every N steps, at 1, 2 and 3 seats
   (where the engine allows). Existing engine tests pass unchanged.
3. **Commit 3** — record golden + step-trace snapshots, delete `legacy`.
   Snapshot format: one line per dart; full facts only in the first golden.

Commit 1 keeps the oracle's proof in git history (the gap #973 review found).

**Quirks preserved, filed separately** (verified with a probe test first,
then a `discovered-work` issue; never fixed here):

- Shanghai, Bob's 27, Singles, Doubles call `activeSeat` without a completion
  predicate — a finished seat may stay in rotation.
- Around the Clock timed mode picks the winner by fewest darts, not laps.
- Bob's 27 with every seat WON may never reach COMPLETE.

**Gates per PR:** `npm test`, `npm run check` (0 hints), fallow (duplication
must not rise), all `check-*.sh`, `check-test-coverage.sh`.

## 8. Sequencing

### Phase 1 — build now (one engine per PR, merged in order)

| PR | Engine | Brings |
| --- | --- | --- |
| 1 | Doubles Training | kernel core, first policies, `trackGameSpec`, D-entry, Pattern 18 line |
| 2 | Bob's 27 | `penaltyOnBlank`, elimination outcome; `09-Adding-A-Game.md` |
| 3 | Singles Training | `pointsTable`, `outBelowHits`, multi-key shell |
| 4 | Around the Clock | `stepBackBelowHits`, laps, game-shell timer |
| 5 | Shanghai | `shanghaiWin`, `halveOnBlank`, visit-total hook |
| 6 | Target Scoring | `chainOnTarget`, `trackExerciseSpec` |
| 7 | Switching Target Scoring | `resetOnMiss`; deletes its hand-copied shell |

The stack cap allows one branch on another; each PR merges before the next
but one starts.

### Phase 2 — new games, own plans later

| Wave | Games | Precondition |
| --- | --- | --- |
| T1 | Hit Count, SwitchBlade, Baseball, Doubles Lock | rules questions closed |
| T2 | Halve-It, Nine Lives, Doubles S&L | + tags fixed; adds `livesLedger`, `moveTable` |
| T3 | Mikko's Megatrain, Steeplechase, JDC Challenge | each at the 2-setting fit limit |

One seed file and one touch-list commit per wave.

## 9. Docs and decisions

- PR 1: D-entry in `decisions/game-engine.md` (Track kernel; policy-record
  form; project-to-legacy-state). Pattern 18 Rule gains "an engine is a
  kernel bound to a shell; a hand-written engine is the opt-out."
  `modules/game/CLAUDE.md` bullet.
- PR 2: `07-Frontend/09-Adding-A-Game.md` exemplar paragraph points at the
  kernel-backed Bob's 27.
- PR 6: `modules/training/CLAUDE.md` bullet for `trackExerciseSpec`.

## 10. Out of scope

- Any rules change to a shipped game, including the quirks in §7.
- Phase-2 games (own plans).
- Bull-Up, Switching, Double Pattern migrations.
- Schema changes (none needed).

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| `project` hides a state drift | oracle deep-equals `state()` and `facts()` after every step |
| Policy library sprawls | each policy needs a live caller; >2 new settings ⇒ hand-written (umbrella fit rule) |
| Shell changes break pilot engines | additive only; PR-1–2 goldens re-run on every later PR |
| Snapshot bloat | one-line-per-dart format (§7) |
