# 121: final-visit no-finish auto-close — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix #164 — in 121's final (3rd) visit of an attempt, close the visit the instant no double-out finish is still reachable with the darts left, instead of waiting for a dart that cannot change the outcome; also stop `checkoutHint` from showing a route that needs more darts than remain.

**Architecture:** A new pure predicate `isCheckoutReachable(remainingScore, dartsAvailable)` in `checkout-path.module.ts` gates a new early-close branch in `OneTwentyOneEngine.settleVisit`, and separately gates the play page's `checkoutHint` display. No new state, no new files — this composes onto the existing bust/checkout/3-dart closing logic.

**Tech Stack:** TypeScript, Vitest.

## Global Constraints

- Scope: `one-twenty-one.engine.module.ts`, `checkout-path.module.ts`, `one-twenty-one-play.data.ts` only. Do not touch `five-oh-one.engine.module.ts` — confirmed in brainstorming that 501 has no visit cap, so the identical `settleVisit` shape there is not a bug.
- Visits 1 and 2 of an attempt are unaffected: a dart that cannot finish *that* visit still carries its score into the next visit, so every dart in those visits stays required. Only the attempt's 3rd (final) visit can close early.
- `app/CLAUDE.md`: no `//` or `/* */` comments inside function bodies in `app/src/**/*.ts` (JSDoc above the declaration only); tests mirror `app/src/`'s directory structure under `app/tests/`, never colocated; every source edit needs a covering test edit (`scripts/check-test-coverage.sh`).
- Run `cd app && npm run format` before considering any task done, and `npm run validate:app` before the branch is considered complete (see Task 4).

---

### Task 1: `isCheckoutReachable` in `checkout-path.module.ts`

**Files:**
- Modify: `app/src/modules/game/checkout-path.module.ts`
- Test: `app/tests/modules/game/checkout-path.module.test.ts`

**Interfaces:**
- Produces: `isCheckoutReachable(remainingScore: number, dartsAvailable: number): boolean` — exported from `checkout-path.module.ts`, alongside the existing `checkoutPathFor`. True iff `checkoutPathFor(remainingScore)` is non-null and its route length is `<= dartsAvailable`.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/modules/game/checkout-path.module.test.ts` (after the existing `checkoutPathFor — table-wide invariants` block, i.e. at end of file):

```ts
describe("isCheckoutReachable", () => {
  it("is true when the route's minimum darts exactly matches darts available", () => {
    expect(isCheckoutReachable(121, 3)).toBe(true); // T20 T11 D14 = 3 darts
  });

  it("is true with slack darts to spare", () => {
    expect(isCheckoutReachable(25, 3)).toBe(true); // 9 D8 = 2 darts, 3 available
  });

  it("is false when fewer darts remain than the route needs", () => {
    expect(isCheckoutReachable(25, 1)).toBe(false); // needs 2, only 1 left
  });

  it("is true for a single-dart double with exactly 1 dart left", () => {
    expect(isCheckoutReachable(40, 1)).toBe(true); // D20
  });

  it("is false for every bogey number regardless of darts available", () => {
    for (const bogey of [169, 168, 166, 165, 163, 162, 159, 1]) {
      expect(isCheckoutReachable(bogey, 3)).toBe(false);
    }
  });

  it("is false when no darts remain", () => {
    expect(isCheckoutReachable(40, 0)).toBe(false);
  });
});
```

Also update the top import line from:

```ts
import { checkoutPathFor } from "@modules/game/checkout-path.module";
```

to:

```ts
import {
  checkoutPathFor,
  isCheckoutReachable,
} from "@modules/game/checkout-path.module";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/checkout-path.module.test.ts`
Expected: FAIL — `isCheckoutReachable` is not exported.

- [ ] **Step 3: Implement `isCheckoutReachable`**

In `app/src/modules/game/checkout-path.module.ts`, add after the `checkoutPathFor` function (end of file):

```ts
/**
 * Whether `remainingScore` can be brought to exactly 0 on a double using no
 * more than `dartsAvailable` darts — `checkoutPathFor`'s minimum route
 * length gated by however many darts the caller actually has left, rather
 * than the chart's own fixed 3-dart ceiling. False for every bogey number
 * regardless of `dartsAvailable`: no route exists to gate.
 */
export function isCheckoutReachable(
  remainingScore: number,
  dartsAvailable: number,
): boolean {
  const path = checkoutPathFor(remainingScore);
  return path !== null && path.length <= dartsAvailable;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/checkout-path.module.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/checkout-path.module.ts app/tests/modules/game/checkout-path.module.test.ts
git commit -m "Add isCheckoutReachable to checkout-path.module (#164)"
```

---

### Task 2: Close the final visit early in `OneTwentyOneEngine.settleVisit`

**Files:**
- Modify: `app/src/modules/game/one-twenty-one.engine.module.ts`
- Test: `app/tests/modules/game/one-twenty-one.engine.module.test.ts`

**Interfaces:**
- Consumes: `isCheckoutReachable(remainingScore: number, dartsAvailable: number): boolean` from Task 1.
- Produces: no new public API — `settleVisit`'s existing `boolean` return (visit closed or not) now also goes `true` when the attempt's final visit can no longer reach a finish.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/modules/game/one-twenty-one.engine.module.test.ts`, inside (at the end of) the existing `describe("visual board capture", ...)` block — reuse its `dartAt`, `trebleTwenty`, `trebleNineteen`, `doubleTwenty` fixtures already defined there:

```ts
  it("closes the attempt's 3rd visit early once no finish is reachable, without a 3rd dart", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;
    // Null coordinates, not `dartAt(0, 0, ...)` — (0, 0) is the bull centre
    // and would reclassify as INNER_BULL (score 50); a coordinate-less dart
    // is the only reliable MISS/score-0 fixture (see "keeps a
    // coordinate-less dart's own zone and scores it 0" above).
    const missDart: DartObservation = {
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    };

    engine.record({ scoreAttempted: 0 }); // visit 1: no-op, stays at 121
    engine.record({ scoreAttempted: 96 }); // visit 2: 121 - 96 = 25, visitsThisAttempt now 2

    engine.record(missDart); // visit 3, dart 1: remaining stays 25, 2 darts left — still reachable (9 D8)
    expect(engine.state().seats[0].visitsThisAttempt).toBe(2);
    expect(engine.facts().turns.at(-1)?.completedAt).toBeNull();

    const after = engine.record(missDart); // visit 3, dart 2: 1 dart left — 25 needs 2, unreachable

    const closedVisit = engine.facts().turns.at(-1)!;
    expect(closedVisit.darts).toHaveLength(2);
    expect(closedVisit.completedAt).not.toBeNull();
    expect(after.seats[0]).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 121,
      remainingInAttempt: 121,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    });
  });

  it("does not close visit 1 early on the same unreachable-with-1-dart shape — every dart still required", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;
    // Climb from 121 to 130 via quick-score checkouts, so visit 1 of target
    // 130 starts fresh (visitsThisAttempt 0) rather than reusing 121's own
    // 3-dart-route shape.
    for (let target = 121; target < 130; target += 1) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true });
    }

    engine.record(trebleTwenty); // 130 - 60 = 70, 2 darts left — reachable (T18 D8)
    const after = engine.record(trebleNineteen); // 70 - 57 = 13, 1 dart left — 13 needs 2 (5 D4), unreachable

    expect(after.seats[0].visitsThisAttempt).toBe(0); // visit still open, not yet counted
    const openVisit = engine.facts().turns.at(-1)!;
    expect(openVisit.darts).toHaveLength(2);
    expect(openVisit.completedAt).toBeNull();
  });

  it("still requires the dart in the final visit when a finish is reachable, and lets it check out", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;
    const missDart: DartObservation = {
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    };

    engine.record({ scoreAttempted: 0 }); // visit 1: no-op, stays at 121
    engine.record({ scoreAttempted: 81 }); // visit 2: 121 - 81 = 40, visitsThisAttempt now 2

    engine.record(missDart); // visit 3, dart 1: remaining stays 40, 2 darts left
    const afterSecondMiss = engine.record(missDart); // dart 2: 1 dart left — 40 needs 1 (D20), still reachable

    expect(afterSecondMiss.seats[0].visitsThisAttempt).toBe(2);
    const stillOpen = engine.facts().turns.at(-1)!;
    expect(stillOpen.darts).toHaveLength(2);
    expect(stillOpen.completedAt).toBeNull();

    const checkedOut = engine.record(doubleTwenty); // dart 3: D20 finishes 40 exactly
    expect(checkedOut.seats[0]).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 122,
      remainingInAttempt: 122,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts -t "closes the attempt's 3rd visit early"`
Expected: FAIL — the visit stays open after the 2nd dart (`completedAt` is still `null`), because `settleVisit` has no early-close branch yet.

- [ ] **Step 3: Implement the early-close branch**

In `app/src/modules/game/one-twenty-one.engine.module.ts`, add the import (below the existing `checkoutDartsRejection` import):

```ts
import { checkoutDartsRejection } from "./checkout-darts.module";
import { isCheckoutReachable } from "./checkout-path.module";
```

Replace the `remainingBeforeVisit` method:

```ts
  /**
   * What the attempt's remaining score was immediately before `visit`
   * opened, for the seat that threw it — every turn strictly before `visit`
   * in `this.turns` is always already closed (an engine only ever has one
   * open turn, the last one), so folding the whole log up to that point is
   * safe and exact.
   */
  private remainingBeforeVisit(visit: TurnFact): number {
    const index = this.turns.indexOf(visit);
    return foldOneTwentyOneState(
      { stages: this.stages, turns: this.turns.slice(0, index) },
      this.config,
    ).seats.find((seat) => seat.participantRef === visit.participantRef)!
      .remainingInAttempt;
  }
```

with:

```ts
  /**
   * The seat state immediately before `visit` opened, for the seat that
   * threw it — every turn strictly before `visit` in `this.turns` is always
   * already closed (an engine only ever has one open turn, the last one), so
   * folding the whole log up to that point is safe and exact. `settleVisit`
   * reads both `remainingInAttempt` (to score the visit) and
   * `visitsThisAttempt` (to know whether `visit` is the attempt's last).
   */
  private seatBeforeVisit(visit: TurnFact): OneTwentyOneSeatState {
    const index = this.turns.indexOf(visit);
    return foldOneTwentyOneState(
      { stages: this.stages, turns: this.turns.slice(0, index) },
      this.config,
    ).seats.find((seat) => seat.participantRef === visit.participantRef)!;
  }
```

Replace the `settleVisit` method:

```ts
  /**
   * Applies the bust and checkout rules to a visit that just took a dart,
   * and stamps `completedAt` when the visit resolves.
   * @returns whether this dart resolved (closed) the visit — the caller
   *   uses this, not merely "the round changed", to decide whether to open
   *   a new round stage, since an already-in-progress round's
   *   `visitsThisAttempt` can coincidentally read 0 before the round's very
   *   first visit has even closed.
   */
  private settleVisit(visit: TurnFact): boolean {
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const remainingAfter = this.remainingBeforeVisit(visit) - thrown;
    const lastDart = visit.darts.at(-1)!;
    const checkedOut = remainingAfter === 0 && lastDart.hitZoneKey === "DOUBLE";
    const busted =
      remainingAfter < 0 ||
      remainingAfter === 1 ||
      (remainingAfter === 0 && !checkedOut);

    if (busted) {
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
      return true;
    }

    visit.totalScore = thrown;
    const resolved = checkedOut || visit.darts.length === DARTS_PER_VISIT;
    if (resolved) {
      visit.completedAt = new Date().toISOString();
    }
    return resolved;
  }
```

with:

```ts
  /**
   * Applies the bust and checkout rules to a visit that just took a dart,
   * and stamps `completedAt` when the visit resolves. A dart in the
   * attempt's 3rd (final) visit also closes the visit immediately once no
   * double-out route can still be reached with the darts left in it — the
   * outcome is already decided at that point (the fail rule below resets
   * `remainingInAttempt` to `currentTarget` regardless of what a further
   * dart would score), so nothing is gained by waiting for a dart that
   * cannot matter. Visits 1 and 2 never take this branch: a dart that
   * cannot finish those still carries its score into the next visit.
   * @returns whether this dart resolved (closed) the visit — the caller
   *   uses this, not merely "the round changed", to decide whether to open
   *   a new round stage, since an already-in-progress round's
   *   `visitsThisAttempt` can coincidentally read 0 before the round's very
   *   first visit has even closed.
   */
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
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
      return true;
    }

    visit.totalScore = thrown;
    const isFinalVisit = before.visitsThisAttempt === VISITS_PER_ATTEMPT - 1;
    const noFinishLeft =
      isFinalVisit &&
      !isCheckoutReachable(remainingAfter, DARTS_PER_VISIT - visit.darts.length);
    const resolved =
      checkedOut || visit.darts.length === DARTS_PER_VISIT || noFinishLeft;
    if (resolved) {
      visit.completedAt = new Date().toISOString();
    }
    return resolved;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts`
Expected: PASS, every test in the file green (including the pre-existing ones — this change must not alter any of their outcomes).

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/one-twenty-one.engine.module.ts app/tests/modules/game/one-twenty-one.engine.module.test.ts
git commit -m "Close 121's final visit early once no finish is reachable (#164)"
```

---

### Task 3: Fix `checkoutHint` to respect darts left in the open visit

**Files:**
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts`
- Test: `app/tests/lib/game/one-twenty-one-play.data.test.ts`

**Interfaces:**
- Consumes: `isCheckoutReachable` from Task 1.
- Produces: no new public API — `checkoutHint()`'s existing `string` return now goes `""` once the shown route would need more darts than remain in the open visit.

- [ ] **Step 1: Write the failing tests**

Add a new `describe` block to `app/tests/lib/game/one-twenty-one-play.data.test.ts`, right after the closing `});` of the existing `describe("recordDart (board input)", ...)` block (after line 296 in the current file):

```ts
  describe("checkoutHint", () => {
    it("shows the 3-dart route when the visit has not started", () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;

      expect(play.checkoutHint.call(play)).toBe("T20 T11 D14");
    });

    it("goes blank once the open visit has too few darts left for the route", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;

      await play.recordDart.call(play, {
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      });
      await play.recordDart.call(play, {
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      });

      expect(play.checkoutHint.call(play)).toBe("");
    });

    it("still shows a route reachable with the darts left", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create(config) as any;
      play.engine!.record({ scoreAttempted: 81 });
      store.game.recordFacts(play.engine!.facts());

      await play.recordDart.call(play, {
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      });
      await play.recordDart.call(play, {
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        locationX: null,
        locationY: null,
      });

      expect(play.checkoutHint.call(play)).toBe("D20");
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts -t checkoutHint`
Expected: FAIL — the "goes blank" case still shows `"9 D8"` (or, for the 121-at-start case in this test, `"T20 T11 D14"`), since `checkoutHint` ignores darts-remaining today.

- [ ] **Step 3: Implement the fix**

In `app/src/lib/game/one-twenty-one-play.data.ts`, change the import on line 4 from:

```ts
import { checkoutPathFor } from "@modules/game/checkout-path.module";
```

to:

```ts
import {
  checkoutPathFor,
  isCheckoutReachable,
} from "@modules/game/checkout-path.module";
```

Add a helper function after `ownerRef` (after its closing `}`, before `computeStats`):

```ts
/**
 * Darts left in the currently open visit — `DARTS_PER_VISIT` when there is
 * no open visit (a fresh visit, or every visit under quick score, which
 * records a whole visit's total in one call and never leaves one open).
 */
function dartsLeftInOpenVisit(turns: readonly TurnFact[]): number {
  const open = turns.at(-1);
  if (!open || open.completedAt !== null) return DARTS_PER_VISIT;
  return DARTS_PER_VISIT - open.darts.length;
}
```

Replace the `checkoutHint` method:

```ts
    checkoutHint(this: OneTwentyOnePlayContext): string {
      const path = checkoutPathFor(this.remainingInAttempt());
      return path ? path.join(" ") : "";
    },
```

with:

```ts
    checkoutHint(this: OneTwentyOnePlayContext): string {
      const remaining = this.remainingInAttempt();
      const dartsLeft = dartsLeftInOpenVisit(this.$store.game.turns);
      return isCheckoutReachable(remaining, dartsLeft)
        ? checkoutPathFor(remaining)!.join(" ")
        : "";
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts`
Expected: PASS, every test in the file green.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/one-twenty-one-play.data.ts app/tests/lib/game/one-twenty-one-play.data.test.ts
git commit -m "Stop checkoutHint suggesting a route the open visit can't reach (#164)"
```

---

### Task 4: Full validation and context maintenance

**Files:** none new — validation only.

- [ ] **Step 1: Run the full validation chain**

Run: `cd app && npm run validate:app`
Expected: every step exits 0; the type gate reports 0 errors, 0 warnings, 0 hints.

- [ ] **Step 2: Run the full test suite once more**

Run: `cd app && npx vitest run`
Expected: PASS, no regressions anywhere in the suite.

- [ ] **Step 3: Format check**

Run: `cd app && npm run format && npm run format:check`
Expected: clean; commit any formatting diff if `format` changed something.

- [ ] **Step 4: Run the context-maintenance skill**

Invoke the `context-maintenance` skill (per root `CLAUDE.md`, mandatory before any task is claimed done) to confirm no doc/context updates are needed — this change touches no schema, no new game, no new architecture pattern, so it is expected to report nothing to update, but the skill's gate scripts must still run and pass.

- [ ] **Step 5: Run the run-all-gates skill**

Invoke the `run-all-gates` skill to dispatch the `app/`-relevant `check-*.sh` scripts (in particular `check-game-engines.sh`, `check-test-coverage.sh`, `check-no-inline-comments.sh`) and confirm every one passes.

## Self-review notes

- Spec coverage: Task 1 covers the spec's `checkout-path.module.ts` section; Task 2 covers the `one-twenty-one.engine.module.ts` section (including the visits-1-2-unaffected requirement, tested explicitly); Task 3 covers the `checkoutHint` section. Task 4 covers validation, matching the spec's Testing section plus this repo's mandatory completion gates.
- No placeholders: every step shows the exact code, exact old/new snippets, and exact commands with expected results.
- Type consistency checked: `isCheckoutReachable(remainingScore: number, dartsAvailable: number): boolean` is the same signature everywhere it's used (Task 2's `settleVisit`, Task 3's `checkoutHint`) and everywhere it's tested (Task 1).
