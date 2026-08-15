# Around the Clock V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Around the Clock v1 — a single-player game where hitting the current number (single, double, or treble) advances the target immediately, mid-visit, through 1→20 then BULL, ending the instant BULL is hit.

**Architecture:** Mirrors the Shanghai/121 engine shape (Pattern 18 `GameEngine` contract) reusing `board-progression.module.ts`'s `numbersPath()`/`targetAt()`/`boardScore()`. The one real mechanical difference from every existing engine: a hit advances `targetIndex` immediately instead of waiting for the visit's 3rd dart, and a BULL hit can close a visit early (fewer than 3 darts). Frontend reuses `SinglesRecreationalInput.astro`/`VisitPreview.astro` unmodified.

**Tech Stack:** Astro, TypeScript, Alpine.js, Zod, Vitest, PostgreSQL (Neon) seeds.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-15-around-the-clock-v1-design.md` — read it before starting; every task below implements a piece of it.
- Ruleset version key: `AROUND_THE_CLOCK_V1`. Game type implementation key: `AROUND_THE_CLOCK`.
- Capture mode: `RECREATIONAL` + `DETAILED_DARTS` only. No `ANALYTICS`/`VISUAL_BOARD` pairing in v1.
- `AroundTheClockConfig` is a genuinely empty `.strict()` Zod object — zero editable settings.
- A hit advances the target immediately, mid-visit. A BULL hit ends the session immediately, even with darts left in that visit.
- `intendedTargetNumber`/`intendedZoneKey` are always `null` on every dart fact — never populate them, even though the active target can change within a visit (see spec's Persistence Shape section for why this is still safe).
- Never put `//`/`/* */` comments inside function/method bodies in `app/src/**/*.ts` (JSDoc above the declaration only). Tests are exempt.
- Every `*.engine.module.ts`'s `rulesetVersionKey` and its server-side validator registration must land in the same commit — `scripts/check-game-engines.sh` runs pre-commit and rejects one without the other.
- Run `cd app && npm test` (or the specific test file) after every implementation step; do not move on with red tests.
- Run `bash scripts/check-game-engines.sh` from the repo root before the Task 2 commit.
- Format before any commit that touches `app/`: `cd app && npm run format`.
- Do not modify `database/migrations/**` — this feature is seed-only, no schema change.
- Never modify `database/seeds/0001`–`0006`, `0008`, `0009` — only append to `0007`'s existing `VALUES` list and create new file `0010`.

---

## Task 1: Config schema

**Files:**
- Modify: `app/src/lib/game/rulesets/types.ts`
- Test: `app/tests/lib/game/rulesets/types.test.ts` (create if it does not already exist — check first with `ls app/tests/lib/game/rulesets/`)

**Interfaces:**
- Produces: `AroundTheClockConfig` (Zod schema, exported), `AroundTheClockConfigData` (`z.infer` type), `AroundTheClockSnapshot` (`Record<string, never>`), `RulesetVersionKey` gains `"AROUND_THE_CLOCK_V1"`, `RULESET_CONFIGS` and `ConfigSnapshotFor` gain matching entries. Later tasks import `AroundTheClockSnapshot` via `@lib/types` (the barrel at `app/src/lib/types.ts` re-exports `./rulesets/types`).

- [ ] **Step 1: Check for an existing rulesets types test file**

Run: `ls app/tests/lib/game/rulesets/ | grep types`

If a `types.test.ts` (or similar) already exists covering `RULESET_CONFIGS`, add to it. Otherwise create `app/tests/lib/game/rulesets/types.test.ts` fresh in the next step.

- [ ] **Step 2: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { AroundTheClockConfig, RULESET_CONFIGS } from "@lib/game/rulesets/types";

describe("AroundTheClockConfig", () => {
  it("accepts an empty object", () => {
    const result = AroundTheClockConfig.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects any key (the schema is .strict())", () => {
    const result = AroundTheClockConfig.safeParse({ rounds: 20 });
    expect(result.success).toBe(false);
  });
});

describe("RULESET_CONFIGS", () => {
  it("registers AROUND_THE_CLOCK_V1", () => {
    expect(RULESET_CONFIGS.AROUND_THE_CLOCK_V1).toBe(AroundTheClockConfig);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/rulesets/types.test.ts`
Expected: FAIL — `AroundTheClockConfig` is not exported, `RULESET_CONFIGS.AROUND_THE_CLOCK_V1` is `undefined`.

- [ ] **Step 4: Add the config schema**

In `app/src/lib/game/rulesets/types.ts`, immediately after `OneTwentyOneConfig` (currently the last config schema, around line 171):

```typescript
/**
 * Around the Clock v1 locks every rule (path 1..20 then BULL, any segment
 * advances, mid-visit advancement, BULL ends the session immediately) with
 * nothing left to configure — a genuinely empty `.strict()` object, exactly
 * like `ShanghaiConfig`/`OneTwentyOneConfig`. A future version that adds a
 * direction, segment-lock, or difficulty toggle widens this schema then.
 */
export const AroundTheClockConfig = z.object({}).strict();
```

Update the `RulesetVersionKey` union (add after `"121_V1"`):

```typescript
export type RulesetVersionKey =
  | "SCORE_TRAINING_V1"
  | "BOBS27_V1"
  | "SINGLES_V1"
  | "DOUBLES_TRAINING_V1"
  | "501_V1"
  | "TUOD_V1"
  | "SHANGHAI_V1"
  | "121_V1"
  | "AROUND_THE_CLOCK_V1";
```

Update `RULESET_CONFIGS` (add after `"121_V1": OneTwentyOneConfig,`):

```typescript
export const RULESET_CONFIGS: Record<RulesetVersionKey, z.ZodTypeAny> = {
  SCORE_TRAINING_V1: ScoreTrainingConfig,
  BOBS27_V1: Bobs27Config,
  SINGLES_V1: SinglesConfig,
  DOUBLES_TRAINING_V1: DoublesTrainingConfig,
  "501_V1": FiveOhOneConfig,
  TUOD_V1: TuodConfig,
  SHANGHAI_V1: ShanghaiConfig,
  "121_V1": OneTwentyOneConfig,
  AROUND_THE_CLOCK_V1: AroundTheClockConfig,
};
```

Add the snapshot type after `OneTwentyOneSnapshot`:

```typescript
/** Around the Clock v1 has nothing to configure — no fields to carry. */
export type AroundTheClockSnapshot = Record<string, never>;
```

Update `ConfigSnapshotFor` — replace the final `: OneTwentyOneSnapshot;` branch:

```typescript
export type ConfigSnapshotFor<K extends RulesetVersionKey> =
  K extends "SCORE_TRAINING_V1"
    ? ScoreTrainingSnapshot
    : K extends "BOBS27_V1"
      ? Bobs27Snapshot
      : K extends "SINGLES_V1"
        ? SinglesSnapshot
        : K extends "DOUBLES_TRAINING_V1"
          ? DoublesTrainingSnapshot
          : K extends "501_V1"
            ? FiveOhOneSnapshot
            : K extends "TUOD_V1"
              ? TuodSnapshot
              : K extends "SHANGHAI_V1"
                ? ShanghaiSnapshot
                : K extends "121_V1"
                  ? OneTwentyOneSnapshot
                  : AroundTheClockSnapshot;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/rulesets/types.test.ts`
Expected: PASS

- [ ] **Step 6: Run the full suite and format**

Run: `cd app && npm test && npm run format`
Expected: all green; format makes no further changes (or only whitespace in the two files touched)

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/rulesets/types.ts app/tests/lib/game/rulesets/types.test.ts
git commit -m "Add Around the Clock v1 config schema"
```

---

## Task 2: Engine, validator, capability declaration (single commit — atomicity gate)

This task must land as **one commit**: `scripts/check-game-engines.sh` runs pre-commit and fails if `around-the-clock.engine.module.ts` names `AROUND_THE_CLOCK_V1` without a matching entry in both `services/rulesets/registry.ts` and `RULESET_CAPABILITIES`. Work through the steps in order but stage everything together at the end.

**Files:**
- Modify: `app/src/modules/game/types.ts` (add `AroundTheClockState`)
- Create: `app/src/modules/game/around-the-clock.engine.module.ts`
- Test: `app/tests/modules/game/around-the-clock.engine.module.test.ts`
- Modify: `app/src/lib/game/rulesets/capabilities.ts`
- Modify: `app/tests/lib/game/rulesets/capabilities.test.ts`
- Modify: `app/tests/lib/game/rulesets/capability-validator-parity.test.ts`
- Create: `app/src/services/rulesets/around-the-clock/around-the-clock.validator.ts`
- Test: `app/tests/services/rulesets/around-the-clock/around-the-clock.validator.test.ts`
- Modify: `app/src/services/rulesets/registry.ts`
- Modify: `database/seeds/0007_ruleset_version_capabilities.sql` (append one row — `capability-seed-parity.test.ts` compares this file against `capabilities.ts` byte-for-triple)

**Interfaces:**
- Consumes: `AroundTheClockSnapshot` (Task 1, via `@lib/types`), `BoardTarget`/`DartObservation`/`DartFact`/`EngineFacts`/`StageFact`/`TurnFact` (`@modules/types`), `numbersPath`/`targetAt`/`boardScore`/`BULL_TARGET_NUMBER` (`@modules/game/board-progression.module`), `newClientKey` (`@modules/game/client-key.module`), `registerEngineFactory` (`@modules/game/engine.registry`), `GameEngine`/`GameEngineFactory` (`@modules/game/interfaces`).
- Produces: `AroundTheClockState` type, `initialAroundTheClockState()`, `isAroundTheClockHit(target, observation)`, `applyAroundTheClockDart(state, observation)`, `AroundTheClockEngine` class, `aroundTheClockEngineFactory`, `aroundTheClockValidator`. Task 4/5 import `AroundTheClockEngine` from `@modules/game/around-the-clock.engine.module` and `aroundTheClockEngineFactory`/`AroundTheClockState` indirectly via the engine.

### Step group A: state type

- [ ] **Step 1: Add `AroundTheClockState` to `app/src/modules/game/types.ts`**

Add after `OneTwentyOneState` (end of that block, before the `TuodAttemptInput` section, or simplest: right after `OneTwentyOneState`'s closing `};`):

```typescript
/**
 * Around the Clock session state. `targetIndex` is the active target (0..19
 * = numbers 1..20, 20 = BULL) and can advance more than once within a single
 * visit — unlike every other engine, a visit's remaining darts aim at
 * whatever target is now active, not the one the visit started on.
 * `dartsThisVisit` counts darts thrown in the open visit (0..2); it resets
 * to 0 both when a visit closes normally at 3 darts and when a BULL hit
 * completes the session early. Both fields are folds over the fact log,
 * never accumulated.
 */
export type AroundTheClockState = {
  targetIndex: number;
  dartsThisVisit: number;
  status: "IN_PROGRESS" | "COMPLETE";
};
```

No test for this step alone — it is exercised by the engine tests in the next step group.

### Step group B: engine

- [ ] **Step 2: Write the failing engine tests**

Create `app/tests/modules/game/around-the-clock.engine.module.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  applyAroundTheClockDart,
  initialAroundTheClockState,
  isAroundTheClockHit,
  AroundTheClockEngine,
  aroundTheClockEngineFactory,
} from "@modules/game/around-the-clock.engine.module";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type {
  AroundTheClockState,
  DartObservation,
  EngineFacts,
} from "@modules/types";
import type { AroundTheClockSnapshot } from "@lib/types";

const config: AroundTheClockSnapshot = {};

function numberHit(
  number: number,
  zone: "SINGLE" | "DOUBLE" | "TREBLE",
): DartObservation {
  return { hitTargetNumber: number, hitZoneKey: zone, locationX: null, locationY: null };
}

function miss(): DartObservation {
  return { hitTargetNumber: null, hitZoneKey: "MISS", locationX: null, locationY: null };
}

function bullHit(zone: "OUTER_BULL" | "INNER_BULL"): DartObservation {
  return { hitTargetNumber: 25, hitZoneKey: zone, locationX: null, locationY: null };
}

describe("aroundTheClockEngineFactory", () => {
  it("registers itself under AROUND_THE_CLOCK_V1", () => {
    expect(aroundTheClockEngineFactory.rulesetVersionKey).toBe(
      "AROUND_THE_CLOCK_V1",
    );
    expect(getEngineFactory("AROUND_THE_CLOCK_V1")).toBe(
      aroundTheClockEngineFactory,
    );
  });

  it("builds an AroundTheClockEngine bound to the ruleset version", () => {
    const engine = aroundTheClockEngineFactory.create(config);
    expect(engine).toBeInstanceOf(AroundTheClockEngine);
    expect(engine.rulesetVersionKey).toBe("AROUND_THE_CLOCK_V1");
  });
});

describe("initialAroundTheClockState", () => {
  it("starts at target index 0 (number 1), no darts thrown, in progress", () => {
    expect(initialAroundTheClockState()).toEqual({
      targetIndex: 0,
      dartsThisVisit: 0,
      status: "IN_PROGRESS",
    });
  });
});

describe("isAroundTheClockHit — NUMBER target", () => {
  const target = targetAt(numbersPath(), 0);

  it.each(["SINGLE", "DOUBLE", "TREBLE"] as const)(
    "accepts a %s on the matching number",
    (zone) => {
      expect(isAroundTheClockHit(target, numberHit(1, zone))).toBe(true);
    },
  );

  it("rejects a MISS", () => {
    expect(isAroundTheClockHit(target, miss())).toBe(false);
  });

  it("rejects a hit on the wrong number", () => {
    expect(isAroundTheClockHit(target, numberHit(2, "SINGLE"))).toBe(false);
  });
});

describe("isAroundTheClockHit — BULL target", () => {
  const target = targetAt(numbersPath(), 20);

  it("accepts OUTER_BULL", () => {
    expect(isAroundTheClockHit(target, bullHit("OUTER_BULL"))).toBe(true);
  });

  it("accepts INNER_BULL", () => {
    expect(isAroundTheClockHit(target, bullHit("INNER_BULL"))).toBe(true);
  });

  it("rejects a MISS", () => {
    expect(isAroundTheClockHit(target, miss())).toBe(false);
  });

  it("rejects a hit on a number (wrong target number)", () => {
    expect(isAroundTheClockHit(target, numberHit(20, "TREBLE"))).toBe(false);
  });
});

describe("applyAroundTheClockDart — mid-visit advance", () => {
  it("advances the target immediately within one visit, clearing two numbers in three darts", () => {
    let state = initialAroundTheClockState();
    state = applyAroundTheClockDart(state, numberHit(1, "SINGLE"));
    expect(state.targetIndex).toBe(1);
    expect(state.dartsThisVisit).toBe(1);

    state = applyAroundTheClockDart(state, numberHit(2, "DOUBLE"));
    expect(state.targetIndex).toBe(2);
    expect(state.dartsThisVisit).toBe(2);

    state = applyAroundTheClockDart(state, miss());
    expect(state.targetIndex).toBe(2);
    expect(state.dartsThisVisit).toBe(0);
    expect(state.status).toBe("IN_PROGRESS");
  });

  it("closes the visit at 3 darts with no advance when every dart misses", () => {
    let state = initialAroundTheClockState();
    state = applyAroundTheClockDart(state, miss());
    state = applyAroundTheClockDart(state, miss());
    state = applyAroundTheClockDart(state, miss());
    expect(state.targetIndex).toBe(0);
    expect(state.dartsThisVisit).toBe(0);
    expect(state.status).toBe("IN_PROGRESS");
  });
});

describe("applyAroundTheClockDart — BULL completion", () => {
  it.each([0, 1, 2])(
    "completes immediately on a BULL hit as dart index %i of the visit",
    (dartsThisVisit) => {
      const state: AroundTheClockState = {
        targetIndex: 20,
        dartsThisVisit,
        status: "IN_PROGRESS",
      };
      const next = applyAroundTheClockDart(state, bullHit("INNER_BULL"));
      expect(next).toEqual({
        targetIndex: 20,
        dartsThisVisit: 0,
        status: "COMPLETE",
      });
    },
  );

  it("does not complete on a BULL miss and keeps counting the visit", () => {
    const state: AroundTheClockState = {
      targetIndex: 20,
      dartsThisVisit: 0,
      status: "IN_PROGRESS",
    };
    const next = applyAroundTheClockDart(state, miss());
    expect(next).toEqual({
      targetIndex: 20,
      dartsThisVisit: 1,
      status: "IN_PROGRESS",
    });
  });
});

describe("applyAroundTheClockDart — terminal state guard", () => {
  it("throws when called on a COMPLETE state", () => {
    const terminal: AroundTheClockState = {
      targetIndex: 20,
      dartsThisVisit: 0,
      status: "COMPLETE",
    };
    expect(() => applyAroundTheClockDart(terminal, miss())).toThrow();
  });
});

describe("AroundTheClockEngine — fact log and derived state", () => {
  it("stores the real board score and null intention on every dart", () => {
    const engine = aroundTheClockEngineFactory.create(config);
    engine.record(numberHit(1, "TREBLE"));

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.score).toBe(3);
    expect(dart.intendedTargetNumber).toBeNull();
    expect(dart.intendedZoneKey).toBeNull();
    expect(engine.state().targetIndex).toBe(1);
  });

  it("keeps all three darts of a mid-visit-advance turn in one TurnFact", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(numberHit(1, "SINGLE"));
    engine.record(numberHit(2, "DOUBLE"));
    engine.record(miss());

    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].darts).toHaveLength(3);
    expect(engine.state().targetIndex).toBe(2);
  });

  it("stamps completedAt early when a BULL hit ends the session on the visit's 1st dart", () => {
    const engine = new AroundTheClockEngine(config);
    for (let n = 1; n <= 20; n += 1) {
      engine.record(numberHit(n, "SINGLE"));
      engine.record(miss());
      engine.record(miss());
    }
    expect(engine.state().targetIndex).toBe(20);

    engine.record(bullHit("OUTER_BULL"));

    const lastTurn = engine.facts().turns.at(-1);
    expect(lastTurn?.darts).toHaveLength(1);
    expect(lastTurn?.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    expect(engine.isComplete()).toBe(true);
  });

  it("leaves completedAt null on an open visit that has not resolved", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(miss());
    expect(engine.facts().turns[0].completedAt).toBeNull();
  });

  it("rehydrates target index and completion from persisted facts", () => {
    const first = aroundTheClockEngineFactory.create(config);
    first.record(numberHit(1, "SINGLE"));
    first.record(numberHit(2, "SINGLE"));

    const resumed = aroundTheClockEngineFactory.create(config, first.facts());
    expect(resumed.state().targetIndex).toBe(2);
    expect(resumed.state().status).toBe("IN_PROGRESS");
  });
});

describe("AroundTheClockEngine.wouldComplete", () => {
  it("is true for a BULL hit on any dart of the visit, not only the 3rd", () => {
    const engine = new AroundTheClockEngine(config);
    for (let n = 1; n <= 20; n += 1) {
      engine.record(numberHit(n, "SINGLE"));
      engine.record(miss());
      engine.record(miss());
    }
    expect(engine.state().targetIndex).toBe(20);
    expect(engine.wouldComplete(bullHit("INNER_BULL"))).toBe(true);
    expect(engine.state().status).toBe("IN_PROGRESS");
  });

  it("is false for a BULL miss", () => {
    const engine = new AroundTheClockEngine(config);
    for (let n = 1; n <= 20; n += 1) {
      engine.record(numberHit(n, "SINGLE"));
      engine.record(miss());
      engine.record(miss());
    }
    expect(engine.wouldComplete(miss())).toBe(false);
  });

  it("is false once the session has already ended", () => {
    const engine = new AroundTheClockEngine(config);
    for (let n = 1; n <= 20; n += 1) {
      engine.record(numberHit(n, "SINGLE"));
      engine.record(miss());
      engine.record(miss());
    }
    engine.record(bullHit("OUTER_BULL"));
    expect(engine.state().status).toBe("COMPLETE");
    expect(engine.wouldComplete(bullHit("INNER_BULL"))).toBe(false);
  });

  it("does not mutate the fact log or the derived state", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(numberHit(1, "SINGLE"));
    const factsBefore = engine.facts();
    const stateBefore = engine.state();

    engine.wouldComplete(numberHit(2, "SINGLE"));

    expect(engine.facts()).toEqual(factsBefore);
    expect(engine.state()).toEqual(stateBefore);
  });
});

describe("AroundTheClockEngine.undo", () => {
  it("returns false when there is no history", () => {
    const engine = new AroundTheClockEngine(config);
    expect(engine.undo()).toBe(false);
  });

  it("is an exact inverse of record() when it extended the open visit", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(numberHit(1, "SINGLE"));
    const before = engine.facts();
    engine.record(numberHit(2, "SINGLE"));
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
  });

  it("reopens a visit that closed early via a BULL completion, removing the 1-dart turn entirely", () => {
    const engine = new AroundTheClockEngine(config);
    for (let n = 1; n <= 20; n += 1) {
      engine.record(numberHit(n, "SINGLE"));
      engine.record(miss());
      engine.record(miss());
    }
    const turnsBeforeBull = engine.facts().turns.length;
    engine.record(bullHit("OUTER_BULL"));
    expect(engine.state().status).toBe("COMPLETE");

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().targetIndex).toBe(20);
    expect(engine.facts().turns).toHaveLength(turnsBeforeBull);
  });

  it("walks back across a two-advance turn one dart at a time", () => {
    const engine = new AroundTheClockEngine(config);
    engine.record(numberHit(1, "SINGLE"));
    engine.record(numberHit(2, "DOUBLE"));
    engine.record(miss());
    expect(engine.state().targetIndex).toBe(2);

    expect(engine.undo()).toBe(true);
    expect(engine.state().targetIndex).toBe(2);
    expect(engine.undo()).toBe(true);
    expect(engine.state().targetIndex).toBe(1);
    expect(engine.undo()).toBe(true);
    expect(engine.state().targetIndex).toBe(0);
    expect(engine.undo()).toBe(false);
  });

  it("rehydrates from persisted facts and continues to undo across the boundary", () => {
    const first = aroundTheClockEngineFactory.create(config);
    first.record(numberHit(1, "SINGLE"));

    const resumed = aroundTheClockEngineFactory.create(config, first.facts());
    resumed.record(numberHit(2, "SINGLE"));
    expect(resumed.state().targetIndex).toBe(2);

    expect(resumed.undo()).toBe(true);
    expect(resumed.state().targetIndex).toBe(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/around-the-clock.engine.module.test.ts`
Expected: FAIL — cannot resolve `@modules/game/around-the-clock.engine.module`

- [ ] **Step 4: Implement the engine**

Create `app/src/modules/game/around-the-clock.engine.module.ts`:

```typescript
import type { AroundTheClockSnapshot } from "@lib/types";
import { newClientKey } from "./client-key.module";
import {
  BULL_TARGET_NUMBER,
  boardScore,
  numbersPath,
  targetAt,
} from "./board-progression.module";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  AroundTheClockState,
  BoardTarget,
  DartFact,
  DartObservation,
  EngineFacts,
  StageFact,
  TurnFact,
} from "./types";

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

const LAST_TARGET_INDEX = 20;

/**
 * Around the Clock starting state: aimed at NUMBER 1, no darts thrown yet.
 */
export function initialAroundTheClockState(): AroundTheClockState {
  return { targetIndex: 0, dartsThisVisit: 0, status: "IN_PROGRESS" };
}

/**
 * `board-progression.module.ts`'s `isHitOn` requires `INNER_BULL` only (the
 * doubles-path rule) — this game accepts either bull ring, so the BULL case
 * is handled here instead. The NUMBER case (any of single/double/treble on
 * the matching number) matches `isHitOn`'s own NUMBER-kind branch.
 */
export function isAroundTheClockHit(
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
    observation.hitZoneKey !== "MISS"
  );
}

/**
 * Pure reducer: folds one dart observation onto an `AroundTheClockState`. A
 * hit advances the target immediately, mid-visit — unlike Shanghai/Singles
 * Training, a visit's remaining darts aim at whatever target is now active,
 * not the one the visit started on. A hit on the BULL target (index 20)
 * completes the session immediately, whatever `dartsThisVisit` currently is;
 * no further dart is recorded for that visit. Otherwise the visit closes
 * (`dartsThisVisit` resets to 0) once it reaches 3 darts, same as every
 * other engine. Takes no config: v1 has nothing to configure
 * (`AroundTheClockSnapshot` is `{}`).
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyAroundTheClockDart(
  state: AroundTheClockState,
  observation: DartObservation,
): AroundTheClockState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session has ended; undo first to correct it.",
    );
  }

  const target = targetAt(numbersPath(), state.targetIndex);
  const hit = isAroundTheClockHit(target, observation);

  if (hit && state.targetIndex === LAST_TARGET_INDEX) {
    return {
      targetIndex: LAST_TARGET_INDEX,
      dartsThisVisit: 0,
      status: "COMPLETE",
    };
  }

  const targetIndex = hit ? state.targetIndex + 1 : state.targetIndex;
  const dartsThisVisit =
    state.dartsThisVisit + 1 === 3 ? 0 : state.dartsThisVisit + 1;
  return { targetIndex, dartsThisVisit, status: "IN_PROGRESS" };
}

function sumDartScores(darts: readonly DartFact[]): number {
  return darts.reduce((total, dart) => total + dart.score, 0);
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/**
 * Around the Clock: a fixed 21-target path (1..20, then BULL) walked with
 * mid-visit advancement — a hit moves to the next target immediately, so a
 * single 3-dart visit can clear several numbers. `state()` derives the
 * current target and completion by folding `facts()` through
 * `applyAroundTheClockDart` — neither is ever stored.
 */
export class AroundTheClockEngine
  implements GameEngine<DartObservation, AroundTheClockState>
{
  readonly rulesetVersionKey = "AROUND_THE_CLOCK_V1";
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: AroundTheClockSnapshot,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): AroundTheClockState {
    let state = initialAroundTheClockState();
    for (const turn of this.turns) {
      for (const dart of turn.darts) {
        state = applyAroundTheClockDart(state, {
          hitTargetNumber: dart.hitTargetNumber,
          hitZoneKey: dart.hitZoneKey,
          locationX: dart.locationX,
          locationY: dart.locationY,
        });
      }
    }
    return state;
  }

  private openOrCreateTurn(): TurnFact {
    const last = this.turns.at(-1);
    if (last && last.darts.length < 3) return last;

    const turn: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: STAGE.clientKey,
      sequence: this.turns.length + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(turn);
    return turn;
  }

  /**
   * Appends one dart to the open visit, opening a new one when the last is
   * already 3 darts deep. `intendedTargetNumber`/`intendedZoneKey` stay null
   * on every dart: single, double and treble of the active number are
   * equally valid intended outcomes, and — although the active target can
   * now change mid-visit, unlike Shanghai/Singles Training — it remains
   * exactly recoverable by replaying `facts()` through
   * `applyAroundTheClockDart` up to that dart, so nothing new needs storing.
   * `completedAt` is stamped when the visit resolves: on its 3rd dart, or
   * immediately when this dart completes the session (a BULL hit can land
   * on dart 1 or 2 of a visit, leaving it permanently short of 3).
   * @throws when the session has already ended; the fact log is left untouched.
   */
  record(observation: DartObservation): AroundTheClockState {
    const before = this.deriveState();
    const after = applyAroundTheClockDart(before, observation);

    const openTurn = this.openOrCreateTurn();
    const dart: DartFact = {
      sequence: openTurn.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
      locationX: observation.locationX,
      locationY: observation.locationY,
    };

    openTurn.darts.push(dart);
    openTurn.totalScore = sumDartScores(openTurn.darts);
    if (openTurn.darts.length === 3 || after.status === "COMPLETE") {
      openTurn.completedAt = new Date().toISOString();
    }

    return after;
  }

  /**
   * Pops the last recorded dart, including one replayed from persisted
   * facts, and removes the visit entirely once it holds no darts — the
   * exact inverse of the `record()` call that created it, whether that
   * visit closed at 3 darts or early via a BULL completion. A surviving
   * visit is open again by definition, so its `completedAt` is cleared.
   * @returns true if a dart was removed; false if there was nothing to undo.
   */
  undo(): boolean {
    const openTurn = this.turns.at(-1);
    if (!openTurn || openTurn.darts.length === 0) return false;

    openTurn.darts.pop();
    if (openTurn.darts.length === 0) {
      this.turns.pop();
    } else {
      openTurn.completedAt = null;
      openTurn.totalScore = sumDartScores(openTurn.darts);
    }
    return true;
  }

  /**
   * Answers whether recording `observation` would complete the session,
   * without mutating the fact log or the derived state. Unlike Shanghai and
   * Singles Training, no dart-position gating applies: a BULL hit completes
   * the session on any dart of a visit, not only the 3rd.
   */
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;

    const after = applyAroundTheClockDart(before, observation);
    return after.status !== "IN_PROGRESS";
  }

  isComplete(): boolean {
    return this.deriveState().status !== "IN_PROGRESS";
  }

  state(): AroundTheClockState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const aroundTheClockEngineFactory: GameEngineFactory<
  AroundTheClockSnapshot,
  DartObservation,
  AroundTheClockState
> = {
  rulesetVersionKey: "AROUND_THE_CLOCK_V1",
  create(config: AroundTheClockSnapshot, prior?: EngineFacts) {
    return new AroundTheClockEngine(config, prior);
  },
};

registerEngineFactory(aroundTheClockEngineFactory);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/around-the-clock.engine.module.test.ts`
Expected: PASS (this will still fail at import resolution for `AroundTheClockSnapshot`/`AroundTheClockState` until Step group C below wires `capabilities.ts`/`@lib/types` — if `AroundTheClockSnapshot` fails to resolve, re-check Task 1 landed and `@lib/types` re-exports `./rulesets/types`; `AroundTheClockState` resolves from Step 1 above, same file)

### Step group C: capability declaration

- [ ] **Step 6: Write the failing capabilities test additions**

In `app/tests/lib/game/rulesets/capabilities.test.ts`, update the `"declares a pair for every ruleset version"` test's expected array (add `"AROUND_THE_CLOCK_V1"` alphabetically) and the `it.each` list of DETAILED_DARTS-only rulesets:

```typescript
describe("RULESET_CAPABILITIES", () => {
  it("declares a pair for every ruleset version", () => {
    expect(Object.keys(RULESET_CAPABILITIES).sort()).toEqual([
      "121_V1",
      "501_V1",
      "AROUND_THE_CLOCK_V1",
      "BOBS27_V1",
      "DOUBLES_TRAINING_V1",
      "SCORE_TRAINING_V1",
      "SHANGHAI_V1",
      "SINGLES_V1",
      "TUOD_V1",
    ]);
  });
  // ... rest of describe block unchanged
```

And further down, extend the existing `it.each`:

```typescript
  it.each([
    "SINGLES_V1",
    "BOBS27_V1",
    "DOUBLES_TRAINING_V1",
    "SHANGHAI_V1",
    "AROUND_THE_CLOCK_V1",
  ] as const)(
    "gives %s RECREATIONAL + DETAILED_DARTS, not ANALYTICS + DETAILED_DARTS",
    (rulesetVersionKey) => {
      expect(
        supportsMode(rulesetVersionKey, "RECREATIONAL", "DETAILED_DARTS"),
      ).toBe(true);
      expect(
        supportsMode(rulesetVersionKey, "ANALYTICS", "DETAILED_DARTS"),
      ).toBe(false);
    },
  );
```

In `app/tests/lib/game/rulesets/capability-validator-parity.test.ts`, change:

```typescript
  it("covers every ruleset", () => {
    expect(rulesetKeys.length).toBe(9);
  });
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts tests/lib/game/rulesets/capability-validator-parity.test.ts`
Expected: FAIL — `RULESET_CAPABILITIES` has no `AROUND_THE_CLOCK_V1` key yet, `rulesetKeys.length` is 8

- [ ] **Step 8: Declare the capability**

In `app/src/lib/game/rulesets/capabilities.ts`, add to `RULESET_CAPABILITIES` (after `"121_V1": [QUICK_SCORE],`):

```typescript
export const RULESET_CAPABILITIES: Readonly<
  Record<RulesetVersionKey, readonly ModePair[]>
> = {
  "501_V1": [QUICK_SCORE, VISUAL_BOARD],
  SCORE_TRAINING_V1: [QUICK_SCORE, VISUAL_BOARD],
  TUOD_V1: [QUICK_SCORE],
  SINGLES_V1: [DETAILED_DARTS],
  BOBS27_V1: [DETAILED_DARTS, VISUAL_BOARD],
  DOUBLES_TRAINING_V1: [DETAILED_DARTS],
  SHANGHAI_V1: [DETAILED_DARTS],
  "121_V1": [QUICK_SCORE],
  AROUND_THE_CLOCK_V1: [DETAILED_DARTS],
};
```

- [ ] **Step 9: Run tests to verify capabilities.test.ts passes (capability-validator-parity.test.ts still fails — no validator yet)**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts`
Expected: PASS

Run: `cd app && npx vitest run tests/lib/game/rulesets/capability-validator-parity.test.ts`
Expected: FAIL — `no validator for AROUND_THE_CLOCK_V1`

### Step group D: validator

- [ ] **Step 10: Write the failing validator tests**

Create `app/tests/services/rulesets/around-the-clock/around-the-clock.validator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { aroundTheClockValidator } from "@services/rulesets/around-the-clock/around-the-clock.validator";
import type { DartFactInput } from "@routes/types";

const validConfig = {};

const hitDart: DartFactInput = {
  sequence: 1,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber: 1,
  hitZoneKey: "SINGLE",
  score: 1,
  locationX: null,
  locationY: null,
};

function batchWithTurns(darts: DartFactInput[][]) {
  return {
    stages: [
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: darts.map((turnDarts, i) => ({
          clientKey: `t${i + 1}`,
          participantRef: "p1",
          sequence: i + 1,
          totalScore: turnDarts.reduce((total, dart) => total + dart.score, 0),
          completedAt: null,
          darts: turnDarts,
        })),
      },
    ],
  };
}

describe("aroundTheClockValidator.validateConfig", () => {
  it("accepts RECREATIONAL + DETAILED_DARTS with the empty config", () => {
    const result = aroundTheClockValidator.validateConfig({
      config: validConfig,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a capture/input mode combination the ruleset does not support", () => {
    const result = aroundTheClockValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a config carrying an unrecognized key (the schema is .strict())", () => {
    const result = aroundTheClockValidator.validateConfig({
      config: { direction: "HIGH_TO_LOW" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });
});

describe("aroundTheClockValidator.validateBatch", () => {
  it("accepts turns carrying dart rows with non-negative scores", () => {
    const result = aroundTheClockValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[hitDart]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts a 1-dart turn (a visit that closed early on a BULL hit)", () => {
    const result = aroundTheClockValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[{ ...hitDart, hitTargetNumber: 25, hitZoneKey: "OUTER_BULL", score: 25 }]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a turn with no dart rows under DETAILED_DARTS capture", () => {
    const result = aroundTheClockValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a dart with a negative score", () => {
    const result = aroundTheClockValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[{ ...hitDart, score: -1 }]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 11: Run test to verify it fails**

Run: `cd app && npx vitest run tests/services/rulesets/around-the-clock/around-the-clock.validator.test.ts`
Expected: FAIL — cannot resolve `@services/rulesets/around-the-clock/around-the-clock.validator`

- [ ] **Step 12: Implement the validator**

Create `app/src/services/rulesets/around-the-clock/around-the-clock.validator.ts`:

```typescript
import { AroundTheClockConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import type {
  BatchValidationResult,
  ConfigValidationResult,
} from "@services/types";

const ALLOWED_CAPTURE_MODE = "RECREATIONAL";
const ALLOWED_INPUT_MODE = "DETAILED_DARTS";

/**
 * Around the Clock is RECREATIONAL + DETAILED_DARTS: its engine emits one
 * dart row per throw, so every turn in a batch must carry at least one and
 * no dart's board score may be negative. A turn can legitimately hold fewer
 * than 3 darts — a BULL hit ends the session immediately, so the visit that
 * completes it can close at 1 or 2 darts.
 */
export const aroundTheClockValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (
      captureModeKey !== ALLOWED_CAPTURE_MODE ||
      inputModeKey !== ALLOWED_INPUT_MODE
    ) {
      return {
        valid: false,
        issues: [
          `Around the Clock V1 only supports ${ALLOWED_CAPTURE_MODE} + ${ALLOWED_INPUT_MODE}`,
        ],
      };
    }
    const parsed = AroundTheClockConfig.safeParse(config);
    if (!parsed.success) {
      return { valid: false, issues: parsed.error.issues };
    }
    return { valid: true, config: parsed.data };
  },

  validateBatch({ batch }): BatchValidationResult {
    for (const stage of batch.stages) {
      for (const turn of stage.turns) {
        if (turn.darts.length === 0) {
          return {
            valid: false,
            code: "VALIDATION_FAILED",
            issues: [
              `turn ${turn.clientKey} must carry dart rows (RECREATIONAL + DETAILED_DARTS)`,
            ],
          };
        }
        for (const dart of turn.darts) {
          if (dart.score < 0) {
            return {
              valid: false,
              code: "VALIDATION_FAILED",
              issues: [
                `turn ${turn.clientKey} dart ${dart.sequence} score must be non-negative`,
              ],
            };
          }
        }
      }
    }

    return { valid: true };
  },
};
```

- [ ] **Step 13: Run validator test to verify it passes**

Run: `cd app && npx vitest run tests/services/rulesets/around-the-clock/around-the-clock.validator.test.ts`
Expected: PASS

- [ ] **Step 14: Register the validator**

In `app/src/services/rulesets/registry.ts`, add the import and registry entry:

```typescript
import { aroundTheClockValidator } from "./around-the-clock/around-the-clock.validator";
import { bobs27Validator } from "./bobs27/bobs27.validator";
import { doublesTrainingValidator } from "./doubles-training/doubles-training.validator";
import { fiveOhOneValidator } from "./five-oh-one/five-oh-one.validator";
import type { RulesetValidator } from "./interfaces";
import { oneTwentyOneValidator } from "./one-twenty-one/one-twenty-one.validator";
import { scoreTrainingValidator } from "./score-training/score-training.validator";
import { shanghaiValidator } from "./shanghai/shanghai.validator";
import { singlesTrainingValidator } from "./singles-training/singles-training.validator";
import { tuodValidator } from "./tuod/tuod.validator";

const REGISTRY: Record<string, RulesetValidator> = {
  SCORE_TRAINING_V1: scoreTrainingValidator,
  BOBS27_V1: bobs27Validator,
  SINGLES_V1: singlesTrainingValidator,
  DOUBLES_TRAINING_V1: doublesTrainingValidator,
  "501_V1": fiveOhOneValidator,
  TUOD_V1: tuodValidator,
  SHANGHAI_V1: shanghaiValidator,
  "121_V1": oneTwentyOneValidator,
  AROUND_THE_CLOCK_V1: aroundTheClockValidator,
};

export function getRulesetValidator(
  rulesetVersionKey: string,
): RulesetValidator | undefined {
  return REGISTRY[rulesetVersionKey];
}
```

### Step group E: seed row for the parity test, and final gate

- [ ] **Step 15: Append the capability row to seed 0007**

In `database/seeds/0007_ruleset_version_capabilities.sql`, add one line to the `VALUES` list (after `('121_V1', 'RECREATIONAL', 'QUICK_SCORE')`):

```sql
            ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SHANGHAI_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('121_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('AROUND_THE_CLOCK_V1', 'RECREATIONAL', 'DETAILED_DARTS')
```

(Note the trailing comma moved off the `121_V1` line onto the new last line — the `VALUES (...) AS declared(...)` list must end without a trailing comma.)

- [ ] **Step 16: Run the full test suite**

Run: `cd app && npm test`
Expected: PASS, including `capabilities.test.ts`, `capability-validator-parity.test.ts`, `capability-seed-parity.test.ts`, the new engine and validator tests

- [ ] **Step 17: Run the game-engines gate**

Run: `bash scripts/check-game-engines.sh`
Expected: exits 0 — `around-the-clock.engine.module.ts` resolves in both `services/rulesets/registry.ts` and `RULESET_CAPABILITIES`

- [ ] **Step 18: Format**

Run: `cd app && npm run format`

- [ ] **Step 19: Commit everything in this task together**

```bash
git add app/src/modules/game/types.ts \
  app/src/modules/game/around-the-clock.engine.module.ts \
  app/tests/modules/game/around-the-clock.engine.module.test.ts \
  app/src/lib/game/rulesets/capabilities.ts \
  app/tests/lib/game/rulesets/capabilities.test.ts \
  app/tests/lib/game/rulesets/capability-validator-parity.test.ts \
  app/src/services/rulesets/around-the-clock/around-the-clock.validator.ts \
  app/tests/services/rulesets/around-the-clock/around-the-clock.validator.test.ts \
  app/src/services/rulesets/registry.ts \
  database/seeds/0007_ruleset_version_capabilities.sql
git commit -m "Add Around the Clock v1 engine, validator, and capability"
```

---

## Task 3: Database seed (game type, ruleset version, preset)

**Files:**
- Create: `database/seeds/0010_around_the_clock_game_engine_reference.sql`
- Create: `database/verification/0010_around_the_clock_capability_checks.sql`
- Modify: `database/README.md`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure SQL, resolved by `implementation_key` at runtime).
- Produces: `game_types` row `AROUND_THE_CLOCK`, `ruleset_versions` row `AROUND_THE_CLOCK_V1`, one `configuration_templates` preset with `configuration: {}` — Task 4's setup flow calls `POST /api/sessions` with `rulesetVersionKey: "AROUND_THE_CLOCK_V1"`, which resolves against this seed.

There is no local PostgreSQL server in this environment (D24/D193) — this task cannot run `npm run db:seed`/`npm run db:verify` here. Write the files correctly against the established pattern and note in the commit message that live verification is pending a real `DATABASE_URL`, exactly as `0008`/`0009` did.

- [ ] **Step 1: Create the seed file**

Create `database/seeds/0010_around_the_clock_game_engine_reference.sql`:

```sql
-- ============================================================
-- Seed: 0010_around_the_clock_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Around the Clock v1: a fixed 21-target
-- path (1..20, then BULL) walked with mid-visit advancement.
-- Without this seed there is no game type, ruleset version, or
-- preset to start a session from — POST /api/sessions has
-- nothing to look up for AROUND_THE_CLOCK_V1.
--
-- UUID allocation (continues the 0003 range, next after 0009's
-- 121 row):
-- - 0198f000-...-000009 game_types              (AROUND_THE_CLOCK)
-- - 0198f100-...-000009 ruleset_versions        (AROUND_THE_CLOCK_V1)
-- - 0198f300-...-000013 configuration_templates (AROUND_THE_CLOCK)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — AroundTheClockConfig is
-- a genuinely empty `.strict()` object: v1 locks every rule
-- (path, any-segment advance, mid-visit advancement, BULL ends
-- the session) with nothing left to configure, so its one
-- preset's configuration is `{}`.
--
-- No game_type_features mapping: v1 is single-player only, and
-- there is no duration_type/duration_value or opponent toggle to
-- configure, mirroring 0008's Shanghai and 0009's 121 reasoning.
--
-- No exercise_templates row: nothing outside this file's own
-- configuration_templates preset currently reads exercise_
-- templates at runtime.
--
-- Capability: AROUND_THE_CLOCK_V1 + RECREATIONAL + DETAILED_DARTS
-- is declared in seeds/0007_ruleset_version_capabilities.sql, not
-- here — 0007 is the single running ledger every ruleset's
-- capability rows are appended to.
-- verification/0010_around_the_clock_capability_checks.sql
-- asserts the resulting row.
-- ============================================================
BEGIN;
-- ============================================================
-- Game type
-- ============================================================
INSERT INTO game_types (
        id,
        implementation_key,
        name,
        description,
        is_published,
        created_at,
        updated_at
    )
VALUES (
        '0198f000-0000-7000-8000-000000000009',
        'AROUND_THE_CLOCK',
        'Around the Clock',
        'Hit every number 1 through 20 in order, then the bull, to finish. A hit advances the target immediately, mid-visit — a great turn can clear several numbers in three darts.',
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Ruleset version
-- ============================================================
INSERT INTO ruleset_versions (
        id,
        game_type_id,
        implementation_key,
        version_number,
        description,
        created_at
    )
VALUES (
        '0198f100-0000-7000-8000-000000000009',
        '0198f000-0000-7000-8000-000000000009',
        'AROUND_THE_CLOCK_V1',
        1,
        'Initial Around the Clock ruleset: path 1-20 then BULL, any segment (single/double/treble) advances immediately, BULL (outer or inner) ends the session.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Configuration preset
-- ============================================================
INSERT INTO configuration_templates (
        id,
        game_type_id,
        player_id,
        name,
        description,
        configuration,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0198f300-0000-7000-8000-000000000013',
        '0198f000-0000-7000-8000-000000000009',
        NULL,
        'Around the Clock — Standard',
        'Full board, 1 through 20 then BULL, any segment advances.',
        '{}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
```

- [ ] **Step 2: Create the verification script**

Create `database/verification/0010_around_the_clock_capability_checks.sql`:

```sql
-- ============================================================
-- Verification: 0010_around_the_clock_capability_checks.sql
--
-- Mirrors 0008_shanghai_capability_checks.sql's and
-- 0009_121_capability_checks.sql's shape, re-scoped for the
-- additive AROUND_THE_CLOCK_V1 row appended to 0007_ruleset_
-- version_capabilities.sql's own VALUES list on top of its prior
-- 11 (0007 is the single running ledger every ruleset's
-- capability rows are appended to). No PostgreSQL server exists
-- in the container that authored this file (D193), so it asserts
-- against a real Neon database before merge:
--
--   1. AROUND_THE_CLOCK_V1 + RECREATIONAL + DETAILED_DARTS
--      resolved through the implementation_key joins
--   2. the table now holds exactly the 12 triples declared
--      across 0007 and this file's history, no more and no fewer
--      (full bidirectional parity with capabilities.ts as of
--      this seed)
--   3. no exercise_sessions row is left undeclared
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0010_around_the_clock_capability_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:seed` has applied seeds/0007 and seeds/0010.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Step 1: AROUND_THE_CLOCK_V1 + RECREATIONAL + DETAILED_DARTS resolved.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'AROUND_THE_CLOCK_V1 / RECREATIONAL / DETAILED_DARTS resolves to a seeded row',
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN NULL
        WHEN rv.id IS NULL THEN 'no ruleset_versions row for AROUND_THE_CLOCK_V1'
        ELSE 'lookups resolved but no matching ruleset_version_capabilities row'
    END
FROM ruleset_versions rv
    LEFT JOIN capture_modes cm ON cm.implementation_key = 'RECREATIONAL'
    LEFT JOIN input_modes im ON im.implementation_key = 'DETAILED_DARTS'
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id
WHERE rv.implementation_key = 'AROUND_THE_CLOCK_V1';

-- ------------------------------------------------------------
-- Step 2: full-table parity — 0007's 11 prior triples plus this
-- file's 1 new one, no more and no fewer.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'table holds exactly the 12 declared triples, no more and no fewer',
    CASE
        WHEN count(*) = 12 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 12, found %s', count(*))
FROM ruleset_version_capabilities c
    JOIN ruleset_versions rv ON rv.id = c.ruleset_version_id
    JOIN capture_modes cm ON cm.id = c.capture_mode_id
    JOIN input_modes im ON im.id = c.input_mode_id
WHERE EXISTS (
        SELECT 1
        FROM (
                VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('SHANGHAI_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('121_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('AROUND_THE_CLOCK_V1', 'RECREATIONAL', 'DETAILED_DARTS')
            ) AS declared(ruleset_key, capture_key, input_key)
        WHERE declared.ruleset_key = rv.implementation_key
            AND declared.capture_key = cm.implementation_key
            AND declared.input_key = im.implementation_key
    );

-- ------------------------------------------------------------
-- Step 3: no live exercise_sessions row is left undeclared.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    'no exercise_sessions row is undeclared',
    CASE
        WHEN undeclared = 0 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of %s session(s) undeclared', undeclared, total)
FROM (
        SELECT count(*) AS total,
            count(*) FILTER (
                WHERE NOT EXISTS (
                        SELECT 1
                        FROM ruleset_version_capabilities c
                        WHERE c.ruleset_version_id = es.ruleset_version_id
                            AND c.capture_mode_id = es.capture_mode_id
                            AND c.input_mode_id = es.input_mode_id
                    )
            ) AS undeclared
        FROM exercise_sessions es
    ) counts;

-- ------------------------------------------------------------
-- Results
-- ------------------------------------------------------------
SELECT step,
    result,
    check_name,
    detail
FROM verification_results
ORDER BY step,
    check_name;

SELECT CASE
        WHEN count(*) FILTER (
            WHERE result = 'FAIL'
        ) = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format(
            '%s OF %s CHECKS FAILED',
            count(*) FILTER (
                WHERE result = 'FAIL'
            ),
            count(*)
        )
    END AS summary
FROM verification_results;

ROLLBACK;
```

- [ ] **Step 3: Update `database/README.md`**

Add to the Seed Order list (after item 9):

```markdown
1. `seeds/0001_reference_data.sql`
2. `seeds/0002_default_templates.sql`
3. `seeds/0003_game_engine_reference.sql`
4. `seeds/0004_score_training_minutes_preset.sql`
5. `seeds/0005_visual_board_input_mode.sql`
6. `seeds/0006_single_band_dart_zones.sql`
7. `seeds/0007_ruleset_version_capabilities.sql`
8. `seeds/0008_shanghai_game_engine_reference.sql`
9. `seeds/0009_121_game_engine_reference.sql`
10. `seeds/0010_around_the_clock_game_engine_reference.sql`
```

Add a row to the verification-script table (after the `0009` row):

```markdown
| `verification/0010_around_the_clock_capability_checks.sql` | `seeds/0010`+`0007` combined: `AROUND_THE_CLOCK_V1`/`RECREATIONAL`/`DETAILED_DARTS` resolves, the table holds exactly the 12 declared triples, zero undeclared `exercise_sessions` (3 checks) |
```

- [ ] **Step 4: Sanity-check the SQL syntax without a live database**

Run: `cd database && for f in seeds/0010_around_the_clock_game_engine_reference.sql verification/0010_around_the_clock_capability_checks.sql; do echo "--- $f ---"; cat "$f" | head -1; done`

This is a smoke check that both files exist and are readable — full syntax and constraint validation happens against a real Neon `dev` branch (no `DATABASE_URL` in this environment, per D193), which the plan cannot run. Note this explicitly rather than claiming verification succeeded.

- [ ] **Step 5: Commit**

```bash
git add database/seeds/0010_around_the_clock_game_engine_reference.sql \
  database/verification/0010_around_the_clock_capability_checks.sql \
  database/README.md
git commit -m "Seed Around the Clock v1 game type, ruleset version, and preset"
```

---

## Task 4: Setup flow

**Files:**
- Modify: `app/src/lib/game/types.ts` (add `AroundTheClockSetupContext`)
- Create: `app/src/lib/game/around-the-clock-setup.data.ts`
- Test: `app/tests/lib/game/around-the-clock-setup.data.test.ts`
- Create: `app/src/components/layout/games/setup/AroundTheClockSetupForm.astro`
- Create: `app/src/pages/games/around-the-clock/setup/index.astro`
- Modify: `app/src/lib/game/rulesets/games-visibility.ts`
- Modify: `app/tests/lib/game/rulesets/games-visibility.test.ts`

**Interfaces:**
- Consumes: `AroundTheClockEngine` is not needed here (setup never touches the engine). `ConfigurationPresetData`, `SessionActiveData`, `resolveSessionModePair`, `startSessionInput`, `toSnapshot`, `reconcileActiveSession` — all pre-existing, imported exactly as Shanghai's setup module does.
- Produces: `aroundTheClockSetup()` Alpine factory, exported for Task 5's page wiring reference and for `register-route-data.ts` (wired in Task 5 alongside play, to keep both registrations in one commit — see Task 5 Step group C). `AroundTheClockSetupContext` type.

- [ ] **Step 1: Add `AroundTheClockSetupContext` to `app/src/lib/game/types.ts`**

Add after `OneTwentyOneSetupContext` (mirrors `ShanghaiSetupContext`/`OneTwentyOneSetupContext` exactly, just renamed):

```typescript
export type AroundTheClockSetupContext = {
  presets: ConfigurationPresetData[];
  loading: boolean;
  error: string;
  activeSession: SessionActiveData | null;
  showActiveSessionModal: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  $store: {
    game: {
      sessionId: string | null;
      startSession(input: unknown): void;
      reset(): void;
    };
    settings: {
      captureModeKey: string;
      inputModeKey: string;
    };
  };
  init(this: AroundTheClockSetupContext): Promise<void>;
  reconcile(
    this: AroundTheClockSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: AroundTheClockSetupContext): Promise<void>;
  continueSession(this: AroundTheClockSetupContext): void;
  abandonSession(this: AroundTheClockSetupContext): Promise<void>;
  start(this: AroundTheClockSetupContext): Promise<void>;
};
```

No test for this step alone — the type is exercised through the setup data test below.

- [ ] **Step 2: Write the failing setup data tests**

Create `app/tests/lib/game/around-the-clock-setup.data.test.ts` (copy `app/tests/lib/game/shanghai-setup.data.test.ts` and do a mechanical rename — `Shanghai` → `AroundTheClock`, `shanghai` → `aroundTheClock`, `SHANGHAI` → `AROUND_THE_CLOCK`, `SHANGHAI_V1` → `AROUND_THE_CLOCK_V1`, `/games/shanghai/` → `/games/around-the-clock/`, `"tmpl-shanghai-standard"` → `"tmpl-around-the-clock-standard"`, `"Shanghai — Standard"` → `"Around the Clock — Standard"`):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { aroundTheClockSetup } from "@lib/game/around-the-clock-setup.data";
import type { AroundTheClockSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const STANDARD_PRESET = {
  configurationTemplateId: "tmpl-around-the-clock-standard",
  gameTypeKey: "AROUND_THE_CLOCK",
  name: "Around the Clock — Standard",
  description: null,
  configuration: {},
  isSystemTemplate: true,
} as any;

describe("aroundTheClockSetup", () => {
  let store: AroundTheClockSetupContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = {
      game: {
        sessionId: null,
        reset: vi.fn(),
        startSession: vi.fn(),
      },
      settings: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    };
  });

  function createSetup(
    overrides: Partial<AroundTheClockSetupContext> = {},
  ): AroundTheClockSetupContext {
    return {
      ...aroundTheClockSetup(),
      $store: store,
      ...overrides,
    } as AroundTheClockSetupContext;
  }

  describe("init", () => {
    it("loads the single seeded preset", async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

      await setup.init();

      expect(presetsApi.fetchConfigurationPresets).toHaveBeenCalledWith(
        "AROUND_THE_CLOCK",
      );
      expect(setup.presets).toEqual([STANDARD_PRESET]);
      expect(setup.loadingReconciliation).toBe(false);
    });

    it("sets a visible error and clears loading when preset/active fetch throws", async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockRejectedValue(
        new Error("Network error"),
      );
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

      await setup.init();

      expect(setup.loadingReconciliation).toBe(false);
      expect(setup.error).toMatch(/connection/i);
      expect(setup.showActiveSessionModal).toBe(false);
    });
  });

  describe("reconciliation", () => {
    it('shows the active-session modal on "match"', async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "match-id", gameTypeKey: "AROUND_THE_CLOCK" } as any,
      ]);
      store.game.sessionId = "match-id";

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toEqual({
        sessionId: "match-id",
        gameTypeKey: "AROUND_THE_CLOCK",
      });
    });

    it('blocks with reconciliationFailed on "abandon_failed"', async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "server-id", gameTypeKey: "AROUND_THE_CLOCK" } as any,
      ]);
      vi.mocked(sessionsApi.completeSession).mockRejectedValue(
        new Error("Network error"),
      );
      store.game.sessionId = "different-local-id";

      await setup.init();

      expect(setup.reconciliationFailed).toBe(true);
      expect(setup.showActiveSessionModal).toBe(false);
      expect(store.game.reset).not.toHaveBeenCalled();
    });
  });

  describe("continueSession / abandonSession", () => {
    it("continueSession navigates to the play page", () => {
      const setup = createSetup({
        activeSession: {
          sessionId: "match-id",
          gameTypeKey: "AROUND_THE_CLOCK",
        } as any,
      });
      const locationSpy = { href: "/games/around-the-clock/setup" };
      vi.stubGlobal("location", locationSpy);

      setup.continueSession();

      expect(locationSpy.href).toBe("/games/around-the-clock/play");
    });

    it("abandons session when user clicks Abandon", async () => {
      const setup = createSetup({
        activeSession: {
          sessionId: "match-id",
          gameTypeKey: "AROUND_THE_CLOCK",
        } as any,
      });
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "match-id",
        statusKey: "ABANDONED",
        completedAt: "2026-08-14T10:00:00Z",
      });

      await setup.abandonSession();

      expect(sessionsApi.completeSession).toHaveBeenCalledWith(
        "match-id",
        "ABANDONED",
      );
      expect(store.game.reset).toHaveBeenCalled();
      expect(setup.showActiveSessionModal).toBe(false);
      expect(setup.loading).toBe(false);
    });
  });

  describe("start", () => {
    it("creates a session from the seeded preset with no overrides and redirects", async () => {
      const setup = createSetup({ presets: [STANDARD_PRESET] });
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
      const locationSpy = { href: "" };
      vi.stubGlobal("location", locationSpy);

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith({
        gameTypeKey: "AROUND_THE_CLOCK",
        rulesetVersionKey: "AROUND_THE_CLOCK_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
        config: {
          source: "template",
          templateRef: "tmpl-around-the-clock-standard",
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-around-the-clock-standard",
          configSnapshot: {},
        }),
      );
      expect(locationSpy.href).toBe("/games/around-the-clock/play");
    });

    it("falls back to Around the Clock's declared pair when settings holds a pair it does not declare", async () => {
      store.settings = {
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
      };
      const setup = createSetup({ presets: [STANDARD_PRESET] });
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
          captureModeKey: "RECREATIONAL",
          inputModeKey: "DETAILED_DARTS",
        }),
      );
    });

    it("errors when no preset is available", async () => {
      const setup = createSetup({ presets: [] });
      await setup.start();
      expect(sessionsApi.createSession).not.toHaveBeenCalled();
      expect(setup.error).toBe("Could not find a preset for Around the Clock.");
    });

    it("re-reconciles into the active-session modal when create reports SESSION_ALREADY_ACTIVE", async () => {
      const setup = createSetup({ presets: [STANDARD_PRESET] });
      vi.mocked(sessionsApi.createSession).mockRejectedValue(
        Object.assign(new Error("already active"), {
          code: "SESSION_ALREADY_ACTIVE",
        }),
      );
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "active-1", gameTypeKey: "AROUND_THE_CLOCK" } as any,
      ]);
      store.game.sessionId = "active-1";

      await setup.start();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toMatchObject({ sessionId: "active-1" });
      expect(setup.loading).toBe(false);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/around-the-clock-setup.data.test.ts`
Expected: FAIL — cannot resolve `@lib/game/around-the-clock-setup.data`

- [ ] **Step 4: Implement the setup data module**

Create `app/src/lib/game/around-the-clock-setup.data.ts`:

```typescript
import {
  fetchConfigurationPresets,
  type ConfigurationPresetData,
} from "@client/api/configuration-templates";
import {
  createSession,
  fetchActiveSessions,
  completeSession,
  type SessionActiveData,
} from "@client/api/sessions";
import { toSnapshot } from "@lib/game/rulesets/config-codec";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import {
  resolveSessionModePair,
  startSessionInput,
} from "@lib/game/session-mode-resolution";
import type { AroundTheClockSetupContext } from "./types";

const GAME_TYPE_KEY = "AROUND_THE_CLOCK";
const RULESET_VERSION_KEY = "AROUND_THE_CLOCK_V1";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function aroundTheClockSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,

    async init(this: AroundTheClockSetupContext) {
      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(GAME_TYPE_KEY),
          fetchActiveSessions(),
        ]);
        this.presets = presets;
        await this.reconcile(activeSessions);
      } catch {
        this.showActiveSessionModal = false;
        this.error =
          "Could not load setup. Check your connection and try again.";
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async reconcile(
      this: AroundTheClockSetupContext,
      activeSessions: SessionActiveData[],
    ) {
      const result = await reconcileActiveSession(
        GAME_TYPE_KEY,
        this.$store.game.sessionId,
        activeSessions,
        this.$store.game,
      );

      if (result.action === "match") {
        this.activeSession = result.activeSession;
        this.showActiveSessionModal = true;
        this.reconciliationFailed = false;
      } else if (result.action === "abandon_failed") {
        this.showActiveSessionModal = false;
        this.reconciliationFailed = true;
      } else {
        this.showActiveSessionModal = false;
        this.reconciliationFailed = false;
      }
    },

    async retryReconciliation(this: AroundTheClockSetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: AroundTheClockSetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/around-the-clock/play";
    },

    async abandonSession(this: AroundTheClockSetupContext) {
      if (!this.activeSession || this.loading) return;
      this.loading = true;
      this.error = "";
      try {
        await completeSession(this.activeSession.sessionId, "ABANDONED");
        this.$store.game.reset();
        this.showActiveSessionModal = false;
        this.activeSession = null;
      } catch {
        this.error = "Could not abandon session. Try again.";
      } finally {
        this.loading = false;
      }
    },

    async start(this: AroundTheClockSetupContext) {
      const preset = this.presets[0];
      if (!preset) {
        this.error = "Could not find a preset for Around the Clock.";
        return;
      }

      this.loading = true;
      this.error = "";
      try {
        const configSnapshot = toSnapshot(
          RULESET_VERSION_KEY,
          preset.configuration,
        );
        const modePair = resolveSessionModePair(
          RULESET_VERSION_KEY,
          this.$store.settings,
        );
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
          },
        });
        this.$store.game.startSession(
          startSessionInput({
            gameTypeKey: GAME_TYPE_KEY,
            rulesetVersionKey: RULESET_VERSION_KEY,
            session,
            templateRef: preset.configurationTemplateId,
            configSnapshot,
            modePair,
          }),
        );
        globalThis.location.href = "/games/around-the-clock/play";
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === "SESSION_ALREADY_ACTIVE") {
          await this.retryReconciliation();
          return;
        }
        this.error = "Could not start the session. Try again.";
      } finally {
        this.loading = false;
      }
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/around-the-clock-setup.data.test.ts`
Expected: PASS

- [ ] **Step 6: Add the setup form component**

Create `app/src/components/layout/games/setup/AroundTheClockSetupForm.astro`:

```astro
---
// Components
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import UserSection from "./UserSection.astro";

// Data
const infoSection = {
  title: "Around the Clock rules",
  description:
    "Hit every number from 1 through 20 in order, then finish on the bull. Any single, double, or treble of the current number counts — a hit advances immediately, so a great turn can clear several numbers in three darts. The bull needs one hit, outer or inner, and ends the session the moment it lands.",
};
---

<SetupShell title="Around the Clock">
  <UserSection />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />

  <p
    class="alert alert-error mt-2 rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>
</SetupShell>
```

- [ ] **Step 7: Add the setup page route**

Create `app/src/pages/games/around-the-clock/setup/index.astro`:

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import Button from "@components/forms/Button.astro";
import ContinueSessionModal from "@components/layout/games/ContinueSessionModal.astro";
import AroundTheClockSetupForm from "@components/layout/games/setup/AroundTheClockSetupForm.astro";
import IsLoading from "@components/ui/IsLoading.astro";
---

<AppLayout title="Around the Clock — Setup">
  <div
    class="p-4"
    x-data="aroundTheClockSetup()"
  >
    <template x-if="showActiveSessionModal && activeSession">
      <ContinueSessionModal gameTitle="Around the Clock" />
    </template>

    <template x-if="reconciliationFailed && !loadingReconciliation">
      <div
        class="alert alert-error mt-2 rounded-md border border-error/40 px-4 py-3 text-center text-sm text-error-foreground"
        role="alert"
      >
        <p>Could not clean up a previous session. Retry to continue.</p>
        <Button
          class="mt-4"
          @click="retryReconciliation()"
          title="Retry"
        />
      </div>
    </template>

    <template
      x-if="!showActiveSessionModal && !reconciliationFailed && !loadingReconciliation"
    >
      <AroundTheClockSetupForm />
    </template>

    <template x-if="loadingReconciliation">
      <IsLoading title="Configuring your session..." />
    </template>
  </div>
</AppLayout>
```

- [ ] **Step 8: Write the failing games-visibility test additions**

In `app/tests/lib/game/rulesets/games-visibility.test.ts`, update the RECREATIONAL list to add `"AROUND_THE_CLOCK_V1"` at the end, and add it to the ANALYTICS `not.toContain` list:

```typescript
  it("shows every carded game under recreational", () => {
    const keys = visibleGames("RECREATIONAL", null).map(
      (game) => game.rulesetVersionKey,
    );
    expect(keys).toEqual([
      "SCORE_TRAINING_V1",
      "501_V1",
      "BOBS27_V1",
      "SINGLES_V1",
      "DOUBLES_TRAINING_V1",
      "SHANGHAI_V1",
      "121_V1",
      "AROUND_THE_CLOCK_V1",
    ]);
  });

  it("shows every carded game that declares an analytics pair, and no others, under analytics", () => {
    const keys = visibleGames("ANALYTICS", null)
      .map((game) => game.rulesetVersionKey)
      .sort();
    expect(keys).toEqual(["501_V1", "BOBS27_V1", "SCORE_TRAINING_V1"]);
    expect(keys).not.toContain("SINGLES_V1");
    expect(keys).not.toContain("DOUBLES_TRAINING_V1");
    expect(keys).not.toContain("SHANGHAI_V1");
    expect(keys).not.toContain("121_V1");
    expect(keys).not.toContain("AROUND_THE_CLOCK_V1");
  });
```

- [ ] **Step 9: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/rulesets/games-visibility.test.ts`
Expected: FAIL — `AROUND_THE_CLOCK_V1` is not in `GAME_CARDS` yet

- [ ] **Step 10: Add the games-visibility card**

In `app/src/lib/game/rulesets/games-visibility.ts`, add to `GAME_CARDS` (after the `121_V1` entry):

```typescript
  {
    rulesetVersionKey: "AROUND_THE_CLOCK_V1",
    href: "/games/around-the-clock/setup",
    title: "Around the Clock",
    caption: "Hit every number in order, then the bull, to finish.",
  },
```

- [ ] **Step 11: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/rulesets/games-visibility.test.ts`
Expected: PASS

- [ ] **Step 12: Run the full suite and format**

Run: `cd app && npm test && npm run format`
Expected: all green

- [ ] **Step 13: Commit**

```bash
git add app/src/lib/game/types.ts \
  app/src/lib/game/around-the-clock-setup.data.ts \
  app/tests/lib/game/around-the-clock-setup.data.test.ts \
  app/src/components/layout/games/setup/AroundTheClockSetupForm.astro \
  app/src/pages/games/around-the-clock/setup/index.astro \
  app/src/lib/game/rulesets/games-visibility.ts \
  app/tests/lib/game/rulesets/games-visibility.test.ts
git commit -m "Add Around the Clock v1 setup flow"
```

---

## Task 5: Play flow

**Files:**
- Modify: `app/src/lib/game/types.ts` (add `AroundTheClockPreviewSegment`, `AroundTheClockResultsSnapshot`, `AroundTheClockPlayContext`; add `AroundTheClockEngine`/`AroundTheClockSnapshot` to the top-of-file imports)
- Create: `app/src/lib/game/around-the-clock-play.data.ts`
- Test: `app/tests/lib/game/around-the-clock-play.data.test.ts`
- Create: `app/src/components/layout/games/interfaces/AroundTheClock.astro`
- Create: `app/src/components/layout/games/result-modals/AroundTheClockResults.astro`
- Create: `app/src/pages/games/around-the-clock/play/index.astro`
- Modify: `app/src/lib/client/alpine/register-route-data.ts`

**Interfaces:**
- Consumes: `AroundTheClockEngine` (Task 2), `aroundTheClockSetup` (Task 4, for `register-route-data.ts`), `play-lifecycle.ts`'s `playInit`/`playRetryReconciliation`/`playCommitDart`/`playUndoVisit`/`playUploadAndCompleteSession`/`playBack`/`playAbandonAndExit`/`runPlayAgain`, `SinglesRecreationalInput.astro`/`VisitPreview.astro` (unmodified, reused as-is).
- Produces: `aroundTheClockPlay()` Alpine factory, `/games/around-the-clock/play` route.

- [ ] **Step 1: Add the play-side types to `app/src/lib/game/types.ts`**

Add `AroundTheClockEngine` to the top-of-file engine imports (after the `OneTwentyOneEngine` import):

```typescript
import type { AroundTheClockEngine } from "@modules/game/around-the-clock.engine.module";
```

Add `AroundTheClockSnapshot` to the snapshot-type import list from `./rulesets/types`:

```typescript
import type {
  ModePair,
  RulesetVersionKey,
  ScoreTrainingSnapshot,
  FiveOhOneSnapshot,
  Bobs27Snapshot,
  SinglesSnapshot,
  DoublesTrainingSnapshot,
  ShanghaiSnapshot,
  OneTwentyOneSnapshot,
  AroundTheClockSnapshot,
} from "./rulesets/types";
```

Add after `ShanghaiPlayContext` (or after `OneTwentyOneSetupContext`/wherever the file's own ordering puts the newest ruleset — match the existing file's convention of appending at the end of the ruleset-context section, immediately before `GamesIndexContext`):

```typescript
/** One dart slot in Around the Clock's visit preview — a resolved hit/miss mark, or a not-yet-thrown placeholder. Unlike Shanghai's preview, hit/miss needs no target-number comparison: every tap this game's input renders is already relative to whatever target was active the instant it was thrown, so a non-MISS dart is always a hit. */
export type AroundTheClockPreviewSegment = {
  status: "hit" | "miss" | "empty";
};

/** `turns` is the number of visits the session took to complete. `hits`/`totalDarts` are folded from the fact log at completion time, never accumulated by the engine. */
export type AroundTheClockResultsSnapshot = {
  turns: number;
  hits: number;
  totalDarts: number;
};

export type AroundTheClockPlayContext = {
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: AroundTheClockResultsSnapshot | null;
  hiddenTurnKey: string | null;
  $store: PlayStoreContext<AroundTheClockSnapshot>;
  engine: AroundTheClockEngine | null;
  currentTargetLabel(this: AroundTheClockPlayContext): string;
  turnsSoFar(this: AroundTheClockPlayContext): string;
  isBullVisit(this: AroundTheClockPlayContext): boolean;
  previewSegments(
    this: AroundTheClockPlayContext,
  ): AroundTheClockPreviewSegment[];
  init(this: AroundTheClockPlayContext): Promise<void>;
  retryReconciliation(this: AroundTheClockPlayContext): Promise<void>;
  recordTap(
    this: AroundTheClockPlayContext,
    ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
  ): Promise<void>;
  commitDart(
    this: AroundTheClockPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  undoVisit(this: AroundTheClockPlayContext): void;
  uploadAndCompleteSession(this: AroundTheClockPlayContext): Promise<void>;
  back(this: AroundTheClockPlayContext): Promise<void>;
  playAgain(this: AroundTheClockPlayContext): Promise<void>;
  abandonAndExit(this: AroundTheClockPlayContext): Promise<void>;
};
```

(Check the exact preceding-type name before pasting — open `app/src/lib/game/types.ts` and confirm where the ruleset-context section actually ends before `GamesIndexContext` at the time this step runs, since Task 4's edit added `AroundTheClockSetupContext` earlier in the same file.)

No isolated test for this step — exercised by the play data test below.

- [ ] **Step 2: Write the failing play data tests**

Create `app/tests/lib/game/around-the-clock-play.data.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@client/api/sessions", () => ({
  appendBatch: vi.fn(),
  completeSession: vi.fn(),
  fetchActiveSessions: vi.fn(),
  createSession: vi.fn(),
}));

import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import {
  registerEngineFactory,
  resetEngineRegistry,
} from "@modules/game/engine.registry";
import { aroundTheClockEngineFactory } from "@modules/game/around-the-clock.engine.module";
import { aroundTheClockPlay } from "@lib/game/around-the-clock-play.data";
import type {
  AroundTheClockSnapshot,
  AroundTheClockPlayContext,
} from "@lib/types";
import type { DartFact, StageFact, TurnFact } from "@modules/types";

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "AROUND_THE_CLOCK",
  gameTypeName: "Around the Clock",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  rulesetVersionKey: "AROUND_THE_CLOCK_V1",
  startedAt: "now",
} as const;

const STAGE: StageFact = {
  clientKey: "block-1",
  stageTypeKey: "EXERCISE_BLOCK",
  parentClientKey: null,
  sequence: 1,
};

function defaultConfig(): AroundTheClockSnapshot {
  return {};
}

/** `n` prior turns, each hitting exactly one number with a SINGLE and closing
 * with 2 misses, so a fresh engine rehydrated from it sits at target index
 * `n` (number `n + 1`), in progress. */
function priorTurnsThroughNumber(n: number): TurnFact[] {
  const turns: TurnFact[] = [];
  for (let number = 1; number <= n; number += 1) {
    const darts: DartFact[] = [
      {
        sequence: 1,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: number,
        hitZoneKey: "SINGLE",
        score: number,
        locationX: null,
        locationY: null,
      },
      {
        sequence: 2,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        score: 0,
        locationX: null,
        locationY: null,
      },
      {
        sequence: 3,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: null,
        hitZoneKey: "MISS",
        score: 0,
        locationX: null,
        locationY: null,
      },
    ];
    turns.push({
      clientKey: `prior-${number}`,
      stageClientKey: "block-1",
      sequence: number,
      completedAt: "2026-08-15T10:00:00.000Z",
      totalScore: number,
      darts,
    });
  }
  return turns;
}

type GameStub = AroundTheClockPlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    rulesetVersionKey: "AROUND_THE_CLOCK_V1",
    sessionId: "s1",
    participantRef: "p1",
    templateRef: "tpl-1",
    configSnapshot: defaultConfig(),
    captureModeKey: "RECREATIONAL",
    inputModeKey: "DETAILED_DARTS",
    stages: [STAGE],
    turns: [],
    idempotencyKey: null,
    loading: false,
    setSessionModes: vi.fn(function (
      this: GameStub,
      modes: { captureModeKey: string; inputModeKey: string },
    ) {
      this.captureModeKey = modes.captureModeKey;
      this.inputModeKey = modes.inputModeKey;
    }),
    recordFacts: vi.fn(function (this: GameStub, facts) {
      this.stages = [...facts.stages];
      this.turns = [...facts.turns];
    }),
    reset: vi.fn(function (this: GameStub) {
      this.loading = false;
    }),
    ...overrides,
  };
}

type SettingsStub = { captureModeKey: string; inputModeKey: string };

function settingsStub(overrides: Partial<SettingsStub> = {}): SettingsStub {
  return {
    captureModeKey: "RECREATIONAL",
    inputModeKey: "DETAILED_DARTS",
    ...overrides,
  };
}

function makePlay(
  gameOverrides: Partial<GameStub> = {},
  settingsOverrides: Partial<SettingsStub> = {},
) {
  return {
    ...aroundTheClockPlay(),
    $store: {
      game: gameStub(gameOverrides),
      settings: settingsStub(settingsOverrides),
    },
  } as AroundTheClockPlayContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(aroundTheClockEngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
});

describe("init", () => {
  it("resumes the engine and mirrors its facts into the store on a match", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.hasActiveSession).toBe(true);
    expect(play.engine).not.toBeNull();
  });

  it("leaves hasActiveSession false when there is no server session for this game", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([]);
    const play = makePlay();
    await play.init.call(play);
    expect(play.hasActiveSession).toBe(false);
    expect(play.engine).toBeNull();
  });
});

describe("currentTargetLabel / turnsSoFar / isBullVisit", () => {
  it("starts at number 1 with zero turns, and isBullVisit is false", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("1");
    expect(play.turnsSoFar.call(play)).toBe("0");
    expect(play.isBullVisit.call(play)).toBe(false);
  });

  it("shows BULL after all 20 numbers are cleared", async () => {
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("BULL");
    expect(play.isBullVisit.call(play)).toBe(true);
    expect(play.turnsSoFar.call(play)).toBe("20");
  });
});

describe("recordTap", () => {
  it("SINGLE advances the target and records a SINGLE dart", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");

    expect(play.currentTargetLabel.call(play)).toBe("2");
    const dart = play.$store.game.turns[0].darts[0];
    expect(dart.hitTargetNumber).toBe(1);
    expect(dart.hitZoneKey).toBe("SINGLE");
    expect(dart.intendedTargetNumber).toBeNull();
    expect(dart.intendedZoneKey).toBeNull();
  });

  it("a hit-then-hit visit clears two numbers in one visit (mid-visit advance)", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "DOUBLE");
    await play.recordTap.call(play, "MISS");

    expect(play.currentTargetLabel.call(play)).toBe("3");
    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].darts).toHaveLength(3);
    expect(play.finished).toBe(false);
  });

  it("MISS adds no advance and still counts toward the 3-dart visit", async () => {
    const play = makePlay();
    await play.init.call(play);

    await play.recordTap.call(play, "MISS");

    expect(play.currentTargetLabel.call(play)).toBe("1");
    expect(play.$store.game.turns[0].darts[0].hitZoneKey).toBe("MISS");
    expect(play.$store.game.turns[0].darts[0].hitTargetNumber).toBeNull();
  });

  it("on the BULL visit, SINGLE taps OUTER_BULL and DOUBLE taps INNER_BULL, and TREBLE is a no-op", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);

    await play.recordTap.call(play, "TREBLE");
    expect(play.$store.game.turns).toHaveLength(20);

    await play.recordTap.call(play, "SINGLE");
    expect(play.finished).toBe(true);
    const lastTurn = play.$store.game.turns.at(-1)!;
    expect(lastTurn.darts).toHaveLength(1);
    expect(lastTurn.darts[0].hitZoneKey).toBe("OUTER_BULL");
    expect(lastTurn.darts[0].hitTargetNumber).toBe(25);
  });
});

describe("session completion on BULL", () => {
  it("ends the session immediately on a BULL hit, even mid-visit", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);

    await play.recordTap.call(play, "DOUBLE");

    expect(play.finished).toBe(true);
    expect(play.resultsSnapshot).toEqual({
      turns: 21,
      hits: 21,
      totalDarts: 61,
    });
    expect(play.completionStatus).toBe("succeeded");
  });
});

describe("undoVisit", () => {
  it("reverts the last dart, restoring the prior target", async () => {
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, "SINGLE");

    play.undoVisit.call(play);

    expect(play.currentTargetLabel.call(play)).toBe("1");
    expect(play.$store.game.turns).toHaveLength(0);
  });
});

describe("previewSegments", () => {
  it("returns empty placeholders before any dart is thrown this visit", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.previewSegments.call(play)).toEqual([
      { status: "empty" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });

  it("marks a non-miss tap as a hit and a MISS tap as a miss, in order", async () => {
    const play = makePlay();
    await play.init.call(play);
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "MISS");

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "empty" },
    ]);
  });
});

describe("back", () => {
  it("resets the store and navigates to /games", async () => {
    const locationSpy = { href: "" };
    vi.stubGlobal("location", locationSpy);
    const play = makePlay();

    await play.back.call(play);

    expect(play.$store.game.reset).toHaveBeenCalled();
    expect(locationSpy.href).toBe("/games");
  });
});

describe("playAgain", () => {
  it("starts a fresh session under the player's current mode pair with no overrides", async () => {
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    play.completionStatus = "succeeded";
    play.finished = true;

    vi.mocked(createSession).mockResolvedValue({
      sessionId: "new-session",
      participants: [
        {
          ref: "new-participant",
          displayName: "Player",
          participantTypeKey: "PLAYER",
        },
      ],
    } as any);

    await play.playAgain.call(play);

    expect(createSession).toHaveBeenCalledWith({
      gameTypeKey: "AROUND_THE_CLOCK",
      rulesetVersionKey: "AROUND_THE_CLOCK_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
      config: { source: "template", templateRef: "tpl-1" },
    });
    expect(play.$store.game.sessionId).toBe("new-session");
    expect(play.$store.game.turns).toEqual([]);
    expect(play.finished).toBe(false);
    expect(play.completionStatus).toBe("pending");
    expect(play.resultsSnapshot).toBeNull();
    expect(play.hasActiveSession).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/around-the-clock-play.data.test.ts`
Expected: FAIL — cannot resolve `@lib/game/around-the-clock-play.data`

- [ ] **Step 4: Implement the play data module**

Create `app/src/lib/game/around-the-clock-play.data.ts`:

```typescript
import { getEngineFactory } from "@modules/game/engine.registry";
import {
  BULL_TARGET_NUMBER,
  numbersPath,
  targetAt,
} from "@modules/game/board-progression.module";
import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playRetryReconciliation,
  playUndoVisit,
  playUploadAndCompleteSession,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
import type { RulesetVersionKey } from "@lib/types";
import type { DartObservation, TurnFact } from "@modules/types";
import type {
  AroundTheClockPlayContext,
  AroundTheClockPreviewSegment,
} from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// aroundTheClockEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { AroundTheClockEngine } from "@modules/game/around-the-clock.engine.module";

const GAME_TYPE_KEY = "AROUND_THE_CLOCK";
const RULESET_VERSION_KEY: RulesetVersionKey = "AROUND_THE_CLOCK_V1";

const EMPTY_SEGMENTS: readonly AroundTheClockPreviewSegment[] = [
  { status: "empty" },
  { status: "empty" },
  { status: "empty" },
];

/**
 * A non-MISS dart is always a hit: this game's tap input always constructs
 * the observation relative to whichever target was active the instant the
 * player tapped (see `recordTap`), so there is no "hit the wrong number"
 * case to detect the way Shanghai's preview does.
 */
function previewSegmentsFor(
  turns: readonly TurnFact[],
  hiddenTurnKey: string | null,
): AroundTheClockPreviewSegment[] {
  const lastTurn = turns.at(-1);
  if (!lastTurn || lastTurn.clientKey === hiddenTurnKey) {
    return [...EMPTY_SEGMENTS];
  }
  return [0, 1, 2].map((i) => {
    const dart = lastTurn.darts[i];
    if (!dart) return { status: "empty" };
    return { status: dart.hitZoneKey === "MISS" ? "miss" : "hit" };
  });
}

function countHits(turns: readonly TurnFact[]): number {
  let hits = 0;
  for (const turn of turns) {
    for (const dart of turn.darts) {
      if (dart.hitZoneKey !== "MISS") hits += 1;
    }
  }
  return hits;
}

function countDarts(turns: readonly TurnFact[]): number {
  return turns.reduce((total, turn) => total + turn.darts.length, 0);
}

function resumeEngine(
  game: AroundTheClockPlayContext["$store"]["game"],
): AroundTheClockEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof AroundTheClockEngine ? engine : null;
}

export function aroundTheClockPlay() {
  return {
    loading: false,
    error: "",
    finished: false,
    hasActiveSession: false,
    loadingReconciliation: false,
    reconciliationFailed: false,
    completionStatus: "pending" as
      "pending" | "saving" | "succeeded" | "failed",
    completionError: "",
    playAgainError: "",
    playAgainLoading: false,
    resultsSnapshot: null as AroundTheClockPlayContext["resultsSnapshot"],
    hiddenTurnKey: null as string | null,
    engine: null as AroundTheClockEngine | null,

    currentTargetLabel(this: AroundTheClockPlayContext): string {
      if (!this.engine) return "";
      const target = targetAt(numbersPath(), this.engine.state().targetIndex);
      return target.kind === "BULL" ? "BULL" : String(target.number);
    },

    turnsSoFar(this: AroundTheClockPlayContext): string {
      return String(this.$store.game.turns.length);
    },

    isBullVisit(this: AroundTheClockPlayContext): boolean {
      if (!this.engine) return false;
      return (
        targetAt(numbersPath(), this.engine.state().targetIndex).kind ===
        "BULL"
      );
    },

    previewSegments(
      this: AroundTheClockPlayContext,
    ): AroundTheClockPreviewSegment[] {
      return previewSegmentsFor(this.$store.game.turns, this.hiddenTurnKey);
    },

    init(this: AroundTheClockPlayContext) {
      return playInit(this, GAME_TYPE_KEY, resumeEngine);
    },

    retryReconciliation(this: AroundTheClockPlayContext) {
      return playRetryReconciliation(this);
    },

    async recordTap(
      this: AroundTheClockPlayContext,
      ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
    ) {
      if (!this.engine || this.finished) return;
      const target = targetAt(numbersPath(), this.engine.state().targetIndex);
      if (target.kind === "BULL" && ring === "TREBLE") return;
      const observation: DartObservation =
        ring === "MISS"
          ? {
              hitTargetNumber: null,
              hitZoneKey: "MISS",
              locationX: null,
              locationY: null,
            }
          : target.kind === "BULL"
            ? {
                hitTargetNumber: BULL_TARGET_NUMBER,
                hitZoneKey: ring === "SINGLE" ? "OUTER_BULL" : "INNER_BULL",
                locationX: null,
                locationY: null,
              }
            : {
                hitTargetNumber: target.number,
                hitZoneKey: ring,
                locationX: null,
                locationY: null,
              };
      await this.commitDart(observation);
    },

    commitDart(this: AroundTheClockPlayContext, observation: DartObservation) {
      return playCommitDart(this, observation);
    },

    undoVisit(this: AroundTheClockPlayContext) {
      playUndoVisit(this);
    },

    uploadAndCompleteSession(this: AroundTheClockPlayContext): Promise<void> {
      const turns = this.$store.game.turns;
      return playUploadAndCompleteSession(this, () => ({
        turns: turns.length,
        hits: countHits(turns),
        totalDarts: countDarts(turns),
      }));
    },

    back(this: AroundTheClockPlayContext) {
      return playBack(this);
    },

    abandonAndExit(this: AroundTheClockPlayContext) {
      return playAbandonAndExit(this);
    },

    playAgain(this: AroundTheClockPlayContext) {
      return runPlayAgain(this, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
        engine instanceof AroundTheClockEngine ? engine : null,
      );
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/around-the-clock-play.data.test.ts`
Expected: PASS

- [ ] **Step 6: Add the play interface component**

Create `app/src/components/layout/games/interfaces/AroundTheClock.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import SinglesRecreationalInput from "@components/layout/games/SinglesRecreationalInput.astro";
import StatRow from "@components/layout/games/StatRow.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
  <SinglePlayerDisplay
    target="currentTargetLabel()"
    class="max-h-2/5 h-full"
  >
    <div
      slot="progress"
      class="mt-2 flex w-full flex-col items-center gap-2 px-4"
    >
      <dl class="w-full space-y-1">
        <StatRow
          label="Turns"
          value="turnsSoFar()"
        />
      </dl>
    </div>
  </SinglePlayerDisplay>

  <p
    class="alert alert-error mx-3 mt-2 rounded-md border border-error/40 px-4 py-3 text-xs text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

  <VisitPreview />

  <SinglesRecreationalInput />
</div>
```

- [ ] **Step 7: Add the results modal**

Create `app/src/components/layout/games/result-modals/AroundTheClockResults.astro`:

```astro
---
import Button from "@components/forms/Button.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import IsLoading from "@components/ui/IsLoading.astro";
---

<div
  class="fixed inset-0 flex items-center justify-center bg-black/50 z-50 w-full"
  x-show="finished"
  x-cloak
>
  <div
    class="glass rounded-lg border border-border bg-surface-raised p-6 shadow-lg max-w-sm"
  >
    <h2 class="font-display text-lg font-semibold text-foreground">
      Session complete
    </h2>

    {/* Stats: shown once the final tallies are known */}
    <dl
      class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
      x-show="completionStatus === 'succeeded' && resultsSnapshot"
      x-cloak
    >
      <StatRow
        label="Turns"
        value="resultsSnapshot?.turns"
      />
      <StatRow
        label="Hits"
        value="resultsSnapshot?.hits"
      />
      <StatRow
        label="Darts thrown"
        value="resultsSnapshot?.totalDarts"
      />
    </dl>

    {/* Completion status */}
    <div class="mt-4">
      <IsLoading
        title="Saving..."
        x-show="completionStatus === 'pending' || completionStatus === 'saving'"
        x-cloak
      />
      <div
        x-show="completionStatus === 'failed'"
        x-cloak
      >
        <p
          class="alert alert-error rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
          role="alert"
          x-text="completionError"
        >
        </p>
        <Button
          class="mt-2"
          @click="uploadAndCompleteSession()"
          title="Retry"
        />
      </div>
    </div>

    {
      /* Play-again failure: separate from completion status, buttons stay enabled */
    }
    <p
      class="alert alert-error mt-2 rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
      role="alert"
      x-text="playAgainError"
      x-show="playAgainError"
      x-cloak
    >
    </p>

    {/* Action buttons: enabled only when completionStatus === 'succeeded' */}
    <div class="mt-6 flex justify-end gap-3">
      <Button
        variant="secondary"
        @click="back()"
        :disabled="completionStatus !== 'succeeded'"
        title="Back to games"
      />
      <Button
        @click="playAgain()"
        :disabled="completionStatus !== 'succeeded' || playAgainLoading"
        title="Play again"
      />
    </div>
  </div>
</div>
```

- [ ] **Step 8: Add the play page route**

Create `app/src/pages/games/around-the-clock/play/index.astro`:

```astro
---
export const prerender = true;
import GameLayout from "@layouts/GameLayout.astro";
import AroundTheClock from "@components/layout/games/interfaces/AroundTheClock.astro";
import AroundTheClockResults from "@components/layout/games/result-modals/AroundTheClockResults.astro";
import NoSessionPanel from "@components/layout/games/NoSessionPanel.astro";
import ReconciliationBlocked from "@components/layout/games/ReconciliationBlocked.astro";
---

<GameLayout
  title="Around the Clock — Play"
  gameTitle="AROUND_THE_CLOCK"
>
  <div
    class="flex flex-col flex-1 min-h-0 p-3"
    x-data="aroundTheClockPlay()"
    @confirm-exit.window="abandonAndExit()"
  >
    {/* Loading / reconciliation-blocked */}
    <ReconciliationBlocked />

    {/* No active session view */}
    <NoSessionPanel href="/games/around-the-clock/setup" />

    {/* Gameplay view */}
    <AroundTheClock
      x-show="!finished && hasActiveSession"
      x-cloak
    />

    {/* Results modal (overlay) */}
    <AroundTheClockResults />
  </div>
</GameLayout>
```

- [ ] **Step 9: Wire both setup and play into `register-route-data.ts`**

In `app/src/lib/client/alpine/register-route-data.ts`, add the imports (after the `oneTwentyOnePlay` import) and registrations (after `Alpine.data("oneTwentyOnePlay", oneTwentyOnePlay);`):

```typescript
import type { Alpine } from "alpinejs";
import { loginForm } from "@auth/login.data";
import { scoreTrainingSetup } from "@lib/game/score-training-setup.data";
import { scoreTrainingPlay } from "@lib/game/score-training-play.data";
import { fiveOhOneSetup } from "@lib/game/five-oh-one-setup.data";
import { fiveOhOnePlay } from "@lib/game/five-oh-one-play.data";
import { bobs27Setup } from "@lib/game/bobs27-setup.data";
import { bobs27Play } from "@lib/game/bobs27-play.data";
import { singlesTrainingSetup } from "@lib/game/singles-training-setup.data";
import { singlesTrainingPlay } from "@lib/game/singles-training-play.data";
import { doublesTrainingSetup } from "@lib/game/doubles-training-setup.data";
import { doublesTrainingPlay } from "@lib/game/doubles-training-play.data";
import { shanghaiSetup } from "@lib/game/shanghai-setup.data";
import { shanghaiPlay } from "@lib/game/shanghai-play.data";
import { oneTwentyOneSetup } from "@lib/game/one-twenty-one-setup.data";
import { oneTwentyOnePlay } from "@lib/game/one-twenty-one-play.data";
import { aroundTheClockSetup } from "@lib/game/around-the-clock-setup.data";
import { aroundTheClockPlay } from "@lib/game/around-the-clock-play.data";
import { gamesIndex } from "@lib/game/games-index.data";

export function registerRouteData(Alpine: Alpine) {
  Alpine.data("loginForm", loginForm);
  Alpine.data("gamesIndex", gamesIndex);
  Alpine.data("scoreTrainingSetup", scoreTrainingSetup);
  Alpine.data("scoreTrainingPlay", scoreTrainingPlay);
  Alpine.data("fiveOhOneSetup", fiveOhOneSetup);
  Alpine.data("fiveOhOnePlay", fiveOhOnePlay);
  Alpine.data("bobs27Setup", bobs27Setup);
  Alpine.data("bobs27Play", bobs27Play);
  Alpine.data("singlesTrainingSetup", singlesTrainingSetup);
  Alpine.data("singlesTrainingPlay", singlesTrainingPlay);
  Alpine.data("doublesTrainingSetup", doublesTrainingSetup);
  Alpine.data("doublesTrainingPlay", doublesTrainingPlay);
  Alpine.data("shanghaiSetup", shanghaiSetup);
  Alpine.data("shanghaiPlay", shanghaiPlay);
  Alpine.data("oneTwentyOneSetup", oneTwentyOneSetup);
  Alpine.data("oneTwentyOnePlay", oneTwentyOnePlay);
  Alpine.data("aroundTheClockSetup", aroundTheClockSetup);
  Alpine.data("aroundTheClockPlay", aroundTheClockPlay);
}
```

- [ ] **Step 10: Run the full suite**

Run: `cd app && npm test`
Expected: PASS, all files including `astro check`-relevant type wiring

- [ ] **Step 11: Run `astro check`**

Run: `cd app && npx astro check`
Expected: 0 errors, 0 warnings — this catches any Astro-component prop mismatch (`SinglePlayerDisplay`'s `target` prop, `GameLayout`'s `gameTitle` prop, etc.)

- [ ] **Step 12: Format**

Run: `cd app && npm run format`

- [ ] **Step 13: Commit**

```bash
git add app/src/lib/game/types.ts \
  app/src/lib/game/around-the-clock-play.data.ts \
  app/tests/lib/game/around-the-clock-play.data.test.ts \
  app/src/components/layout/games/interfaces/AroundTheClock.astro \
  app/src/components/layout/games/result-modals/AroundTheClockResults.astro \
  app/src/pages/games/around-the-clock/play/index.astro \
  app/src/lib/client/alpine/register-route-data.ts
git commit -m "Add Around the Clock v1 play flow"
```

---

## After all tasks: mandatory context maintenance

Per root `CLAUDE.md`, run the `context-maintenance` skill before claiming this feature done — it updates `docs/architecture/00-Context-Map.md`'s File Inventory and version-history note, checks whether any `decisions/**` entry is warranted (likely none — this reuses Pattern 18, D196, and the `SinglesRecreationalInput.astro` reuse precedent with no new architectural pattern), and runs the mechanical gate scripts. Also run the `run-all-gates` skill (touches `app/` and `database/`) and `validate-app` skill's procedure — note explicitly that `db:status`/`db:migrate`/`db:introspect`/`db:seed`/`db:verify` cannot run in this container (no `DATABASE_URL`, D193), flag rather than claim.
