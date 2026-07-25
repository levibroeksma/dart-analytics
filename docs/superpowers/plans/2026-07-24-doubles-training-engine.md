# Doubles Training Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure-logic Doubles Training engine (V1 Easy mode, single player) — target progression with early visit termination on hit, per-visit fact tracking, completion detection, and one-dart-back undo — with no UI, persistence, or config/session wiring.

**Architecture:** A pure reducer `applyDart(state, hit)` holds all progression/tracking rules and is unit-tested in isolation. A `DoublesTrainingEngine` class wraps it with the same call-site shape as `SinglesTrainingEngine` (present in this branch's tree, itself mirroring `Bobs27Engine` on a separate branch), adding a history stack for undo. Everything lives in `app/src/modules/game/`, following the existing module-per-game-engine convention.

**Tech Stack:** TypeScript, Vitest (`app/vitest.config.ts`, `@modules` path alias → `app/src/modules`).

## Global Constraints

- Spec of record: `docs/superpowers/specs/2026-07-24-doubles-training-engine-design.md`.
- Order (fixed, V1): DOUBLE 1 → DOUBLE 20 → BULL (21 visits total, up to 3 darts each). Only double bull (inner) counts as a hit for `BULL`.
- A visit ends **immediately** on a hit (dart 1 or 2 short-circuits; no 3rd dart is ever recorded for that visit). If all 3 darts miss, the visit still ends after the 3rd dart.
- No score exists in this game. State tracks facts only: `visitHistory` — one `{ targetIndex, hit, hitDartNumber }` entry per completed visit, where `hitDartNumber` is `1 | 2 | 3 | null` (`null` = all 3 missed). No computed ratios in the engine.
- There is no loss/death condition. `status` is only ever `"IN_PROGRESS"` or `"COMPLETE"`. Completion happens after the bull visit resolves (whether hit or missed).
- `recordDart` applies the reducer **before** pushing to the undo history (apply-first, push-second) — the reverse ordering is a known bug class (fixed in `Bobs27Engine` and `SinglesTrainingEngine`) where a rejected dart leaves a phantom history entry. Get this right from Task 3 onward.
- `undoLastDart()` reverts exactly one dart at a time, including across visit boundaries and past a completing dart (status reverts to `IN_PROGRESS`).
- No `.ts` file comments inside function/method bodies (`app/CLAUDE.md`); JSDoc above declarations only where the "why" is non-obvious.
- TDD mandatory: tests under `app/tests/modules/game/`, written before implementation, `npm test` run from `app/`.
- Out of scope (do not implement): UI, persistence to `turns`/`darts`, `configuration_templates`/`ruleset_versions` wiring, Hard mode, Challenge mode, HIGH_TO_LOW/RANDOM order, computed ratios, multiplayer, session lifecycle.

---

### Task 1: Types and pure reducer (`applyDart`)

**Files:**
- Modify: `app/src/modules/game/types.ts`
- Create: `app/src/modules/game/doubles-training.engine.module.ts`
- Test: `app/tests/modules/game/doubles-training.engine.module.test.ts`

**Interfaces:**
- Consumes: nothing (new module).
- Produces (used by Tasks 2-3):
  - `type DoublesTarget = { kind: "DOUBLE"; number: number } | { kind: "BULL" }` (`types.ts`)
  - `type VisitOutcome = { targetIndex: number; hit: boolean; hitDartNumber: 1 | 2 | 3 | null }` (`types.ts`)
  - `type DoublesTrainingState = { targetIndex: number; dartsThisVisit: number; visitHistory: VisitOutcome[]; status: "IN_PROGRESS" | "COMPLETE" }` (`types.ts`)
  - `function applyDart(state: DoublesTrainingState, hit: boolean): DoublesTrainingState` (`doubles-training.engine.module.ts`) — throws if `state.status !== "IN_PROGRESS"`.
  - `function initialDoublesTrainingState(): DoublesTrainingState` (`doubles-training.engine.module.ts`)

- [ ] **Step 1: Add Doubles Training types**

Append to `app/src/modules/game/types.ts`:

```ts
export type DoublesTarget = { kind: "DOUBLE"; number: number } | { kind: "BULL" };

export type VisitOutcome = {
  targetIndex: number;
  hit: boolean;
  hitDartNumber: 1 | 2 | 3 | null;
};

export type DoublesTrainingState = {
  targetIndex: number;
  dartsThisVisit: number;
  visitHistory: VisitOutcome[];
  status: "IN_PROGRESS" | "COMPLETE";
};
```

- [ ] **Step 2: Write the failing tests for `applyDart`**

Create `app/tests/modules/game/doubles-training.engine.module.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { applyDart, initialDoublesTrainingState } from "@modules/game/doubles-training.engine.module";
import type { DoublesTrainingState } from "@modules/game/types";

describe("applyDart — visit resolution on hit", () => {
  it("ends the visit immediately on a dart-1 hit and advances the target", () => {
    const state = initialDoublesTrainingState();
    const next = applyDart(state, true);
    expect(next.targetIndex).toBe(1);
    expect(next.dartsThisVisit).toBe(0);
    expect(next.visitHistory).toEqual([{ targetIndex: 0, hit: true, hitDartNumber: 1 }]);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("ends the visit on a dart-2 hit after a dart-1 miss", () => {
    let state = initialDoublesTrainingState();
    state = applyDart(state, false);
    state = applyDart(state, true);
    expect(state.targetIndex).toBe(1);
    expect(state.visitHistory).toEqual([{ targetIndex: 0, hit: true, hitDartNumber: 2 }]);
  });

  it("resolves naturally on a dart-3 hit after two misses", () => {
    let state = initialDoublesTrainingState();
    state = applyDart(state, false);
    state = applyDart(state, false);
    state = applyDart(state, true);
    expect(state.targetIndex).toBe(1);
    expect(state.visitHistory).toEqual([{ targetIndex: 0, hit: true, hitDartNumber: 3 }]);
  });
});

describe("applyDart — visit resolution on full miss", () => {
  it("still advances after all 3 darts miss", () => {
    let state = initialDoublesTrainingState();
    state = applyDart(state, false);
    state = applyDart(state, false);
    state = applyDart(state, false);
    expect(state.targetIndex).toBe(1);
    expect(state.visitHistory).toEqual([{ targetIndex: 0, hit: false, hitDartNumber: null }]);
  });

  it("does not resolve the visit or record history after only 1 miss", () => {
    const state = initialDoublesTrainingState();
    const next = applyDart(state, false);
    expect(next.targetIndex).toBe(0);
    expect(next.dartsThisVisit).toBe(1);
    expect(next.visitHistory).toEqual([]);
  });
});

describe("applyDart — path completion", () => {
  it("completes after a dart-1 hit on every one of the 21 targets", () => {
    let state = initialDoublesTrainingState();
    for (let visit = 0; visit < 21; visit++) {
      state = applyDart(state, true);
    }
    expect(state.status).toBe("COMPLETE");
    expect(state.visitHistory).toHaveLength(21);
    expect(state.visitHistory.every((v) => v.hit === true && v.hitDartNumber === 1)).toBe(true);
  });
});

describe("applyDart — BULL visit completion", () => {
  it("completes the session on a bull hit", () => {
    const bullState: DoublesTrainingState = {
      targetIndex: 20,
      dartsThisVisit: 0,
      visitHistory: [],
      status: "IN_PROGRESS",
    };
    const next = applyDart(bullState, true);
    expect(next.status).toBe("COMPLETE");
    expect(next.visitHistory).toEqual([{ targetIndex: 20, hit: true, hitDartNumber: 1 }]);
  });

  it("completes the session even when the bull visit is a full miss", () => {
    const bullState: DoublesTrainingState = {
      targetIndex: 20,
      dartsThisVisit: 2,
      visitHistory: [],
      status: "IN_PROGRESS",
    };
    const next = applyDart(bullState, false);
    expect(next.status).toBe("COMPLETE");
    expect(next.visitHistory).toEqual([{ targetIndex: 20, hit: false, hitDartNumber: null }]);
  });
});

describe("applyDart — terminal state guard", () => {
  it("throws when called on a state that is already COMPLETE", () => {
    const completeState: DoublesTrainingState = {
      targetIndex: 20,
      dartsThisVisit: 0,
      visitHistory: [{ targetIndex: 20, hit: true, hitDartNumber: 1 }],
      status: "COMPLETE",
    };
    expect(() => applyDart(completeState, true)).toThrow();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/game/doubles-training.engine.module'` (the module doesn't exist yet).

- [ ] **Step 4: Implement `applyDart` and `initialDoublesTrainingState`**

Create `app/src/modules/game/doubles-training.engine.module.ts`:

```ts
import type { DoublesTarget, DoublesTrainingState, VisitOutcome } from "./types";

function targetForIndex(targetIndex: number): DoublesTarget {
  return targetIndex < 20 ? { kind: "DOUBLE", number: targetIndex + 1 } : { kind: "BULL" };
}

function resolveVisit(state: DoublesTrainingState, visitHistory: VisitOutcome[]): DoublesTrainingState {
  if (state.targetIndex === 20) {
    return { ...state, dartsThisVisit: 0, visitHistory, status: "COMPLETE" };
  }
  return { ...state, dartsThisVisit: 0, visitHistory, targetIndex: state.targetIndex + 1 };
}

export function initialDoublesTrainingState(): DoublesTrainingState {
  return { targetIndex: 0, dartsThisVisit: 0, visitHistory: [], status: "IN_PROGRESS" };
}

export function applyDart(state: DoublesTrainingState, hit: boolean): DoublesTrainingState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error("Cannot record a dart once the session is complete; undo first to correct it.");
  }

  const dartsThisVisit = state.dartsThisVisit + 1;

  if (hit) {
    const outcome: VisitOutcome = {
      targetIndex: state.targetIndex,
      hit: true,
      hitDartNumber: dartsThisVisit as 1 | 2 | 3,
    };
    return resolveVisit(state, [...state.visitHistory, outcome]);
  }

  if (dartsThisVisit < 3) {
    return { ...state, dartsThisVisit };
  }

  const outcome: VisitOutcome = { targetIndex: state.targetIndex, hit: false, hitDartNumber: null };
  return resolveVisit(state, [...state.visitHistory, outcome]);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts`
Expected: PASS — all 9 tests green.

- [ ] **Step 6: Commit**

```bash
cd app && git add src/modules/game/types.ts src/modules/game/doubles-training.engine.module.ts tests/modules/game/doubles-training.engine.module.test.ts
git commit -m "Add Doubles Training pure progression reducer (applyDart)"
```

---

### Task 2: `DoublesTrainingEngine` class (recordDart + state getters)

**Files:**
- Modify: `app/src/modules/game/doubles-training.engine.module.ts`
- Modify: `app/tests/modules/game/doubles-training.engine.module.test.ts`

**Interfaces:**
- Consumes: `applyDart`, `initialDoublesTrainingState`, `DoublesTrainingState`, `DoublesTarget`, `VisitOutcome` from Task 1.
- Produces (used by Task 3):
  - `class DoublesTrainingEngine` with `constructor()`, `recordDart(hit: boolean): DoublesTrainingState`, `currentTarget(): DoublesTarget`, `visitHistory(): VisitOutcome[]`, `isComplete(): boolean`.

- [ ] **Step 1: Write the failing tests for `DoublesTrainingEngine`**

Append to `app/tests/modules/game/doubles-training.engine.module.test.ts`:

```ts
import { DoublesTrainingEngine } from "@modules/game/doubles-training.engine.module";

describe("DoublesTrainingEngine", () => {
  it("starts on target DOUBLE 1, empty history, not complete", () => {
    const engine = new DoublesTrainingEngine();
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 1 });
    expect(engine.visitHistory()).toEqual([]);
    expect(engine.isComplete()).toBe(false);
  });

  it("delegates recordDart to the reducer and exposes the updated state via getters", () => {
    const engine = new DoublesTrainingEngine();
    engine.recordDart(false);
    engine.recordDart(true);
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 2 });
    expect(engine.visitHistory()).toEqual([{ targetIndex: 0, hit: true, hitDartNumber: 2 }]);
  });

  it("reports isComplete once the full 21-visit path is finished", () => {
    const engine = new DoublesTrainingEngine();
    for (let visit = 0; visit < 21; visit++) {
      engine.recordDart(true);
    }
    expect(engine.isComplete()).toBe(true);
    expect(engine.visitHistory()).toHaveLength(21);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts`
Expected: FAIL — `DoublesTrainingEngine` is not exported yet.

- [ ] **Step 3: Implement `DoublesTrainingEngine`**

Add to `app/src/modules/game/doubles-training.engine.module.ts` (after `applyDart`):

```ts
export class DoublesTrainingEngine {
  private state: DoublesTrainingState;

  constructor() {
    this.state = initialDoublesTrainingState();
  }

  recordDart(hit: boolean): DoublesTrainingState {
    this.state = applyDart(this.state, hit);
    return this.state;
  }

  currentTarget(): DoublesTarget {
    return targetForIndex(this.state.targetIndex);
  }

  visitHistory(): VisitOutcome[] {
    return this.state.visitHistory;
  }

  isComplete(): boolean {
    return this.state.status === "COMPLETE";
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts`
Expected: PASS — all tests green (Task 1's 9 + Task 2's 3).

- [ ] **Step 5: Commit**

```bash
cd app && git add src/modules/game/doubles-training.engine.module.ts tests/modules/game/doubles-training.engine.module.test.ts
git commit -m "Add DoublesTrainingEngine class wrapping applyDart"
```

---

### Task 3: `DoublesTrainingEngine.undoLastDart`

**Files:**
- Modify: `app/src/modules/game/doubles-training.engine.module.ts`
- Modify: `app/tests/modules/game/doubles-training.engine.module.test.ts`

**Interfaces:**
- Consumes: `DoublesTrainingEngine` from Task 2 (adds a private `history` field, modifies `recordDart`, adds one new public method).
- Produces: `DoublesTrainingEngine.undoLastDart(): boolean`.

- [ ] **Step 1: Write the failing tests for `undoLastDart`**

Append to `app/tests/modules/game/doubles-training.engine.module.test.ts`:

```ts
describe("DoublesTrainingEngine.undoLastDart", () => {
  it("returns false when there is no history", () => {
    const engine = new DoublesTrainingEngine();
    expect(engine.undoLastDart()).toBe(false);
  });

  it("reverts a hit-that-ended-visit dart, removing the visitHistory entry and restoring the target", () => {
    const engine = new DoublesTrainingEngine();
    engine.recordDart(true);
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 2 });
    expect(engine.visitHistory()).toHaveLength(1);

    expect(engine.undoLastDart()).toBe(true);
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 1 });
    expect(engine.visitHistory()).toHaveLength(0);
  });

  it("reverts a miss dart mid-visit, restoring dartsThisVisit to 0", () => {
    const engine = new DoublesTrainingEngine();
    engine.recordDart(false);
    expect(engine.undoLastDart()).toBe(true);
    const state = engine.recordDart(true);
    expect(state.visitHistory[0]).toEqual({ targetIndex: 0, hit: true, hitDartNumber: 1 });
  });

  it("reverts the completing dart, allowing the engine to be marked complete again on redo", () => {
    const engine = new DoublesTrainingEngine();
    for (let visit = 0; visit < 21; visit++) {
      engine.recordDart(true);
    }
    expect(engine.isComplete()).toBe(true);
    expect(engine.visitHistory()).toHaveLength(21);

    expect(engine.undoLastDart()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.visitHistory()).toHaveLength(20);
    expect(engine.currentTarget()).toEqual({ kind: "BULL" });

    engine.recordDart(true);
    expect(engine.isComplete()).toBe(true);
    expect(engine.visitHistory()).toHaveLength(21);
  });

  it("walks back across multiple visits with repeated undos", () => {
    const engine = new DoublesTrainingEngine();
    engine.recordDart(true);
    engine.recordDart(false);
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 2 });
    expect(engine.visitHistory()).toHaveLength(1);

    expect(engine.undoLastDart()).toBe(true);
    expect(engine.undoLastDart()).toBe(true);
    expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 1 });
    expect(engine.visitHistory()).toHaveLength(0);
    expect(engine.undoLastDart()).toBe(false);
  });

  it("does not push a phantom history entry when recordDart is rejected on a completed engine", () => {
    const engine = new DoublesTrainingEngine();
    for (let visit = 0; visit < 21; visit++) {
      engine.recordDart(true);
    }
    expect(engine.isComplete()).toBe(true);

    expect(() => engine.recordDart(true)).toThrow();

    expect(engine.undoLastDart()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.visitHistory()).toHaveLength(20);
    expect(engine.undoLastDart()).toBe(true);
    expect(engine.visitHistory()).toHaveLength(19);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts`
Expected: FAIL — `engine.undoLastDart is not a function`.

- [ ] **Step 3: Implement `undoLastDart`**

In `app/src/modules/game/doubles-training.engine.module.ts`, modify `DoublesTrainingEngine`:

```ts
export class DoublesTrainingEngine {
  private state: DoublesTrainingState;
  private history: DoublesTrainingState[] = [];

  constructor() {
    this.state = initialDoublesTrainingState();
  }

  recordDart(hit: boolean): DoublesTrainingState {
    const next = applyDart(this.state, hit);
    this.history.push(this.state);
    this.state = next;
    return this.state;
  }

  /** Reverts exactly the last recorded dart, one at a time, even across visit/completion boundaries. */
  undoLastDart(): boolean {
    if (this.history.length === 0) return false;
    this.state = this.history.pop()!;
    return true;
  }

  currentTarget(): DoublesTarget {
    return targetForIndex(this.state.targetIndex);
  }

  visitHistory(): VisitOutcome[] {
    return this.state.visitHistory;
  }

  isComplete(): boolean {
    return this.state.status === "COMPLETE";
  }
}
```

(Only `recordDart` changes — apply-first, push-second, per Global Constraints — and the class gains the `history` field and `undoLastDart` method; `constructor`, `currentTarget`, `visitHistory`, `isComplete` are unchanged from Task 2.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts`
Expected: PASS — all tests green (18 total across Tasks 1-3).

- [ ] **Step 5: Run the full suite and the app validation gates**

Run: `cd app && npm test`
Expected: PASS — full suite green, no pre-existing failures introduced.

Run: `cd app && npx fallow && npm run check`
Expected: both clean (no new type or maintainability issues).

- [ ] **Step 6: Commit**

```bash
cd app && git add src/modules/game/doubles-training.engine.module.ts tests/modules/game/doubles-training.engine.module.test.ts
git commit -m "Add one-dart-back undo to DoublesTrainingEngine"
```

---

## Post-Implementation

This plan produces the engine only (per spec §1/§6). Before considering Doubles Training "done" end-to-end, still needed in future plans: UI, persistence mapping to `turns`/`darts`, seeding `DOUBLES_TRAINING` as a new `game_type` plus `ruleset_versions`/`configuration_templates` (not yet seeded — new game type, unlike Singles Training), computed hit/miss ratios (overall and per-target, derivable from `visitHistory`), and session lifecycle wiring. None of that is in scope here.

Root `CLAUDE.md` Context Maintenance protocol: this plan does not add/alter any documented rule, so no `CLAUDE.md`/`AGENT.md`/`00-Context-Map.md`/`DECISIONS.md` edits are required. Run `bash scripts/refresh-graph.sh` and stage `graphify-out/graph.json` as part of `npm run validate:app` before the branch is considered complete (record if the CLI is unavailable, per `app/CLAUDE.md`).
