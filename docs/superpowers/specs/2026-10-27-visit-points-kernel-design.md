# Visit Points Kernel — Design

Date: 2026-10-27
Status: awaiting owner approval; plan to follow via `superpowers:writing-plans`
Parent: `2026-10-15-rule-kernels-design.md` (umbrella, §5 Visit points row, §6, §8 item 2)
Siblings: `2026-10-17-track-kernel-design.md`, `2026-10-27-checkout-kernel-design.md` (method reused)
Branch: `claude/adoring-bell-0p3iks`

## 1. Goal

Define the Visit points rule kernel ("a visit's darts make a total; each
closed visit is turned into points") and move the two shipped Visit points
engines onto it with no change in behaviour (phase 1). The aim is tidying:
fewer hand-written classes and one shared visit fold, not new games.

### Decided in brainstorming

| # | Decision |
| --- | --- |
| V1 | Scope: kernel + migration of the two shipped engines (Score Training, Score Threshold) only. The 15 unbuilt games (umbrella §5) get their own wave spec later, as with Track and Checkout. |
| V2 | The kernel carries only what these two engines use. The umbrella's goal (exact / at least), bust, void and compare-mode settings are **not** specced here; each lands with the first new game that needs it (Track: "a policy lands with its first caller"). |
| V3 | Order: **Score Threshold → Score Training**, simplest first. Score Threshold fits the existing exercise shell unchanged; Score Training needs keypad-total input on the game shell. |
| V4 | Keypad-total input on the game shell (`visitInput`) is already specced by the Checkout spec §6 for TUOD (Checkout PR 3). Whichever of TUOD and Score Training migrates first builds it, to the Checkout spec's shape; the other reuses it. |
| V5 | Suspected quirks are preserved and filed as `discovered-work`; never fixed in a migration PR (Track T5, Checkout C7). |

## 2. Current state

Neither engine is on a shell or a kernel. Both rows in
`scripts/engine-kernels.txt` read `VISIT_POINTS | PENDING`.

| Engine | Lines | Kind | Shell? | Input | Seats | Ends on | Exported |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Score Threshold | 173 | exercise (`DartExerciseEngine`) | no, own class | per dart (`appendObservedDart`) | solo | `expireTimer()` only | `foldScoreThresholdState`, `ScoreThresholdEngine`, `scoreThresholdEngineFactory` |
| Score Training | 361 | game (`GameEngine`, `PER_SEAT`) | no, own class | per dart (coordinates, `resolveObservation` + `appendResolvedDart`) **or** keypad total (`number`) | 1 or 2 | ROUNDS budget, or MINUTES timer (solo) | `foldScoreTrainingState`, `ScoreTrainingEngine`, `scoreTrainingEngineFactory` |

What they share is the visit walk: a visit is up to three darts (or one
keypad total), its total is the sum of the dart scores, and a closed visit
is turned into points:

- Score Threshold: points = `1` if total ≥ `threshold`, else `0` (`beats`).
  It also shows the open visit (`currentVisitTotal`, `dartsInVisit`) and
  the last closed total (`lastVisitTotal`).
- Score Training: points = the total. The seat's `totalScore` also counts
  the open visit's darts (#168); `turnCount` counts closed visits only.

Neither uses a goal, bust or void rule. Callers of the exported names:
`score-training-play.data.ts`, `session-context.module.ts`,
`session-progress.module.ts`, `section-registry.ts`,
`score-threshold.adapter.ts`, `routine-play.data.ts`. Exported folds,
classes and factories keep their names and signatures.

## 3. Kernel contract

File: `app/src/modules/game/visit-points-kernel.module.ts` (the name Pattern
18 already gives it). Types in `modules/game/types.ts` and
`interfaces.ts`, as the Checkout kernel does. Sketch; the plan settles the
exact names:

```ts
interface VisitPointsRules {
  dartsPerVisit: number;            // 3 for both shipped engines
  points(visitTotal: number): number;
}

type VisitPointsSeat = {
  visits: number;                  // closed visits
  points: number;                  // sum of points(total) over closed visits
  lastVisitTotal: number | null;   // latest closed total
  openTotal: number;               // open visit's dart sum (0 when none)
  dartsInVisit: number;            // darts in the open visit
  dartsThrown: number;             // every dart, open or closed
};

applyVisitPointsTurn(seat, turn, rules): VisitPointsSeat
foldVisitPoints(turns, rules): VisitPointsSeat   // one seat, write order
```

- A turn's total: the sum of its dart scores, or its stored `totalScore`
  when it has no darts (a keypad visit).
- A turn is closed when it has `dartsPerVisit` darts or no darts at all.
  In both shipped logs this matches `completedAt !== null`; the oracle
  proves it.
- The kernel holds no seat identity, duration, timer or outcome. Score
  Training filters turns per seat and keeps its duration check
  (`durationSeatComplete`) and `scoreCompareOutcome` in its own fold
  (Checkout C5: an outcome moves into a kernel only once two engines share
  it).

Projections:

| Engine | Kernel seat → state |
| --- | --- |
| Score Threshold | `beats = points`, `visits`, `lastVisitTotal`, `currentVisitTotal = openTotal`, `dartsInVisit`, `dartsThrown`; `status` from `expired` |
| Score Training | per seat: `turnCount = visits`, `totalScore = points + openTotal` |

## 4. Per-engine moves

### PR 1: Score Threshold → kernel + exercise shell

- Becomes a `DartExerciseSpec` bound through `dartExerciseEngineClass` and
  `registerDartExercise`, deleting its class body, as Random Checkout did
  (Checkout PR 2).
- `fold` calls `foldVisitPoints`; `isVisitOpen` is
  `state.dartsInVisit > 0`; `intent` is `NO_INTENT`; no `ends` (timer only).
- No shell change. The shell's record, undo (reverse expiry first, then one
  dart), refusal text ("exercise is complete") and `facts()` already match
  the hand-written class.
- The kernel lands here, with this as its first caller (fallow dead-code
  gate).

### PR 2: Score Training → kernel + game shell

Becomes a `DartGameSpec` (`stageOwnership: "PER_SEAT"`, one
`EXERCISE_BLOCK`) whose `fold` calls `foldVisitPoints` once per seat. Its
guards map onto the spec:

| Today | On the shell |
| --- | --- |
| `isMatchDecided()` refusal for a dart (1v1 only; solo exempt) | `refusal(before)`, same message; `null` for solo |
| `isMatchDecided()` refusal for a keypad total (its own message); `0..maxVisitScore` integer check | `visitInput.refusal(before, input)`. For a keypad input the shell calls **only** `visitInput.refusal`, never `refusal`; for a dart only `refusal` (my call: keeps both messages, and needs no input argument on `refusal`) |
| keypad refused while a board visit is open | the shell refuses it itself whenever a turn is open, before `visitInput.refusal`, with Score Training's message passed through the spec (my call: the rule is generic, and it needs the turn log, which the spec hooks never see) |
| `isComplete()`: solo = `durationSeatComplete`; 1v1 = status | solo `status` is always `IN_PROGRESS` (`scoreCompareOutcome(…, "IN_PROGRESS")`), so the shell's `status !== "IN_PROGRESS"` never ends a solo run: new gap `isComplete?(state, config, timerExpired)` (below) (my call: changing the fold's solo `status` would change exported state) |
| `wouldComplete` for both input kinds; the dart case needs the open visit's dart count | no new state field (`ScoreTrainingState` keeps its exact keys, my call). Either the spec answers from a trial fold the shell hands it, or the shell computes it by a trial `record` on a copy; builder's call, oracle decides |

Shell gaps, all additive and optional (existing specs compile unchanged);
each lands here only if TUOD has not landed it first (V4):

| Gap | Why |
| --- | --- |
| `visitInput?: { isVisit, refusal, total }` (shape fixed by Checkout spec §6): one closed, dartless turn; `record`/`wouldComplete` accept `DartObservation \| TVisit` | keypad totals |
| `isComplete?(state, config, timerExpired)`: overrides `status !== "IN_PROGRESS"` | solo Score Training ends on its duration, not its status |
| shell refuses a keypad input while a turn is open (message from the spec) | Score Training's open-visit guard; TUOD needs the same rule |
| `undo` pops a whole dartless turn (`undoLastUnit` semantics) when `visitInput` is set | the shell's `undoLastDart` returns false on a keypad turn |
| A per-spec dart append: Score Training scores darts from coordinates (`resolveObservation` + `appendResolvedDart`, no intent), the shell from `hitTargetNumber`/`hitZoneKey` (`appendObservedDart`) | the facts would differ otherwise. Builder's call on the hook's shape; the oracle decides if it is needed |

Live open-visit `totalScore` needs no gap: `appendObservedDart` already sets
it on every dart, and `appendResolvedDart` leaves it to the caller, which is
why the append hook must set it too.

## 5. Migration method (per PR)

Track §7 / Checkout §7 unchanged:

1. **Commit 1:** copy the old engine to the test tree as `legacy`; add the
   oracle test against it.
2. **Commit 2:** rebind onto the kernel. Oracle
   (`app/tests/modules/game/support/engine-oracle.ts`): seeded random
   inputs, undos interleaved, rehydration every N steps; solo for Score
   Threshold with timer expiry; Score Training at 1 and 2 seats, ROUNDS
   and MINUTES (solo), mixing per-dart and keypad inputs in one log, and
   asserting refusals throw the same message. Existing engine tests pass
   unchanged.
3. **Commit 3:** record golden + step-trace snapshots (one line per dart or
   visit), delete `legacy`.

Quirks: verified with a probe test, filed as `discovered-work`, never fixed
here (V5).

**Gates per PR:** `npm test`, `npm run check` (0 hints), fallow
(duplication must not rise), all `check-*.sh`, `check-engine-kernels.sh`
with the engine's registry row flipped to `KERNEL_BOUND`,
`check-test-coverage.sh`, `npm run format:check`.

## 6. Docs and context per PR

| Item | PR 1 | PR 2 |
| --- | --- | --- |
| `scripts/engine-kernels.txt` row → `KERNEL_BOUND` | Score Threshold | Score Training |
| Pattern 18 §Rule-kernel families `VISIT_POINTS` row: "designated, kernel pending" → bound | yes | callers updated |
| Decision entry in `decisions/game-engine.md` (kernel contract, order V3, V4 rule) | yes | only if a shell gap lands |
| `app/src/modules/training/CLAUDE.md` line (exercise on the kernel) | yes | — |
| `app/src/modules/game/CLAUDE.md` line (Visit points engine shape; shell gaps) | yes | yes |
| `context-maintenance` skill | yes | yes |

## 7. Non-goals

- New Visit points games, or any goal / bust / void / compare setting (V1, V2).
- Changes to rules files: neither file's open questions bear on the
  shipped behaviour (Score Threshold: none; Score Training's concern
  unshipped variants).
- Moving `scoreCompareOutcome` or the duration check into the kernel.
- Fixing quirks (V5).

## 8. Risks

| Risk | Guard |
| --- | --- |
| Coordinate vs zone dart scoring drifts on the shell | oracle drives coordinate-captured darts, incl. null coords (miss) |
| Keypad and board turns mixed in one log fold differently | oracle mixes both; undo across the boundary |
| Solo MINUTES finishing visit (recorded after `isComplete()` reads true) refused on the shell | oracle case; `refusal` stays `null` for solo |
| `visitInput` built twice (TUOD and here) | V4: check `main` for it before PR 2's plan; reuse if present |

**Plans:** one per PR, as with Checkout (`…-pr1.md`, `…-pr2.md`). PR 1's
plan is written now; PR 2's plan once PR 1 lands, after checking `main`
for `visitInput` (my call).

## 9. Left to the builder

- Exact kernel type and function names.
- Whether the "closed" test reads dart count or `completedAt`, as long as
  the oracle passes.
- The dart-append hook's shape, or showing it is not needed.
