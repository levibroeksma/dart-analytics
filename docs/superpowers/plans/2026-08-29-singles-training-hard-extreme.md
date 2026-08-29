# Singles Training Hard/Extreme Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `HARD` (≥1 of 3 darts must hit the current segment each visit) and `EXTREME` (≥2 of 3) difficulty to Singles Training. Failing the requirement ends the match immediately by elimination (Bob's 27 pattern): the failing seat is `LOST`, any other seat wins regardless of its own progress or points.

**Architecture:** Extend the existing `SinglesConfig` schema/enum, thread a per-visit hit counter through `applySinglesTrainingDart`, and reuse `match-outcome.module.ts`'s `eliminationWinner` (already powering Bob's 27) to resolve the match the instant a seat fails — entirely inside `singles-training.engine.module.ts`, with no changes to shared modules. Setup UI gains a second `Toggle` (mirroring the existing order-mode picker); play/results UI gains `WON`/`LOST` outcomes alongside the existing `COMPLETE`/`TIE`.

**Tech Stack:** TypeScript, Zod, Astro, Alpine.js, Vitest.

## Global Constraints

- `EASY` stays exactly as-is (value and label) — only `HARD` and `EXTREME` are added. `PROFESSIONAL` stays deferred/`TBD`, not implemented.
- "Hit" = any dart landing on the current section (single/double/treble for a `NUMBER` target, outer/inner for `BULL`) — independent of point value.
- Elimination is immediate and match-wide: the instant one seat fails, the whole match ends; any other seat wins regardless of its own progress or points. This must hold even when the other seat has not yet reached `COMPLETE`.
- Every changed `.ts` file under `app/src/` needs a covering test change in the same task (`scripts/check-test-coverage.sh`).
- No comments inside function/method bodies in `app/src/**/*.ts` (JSDoc above the declaration only). Test files are exempt.
- `cd app && npx vitest run <path>` runs one file; `npm run validate:app` is the full gate (Task 6).

---

### Task 1: Config schema — widen `difficulty`

**Files:**
- Modify: `app/src/lib/game/rulesets/types.ts` (the `SinglesConfig` Zod schema, ~line 72-91)
- Test: `app/tests/services/rulesets/singles-training/singles-training.validator.test.ts`

**Interfaces:**
- Produces: `SinglesConfigData["difficulty"]` = `"EASY" | "HARD" | "EXTREME"`; `SinglesSnapshot["difficulty"]` follows automatically (it's typed as `SinglesConfigData["difficulty"]`). Every later task reads `SinglesSnapshot["difficulty"]` for this union.

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/services/rulesets/singles-training/singles-training.validator.test.ts`, inside the existing `describe("singlesTrainingValidator.validateConfig", ...)` block:

```ts
  it("accepts HARD difficulty", () => {
    const result = singlesTrainingValidator.validateConfig({
      config: { ...validConfig, difficulty: "HARD" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts EXTREME difficulty", () => {
    const result = singlesTrainingValidator.validateConfig({
      config: { ...validConfig, difficulty: "EXTREME" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("still rejects a difficulty value outside EASY/HARD/EXTREME", () => {
    const result = singlesTrainingValidator.validateConfig({
      config: { ...validConfig, difficulty: "PROFESSIONAL" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/services/rulesets/singles-training/singles-training.validator.test.ts`
Expected: the two new "accepts" tests FAIL (schema still only allows `"EASY"`); the "still rejects" test already passes.

- [ ] **Step 3: Widen the schema**

In `app/src/lib/game/rulesets/types.ts`, change the `SinglesConfig` schema's `difficulty` line:

```ts
    difficulty: z.enum(["EASY", "HARD", "EXTREME"]),
```

(was `difficulty: z.enum(["EASY"]),`). Nothing else in that schema block changes.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/services/rulesets/singles-training/singles-training.validator.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/rulesets/types.ts app/tests/services/rulesets/singles-training/singles-training.validator.test.ts
git commit -m "Widen Singles Training difficulty schema to HARD/EXTREME"
```

---

### Task 2: Engine — mandatory-hit failure and elimination

**Files:**
- Modify: `app/src/modules/game/types.ts` (`SinglesTrainingSeatState`, `SinglesTrainingState`, ~lines 51-61)
- Modify: `app/src/modules/game/singles-training.engine.module.ts`
- Test: `app/tests/modules/game/singles-training.engine.module.test.ts`

**Interfaces:**
- Consumes: `SinglesSnapshot["difficulty"]` (Task 1). `eliminationWinner(seats: {sideKey: string; failed: boolean}[]): string | null` from `./match-outcome.module` (existing, used unchanged by `bobs27.engine.module.ts`).
- Produces: `SinglesTrainingSeatState.status` now `"IN_PROGRESS" | "COMPLETE" | "LOST"`; `SinglesTrainingSeatState.hitsThisVisit: number` (new field, alongside the existing `dartsThisVisit: number` — kept as a plain count, not converted to an array, to avoid rewriting the ~30 existing `dartsThisVisit` assertions in the test file). `SinglesTrainingState.status` now `"IN_PROGRESS" | "COMPLETE" | "TIE" | "LOST"`. These are the types Task 4 (play/results UI) reads.

**Note on deviation from the design spec (§3):** the spec sketched `dartsThisVisit: boolean[]` and a widened shared `scoreCompareOutcome`/`MatchOutcome`. This task instead adds a separate `hitsThisVisit: number` counter (smaller diff, same externally observable behavior) and keeps the elimination/score-compare blend entirely local to `foldSinglesTrainingState` (no edits to `match-outcome.module.ts`, so Around the Clock/Doubles Training/Score Training/TUOD — which also call `scoreCompareOutcome` and assign its `status` into their own narrower-typed state — are untouched and cannot regress).

- [ ] **Step 1: Write the failing tests**

In `app/tests/modules/game/singles-training.engine.module.test.ts`:

**1a. Fix the four existing typed object literals that will no longer compile** once `SinglesTrainingSeatState` gains a required `hitsThisVisit` field — add `hitsThisVisit: 0,` to each (functionally inert under `EASY`, where `requiredHitsFor` is always `0`):

- The `initialSinglesTrainingState` test's expected seat object (~line 108-117): add `hitsThisVisit: 0,` after `dartsThisVisit: 0,`.
- The `bullState` object literal (~line 250-257, in `describe("applySinglesTrainingDart — BULL target scoring", ...)`​): add `hitsThisVisit: 0,`.
- The `twoDartsIn` object literal in the "sets status COMPLETE on the bull visit's 3rd dart" test (~line 290-297): add `hitsThisVisit: 0,`.
- The `completeState` object literal in `describe("applySinglesTrainingDart — terminal state guard", ...)` (~line 321-328): add `hitsThisVisit: 0,`.
- The `twoDartsIn` object literal in `describe("applySinglesTrainingDart — order-dependent completion", ...)` (~line 983-990): add `hitsThisVisit: 0,`.

**1b. Add new tests.** Append these new `describe` blocks at the end of the file:

```ts
describe("applySinglesTrainingDart — HARD/EXTREME mandatory-hit failure", () => {
  const hardConfig: Seated<SinglesSnapshot> = { ...config, difficulty: "HARD" };
  const extremeConfig: Seated<SinglesSnapshot> = {
    ...config,
    difficulty: "EXTREME",
  };

  it("HARD: a visit with zero hits ends the seat as LOST", () => {
    let state = initialSeat();
    state = applySinglesTrainingDart(hardConfig, state, missObservationFor(state));
    state = applySinglesTrainingDart(hardConfig, state, missObservationFor(state));
    state = applySinglesTrainingDart(hardConfig, state, missObservationFor(state));
    expect(state.status).toBe("LOST");
    expect(state.hitsThisVisit).toBe(0);
  });

  it("HARD: a visit with exactly one hit survives and advances", () => {
    let state = initialSeat();
    state = applySinglesTrainingDart(
      hardConfig,
      state,
      hitObservationFor(state, "SINGLE"),
    );
    state = applySinglesTrainingDart(hardConfig, state, missObservationFor(state));
    state = applySinglesTrainingDart(hardConfig, state, missObservationFor(state));
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.targetIndex).toBe(1);
  });

  it("EXTREME: a visit with exactly one hit still ends the seat as LOST", () => {
    let state = initialSeat();
    state = applySinglesTrainingDart(
      extremeConfig,
      state,
      hitObservationFor(state, "SINGLE"),
    );
    state = applySinglesTrainingDart(extremeConfig, state, missObservationFor(state));
    state = applySinglesTrainingDart(extremeConfig, state, missObservationFor(state));
    expect(state.status).toBe("LOST");
  });

  it("EXTREME: a visit with two hits survives and advances", () => {
    let state = initialSeat();
    state = applySinglesTrainingDart(
      extremeConfig,
      state,
      hitObservationFor(state, "SINGLE"),
    );
    state = applySinglesTrainingDart(
      extremeConfig,
      state,
      hitObservationFor(state, "DOUBLE"),
    );
    state = applySinglesTrainingDart(extremeConfig, state, missObservationFor(state));
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.targetIndex).toBe(1);
  });

  it("HARD: failing on the final BULL visit ends LOST, not COMPLETE", () => {
    const bullTwoDartsIn: SinglesTrainingSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 20,
      totalPoints: 100,
      dartsThisVisit: 2,
      hitsThisVisit: 0,
      status: "IN_PROGRESS",
    };
    const next = applySinglesTrainingDart(hardConfig, bullTwoDartsIn, {
      hitTargetNumber: 25,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    expect(next.status).toBe("LOST");
  });
});

describe("SinglesTrainingEngine — HARD/EXTREME solo elimination", () => {
  const hardConfig: Seated<SinglesSnapshot> = { ...config, difficulty: "HARD" };

  function missDart(number: number): DartObservation {
    return {
      hitTargetNumber: number,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    };
  }

  it("ends the whole session as LOST when the solo seat fails a visit", () => {
    const engine = new SinglesTrainingEngine(hardConfig);
    engine.record(missDart(1));
    engine.record(missDart(1));
    const state = engine.record(missDart(1));

    expect(state.status).toBe("LOST");
    expect(state.winningSideKey).toBeNull();
    expect(state.seats[0].status).toBe("LOST");
    expect(engine.isComplete()).toBe(true);
  });

  it("rejects a stray record() once the solo seat has failed, leaving the fact log untouched", () => {
    const engine = new SinglesTrainingEngine(hardConfig);
    engine.record(missDart(1));
    engine.record(missDart(1));
    engine.record(missDart(1));
    const factsBefore = engine.facts();

    expect(() => engine.record(missDart(2))).toThrow();
    expect(engine.facts()).toEqual(factsBefore);
  });

  it("undo reverts a LOST solo session back to IN_PROGRESS", () => {
    const engine = new SinglesTrainingEngine(hardConfig);
    engine.record(missDart(1));
    engine.record(missDart(1));
    engine.record(missDart(1));
    expect(engine.isComplete()).toBe(true);

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().seats[0].status).toBe("IN_PROGRESS");

    const resumed = engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    expect(resumed.seats[0].status).toBe("IN_PROGRESS");
  });

  it("wouldComplete reports true for the dart that would trigger elimination", () => {
    const engine = new SinglesTrainingEngine(hardConfig);
    engine.record(missDart(1));
    engine.record(missDart(1));
    expect(engine.wouldComplete(missDart(1))).toBe(true);
  });
});

describe("SinglesTrainingEngine — HARD/EXTREME 1v1 elimination", () => {
  const twoSeats = [
    {
      participantRef: "p1",
      displayName: "A",
      sideKey: "A",
      participantTypeKey: "PLAYER" as const,
    },
    {
      participantRef: "p2",
      displayName: "B",
      sideKey: "B",
      participantTypeKey: "GUEST" as const,
    },
  ];
  const hardTwoSeatConfig: Seated<SinglesSnapshot> = {
    orderMode: "LOW_TO_HIGH",
    targetOrder: Array.from({ length: 20 }, (_, i) => i + 1).concat(25),
    difficulty: "HARD",
    pointsSingle: 1,
    pointsDouble: 2,
    pointsTreble: 3,
    seats: twoSeats,
  };

  function dart(number: number, zone: DartZoneKey): DartObservation {
    return {
      hitTargetNumber: number,
      hitZoneKey: zone,
      locationX: null,
      locationY: null,
    };
  }

  it("ends the match immediately when one seat fails, even though the other seat is still IN_PROGRESS", () => {
    const engine = new SinglesTrainingEngine(hardTwoSeatConfig);
    for (let d = 0; d < 3; d++) engine.record(dart(1, "SINGLE")); // p1 survives target 1
    for (let d = 0; d < 3; d++) engine.record(dart(1, "MISS")); // p2 fails target 1

    const state = engine.state();
    expect(state.seats[1].status).toBe("LOST");
    expect(state.seats[0].status).toBe("IN_PROGRESS");
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("A");
  });

  it("rejects a stray record() from the surviving seat once the match has ended by elimination", () => {
    const engine = new SinglesTrainingEngine(hardTwoSeatConfig);
    for (let d = 0; d < 3; d++) engine.record(dart(1, "SINGLE"));
    for (let d = 0; d < 3; d++) engine.record(dart(1, "MISS"));
    const factsBefore = engine.facts();

    expect(() => engine.record(dart(2, "SINGLE"))).toThrow();
    expect(engine.facts()).toEqual(factsBefore);
  });

  it("normal score-compare behavior is unchanged when nobody fails under HARD", () => {
    const engine = new SinglesTrainingEngine(hardTwoSeatConfig);
    for (let round = 0; round < 21; round++) {
      const seatA = engine.state().seats[0];
      for (let d = 0; d < 3; d++) {
        engine.record(hitObservationFor(seatA, "DOUBLE"));
      }
      const seatB = engine.state().seats[1];
      for (let d = 0; d < 3; d++) {
        engine.record(hitObservationFor(seatB, "SINGLE"));
      }
    }
    const state = engine.state();
    expect(state.status).toBe("COMPLETE");
    expect(state.winningSideKey).toBe("A");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: FAIL — TypeScript compile errors on the missing `hitsThisVisit` field in the five existing literals, and the new `HARD`/`EXTREME` tests fail (difficulty currently has no effect).

- [ ] **Step 3: Implement the engine changes**

In `app/src/modules/game/types.ts`, replace (~lines 51-61):

```ts
export type SinglesTrainingSeatState = SeatState & {
  targetIndex: number;
  totalPoints: number;
  dartsThisVisit: number;
  hitsThisVisit: number;
  status: "IN_PROGRESS" | "COMPLETE" | "LOST";
};

export type SinglesTrainingState = MultiSeatState<SinglesTrainingSeatState> & {
  status: "IN_PROGRESS" | "COMPLETE" | "TIE" | "LOST";
  winningSideKey: string | null;
};
```

In `app/src/modules/game/singles-training.engine.module.ts`:

Add `eliminationWinner` to the existing import:

```ts
import { eliminationWinner, scoreCompareOutcome } from "./match-outcome.module";
```

Update `initialSeatState`:

```ts
function initialSeatState(seat: SeatFact): SinglesTrainingSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    totalPoints: 0,
    dartsThisVisit: 0,
    hitsThisVisit: 0,
    status: "IN_PROGRESS",
  };
}
```

Add two pure helpers directly above `trainingPointsFor`:

```ts
function requiredHitsFor(difficulty: SinglesSnapshot["difficulty"]): number {
  if (difficulty === "HARD") return 1;
  if (difficulty === "EXTREME") return 2;
  return 0;
}

/**
 * Whether `observation` landed on `target`'s section at all — single, double
 * or treble on a NUMBER target, outer or inner on BULL — independent of the
 * ring's point value, so a HARD/EXTREME mandatory-hit count never depends on
 * a configured `pointsSingle`/`pointsDouble`/`pointsTreble` staying nonzero.
 */
function isHitOnTarget(
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  if (target.kind === "BULL") {
    return (
      observation.hitTargetNumber === BULL_TARGET_NUMBER &&
      (observation.hitZoneKey === "OUTER_BULL" ||
        observation.hitZoneKey === "INNER_BULL")
    );
  }
  return (
    observation.hitTargetNumber === target.number &&
    (SINGLE_ZONE_KEYS.has(observation.hitZoneKey) ||
      observation.hitZoneKey === "DOUBLE" ||
      observation.hitZoneKey === "TREBLE")
  );
}
```

Replace `applySinglesTrainingDart`'s body:

```ts
export function applySinglesTrainingDart(
  config: SinglesSnapshot,
  state: SinglesTrainingSeatState,
  observation: DartObservation,
): SinglesTrainingSeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session is complete; undo first to correct it.",
    );
  }

  const target = targetAt(numbersPath(config.targetOrder), state.targetIndex);
  const totalPoints =
    state.totalPoints + trainingPointsFor(target, config, observation);
  const dartsThisVisit = state.dartsThisVisit + 1;
  const hitsThisVisit =
    state.hitsThisVisit + (isHitOnTarget(target, observation) ? 1 : 0);

  if (dartsThisVisit < 3) {
    return { ...state, totalPoints, dartsThisVisit, hitsThisVisit };
  }
  if (hitsThisVisit < requiredHitsFor(config.difficulty)) {
    return {
      ...state,
      totalPoints,
      dartsThisVisit: 0,
      hitsThisVisit: 0,
      status: "LOST",
    };
  }
  if (state.targetIndex === 20) {
    return {
      ...state,
      totalPoints,
      dartsThisVisit: 0,
      hitsThisVisit: 0,
      status: "COMPLETE",
    };
  }
  return {
    ...state,
    totalPoints,
    dartsThisVisit: 0,
    hitsThisVisit: 0,
    targetIndex: state.targetIndex + 1,
  };
}
```

Replace `foldSinglesTrainingState`'s body (keep its existing JSDoc, updating the last sentence to note the elimination branch):

```ts
/**
 * Folds the whole fact log into the session's state, mirroring
 * `foldAroundTheClockState`. Under EASY, score-compare (highest
 * training-point total) decides the match exactly as before. Under
 * HARD/EXTREME, the instant any seat fails its mandatory-hit requirement
 * (`status: "LOST"`), the match ends immediately via `eliminationWinner` —
 * the same Bob's-27 pattern — regardless of any other seat's own progress.
 */
function foldSinglesTrainingState(
  facts: EngineFacts,
  config: Seated<SinglesSnapshot>,
): SinglesTrainingState {
  const seats = foldSeatStates(
    facts.turns,
    config.seats,
    initialSeatState,
    (state, observation) =>
      applySinglesTrainingDart(config, state, observation),
  );

  const failedSeats = seats.filter((seat) => seat.status === "LOST");
  const outcome: { status: SinglesTrainingState["status"]; winningSideKey: string | null } =
    seats.length === 1
      ? { status: seats[0].status, winningSideKey: null }
      : failedSeats.length > 0
        ? {
            status: "COMPLETE",
            winningSideKey: eliminationWinner(
              seats.map((seat) => ({
                sideKey: seat.sideKey,
                failed: seat.status === "LOST",
              })),
            ),
          }
        : scoreCompareOutcome(
            seats.map((seat) => ({
              sideKey: seat.sideKey,
              completed: seat.status === "COMPLETE",
              metric: seat.totalPoints,
            })),
            "HIGHEST",
            "IN_PROGRESS",
          );

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status: outcome.status,
    winningSideKey: outcome.winningSideKey,
    seats,
  };
}
```

Update `record()`'s JSDoc and body — replace the second paragraph of its JSDoc (the one starting "Guarded only by the ACTIVE seat's own `status`") with:

```
   * Guarded at both the match and seat level. EASY difficulty alone would
   * let the per-seat guard suffice (every seat's own visit count is fixed at
   * 21 and every visit is exactly 3 darts, so both seats always finish in
   * strict lockstep with no race/instant-win shortcut). HARD/EXTREME's
   * elimination breaks that: the match can now end the instant one seat
   * fails while the OTHER seat's own status still reads `IN_PROGRESS` —
   * exactly the `ShanghaiEngine`-style race this file used to disclaim. The
   * top-level `before.status !== "IN_PROGRESS"` check below (mirroring
   * `Bobs27Engine.record()`) catches that case; the seat-level check still
   * rejects a stray call once the match has normally decided by
   * score-compare.
```

and its body:

```ts
  record(observation: DartObservation): SinglesTrainingState {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the match has ended; undo first to correct it.",
      );
    }
    const seatBefore = activeSeatState(before);
    if (seatBefore.status !== "IN_PROGRESS") {
      throw new Error(
        "Cannot record a dart once the session is complete; undo first to correct it.",
      );
    }

    const openTurn = this.openOrCreateTurn(before.activeParticipantRef);
    appendObservedDart(openTurn, observation);
    if (openTurn.darts.length === 3) {
      openTurn.completedAt = new Date().toISOString();
    }

    return this.deriveState();
  }
```

Update `wouldComplete()`'s JSDoc (append one sentence: "Also reports true for a dart that would eliminate the active seat under HARD/EXTREME — the match ends the instant that happens, regardless of any other seat's own status.") and body:

```ts
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;
    const seatBefore = activeSeatState(before);
    if (seatBefore.status !== "IN_PROGRESS") return false;
    if (seatBefore.dartsThisVisit < 2) return false;

    const after = applySinglesTrainingDart(
      this.config,
      seatBefore,
      observation,
    );
    if (after.status === "LOST") return true;
    if (after.status !== "COMPLETE") return false;

    return otherSeatsComplete(
      before.seats,
      seatBefore.participantRef,
      (seat) => seat.status === "COMPLETE",
    );
  }
```

Finally, in the test file's `describe("SinglesTrainingEngine — 1v1 completion guard", ...)` docblock (the large "Self-review regression (Task 17)" comment above it), replace the last sentence — "Singles Training composes no `raceWinner` — score-compare only — so that gap does not apply here." — with: "Singles Training composes no `raceWinner` — score-compare only — so that gap does not apply to the no-fail path exercised here. HARD/EXTREME's elimination reintroduces exactly that gap once a seat fails, which is why `record()`/`wouldComplete()` now also carry Bob's-27-style top-level match-status guards (see `SinglesTrainingEngine — HARD/EXTREME 1v1 elimination`)."

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: PASS, all tests green (existing + new).

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `cd app && npx vitest run`
Expected: PASS. In particular confirm `tests/modules/game/bobs27.engine.module.test.ts` and any test importing `match-outcome.module.ts` are untouched and green (this task made no edits there).

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/singles-training.engine.module.ts app/tests/modules/game/singles-training.engine.module.test.ts
git commit -m "Add HARD/EXTREME mandatory-hit elimination to Singles Training engine"
```

---

### Task 3: Setup UI — difficulty picker

**Files:**
- Modify: `app/src/lib/game/types.ts` (`SinglesTrainingSetupContext`, ~line 547-549)
- Modify: `app/src/lib/game/singles-training-setup.data.ts`
- Modify: `app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro`
- Test: `app/tests/lib/game/singles-training-setup.data.test.ts`

**Interfaces:**
- Consumes: `SinglesSnapshot["difficulty"]` (Task 1).
- Produces: `singlesTrainingSetup()` return value gains `difficulty: SinglesSnapshot["difficulty"]` (default `"EASY"`), and its `configOverrides` now always includes `difficulty`. Task 4 does not depend on this task.

- [ ] **Step 1: Write the failing tests**

In `app/tests/lib/game/singles-training-setup.data.test.ts`, inside `describe("start", ...)`:

**1a.** Update the two existing exact-match tests' expected `overrides` to include `difficulty: "EASY"` (the new default):

In "creates a session with the default order mode override and redirects" (~line 168-214), change:

```ts
          overrides: { order_mode: "LOW_TO_HIGH", target_order: ascending },
```

to:

```ts
          overrides: {
            order_mode: "LOW_TO_HIGH",
            target_order: ascending,
            difficulty: "EASY",
          },
```

In "sends the selected order mode and its resolved target order" (~line 216-246), change:

```ts
            overrides: { order_mode: "HIGH_TO_LOW", target_order: descending },
```

to:

```ts
            overrides: {
              order_mode: "HIGH_TO_LOW",
              target_order: descending,
              difficulty: "EASY",
            },
```

**1b.** Add a new test in the same `describe("start", ...)` block:

```ts
    it("sends the selected difficulty override", async () => {
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        difficulty: "HARD",
      });
      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
        ],
      } as any);
      vi.stubGlobal("location", { href: "" });

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            overrides: expect.objectContaining({ difficulty: "HARD" }),
          }),
        }),
      );
    });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/singles-training-setup.data.test.ts`
Expected: FAIL — the two updated exact-match tests fail (actual `overrides` currently lacks `difficulty`), and the new test fails (`difficulty` field doesn't exist on the setup context / has no effect).

- [ ] **Step 3: Implement**

In `app/src/lib/game/types.ts`, replace (~line 547-549):

```ts
export type SinglesTrainingSetupContext = PresetSetupContext & {
  orderMode: TargetOrderMode;
  difficulty: SinglesSnapshot["difficulty"];
};
```

In `app/src/lib/game/singles-training-setup.data.ts`, replace the whole file body:

```ts
import { createPresetSetupController } from "@lib/game/setup-controller";
import { targetOrderFor } from "@lib/game/target-order";
import type { SinglesTrainingSetupContext } from "./types";

export function singlesTrainingSetup() {
  return {
    orderMode: "LOW_TO_HIGH" as SinglesTrainingSetupContext["orderMode"],
    difficulty: "EASY" as SinglesTrainingSetupContext["difficulty"],
    ...createPresetSetupController<SinglesTrainingSetupContext>({
      gameTypeKey: "SINGLES_TRAINING",
      rulesetVersionKey: "SINGLES_V1",
      playHref: "/games/singles-training/play",
      label: "Singles Training",
      configOverrides: (ctx) => ({
        order_mode: ctx.orderMode,
        target_order: targetOrderFor(ctx.orderMode),
        difficulty: ctx.difficulty,
      }),
    }),
  };
}
```

In `app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro`, add a `difficultyOpts` array next to `orderModeOpts` and a second `Toggle`:

```astro
const orderModeOpts = [
  { value: "LOW_TO_HIGH", label: "Low → High" },
  { value: "HIGH_TO_LOW", label: "High → Low" },
  { value: "RANDOM", label: "Random" },
];

const difficultyOpts = [
  { value: "EASY", label: "Easy" },
  { value: "HARD", label: "Hard" },
  { value: "EXTREME", label: "Extreme" },
];
```

and update the info copy and body:

```astro
const infoSection = {
  title: "Singles training rules",
  description:
    "One target at a time, three darts each: 1 through 20 and bull, in the order you choose below. Single = 1 point, double = 2, treble = 3 — only on the current target. On the bull, outer = 1 point, inner = 2, no treble. Misses score 0. The session ends once every target has been visited once. Hard requires at least 1 dart on target each visit, Extreme at least 2 — miss the requirement and it's game over.",
};
```

```astro
<SetupShell title="Singles training">
  <UserSection allowGuests />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />
  <SettingSectionShell>
    <Toggle
      orientation="horizontal"
      options={orderModeOpts}
      x-model="orderMode"
      class="w-full"
    />
  </SettingSectionShell>
  <SettingSectionShell>
    <Toggle
      orientation="horizontal"
      options={difficultyOpts}
      x-model="difficulty"
      class="w-full"
    />
  </SettingSectionShell>
</SetupShell>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/singles-training-setup.data.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/singles-training-setup.data.ts app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro app/tests/lib/game/singles-training-setup.data.test.ts
git commit -m "Add difficulty picker to Singles Training setup"
```

---

### Task 4: Play/Results UI — WON/LOST outcomes

**Files:**
- Modify: `app/src/lib/game/singles-training-play.data.ts`
- Modify: `app/src/components/layout/games/result-modals/SinglesTrainingResults.astro`
- Test: `app/tests/lib/game/singles-training-play.data.test.ts`

**Interfaces:**
- Consumes: `SinglesTrainingState`/`SinglesTrainingSeatState` (Task 2) — `status` now includes `"LOST"` (state) and `"IN_PROGRESS" | "COMPLETE" | "TIE" | "LOST"` (match). `SinglesSnapshot["difficulty"]` (Task 1) for the `playAgain` wire.
- Produces: `resultsSnapshot.status` widens to `"COMPLETE" | "TIE" | "WON" | "LOST"`. `SinglesTrainingResults.astro` reads this new union.

- [ ] **Step 1: Write the failing tests**

In `app/tests/lib/game/singles-training-play.data.test.ts`:

**1a.** Update the existing `playAgain` exact-match test's expected `overrides` (~line 802-812, in "starts a fresh session with the same order mode's resolved target order"):

```ts
      config: {
        source: "template",
        templateRef: "tpl-1",
        overrides: {
          order_mode: "LOW_TO_HIGH",
          target_order: ascending,
          difficulty: "EASY",
        },
      },
```

**1b.** Add a new `describe` block (after `describe("completion — 1v1", ...)`, ~after line 726):

```ts
describe("completion — HARD/EXTREME elimination", () => {
  it("solo: failing a visit under HARD finishes the session with status LOST", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      configSnapshot: { ...defaultConfig(), difficulty: "HARD" },
    });
    await play.init.call(play);

    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");

    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot?.status).toBe("LOST");
    expect(play.resultsSnapshot?.winningSideKey).toBeNull();
  });

  it("1v1: the surviving seat's owner sees status WON when the opponent fails under HARD", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 6 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      configSnapshot: {
        ...defaultConfig(),
        difficulty: "HARD",
        seats: [
          {
            participantRef: "participant-1",
            displayName: "Levi",
            sideKey: "A",
            participantTypeKey: "PLAYER" as const,
          },
          {
            participantRef: "participant-2",
            displayName: "Opponent",
            sideKey: "B",
            participantTypeKey: "GUEST" as const,
          },
        ],
      },
    });
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE"); // owner (A) hits, survives
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "MISS"); // opponent (B) fails
    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");

    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot?.status).toBe("WON");
    expect(play.resultsSnapshot?.winningSideKey).toBe("A");
  });

  it("1v1: the failing seat's own owner sees status LOST", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 3 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      configSnapshot: {
        ...defaultConfig(),
        difficulty: "HARD",
        seats: [
          {
            participantRef: "participant-1",
            displayName: "Levi",
            sideKey: "A",
            participantTypeKey: "PLAYER" as const,
          },
          {
            participantRef: "participant-2",
            displayName: "Opponent",
            sideKey: "B",
            participantTypeKey: "GUEST" as const,
          },
        ],
      },
    });
    await play.init.call(play);

    await play.recordTap.call(play, "MISS"); // owner (A) fails first
    await play.recordTap.call(play, "MISS");
    await play.recordTap.call(play, "MISS");

    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot?.status).toBe("LOST");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: FAIL — the updated `playAgain` test fails (actual `overrides` lacks `difficulty`), and the three new tests fail (`resultsSnapshot.status` is only ever `"COMPLETE"`/`"TIE"` today).

- [ ] **Step 3: Implement**

In `app/src/lib/game/singles-training-play.data.ts`:

Add `SinglesTrainingSeatState` to the existing `@modules/types` import list (alongside `SinglesTrainingState`).

Add a new module-level function above `resumeEngine`:

```ts
/**
 * The owning player's own outcome label for the results screen. `LOST`
 * covers both a solo HARD/EXTREME failure and the failing seat's own owner
 * in 1v1; `WON` is the surviving seat's owner when elimination (not
 * score-compare) decided the match. Both are new terminal outcomes
 * alongside the existing score-compare-only `COMPLETE`/`TIE`.
 */
function resultStatusFor(
  finalState: SinglesTrainingState,
  ownerSeat: SinglesTrainingSeatState,
): "COMPLETE" | "TIE" | "WON" | "LOST" {
  if (ownerSeat.status === "LOST") return "LOST";
  if (finalState.seats.some((seat) => seat.status === "LOST")) return "WON";
  return finalState.status === "TIE" ? "TIE" : "COMPLETE";
}
```

Update the `resultsSnapshot` field's inline type (in the `singlesTrainingPlay()` return object) — change:

```ts
      status: "COMPLETE" | "TIE";
```

to:

```ts
      status: "COMPLETE" | "TIE" | "WON" | "LOST";
```

Update `uploadAndCompleteSession`'s `status` line — change:

```ts
          status: finalState.status === "TIE" ? "TIE" : "COMPLETE",
```

to:

```ts
          status: resultStatusFor(finalState, ownerSeat),
```

Update `playAgain`'s `wire` object — change:

```ts
            wire: {
              order_mode: priorConfig.orderMode,
              target_order: targetOrder,
            },
```

to:

```ts
            wire: {
              order_mode: priorConfig.orderMode,
              target_order: targetOrder,
              difficulty: priorConfig.difficulty,
            },
```

In `app/src/components/layout/games/result-modals/SinglesTrainingResults.astro`, replace the title `x-text` expression:

```astro
    x-text="
      resultsSnapshot?.status === 'LOST'
        ? (($store.game.seats?.length ?? 1) < 2
            ? 'Game over — missed the target'
            : 'Game over — you missed the target')
        : resultsSnapshot?.status === 'WON'
          ? ($store.game.seats.find((s) => s.sideKey !== resultsSnapshot.winningSideKey)?.displayName + ' missed the target — you win!')
          : resultsSnapshot?.status === 'TIE'
            ? 'Tie — same points!'
            : !resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
              ? 'Session complete'
              : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' wins — highest points!')
    "
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `cd app && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/singles-training-play.data.ts app/src/components/layout/games/result-modals/SinglesTrainingResults.astro app/tests/lib/game/singles-training-play.data.test.ts
git commit -m "Surface HARD/EXTREME elimination outcomes in Singles Training play/results"
```

---

### Task 5: Ruleset doc — Hard/Extreme move to v1

**Files:**
- Modify: `docs/game-rules/rulesets/singles-training.md`

**Interfaces:** None (documentation only; `docs/game-rules/` is non-canonical raw source material, not scanned by `scripts/check-context-map.sh`).

- [ ] **Step 1: Update the Features table**

Change:

```
| Hard: at least 1 dart must hit the target     | TBD     |
| Extreme: at least 2 darts must hit            | TBD     |
```

to:

```
| Hard: at least 1 dart must hit the target     | v1      |
| Extreme: at least 2 darts must hit            | v1      |
```

(`Professional: all 3 darts must hit | TBD` stays unchanged.)

- [ ] **Step 2: Update the Config & presets table**

Change the `Difficulty` row from:

```
| Difficulty | Easy — score hits; misses just score 0 for that dart            | Shown, locked         |
```

to:

```
| Difficulty | Easy (default), Hard, or Extreme — player's choice; see Bust below | Editable |
```

- [ ] **Step 3: Replace the "Bust" section**

Under "How to play (V1)", change:

```
### Bust

N/A.
```

to:

```
### Bust

Hard/Extreme only: at a visit's 3rd dart, if fewer than the required number of darts landed on the current section (Hard: 1, Extreme: 2), the run ends immediately. Solo: the session ends as a loss. 1v1: the match ends immediately and the other player wins, regardless of either player's own progress or points. Easy has no bust condition.
```

- [ ] **Step 4: Trim the "Later versions (V2+) → Variants" list**

Change:

```
### Variants

- **Hard:** at least 1 dart must hit the target each visit
- **Extreme:** at least 2 darts must hit
- **Professional:** all 3 darts must hit
```

to:

```
### Variants

- **Professional:** all 3 darts must hit
```

- [ ] **Step 5: Commit**

```bash
git add docs/game-rules/rulesets/singles-training.md
git commit -m "Move Singles Training Hard/Extreme from V2+ to v1 in the ruleset doc"
```

---

### Task 6: Context maintenance and full validation

**Files:** None new — this task runs project-mandated procedures and fixes whatever they flag.

**Interfaces:** None.

- [ ] **Step 1: Format**

Run: `cd app && npm run format`
Expected: exits zero; if it rewrites any file, `git add` and fold the diff into this task's commit.

- [ ] **Step 2: Full validation**

Invoke the `validate-app` skill (or run its command directly):

Run: `cd app && npm run validate:app`
Expected: every step exits zero; the type-check step reports 0 errors, 0 warnings, 0 hints.

If anything fails, fix it and re-run this step before continuing — do not proceed to Step 3 on a red `validate:app`.

- [ ] **Step 3: Structural gates**

Invoke the `run-all-gates` skill to dispatch the relevant `check-*.sh` scripts for the changed areas (`app/`, `docs/`). Expected: every dispatched script passes, including `scripts/check-game-engines.sh`, `scripts/check-test-coverage.sh`, and `scripts/check-doc-links.sh`.

- [ ] **Step 4: Context maintenance**

Invoke the `context-maintenance` skill. This covers (per root `CLAUDE.md`):
- Confirming no `CLAUDE.md` file needs updating (this feature adds no new file-location conventions, aliases, or architecture patterns beyond what's already documented).
- Confirming `docs/architecture/00-Context-Map.md` needs no new pack (this task fits the existing "Frontend gameplay / session features" and "New game engine" packs).
- Adding a decision entry to `decisions/game-engine.md` if the skill's checklist determines this elimination pattern (reused, not invented) warrants one — follow the skill's own judgment call here rather than pre-deciding it in this plan.
- Confirming `FINDINGS.md` has no open item this task should have picked up instead of doing inline (it shouldn't — this plan's scope is exactly what the design spec asked for).

- [ ] **Step 5: Final commit and push**

```bash
git add -A
git status
```

Review the status output — commit only files this plan actually touched (plus anything the skills in Steps 3-4 modified, e.g. `decisions/game-engine.md`). Then:

```bash
git commit -m "Context maintenance for Singles Training Hard/Extreme mode"
git push -u origin claude/singles-training-hard-extreme-7cl0ea
```

(Skip the commit if `git status` shows nothing new to add — not every run of the maintenance skills produces a diff.)

---

## Self-Review

**Spec coverage:**
- §2 (config/data model) → Task 1.
- §3 (engine) → Task 2, including the `record()`/`wouldComplete()` top-level guard correction the spec didn't call out explicitly but the elimination model requires (documented as a deviation/addition, not a gap).
- §4 (setup UI) → Task 3.
- §5 (play/results UI) → Task 4, including `playAgain` carrying `difficulty` forward (spec §5 implied this via "the exact conditional... may simplify" note; this plan nails down the exact, simpler `resultStatusFor` implementation).
- §6 (docs) → Task 5.
- §7 (testing plan) → distributed into each task's Step 1/tests; the `match-outcome.module.ts` regression check (spec's "existing tests for Around the Clock / Doubles Training callers stay green") is satisfied by construction (Task 2 makes no edits to that file) and reconfirmed by Task 2 Step 5's full-suite run.

**Placeholder scan:** none — every step has literal code, exact file paths, and exact commands.

**Type consistency:** `SinglesSnapshot["difficulty"]` (Task 1) is the type every later task's `difficulty`-typed field/parameter uses verbatim (Task 2's `requiredHitsFor`, Task 3's `SinglesTrainingSetupContext.difficulty`). `SinglesTrainingSeatState`/`SinglesTrainingState` (Task 2) are the exact names and status unions Task 4's `resultStatusFor` consumes. `hitsThisVisit` is spelled identically everywhere it appears (type, engine, five updated test literals, six new test assertions).
