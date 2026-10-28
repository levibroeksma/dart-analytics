# Checkout Kernel — Design

Date: 2026-10-27
Status: approved in brainstorming; plan to follow via `superpowers:writing-plans`
Parent: `2026-10-15-rule-kernels-design.md` (umbrella, §5 Checkout row, §8 item 2)
Sibling: `2026-10-17-track-kernel-design.md` (method reused)
Branch: `docs/checkout-kernel-spec`

## 1. Goal

Define the Checkout rule kernel — "a seat attempts a target score under the
double-out bust rule within a visit budget; the attempt passes or fails and
the next target follows" — and move the four shipped Checkout engines onto
it with no behaviour change (phase 1).

### Decided in brainstorming

| # | Decision |
| --- | --- |
| C1 | Scope: kernel + migration of the four shipped engines only. New Checkout games (420, Hubbe, Finishing Pyramid, Halving Doubles, Frustration, 170 Practice) get their own wave spec later — Track precedent (kernel spec, then T1/T2 wave specs). |
| C2 | Approach: one attempt-walker kernel; shell gaps land with the first engine that needs each (Track T4). |
| C3 | Order reversed against the umbrella §6 (TUOD → 121 → CS → RC): **Checkout Sequence → Random Checkout → TUOD → 121**, simplest first — the two exercises fit the existing exercise shell, TUOD needs visit-total input, 121 also needs a stage per attempt. Recorded in the PR 1 decision entry. |
| C4 | The kernel never judges a visit itself: each engine supplies `judge(seat, turn) → VisitVerdict`. Record-time rules that settle a turn (TUOD's last-dart bust, 121's final-visit and dart-count rules) stay in the engine. |
| C5 | `outcome` stays in each engine's fold until two engines share one (Track refinement). |
| C6 | Bullseye Checkout stays `PENDING`: it does not use `resolveCheckoutAttempt` (bull-only finish, no bust ladder); re-checked when its exercise shell is next touched, as Double Pattern and Switching under Track. |
| C7 | Suspected quirks are preserved and filed as `discovered-work`; never fixed in a migration PR (Track T5). |

## 2. Current state

No engine is on a shell. All four call `resolveCheckoutAttempt`
(`checkout-bust.module.ts`).

| Engine | Lines | Shell? | Input | Stages | Visit judged from | Exported fold |
| --- | --- | --- | --- | --- | --- | --- |
| Checkout Sequence | 262 | no — own `DartExerciseEngine` class | per dart | one `EXERCISE_BLOCK` | darts (`walkVisit`) | `foldCheckoutSequenceState` |
| Random Checkout | 221 | no — own `DartExerciseEngine` class | per dart | one `EXERCISE_BLOCK` | darts (`walkVisit` + unreachable fail, #1064) | `foldRandomCheckoutState`, `drawStartScore`, `RANDOM_CHECKOUT_POOL` |
| Ten Up One Down | 620 | no — own `GameEngine` class | per dart **or** attempt total (`TuodInput`) | one `EXERCISE_BLOCK` | stored `totalScore > 0`, settled at record time | `foldTuodState`, `applyTuodAttempt`, `initialTuodState` |
| 121 | 750 | no — own `GameEngine` class | per dart **or** visit total (`OneTwentyOneInput`) | one `ROUND` per attempt | stored `totalScore` + `finishedOnDouble: true` | `foldOneTwentyOneState`, `applyOneTwentyOneVisit`, `initialOneTwentyOneState`, `durationOf` |

`walkVisit` is duplicated between the two exercises (same loop, Random
Checkout adds the reachability fail). Exported folds and reducers keep their
signatures — play data, result modals, `checkout-visits.module.ts` and
`statistics.service.ts` call them.

## 3. Kernel contract

```ts
type VisitVerdict =
  | { kind: "CHECKOUT"; darts: number }    // darts used in this visit
  | { kind: "BUST" }                       // visit scores nothing, remaining unchanged
  | { kind: "SPENT"; remaining: number }   // visit closed short of zero
  | { kind: "FAIL" };                      // attempt dead now (unreachable, final-visit rule)

interface CheckoutSeat<TExt> {
  target: number;          // the open attempt's start score
  remaining: number;       // countdown inside the open attempt
  attemptIndex: number;    // 0-based; feeds seeded draws
  visitIndex: number;      // visits used in the open attempt
  attempts: number;
  checkouts: number;
  status: "IN_PROGRESS" | "DONE" | "WON";
  ext: TExt;               // game-owned: points, lastAttempt, failures, …
}

interface CheckoutRules<TExt> {
  target: (seat: CheckoutSeat<TExt>, attemptIndex: number) => number;
  judge: (seat: CheckoutSeat<TExt>, turn: TurnFact) => VisitVerdict;
  visitsPerAttempt: number;
  onAttemptClose: (
    seat: CheckoutSeat<TExt>,
    passed: boolean,
    verdict: VisitVerdict,
  ) => CheckoutSeat<TExt>;
  initExt: () => TExt;
}
```

- Exports: `initialCheckoutSeat`, `applyCheckoutVisit(seat, turn, rules)`,
  `foldCheckoutSeats(turns, seats, rules)` (per seat, closed turns only),
  `foldCheckoutVisits(turns, initial, rules)` (exercise form: one seat over
  every turn, as `foldTrackDarts`).
- `applyCheckoutVisit`: `judge` → `CHECKOUT` ⇒ `onAttemptClose(passed: true)`;
  `FAIL`, or `BUST`/`SPENT` on the last visit of the budget ⇒
  `onAttemptClose(passed: false)`; otherwise carry — `SPENT` carries its
  `remaining`, `BUST` carries the visit's start score — and bump `visitIndex`.
  `onAttemptClose` sets the next `target` (through `rules.target`), resets
  `remaining`, `visitIndex`, bumps `attemptIndex`/`attempts`.
- The open-visit live overlay (score falling dart by dart) stays in each
  engine's projection: TUOD subtracts dart scores, 121 subtracts the open
  turn's `totalScore`, the exercises read the walk's `OPEN` remainder.
- `project(seat(s), config) → legacy state` per engine keeps `state()` and the
  exported fold identical in shape (Track T3).
- `CheckoutRules` is built per read from the config snapshot; never stored.
- Reuse, never re-declare: `resolveCheckoutAttempt`, `isCheckoutReachable`,
  `checkoutDartsRejection`, `turn-log.module.ts`, `seat-rota.module.ts`,
  `match-outcome.module.ts`.
- **Persistence (Hard Invariant):** unchanged. Capture/input mode as today
  (`DETAILED_DARTS`/`VISUAL_BOARD` per dart; `QUICK_SCORE` visit total for
  TUOD and 121). Stage type as today (`EXERCISE_BLOCK`; 121 `ROUND` per
  attempt). One `turns` row per visit, one `darts` row per dart, none for a
  visit total. No new fact columns.
- **Fallow:** kernel reducer cognitive complexity ≤ 15; branching lives in
  policies.
- **Refined by the PR 1 plan (2026-10-27):** `target` + target-setting in `onAttemptClose` become `nextTarget(seat, passed) → number | null` (null ⇒ `DONE`), the first target passed to `initialCheckoutSeat`; `VisitVerdict` gains `OPEN { remaining, darts }`, `FAIL` lands in PR 2 and `WON` in PR 4; `CheckoutSeat` carries `visitStart`/`dartsInVisit` and gains seat identity with `foldCheckoutSeats` in PR 3; the exercise shell's `isVisitOpen` sees the folded state; `NO_INTENT` exported from `turn-log.module.ts`.
- **Refined by the PR 2 plan (2026-10-27):** `seededDrawTarget(drawSeed, pool)` and `drawStartScore` both wrap `seededPoolDraw(drawSeed, pool, index)` in `checkout-policies.ts` (a game module cannot import a training one); `unreachableFails` judges from `dartWalkJudge`'s verdict — an `OPEN` visit with a dart thrown and an unreachable remainder is `FAIL` — rather than walking again; `FAIL` closes the attempt on any visit.
- **Refined by the PR 3 plan (2026-10-27):** seat identity stays outside `CheckoutSeat` — `foldCheckoutSeats(turns, seats, initial, rules)` returns seats aligned with `seats` and the engine projection adds `participantRef`/`sideKey`; `ladderStep` is `ladderTarget(up, down, floor, cap)`, a `nextTarget` policy, with TUOD's `onAttemptClose` the identity (121's `WON` cap lands in PR 4); `storedTotalJudge` returns `OPEN` for an unstamped turn, `CHECKOUT` for a stamped turn with `totalScore > 0`, else `FAIL` — 121's `finishedOnDouble` and `BUST`/`SPENT` split land with it.
- **Refined by the PR 4 plan (2026-10-28):** 121's `ladderStep(+1, 0, —, 170 → WON)` is `ladderTarget(1, 0, 121, 170)` wrapped in `untilWon` (no next target for a `WON` seat) plus `winAtCap(170)` as `onAttemptClose`; the kernel keeps a seat a policy marked `WON` instead of overwriting it with `DONE`, and `CheckoutSeat.status` gains `WON`. 121 is judged by `walkTotalJudge`, not `storedTotalJudge`: a stamped total is walked from the visit's start under the double-out rule (`CHECKOUT`, `BUST`, else `SPENT` at the remainder). A keypad total is refused while a board visit is open — the legacy engine accepted it and opened a round its own fold did not count; the play page never offers both inputs in one session.

## 4. Policy library (phase 1)

`app/src/modules/game/checkout-policies.ts`. A policy lands only with its
first caller (fallow dead-code gate). Names are indicative; the plan fixes
them. Each preserves the engine's exact branch, quirks included.

| Policy | Kind | First caller |
| --- | --- | --- |
| `dartWalkJudge` (absorbs `walkVisit`, `isFinishingDart`) | judge | Checkout Sequence |
| `listTarget(first, last)` | target | Checkout Sequence |
| `seededDrawTarget(drawSeed, pool)` (wraps `drawStartScore`) | target | Random Checkout |
| `unreachableFails` (wraps `dartWalkJudge`) | judge | Random Checkout |
| `storedTotalJudge` | judge | TUOD (success = `totalScore > 0`) |
| `walkTotalJudge` | judge | 121 (refined by the PR 4 plan, 2026-10-28) |
| `winAtCap(cap)`, `untilWon(next)` | onAttemptClose, target | 121 (refined by the PR 4 plan, 2026-10-28) |
| `ladderStep(up, down, floor, cap, onCap)` | onAttemptClose | TUOD (`+finishBonus`, `−missPenalty`, 2, 170, clamp); 121 (`+1`, `0`, —, 170, `WON`) |

## 5. Kernel-config rows

| Engine | `target` | `judge` | visits / attempt | `onAttemptClose` | Ends | Outcome (in engine) |
| --- | --- | --- | --- | --- | --- | --- |
| Checkout Sequence | `listTarget(firstOutshot..lastOutshot)` | `dartWalkJudge` | `dartLimit / 3` (= 2; `dartLimit` is `z.literal(6)`) | points by darts used (≤2 → 3, 3 → 2 or 3 for 99, else 1); next outshot | past last outshot (shell `ends`) or timer | timer only |
| Random Checkout | `seededDrawTarget(drawSeed, RANDOM_CHECKOUT_POOL)` | `unreachableFails` | 1 | count checkout; `lastAttempt` | timer | timer only |
| TUOD | ladder from `startingTarget` | `storedTotalJudge` | 1 | `ladderStep(+finishBonus, −missPenalty, 2, 170)`; success/failure tallies | ROUNDS / MINUTES budget (engine) | `scoreCompareOutcome` HIGHEST |
| 121 | ladder from 121 | `storedTotalJudge` | 3 | `ladderStep(+1, 0, —, 170 → WON)`; `attemptsCompleted` | WON or budget (engine) | `raceWinner`; solo null |

Record-time rules kept in the engine (run before the turn closes, so the
kernel sees only a judged visit):

- TUOD: `visitOutcome` — last-dart remainder no double can finish busts;
  success needs a checkout on a double; `closedVisitTotal` settles
  `totalScore` to the target or 0; the attempt-total guard.
- 121: `finalVisitHasNoFinishLeft`; `checkoutDartsRejection`;
  `isPlayableVisitScore`.

Both exercises move onto `dart-exercise-shell.module.ts` as
`DartExerciseSpec`s, deleting their hand-written classes (as Switching
Target Scoring under Track PR 7).

## 6. Shell changes

All additive: existing specs compile unchanged.

| Change | Shell | Lands in |
| --- | --- | --- |
| Optional `visitInput?: { isVisit(input), refusal(before, input), total(before, input) }`: the shell writes one closed, dartless turn; `record` and `wouldComplete` accept `DartObservation \| TVisit` | game | PR 3 (TUOD) |
| Existing `closedVisitTotal` settles TUOD's per-dart `totalScore` | game | PR 3 (reuse, no change) |
| Optional `stageFor?(state)`: the shell opens a new root stage when the returned stage changes; `undo` pops a stage left empty | game | PR 4 (121) |

Refined by the PR 3 plan (2026-10-27): beyond `visitInput`, the shell takes optional `coordinateCapture` (darts resolve from their coordinates via `resolveObservation`, carry no intent, and leave an open turn's `totalScore` unwritten — TUOD is coordinate-captured), `complete(state, config)` (replaces `isComplete()`), `isVisitOpen(turn, state, config)`, `wouldComplete(state, input, config, open)` and `closedVisitTotal(opened, closed, participantRef, turn, config)`; `undo()` uses `undoLastUnit` when `visitInput` is declared.

Refined by the PR 4 plan (2026-10-28): `stageFor(state)` is a pure function of the folded state (121: `round-(1 + Σ attempts − won)`); with it the shell counts turn `sequence` within its stage and undoes with `undoStagedTurn`. Two further optional hooks: `liveTotal` (an open turn's `totalScore` is its darts' sum under `coordinateCapture`) and a third `complete` argument, `expiredAt` — the state at the latest `expireTimer()` call (121's `MINUTES` rule).

## 7. Migration method (per PR)

Track §7 unchanged:

1. **Commit 1** — copy the old engine to the test tree as `legacy`; add the
   oracle test against it.
2. **Commit 2** — rebind onto the kernel. Oracle (`app/tests/modules/game/support/engine-oracle.ts`):
   seeded random inputs, undos interleaved, rehydration every N steps; 1 and
   2 seats for TUOD and 121, solo for the exercises; TUOD and 121 mix
   per-dart and visit-total inputs in one log; 121 asserts `facts().stages`
   after every undo. Existing engine tests pass unchanged.
3. **Commit 3** — record golden + step-trace snapshots (one line per dart or
   visit), delete `legacy`.

Quirks: verified with a probe test, filed as `discovered-work`, never fixed
here.

**Gates per PR:** `npm test`, `npm run check` (0 hints), fallow
(duplication must not rise; must fall in PR 2), all `check-*.sh`,
`check-engine-kernels.sh` with the engine's registry row flipped to
`KERNEL_BOUND`, `check-test-coverage.sh`.

## 8. Sequencing

One engine per PR; each merges before the next but one starts (stack cap).

| PR | Engine | Brings |
| --- | --- | --- |
| 0 | — | this spec |
| 1 | Checkout Sequence | `checkout-kernel.module.ts`, `checkout-policies.ts`, `dartWalkJudge`, `listTarget`, `foldCheckoutVisits`; onto the exercise shell; D-entry (kernel form, C3 order reversal); Pattern 18 Checkout row → `built` |
| 2 | Random Checkout | `seededDrawTarget`, `unreachableFails`; second `walkVisit` deleted; onto the exercise shell |
| 3 | Ten Up One Down | game-shell `visitInput`; `ladderStep`, `storedTotalJudge`, `foldCheckoutSeats` |
| 4 | 121 | game-shell `stageFor`; `ladderStep` cap → WON |

## 9. Docs per PR

- Pattern 18 §Rule-kernel families Checkout row: status, bound engines;
  version bump.
- `app/src/modules/game/CLAUDE.md`: one Checkout bullet (PR 1), extended per
  PR; `app/src/modules/training/CLAUDE.md` exercise-shell bullet (PR 1–2).
- `00-File-Inventory.md` rows for new modules; `00-Context-Map-History.md`
  entry.
- `decisions/game-engine.md`: one D-entry in PR 1 (id via
  `bash scripts/next-decision-id.sh`, re-run before the PR).
- `scripts/engine-kernels.txt`: flip each row; Bullseye Checkout reason →
  "re-checked when its exercise shell is next touched".

## 10. Out of scope

- New Checkout games (own wave spec).
- Bullseye Checkout migration; 501 (HAND_WRITTEN).
- Any rules change to a shipped engine, including quirks found.
- Schema changes (none needed).

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| Mixed per-dart / visit-total input drifts | oracle drives both input kinds in one log |
| 121 `ROUND` stage undo | oracle asserts `facts().stages` after every undo |
| `judge` hides record-time rules | rules stay in the engine (§5); goldens cover bust, unreachable and final-visit fail |
| `project` hides a state drift | oracle deep-equals `state()` and `facts()` after every step |
| Shell changes break bound engines | additive only; Track goldens re-run every PR |
