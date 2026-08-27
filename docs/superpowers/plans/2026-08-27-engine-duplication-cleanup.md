# Engine Duplication Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the double-out bust/checkout rule duplicated across 501, 121 and TUOD into one shared module, generalize `otherSeatsComplete` so TUOD and Score Training stop reimplementing it inline, and correct four stale spots in `docs/game-rules/rulesets/` found while comparing those three engines to their source material.

**Architecture:** Two new/changed pure modules in `app/src/modules/game/` (`checkout-bust.module.ts` new; `seat-state.module.ts`'s `otherSeatsComplete` gains a predicate parameter), wired into 5 existing engine files with no change to any engine's `state()`/`facts()` output. Doc corrections are Markdown-only edits to non-canonical raw notes, no code or schema involved.

**Tech Stack:** TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-27-engine-duplication-cleanup-design.md`

## Global Constraints

- Every task's runtime `.ts` edit must be accompanied by an edit to a covering test file in the **same task** — `scripts/check-test-coverage.sh` fails a change set that touches `app/src/**/*.ts` without also touching a test that imports it, and a whitespace-only touch is not an honest confirmation; add or extend a real assertion. (app/CLAUDE.md, D224)
- No `//` or `/* */` comments inside function/method bodies in `app/src/**/*.ts`. Put necessary detail in JSDoc above the declaration instead. (app/CLAUDE.md)
- Tests live under `app/tests/`, mirroring `app/src/`'s structure — never colocated beside the module under test. (app/CLAUDE.md)
- `bash scripts/check-game-engines.sh` must pass after any engine-file change (run from `app/`). (app/CLAUDE.md)
- Every code task in this plan is a **behavior-preserving refactor** — no engine's `record()`/`undo()`/`wouldComplete()`/`isComplete()`/`state()`/`facts()` output may change for any existing input sequence. Existing engine tests are the regression check; none of their assertions should need to change.
- `docs/game-rules/rulesets/*.md` are non-canonical raw notes (`docs/game-rules/README.md`) — no gate enforces them, so the doc tasks' only "done" signal is matching the existing per-file conventions (Features table / Objective / Capture / Bust section phrasing already established in `501.md` and `ten-up-one-down.md`).
- Do not commit unless the user has asked for it in this session (root `CLAUDE.md`). This plan's "Commit" steps assume execution under a mode where that has been established.
- Run all commands from `app/` unless a step says otherwise.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `app/src/modules/game/checkout-bust.module.ts` (new) | The double-out bust/checkout rule shared by 501, 121 and TUOD: `resolveCheckoutAttempt(remainingBefore, scored, endedOnDouble)`. No ruleset-specific escalation lives here. |
| `app/tests/modules/game/checkout-bust.module.test.ts` (new) | Direct tests of `resolveCheckoutAttempt`'s boundary cases. |
| `app/src/modules/game/five-oh-one.engine.module.ts` (modify) | `resolveFiveOhOneVisit`, `FiveOhOneEngine.settleVisit`, `FiveOhOneEngine.dartChecksOutFinalLeg` delegate to `resolveCheckoutAttempt`. |
| `app/src/modules/game/one-twenty-one.engine.module.ts` (modify) | `resolveOneTwentyOneVisit`, `OneTwentyOneEngine.settleVisit`, `OneTwentyOneEngine.wouldCompleteDart` delegate to `resolveCheckoutAttempt`; 121's own `finalVisitHasNoFinishLeft` escalation stays local. |
| `app/src/modules/game/tuod.engine.module.ts` (modify) | `visitOutcome` delegates its base rule to `resolveCheckoutAttempt`, ORs in its own odd-remainder escalation; both call sites pass `remainingBefore`+`scored` instead of a pre-netted `remainingAfter`. Also gains `otherSeatsComplete` usage (Task 6). |
| `app/src/modules/game/seat-state.module.ts` (modify) | `otherSeatsComplete` takes a completion predicate instead of assuming a `status` field. |
| `app/src/modules/game/around-the-clock.engine.module.ts` (modify) | `wouldComplete` passes the status predicate explicitly. |
| `app/src/modules/game/singles-training.engine.module.ts` (modify) | Same. |
| `app/src/modules/game/doubles-training.engine.module.ts` (modify) | Same. |
| `app/src/modules/game/score-training.engine.module.ts` (modify) | `wouldComplete` uses `otherSeatsComplete` with a duration-budget predicate instead of an inline `filter().every()`. |
| `docs/game-rules/rulesets/{121,ten-up-one-down,score-training,bobs-27,around-the-clock,shanghai}.md` (modify) | Features-table `Multiplayer` row: `TBD` → `V1`. |
| `docs/game-rules/rulesets/{singles-training,doubles-training}.md` (modify) | Move the shipped 1v1 win condition out of "Later versions (V2+)" into Objective; fix the same Features-table row. |
| `docs/game-rules/rulesets/501.md` (modify) | Known limitations / Open questions / Capture updated to reflect that VISUAL_BOARD capture already resolves the documented bust-rate limitation. |
| `docs/game-rules/rulesets/121.md` (modify) | Add a Capture section; document the final-visit early-bust rule in Bust. |

---

### Task 1: `checkout-bust.module.ts`

**Files:**
- Create: `app/src/modules/game/checkout-bust.module.ts`
- Test: `app/tests/modules/game/checkout-bust.module.test.ts`

**Interfaces:**
- Produces: `resolveCheckoutAttempt(remainingBefore: number, scored: number, endedOnDouble: boolean): { remainingAfter: number; checkedOut: boolean; busted: boolean }`

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/game/checkout-bust.module.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { resolveCheckoutAttempt } from "@modules/game/checkout-bust.module";

describe("resolveCheckoutAttempt", () => {
  it("scores an ordinary in-range visit with darts left", () => {
    expect(resolveCheckoutAttempt(100, 60, false)).toEqual({
      remainingAfter: 40,
      checkedOut: false,
      busted: false,
    });
  });

  it("checks out when the remainder reaches exactly 0 on a double", () => {
    expect(resolveCheckoutAttempt(40, 40, true)).toEqual({
      remainingAfter: 0,
      checkedOut: true,
      busted: false,
    });
  });

  it("busts on an overshoot", () => {
    expect(resolveCheckoutAttempt(40, 41, false)).toEqual({
      remainingAfter: -1,
      checkedOut: false,
      busted: true,
    });
  });

  it("busts on leaving exactly 1, which cannot be finished on a double", () => {
    expect(resolveCheckoutAttempt(41, 40, false)).toEqual({
      remainingAfter: 1,
      checkedOut: false,
      busted: true,
    });
  });

  it("busts on reaching exactly 0 without a double", () => {
    expect(resolveCheckoutAttempt(40, 40, false)).toEqual({
      remainingAfter: 0,
      checkedOut: false,
      busted: true,
    });
  });

  it("does not bust on reaching exactly 2, since D1 can finish it", () => {
    expect(resolveCheckoutAttempt(42, 40, false)).toEqual({
      remainingAfter: 2,
      checkedOut: false,
      busted: false,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/checkout-bust.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/game/checkout-bust.module'` (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `app/src/modules/game/checkout-bust.module.ts`:

```typescript
/**
 * The double-out bust/checkout rule shared by every X01-style ladder game
 * (501, 121, TUOD): an overshoot busts; leaving exactly 1 busts, because 1
 * cannot be finished on a double (D1 = 2); reaching exactly 0 busts unless
 * the visit ended on a double. A ruleset with its own extra bust condition
 * — 121's unreachable-remainder-on-the-final-visit rule, TUOD's
 * odd-remainder-with-one-dart-left rule — ORs it onto `busted` itself; this
 * function only ever states the rule every one of them shares.
 */
export function resolveCheckoutAttempt(
  remainingBefore: number,
  scored: number,
  endedOnDouble: boolean,
): { remainingAfter: number; checkedOut: boolean; busted: boolean } {
  const remainingAfter = remainingBefore - scored;
  const checkedOut = remainingAfter === 0 && endedOnDouble;
  const busted =
    remainingAfter < 0 ||
    remainingAfter === 1 ||
    (remainingAfter === 0 && !checkedOut);
  return { remainingAfter, checkedOut, busted };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/checkout-bust.module.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/checkout-bust.module.ts app/tests/modules/game/checkout-bust.module.test.ts
git commit -m "feat(game): add shared checkout-bust module"
```

---

### Task 2: Wire `checkout-bust.module.ts` into 501

**Files:**
- Modify: `app/src/modules/game/five-oh-one.engine.module.ts`
- Test: `app/tests/modules/game/five-oh-one.engine.module.test.ts`

**Interfaces:**
- Consumes: `resolveCheckoutAttempt(remainingBefore: number, scored: number, endedOnDouble: boolean): { remainingAfter: number; checkedOut: boolean; busted: boolean }` from Task 1.

- [ ] **Step 1: Write the failing (well, currently-passing — see note) test first**

`resolveFiveOhOneVisit`'s boundary cases are already covered around line 183 of the test file (`"busts when the visit would leave exactly 1"`, `"treats a visit that would leave exactly 2 as a legal reduction"`). Add one new case confirming the dart-by-dart path (`settleVisit`, reached through `record()` with a `DartObservation`) agrees with the keypad path on the same boundary — this is the assertion this task's refactor must keep true. Add to the end of the file (find the last `describe` block and add a new one after it):

```typescript
describe("FiveOhOneEngine dart-path bust boundary", () => {
  it("busts a board visit that would leave exactly 1, matching the keypad rule", () => {
    const engine = fiveOhOneEngineFactory.create({
      ...config(),
      startingScore: 41,
    }) as FiveOhOneGameEngine;

    engine.record({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 1,
      locationY: 1,
    });

    const state = engine.state();
    expect(state.seats[0].remainingScore).toBe(41);
  });
});
```

- [ ] **Step 2: Run test to verify it passes against current code**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts`
Expected: PASS — this asserts current (pre-refactor) behavior, confirming the boundary this task must not change.

- [ ] **Step 3: Add the import**

In `app/src/modules/game/five-oh-one.engine.module.ts`, after the existing `checkout-darts.module` import:

```typescript
import { checkoutDartsRejection } from "./checkout-darts.module";
import { resolveCheckoutAttempt } from "./checkout-bust.module";
```

- [ ] **Step 4: Rewrite `resolveFiveOhOneVisit` to delegate**

Replace:

```typescript
export function resolveFiveOhOneVisit(
  remainingScore: number,
  input: FiveOhOneVisitInput,
): FiveOhOneVisitOutcome {
  const wouldRemain = remainingScore - input.scoreAttempted;
  const reachedZero = wouldRemain === 0;
  const isBust =
    wouldRemain < 0 ||
    wouldRemain === 1 ||
    (reachedZero && input.finishedOnDouble !== true);

  if (isBust) {
    return {
      isBust: true,
      scored: 0,
      wonLeg: false,
      remainingAfter: remainingScore,
    };
  }

  return {
    isBust: false,
    scored: input.scoreAttempted,
    wonLeg: reachedZero,
    remainingAfter: wouldRemain,
  };
}
```

with:

```typescript
export function resolveFiveOhOneVisit(
  remainingScore: number,
  input: FiveOhOneVisitInput,
): FiveOhOneVisitOutcome {
  const outcome = resolveCheckoutAttempt(
    remainingScore,
    input.scoreAttempted,
    input.finishedOnDouble === true,
  );

  if (outcome.busted) {
    return {
      isBust: true,
      scored: 0,
      wonLeg: false,
      remainingAfter: remainingScore,
    };
  }

  return {
    isBust: false,
    scored: input.scoreAttempted,
    wonLeg: outcome.checkedOut,
    remainingAfter: outcome.remainingAfter,
  };
}
```

- [ ] **Step 5: Rewrite `FiveOhOneEngine.settleVisit` to delegate**

Replace:

```typescript
  private settleVisit(visit: TurnFact, hitZoneKey: DartZoneKey): boolean {
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const remainingAfter = this.remainingBeforeVisit(visit) - thrown;
    const checkedOut = remainingAfter === 0 && hitZoneKey === "DOUBLE";
    const busted =
      remainingAfter < 0 ||
      remainingAfter === 1 ||
      (remainingAfter === 0 && !checkedOut);

    if (busted) {
```

with:

```typescript
  private settleVisit(visit: TurnFact, hitZoneKey: DartZoneKey): boolean {
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const { checkedOut, busted } = resolveCheckoutAttempt(
      this.remainingBeforeVisit(visit),
      thrown,
      hitZoneKey === "DOUBLE",
    );

    if (busted) {
```

(the rest of the method — the `if (busted) {...}` body through the closing `return checkedOut;` — is unchanged.)

- [ ] **Step 6: Rewrite `dartChecksOutFinalLeg` to delegate**

Replace:

```typescript
  private dartChecksOutFinalLeg(
    observation: DartObservation,
    before: FiveOhOneState,
  ): boolean {
    const resolved = resolveObservation(observation);

    const remainingAfter = this.activeRemaining(before) - resolved.score;
    const checksOut = remainingAfter === 0 && resolved.zoneKey === "DOUBLE";
    if (!checksOut) return false;
```

with:

```typescript
  private dartChecksOutFinalLeg(
    observation: DartObservation,
    before: FiveOhOneState,
  ): boolean {
    const resolved = resolveObservation(observation);

    const { checkedOut } = resolveCheckoutAttempt(
      this.activeRemaining(before),
      resolved.score,
      resolved.zoneKey === "DOUBLE",
    );
    if (!checkedOut) return false;
```

(the rest of the method — the seat/side lookup and `legsWon` comparison — is unchanged.)

- [ ] **Step 7: Run the full 501 test suite and the game-engines gate**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts`
Expected: PASS — every existing assertion, plus the new one from Step 1, unchanged.

Run: `cd app && bash ../scripts/check-game-engines.sh`
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add app/src/modules/game/five-oh-one.engine.module.ts app/tests/modules/game/five-oh-one.engine.module.test.ts
git commit -m "refactor(game): 501 delegates its bust/checkout rule to checkout-bust.module"
```

---

### Task 3: Wire `checkout-bust.module.ts` into 121

**Files:**
- Modify: `app/src/modules/game/one-twenty-one.engine.module.ts`
- Test: `app/tests/modules/game/one-twenty-one.engine.module.test.ts`

**Interfaces:**
- Consumes: `resolveCheckoutAttempt` from Task 1 (same signature as Task 2).

- [ ] **Step 1: Confirm existing coverage, add one dart-path boundary case**

`resolveOneTwentyOneVisit`'s bust boundaries are already covered by existing tests (search the test file for `"leave exactly 1"`/`"leaves exactly 1"` — 121's test file mirrors 501's). Add a dart-path confirmation the same way as Task 2, appended as a new `describe` block at the end of the file:

```typescript
describe("OneTwentyOneEngine dart-path bust boundary", () => {
  it("busts a board visit that would leave exactly 1, matching the keypad rule", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneGameEngine;

    engine.record({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 1,
      locationY: 1,
    });
    engine.record({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 1,
      locationY: 1,
    });

    const state = engine.state();
    expect(state.seats[0].remainingInAttempt).toBe(121);
  });
});
```

Adjust the imports at the top of the file to include `oneTwentyOneEngineFactory` and the `OneTwentyOneGameEngine`/config helpers already used elsewhere in the file (match whatever names the existing tests import — read the top of the file before adding this block to reuse its existing `config()` helper and type alias rather than redefining them).

- [ ] **Step 2: Run test to verify it passes against current code**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts`
Expected: PASS.

- [ ] **Step 3: Add the import**

In `app/src/modules/game/one-twenty-one.engine.module.ts`, after the `checkout-darts.module` import:

```typescript
import { checkoutDartsRejection } from "./checkout-darts.module";
import { resolveCheckoutAttempt } from "./checkout-bust.module";
```

- [ ] **Step 4: Rewrite `resolveOneTwentyOneVisit` to delegate**

Replace:

```typescript
function resolveOneTwentyOneVisit(
  remainingInAttempt: number,
  input: OneTwentyOneVisitInput,
): OneTwentyOneVisitOutcome {
  const wouldRemain = remainingInAttempt - input.scoreAttempted;
  const reachedZero = wouldRemain === 0;
  const isBust =
    wouldRemain < 0 ||
    wouldRemain === 1 ||
    (reachedZero && input.finishedOnDouble !== true);

  if (isBust) {
    return {
      isBust: true,
      scored: 0,
      checkedOut: false,
      remainingAfter: remainingInAttempt,
    };
  }

  return {
    isBust: false,
    scored: input.scoreAttempted,
    checkedOut: reachedZero,
    remainingAfter: wouldRemain,
  };
}
```

with:

```typescript
function resolveOneTwentyOneVisit(
  remainingInAttempt: number,
  input: OneTwentyOneVisitInput,
): OneTwentyOneVisitOutcome {
  const outcome = resolveCheckoutAttempt(
    remainingInAttempt,
    input.scoreAttempted,
    input.finishedOnDouble === true,
  );

  if (outcome.busted) {
    return {
      isBust: true,
      scored: 0,
      checkedOut: false,
      remainingAfter: remainingInAttempt,
    };
  }

  return {
    isBust: false,
    scored: input.scoreAttempted,
    checkedOut: outcome.checkedOut,
    remainingAfter: outcome.remainingAfter,
  };
}
```

- [ ] **Step 5: Rewrite `OneTwentyOneEngine.settleVisit` to delegate**

Replace:

```typescript
  private settleVisit(visit: TurnFact): boolean {
    const before = this.seatBeforeVisit(visit);
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const remainingAfter = before.remainingInAttempt - thrown;
    const lastDart = visit.darts.at(-1)!;
    const checkedOut = remainingAfter === 0 && lastDart.hitZoneKey === "DOUBLE";
    const busted =
      remainingAfter < 0 ||
      remainingAfter === 1 ||
      (remainingAfter === 0 && !checkedOut);

    if (busted) {
```

with:

```typescript
  private settleVisit(visit: TurnFact): boolean {
    const before = this.seatBeforeVisit(visit);
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const lastDart = visit.darts.at(-1)!;
    const { remainingAfter, checkedOut, busted } = resolveCheckoutAttempt(
      before.remainingInAttempt,
      thrown,
      lastDart.hitZoneKey === "DOUBLE",
    );

    if (busted) {
```

(the rest of the method — through the `finalVisitHasNoFinishLeft`-gated `resolved` computation and its `return resolved;` — is unchanged, and still reads the same `remainingAfter`/`checkedOut`/`busted` names, now destructured instead of locally computed.)

- [ ] **Step 6: Rewrite `wouldCompleteDart` to delegate**

Replace:

```typescript
    const resolved = resolveObservation(observation);
    const remainingAfter = activeSeatState.remainingInAttempt - resolved.score;
    const checksOut = remainingAfter === 0 && resolved.zoneKey === "DOUBLE";
    return checksOut && activeSeatState.currentTarget === CAP_TARGET;
```

with:

```typescript
    const resolved = resolveObservation(observation);
    const { checkedOut } = resolveCheckoutAttempt(
      activeSeatState.remainingInAttempt,
      resolved.score,
      resolved.zoneKey === "DOUBLE",
    );
    return checkedOut && activeSeatState.currentTarget === CAP_TARGET;
```

- [ ] **Step 7: Run the full 121 test suite and the game-engines gate**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts`
Expected: PASS — every existing assertion, plus the new one from Step 1, unchanged.

Run: `cd app && bash ../scripts/check-game-engines.sh`
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add app/src/modules/game/one-twenty-one.engine.module.ts app/tests/modules/game/one-twenty-one.engine.module.test.ts
git commit -m "refactor(game): 121 delegates its bust/checkout rule to checkout-bust.module"
```

---

### Task 4: Wire `checkout-bust.module.ts` into TUOD

**Files:**
- Modify: `app/src/modules/game/tuod.engine.module.ts`
- Test: `app/tests/modules/game/tuod.engine.module.test.ts`

**Interfaces:**
- Consumes: `resolveCheckoutAttempt` from Task 1.
- Produces (file-local, unexported): `visitOutcome(remainingBefore: number, scored: number, lastZoneKey: DartZoneKey, dartsRemaining: number): { remainingAfter: number; checkedOut: boolean; busted: boolean }` — signature changes from the current `(remainingAfter, lastZoneKey, dartsRemaining)`; both call sites in this file are updated in this same task.

- [ ] **Step 1: Add a test confirming the odd-remainder early-bust rule, via the public engine API**

Read `app/tests/modules/game/tuod.engine.module.test.ts` first and reuse its existing config/factory helper names (do not redefine them) — the test below only needs whatever single-seat config and `tuodEngineFactory` import the file's earlier tests already use. Add a new `describe` block at the end of the file:

```typescript
describe("TuodEngine final-dart odd-remainder early bust", () => {
  it("busts on the visit's 2nd dart when only an odd remainder is left with one dart to go", () => {
    const engine = tuodEngineFactory.create(config()) as TuodGameEngine;

    engine.record({
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: 1,
      locationY: 1,
    });
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });

    const state = engine.state();
    expect(state.seats[0].failures).toBe(1);
  });
});
```

Adjust `config()`/`TuodGameEngine` to whatever names this file's existing tests already use, and adjust the two darts' target/zone so the visit's remainder after 2 darts is odd and greater than 1 against this file's actual `startingTarget` default — read the existing tests' bust-boundary cases (search for `"odd"` or `"unfinishable"`) for a combination already proven to trigger this exact rule, and reuse those same inputs here rather than deriving new ones.

- [ ] **Step 2: Run test to verify it passes against current code**

Run: `cd app && npx vitest run tests/modules/game/tuod.engine.module.test.ts`
Expected: PASS (baseline, before this task's refactor — confirms the test exercises real, currently-true behavior).

- [ ] **Step 3: Add the import**

In `app/src/modules/game/tuod.engine.module.ts`, after the `checkout-darts.module` import:

```typescript
import { checkoutDartsRejection } from "./checkout-darts.module";
import { resolveCheckoutAttempt } from "./checkout-bust.module";
```

- [ ] **Step 4: Rewrite `visitOutcome` to delegate its base rule**

Replace:

```typescript
function visitOutcome(
  remainingAfter: number,
  lastZoneKey: DartZoneKey,
  dartsRemaining: number,
): { checkedOut: boolean; busted: boolean } {
  const checkedOut = remainingAfter === 0 && lastZoneKey === "DOUBLE";
  const busted =
    remainingAfter < 0 ||
    remainingAfter === 1 ||
    (remainingAfter === 0 && !checkedOut) ||
    (dartsRemaining === 1 && remainingAfter > 1 && remainingAfter % 2 !== 0);
  return { checkedOut, busted };
}
```

with:

```typescript
function visitOutcome(
  remainingBefore: number,
  scored: number,
  lastZoneKey: DartZoneKey,
  dartsRemaining: number,
): { remainingAfter: number; checkedOut: boolean; busted: boolean } {
  const outcome = resolveCheckoutAttempt(
    remainingBefore,
    scored,
    lastZoneKey === "DOUBLE",
  );
  const busted =
    outcome.busted ||
    (dartsRemaining === 1 &&
      outcome.remainingAfter > 1 &&
      outcome.remainingAfter % 2 !== 0);
  return { ...outcome, busted };
}
```

Also update the JSDoc directly above `visitOutcome` — it currently opens "Whether a visit that has `remainingAfter` points left..."; change the first sentence to "Whether a visit that scored `scored` off `remainingBefore`, with its last dart landing in `lastZoneKey` and `dartsRemaining` darts still to throw, has checked out or busted." and keep the rest of the comment (the "Shared by `settleVisit`..." explanation) as-is.

- [ ] **Step 5: Update `settleVisit`'s call site**

Replace:

```typescript
  private settleVisit(visit: TurnFact): boolean {
    const thrown = sumDartScores(visit.darts);
    const remainingAfter = this.targetBeforeVisit(visit) - thrown;
    const lastDart = visit.darts.at(-1)!;
    const { checkedOut, busted } = visitOutcome(
      remainingAfter,
      lastDart.hitZoneKey,
      this.config.maxDartsPerTurn - visit.darts.length,
    );
```

with:

```typescript
  private settleVisit(visit: TurnFact): boolean {
    const thrown = sumDartScores(visit.darts);
    const lastDart = visit.darts.at(-1)!;
    const { checkedOut, busted } = visitOutcome(
      this.targetBeforeVisit(visit),
      thrown,
      lastDart.hitZoneKey,
      this.config.maxDartsPerTurn - visit.darts.length,
    );
```

(the rest of the method is unchanged.)

- [ ] **Step 6: Update `wouldCompleteDart`'s call site**

Replace:

```typescript
    const resolved = resolveObservation(observation);
    const thrown =
      priorDarts.reduce((sum, dart) => sum + dart.score, 0) + resolved.score;
    const remainingAfter = target - thrown;
    const dartCount = priorDarts.length + 1;
    const { checkedOut, busted } = visitOutcome(
      remainingAfter,
      resolved.zoneKey,
      this.config.maxDartsPerTurn - dartCount,
    );
```

with:

```typescript
    const resolved = resolveObservation(observation);
    const thrown =
      priorDarts.reduce((sum, dart) => sum + dart.score, 0) + resolved.score;
    const dartCount = priorDarts.length + 1;
    const { checkedOut, busted } = visitOutcome(
      target,
      thrown,
      resolved.zoneKey,
      this.config.maxDartsPerTurn - dartCount,
    );
```

(everything after — `visitResolves` through the rest of the method, including the inline `otherSeatsComplete` block that Task 6 will touch — is unchanged in this task.)

- [ ] **Step 7: Run the full TUOD test suite and the game-engines gate**

Run: `cd app && npx vitest run tests/modules/game/tuod.engine.module.test.ts`
Expected: PASS — including the test added in Step 1, unchanged.

Run: `cd app && bash ../scripts/check-game-engines.sh`
Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add app/src/modules/game/tuod.engine.module.ts app/tests/modules/game/tuod.engine.module.test.ts
git commit -m "refactor(game): TUOD delegates its base bust/checkout rule to checkout-bust.module"
```

---

### Task 5: Generalize `otherSeatsComplete`

**Files:**
- Modify: `app/src/modules/game/seat-state.module.ts`
- Modify: `app/src/modules/game/around-the-clock.engine.module.ts`
- Modify: `app/src/modules/game/singles-training.engine.module.ts`
- Modify: `app/src/modules/game/doubles-training.engine.module.ts`
- Test: `app/tests/modules/game/seat-state.module.test.ts`

**Interfaces:**
- Produces: `otherSeatsComplete<TSeat extends SeatState>(seats: readonly TSeat[], participantRef: string, isComplete: (seat: TSeat) => boolean): boolean` — signature changes from the current 2-argument, `status`-hardcoded form. Every existing caller in this codebase is updated within this task.

- [ ] **Step 1: Write the new failing test**

In `app/tests/modules/game/seat-state.module.test.ts`, replace the `describe("otherSeatsComplete", ...)` block:

```typescript
describe("otherSeatsComplete", () => {
  const progress = [
    { participantRef: "p1", sideKey: "A", status: "IN_PROGRESS" },
    { participantRef: "p2", sideKey: "B", status: "COMPLETE" },
  ];
  const isComplete = (seat: (typeof progress)[number]) =>
    seat.status === "COMPLETE";

  it("ignores the named seat's own status", () => {
    expect(otherSeatsComplete(progress, "p1", isComplete)).toBe(true);
    expect(otherSeatsComplete(progress, "p2", isComplete)).toBe(false);
  });

  it("is vacuously true for a solo session", () => {
    expect(otherSeatsComplete([progress[0]], "p1", isComplete)).toBe(true);
  });

  it("uses the caller's own predicate instead of assuming a status field", () => {
    const budget = [
      { participantRef: "p1", sideKey: "A", attempts: 2 },
      { participantRef: "p2", sideKey: "B", attempts: 5 },
    ];
    const budgetComplete = (seat: (typeof budget)[number]) =>
      seat.attempts >= 5;

    expect(otherSeatsComplete(budget, "p1", budgetComplete)).toBe(true);
    expect(otherSeatsComplete(budget, "p2", budgetComplete)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/seat-state.module.test.ts`
Expected: FAIL — a type/argument-count error, since `otherSeatsComplete` doesn't yet accept a third argument.

- [ ] **Step 3: Rewrite `otherSeatsComplete` in `seat-state.module.ts`**

Replace:

```typescript
/**
 * Whether every seat OTHER than `participantRef` has already finished its own
 * session — what separates "this dart completes the active seat" from "this
 * dart completes the whole match" in a `wouldComplete()`. Solo is vacuously
 * true: there is no other seat to wait for.
 */
export function otherSeatsComplete(
  seats: readonly (SeatState & { status: string })[],
  participantRef: string,
): boolean {
  return seats
    .filter((seat) => seat.participantRef !== participantRef)
    .every((seat) => seat.status === "COMPLETE");
}
```

with:

```typescript
/**
 * Whether every seat OTHER than `participantRef` has already finished its own
 * session — what separates "this dart completes the active seat" from "this
 * dart completes the whole match" in a `wouldComplete()`. Solo is vacuously
 * true: there is no other seat to wait for. `isComplete` is the caller's own
 * completion rule — a `status` field for the dart-fed engines, a duration
 * budget (`durationSeatComplete`) for TUOD and Score Training, whose seat
 * states carry no `status` at all.
 */
export function otherSeatsComplete<TSeat extends SeatState>(
  seats: readonly TSeat[],
  participantRef: string,
  isComplete: (seat: TSeat) => boolean,
): boolean {
  return seats
    .filter((seat) => seat.participantRef !== participantRef)
    .every(isComplete);
}
```

- [ ] **Step 4: Update the 3 existing callers**

In `app/src/modules/game/around-the-clock.engine.module.ts`, replace:

```typescript
    return otherSeatsComplete(before.seats, seatBefore.participantRef);
```

with:

```typescript
    return otherSeatsComplete(
      before.seats,
      seatBefore.participantRef,
      (seat) => seat.status === "COMPLETE",
    );
```

In `app/src/modules/game/singles-training.engine.module.ts`, replace the same line:

```typescript
    return otherSeatsComplete(before.seats, seatBefore.participantRef);
```

with the same 4-line form:

```typescript
    return otherSeatsComplete(
      before.seats,
      seatBefore.participantRef,
      (seat) => seat.status === "COMPLETE",
    );
```

In `app/src/modules/game/doubles-training.engine.module.ts`, replace the same line with the same 4-line form.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/seat-state.module.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the three updated engines' test suites**

Run: `cd app && npx vitest run tests/modules/game/around-the-clock.engine.module.test.ts tests/modules/game/singles-training.engine.module.test.ts tests/modules/game/doubles-training.engine.module.test.ts`
Expected: PASS — no assertion changes needed, since the predicate reproduces the prior hardcoded behavior exactly.

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/game/seat-state.module.ts app/tests/modules/game/seat-state.module.test.ts app/src/modules/game/around-the-clock.engine.module.ts app/src/modules/game/singles-training.engine.module.ts app/src/modules/game/doubles-training.engine.module.ts
git commit -m "refactor(game): otherSeatsComplete takes a completion predicate"
```

---

### Task 6: TUOD uses `otherSeatsComplete`

**Files:**
- Modify: `app/src/modules/game/tuod.engine.module.ts`
- Test: `app/tests/modules/game/tuod.engine.module.test.ts`

**Interfaces:**
- Consumes: `otherSeatsComplete` from Task 5, `durationSeatComplete` (already imported in this file from `seat-state.module.ts`).

- [ ] **Step 1: Add the import**

In `app/src/modules/game/tuod.engine.module.ts`, change:

```typescript
import { completedByIndex, durationSeatComplete } from "./seat-state.module";
```

to:

```typescript
import {
  completedByIndex,
  durationSeatComplete,
  otherSeatsComplete,
} from "./seat-state.module";
```

- [ ] **Step 2: Rewrite `wouldCompleteDart`'s tail**

Replace:

```typescript
    if (!visitResolves) return false;

    const otherSeatsComplete = before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) =>
        durationSeatComplete(this.config, seat.attempts, this.timerExpired),
      );
    return (
      durationSeatComplete(
        this.config,
        activeSeatState.attempts + 1,
        this.timerExpired,
      ) && otherSeatsComplete
    );
  }
```

with (note the local variable is renamed to `allOtherSeatsComplete` — it would otherwise shadow the imported function):

```typescript
    if (!visitResolves) return false;

    const allOtherSeatsComplete = otherSeatsComplete(
      before.seats,
      activeSeatState.participantRef,
      (seat) =>
        durationSeatComplete(this.config, seat.attempts, this.timerExpired),
    );
    return (
      durationSeatComplete(
        this.config,
        activeSeatState.attempts + 1,
        this.timerExpired,
      ) && allOtherSeatsComplete
    );
  }
```

- [ ] **Step 3: Rewrite the public `wouldComplete`'s tail**

Replace:

```typescript
    const otherSeatsComplete = before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) =>
        durationSeatComplete(this.config, seat.attempts, this.timerExpired),
      );
    return (
      durationSeatComplete(
        this.config,
        activeSeatState.attempts + 1,
        this.timerExpired,
      ) && otherSeatsComplete
    );
  }

  /**
   * `foldTuodState`'s own `status` field reads `"IN_PROGRESS"` for a solo
```

with:

```typescript
    const allOtherSeatsComplete = otherSeatsComplete(
      before.seats,
      activeSeatState.participantRef,
      (seat) =>
        durationSeatComplete(this.config, seat.attempts, this.timerExpired),
    );
    return (
      durationSeatComplete(
        this.config,
        activeSeatState.attempts + 1,
        this.timerExpired,
      ) && allOtherSeatsComplete
    );
  }

  /**
   * `foldTuodState`'s own `status` field reads `"IN_PROGRESS"` for a solo
```

(this replacement is anchored on the doc comment of the next method, `isComplete()`, to disambiguate it from the identical block in Step 2 — read the file before editing to confirm which occurrence is which.)

- [ ] **Step 4: Add a 1v1 test confirming both call sites still agree**

Add to `app/tests/modules/game/tuod.engine.module.test.ts` (matching its existing 1v1 test setup — read the file first to reuse its existing two-seat config helper rather than redefining one):

```typescript
describe("TuodEngine 1v1 wouldComplete via otherSeatsComplete", () => {
  it("does not complete while the other seat still has budget left", () => {
    const engine = tuodEngineFactory.create(twoSeatConfig()) as TuodGameEngine;

    for (let i = 0; i < twoSeatConfig().durationValue - 1; i += 1) {
      engine.record({ checkedOut: false });
    }

    expect(engine.wouldComplete({ checkedOut: false })).toBe(false);
  });
});
```

Adjust `twoSeatConfig()`/`TuodGameEngine` to whatever names the existing 1v1 tests in this file already use — grep the file for `"1v1"` or a two-seat `SEATS` array before writing this block, and match its established helper names exactly rather than introducing new ones.

- [ ] **Step 5: Run the full TUOD test suite and the game-engines gate**

Run: `cd app && npx vitest run tests/modules/game/tuod.engine.module.test.ts`
Expected: PASS.

Run: `cd app && bash ../scripts/check-game-engines.sh`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game/tuod.engine.module.ts app/tests/modules/game/tuod.engine.module.test.ts
git commit -m "refactor(game): TUOD uses the shared otherSeatsComplete instead of an inline fold"
```

---

### Task 7: Score Training uses `otherSeatsComplete`

**Files:**
- Modify: `app/src/modules/game/score-training.engine.module.ts`
- Test: `app/tests/modules/game/score-training.engine.module.test.ts`

**Interfaces:**
- Consumes: `otherSeatsComplete` from Task 5, `durationSeatComplete` (already imported).

- [ ] **Step 1: Add the import**

In `app/src/modules/game/score-training.engine.module.ts`, change:

```typescript
import { completedByIndex, durationSeatComplete } from "./seat-state.module";
```

to:

```typescript
import {
  completedByIndex,
  durationSeatComplete,
  otherSeatsComplete,
} from "./seat-state.module";
```

- [ ] **Step 2: Rewrite `wouldComplete`'s tail**

Replace:

```typescript
    const otherSeatsComplete = before.seats
      .filter((seat) => seat.participantRef !== activeSeatState.participantRef)
      .every((seat) =>
        durationSeatComplete(this.config, seat.turnCount, this.timerExpired),
      );
    return (
      durationSeatComplete(
        this.config,
        activeSeatState.turnCount + 1,
        this.timerExpired,
      ) && otherSeatsComplete
    );
  }
```

with:

```typescript
    const allOtherSeatsComplete = otherSeatsComplete(
      before.seats,
      activeSeatState.participantRef,
      (seat) =>
        durationSeatComplete(this.config, seat.turnCount, this.timerExpired),
    );
    return (
      durationSeatComplete(
        this.config,
        activeSeatState.turnCount + 1,
        this.timerExpired,
      ) && allOtherSeatsComplete
    );
  }
```

- [ ] **Step 3: Add a 1v1 test confirming the refactored call site**

Add to `app/tests/modules/game/score-training.engine.module.test.ts`, matching its existing 1v1 test setup (grep the file for `"1v1"` or a two-seat config first, and reuse its established helper names):

```typescript
describe("ScoreTrainingEngine 1v1 wouldComplete via otherSeatsComplete", () => {
  it("does not complete while the other seat still has budget left", () => {
    const engine = scoreTrainingEngineFactory.create(
      twoSeatConfig(),
    ) as ScoreTrainingGameEngine;

    engine.record(50);

    expect(engine.wouldComplete(50)).toBe(false);
  });
});
```

Adjust `twoSeatConfig()`/`ScoreTrainingGameEngine` to the names this file's existing 1v1 tests already use.

- [ ] **Step 4: Run the full Score Training test suite and the game-engines gate**

Run: `cd app && npx vitest run tests/modules/game/score-training.engine.module.test.ts`
Expected: PASS.

Run: `cd app && bash ../scripts/check-game-engines.sh`
Expected: exits 0.

- [ ] **Step 5: Run the whole suite once, end to end**

Run: `cd app && npm test`
Expected: PASS, full suite — this is the first point every code task (1-7) has landed together; it is the regression check for the whole cleanup.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game/score-training.engine.module.ts app/tests/modules/game/score-training.engine.module.test.ts
git commit -m "refactor(game): Score Training uses the shared otherSeatsComplete instead of an inline fold"
```

---

### Task 8: `npm run validate:app`

**Files:** none (verification-only task).

- [ ] **Step 1: Run the full validation chain**

Run: `cd app && npm run validate:app`
Expected: every step exits 0; the type-check step reports 0 errors, 0 warnings, 0 hints; `npx fallow` passes its duplication gate (this task's whole purpose was to remove duplication `fallow` was not catching — a regression here means Tasks 1-7 introduced new duplication rather than removing it).

- [ ] **Step 2: If anything fails, fix and re-run before proceeding to the doc tasks**

The doc tasks (9-12) touch only `docs/game-rules/`, which no gate in `validate:app` scans — this is the last point code correctness is checked before switching to docs-only work.

No commit in this task — it is a checkpoint, not a change.

---

### Task 9: Fix stale "Multiplayer: TBD" in 6 ruleset docs

**Files:**
- Modify: `docs/game-rules/rulesets/121.md`
- Modify: `docs/game-rules/rulesets/ten-up-one-down.md`
- Modify: `docs/game-rules/rulesets/score-training.md`
- Modify: `docs/game-rules/rulesets/bobs-27.md`
- Modify: `docs/game-rules/rulesets/around-the-clock.md`
- Modify: `docs/game-rules/rulesets/shanghai.md`

Each of these 6 files already documents 1v1 as shipped under its own `## Objective` section (added 2026-08-22); only the Features table wasn't updated to match. This task is a single-line Features-table edit per file, mirroring `501.md`'s existing `| Multiplayer (1-4 seats, one per side)    | V1      |` row style.

- [ ] **Step 1: `121.md`**

Replace:

```
| Multiplayer                                  | TBD      |
```

with:

```
| Multiplayer (1v1)                            | V1       |
```

- [ ] **Step 2: `ten-up-one-down.md`**

Replace:

```
| Multiplayer                                 | TBD     |
```

with:

```
| Multiplayer (1v1)                           | V1      |
```

- [ ] **Step 3: `score-training.md`**

Replace:

```
| Multiplayer                            | TBD             |
```

with:

```
| Multiplayer (1v1)                      | V1              |
```

- [ ] **Step 4: `bobs-27.md`**

Replace:

```
| Multiplayer vs guest                            | TBD     |
```

with:

```
| Multiplayer vs guest                            | V1      |
```

(this row's label already names the shipped shape — 1v1 against an ephemeral guest seat, matching `501.md`'s "the owning player plus ephemeral guests" — so only the version changes.)

- [ ] **Step 5: `around-the-clock.md`**

Replace:

```
| Multiplayer                                                  | TBD     |
```

with:

```
| Multiplayer (1v1)                                            | V1      |
```

- [ ] **Step 6: `shanghai.md`**

Replace:

```
| Multiplayer                                     | TBD     |
```

with:

```
| Multiplayer (1v1)                               | V1      |
```

- [ ] **Step 7: Commit**

```bash
git add docs/game-rules/rulesets/121.md docs/game-rules/rulesets/ten-up-one-down.md docs/game-rules/rulesets/score-training.md docs/game-rules/rulesets/bobs-27.md docs/game-rules/rulesets/around-the-clock.md docs/game-rules/rulesets/shanghai.md
git commit -m "docs(game-rules): mark shipped 1v1 as V1 in the Features table, not TBD"
```

---

### Task 10: Singles Training / Doubles Training — move 1v1 out of V2+

**Files:**
- Modify: `docs/game-rules/rulesets/singles-training.md`
- Modify: `docs/game-rules/rulesets/doubles-training.md`

Both files currently describe their already-shipped 1v1 behavior under `## Later versions (V2+) → ### Variants — Multiplayer (1v1)`, misclassifying it as future work. This task moves that content into `## Objective`, matching the "**1v1:** ..." bullet style the other 6 games (121, TUOD, Score Training, Bob's 27, Around the Clock, Shanghai) already use, and fixes the same Features-table row Task 9 fixed elsewhere.

- [ ] **Step 1: `singles-training.md` — Features table**

Replace:

```
| Multiplayer                                   | TBD     |
```

with:

```
| Multiplayer (1v1)                             | V1      |
```

- [ ] **Step 2: `singles-training.md` — Objective**

Replace:

```
## Objective

- **Target:** throw three darts at the current section; earn training points for hits on that section.
- **Session (V1):** complete the full order (all numbers and bull once) and total the points.
```

with:

```
## Objective

- **Target:** throw three darts at the current section; earn training points for hits on that section.
- **Session (V1):** complete the full order (all numbers and bull once) and total the points.
- **1v1:** highest total training points wins; ties possible, no tiebreak in this version.
```

- [ ] **Step 3: `singles-training.md` — remove the now-duplicate V2+ subsection**

Remove this block entirely (it is now covered by Objective):

```

### Variants — Multiplayer (1v1)

1v1 win condition: highest total points; ties possible, no tiebreak in this version.
```

- [ ] **Step 4: `doubles-training.md` — Features table**

Replace:

```
| Multiplayer                                                  | TBD     |
```

with:

```
| Multiplayer (1v1)                                            | V1      |
```

- [ ] **Step 5: `doubles-training.md` — Objective**

Replace:

```
## Objective

- **Target:** hit the current double within the visit rules for the active mode.
- **Session (V1 easy):** visit every double once in order (1…20, then bull), whether or not you hit.
```

with:

```
## Objective

- **Target:** hit the current double within the visit rules for the active mode.
- **Session (V1 easy):** visit every double once in order (1…20, then bull), whether or not you hit.
- **1v1:** most doubles hit across all 21 targets wins; ties possible, no tiebreak in this version.
```

- [ ] **Step 6: `doubles-training.md` — remove the now-duplicate V2+ subsection**

Remove this block entirely:

```

### Variants — Multiplayer (1v1)

1v1 win condition: most doubles hit across all 21 targets; ties possible, no tiebreak in this version.
```

- [ ] **Step 7: Commit**

```bash
git add docs/game-rules/rulesets/singles-training.md docs/game-rules/rulesets/doubles-training.md
git commit -m "docs(game-rules): move Singles/Doubles Training's shipped 1v1 out of V2+ into Objective"
```

---

### Task 11: `501.md` — resolve the stale bust-rate limitation

**Files:**
- Modify: `docs/game-rules/rulesets/501.md`

The engine already implements a VISUAL_BOARD dart-capture path where a busted visit keeps its real dart rows (`FiveOhOneEngine`'s own doc comment: "that divergence is the fact that makes bust rate computable"), which resolves what `501.md`'s Known limitations/Open questions still describe as an open problem. This task updates the doc to match, mirroring `ten-up-one-down.md`'s existing "Retired for ANALYTICS + VISUAL_BOARD sessions" section.

- [ ] **Step 1: Update the Capture section**

Replace:

```
## Capture

- **Capture / input mode:** RECREATIONAL + QUICK_SCORE — one visit total per turn, **no dart rows**.
- **One dart's fact:** none. 501 does not record individual darts in V1; the unit of capture is the visit.
- **Stage type:** one `LEG` per leg. A won leg opens the next.
- **Derived, never stored:** the remaining score, leg wins, and averages — all folded from the visit totals.
```

with:

```
## Capture

- **Capture / input mode:** RECREATIONAL + QUICK_SCORE — one visit total per turn, **no dart rows**. Also implemented: ANALYTICS + VISUAL_BOARD — one dart at a time, board score per dart, real landing coordinates.
- **One dart's fact (VISUAL_BOARD only):** `score` = the dart's own board score; a busted visit keeps its real dart rows with `totalScore` reset to `0` — the divergence between the two is what makes bust rate computable under this mode (see Known limitations). QUICK_SCORE records no darts at all; the unit of capture there is the visit.
- **Stage type:** one `LEG` per leg. A won leg opens the next.
- **Derived, never stored:** the remaining score, leg wins, and averages — all folded from the visit totals (or dart totals, under VISUAL_BOARD).
```

- [ ] **Step 2: Update Known limitations and Open questions**

Replace:

```
## Known limitations

**A bust cannot be told apart from a scoreless visit.** Under RECREATIONAL + QUICK_SCORE a busted visit and a genuine zero-scoring visit are both persisted as a turn total of `0` with no dart rows. Nothing in the stored record distinguishes them. Consequences:

- **Bust rate is not computable at all.**
- **Checkout percentage undercounts attempts** — a busted checkout attempt looks exactly like a visit in which nothing counted, so it never enters the denominator.

Recovering either requires DETAILED_DARTS capture for 501, or a schema revision adding an attempted-score or void-visit fact. Both are open; the capture-mode question is on the deferred list in `DECISIONS.md`. Also recorded in `docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md`. <!-- 2026-07-26 -->

## Open questions

- Whether 501 moves to DETAILED_DARTS capture, or the schema gains an attempted-score / void-visit fact, to make bust rate computable (see Known limitations).
```

with:

```
## Known limitations

**Under RECREATIONAL + QUICK_SCORE, a bust cannot be told apart from a scoreless visit.** A busted visit and a genuine zero-scoring visit are both persisted as a turn total of `0` with no dart rows. Nothing in the stored record distinguishes them. Consequences:

- **Bust rate is not computable at all under this capture mode.**
- **Checkout percentage undercounts attempts** — a busted checkout attempt looks exactly like a visit in which nothing counted, so it never enters the denominator.

Recovering either requires DETAILED_DARTS/VISUAL_BOARD capture or a schema revision adding an attempted-score or void-visit fact for QUICK_SCORE itself; QUICK_SCORE sessions remain unfixable, since completed gameplay is immutable and no per-dart fact exists to recover from. <!-- 2026-07-26 -->

**Retired for ANALYTICS + VISUAL_BOARD sessions.** Every dart carries a real landing coordinate and score, so a bust and a plain miss are distinguishable by the pattern in the persisted darts: a bust's darts show an overshoot, a remaining score of exactly 1, or reaching 0 without the last dart in a double; a miss's darts land short of a double with none of those patterns. No `v_*` view yet queries this distinction — the fact log supports it, and building the view is future work.

## Open questions

- ~~Whether 501 moves to DETAILED_DARTS capture, or the schema gains an attempted-score / void-visit fact, to make bust rate computable.~~ **Resolved:** VISUAL_BOARD capture already records per-dart facts that make it computable; the limitation is retired for that mode and stands only for QUICK_SCORE (see Known limitations).
```

- [ ] **Step 3: Commit**

```bash
git add docs/game-rules/rulesets/501.md
git commit -m "docs(game-rules): resolve 501's stale bust-rate limitation for VISUAL_BOARD sessions"
```

---

### Task 12: `121.md` — add Capture section, document the final-visit early-bust rule

**Files:**
- Modify: `docs/game-rules/rulesets/121.md`

Unlike every other implemented ruleset doc, `121.md` has no `## Capture` section, and it doesn't document the `finalVisitHasNoFinishLeft` rule the engine already implements (the attempt's 3rd visit closes immediately once no double-out route is reachable with the darts left in it) — the same kind of engine-specific escalation `ten-up-one-down.md` documents for its own odd-remainder rule.

- [ ] **Step 1: Add a note to the Bust section**

Replace:

```
### Bust

If a visit would go past 0, leave 1 under double out, or hit 0 without a double, that visit is a **bust**: those darts do not count; score returns to the start of the visit. Remaining visits in the budget (if any) continue from that restored score.
```

with:

```
### Bust

If a visit would go past 0, leave 1 under double out, or hit 0 without a double, that visit is a **bust**: those darts do not count; score returns to the start of the visit. Remaining visits in the budget (if any) continue from that restored score.

**Early bust on the attempt's final visit (V1, ANALYTICS + VISUAL_BOARD).** On the 3rd (final) visit of an attempt, once the remaining score can no longer be checked out within the darts still left in that visit — read off the standard checkout chart, not merely an odd/even check — the visit busts immediately instead of requiring every dart to be thrown. This is 121-specific: the attempt's first two visits never take this branch, and 501 still requires every dart in a visit to be thrown regardless of whether a checkout remains mathematically possible.
```

- [ ] **Step 2: Add a Capture section after Glossary, before Open questions**

Replace:

```
## Open questions

- Whether V1 should default to 9 darts hard-fail (−1) instead of easy stay (common pub default is −1 with a 121 floor).
```

with:

```
## Capture

- **Capture / input mode:** RECREATIONAL + QUICK_SCORE — one visit total per turn, **no dart rows**. Also implemented: ANALYTICS + VISUAL_BOARD — one dart at a time, board score per dart, real landing coordinates.
- **One dart's fact (VISUAL_BOARD only):** `score` = the dart's own board score; a busted visit keeps its real dart rows with `totalScore` reset to `0`. QUICK_SCORE records no darts at all; the unit of capture there is the visit.
- **Stage type:** one `ROUND` per attempt. A resolved attempt that doesn't end the match (a checkout short of the cap target, or a failure under easy fail) opens the next round.
- **Derived, never stored:** the ladder position (`currentTarget`), the live countdown within the open attempt (`remainingInAttempt`), and visit counts — all folded from the turn totals (or dart totals, under VISUAL_BOARD).

## Open questions

- Whether V1 should default to 9 darts hard-fail (−1) instead of easy stay (common pub default is −1 with a 121 floor).
```

- [ ] **Step 3: Commit**

```bash
git add docs/game-rules/rulesets/121.md
git commit -m "docs(game-rules): add 121's Capture section, document its final-visit early-bust rule"
```

---

## Final check

- [ ] Run `cd app && npm run validate:app` once more — this is the same command as Task 8, re-run after the doc-only tasks (9-12) to confirm they introduced no code regression (they shouldn't have touched anything `validate:app` scans, but this is the plan's last gate before calling the branch done).
- [ ] Run the `context-maintenance` skill per root `CLAUDE.md`'s mandatory-every-task rule before considering this plan's work complete.
