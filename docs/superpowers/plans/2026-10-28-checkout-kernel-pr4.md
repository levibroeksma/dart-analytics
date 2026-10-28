# Checkout Kernel PR 4 — 121 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move 121 onto the Checkout kernel and the game shell (`dart-engine-shell.module.ts`), with no behaviour change, deleting its hand-written class. This closes the Checkout wave: all four engines `KERNEL_BOUND`.

**Architecture:** The kernel keeps a seat that a policy marked `WON` (today it overwrites it with `DONE`). `checkout-policies.ts` gains `walkTotalJudge` (an unstamped turn is `OPEN`; a stamped total is judged against the visit's start under the double-out rule), `winAtCap` (`onAttemptClose`) and `untilWon` (a `nextTarget` wrapper). The game shell gains three additive, optional hooks: `stageFor(state)` (a root stage per attempt; `undo` pops a stage left empty), `liveTotal` (an open turn's `totalScore` is its darts' board-score sum), and a third `complete(state, config, expiredAt)` argument (the state when `expireTimer()` was called). 121 becomes a `DartGameSpec` serving both ruleset keys; its record-time rules (bust, final-visit no-finish-left, keypad guards) stay in the engine as spec functions. Proof as PR 1–3: legacy copy + differential oracle (mixed input), goldens recorded before the rebind, then legacy deleted.

**Tech Stack:** TypeScript, Vitest, Zod; repo gates (`check-*.sh`, `validate:app`, fallow).

**Spec:** `docs/superpowers/specs/2026-10-27-checkout-kernel-design.md` (PR 4 row, §3, §6, §8). Prior plans: `…-checkout-kernel-pr1.md` (#1113), `…-pr2.md` (#1115) merged; `…-pr3.md` (#1124) open — this branch is cut from it.

## Global Constraints

- No behaviour change: `state()`, `facts()` (open-turn `totalScore` and every stage included), thrown messages, `OneTwentyOneState`/`OneTwentyOneSeatState` shape, and the exports `foldOneTwentyOneState`, `applyOneTwentyOneVisit`, `initialOneTwentyOneState`, `durationOf`, `OneTwentyOneEngine`, `oneTwentyOneEngineFactory`, `oneTwentyOneV2EngineFactory` identical in signature and result.
- `OneTwentyOneEngine` stays an exported class (`one-twenty-one-play.data.ts` narrows with `instanceof`); `121_V1` and `121_V2` stay registered, `121_V1` reading `TARGET` whatever config it is handed.
- Persistence unchanged: one `ROUND` stage per attempt (`round-N`, `sequence` N, root), one `turns` row per visit with `sequence` counted within its stage, one `darts` row per dart, none for a keypad total; `QUICK_SCORE` keypad total or per-dart `VISUAL_BOARD`; coordinate-captured, no intent; no new fact columns.
- Reuse `resolveCheckoutAttempt`, `checkoutDartsRejection`, `isCheckoutReachable`, `activeSeat`, `raceWinner`, `durationOf`, `undoStagedTurn`, `appendCompletedTurn`, `appendResolvedDart`; never re-declare a walk.
- Shell changes are additive and optional: every bound engine's goldens and oracle (Track, Shanghai, Baseball, exercises, TUOD) re-run unchanged, no snapshot touched.
- A policy lands only with its first caller (fallow dead-code gate); fallow duplication must not rise.
- `modules/game/**` never imports `modules/training/**`.
- No `//` comments inside function bodies in `app/src/**`; JSDoc above declarations only, no decision history in doc comments.
- Exported types live in `types.ts`/`interfaces.ts`, imported through `@modules/types` / `@modules/interfaces` (`check-type-barrels.sh`, also on the legacy copy).
- TDD per `app/CLAUDE.md`: failing test first, watched fail, then code.
- Never `--no-verify`. Pre-commit runs 14 gates (~2 min): run commits in the background with a long timeout and poll.
- Gate traps from PR 3: `check-test-coverage` fails a commit whose source edit has no covering test edit in the same commit; `check-doc-sync` reads staged or committed diff, so stage the docs before running it; run `task-done` only after the commit succeeded.
- Branch: `feat/checkout-kernel-121`, cut from `feat/checkout-kernel-tuod`. The PR targets `feat/checkout-kernel-tuod` (one stacked branch, within the cap); retarget to `main` once #1124 merges.
- No new decision entry: PR 4 executes D500.

## Refinements to the spec (rulings made while planning)

Recorded in the spec §3/§6 in Task 6.

- **`ladderStep(+1, 0, —, 170 → WON)` is three policies.** `ladderTarget(1, 0, 121, 170)` names the next target; `winAtCap(170)` (`onAttemptClose`) marks a pass at the cap `WON`; `untilWon(next)` makes `nextTarget` return `null` for a `WON` seat. The kernel keeps `WON` instead of overwriting it with `DONE`. A `WON` seat projects `remainingInAttempt: 0`.
- **`storedTotalJudge` does not fit 121** (three visits, remainder carries, bust and spent are distinct). A second judge, `walkTotalJudge`, judges a stamped total with `resolveCheckoutAttempt(seat.visitStart, total, true)`: checked out → `CHECKOUT`, busted → `BUST`, else `SPENT` at the remainder. A stored bust is 0, so it carries the visit's start, exactly the legacy fold.
- **Shell gaps beyond spec §6 `stageFor`:** `liveTotal` (legacy writes an open turn's `totalScore` as its dart sum after every dart; `coordinateCapture` leaves it unwritten), turn `sequence` counted within the turn's stage (legacy; the shell counts the whole log), and `complete(state, config, expiredAt)` (MINUTES completion compares attempts against the count when the clock ran out, which only the shell can snapshot). With `stageFor`, `undo()` is `undoStagedTurn`.
- **`stageFor` is a pure function of state:** `round-(1 + Σ seats (attempts − (WON ? 1 : 0)))`. A closing visit opens the next stage unless that seat just won — the legacy rule (`visitsThisAttempt === 0 && IN_PROGRESS`) restated on the fold.
- **`applyOneTwentyOneVisit` stays** as the guards (playable score, checkout darts, seat complete — same order, same messages) followed by one kernel step on a stored total (`resolveOneTwentyOneVisit(...).scored`).
- **Unreachable guards dropped:** the legacy "session is complete" refusals for a seat that is `WON` while the match is `IN_PROGRESS` cannot occur (a `WON` seat makes the state `WON` first). Messages differ by path and are kept per path: the dart refusal is "Cannot record a visit once the match has ended" (spec `refusal`), the keypad one carries "; undo first to correct it." (`visitInput.refusal`).
- **Quirks preserved, filed in Task 7 as `discovered-work`, never fixed:** (a) a keypad total is accepted while a board visit is open and is scored against the live (overlaid) remainder; (b) `ROUNDS`/`MINUTES` read the sole seat only, with no engine guard against two seats (setup-UI convention). The oracle must show whether (a) is reachable identically; if it diverges, rule and ledger it before the rebind.

## Review Focus

1. A round stage per attempt: `facts().stages` after every step and every undo, including undoing the dart or keypad visit that opened a stage, a stage popped when its only turn goes, and rehydrating mid-round. Pinned by the oracle (`facts()` deep-equal) and golden trace (Task 1, 4).
2. Race to 170: the first seat to check out at 170 wins at once; the trailing seat gets no further turn; a `WON` seat opens no stage; undo from `WON`. Pinned by oracle `TARGET` duel with a high check-out rate and engine tests.
3. Final visit of an attempt: the visit closes the instant no double-out route remains in the darts left; visits 1 and 2 never close early. Pinned by oracle board mix and golden.
4. Bust: stored as 0, remainder carried, visit counted; third non-checkout visit resets to the same target with a fresh budget. Pinned by oracle.
5. Mixed input in one log: keypad total after board darts, board dart after a keypad total, guards (score 181, impossible dart counts), keypad while a board visit is open (quirk a). Pinned by oracle visit rate 0.25.
6. `ROUNDS` and `MINUTES` (expiry mid-attempt, the in-flight attempt finishes, `resumeExpired` rehydration); `121_V1` config with no duration fields. Pinned by oracle `expireAt` + `resumeExpired` and the V1 case.

---

### Task 1: Branch, plan, freeze — 121 input generator, legacy copy, oracle, goldens

**Files:**
- Create: `docs/superpowers/plans/2026-10-28-checkout-kernel-pr4.md` (this file, committed)
- Modify: `app/tests/modules/game/support/checkout-observations.ts` (add `oneTwentyOneInputs`)
- Create: `app/tests/modules/game/legacy/one-twenty-one.legacy.ts`
- Create: `app/tests/modules/game/one-twenty-one.oracle.test.ts`
- Create: `app/tests/modules/game/one-twenty-one.golden.test.ts` (+ its `__snapshots__` file)

**Interfaces:**
- Consumes: `runOracle<TInput>`, `goldenTrace<TInput>` (already input-generic), `randomObservation`, `located` (module-private in `checkout-observations.ts`), `finishingShot` (private there too).
- Produces: `oneTwentyOneInputs(visitRate, towardRate, checkoutRate)`; `LegacyOneTwentyOneEngine`.

- [ ] **Step 1: Branch and commit the plan**

```bash
cd /home/user/dart-analytics
git checkout -b feat/checkout-kernel-121 feat/checkout-kernel-tuod
git add docs/superpowers/plans/2026-10-28-checkout-kernel-pr4.md
git commit -m "docs(plan): checkout kernel PR 4 — 121"
```

- [ ] **Step 2: Add the 121 input generator**

Append to `app/tests/modules/game/support/checkout-observations.ts` (extend its type import with `OneTwentyOneInput`, `OneTwentyOneVisitInput`, `OneTwentyOneState`):

```ts
function randomVisit(
  rand: () => number,
  remaining: number,
  checkoutRate: number,
): OneTwentyOneVisitInput {
  const count = (1 + Math.floor(rand() * 3)) as 1 | 2 | 3;
  const atDouble = (1 + Math.floor(rand() * 3)) as 1 | 2 | 3;
  if (rand() < checkoutRate)
    return {
      scoreAttempted: remaining,
      finishedOnDouble: true,
      dartsUsed: count,
      dartsAtDouble: atDouble,
    };
  return {
    scoreAttempted: Math.floor(rand() * 185),
    finishedOnDouble: rand() < 0.5,
    dartsUsed: count,
    dartsAtDouble: atDouble,
  };
}

/**
 * Mixes the two 121 input shapes in one log: with probability `visitRate` a
 * keypad total — an exact check-out of the active seat's live remainder with
 * probability `checkoutRate`, else any score in `0..184` (out-of-range ones
 * fire the guard) — otherwise a located board dart, towards the remainder with
 * probability `towardRate`, else random.
 */
export function oneTwentyOneInputs(
  visitRate: number,
  towardRate: number,
  checkoutRate: number,
) {
  return (
    rand: () => number,
    engine: OracleEngine<OneTwentyOneInput>,
  ): OneTwentyOneInput => {
    const state = engine.state() as OneTwentyOneState;
    const seat = state.seats.find(
      (candidate) => candidate.participantRef === state.activeParticipantRef,
    )!;
    if (rand() < visitRate)
      return randomVisit(rand, seat.remainingInAttempt, checkoutRate);
    if (rand() >= towardRate || seat.remainingInAttempt <= 1)
      return located(randomObservation(rand));
    return located(finishingShot(seat.remainingInAttempt));
  };
}
```

(If `DartCount` rejects the `1 | 2 | 3` casts, import and use it.)

- [ ] **Step 3: Copy the engine as legacy**

Create `app/tests/modules/game/legacy/one-twenty-one.legacy.ts` from `app/src/modules/game/one-twenty-one.engine.module.ts`: rewrite the header so every type import goes through `@modules/types` / `@lib/types`; keep the body from `const START_TARGET` through `export class OneTwentyOneEngine` verbatim; rename the class `LegacyOneTwentyOneEngine`; export only `LegacyOneTwentyOneEngine` (the helper functions stay module-private; `durationOf` is imported from the real engine module, it does not change); drop both factories and their `registerEngineFactory` calls. Add `// fallow-ignore-next-line unused-class-member` above `expireTimer` as the TUOD legacy copy did. Imports of sibling helpers use `@modules/game/…` paths.

Run: `cd app && npx tsc --noEmit -p . 2>&1 | head` — Expected: no errors from the new file.

- [ ] **Step 4: Write the oracle test (RED is "it runs and passes against the unchanged engine")**

`app/tests/modules/game/one-twenty-one.oracle.test.ts`, modelled on `tuod.oracle.test.ts` (fake timers pinned to `2026-11-01T10:00:00Z`; `SEEDS` 1–12):

```ts
const v1 = (n: number): Seated<OneTwentyOneSnapshot> => ({ seats: seats(n) });
const v2 = (
  n: number,
  over: Pick<OneTwentyOneV2Snapshot, "durationType" | "durationValue">,
): Seated<OneTwentyOneV2Snapshot> => ({ ...over, seats: seats(n) });

const CASES = {
  "v1 solo, target": { build: v1(1), key: "121_V1", steps: 500 },
  "v1 duel, race": { build: v1(2), key: "121_V1", steps: 700 },
  "v2 solo rounds": { build: v2(1, { durationType: "ROUNDS", durationValue: 6 }), key: "121_V2", steps: 300 },
  "v2 duel rounds": { build: v2(2, { durationType: "ROUNDS", durationValue: 5 }), key: "121_V2", steps: 400 },
  "v2 solo minutes, expired": { build: v2(1, { durationType: "MINUTES", durationValue: 10 }), key: "121_V2", steps: 300, expireAt: 200 },
};
```

Each case runs the mixes `["boards and keypad", 0.25, 0.7, 0.6]` and `["boards mostly", 0.04, 0.85, 0.5]` as `runOracle<OneTwentyOneInput>({ build: (prior) => new OneTwentyOneEngine(config, prior, key), legacy: (prior) => new LegacyOneTwentyOneEngine(config, prior, key), seeds: SEEDS, steps, undoRate: 0.12, rehydrateEvery: 13, expireAt, resumeExpired: expireAt !== undefined, observe: oneTwentyOneInputs(visitRate, towardRate, checkoutRate) })`. (The TARGET cases need `checkoutRate` ≥ 0.5 and enough steps to climb 121→170 for the cap; assert nothing about reaching it — the golden in Step 5 does.)

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.oracle.test.ts` — Expected: PASS (new engine and legacy are the same class today). Make a sanity RED: temporarily change `START_TARGET` in the legacy copy to 122, re-run, confirm a `seed … diverged` failure, revert.

- [ ] **Step 5: Record the goldens from the unmodified engine**

`one-twenty-one.golden.test.ts` with `goldenTrace<OneTwentyOneInput>` against the real `OneTwentyOneEngine` (still hand-written), a `describeInput` label (`visit <score>/<double>` for a keypad total, `<zone>/<number>` for a dart), seed 7, `undoRate: 0.1`, `rehydrateEvery: 17`, and these cases (each must be shown to hit what its name says; assert on the snapshot's final `state`/`facts` while writing, then leave only the snapshot): `v1 solo to the cap` (400 steps, `oneTwentyOneInputs(0.35, 0.9, 0.9)`, ends `WON`), `v1 duel race` (500 steps, ends `WON`, trailing seat stops), `v2 solo rounds` (ROUNDS 6), `v2 duel rounds`, `v2 solo minutes` (`expireAt: 150`, `resumeExpired`), `v1 solo boards only, final-visit close` (steps 260, `oneTwentyOneInputs(0, 0.6, 0)`), `v1 solo keypad only, busts and guards` (steps 200, `oneTwentyOneInputs(1, 0, 0.3)`).

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.golden.test.ts -u` then re-run without `-u` — Expected: 7 written, then 7 passed. Read the snapshot head and tail of the cap case to confirm a `WON` seat and a stage per attempt.

- [ ] **Step 6: Gates and commit**

```bash
cd app && npx astro check --minimumFailingSeverity hint 2>&1 | tail -3
cd .. && git add -A app/tests && git commit -m "test(121): freeze legacy engine, oracle with mixed input, goldens"
```

Expected: 0 errors / 0 warnings / 0 hints; commit lands (run it in the background, poll — pre-commit ~2 min).

---

### Task 2: Shell — `stageFor`, `liveTotal`, `complete` with the expiry state

**Files:**
- Modify: `app/src/modules/game/interfaces.ts` (`DartGameSpec`)
- Modify: `app/src/modules/game/dart-engine-shell.module.ts`
- Test: `app/tests/modules/game/dart-engine-shell.module.test.ts`

**Interfaces:**
- Consumes: `undoStagedTurn`, `appendCompletedTurn`, `openOrCreateTurn`, `sumDartScores`, `exerciseBlockStage`.
- Produces on `DartGameSpec`:
  - `stageFor?(state: TState): StageFact` — the stage the state is in; the shell opens it when its `clientKey` differs from the open stage's, after a record. The first stage is `stageFor` of the empty fold.
  - `liveTotal?: boolean` — after each dart the turn's `totalScore` is its darts' board-score sum (with `coordinateCapture`, which otherwise leaves it unwritten).
  - `complete?(state, config, expiredAt: TState | null): boolean` — `expiredAt` is the state when `expireTimer()` first ran (null before).

- [ ] **Step 1: Write the failing tests**

In the shell test file add a `describe("stage, live total and expiry hooks")` using a tiny inline spec (a hook-less spec's existing tests stay untouched):

- `stageFor`: a spec whose state counts closed turns and `stageFor(state)` returns `round-{closed+1}`. Record darts until two visits close → `facts().stages.map(s => s.clientKey)` is `["round-1","round-2","round-3"]`; each turn's `stageClientKey` is the stage open when it started; a turn's `sequence` counts within its stage (second turn of `round-2` has `sequence` 1); `undo()` of the dart that opened `round-3`'s predecessor pops the stage; `undo()` to empty leaves `[round-1]`; rehydrating from `facts()` keeps the stages.
- `liveTotal`: an open turn's `totalScore` equals its darts' sum after each dart and after an `undo()` reopens it; without `liveTotal` (but with `coordinateCapture`) it stays 0 (the existing behaviour, assert it).
- `complete` third argument: spec `complete` returns `expiredAt !== null && state.closed > expiredAt.closed`; assert false before `expireTimer()`, false after it while the open visit stands, true once that visit closes; undo after expiry keeps `expiredAt` (still the first snapshot).

Run: `cd app && npx vitest run tests/modules/game/dart-engine-shell.module.test.ts` — Expected: the new cases FAIL (hooks not defined: stages never advance, `totalScore` 0, `expiredAt` undefined).

- [ ] **Step 2: Implement**

`interfaces.ts` — add the three members above to `DartGameSpec` with one-line docs (what, not why). Change `complete?(state: TState, config: TConfig): boolean;` to `complete?(state: TState, config: TConfig, expiredAt: TState | null): boolean;` (TUOD's two-argument `complete` still type-checks).

`dart-engine-shell.module.ts`:
- `private readonly stages: StageFact[]` and `private expiredAt: TState | null = null`.
- Constructor: `this.stages = prior && prior.stages.length > 0 ? prior.stages.map((s) => ({ ...s })) : [spec.stageFor ? spec.stageFor(spec.fold({ stages: [{ ...stage }], turns: [] }, config, false)) : { ...stage }]`.
- `foldTurns` passes `this.stages.map(...)` copies instead of `[{ ...stage }]`.
- `private openStageKey()`: `this.stages.at(-1)!.clientKey`; `recordVisit`/`recordDart` use it instead of `stage.clientKey`.
- After a new turn is written (`openOrCreateTurn` created one, or `appendCompletedTurn`), when `spec.stageFor` is set: `turn.sequence = this.turns.filter((t) => t.stageClientKey === turn.stageClientKey).length`.
- `liveTotal`: after `appendResolvedDart`, `if (spec.liveTotal) turn.totalScore = sumDartScores(turn.darts)`.
- `syncStage()` called at the end of `recordVisit` and, when the visit closed, in `recordDart`: `const next = spec.stageFor?.(this.deriveState()); if (next && next.clientKey !== this.openStageKey()) this.stages.push({ ...next })`.
- `undo()`: `spec.stageFor ? undoStagedTurn(this.turns, this.stages) : spec.visitInput ? undoLastUnit(...) : undoLastDart(...)`.
- `expireTimer()`: `this.expiredAt ??= this.deriveState();` before setting the flag.
- `isComplete()`: `spec.complete(state, this.config, this.expiredAt)`.
- `facts()` returns `this.stages` copies.

Run the shell test file — Expected: PASS. Then `npx vitest run tests/modules/game tests/modules/training` — Expected: every existing oracle, golden and engine test passes with no snapshot change.

- [ ] **Step 3: Gates and commit**

`npx astro check --minimumFailingSeverity hint | tail -3` (0/0/0); then commit `feat(game): shell hooks — stage per attempt, live total, expiry state`.

---

### Task 3: Kernel and policies — `WON` kept, `walkTotalJudge`, `winAtCap`, `untilWon`

**Files:**
- Modify: `app/src/modules/game/checkout-kernel.module.ts`, `checkout-policies.ts`
- Test: `app/tests/modules/game/checkout-kernel.module.test.ts`, `checkout-policies.test.ts`

**Interfaces:**
- Consumes: `resolveCheckoutAttempt`, `sumDartScores`, `ladderTarget`.
- Produces:
  - `walkTotalJudge<TExt>(seat, turn): VisitVerdict` — unstamped → `OPEN { remaining: visitStart − sumDartScores(darts), darts: darts.length }`; stamped → with `outcome = resolveCheckoutAttempt(seat.visitStart, turn.totalScore, true)`: `checkedOut` → `CHECKOUT { darts }`, `busted` → `BUST`, else `SPENT { remaining: outcome.remainingAfter }`.
  - `winAtCap(cap): <TExt>(seat, passed) => CheckoutSeat<TExt>` — `passed && seat.target >= cap` → `{ ...seat, status: "WON" }`, else `seat`.
  - `untilWon(next)`: `(seat, passed) => seat.status === "WON" ? null : next(seat, passed)`.
  - Kernel `closeAttempt`: `status: next === null && closed.status === "IN_PROGRESS" ? "DONE" : closed.status`.

- [ ] **Step 1: Failing tests**

`checkout-policies.test.ts`: `walkTotalJudge` — unstamped with darts 20+20 from `visitStart` 121 → `OPEN` remaining 81 darts 2; stamped 121 → `CHECKOUT`; stamped 0 → `SPENT` remaining = `visitStart`; stamped 60 from 121 → `SPENT` 61; stamped 120 from 121 (leaves 1) → `BUST`; stamped 130 → `BUST`. `winAtCap(170)` — passed at 170 → `WON`; passed at 169 → unchanged; failed at 170 → unchanged. `untilWon` — `WON` seat → `null`, otherwise delegates.
`checkout-kernel.module.test.ts`: a rules record with `onAttemptClose: winAtCap(170)` and `nextTarget: untilWon(ladderTarget(1, 0, 121, 170))` — a check-out at 170 leaves `status: "WON"`, `target` 170, `attempts` +1, `visitIndex` 0; a `nextTarget` of `null` without `WON` still gives `DONE` (the existing case, unchanged).

Run both files — Expected: new cases FAIL (not exported; kernel gives `DONE`).

- [ ] **Step 2: Implement** the four items above, with JSDoc above each declaration. Run both files — Expected: PASS; `npx vitest run tests/modules/game tests/modules/training` — Expected: all pass, no snapshot change.

- [ ] **Step 3: Gates and commit:** `feat(game): checkout kernel keeps WON; walk-total judge, cap win, until-won`. Fallow will flag the three policies until Task 4 binds them: run the fallow gate after Task 4, not here, and confirm the commit's pre-commit passes (fallow is not a pre-commit gate).

---

### Task 4: Rebind 121 onto the kernel and the game shell

**Files:**
- Modify: `app/src/modules/game/one-twenty-one.engine.module.ts`
- Test: `app/tests/modules/game/one-twenty-one.engine.module.test.ts` (existing 101 cases unchanged; add the preserved-quirk cases below)

**Interfaces:**
- Consumes: everything from Tasks 2–3; kernel `foldCheckoutSeats`, `initialCheckoutSeat`, `applyCheckoutVisit`; `dartGameEngineClass`, `dartGameEngineFactory`.
- Produces: unchanged exports (see Global Constraints).

- [ ] **Step 1: Failing test for the preserved quirks**

In the engine test file add `describe("preserved legacy behaviour")`: (a) with a board visit open (one dart thrown), a keypad total is accepted and recorded as its own closed turn, scored against the live remainder (expect `remainingInAttempt` and the turn `totalScore` the legacy copy produced — compute both from the legacy engine in the oracle run and hard-code them); (b) a duel `ROUNDS` config reads only seat 0's `attemptsCompleted` for `isComplete()`. Run it first against the unmodified engine — Expected: PASS (it pins today); it must stay green after the rebind.

- [ ] **Step 2: Rewrite the engine** (single pass; delete what the kernel and shell now own)

Keep, unchanged in text: `durationOf`, the constants, `isPlayableVisitScore`, `resolveOneTwentyOneVisit`, `checkoutDartsRejectionFor`, `finalVisitHasNoFinishLeft` (re-typed on `(visitIndex, remainingAfter, dartsThrown)`), `roundStage`.

Add:

```ts
function rules(): CheckoutRules<null> {
  return {
    visitsPerAttempt: VISITS_PER_ATTEMPT,
    judge: walkTotalJudge,
    onAttemptClose: winAtCap(CAP_TARGET),
    nextTarget: untilWon(ladderTarget(1, 0, START_TARGET, CAP_TARGET)),
  };
}
const initialSeat = () => initialCheckoutSeat(START_TARGET, null);

function seatState(seat: CheckoutSeat<null>, identity: SeatFact): OneTwentyOneSeatState {
  const won = seat.status === "WON";
  return {
    participantRef: identity.participantRef,
    sideKey: identity.sideKey,
    currentTarget: seat.target,
    remainingInAttempt: won ? 0 : seat.remaining,
    visitsThisAttempt: seat.visitIndex,
    status: won ? "WON" : "IN_PROGRESS",
    attemptsCompleted: seat.attempts,
  };
}
```

- `initialOneTwentyOneState` builds from `seatState(initialSeat(), seat)`.
- `applyOneTwentyOneVisit(state, input)`: the three guards in the legacy order (score range, `checkoutDartsRejectionFor`, status) then `applyCheckoutVisit(seatFromState(state), storedVisit(resolveOneTwentyOneVisit(...).scored), rules())` projected back with `seatState` (keeps `participantRef`/`sideKey` from `state`). `seatFromState` rebuilds a `CheckoutSeat` (`target: currentTarget`, `visitStart: remainingInAttempt`, `remaining: remainingInAttempt`, `visitIndex: visitsThisAttempt`, `attempts: attemptsCompleted`, `checkouts: 0`, `dartsInVisit: 0`, `status: "IN_PROGRESS"`); `storedVisit(total)` is a closed `TurnFact` with `darts: []`.
- `foldOneTwentyOneState(facts, config, timerExpired)`: `seats = foldCheckoutSeats(facts.turns, config.seats, initialSeat(), rules()).map(seatState)`; `winningSideKey`/`status`/`activeParticipantRef`/`timerExpired` exactly as today (`activeSeat(facts, config.seats, "PER_SEAT")`, 3-argument form).
- Spec functions (module-private):
  - `resolveDartVisit(start, visitIndex, darts)` → `{ resolved, total }`: `thrown = sumDartScores(darts)`; `outcome = resolveCheckoutAttempt(start, thrown, lastDartFinishes)` with `lastDartFinishes` = last dart `DOUBLE` or `INNER_BULL`; busted → `{ resolved: true, total: 0 }`; else `resolved = checkedOut || darts.length === 3 || finalVisitHasNoFinishLeft(visitIndex, outcome.remainingAfter, darts.length)`, `total: thrown`.
  - `visitStartOf(seat, turn)` = `seat.remainingInAttempt + sumDartScores(turn.darts)` (the state includes the open turn's overlay).
  - `isOneTwentyOneVisitOpen(turn, state, _config)`: closed → false; no darts → true; else `!resolveDartVisit(visitStartOf(seat, turn), seat.visitsThisAttempt, turn.darts).resolved`.
  - `settledTotal(opened, _closed, ref, turn)`: `resolveDartVisit(ownSeat(opened, ref).remainingInAttempt, ownSeat(opened, ref).visitsThisAttempt, turn.darts).total`.
  - `visitRefusal(state, input, _config, _open)`: `state.status !== "IN_PROGRESS"` → "Cannot record a visit once the match has ended; undo first to correct it."; then the playable-score and `checkoutDartsRejectionFor` messages (no open-visit refusal — quirk a); else null. `visitInput.total(state, input)` = `resolveOneTwentyOneVisit(activeSeat.remainingInAttempt, input).scored`.
  - `wouldCompleteSession(state, input, config, _open)`: the legacy `wouldComplete` body on the active seat's overlaid `remainingInAttempt`: dart → one dart resolved with `resolveObservation`, check-out + (`currentTarget === CAP_TARGET` or `durationSatisfiedAfterCheckout`); keypad → guards false, `applyOneTwentyOneVisit(...).status === "WON"` or check-out + duration. `durationSatisfied(config, attemptsAfter, timerExpired)` replaces the private method.
  - `complete(state, config, expiredAt)`: `WON` → true; `TARGET` → false; `ROUNDS` → `seat0.attemptsCompleted >= (durationValue ?? 0)`; `MINUTES` → `state.timerExpired && seat0.attemptsCompleted > (expiredAt?.seats[0].attemptsCompleted ?? 0)`.
  - `stageFor(state)`: `roundStage(1 + Σ seat (attemptsCompleted − (status === "WON" ? 1 : 0)))`.
- `oneTwentyOneSpec: DartGameSpec<OneTwentyOneEngineConfig, OneTwentyOneState, OneTwentyOneVisitInput>` with `rulesetVersionKey: "121_V1"`, `rulesetVersionKeys: ["121_V2"]`, `stageOwnership: "PER_SEAT"`, `fold`, `refusal: (state) => state.status !== "IN_PROGRESS" ? "Cannot record a visit once the match has ended" : null`, `intent: () => NO_INTENT`, `isVisitOpen`, `wouldComplete`, `closedVisitTotal: settledTotal`, `visitInput`, `coordinateCapture: true`, `liveTotal: true`, `complete`, `stageFor`.
- `export class OneTwentyOneEngine extends dartGameEngineClass(oneTwentyOneSpec) {}`; `oneTwentyOneEngineFactory = dartGameEngineFactory(oneTwentyOneSpec, OneTwentyOneEngine)`; `oneTwentyOneV2EngineFactory = dartGameEngineFactory(oneTwentyOneSpec, OneTwentyOneEngine, "121_V2")`; both registered. The class doc keeps the ladder/race description (no history).

- [ ] **Step 3: Run the proof**

```bash
cd app && npx vitest run tests/modules/game/one-twenty-one tests/modules/game tests/lib/game tests/modules/stats tests/lib/stats
```

Expected: oracle (12 seeds × 5 configs × 2 mixes), the 7 goldens, the 101 existing engine cases and every dependent test PASS, no snapshot written. A divergence is a finding: diagnose with `superpowers:systematic-debugging`; if it is a legacy quirk the kernel cannot reproduce, rule it, ledger it, and pin it — never edit a snapshot.

- [ ] **Step 4: Fallow, types, commit**

```bash
cd app && bash ../scripts/fallow-gate.sh 2>&1 | tail -8
npx astro check --minimumFailingSeverity hint 2>&1 | tail -3
```

Expected: dead-code gate clean (the three policies now have a caller; `LegacyOneTwentyOneEngine` carries its ignore), duplication not up, 0/0/0. Commit `refactor(121): bind to the checkout kernel and the game shell`.

---

### Task 5: Drop the legacy copy

**Files:** Delete `app/tests/modules/game/legacy/one-twenty-one.legacy.ts`, `app/tests/modules/game/one-twenty-one.oracle.test.ts`.

- [ ] **Step 1:** `git rm` both; run `npx vitest run tests/modules/game` — Expected: PASS; goldens and the 101 engine cases stay as the guarantee (the TUOD oracle and goldens are untouched).
- [ ] **Step 2:** Commit `test(121): drop legacy copy; goldens hold the guarantee`.

---

### Task 6: Docs, registry, spec refinement

**Files:**
- Modify: `scripts/engine-kernels.txt` (121 row → `KERNEL_BOUND | Checkout kernel`, same reason text as the TUOD row)
- Modify: `docs/architecture/04-Architecture-patterns.md` (Pattern 18 Checkout row: all four engines bound, status `built`, version bump + the shell paragraph: `stageFor`, `liveTotal`, `complete(…, expiredAt)`; fix the citation near line 855 if it names 121 hand-written)
- Modify: `app/src/modules/game/CLAUDE.md` (shell and Checkout bullets: add 121, `stageFor`/`liveTotal`/`expiredAt`, `walkTotalJudge`, `winAtCap`, `untilWon`)
- Modify: `docs/architecture/00-File-Inventory.md` (new test files' rows only if the inventory lists tests; engine row notes), `docs/architecture/00-Context-Map-History.md` (version entry, dated 2026-10-28)
- Modify: `docs/superpowers/specs/2026-10-27-checkout-kernel-design.md` (§3 and §6: "Refined by the PR 4 plan (2026-10-28)" notes per the Refinements section; §4 table first caller of `winAtCap`/`untilWon`/`walkTotalJudge`)

- [ ] **Step 1:** Make each targeted edit (never regenerate). Dates on every changed entry.
- [ ] **Step 2:** `git add` the docs, then `bash scripts/check-doc-sync.sh && bash scripts/check-engine-kernels.sh && bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh` — Expected: all OK.
- [ ] **Step 3:** Commit `docs: 121 bound to the checkout kernel (D500)`.

---

### Task 7: Discovered work, full verification and PR

- [ ] **Step 1: Discovered work.** Per `capturing-discovered-work`: search `mcp__github__search_issues` first, then file `discovered-work` issues for quirk (a) (keypad total accepted while a board visit is open, scored against the overlaid remainder) and quirk (b) (`ROUNDS`/`MINUTES` read seat 0 only). Never fix. Re-state the three stale citations to deleted `TuodEngine` private methods (`tuod-play.data.ts`, `checkout-visits.module.ts`, `score-training.engine.module.ts`) and the unused `intent()` under `coordinateCapture` as already deferred in #1124 — file them now if still unfiled.
- [ ] **Step 2: Verify.** Invoke `run-all-gates` and `superpowers:verification-before-completion`: every "Always run" and "If `app/` changed" script, `cd app && npm run validate:app`, `npm run format` then `npm run format:check`. Report each result.
- [ ] **Step 3: Final review.** `review-package` over the branch against `feat/checkout-kernel-tuod`; one opus reviewer with the Review Focus section verbatim and the `Ruling:` lines; one fix pass, each fix RED→GREEN.
- [ ] **Step 4: Finish.** `superpowers:finishing-a-development-branch` + `finishing-a-dart-branch`: push `feat/checkout-kernel-121`, open the PR against `feat/checkout-kernel-tuod` (check for a PR template; body ends with the attribution line), `subscribe_pr_activity`. If #1124 has merged by then, merge `origin/main` into the branch (never rebase), target `main`.
