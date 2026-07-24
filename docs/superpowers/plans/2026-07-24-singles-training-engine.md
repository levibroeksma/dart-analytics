# Singles Training Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure-logic Singles Training engine (V1, single player) — target progression, ring-quality scoring, completion detection, and one-dart-back undo — with no UI, persistence, or config/session wiring.

**Architecture:** A pure reducer `applyDart(state, ring)` holds all scoring/progression rules and is unit-tested in isolation. A `SinglesTrainingEngine` class wraps it with the same call-site shape as `Bobs27Engine`/`ScoreTrainingEngine`, adding a history stack for undo. Everything lives in `app/src/modules/game/`, following the existing module-per-game-engine convention.

**Tech Stack:** TypeScript, Vitest (`app/vitest.config.ts`, `@modules` path alias → `app/src/modules`).

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-07-24-singles-training-engine-design.md`.
- Starting points: 0. Order (fixed, V1): NUMBER 1 → NUMBER 20 → BULL (21 visits total, 3 darts each).
- Points per dart on a `NUMBER` target: `SINGLE` → 1, `DOUBLE` → 2, `TREBLE` → 3, `MISS` → 0.
- Points per dart on the `BULL` target: `SINGLE` (outer bull, 25) → 1, `DOUBLE` (inner bull, 50) → 2, `MISS` → 0. `TREBLE` is not physically valid for bull — never sent by a correct caller; the engine treats it as 0 defensively but this is a caller invariant, not a case to design tests around.
- Every dart's points are added **immediately** — no batching, no penalty case (unlike Bob's 27; misses simply add 0).
- There is no loss/death condition in V1 (Easy difficulty). `status` is only ever `"IN_PROGRESS"` or `"COMPLETE"`. Completion happens after the bull visit's 3rd dart.
- `undoLastDart()` reverts exactly one dart at a time, including across visit boundaries and past a completing dart (status reverts to `IN_PROGRESS`).
- No `.ts` file comments inside function/method bodies (`app/CLAUDE.md`); JSDoc above declarations only where the "why" is non-obvious.
- TDD mandatory: tests under `app/tests/modules/game/`, written before implementation, `npm test` run from `app/`.
- Out of scope (do not implement): UI, persistence to `turns`/`darts`, `configuration_templates`/`ruleset_versions` wiring, HIGH_TO_LOW/RANDOM order, HARD/EXTREME/PROFESSIONAL difficulty, multiplayer, session lifecycle. Do not touch `database/seeds/0002_default_templates.sql` — the seed/ruleset inconsistency flagged in the spec §1/§6 is explicitly out of scope for this plan.

---

### Task 1: Types and pure reducer (`applyDart`)

**Files:**
- Modify: `app/src/modules/game/types.ts`
- Create: `app/src/modules/game/singles-training.engine.module.ts`
- Test: `app/tests/modules/game/singles-training.engine.module.test.ts`

**Interfaces:**
- Consumes: nothing (new module).
- Produces (used by Tasks 2-3):
  - `type SinglesTarget = { kind: "NUMBER"; number: number } | { kind: "BULL" }` (`types.ts`)
  - `type DartRing = "SINGLE" | "DOUBLE" | "TREBLE" | "MISS"` (`types.ts`)
  - `type SinglesTrainingState = { targetIndex: number; totalPoints: number; dartsThisVisit: number; status: "IN_PROGRESS" | "COMPLETE" }` (`types.ts`)
  - `const SINGLES_TRAINING_START_POINTS = 0` (`types.ts`)
  - `function applyDart(state: SinglesTrainingState, ring: DartRing): SinglesTrainingState` (`singles-training.engine.module.ts`) — throws if `state.status !== "IN_PROGRESS"`.
  - `function initialSinglesTrainingState(startingPoints: number): SinglesTrainingState` (`singles-training.engine.module.ts`)

- [ ] **Step 1: Add Singles Training types and constants**

Append to `app/src/modules/game/types.ts`:

```ts
export type SinglesTarget = { kind: "NUMBER"; number: number } | { kind: "BULL" };

export type DartRing = "SINGLE" | "DOUBLE" | "TREBLE" | "MISS";

export type SinglesTrainingState = {
  targetIndex: number;
  totalPoints: number;
  dartsThisVisit: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

export const SINGLES_TRAINING_START_POINTS = 0;
```

- [ ] **Step 2: Write the failing tests for `applyDart`**

Create `app/tests/modules/game/singles-training.engine.module.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyDart, initialSinglesTrainingState } from "@modules/game/singles-training.engine.module";
import type { SinglesTrainingState } from "@modules/game/types";

describe("applyDart — ring scoring on a NUMBER target", () => {
  it("scores 1 point for a SINGLE hit and keeps the same target", () => {
    const state = initialSinglesTrainingState(0);
    const next = applyDart(state, "SINGLE");
    expect(next.totalPoints).toBe(1);
    expect(next.targetIndex).toBe(0);
    expect(next.dartsThisVisit).toBe(1);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("scores 2 points for a DOUBLE hit", () => {
    const state = initialSinglesTrainingState(0);
    const next = applyDart(state, "DOUBLE");
    expect(next.totalPoints).toBe(2);
  });

  it("scores 3 points for a TREBLE hit", () => {
    const state = initialSinglesTrainingState(0);
    const next = applyDart(state, "TREBLE");
    expect(next.totalPoints).toBe(3);
  });

  it("scores 0 points for a MISS but still counts the dart", () => {
    const state = initialSinglesTrainingState(0);
    const next = applyDart(state, "MISS");
    expect(next.totalPoints).toBe(0);
    expect(next.dartsThisVisit).toBe(1);
  });

  it("sums a mixed 3-dart visit and advances the target on the 3rd dart", () => {
    let state = initialSinglesTrainingState(0);
    state = applyDart(state, "SINGLE");
    state = applyDart(state, "DOUBLE");
    state = applyDart(state, "TREBLE");
    expect(state.totalPoints).toBe(6);
    expect(state.targetIndex).toBe(1);
    expect(state.dartsThisVisit).toBe(0);
    expect(state.status).toBe("IN_PROGRESS");
  });
});

describe("applyDart — path completion", () => {
  it("completes after a full run of TREBLE on every NUMBER target and DOUBLE on BULL", () => {
    let state = initialSinglesTrainingState(0);
    for (let visit = 0; visit < 20; visit++) {
      state = applyDart(state, "TREBLE");
      state = applyDart(state, "TREBLE");
      state = applyDart(state, "TREBLE");
    }
    state = applyDart(state, "DOUBLE");
    state = applyDart(state, "DOUBLE");
    state = applyDart(state, "DOUBLE");
    expect(state.status).toBe("COMPLETE");
    expect(state.totalPoints).toBe(186);
  });
});

describe("applyDart — BULL target scoring", () => {
  it("scores 1 point for a SINGLE (outer bull) hit", () => {
    const bullState: SinglesTrainingState = {
      targetIndex: 20,
      totalPoints: 0,
      dartsThisVisit: 0,
      status: "IN_PROGRESS",
    };
    const next = applyDart(bullState, "SINGLE");
    expect(next.totalPoints).toBe(1);
  });

  it("scores 2 points for a DOUBLE (inner bull) hit", () => {
    const bullState: SinglesTrainingState = {
      targetIndex: 20,
      totalPoints: 0,
      dartsThisVisit: 0,
      status: "IN_PROGRESS",
    };
    const next = applyDart(bullState, "DOUBLE");
    expect(next.totalPoints).toBe(2);
  });

  it("sets status COMPLETE on the bull visit's 3rd dart, not just advancing", () => {
    const bullState: SinglesTrainingState = {
      targetIndex: 20,
      totalPoints: 10,
      dartsThisVisit: 2,
      status: "IN_PROGRESS",
    };
    const next = applyDart(bullState, "SINGLE");
    expect(next.status).toBe("COMPLETE");
    expect(next.dartsThisVisit).toBe(0);
  });
});

describe("applyDart — terminal state guard", () => {
  it("throws when called on a state that is already COMPLETE", () => {
    const completeState: SinglesTrainingState = {
      targetIndex: 20,
      totalPoints: 186,
      dartsThisVisit: 0,
      status: "COMPLETE",
    };
    expect(() => applyDart(completeState, "SINGLE")).toThrow();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/game/singles-training.engine.module'` (the module doesn't exist yet).

- [ ] **Step 4: Implement `applyDart` and `initialSinglesTrainingState`**

Create `app/src/modules/game/singles-training.engine.module.ts`:

```ts
import type { DartRing, SinglesTarget, SinglesTrainingState } from "./types";

function targetForIndex(targetIndex: number): SinglesTarget {
  return targetIndex < 20 ? { kind: "NUMBER", number: targetIndex + 1 } : { kind: "BULL" };
}

function pointsFor(target: SinglesTarget, ring: DartRing): number {
  if (ring === "MISS") return 0;
  if (target.kind === "NUMBER") {
    return ring === "SINGLE" ? 1 : ring === "DOUBLE" ? 2 : 3;
  }
  return ring === "SINGLE" ? 1 : ring === "DOUBLE" ? 2 : 0;
}

export function initialSinglesTrainingState(startingPoints: number): SinglesTrainingState {
  return { targetIndex: 0, totalPoints: startingPoints, dartsThisVisit: 0, status: "IN_PROGRESS" };
}

export function applyDart(state: SinglesTrainingState, ring: DartRing): SinglesTrainingState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error("Cannot record a dart once the session is complete; undo first to correct it.");
  }

  const target = targetForIndex(state.targetIndex);
  const totalPoints = state.totalPoints + pointsFor(target, ring);
  const dartsThisVisit = state.dartsThisVisit + 1;

  if (dartsThisVisit < 3) {
    return { ...state, totalPoints, dartsThisVisit };
  }

  if (target.kind === "BULL") {
    return { ...state, totalPoints, dartsThisVisit: 0, status: "COMPLETE" };
  }
  return { ...state, totalPoints, dartsThisVisit: 0, targetIndex: state.targetIndex + 1 };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: PASS — all 10 tests green.

- [ ] **Step 6: Commit**

```bash
cd app && git add src/modules/game/types.ts src/modules/game/singles-training.engine.module.ts tests/modules/game/singles-training.engine.module.test.ts
git commit -m "Add Singles Training pure scoring reducer (applyDart)"
```

---

### Task 2: `SinglesTrainingEngine` class (recordDart + state getters)

**Files:**
- Modify: `app/src/modules/game/singles-training.engine.module.ts`
- Modify: `app/tests/modules/game/singles-training.engine.module.test.ts`

**Interfaces:**
- Consumes: `applyDart`, `initialSinglesTrainingState`, `SinglesTrainingState`, `SinglesTarget`, `DartRing`, `SINGLES_TRAINING_START_POINTS` from Task 1.
- Produces (used by Task 3):
  - `class SinglesTrainingEngine` with `constructor(startingPoints?: number)`, `recordDart(ring: DartRing): SinglesTrainingState`, `currentTarget(): SinglesTarget`, `currentPoints(): number`, `isComplete(): boolean`.

- [ ] **Step 1: Write the failing tests for `SinglesTrainingEngine`**

Append to `app/tests/modules/game/singles-training.engine.module.test.ts`:

```ts
import { SinglesTrainingEngine } from "@modules/game/singles-training.engine.module";

describe("SinglesTrainingEngine", () => {
  it("starts at 0 points on target NUMBER 1, not complete", () => {
    const engine = new SinglesTrainingEngine();
    expect(engine.currentPoints()).toBe(0);
    expect(engine.currentTarget()).toEqual({ kind: "NUMBER", number: 1 });
    expect(engine.isComplete()).toBe(false);
  });

  it("delegates recordDart to the reducer and exposes the updated state via getters", () => {
    const engine = new SinglesTrainingEngine();
    engine.recordDart("TREBLE");
    expect(engine.currentPoints()).toBe(3);
    expect(engine.currentTarget()).toEqual({ kind: "NUMBER", number: 1 });
    engine.recordDart("TREBLE");
    engine.recordDart("TREBLE");
    expect(engine.currentPoints()).toBe(9);
    expect(engine.currentTarget()).toEqual({ kind: "NUMBER", number: 2 });
  });

  it("reports isComplete once the full path is finished", () => {
    const engine = new SinglesTrainingEngine();
    for (let visit = 0; visit < 20; visit++) {
      engine.recordDart("TREBLE");
      engine.recordDart("TREBLE");
      engine.recordDart("TREBLE");
    }
    engine.recordDart("DOUBLE");
    engine.recordDart("DOUBLE");
    engine.recordDart("DOUBLE");
    expect(engine.isComplete()).toBe(true);
    expect(engine.currentPoints()).toBe(186);
  });

  it("accepts a custom starting points value", () => {
    const engine = new SinglesTrainingEngine(50);
    expect(engine.currentPoints()).toBe(50);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: FAIL — `SinglesTrainingEngine` is not exported yet.

- [ ] **Step 3: Implement `SinglesTrainingEngine`**

Add to `app/src/modules/game/singles-training.engine.module.ts` (after `applyDart`), and change the top import line from:

```ts
import type { DartRing, SinglesTarget, SinglesTrainingState } from "./types";
```

to:

```ts
import type { DartRing, SinglesTarget, SinglesTrainingState } from "./types";
import { SINGLES_TRAINING_START_POINTS } from "./types";
```

Then add:

```ts
export class SinglesTrainingEngine {
  private state: SinglesTrainingState;

  constructor(startingPoints: number = SINGLES_TRAINING_START_POINTS) {
    this.state = initialSinglesTrainingState(startingPoints);
  }

  recordDart(ring: DartRing): SinglesTrainingState {
    this.state = applyDart(this.state, ring);
    return this.state;
  }

  currentTarget(): SinglesTarget {
    return targetForIndex(this.state.targetIndex);
  }

  currentPoints(): number {
    return this.state.totalPoints;
  }

  isComplete(): boolean {
    return this.state.status === "COMPLETE";
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: PASS — all tests green (Task 1's 10 + Task 2's 4).

- [ ] **Step 5: Commit**

```bash
cd app && git add src/modules/game/singles-training.engine.module.ts tests/modules/game/singles-training.engine.module.test.ts
git commit -m "Add SinglesTrainingEngine class wrapping applyDart"
```

---

### Task 3: `SinglesTrainingEngine.undoLastDart`

**Files:**
- Modify: `app/src/modules/game/singles-training.engine.module.ts`
- Modify: `app/tests/modules/game/singles-training.engine.module.test.ts`

**Interfaces:**
- Consumes: `SinglesTrainingEngine` from Task 2 (adds a private `history` field and one new public method to it).
- Produces: `SinglesTrainingEngine.undoLastDart(): boolean`.

- [ ] **Step 1: Write the failing tests for `undoLastDart`**

Append to `app/tests/modules/game/singles-training.engine.module.test.ts`:

```ts
describe("SinglesTrainingEngine.undoLastDart", () => {
  it("returns false when there is no history", () => {
    const engine = new SinglesTrainingEngine();
    expect(engine.undoLastDart()).toBe(false);
  });

  it("reverts a single dart", () => {
    const engine = new SinglesTrainingEngine();
    engine.recordDart("SINGLE");
    expect(engine.undoLastDart()).toBe(true);
    expect(engine.currentPoints()).toBe(0);
  });

  it("reverts the 3rd dart of a visit, restoring the mid-visit total, then can still resolve the visit", () => {
    const engine = new SinglesTrainingEngine();
    engine.recordDart("SINGLE");
    engine.recordDart("SINGLE");
    const afterThird = engine.recordDart("SINGLE");
    expect(afterThird.totalPoints).toBe(3);
    expect(afterThird.targetIndex).toBe(1);

    expect(engine.undoLastDart()).toBe(true);
    expect(engine.currentPoints()).toBe(2);
    expect(engine.currentTarget()).toEqual({ kind: "NUMBER", number: 1 });

    const resumed = engine.recordDart("MISS");
    expect(resumed.totalPoints).toBe(2);
    expect(resumed.targetIndex).toBe(1);
    expect(resumed.dartsThisVisit).toBe(0);
  });

  it("reverts the completing dart, allowing the engine to be marked complete again on redo", () => {
    const engine = new SinglesTrainingEngine();
    for (let visit = 0; visit < 20; visit++) {
      engine.recordDart("TREBLE");
      engine.recordDart("TREBLE");
      engine.recordDart("TREBLE");
    }
    engine.recordDart("DOUBLE");
    engine.recordDart("DOUBLE");
    expect(engine.isComplete()).toBe(false);
    engine.recordDart("DOUBLE");
    expect(engine.isComplete()).toBe(true);
    expect(engine.currentPoints()).toBe(186);

    expect(engine.undoLastDart()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.currentPoints()).toBe(184);

    const resumed = engine.recordDart("DOUBLE");
    expect(engine.isComplete()).toBe(true);
    expect(resumed.totalPoints).toBe(186);
  });

  it("walks back across multiple visits with repeated undos", () => {
    const engine = new SinglesTrainingEngine();
    engine.recordDart("SINGLE");
    engine.recordDart("SINGLE");
    engine.recordDart("SINGLE");
    engine.recordDart("SINGLE");
    expect(engine.currentPoints()).toBe(4);
    expect(engine.currentTarget()).toEqual({ kind: "NUMBER", number: 2 });

    expect(engine.undoLastDart()).toBe(true);
    expect(engine.undoLastDart()).toBe(true);
    expect(engine.undoLastDart()).toBe(true);
    expect(engine.undoLastDart()).toBe(true);
    expect(engine.currentPoints()).toBe(0);
    expect(engine.currentTarget()).toEqual({ kind: "NUMBER", number: 1 });
    expect(engine.undoLastDart()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: FAIL — `engine.undoLastDart is not a function`.

- [ ] **Step 3: Implement `undoLastDart`**

In `app/src/modules/game/singles-training.engine.module.ts`, modify `SinglesTrainingEngine`:

```ts
export class SinglesTrainingEngine {
  private state: SinglesTrainingState;
  private history: SinglesTrainingState[] = [];

  constructor(startingPoints: number = SINGLES_TRAINING_START_POINTS) {
    this.state = initialSinglesTrainingState(startingPoints);
  }

  recordDart(ring: DartRing): SinglesTrainingState {
    this.history.push(this.state);
    this.state = applyDart(this.state, ring);
    return this.state;
  }

  /** Reverts exactly the last recorded dart, one at a time, even across visit/completion boundaries. */
  undoLastDart(): boolean {
    if (this.history.length === 0) return false;
    this.state = this.history.pop()!;
    return true;
  }

  currentTarget(): SinglesTarget {
    return targetForIndex(this.state.targetIndex);
  }

  currentPoints(): number {
    return this.state.totalPoints;
  }

  isComplete(): boolean {
    return this.state.status === "COMPLETE";
  }
}
```

(Only `recordDart` gains the `this.history.push(...)` line and the class gains the `history` field and `undoLastDart` method; `constructor`, `currentTarget`, `currentPoints`, `isComplete` are unchanged from Task 2.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: PASS — all tests green (19 total across Tasks 1-3).

- [ ] **Step 5: Run the full suite and the app validation gates**

Run: `cd app && npm test`
Expected: PASS — full suite green, no pre-existing failures introduced.

Run: `cd app && npx fallow && npm run check`
Expected: both clean (no new type or maintainability issues).

- [ ] **Step 6: Commit**

```bash
cd app && git add src/modules/game/singles-training.engine.module.ts tests/modules/game/singles-training.engine.module.test.ts
git commit -m "Add one-dart-back undo to SinglesTrainingEngine"
```

---

## Post-Implementation

This plan produces the engine only (per spec §1/§6). Before considering Singles Training "done" end-to-end, still needed in future plans: UI (as designed for Bob's 27's confirmation/summary modal pattern), persistence mapping to `turns`/`darts` (including the `SINGLE`/`DOUBLE`-on-`BULL` → `OUTER_BULL`/`INNER_BULL` zone mapping noted in spec §7), `ruleset_versions`/`configuration_templates` alignment (resolving the seed/ruleset inconsistency flagged in spec §1/§6), and session lifecycle wiring. None of that is in scope here.

Root `CLAUDE.md` Context Maintenance protocol: this plan does not add/alter any documented rule, so no `CLAUDE.md`/`AGENT.md`/`00-Context-Map.md`/`DECISIONS.md` edits are required. Run `bash scripts/refresh-graph.sh` and stage `graphify-out/graph.json` as part of `npm run validate:app` before the branch is considered complete (record if the CLI is unavailable, per `app/CLAUDE.md`).
