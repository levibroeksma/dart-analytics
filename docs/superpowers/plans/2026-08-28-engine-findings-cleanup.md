# Engine Findings Cleanup (F39/F40/F41) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close findings F39, F40, F41 by extracting 3 mechanical duplications (a type guard, a stage-fact constant, a log-slice helper) into `app/src/modules/game/turn-log.module.ts` and wiring the affected engines to them. No behavior change.

**Architecture:** Each finding gets one export added to `turn-log.module.ts` with its own unit test, then a second task wires the affected engine(s) to it, replacing their private duplicate. Docs/ledger/findings-log cleanup happens once at the end via `context-maintenance`.

**Tech Stack:** TypeScript, Vitest, existing `GameEngine` module structure — no new dependencies.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-28-engine-findings-cleanup-design.md`.
- No behavior change anywhere in this plan — every step is a pure extraction.
- `scripts/check-test-coverage.sh` (D224): every runtime `.ts` file touched must have a covering test file also edited in the same commit.
- `app/CLAUDE.md`: no `//`/`/* */` comments inside function bodies in `app/src/**/*.ts`; JSDoc above declarations only.
- Root `CLAUDE.md`: dedicated branch (already checked out: `claude/engine-module-findings-cleanup`), commit only when asked (user already asked), minimal diffs.

---

### Task 1: `isDartObservationInput` in `turn-log.module.ts`

**Files:**
- Modify: `app/src/modules/game/turn-log.module.ts`
- Test: `app/tests/modules/game/turn-log.module.test.ts`

**Interfaces:**
- Produces: `isDartObservationInput<T>(input: T | DartObservation): input is DartObservation` — exported from `turn-log.module.ts`.

- [ ] **Step 1: Write the failing test**

Append to `app/tests/modules/game/turn-log.module.test.ts` (add `isDartObservationInput` to the existing `import { ... } from "@modules/game/turn-log.module";` block, alphabetically between `doubleTargetIntent` and `openOrCreateTurn`):

```typescript
describe("isDartObservationInput", () => {
  type KeypadInput = { scoreAttempted: number };

  it("is true for a DartObservation-shaped input", () => {
    const input: KeypadInput | DartObservation = {
      hitTargetNumber: 20,
      hitZoneKey: "SINGLE",
      locationX: 0,
      locationY: 0,
    };
    expect(isDartObservationInput(input)).toBe(true);
  });

  it("is false for a keypad-shaped input", () => {
    const input: KeypadInput | DartObservation = { scoreAttempted: 60 };
    expect(isDartObservationInput(input)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/turn-log.module.test.ts -t isDartObservationInput`
Expected: FAIL — `isDartObservationInput is not exported`

- [ ] **Step 3: Write minimal implementation**

In `app/src/modules/game/turn-log.module.ts`, add after `openVisit` (after the closing brace of that function, before `resolveObservation`):

```typescript
/**
 * Discriminates any ruleset's dual-shaped input by structure, never by
 * session mode: only `DartObservation` carries `hitZoneKey`, so its presence
 * is a sound type guard no matter which mode the session was created in.
 * Shared by every engine whose input is `XxxVisitInput | DartObservation`.
 */
export function isDartObservationInput<T>(
  input: T | DartObservation,
): input is DartObservation {
  return typeof input === "object" && input !== null && "hitZoneKey" in input;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/turn-log.module.test.ts -t isDartObservationInput`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/turn-log.module.ts app/tests/modules/game/turn-log.module.test.ts
git commit -m "feat: add shared isDartObservationInput guard (F39)"
```

---

### Task 2: Wire F39 into 501, 121, TUOD

**Files:**
- Modify: `app/src/modules/game/five-oh-one.engine.module.ts`
- Modify: `app/src/modules/game/one-twenty-one.engine.module.ts`
- Modify: `app/src/modules/game/tuod.engine.module.ts`
- Test: `app/tests/modules/game/five-oh-one.engine.module.test.ts`
- Test: `app/tests/modules/game/one-twenty-one.engine.module.test.ts`
- Test: `app/tests/modules/game/tuod.engine.module.test.ts`

**Interfaces:**
- Consumes: `isDartObservationInput` from Task 1.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/modules/game/five-oh-one.engine.module.test.ts` (at the end of the file):

```typescript
describe("FiveOhOneEngine — isDartObservationInput wiring (F39)", () => {
  const dartAt = (
    x: number,
    y: number,
    hitZoneKey: DartZoneKey,
    hitTargetNumber: number | null,
  ) => ({ hitTargetNumber, hitZoneKey, locationX: x, locationY: y });

  it("still routes a board dart to the dart path", () => {
    const engine = fiveOhOneEngineFactory.create(
      config(),
      undefined,
    ) as FiveOhOneEngine;

    engine.record(dartAt(0, -102, "TREBLE", 20));
    expect(engine.state().seats[0].remainingScore).toBe(441);
  });

  it("still routes a keypad total to the visit path", () => {
    const engine = fiveOhOneEngineFactory.create(
      config(),
      undefined,
    ) as FiveOhOneEngine;

    const state = engine.record({ scoreAttempted: 60 });
    expect(state.seats[0].remainingScore).toBe(441);
  });
});
```

Append to `app/tests/modules/game/one-twenty-one.engine.module.test.ts` (at the end of the file):

```typescript
describe("OneTwentyOneEngine — isDartObservationInput wiring (F39)", () => {
  const dartAt = (
    x: number,
    y: number,
    hitZoneKey: DartZoneKey,
    hitTargetNumber: number | null,
  ) => ({ hitTargetNumber, hitZoneKey, locationX: x, locationY: y });

  it("still routes a board dart to the dart path", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
      undefined,
    ) as OneTwentyOneEngine;

    engine.record(dartAt(0, -102, "TREBLE", 20));
    expect(engine.state().seats[0].remainingInAttempt).toBe(61);
  });

  it("still routes a keypad total to the visit path", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
      undefined,
    ) as OneTwentyOneEngine;

    const state = engine.record({ scoreAttempted: 45 });
    expect(state.seats[0].remainingInAttempt).toBe(76);
  });
});
```

Append to `app/tests/modules/game/tuod.engine.module.test.ts` (at the end of the file):

```typescript
describe("TuodEngine — isDartObservationInput wiring (F39)", () => {
  it("still routes a board dart to the dart path", () => {
    const engine = tuodEngineFactory.create(boardConfig());
    const state = engine.record(DOUBLE_20);

    expect(state.seats[0].currentTarget).toBe(50);
    expect(state.seats[0].successes).toBe(1);
  });

  it("still routes a keypad attempt to the attempt path", () => {
    const engine = tuodEngineFactory.create(config());
    const state = engine.record(CHECKOUT);

    expect(state.seats[0].currentTarget).toBe(51);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass against today's code**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts tests/modules/game/one-twenty-one.engine.module.test.ts tests/modules/game/tuod.engine.module.test.ts -t "F39"`
Expected: PASS already (behavior unchanged) — this step confirms the fixtures are correct against today's code before the rewire, so a later regression is caught by the rewire, not the fixture. If a number doesn't match, correct the assertion to what the current engine actually returns before proceeding.

- [ ] **Step 3: Wire the 3 engines to the shared guard**

In `app/src/modules/game/five-oh-one.engine.module.ts`:
- Add `isDartObservationInput` to the `import { ... } from "./turn-log.module";` block (alphabetically).
- Delete the local `isDartObservation` function (its JSDoc block and body — the block starting `/**\n * Discriminates \`FiveOhOneInput\` by shape...` through its closing `}`).
- Replace both call sites `isDartObservation(input)` with `isDartObservationInput(input)`.

In `app/src/modules/game/one-twenty-one.engine.module.ts`:
- Add `isDartObservationInput` to the `import { ... } from "./turn-log.module";` block (alphabetically).
- Delete the local `isDartObservation` function (its JSDoc and body).
- Replace both call sites `isDartObservation(input)` with `isDartObservationInput(input)`.

In `app/src/modules/game/tuod.engine.module.ts`:
- Add `isDartObservationInput` to the `import { ... } from "./turn-log.module";` block (alphabetically).
- Delete the local `isDartObservation` function (its JSDoc and body).
- Replace both call sites `isDartObservation(input)` with `isDartObservationInput(input)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts tests/modules/game/one-twenty-one.engine.module.test.ts tests/modules/game/tuod.engine.module.test.ts`
Expected: PASS, full files, no regressions

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/five-oh-one.engine.module.ts app/src/modules/game/one-twenty-one.engine.module.ts app/src/modules/game/tuod.engine.module.ts app/tests/modules/game/five-oh-one.engine.module.test.ts app/tests/modules/game/one-twenty-one.engine.module.test.ts app/tests/modules/game/tuod.engine.module.test.ts
git commit -m "refactor: wire 501/121/TUOD onto shared isDartObservationInput (F39)"
```

---

### Task 3: `exerciseBlockStage()` in `turn-log.module.ts`

**Files:**
- Modify: `app/src/modules/game/turn-log.module.ts`
- Test: `app/tests/modules/game/turn-log.module.test.ts`

**Interfaces:**
- Produces: `exerciseBlockStage(): StageFact` — exported from `turn-log.module.ts`.

- [ ] **Step 1: Write the failing test**

Append to `app/tests/modules/game/turn-log.module.test.ts` (add `exerciseBlockStage` to the existing import block, alphabetically after `doubleTargetIntent`):

```typescript
describe("exerciseBlockStage", () => {
  it("builds the single EXERCISE_BLOCK stage every one-stage engine opens", () => {
    expect(exerciseBlockStage()).toEqual<StageFact>({
      clientKey: "block-1",
      stageTypeKey: "EXERCISE_BLOCK",
      parentClientKey: null,
      sequence: 1,
    });
  });

  it("returns a fresh object each call", () => {
    expect(exerciseBlockStage()).not.toBe(exerciseBlockStage());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/turn-log.module.test.ts -t exerciseBlockStage`
Expected: FAIL — `exerciseBlockStage is not exported`

- [ ] **Step 3: Write minimal implementation**

In `app/src/modules/game/turn-log.module.ts`, add after `doubleTargetIntent` (after its closing brace, before `appendObservedDart`):

```typescript
/**
 * The single stage every one-`EXERCISE_BLOCK`-stage engine opens: Around the
 * Clock, Bob's 27, Doubles/Singles Training, Score Training, Shanghai. A
 * ruleset with per-sequence stages (501's legs, 121's rounds) builds its own
 * with a real `sequence`, so this always returns `sequence: 1`.
 */
export function exerciseBlockStage(): StageFact {
  return {
    clientKey: "block-1",
    stageTypeKey: "EXERCISE_BLOCK",
    parentClientKey: null,
    sequence: 1,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/turn-log.module.test.ts -t exerciseBlockStage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/turn-log.module.ts app/tests/modules/game/turn-log.module.test.ts
git commit -m "feat: add shared exerciseBlockStage() builder (F40)"
```

---

### Task 4: Wire F40 into the 6 single-block engines

**Files:**
- Modify: `app/src/modules/game/around-the-clock.engine.module.ts`
- Modify: `app/src/modules/game/bobs27.engine.module.ts`
- Modify: `app/src/modules/game/doubles-training.engine.module.ts`
- Modify: `app/src/modules/game/score-training.engine.module.ts`
- Modify: `app/src/modules/game/shanghai.engine.module.ts`
- Modify: `app/src/modules/game/singles-training.engine.module.ts`
- Test: `app/tests/modules/game/around-the-clock.engine.module.test.ts`
- Test: `app/tests/modules/game/bobs27.engine.module.test.ts`
- Test: `app/tests/modules/game/doubles-training.engine.module.test.ts`
- Test: `app/tests/modules/game/score-training.engine.module.test.ts`
- Test: `app/tests/modules/game/shanghai.engine.module.test.ts`
- Test: `app/tests/modules/game/singles-training.engine.module.test.ts`

**Interfaces:**
- Consumes: `exerciseBlockStage` from Task 3.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/modules/game/around-the-clock.engine.module.test.ts`:

```typescript
describe("AroundTheClockEngine — exerciseBlockStage wiring (F40)", () => {
  it("still opens the log under the EXERCISE_BLOCK stage", () => {
    const engine = aroundTheClockEngineFactory.create(config);
    expect(engine.facts().stages).toEqual([
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
      },
    ]);
  });
});
```

Append to `app/tests/modules/game/bobs27.engine.module.test.ts`:

```typescript
describe("Bobs27Engine — exerciseBlockStage wiring (F40)", () => {
  it("still opens the log under the EXERCISE_BLOCK stage", () => {
    const engine = bobs27EngineFactory.create(config);
    expect(engine.facts().stages).toEqual([
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
      },
    ]);
  });
});
```

Append to `app/tests/modules/game/doubles-training.engine.module.test.ts`:

```typescript
describe("DoublesTrainingEngine — exerciseBlockStage wiring (F40)", () => {
  it("still opens the log under the EXERCISE_BLOCK stage", () => {
    const engine = doublesTrainingEngineFactory.create(config);
    expect(engine.facts().stages).toEqual([
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
      },
    ]);
  });
});
```

Append to `app/tests/modules/game/score-training.engine.module.test.ts`:

```typescript
describe("ScoreTrainingEngine — exerciseBlockStage wiring (F40)", () => {
  it("still opens the log under the EXERCISE_BLOCK stage", () => {
    const engine = scoreTrainingEngineFactory.create(ROUNDS_10);
    expect(engine.facts().stages).toEqual([
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
      },
    ]);
  });
});
```

Append to `app/tests/modules/game/shanghai.engine.module.test.ts`:

```typescript
describe("ShanghaiEngine — exerciseBlockStage wiring (F40)", () => {
  it("still opens the log under the EXERCISE_BLOCK stage", () => {
    const engine = shanghaiEngineFactory.create(config);
    expect(engine.facts().stages).toEqual([
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
      },
    ]);
  });
});
```

Append to `app/tests/modules/game/singles-training.engine.module.test.ts`:

```typescript
describe("SinglesTrainingEngine — exerciseBlockStage wiring (F40)", () => {
  it("still opens the log under the EXERCISE_BLOCK stage", () => {
    const engine = singlesTrainingEngineFactory.create(config);
    expect(engine.facts().stages).toEqual([
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
      },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass against today's code**

Run: `cd app && npx vitest run tests/modules/game/around-the-clock.engine.module.test.ts tests/modules/game/bobs27.engine.module.test.ts tests/modules/game/doubles-training.engine.module.test.ts tests/modules/game/score-training.engine.module.test.ts tests/modules/game/shanghai.engine.module.test.ts tests/modules/game/singles-training.engine.module.test.ts -t "F40"`
Expected: PASS already (behavior unchanged) — confirms the fixtures before the rewire.

- [ ] **Step 3: Wire the 6 engines to the shared builder**

In each of the 6 files, add `exerciseBlockStage` to its `import { ... } from "./turn-log.module";` block (alphabetically), then replace:

```typescript
const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};
```

with:

```typescript
const STAGE = exerciseBlockStage();
```

Every other line in each file (`{ ...STAGE }`, `STAGE.clientKey`) stays exactly as it is — `STAGE` is still a module-level constant naming one object for that file's whole lifetime, just built by the shared function instead of a literal. If a file's `StageFact` type import becomes unused after this change (only `score-training.engine.module.ts`, `around-the-clock.engine.module.ts`, etc. use `StageFact` elsewhere too — check each file's other `StageFact` usages before removing the import; do not remove it if still referenced elsewhere in the file).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/around-the-clock.engine.module.test.ts tests/modules/game/bobs27.engine.module.test.ts tests/modules/game/doubles-training.engine.module.test.ts tests/modules/game/score-training.engine.module.test.ts tests/modules/game/shanghai.engine.module.test.ts tests/modules/game/singles-training.engine.module.test.ts`
Expected: PASS, full files, no regressions

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/around-the-clock.engine.module.ts app/src/modules/game/bobs27.engine.module.ts app/src/modules/game/doubles-training.engine.module.ts app/src/modules/game/score-training.engine.module.ts app/src/modules/game/shanghai.engine.module.ts app/src/modules/game/singles-training.engine.module.ts app/tests/modules/game/around-the-clock.engine.module.test.ts app/tests/modules/game/bobs27.engine.module.test.ts app/tests/modules/game/doubles-training.engine.module.test.ts app/tests/modules/game/score-training.engine.module.test.ts app/tests/modules/game/shanghai.engine.module.test.ts app/tests/modules/game/singles-training.engine.module.test.ts
git commit -m "refactor: wire 6 single-block engines onto shared exerciseBlockStage() (F40)"
```

---

### Task 5: `turnsBeforeVisit` in `turn-log.module.ts`

**Files:**
- Modify: `app/src/modules/game/turn-log.module.ts`
- Test: `app/tests/modules/game/turn-log.module.test.ts`

**Interfaces:**
- Produces: `turnsBeforeVisit(turns: readonly TurnFact[], visit: TurnFact): TurnFact[]` — exported from `turn-log.module.ts`.

- [ ] **Step 1: Write the failing test**

Append to `app/tests/modules/game/turn-log.module.test.ts` (add `turnsBeforeVisit` to the existing import block, alphabetically after `sumDartScores`):

```typescript
describe("turnsBeforeVisit", () => {
  it("returns every turn strictly before the visit", () => {
    const first = turn({ clientKey: "t1", sequence: 1 });
    const second = turn({ clientKey: "t2", sequence: 2 });
    const third = turn({ clientKey: "t3", sequence: 3 });
    const turns = [first, second, third];

    expect(turnsBeforeVisit(turns, third)).toEqual([first, second]);
  });

  it("returns an empty array for the first visit", () => {
    const first = turn({ clientKey: "t1", sequence: 1 });
    expect(turnsBeforeVisit([first], first)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/turn-log.module.test.ts -t turnsBeforeVisit`
Expected: FAIL — `turnsBeforeVisit is not exported`

- [ ] **Step 3: Write minimal implementation**

In `app/src/modules/game/turn-log.module.ts`, add after `sumDartScores` (after its closing brace, before `cloneTurns`):

```typescript
/**
 * Every turn strictly before `visit` in `turns` — for folding the log up to
 * the moment `visit` opened. Safe and exact because an engine only ever has
 * one open turn (the last one), so every earlier turn in `turns` is always
 * already closed. Shared by any engine that resolves "the seat's state
 * immediately before this visit" by slicing and refolding, rather than by a
 * running reduce (`five-oh-one.engine.module.ts`'s `remainingBeforeVisit`
 * uses the latter and does not need this).
 */
export function turnsBeforeVisit(
  turns: readonly TurnFact[],
  visit: TurnFact,
): TurnFact[] {
  return turns.slice(0, turns.indexOf(visit));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/turn-log.module.test.ts -t turnsBeforeVisit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/turn-log.module.ts app/tests/modules/game/turn-log.module.test.ts
git commit -m "feat: add shared turnsBeforeVisit slice helper (F41)"
```

---

### Task 6: Wire F41 into 121 and TUOD

**Files:**
- Modify: `app/src/modules/game/one-twenty-one.engine.module.ts`
- Modify: `app/src/modules/game/tuod.engine.module.ts`
- Test: `app/tests/modules/game/one-twenty-one.engine.module.test.ts`
- Test: `app/tests/modules/game/tuod.engine.module.test.ts`

**Interfaces:**
- Consumes: `turnsBeforeVisit` from Task 5.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/modules/game/one-twenty-one.engine.module.test.ts`:

```typescript
describe("OneTwentyOneEngine — turnsBeforeVisit wiring (F41)", () => {
  const dartAt = (
    x: number,
    y: number,
    hitZoneKey: DartZoneKey,
    hitTargetNumber: number | null,
  ): DartObservation => ({ hitTargetNumber, hitZoneKey, locationX: x, locationY: y });

  it("still resolves a dart-based checkout using the PRIOR (closed) visit's remaining, not the starting target", () => {
    const engine = oneTwentyOneEngineFactory.create(
      config(),
    ) as OneTwentyOneEngine;

    // Turn 1 (keypad): 121 - 41 = 80 remaining, visit closed.
    engine.record({ scoreAttempted: 41, finishedOnDouble: false });
    // Turn 2 (dart-based, 2 darts): settleVisit's `before` must come from
    // turnsBeforeVisit(this.turns, visit) — turn 1 only, not the empty log —
    // so 80 - 40 - 40 = 0 on a double checks out.
    engine.record(dartAt(0, -166, "DOUBLE", 20));
    const state = engine.record(dartAt(0, -166, "DOUBLE", 20));

    expect(state.seats[0]).toEqual({
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 122,
      remainingInAttempt: 122,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    });
  });
});
```

Append to `app/tests/modules/game/tuod.engine.module.test.ts`:

```typescript
describe("TuodEngine — turnsBeforeVisit wiring (F41)", () => {
  it("still resolves a second dart-based attempt using the first attempt's outcome as its target, not the starting target", () => {
    const engine = tuodEngineFactory.create(boardConfig());

    // Attempt 1: checks out at 40, climbs to 50.
    engine.record(DOUBLE_20);
    expect(engine.state().seats[0].currentTarget).toBe(50);

    // Attempt 2: settleVisit's target must come from
    // turnsBeforeVisit(this.turns, visit) — attempt 1's outcome (50), not
    // boardConfig()'s starting target (40) — so a TREBLE_20 (60) overshoots
    // and busts down to 49, not up from a stale 40.
    const state = engine.record(TREBLE_20);
    expect(state.seats[0].currentTarget).toBe(49);
    expect(state.seats[0].failures).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass against today's code**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts tests/modules/game/tuod.engine.module.test.ts -t "F41"`
Expected: PASS already (behavior unchanged) — confirms the fixtures before the rewire. If a number above doesn't match, correct the assertion to what the current engine actually returns before proceeding — the goal is a locked-in snapshot of existing behavior, not a specific number.

- [ ] **Step 3: Wire 121 and TUOD to the shared slice helper**

In `app/src/modules/game/one-twenty-one.engine.module.ts`:
- Add `turnsBeforeVisit` to the `import { ... } from "./turn-log.module";` block (alphabetically).
- Replace `seatBeforeVisit`'s body:

```typescript
  private seatBeforeVisit(visit: TurnFact): OneTwentyOneSeatState {
    return foldOneTwentyOneState(
      { stages: this.stages, turns: turnsBeforeVisit(this.turns, visit) },
      this.config,
    ).seats.find((seat) => seat.participantRef === visit.participantRef)!;
  }
```

(removes the `const index = this.turns.indexOf(visit);` line and the `.slice(0, index)` call, replacing both with `turnsBeforeVisit(this.turns, visit)`.)

In `app/src/modules/game/tuod.engine.module.ts`:
- Add `turnsBeforeVisit` to the `import { ... } from "./turn-log.module";` block (alphabetically).
- Replace `targetBeforeVisit`'s body:

```typescript
  private targetBeforeVisit(visit: TurnFact): number {
    return foldTuodState(
      { stages: [this.stage], turns: turnsBeforeVisit(this.turns, visit) },
      this.config,
      this.timerExpired,
    ).seats.find((seat) => seat.participantRef === visit.participantRef)!
      .currentTarget;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts tests/modules/game/tuod.engine.module.test.ts`
Expected: PASS, full files, no regressions

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/one-twenty-one.engine.module.ts app/src/modules/game/tuod.engine.module.ts app/tests/modules/game/one-twenty-one.engine.module.test.ts app/tests/modules/game/tuod.engine.module.test.ts
git commit -m "refactor: wire 121/TUOD onto shared turnsBeforeVisit (F41)"
```

---

### Task 7: Document the F41 two-technique split in Pattern 18

**Files:**
- Modify: `docs/architecture/04-Architecture-patterns.md`

- [ ] **Step 1: Add the note**

In `docs/architecture/04-Architecture-patterns.md`, find the paragraph documenting `checkout-bust.module.ts`/`resolveCheckoutAttempt` (D240, added after the D232 `turn-log.module.ts`/`seat-state.module.ts` paragraph in Pattern 18). Immediately after that paragraph, add:

```markdown
Resolving "the seat's state immediately before this visit" has two
legitimate techniques, not one duplicated three times: `turnsBeforeVisit`
(`turn-log.module.ts`) slices the log up to the visit and refolds it through
the engine's own `foldXxxState`, for when the caller needs the seat's whole
derived state (121's `seatBeforeVisit`, TUOD's `targetBeforeVisit`); a plain
`.filter().reduce()` over `totalScore` is used instead when only a running
total is needed and a full state fold would be wasted work (501's
`remainingBeforeVisit`). Pick whichever the caller actually needs — do not
force a scalar-only case through a full-state fold, or vice versa (D241).
```

- [ ] **Step 2: Bump the version header**

At the top of `docs/architecture/04-Architecture-patterns.md`, bump the version header (currently `1.8.1`) to `1.8.2` and add today's date to its changelog line, matching the existing format from the `1.8.0` → `1.8.1` bump.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/04-Architecture-patterns.md
git commit -m "docs: document the turnsBeforeVisit / manual-reduce split as intentional (F41, D241)"
```

---

### Task 8: Final check — validate:app + context-maintenance

- [ ] **Step 1: Run full validation**

Follow the `validate-app` skill. Run `cd app && npm run validate:app`. `db:status`/`db:migrate`/`db:introspect` are expected to fail in this sandbox (no `DATABASE_URL` — established environment limitation, not a regression); run the remaining steps individually if the chain stops early: `npx fallow`, `npm test`, `npm run check` (must be 0 errors/0 warnings/0 hints).

- [ ] **Step 2: Run context-maintenance**

Follow the `context-maintenance` skill's full procedure:
- Delete the F39, F40, F41 blocks from `FINDINGS.md`; bump `highest-issued` only if a new finding surfaced during this work (none expected).
- Add a `D241` entry to `decisions/game-engine.md` (Status: Accepted, Date: 2026-08-28) recording: `isDartObservationInput`, `exerciseBlockStage()`, and `turnsBeforeVisit` join `turn-log.module.ts`'s shared exports (closing F39/F40/F41); note the deliberate non-extraction of 501's `remainingBeforeVisit` (documented instead, per Task 7).
- Register this plan and its spec in `docs/architecture/00-Context-Map-History.md`'s registration table and version-history list.
- Update any `~size` claims in `docs/architecture/00-File-Inventory.md` / `00-Context-Map.md` that drift past their gate threshold after the `FINDINGS.md` deletions and `04-Architecture-patterns.md` addition (run `scripts/check-context-budget.sh` to check).
- Run `run-all-gates` skill's full script list for `app/`, `docs/`, `decisions/` changes; all must pass.

- [ ] **Step 3: Commit context-maintenance changes**

```bash
git add FINDINGS.md decisions/game-engine.md docs/architecture/00-Context-Map-History.md docs/architecture/00-File-Inventory.md docs/architecture/00-Context-Map.md
git commit -m "chore: context maintenance for F39/F40/F41 cleanup"
```
