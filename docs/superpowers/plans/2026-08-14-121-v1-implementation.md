# 121 V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship v1 of the "121" darts game — a single-player X01-style checkout ladder from 121 to 170, 3 visits (9 darts) per attempt, double-out, fail-rule "stay" — end to end: engine, server validator, DB seed, and frontend.

**Architecture:** Mirrors 501's engine shape (visit-total quick-score input, standard bust matrix, one persisted stage per attempt) with TUOD's climbing-ladder idea (success climbs the target, failure resets the attempt) grafted on. Uses the previously-unused `ROUND` stage type, one per attempt. Frontend mirrors 501's setup/play data architecture (bespoke double-confirm dialogs, not `play-lifecycle.ts`, which only supports dart-observation input) with Shanghai's zero-settings setup form as the config precedent (121's config is a genuinely empty `.strict()` schema).

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Zod, PostgreSQL (Neon), Vitest.

**Design clarification (not fully spelled out in the spec):** The spec's illustrative `OneTwentyOneState` sketch omits a running "remaining score within the attempt" field. A pure per-visit reducer needs one (exactly why `FiveOhOneState.remainingScore` exists) — so this plan adds `remainingInAttempt` to the state, folded from facts like everything else, never persisted. The interface's hero number is this live countdown (mirrors 501's `remainingScore` hero exactly), with the ladder position (`currentTarget`) shown as a stat row — this is the natural reading of the spec's "current target, hero" phrase given 121's closest precedent is 501.

## Global Constraints

- Store facts; statistics live in views/derived folds only — never persisted (root `CLAUDE.md` Hard Invariant).
- IDs: UUIDv7 for domain entities (n/a here — no runtime rows created by this plan), SMALLINT for seeded lookups (n/a). Seed UUIDs below are deterministic literals following the existing `0198f0/f1/f3` allocation convention.
- Never modify applied migrations. This plan adds no migration — 121 is seed-only (no new schema).
- A new engine's `rulesetVersionKey` and its server-side validator must land in the same commit (`app/CLAUDE.md`, 2026-08-14) — `scripts/check-game-engines.sh` runs pre-commit and rejects one without the other. It also requires the key to already exist in `RULESET_CAPABILITIES` (`capabilities.ts`) at commit time, and the `RulesetVersionKey` union change forces `capabilities.ts` to compile — so in practice the config schema, capability declaration, engine, and validator are one atomic wiring step (Task 2 below).
- `app/CLAUDE.md`: no `//`/`/* */` comments inside function bodies; JSDoc above declarations only. No `class:list`; `cn()` only. Semantic tokens only. Reuse `components/forms/Button.astro` for actions.
- Tests live under `app/tests/`, mirroring `app/src/`'s structure — never colocated.
- `npm run format` before any commit that touches `app/`.
- `bash scripts/check-game-engines.sh` must pass after Task 2.
- Context Maintenance (root `CLAUDE.md`) is mandatory before claiming the task done — Task 6 runs it.

---

## Task 1: Ruleset config schema + capability declaration

**Files:**
- Modify: `app/src/lib/game/rulesets/types.ts`
- Modify: `app/src/lib/game/rulesets/capabilities.ts`

**Interfaces:**
- Produces: `OneTwentyOneConfig` (Zod schema), `OneTwentyOneConfigData`, `OneTwentyOneSnapshot` (type `Record<string, never>`), `RulesetVersionKey` gains `"121_V1"`, `RULESET_CONFIGS["121_V1"]`, `ConfigSnapshotFor<"121_V1">` resolves to `OneTwentyOneSnapshot`, `RULESET_CAPABILITIES["121_V1"] = [QUICK_SCORE]`.
- Consumes: nothing new — pure additions to existing exported maps/unions.

This task alone leaves `capability-validator-parity.test.ts` and `capability-seed-parity.test.ts` red (121_V1 now appears in `RULESET_CAPABILITIES` with no validator/seed yet) — expected, fixed by Task 2's commit which follows immediately. `npm run validate:app`'s typecheck stays green because `RulesetVersionKey`, `RULESET_CONFIGS` and `RULESET_CAPABILITIES` are updated together in this one task.

- [ ] **Step 1: Add the config schema to `app/src/lib/game/rulesets/types.ts`**

Add after `ShanghaiConfig` (around line 163):

```ts
/**
 * 121 v1 locks every rule (start target, cap, dart budget, fail rule) with
 * nothing left to configure — a genuinely empty `.strict()` object, exactly
 * like `ShanghaiConfig`. A future version that adds a selectable dart budget
 * or fail-rule severity widens this schema then.
 */
export const OneTwentyOneConfig = z.object({}).strict();
```

Extend the `RulesetVersionKey` union (around line 165):

```ts
export type RulesetVersionKey =
  | "SCORE_TRAINING_V1"
  | "BOBS27_V1"
  | "SINGLES_V1"
  | "DOUBLES_TRAINING_V1"
  | "501_V1"
  | "TUOD_V1"
  | "SHANGHAI_V1"
  | "121_V1";
```

Extend `RULESET_CONFIGS` (around line 174):

```ts
export const RULESET_CONFIGS: Record<RulesetVersionKey, z.ZodTypeAny> = {
  SCORE_TRAINING_V1: ScoreTrainingConfig,
  BOBS27_V1: Bobs27Config,
  SINGLES_V1: SinglesConfig,
  DOUBLES_TRAINING_V1: DoublesTrainingConfig,
  "501_V1": FiveOhOneConfig,
  TUOD_V1: TuodConfig,
  SHANGHAI_V1: ShanghaiConfig,
  "121_V1": OneTwentyOneConfig,
};
```

Add the snapshot type after `ShanghaiSnapshot` (around line 238):

```ts
/** 121 v1 has nothing to configure — no fields to carry. */
export type OneTwentyOneSnapshot = Record<string, never>;
```

Extend `ConfigSnapshotFor` (around line 240):

```ts
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
                : OneTwentyOneSnapshot;
```

- [ ] **Step 2: Declare the capability in `app/src/lib/game/rulesets/capabilities.ts`**

```ts
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
};
```

- [ ] **Step 3: Typecheck**

Run: `cd app && npx astro check`
Expected: no new errors (the two parity tests are Vitest, not typecheck — they fail under `npm test`, which is expected and fixed in Task 2).

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/game/rulesets/types.ts app/src/lib/game/rulesets/capabilities.ts
git commit -m "feat(121): add ruleset config schema and capability declaration"
```

---

## Task 2: 121 game engine, server validator, and database wiring (one commit)

This is one task ending in one commit because `scripts/check-game-engines.sh` (pre-commit) rejects an engine module naming a `rulesetVersionKey` that isn't already registered in both `services/rulesets/registry.ts` and `RULESET_CAPABILITIES` — so the engine and its validator cannot land separately. The DB seed is folded in too so `capability-seed-parity.test.ts` (which compares `capabilities.ts` against the seed file) is green the moment this commit lands.

**Files:**
- Modify: `app/src/modules/game/types.ts` (add `OneTwentyOneVisitInput`, `OneTwentyOneVisitOutcome`, `OneTwentyOneState`)
- Create: `app/src/modules/game/one-twenty-one.engine.module.ts`
- Test: `app/tests/modules/game/one-twenty-one.engine.module.test.ts`
- Create: `app/src/services/rulesets/one-twenty-one/one-twenty-one.validator.ts`
- Test: `app/tests/services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts`
- Modify: `app/src/services/rulesets/registry.ts`
- Modify: `app/tests/lib/game/rulesets/capability-validator-parity.test.ts`
- Modify: `database/seeds/0007_ruleset_version_capabilities.sql`
- Create: `database/seeds/0009_121_game_engine_reference.sql`
- Create: `database/verification/0009_121_capability_checks.sql`

**Interfaces:**
- Consumes: `OneTwentyOneSnapshot`, `OneTwentyOneConfig` from `@lib/types` (Task 1). `GameEngine<TInput, TState>` / `GameEngineFactory` from `./interfaces`. `RulesetValidator` from `@services/interfaces`. `isQuickScoreCapture`, `QUICK_SCORE_MODES`, `validateQuickScoreTurns` from `../quick-score.validator`.
- Produces: `initialOneTwentyOneState()`, `applyOneTwentyOneVisit(state, input)`, `OneTwentyOneEngine` class, `oneTwentyOneEngineFactory`, `oneTwentyOneValidator`. Later tasks (frontend) import `OneTwentyOneEngine`, `oneTwentyOneEngineFactory` from `@modules/game/one-twenty-one.engine.module`.

### Step 1: Add engine-level types

Add to `app/src/modules/game/types.ts`, after the `FiveOhOneState` block (around line 100), following that block's own doc-comment style:

```ts
/**
 * One 121 visit as the player reports it — a visit total plus whether the
 * finishing dart landed in a double, exactly like `FiveOhOneVisitInput`. 121
 * is quick-score only in v1, so there is no dart-observation variant.
 */
export type OneTwentyOneVisitInput = {
  scoreAttempted: number;
  finishedOnDouble?: boolean;
};

/**
 * What one visit did to the attempt it was thrown in. `scored` is what the
 * turn records — 0 for a bust, so the attempted value is never persisted as a
 * turn total and a bust can never move `remainingInAttempt`.
 */
export type OneTwentyOneVisitOutcome = {
  isBust: boolean;
  scored: number;
  checkedOut: boolean;
  remainingAfter: number;
};

/**
 * 121 session state. `currentTarget` is the ladder position (121..170).
 * `remainingInAttempt` is the live countdown within the open attempt — reset
 * to `currentTarget` whenever a new attempt starts, exactly like
 * `FiveOhOneState.remainingScore` resets to `startingScore` per leg.
 * `visitsThisAttempt` counts visits used in the open attempt (0..2 while
 * in progress — it resets the instant the 3rd resolves). All three are folds
 * over the fact log, never accumulated fields.
 */
export type OneTwentyOneState = {
  currentTarget: number;
  remainingInAttempt: number;
  visitsThisAttempt: number;
  status: "IN_PROGRESS" | "WON";
};
```

- [ ] **Step 2: Write the failing engine tests**

Create `app/tests/modules/game/one-twenty-one.engine.module.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  applyOneTwentyOneVisit,
  OneTwentyOneEngine,
  oneTwentyOneEngineFactory,
  initialOneTwentyOneState,
} from "@modules/game/one-twenty-one.engine.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import type { GameEngine } from "@modules/interfaces";
import type { OneTwentyOneState, OneTwentyOneVisitInput } from "@modules/types";
import type { OneTwentyOneSnapshot } from "@lib/types";

const config = () => ({}) satisfies OneTwentyOneSnapshot;

type OneTwentyOneGameEngine = GameEngine<
  OneTwentyOneVisitInput,
  OneTwentyOneState
>;

/** Plays 3 clean overshoot busts at whatever target the engine is on. */
function bustAttempt(engine: OneTwentyOneGameEngine): OneTwentyOneState {
  engine.record({ scoreAttempted: 60 });
  engine.record({ scoreAttempted: 60 });
  return engine.record({ scoreAttempted: 60 });
}

describe("oneTwentyOneEngineFactory", () => {
  it("registers itself under 121_V1", () => {
    expect(oneTwentyOneEngineFactory.rulesetVersionKey).toBe("121_V1");
    expect(getEngineFactory("121_V1")).toBe(oneTwentyOneEngineFactory);
  });

  it("builds a OneTwentyOneEngine bound to the ruleset version", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    expect(engine).toBeInstanceOf(OneTwentyOneEngine);
    expect(engine.rulesetVersionKey).toBe("121_V1");
  });
});

describe("initialOneTwentyOneState", () => {
  it("starts at 121 with a fresh budget", () => {
    expect(initialOneTwentyOneState()).toEqual({
      currentTarget: 121,
      remainingInAttempt: 121,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    });
  });
});

describe("applyOneTwentyOneVisit — legal reduction", () => {
  it("subtracts the visit score, stays in progress, and counts the visit", () => {
    const next = applyOneTwentyOneVisit(initialOneTwentyOneState(), {
      scoreAttempted: 45,
    });
    expect(next.remainingInAttempt).toBe(76);
    expect(next.currentTarget).toBe(121);
    expect(next.visitsThisAttempt).toBe(1);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("ignores a finish flag on a visit that does not reach zero", () => {
    const state: OneTwentyOneState = {
      currentTarget: 130,
      remainingInAttempt: 100,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    };
    const next = applyOneTwentyOneVisit(state, {
      scoreAttempted: 60,
      finishedOnDouble: true,
    });
    expect(next.remainingInAttempt).toBe(40);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("throws on a negative score", () => {
    expect(() =>
      applyOneTwentyOneVisit(initialOneTwentyOneState(), {
        scoreAttempted: -1,
      }),
    ).toThrow(/0 and 180/);
  });

  it("throws above the 3-dart maximum of 180", () => {
    expect(() =>
      applyOneTwentyOneVisit(initialOneTwentyOneState(), {
        scoreAttempted: 181,
      }),
    ).toThrow(/0 and 180/);
  });

  it("throws on a non-integer score", () => {
    expect(() =>
      applyOneTwentyOneVisit(initialOneTwentyOneState(), {
        scoreAttempted: 60.5,
      }),
    ).toThrow(/0 and 180/);
  });
});

describe("applyOneTwentyOneVisit — bust matrix", () => {
  const at = (remainingInAttempt: number): OneTwentyOneState => ({
    currentTarget: 121,
    remainingInAttempt,
    visitsThisAttempt: 0,
    status: "IN_PROGRESS",
  });

  it("busts on an overshoot and leaves the remaining score unchanged", () => {
    const next = applyOneTwentyOneVisit(at(40), { scoreAttempted: 50 });
    expect(next.remainingInAttempt).toBe(40);
    expect(next.visitsThisAttempt).toBe(1);
  });

  it("busts when the visit would leave exactly 1", () => {
    const next = applyOneTwentyOneVisit(at(41), { scoreAttempted: 40 });
    expect(next.remainingInAttempt).toBe(41);
  });

  it("treats a visit that would leave exactly 2 as a legal reduction", () => {
    const next = applyOneTwentyOneVisit(at(42), { scoreAttempted: 40 });
    expect(next.remainingInAttempt).toBe(2);
    expect(next.status).toBe("IN_PROGRESS");
  });

  it("busts when the visit reaches zero but no finish was declared", () => {
    const next = applyOneTwentyOneVisit(at(40), { scoreAttempted: 40 });
    expect(next.remainingInAttempt).toBe(40);
  });
});

describe("applyOneTwentyOneVisit — checkout climbs the ladder", () => {
  it("climbs the target by one and resets the budget on a sub-cap checkout", () => {
    const state: OneTwentyOneState = {
      currentTarget: 121,
      remainingInAttempt: 40,
      visitsThisAttempt: 1,
      status: "IN_PROGRESS",
    };
    const next = applyOneTwentyOneVisit(state, {
      scoreAttempted: 40,
      finishedOnDouble: true,
    });
    expect(next).toEqual({
      currentTarget: 122,
      remainingInAttempt: 122,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    });
  });

  it("wins the session on a checkout at the cap target (170)", () => {
    const state: OneTwentyOneState = {
      currentTarget: 170,
      remainingInAttempt: 40,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    };
    const next = applyOneTwentyOneVisit(state, {
      scoreAttempted: 40,
      finishedOnDouble: true,
    });
    expect(next).toEqual({
      currentTarget: 170,
      remainingInAttempt: 0,
      visitsThisAttempt: 0,
      status: "WON",
    });
  });

  it("busts when the finishing dart was not a double, at any target", () => {
    const state: OneTwentyOneState = {
      currentTarget: 170,
      remainingInAttempt: 40,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    };
    const next = applyOneTwentyOneVisit(state, {
      scoreAttempted: 40,
      finishedOnDouble: false,
    });
    expect(next.status).toBe("IN_PROGRESS");
    expect(next.currentTarget).toBe(170);
    expect(next.remainingInAttempt).toBe(40);
  });
});

describe("applyOneTwentyOneVisit — fail rule (v1: stay)", () => {
  it("resets the attempt at the same target after a 3rd-visit bust", () => {
    const state: OneTwentyOneState = {
      currentTarget: 130,
      remainingInAttempt: 30,
      visitsThisAttempt: 2,
      status: "IN_PROGRESS",
    };
    const next = applyOneTwentyOneVisit(state, { scoreAttempted: 40 });
    expect(next).toEqual({
      currentTarget: 130,
      remainingInAttempt: 130,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    });
  });

  it("resets the attempt after a 3rd visit that scores but does not check out", () => {
    const state: OneTwentyOneState = {
      currentTarget: 130,
      remainingInAttempt: 50,
      visitsThisAttempt: 2,
      status: "IN_PROGRESS",
    };
    const next = applyOneTwentyOneVisit(state, { scoreAttempted: 10 });
    expect(next).toEqual({
      currentTarget: 130,
      remainingInAttempt: 130,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    });
  });
});

describe("applyOneTwentyOneVisit — terminal state guard", () => {
  it("throws when called on a state that is already WON", () => {
    const wonState: OneTwentyOneState = {
      currentTarget: 170,
      remainingInAttempt: 0,
      visitsThisAttempt: 0,
      status: "WON",
    };
    expect(() =>
      applyOneTwentyOneVisit(wonState, { scoreAttempted: 20 }),
    ).toThrow();
  });
});

describe("OneTwentyOneEngine — record", () => {
  it("rejects an impossible visit score instead of inflating the total", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    expect(() => engine.record({ scoreAttempted: -1 })).toThrow(/0 and 180/);
    expect(() => engine.record({ scoreAttempted: 181 })).toThrow(/0 and 180/);
    expect(engine.state().remainingInAttempt).toBe(121);
    expect(engine.facts().turns).toHaveLength(0);
  });

  it("requires the finishing dart to be a double", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 81 });
    const busted = engine.record({
      scoreAttempted: 40,
      finishedOnDouble: false,
    });
    expect(busted.status).toBe("IN_PROGRESS");
    expect(engine.state().remainingInAttempt).toBe(40);
    expect(engine.facts().turns.at(-1)?.totalScore).toBe(0);
  });

  it("climbs the ladder on checkout and opens a new ROUND stage", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 81 });
    const won = engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    expect(won.currentTarget).toBe(122);
    expect(engine.facts().stages).toHaveLength(2);
    expect(engine.facts().stages[1].stageTypeKey).toBe("ROUND");
  });

  it("opens a new ROUND stage after a fail-rule reset, at the same target", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    const after = bustAttempt(engine);
    expect(after.currentTarget).toBe(121);
    expect(after.remainingInAttempt).toBe(121);
    expect(engine.facts().stages).toHaveLength(2);
    expect(engine.facts().turns.filter((t) => t.stageClientKey === "round-1")).toHaveLength(3);
  });

  it("wins the whole session on a checkout at 170 and refuses further visits", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    for (let target = 121; target < 170; target += 1) {
      engine.record({ scoreAttempted: 2, finishedOnDouble: true });
    }
    const won = engine.record({ scoreAttempted: 2, finishedOnDouble: true });
    expect(won.status).toBe("WON");
    expect(engine.isComplete()).toBe(true);
    expect(() => engine.record({ scoreAttempted: 2 })).toThrow();
  });

  it("rehydrates mid-attempt from persisted facts", () => {
    const first = oneTwentyOneEngineFactory.create(config());
    first.record({ scoreAttempted: 60 });
    const resumed = oneTwentyOneEngineFactory.create(config(), first.facts());
    expect(resumed.state().remainingInAttempt).toBe(61);
    expect(resumed.state().visitsThisAttempt).toBe(1);
  });
});

describe("OneTwentyOneEngine.wouldComplete", () => {
  it("is true only for a checkout at the cap target", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    for (let target = 121; target < 170; target += 1) {
      engine.record({ scoreAttempted: 2, finishedOnDouble: true });
    }
    expect(
      engine.wouldComplete({ scoreAttempted: 2, finishedOnDouble: true }),
    ).toBe(true);
    expect(
      engine.wouldComplete({ scoreAttempted: 2, finishedOnDouble: false }),
    ).toBe(false);
  });

  it("is false for an ordinary scoring visit and for an already-complete session", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    expect(engine.wouldComplete({ scoreAttempted: 60 })).toBe(false);

    for (let target = 121; target < 170; target += 1) {
      engine.record({ scoreAttempted: 2, finishedOnDouble: true });
    }
    engine.record({ scoreAttempted: 2, finishedOnDouble: true });
    expect(
      engine.wouldComplete({ scoreAttempted: 2, finishedOnDouble: true }),
    ).toBe(false);
  });

  it("does not mutate the fact log or the derived state", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    const factsBefore = engine.facts();
    const stateBefore = engine.state();
    engine.wouldComplete({ scoreAttempted: 121, finishedOnDouble: true });
    expect(engine.facts()).toEqual(factsBefore);
    expect(engine.state()).toEqual(stateBefore);
  });
});

describe("OneTwentyOneEngine.undo", () => {
  it("returns false when there is nothing to undo", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    expect(engine.undo()).toBe(false);
  });

  it("is an exact inverse of record over facts() for a visit inside an attempt", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 60 });
    const before = engine.facts();

    engine.record({ scoreAttempted: 20 });
    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
    expect(engine.state().remainingInAttempt).toBe(61);
  });

  it("is an exact inverse for the visit that checked out and opened the next round", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 81 });
    const before = engine.facts();

    engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    expect(engine.facts().stages).toHaveLength(2);

    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
    expect(engine.state()).toEqual({
      currentTarget: 121,
      remainingInAttempt: 40,
      visitsThisAttempt: 1,
      status: "IN_PROGRESS",
    });
  });

  it("is an exact inverse for the 3rd-visit fail-rule reset", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 60 });
    engine.record({ scoreAttempted: 60 });
    const before = engine.facts();

    engine.record({ scoreAttempted: 60 });
    expect(engine.facts().stages).toHaveLength(2);

    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
    expect(engine.facts().stages).toHaveLength(1);
  });

  it("is an exact inverse for the visit that won the whole session", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    for (let target = 121; target < 170; target += 1) {
      engine.record({ scoreAttempted: 2, finishedOnDouble: true });
    }
    const before = engine.facts();

    engine.record({ scoreAttempted: 2, finishedOnDouble: true });
    expect(engine.isComplete()).toBe(true);

    expect(engine.undo()).toBe(true);
    expect(engine.facts()).toEqual(before);
    expect(engine.isComplete()).toBe(false);
  });

  it("never emits a turn whose stage is missing, so the events batch builds", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    engine.record({ scoreAttempted: 81 });
    engine.record({ scoreAttempted: 40, finishedOnDouble: true });
    engine.record({ scoreAttempted: 60 });

    const batch = buildEventsBatch("participant-1", engine.facts());
    expect(batch.stages).toHaveLength(2);
    expect(batch.stages[0].turns).toHaveLength(2);
    expect(batch.stages[1].turns).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run the engine tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/game/one-twenty-one.engine.module'`.

- [ ] **Step 4: Implement the engine module**

Create `app/src/modules/game/one-twenty-one.engine.module.ts`:

```ts
import type { OneTwentyOneSnapshot } from "@lib/types";
import { newClientKey } from "./client-key.module";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  EngineFacts,
  OneTwentyOneState,
  OneTwentyOneVisitInput,
  OneTwentyOneVisitOutcome,
  StageFact,
  TurnFact,
} from "./types";

const START_TARGET = 121;
const CAP_TARGET = 170;
const VISITS_PER_ATTEMPT = 3;
const MAX_VISIT_SCORE = 180;

/**
 * Builds the `ROUND` stage for attempt `sequence`. Rounds are root stages —
 * 121 has no enclosing MATCH or SET stage, so every round's `parentClientKey`
 * is null and its `sequence` is its position in the session.
 */
function roundStage(sequence: number): StageFact {
  return {
    clientKey: `round-${sequence}`,
    stageTypeKey: "ROUND",
    parentClientKey: null,
    sequence,
  };
}

function cloneTurns(turns: readonly TurnFact[]): TurnFact[] {
  return turns.map((turn) => ({ ...turn, darts: [...turn.darts] }));
}

/** A visit score is playable only as a whole number in `0..180`. */
function isPlayableVisitScore(scoreAttempted: number): boolean {
  return (
    Number.isInteger(scoreAttempted) &&
    scoreAttempted >= 0 &&
    scoreAttempted <= MAX_VISIT_SCORE
  );
}

export function initialOneTwentyOneState(): OneTwentyOneState {
  return {
    currentTarget: START_TARGET,
    remainingInAttempt: START_TARGET,
    visitsThisAttempt: 0,
    status: "IN_PROGRESS",
  };
}

/**
 * Resolves one visit against the remaining score of the attempt in play,
 * under the same bust matrix 501 uses: an overshoot busts; leaving exactly 1
 * busts because 1 cannot be finished on a double (D1 = 2); reaching exactly 0
 * busts unless the visit declares `finishedOnDouble`. A bust scores 0 and
 * leaves the remaining score untouched.
 */
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

/**
 * Pure reducer: folds one visit onto a `OneTwentyOneState`. A checkout at the
 * cap target (170) wins the session; any other checkout climbs the target by
 * one and opens a fresh 3-visit budget. A visit that neither checks out nor
 * is the attempt's 3rd carries its remaining score to the next visit in the
 * same attempt. The 3rd non-checkout visit applies the v1 fail rule — stay on
 * the same target with a fresh budget — whether that visit busted or simply
 * fell short.
 * @throws when the session is already complete, or when `scoreAttempted` is
 *   not a whole number within `0..180`; the caller's state is left untouched
 *   either way.
 */
export function applyOneTwentyOneVisit(
  state: OneTwentyOneState,
  input: OneTwentyOneVisitInput,
): OneTwentyOneState {
  if (!isPlayableVisitScore(input.scoreAttempted)) {
    throw new Error(`Enter a score between 0 and ${MAX_VISIT_SCORE}.`);
  }
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a visit once the session is complete; undo first to correct it.",
    );
  }

  const outcome = resolveOneTwentyOneVisit(state.remainingInAttempt, input);

  if (outcome.checkedOut) {
    if (state.currentTarget === CAP_TARGET) {
      return {
        currentTarget: state.currentTarget,
        remainingInAttempt: 0,
        visitsThisAttempt: 0,
        status: "WON",
      };
    }
    const nextTarget = state.currentTarget + 1;
    return {
      currentTarget: nextTarget,
      remainingInAttempt: nextTarget,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    };
  }

  const visitsThisAttempt = state.visitsThisAttempt + 1;
  if (visitsThisAttempt < VISITS_PER_ATTEMPT) {
    return {
      ...state,
      remainingInAttempt: outcome.remainingAfter,
      visitsThisAttempt,
    };
  }

  return {
    currentTarget: state.currentTarget,
    remainingInAttempt: state.currentTarget,
    visitsThisAttempt: 0,
    status: "IN_PROGRESS",
  };
}

/**
 * 121: a checkout ladder from 121 to 170, each target attempted in up to 3
 * visits (9 darts) and won by a visit whose final dart lands in a double. The
 * engine owns the fact log — one `ROUND` stage per attempt and one turn per
 * visit, carrying the visit total with no dart rows because 121 is a
 * quick-score game. `currentTarget`, `remainingInAttempt` and
 * `visitsThisAttempt` are derived by folding those turns through
 * `applyOneTwentyOneVisit`, never accumulated: a bust turn stores
 * `totalScore: 0`, so replaying the log reproduces the ladder exactly.
 */
export class OneTwentyOneEngine
  implements GameEngine<OneTwentyOneVisitInput, OneTwentyOneState>
{
  readonly rulesetVersionKey = "121_V1";
  private readonly stages: StageFact[];
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: OneTwentyOneSnapshot,
    prior?: EngineFacts,
  ) {
    this.stages =
      prior && prior.stages.length > 0
        ? prior.stages.map((stage) => ({ ...stage }))
        : [roundStage(1)];
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  /**
   * Replays every recorded turn as the visit that produced it. A turn's
   * `totalScore` is what actually counted, so a bust replays as a scoreless
   * visit and only a genuine checkout can bring a visit to zero — which is
   * why `finishedOnDouble` is safe to assert on replay.
   */
  private deriveState(): OneTwentyOneState {
    let state = initialOneTwentyOneState();
    for (const turn of this.turns) {
      state = applyOneTwentyOneVisit(state, {
        scoreAttempted: turn.totalScore,
        finishedOnDouble: true,
      });
    }
    return state;
  }

  private openRound(): StageFact {
    const stage = this.stages.at(-1);
    if (!stage) {
      throw new Error("A 121 engine always has an open round stage.");
    }
    return stage;
  }

  private turnCountIn(stageClientKey: string): number {
    return this.turns.filter((turn) => turn.stageClientKey === stageClientKey)
      .length;
  }

  /**
   * Appends one visit to the open round, then opens the next round's stage
   * when that visit resolved the attempt (checkout or a 3rd non-checkout) and
   * the session continues. Stages and turns move together so the log never
   * holds a turn without its stage.
   * @throws when the score is out of range or the session has already ended;
   *   the fact log is left untouched.
   */
  record(input: OneTwentyOneVisitInput): OneTwentyOneState {
    const before = this.deriveState();
    const after = applyOneTwentyOneVisit(before, input);
    const outcome = resolveOneTwentyOneVisit(before.remainingInAttempt, input);

    const round = this.openRound();
    this.turns.push({
      clientKey: newClientKey(),
      stageClientKey: round.clientKey,
      sequence: this.turnCountIn(round.clientKey) + 1,
      completedAt: new Date().toISOString(),
      totalScore: outcome.scored,
      darts: [],
    });

    if (after.visitsThisAttempt === 0 && after.status === "IN_PROGRESS") {
      this.stages.push(roundStage(this.stages.length + 1));
    }

    return after;
  }

  /**
   * Pops the last recorded visit, including one replayed from persisted
   * facts, and removes the round stage that visit opened. The stage only
   * goes when the popped turn belonged to an earlier round — that is exactly
   * the case where `record()` appended a stage — so undoing a visit played
   * inside a new round leaves that round open.
   * @returns true if a visit was removed; false if there was nothing to undo.
   */
  undo(): boolean {
    const removed = this.turns.pop();
    if (!removed) return false;

    this.popStageOpenedBy(removed.stageClientKey);
    return true;
  }

  /**
   * Pops the open round's stage when it was opened by the turn now being
   * undone — the same stage `record()` would have appended for that turn.
   */
  private popStageOpenedBy(stageClientKey: string): void {
    const openRound = this.stages.at(-1);
    if (
      this.stages.length > 1 &&
      openRound &&
      openRound.clientKey !== stageClientKey
    ) {
      this.stages.pop();
    }
  }

  /**
   * Answers whether recording `input` would win the session, without
   * mutating the fact log or the derived state. Only a checkout at the cap
   * target (170) can ever complete a 121 session.
   */
  wouldComplete(input: OneTwentyOneVisitInput): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;
    if (!isPlayableVisitScore(input.scoreAttempted)) return false;

    return applyOneTwentyOneVisit(before, input).status === "WON";
  }

  isComplete(): boolean {
    return this.deriveState().status === "WON";
  }

  state(): OneTwentyOneState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return {
      stages: this.stages.map((stage) => ({ ...stage })),
      turns: cloneTurns(this.turns),
    };
  }
}

export const oneTwentyOneEngineFactory: GameEngineFactory<
  OneTwentyOneSnapshot,
  OneTwentyOneVisitInput,
  OneTwentyOneState
> = {
  rulesetVersionKey: "121_V1",
  create(config: OneTwentyOneSnapshot, prior?: EngineFacts) {
    return new OneTwentyOneEngine(config, prior);
  },
};

registerEngineFactory(oneTwentyOneEngineFactory);
```

- [ ] **Step 5: Run the engine tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 6: Write the failing validator tests**

Create `app/tests/services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { oneTwentyOneValidator } from "@services/rulesets/one-twenty-one/one-twenty-one.validator";
import type { DartFactInput } from "@routes/types";

function batchWithTurns(totalScores: number[]) {
  return {
    stages: [
      {
        clientKey: "round-1",
        stageTypeKey: "ROUND",
        parentClientKey: null,
        sequence: 1,
        turns: totalScores.map((totalScore, i) => ({
          clientKey: `t${i + 1}`,
          participantRef: "p1",
          sequence: i + 1,
          totalScore,
          completedAt: "2026-08-14T10:00:00.000Z",
          darts: [] as DartFactInput[],
        })),
      },
    ],
  };
}

describe("oneTwentyOneValidator.validateConfig", () => {
  it("accepts RECREATIONAL + QUICK_SCORE with the empty config", () => {
    const result = oneTwentyOneValidator.validateConfig({
      config: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a capture/input mode combination the ruleset does not support", () => {
    const result = oneTwentyOneValidator.validateConfig({
      config: {},
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a config carrying a key the schema does not model", () => {
    const result = oneTwentyOneValidator.validateConfig({
      config: { starting_target: 121 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });
});

describe("oneTwentyOneValidator.validateBatch", () => {
  it("accepts a failed visit scored 0 and a checkout scored at its target", () => {
    const result = oneTwentyOneValidator.validateBatch({
      config: {},
      batch: batchWithTurns([0, 0, 121]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts the highest possible 3-dart visit (180)", () => {
    const result = oneTwentyOneValidator.validateBatch({
      config: {},
      batch: batchWithTurns([180]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a total above 180", () => {
    const result = oneTwentyOneValidator.validateBatch({
      config: {},
      batch: batchWithTurns([181]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a negative turn total", () => {
    const result = oneTwentyOneValidator.validateBatch({
      config: {},
      batch: batchWithTurns([-1]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects dart rows under QUICK_SCORE capture", () => {
    const batch = batchWithTurns([60]);
    batch.stages[0].turns[0].darts = [
      {
        sequence: 1,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: 20,
        hitZoneKey: "SINGLE",
        score: 20,
        locationX: null,
        locationY: null,
      },
    ];
    const result = oneTwentyOneValidator.validateBatch({
      config: {},
      batch,
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 7: Run the validator tests to verify they fail**

Run: `cd app && npx vitest run tests/services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts`
Expected: FAIL — `Cannot find module '@services/rulesets/one-twenty-one/one-twenty-one.validator'`.

- [ ] **Step 8: Implement the validator**

Create `app/src/services/rulesets/one-twenty-one/one-twenty-one.validator.ts`:

```ts
import { OneTwentyOneConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import {
  QUICK_SCORE_MODES,
  isQuickScoreCapture,
  validateQuickScoreTurns,
} from "../quick-score.validator";
import type {
  BatchValidationResult,
  ConfigValidationResult,
} from "@services/types";

/** The highest total a single 121 visit can legitimately carry — the highest three-dart score on a standard board (T20 T20 T20). */
const MAX_VISIT_SCORE = 180;

/**
 * 121 is RECREATIONAL + QUICK_SCORE: one visit per turn, carrying the visit's
 * scored total or 0 on a bust, with no dart rows — same shape as 501 and
 * TUOD.
 */
export const oneTwentyOneValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (!isQuickScoreCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [`121 V1 only supports ${QUICK_SCORE_MODES}`],
      };
    }
    const parsed = OneTwentyOneConfig.safeParse(config);
    if (!parsed.success) {
      return { valid: false, issues: parsed.error.issues };
    }
    return { valid: true, config: parsed.data };
  },

  validateBatch({ batch }): BatchValidationResult {
    return validateQuickScoreTurns(batch, MAX_VISIT_SCORE);
  },
};
```

- [ ] **Step 9: Register the validator**

Edit `app/src/services/rulesets/registry.ts`:

```ts
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
};

export function getRulesetValidator(
  rulesetVersionKey: string,
): RulesetValidator | undefined {
  return REGISTRY[rulesetVersionKey];
}
```

- [ ] **Step 10: Run the validator tests to verify they pass**

Run: `cd app && npx vitest run tests/services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts`
Expected: PASS.

- [ ] **Step 11: Fix the hardcoded ruleset count in the capability/validator parity test**

Edit `app/tests/lib/game/rulesets/capability-validator-parity.test.ts`, line 81:

```ts
  it("covers every ruleset", () => {
    expect(rulesetKeys.length).toBe(8);
  });
```

- [ ] **Step 12: Run the full parity test suite to verify it is green**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capability-validator-parity.test.ts`
Expected: PASS (121_V1 now resolves a validator that accepts its declared pair and rejects every other).

- [ ] **Step 13: Append 121's capability row to the running seed ledger**

Edit `database/seeds/0007_ruleset_version_capabilities.sql` — append one line to the `VALUES` list and update the header comment's correction note is unnecessary (only the SHANGHAI-style precedent applies: append, do not create a new capability seed file):

```sql
    VALUES
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
        ('121_V1', 'RECREATIONAL', 'QUICK_SCORE')
    ) AS declared(ruleset_key, capture_key, input_key)
```

- [ ] **Step 14: Add the 121 game engine reference seed**

Create `database/seeds/0009_121_game_engine_reference.sql`:

```sql
-- ============================================================
-- Seed: 0009_121_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for 121 v1: an X01-style checkout ladder
-- from 121 to 170, 3 visits (9 darts) per attempt. Without this
-- seed there is no game type, ruleset version, or preset to
-- start a session from — POST /api/sessions has nothing to look
-- up for 121_V1.
--
-- UUID allocation (continues the 0003 range, next after 0008's
-- Shanghai row):
-- - 0198f000-...-000008 game_types              (ONE_TWENTY_ONE)
-- - 0198f100-...-000008 ruleset_versions        (121_V1)
-- - 0198f300-...-000012 configuration_templates (121)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — OneTwentyOneConfig is a
-- genuinely empty `.strict()` object: v1 locks every rule (start
-- target 121, cap 170, 9-dart budget, double out, fail rule
-- "stay") with nothing left to configure, so its one preset's
-- configuration is `{}`.
--
-- No game_type_features mapping: v1 is single-player only, and
-- there is no duration_type/duration_value or opponent toggle to
-- configure, mirroring 0008's Shanghai reasoning.
--
-- No exercise_templates row: nothing outside this file's own
-- configuration_templates preset currently reads exercise_
-- templates at runtime.
--
-- Capability: 121_V1 + RECREATIONAL + QUICK_SCORE is declared in
-- seeds/0007_ruleset_version_capabilities.sql, not here — 0007 is
-- the single running ledger every ruleset's capability rows are
-- appended to. verification/0009_121_capability_checks.sql
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
        '0198f000-0000-7000-8000-000000000008',
        'ONE_TWENTY_ONE',
        '121',
        'X01-style checkout ladder: start at 121, check out to zero on a double within 3 visits, climb the target on success. Check out 170 to win.',
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
        '0198f100-0000-7000-8000-000000000008',
        '0198f000-0000-7000-8000-000000000008',
        '121_V1',
        1,
        'Initial 121 ruleset: start target 121, double out, 9-dart (3-visit) budget per attempt, fail rule stay, cap target 170.',
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
        '0198f300-0000-7000-8000-000000000012',
        '0198f000-0000-7000-8000-000000000008',
        NULL,
        '121 — Standard',
        'Start at 121, double out, 3 visits per attempt, check out 170 to win.',
        '{}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
```

- [ ] **Step 15: Add the verification script**

Create `database/verification/0009_121_capability_checks.sql` (mirrors `0008_shanghai_capability_checks.sql`, re-scoped to the 11th declared triple):

```sql
-- ============================================================
-- Verification: 0009_121_capability_checks.sql
--
-- Mirrors 0008_shanghai_capability_checks.sql's shape, re-scoped
-- for the additive 121_V1 row appended to 0007_ruleset_version_
-- capabilities.sql's own VALUES list on top of its original 10.
-- No PostgreSQL server exists in the container that authored this
-- file (D193), so it asserts against a real Neon database before
-- merge:
--
--   1. 121_V1 + RECREATIONAL + QUICK_SCORE resolved through the
--      implementation_key joins
--   2. the table now holds exactly the 11 triples declared across
--      0007 and this file, no more and no fewer (full
--      bidirectional parity with capabilities.ts as of this seed)
--   3. no exercise_sessions row is left undeclared
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0009_121_capability_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:seed` has applied seeds/0007 and seeds/0009.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Step 1: 121_V1 + RECREATIONAL + QUICK_SCORE resolved.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    '121_V1 / RECREATIONAL / QUICK_SCORE resolves to a seeded row',
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN NULL
        WHEN rv.id IS NULL THEN 'no ruleset_versions row for 121_V1'
        ELSE 'lookups resolved but no matching ruleset_version_capabilities row'
    END
FROM ruleset_versions rv
    LEFT JOIN capture_modes cm ON cm.implementation_key = 'RECREATIONAL'
    LEFT JOIN input_modes im ON im.implementation_key = 'QUICK_SCORE'
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id
WHERE rv.implementation_key = '121_V1';

-- ------------------------------------------------------------
-- Step 2: full-table parity — 0007's 10 triples plus this file's
-- 1 new one, no more and no fewer.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'table holds exactly the 11 declared triples, no more and no fewer',
    CASE
        WHEN count(*) = 11 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 11, found %s', count(*))
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
                    ('121_V1', 'RECREATIONAL', 'QUICK_SCORE')
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

- [ ] **Step 16: Run the full backend test suite and the seed parity tests**

Run: `cd app && npx vitest run tests/lib/game/rulesets/ tests/modules/game/one-twenty-one.engine.module.test.ts tests/services/rulesets/one-twenty-one/`
Expected: PASS — `capability-seed-parity.test.ts` now agrees (11 triples on both sides), `capability-validator-parity.test.ts` covers 8 rulesets and 121_V1 accepts/rejects the right pairs.

- [ ] **Step 17: Run the game-engine contract gate**

Run: `bash scripts/check-game-engines.sh`
Expected: `OK: app/src/modules/game/one-twenty-one.engine.module.ts conforms (rulesetVersionKey: 121_V1).` among the output, exit code 0.

- [ ] **Step 18: Format and commit**

```bash
cd app && npm run format && cd ..
git add app/src/modules/game/types.ts \
  app/src/modules/game/one-twenty-one.engine.module.ts \
  app/tests/modules/game/one-twenty-one.engine.module.test.ts \
  app/src/services/rulesets/one-twenty-one/one-twenty-one.validator.ts \
  app/tests/services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts \
  app/src/services/rulesets/registry.ts \
  app/tests/lib/game/rulesets/capability-validator-parity.test.ts \
  database/seeds/0007_ruleset_version_capabilities.sql \
  database/seeds/0009_121_game_engine_reference.sql \
  database/verification/0009_121_capability_checks.sql
git commit -m "feat(121): add game engine, server validator, and database seed"
```

---

## Task 3: Games-page visibility card

**Files:**
- Modify: `app/src/lib/game/rulesets/games-visibility.ts`
- Modify: `app/tests/lib/game/rulesets/games-visibility.test.ts`

**Interfaces:**
- Consumes: `GameCardDescriptor`, `supportsCaptureMode` (existing).
- Produces: a new entry in `GAME_CARDS`, route `/games/121/setup`.

- [ ] **Step 1: Update the failing expectations first**

Edit `app/tests/lib/game/rulesets/games-visibility.test.ts`, the RECREATIONAL list (add `"121_V1"` at the end, since `GAME_CARDS` order is declaration order and 121 is appended last):

```ts
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
    ]);
  });
```

The ANALYTICS-only test (`expect(keys).toEqual(["501_V1", "BOBS27_V1", "SCORE_TRAINING_V1"])`) needs no change — 121_V1 declares only `RECREATIONAL`+`QUICK_SCORE`, so it stays absent from that list, same as SINGLES_V1/DOUBLES_TRAINING_V1/SHANGHAI_V1. Add one assertion confirming that:

```ts
  it("shows every carded game that declares an analytics pair, and no others, under analytics", () => {
    const keys = visibleGames("ANALYTICS", null)
      .map((game) => game.rulesetVersionKey)
      .sort();
    expect(keys).toEqual(["501_V1", "BOBS27_V1", "SCORE_TRAINING_V1"]);
    expect(keys).not.toContain("SINGLES_V1");
    expect(keys).not.toContain("DOUBLES_TRAINING_V1");
    expect(keys).not.toContain("SHANGHAI_V1");
    expect(keys).not.toContain("121_V1");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/rulesets/games-visibility.test.ts`
Expected: FAIL — the RECREATIONAL list is missing `"121_V1"`.

- [ ] **Step 3: Add the card**

Edit `app/src/lib/game/rulesets/games-visibility.ts`:

```ts
export const GAME_CARDS: readonly GameCardDescriptor[] = [
  {
    rulesetVersionKey: "SCORE_TRAINING_V1",
    href: "/games/score-training/setup",
    title: "Score training",
    caption: "Exercise your scoring abilities.",
  },
  {
    rulesetVersionKey: "501_V1",
    href: "/games/501/setup",
    title: "501",
    caption: "Classic double-out darts.",
  },
  {
    rulesetVersionKey: "BOBS27_V1",
    href: "/games/bobs27/setup",
    title: "Bob's 27",
    caption: "Running-score doubles training.",
  },
  {
    rulesetVersionKey: "SINGLES_V1",
    href: "/games/singles-training/setup",
    title: "Singles training",
    caption: "Section training, one target at a time.",
  },
  {
    rulesetVersionKey: "DOUBLES_TRAINING_V1",
    href: "/games/doubles-training/setup",
    title: "Doubles training",
    caption: "Trebles for show, doubles for dough!",
  },
  {
    rulesetVersionKey: "SHANGHAI_V1",
    href: "/games/shanghai/setup",
    title: "Shanghai",
    caption: "Chase the highest total, or win instantly with a Shanghai.",
  },
  {
    rulesetVersionKey: "121_V1",
    href: "/games/121/setup",
    title: "121",
    caption: "Climb the checkout ladder from 121 to 170.",
  },
];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/rulesets/games-visibility.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/lib/game/rulesets/games-visibility.ts app/tests/lib/game/rulesets/games-visibility.test.ts
git commit -m "feat(121): add games-page visibility card"
```

---

## Task 4: Setup flow (data, form, page)

**Files:**
- Modify: `app/src/lib/game/types.ts` (add `OneTwentyOneSetupContext`)
- Create: `app/src/lib/game/one-twenty-one-setup.data.ts`
- Test: `app/tests/lib/game/one-twenty-one-setup.data.test.ts`
- Create: `app/src/components/layout/games/setup/OneTwentyOneSetupForm.astro`
- Create: `app/src/pages/games/121/setup/index.astro`

**Interfaces:**
- Consumes: `fetchConfigurationPresets`, `createSession`, `fetchActiveSessions`, `completeSession` (`@client/api/*`), `toSnapshot` (`@lib/game/rulesets/config-codec`), `reconcileActiveSession` (`@lib/game/session-recovery`), `resolveSessionModePair`/`startSessionInput` (`@lib/game/session-mode-resolution`).
- Produces: `oneTwentyOneSetup()` Alpine factory (`presets`, `loading`, `error`, `activeSession`, `showActiveSessionModal`, `loadingReconciliation`, `reconciliationFailed`, `init`, `reconcile`, `retryReconciliation`, `continueSession`, `abandonSession`, `start`) — zero editable settings, mirrors `shanghaiSetup()` exactly with `GAME_TYPE_KEY = "ONE_TWENTY_ONE"` / `RULESET_VERSION_KEY = "121_V1"`.

- [ ] **Step 1: Add `OneTwentyOneSetupContext` to `app/src/lib/game/types.ts`**

Add after the `ShanghaiSetupContext` block (around line 538), following its exact shape:

```ts
export type OneTwentyOneSetupContext = {
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
  init(this: OneTwentyOneSetupContext): Promise<void>;
  reconcile(
    this: OneTwentyOneSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: OneTwentyOneSetupContext): Promise<void>;
  continueSession(this: OneTwentyOneSetupContext): void;
  abandonSession(this: OneTwentyOneSetupContext): Promise<void>;
  start(this: OneTwentyOneSetupContext): Promise<void>;
};
```

- [ ] **Step 2: Write the failing setup-data tests**

Create `app/tests/lib/game/one-twenty-one-setup.data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { oneTwentyOneSetup } from "@lib/game/one-twenty-one-setup.data";
import type { OneTwentyOneSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const STANDARD_PRESET = {
  configurationTemplateId: "tmpl-121-standard",
  gameTypeKey: "ONE_TWENTY_ONE",
  name: "121 — Standard",
  description: null,
  configuration: {},
  isSystemTemplate: true,
} as any;

describe("oneTwentyOneSetup", () => {
  let store: OneTwentyOneSetupContext["$store"];

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
        inputModeKey: "QUICK_SCORE",
      },
    };
  });

  function createSetup(
    overrides: Partial<OneTwentyOneSetupContext> = {},
  ): OneTwentyOneSetupContext {
    return {
      ...oneTwentyOneSetup(),
      $store: store,
      ...overrides,
    } as OneTwentyOneSetupContext;
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
        "ONE_TWENTY_ONE",
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
        { sessionId: "match-id", gameTypeKey: "ONE_TWENTY_ONE" } as any,
      ]);
      store.game.sessionId = "match-id";

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toEqual({
        sessionId: "match-id",
        gameTypeKey: "ONE_TWENTY_ONE",
      });
    });

    it('blocks with reconciliationFailed on "abandon_failed"', async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "server-id", gameTypeKey: "ONE_TWENTY_ONE" } as any,
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
          gameTypeKey: "ONE_TWENTY_ONE",
        } as any,
      });
      const locationSpy = { href: "/games/121/setup" };
      vi.stubGlobal("location", locationSpy);

      setup.continueSession();

      expect(locationSpy.href).toBe("/games/121/play");
    });

    it("abandons session when user clicks Abandon", async () => {
      const setup = createSetup({
        activeSession: {
          sessionId: "match-id",
          gameTypeKey: "ONE_TWENTY_ONE",
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
        gameTypeKey: "ONE_TWENTY_ONE",
        rulesetVersionKey: "121_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
        config: {
          source: "template",
          templateRef: "tmpl-121-standard",
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-121-standard",
          configSnapshot: {},
        }),
      );
      expect(locationSpy.href).toBe("/games/121/play");
    });

    it("errors when no preset is available", async () => {
      const setup = createSetup({ presets: [] });
      await setup.start();
      expect(sessionsApi.createSession).not.toHaveBeenCalled();
      expect(setup.error).toBe("Could not find a preset for 121.");
    });

    it("re-reconciles into the active-session modal when create reports SESSION_ALREADY_ACTIVE", async () => {
      const setup = createSetup({ presets: [STANDARD_PRESET] });
      vi.mocked(sessionsApi.createSession).mockRejectedValue(
        Object.assign(new Error("already active"), {
          code: "SESSION_ALREADY_ACTIVE",
        }),
      );
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "active-1", gameTypeKey: "ONE_TWENTY_ONE" } as any,
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

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-setup.data.test.ts`
Expected: FAIL — `Cannot find module '@lib/game/one-twenty-one-setup.data'`.

- [ ] **Step 4: Implement the setup data module**

Create `app/src/lib/game/one-twenty-one-setup.data.ts`:

```ts
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
import type { OneTwentyOneSetupContext } from "./types";

const GAME_TYPE_KEY = "ONE_TWENTY_ONE";
const RULESET_VERSION_KEY = "121_V1";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function oneTwentyOneSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,

    async init(this: OneTwentyOneSetupContext) {
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
      this: OneTwentyOneSetupContext,
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

    async retryReconciliation(this: OneTwentyOneSetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: OneTwentyOneSetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/121/play";
    },

    async abandonSession(this: OneTwentyOneSetupContext) {
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

    async start(this: OneTwentyOneSetupContext) {
      const preset = this.presets[0];
      if (!preset) {
        this.error = "Could not find a preset for 121.";
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
        globalThis.location.href = "/games/121/play";
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

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-setup.data.test.ts`
Expected: PASS.

- [ ] **Step 6: Create the setup form component**

Create `app/src/components/layout/games/setup/OneTwentyOneSetupForm.astro`:

```astro
---
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import UserSection from "./UserSection.astro";

const infoSection = {
  title: "121 rules",
  description:
    "Start at 121 and check out to exactly zero on a double, using up to 3 visits (9 darts). Check out and the target climbs by one — 122, 123, and so on. Miss all 3 visits and you try the same target again. Check out 170 to win.",
};
---

<SetupShell title="121">
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

- [ ] **Step 7: Create the setup page**

Create `app/src/pages/games/121/setup/index.astro`:

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import Button from "@components/forms/Button.astro";
import ContinueSessionModal from "@components/layout/games/ContinueSessionModal.astro";
import OneTwentyOneSetupForm from "@components/layout/games/setup/OneTwentyOneSetupForm.astro";
import IsLoading from "@components/ui/IsLoading.astro";
---

<AppLayout title="121 — Setup">
  <div
    class="p-4"
    x-data="oneTwentyOneSetup()"
  >
    <template x-if="showActiveSessionModal && activeSession">
      <ContinueSessionModal gameTitle="121" />
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
      <OneTwentyOneSetupForm />
    </template>

    <template x-if="loadingReconciliation">
      <IsLoading title="Configuring your session..." />
    </template>
  </div>
</AppLayout>
```

- [ ] **Step 8: Commit**

```bash
cd app && npm run format && cd ..
git add app/src/lib/game/types.ts \
  app/src/lib/game/one-twenty-one-setup.data.ts \
  app/tests/lib/game/one-twenty-one-setup.data.test.ts \
  app/src/components/layout/games/setup/OneTwentyOneSetupForm.astro \
  app/src/pages/games/121/setup/index.astro
git commit -m "feat(121): add setup flow"
```

---

## Task 5: Play flow (data, interface, dialogs, results, page)

**Files:**
- Modify: `app/src/lib/game/types.ts` (add `OneTwentyOnePlayContext`, `OneTwentyOneResultsSnapshot`)
- Create: `app/src/lib/game/one-twenty-one-play.data.ts`
- Test: `app/tests/lib/game/one-twenty-one-play.data.test.ts`
- Create: `app/src/components/layout/games/interfaces/OneTwentyOne.astro`
- Create: `app/src/components/layout/games/result-modals/OneTwentyOneResults.astro`
- Create: `app/src/pages/games/121/play/index.astro`

**Interfaces:**
- Consumes: `ScoreInputBuffer` (`@modules/game/score-input.module`), `getEngineFactory` (`@modules/game/engine.registry`), `applyOneTwentyOneVisit`/`initialOneTwentyOneState`/`OneTwentyOneEngine`/`oneTwentyOneEngineFactory` (`@modules/game/one-twenty-one.engine.module`), `checkoutPathFor` (`@modules/game/checkout-path.module`), `resolveSessionModePair` (`@lib/game/session-mode-resolution`), `appendBatch`/`completeSession`/`createSession`/`fetchActiveSessions` (`@client/api/sessions`), `buildEventsBatch` (`@modules/game/events.payload.module`), `reconcileActiveSession` (`@lib/game/session-recovery`), `dartsThrownCount` (`@lib/game/play-visit-stats`). Reuses `DoubleCheckoutConfirm.astro` and `ConfirmDialog.astro` (generic, existing).
- Produces: `oneTwentyOnePlay()` Alpine factory. This is a bespoke implementation mirroring `fiveOhOnePlay()` — **not** `play-lifecycle.ts`, which only accepts `DartObservation` input and cannot express a visit-total record.

- [ ] **Step 1: Add `OneTwentyOnePlayContext` and `OneTwentyOneResultsSnapshot` to `app/src/lib/game/types.ts`**

Add near the top, alongside `PlayStoreContext` usage, an import of `OneTwentyOneEngine`/`OneTwentyOneSnapshot` (extend the existing import blocks at the top of the file):

```ts
import type { OneTwentyOneEngine } from "@modules/game/one-twenty-one.engine.module";
```

(added alongside the existing `import type { ShanghaiEngine } from "@modules/game/shanghai.engine.module";` line)

```ts
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
} from "./rulesets/types";
```

Add after the `FiveOhOnePlayContext` block (around line 385), following its exact shape but trimmed of board-input/leg concepts 121 has no equivalent for:

```ts
/** `attempt` is 1-indexed: which attempt at the winning target succeeded — always the attempt whose 3rd-or-earlier visit checked out at 170. */
export type OneTwentyOneResultsSnapshot = {
  target: number;
  visits: number;
  average: number;
};

export type OneTwentyOnePlayContext = {
  scoreInput: ScoreInputBuffer;
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
  resultsSnapshot: OneTwentyOneResultsSnapshot | null;
  pendingCheckoutScore: number | null;
  showDoubleConfirm: boolean;
  showSessionFinishConfirm: boolean;
  $store: PlayStoreContext<OneTwentyOneSnapshot>;
  engine: OneTwentyOneEngine | null;
  turnsInCurrentRound(this: OneTwentyOnePlayContext): TurnFact[];
  remainingInAttempt(this: OneTwentyOnePlayContext): number;
  currentTargetLabel(this: OneTwentyOnePlayContext): string;
  checkoutHint(this: OneTwentyOnePlayContext): string;
  visitsThisAttempt(this: OneTwentyOnePlayContext): number;
  dartsThrownThisSession(this: OneTwentyOnePlayContext): number;
  init(this: OneTwentyOnePlayContext): Promise<void>;
  retryReconciliation(this: OneTwentyOnePlayContext): Promise<void>;
  submitVisit(this: OneTwentyOnePlayContext): Promise<void>;
  confirmDouble(this: OneTwentyOnePlayContext): Promise<void>;
  denyDouble(this: OneTwentyOnePlayContext): Promise<void>;
  cancelCheckout(this: OneTwentyOnePlayContext): void;
  confirmSessionFinish(this: OneTwentyOnePlayContext): Promise<void>;
  cancelSessionFinish(this: OneTwentyOnePlayContext): void;
  recordVisit(
    this: OneTwentyOnePlayContext,
    score: number,
    finishedOnDouble: boolean,
  ): Promise<void>;
  undoVisit(this: OneTwentyOnePlayContext): void;
  uploadAndCompleteSession(this: OneTwentyOnePlayContext): Promise<void>;
  back(this: OneTwentyOnePlayContext): Promise<void>;
  playAgain(this: OneTwentyOnePlayContext): Promise<void>;
  abandonAndExit(this: OneTwentyOnePlayContext): Promise<void>;
};
```

- [ ] **Step 2: Write the failing play-data tests**

Create `app/tests/lib/game/one-twenty-one-play.data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { oneTwentyOnePlay } from "@lib/game/one-twenty-one-play.data";
import { oneTwentyOneEngineFactory } from "@modules/game/one-twenty-one.engine.module";
import type { OneTwentyOnePlayContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";

vi.mock("@client/api/sessions");

function baseStore(): OneTwentyOnePlayContext["$store"] {
  return {
    game: {
      rulesetVersionKey: "121_V1",
      sessionId: "session-1",
      participantRef: "participant-1",
      templateRef: "tmpl-121-standard",
      configSnapshot: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
      stages: [],
      turns: [],
      idempotencyKey: null,
      loading: false,
      recordFacts: vi.fn(function (
        this: OneTwentyOnePlayContext["$store"]["game"],
        facts,
      ) {
        this.stages = facts.stages;
        this.turns = facts.turns;
      }),
      setSessionModes: vi.fn(),
      reset: vi.fn(),
    },
    settings: { captureModeKey: "RECREATIONAL", inputModeKey: "QUICK_SCORE" },
  };
}

describe("oneTwentyOnePlay", () => {
  let store: OneTwentyOnePlayContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = baseStore();
  });

  function createPlay(
    overrides: Partial<OneTwentyOnePlayContext> = {},
  ): OneTwentyOnePlayContext {
    return { ...oneTwentyOnePlay(), $store: store, ...overrides } as OneTwentyOnePlayContext;
  }

  describe("submitVisit / double confirm", () => {
    it("records an ordinary scoring visit immediately", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create({}) as any;
      play.scoreInput.setValue("60");

      await play.submitVisit();

      expect(store.game.turns).toHaveLength(1);
      expect(store.game.turns[0].totalScore).toBe(60);
      expect(play.showDoubleConfirm).toBe(false);
    });

    it("opens the double-confirm dialog for a visit that would reach exactly zero via a real checkout path", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create({}) as any;
      play.engine!.record({ scoreAttempted: 41 });
      play.scoreInput.setValue("40");

      await play.submitVisit();

      expect(play.showDoubleConfirm).toBe(true);
      expect(store.game.turns).toHaveLength(1);
    });

    it("confirmDouble records a checkout that only climbs the ladder immediately", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create({}) as any;
      play.engine!.record({ scoreAttempted: 81 });
      play.pendingCheckoutScore = 40;
      play.showDoubleConfirm = true;

      await play.confirmDouble();

      expect(store.game.turns.at(-1)?.totalScore).toBe(40);
      expect(play.showDoubleConfirm).toBe(false);
      expect(play.showSessionFinishConfirm).toBe(false);
    });

    it("confirmDouble defers to the session-finish confirm for a checkout at the cap target", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create({}) as any;
      for (let target = 121; target < 170; target += 1) {
        play.engine!.record({ scoreAttempted: 2, finishedOnDouble: true });
      }
      play.pendingCheckoutScore = 2;
      play.showDoubleConfirm = true;

      await play.confirmDouble();

      expect(play.showSessionFinishConfirm).toBe(true);
      expect(store.game.turns.at(-1)?.stageClientKey).not.toBeUndefined();
    });

    it("denyDouble records the visit as a bust", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create({}) as any;
      play.engine!.record({ scoreAttempted: 41 });
      play.pendingCheckoutScore = 40;
      play.showDoubleConfirm = true;

      await play.denyDouble();

      expect(store.game.turns.at(-1)?.totalScore).toBe(0);
    });

    it("cancelCheckout restores the score to the keypad without recording", () => {
      const play = createPlay({
        pendingCheckoutScore: 40,
        showDoubleConfirm: true,
      });

      play.cancelCheckout();

      expect(play.scoreInput.value).toBe("40");
      expect(play.showDoubleConfirm).toBe(false);
      expect(store.game.turns).toHaveLength(0);
    });
  });

  describe("undoVisit", () => {
    it("undoes the last recorded visit and mirrors the fact log", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create({}) as any;
      play.scoreInput.setValue("60");
      await play.submitVisit();
      expect(store.game.turns).toHaveLength(1);

      play.undoVisit();

      expect(store.game.turns).toHaveLength(0);
    });
  });

  describe("uploadAndCompleteSession", () => {
    it("uploads the batch, completes the session, and snapshots the results", async () => {
      const play = createPlay();
      play.engine = oneTwentyOneEngineFactory.create({}) as any;
      for (let target = 121; target < 170; target += 1) {
        play.engine!.record({ scoreAttempted: 2, finishedOnDouble: true });
      }
      play.engine!.record({ scoreAttempted: 2, finishedOnDouble: true });
      store.game.recordFacts(play.engine!.facts());
      vi.mocked(sessionsApi.appendBatch).mockResolvedValue(undefined as any);
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({
        sessionId: "session-1",
        statusKey: "COMPLETED",
        completedAt: "2026-08-14T10:00:00Z",
      });

      await play.uploadAndCompleteSession();

      expect(play.completionStatus).toBe("succeeded");
      expect(play.resultsSnapshot?.target).toBe(170);
    });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts`
Expected: FAIL — `Cannot find module '@lib/game/one-twenty-one-play.data'`.

- [ ] **Step 4: Implement the play data module**

Create `app/src/lib/game/one-twenty-one-play.data.ts`:

```ts
import { ScoreInputBuffer } from "@modules/game/score-input.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import {
  applyOneTwentyOneVisit,
  initialOneTwentyOneState,
} from "@modules/game/one-twenty-one.engine.module";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
import { resolveSessionModePair } from "@lib/game/session-mode-resolution";
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { dartsThrownCount } from "@lib/game/play-visit-stats";
import type { RulesetVersionKey } from "@lib/types";
import type { EngineFacts, OneTwentyOneState, TurnFact } from "@modules/types";
import type { OneTwentyOnePlayContext } from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// oneTwentyOneEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { OneTwentyOneEngine } from "@modules/game/one-twenty-one.engine.module";

const GAME_TYPE_KEY = "ONE_TWENTY_ONE";
const RULESET_VERSION_KEY: RulesetVersionKey = "121_V1";
const DARTS_PER_VISIT = 3;

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Mirrors `five-oh-one-play.data
 * .ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: OneTwentyOnePlayContext["$store"]["game"],
): OneTwentyOneEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof OneTwentyOneEngine ? engine : null;
}

/**
 * Folds a round's turns into a `OneTwentyOneState`, exactly like the
 * engine's own private replay, but reading only from the reactive
 * `$store.game` fields — never `engine.state()` — so every Alpine display
 * expression that calls this re-renders when `recordFacts` writes a new
 * turn. Mirrors `five-oh-one-play.data.ts`'s `foldLegState`.
 */
function foldRoundState(turns: TurnFact[]): OneTwentyOneState {
  return turns.reduce(
    (state, turn) =>
      applyOneTwentyOneVisit(state, {
        scoreAttempted: turn.totalScore,
        finishedOnDouble: true,
      }),
    initialOneTwentyOneState(),
  );
}

/**
 * The engine owns the fact log while a session is live; the store mirrors
 * it. Upload paths that can run without a live engine (a completion retry
 * driven straight from the results modal) fall back to the persisted
 * mirror — mirrors `five-oh-one-play.data.ts`'s `currentFacts`.
 */
function currentFacts(context: OneTwentyOnePlayContext): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
}

/**
 * Session-wide summary for the results modal. `target` is the cap target the
 * winning checkout landed on (always 170 — `uploadAndCompleteSession` only
 * ever runs on the completion path). `visits` and `average` are session-wide,
 * mirroring 501's per-match stats.
 */
function computeStats(turns: TurnFact[]): {
  target: number;
  visits: number;
  average: number;
} {
  const total = turns.reduce((sum, turn) => sum + turn.totalScore, 0);
  return {
    target: 170,
    visits: turns.length,
    average: turns.length === 0 ? 0 : total / turns.length,
  };
}

/**
 * `self` exists only so the reactive `this` a directive-driven call binds is
 * reachable from closures built before Alpine wraps this factory's returned
 * object in `reactive()` — mirrors `five-oh-one-play.data.ts`'s own `self`
 * pattern (121 has no board input, so no closure actually needs it yet, but
 * `init()` assigning it keeps the two play-data modules structurally
 * parallel for future board-capture work).
 */
export function oneTwentyOnePlay() {
  let self: OneTwentyOnePlayContext;

  return {
    scoreInput: new ScoreInputBuffer({ maxLength: 3 }),
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
    resultsSnapshot: null as {
      target: number;
      visits: number;
      average: number;
    } | null,
    pendingCheckoutScore: null as number | null,
    showDoubleConfirm: false,
    showSessionFinishConfirm: false,
    engine: null as OneTwentyOneEngine | null,

    turnsInCurrentRound(this: OneTwentyOnePlayContext): TurnFact[] {
      const openRound = this.$store.game.stages.at(-1);
      if (!openRound) return [];
      return this.$store.game.turns.filter(
        (turn) => turn.stageClientKey === openRound.clientKey,
      );
    },

    remainingInAttempt(this: OneTwentyOnePlayContext): number {
      return foldRoundState(this.turnsInCurrentRound()).remainingInAttempt;
    },

    /**
     * The ladder position, folded over the *whole* session's turns (not just
     * the open round, unlike `remainingInAttempt`) — `currentTarget` only
     * moves on a checkout, so it cannot be read off a single round's turns
     * once an earlier round has already climbed it.
     */
    currentTargetLabel(this: OneTwentyOnePlayContext): string {
      return String(
        this.$store.game.turns.reduce(
          (state, turn) =>
            applyOneTwentyOneVisit(state, {
              scoreAttempted: turn.totalScore,
              finishedOnDouble: true,
            }),
          initialOneTwentyOneState(),
        ).currentTarget,
      );
    },

    checkoutHint(this: OneTwentyOnePlayContext): string {
      const path = checkoutPathFor(this.remainingInAttempt());
      return path ? path.join(" ") : "";
    },

    visitsThisAttempt(this: OneTwentyOnePlayContext): number {
      return foldRoundState(this.turnsInCurrentRound()).visitsThisAttempt;
    },

    dartsThrownThisSession(this: OneTwentyOnePlayContext): number {
      return dartsThrownCount(this.$store.game.turns, DARTS_PER_VISIT);
    },

    async init(this: OneTwentyOnePlayContext) {
      self = this;
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        const result = await reconcileActiveSession(
          GAME_TYPE_KEY,
          this.$store.game.sessionId,
          activeSessions,
          this.$store.game,
        );

        if (result.action === "abandon_failed") {
          this.reconciliationFailed = true;
          this.hasActiveSession = false;
          return;
        }
        this.reconciliationFailed = false;

        if (result.action === "no_active" || !result.activeSession) {
          this.hasActiveSession = false;
          return;
        }

        this.$store.game.setSessionModes(result.activeSession);

        const config = this.$store.game.configSnapshot;
        const engine = resumeEngine(this.$store.game);
        if (!config || !engine) {
          this.hasActiveSession = false;
          return;
        }
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());
        this.hasActiveSession = true;
      } catch {
        this.reconciliationFailed = true;
        this.hasActiveSession = false;
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async retryReconciliation(this: OneTwentyOnePlayContext) {
      await this.init();
    },

    /**
     * Folds one visit into the engine's fact log, then checks for a session
     * win. Shared by the plain-reduction path (`submitVisit`) and both
     * double-confirm resolutions (`confirmDouble`/`denyDouble`) so the
     * record → mirror → complete sequence exists exactly once.
     */
    async recordVisit(
      this: OneTwentyOnePlayContext,
      score: number,
      finishedOnDouble: boolean,
    ) {
      if (!this.engine) return;
      try {
        this.engine.record({ scoreAttempted: score, finishedOnDouble });
      } catch (err: unknown) {
        this.error = (err as Error).message;
        this.loading = false;
        return;
      }
      this.error = "";
      this.scoreInput.clear();
      this.$store.game.recordFacts(this.engine.facts());
      this.loading = false;

      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
    },

    /**
     * 121 is double-out but this app only captures a visit's total, not
     * individual darts — so when the entered score would bring the attempt's
     * remaining total to exactly 0, the app cannot know from the number alone
     * whether the last dart was a double (a checkout) or not (a bust).
     * `isCheckoutAttempt` gates a "Finished on a double?" confirm before
     * anything is recorded; every other visit records immediately.
     * `checkoutPathFor` narrows that gate to remainders a double-out finish
     * can actually reach, mirroring `five-oh-one-play.data.ts`'s
     * `submitVisit`.
     */
    async submitVisit(this: OneTwentyOnePlayContext) {
      if (
        !this.engine ||
        this.finished ||
        this.showDoubleConfirm ||
        this.showSessionFinishConfirm
      )
        return;
      this.loading = true;

      const score = Number(this.scoreInput.value);
      const remaining = this.remainingInAttempt();
      const isCheckoutAttempt =
        remaining - score === 0 &&
        score <= 180 &&
        checkoutPathFor(remaining) !== null;

      if (isCheckoutAttempt) {
        this.error = "";
        this.pendingCheckoutScore = score;
        this.scoreInput.clear();
        this.showDoubleConfirm = true;
        this.loading = false;
        return;
      }

      await this.recordVisit(score, false);
    },

    /**
     * "Yes" on the double-out confirm. A checkout that only climbs the
     * ladder records immediately. A checkout at the cap target (170) wins the
     * whole session and is irreversible once uploaded, so this asks
     * `engine.wouldComplete` and opens a second confirm instead of recording
     * right away, mirroring `five-oh-one-play.data.ts`'s `confirmDouble`.
     */
    async confirmDouble(this: OneTwentyOnePlayContext) {
      if (!this.engine || this.finished || !this.showDoubleConfirm) return;
      if (this.pendingCheckoutScore == null) return;
      const score = this.pendingCheckoutScore;

      if (
        this.engine.wouldComplete({
          scoreAttempted: score,
          finishedOnDouble: true,
        })
      ) {
        this.showDoubleConfirm = false;
        this.showSessionFinishConfirm = true;
        return;
      }

      this.pendingCheckoutScore = null;
      this.showDoubleConfirm = false;
      await this.recordVisit(score, true);
    },

    async denyDouble(this: OneTwentyOnePlayContext) {
      if (!this.showDoubleConfirm || this.pendingCheckoutScore == null) return;
      const score = this.pendingCheckoutScore;
      this.pendingCheckoutScore = null;
      this.showDoubleConfirm = false;
      await this.recordVisit(score, false);
    },

    cancelCheckout(this: OneTwentyOnePlayContext) {
      if (!this.showDoubleConfirm || this.pendingCheckoutScore == null) return;
      this.scoreInput.setValue(String(this.pendingCheckoutScore));
      this.pendingCheckoutScore = null;
      this.showDoubleConfirm = false;
    },

    /**
     * Confirm on the second, session-ending dialog: records the checkout
     * `confirmDouble` deferred, which drives `recordVisit`'s own completion
     * check and upload.
     */
    async confirmSessionFinish(this: OneTwentyOnePlayContext) {
      if (!this.engine || this.finished || !this.showSessionFinishConfirm)
        return;
      if (this.pendingCheckoutScore == null) return;
      const score = this.pendingCheckoutScore;
      this.pendingCheckoutScore = null;
      this.showSessionFinishConfirm = false;
      await this.recordVisit(score, true);
    },

    cancelSessionFinish(this: OneTwentyOnePlayContext) {
      if (!this.showSessionFinishConfirm) return;
      if (this.pendingCheckoutScore == null) return;
      this.scoreInput.setValue(String(this.pendingCheckoutScore));
      this.pendingCheckoutScore = null;
      this.showSessionFinishConfirm = false;
    },

    undoVisit(this: OneTwentyOnePlayContext) {
      if (this.finished || this.showDoubleConfirm || this.showSessionFinishConfirm)
        return;
      if (!this.engine || !this.engine.undo()) return;

      this.$store.game.recordFacts(this.engine.facts());
      this.scoreInput.clear();
      this.error = "";
    },

    /**
     * Uploads the fact log, then marks the session COMPLETED. On this path
     * only, SESSION_ALREADY_COMPLETED counts as success. Stats are copied
     * into `resultsSnapshot` before any store mutation so the results modal
     * never depends on `$store.game.turns` surviving a later reset.
     */
    async uploadAndCompleteSession(this: OneTwentyOnePlayContext): Promise<void> {
      const sessionId = this.$store.game.sessionId!;

      if (!this.$store.game.idempotencyKey) {
        this.$store.game.idempotencyKey = crypto.randomUUID();
      }
      const idempotencyKey = this.$store.game.idempotencyKey;

      this.completionStatus = "saving";
      this.completionError = "";

      try {
        const batch = buildEventsBatch(
          this.$store.game.participantRef!,
          currentFacts(this),
        );
        await appendBatch(sessionId, idempotencyKey, batch);
        await completeSession(sessionId, "COMPLETED");
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        const alreadyCompleted =
          error.code === "SESSION_ALREADY_COMPLETED" ||
          error.message?.includes("SESSION_ALREADY_COMPLETED");
        if (!alreadyCompleted) {
          this.completionError =
            "Could not save your game. Check your connection and retry.";
          this.completionStatus = "failed";
          return;
        }
      }

      this.resultsSnapshot = computeStats(this.$store.game.turns);
      this.completionStatus = "succeeded";
    },

    async back(this: OneTwentyOnePlayContext) {
      this.$store.game.reset();
      globalThis.location.href = "/games";
    },

    async abandonAndExit(this: OneTwentyOnePlayContext) {
      if (this.$store.game.loading) return;
      const sessionId = this.$store.game.sessionId;
      if (!sessionId) {
        this.$store.game.reset();
        globalThis.location.href = "/games";
        return;
      }
      this.$store.game.loading = true;
      this.error = "";
      try {
        const facts = currentFacts(this);
        if (facts.turns.length > 0) {
          if (!this.$store.game.idempotencyKey) {
            this.$store.game.idempotencyKey = crypto.randomUUID();
          }
          const batch = buildEventsBatch(
            this.$store.game.participantRef!,
            facts,
          );
          await appendBatch(sessionId, this.$store.game.idempotencyKey, batch);
        }
        await completeSession(sessionId, "ABANDONED");
        this.$store.game.reset();
        globalThis.location.href = "/games";
      } catch {
        this.error = "Could not abandon session. Try again.";
        this.$store.game.loading = false;
      }
    },

    /**
     * Replays the same configuration template the first session used — 121
     * has zero editable settings, so no overrides.
     */
    async playAgain(this: OneTwentyOnePlayContext) {
      const config = this.$store.game.configSnapshot;
      const templateRef = this.$store.game.templateRef;
      if (!config || !templateRef || this.playAgainLoading) return;
      const factory = getEngineFactory(RULESET_VERSION_KEY);
      if (!factory) return;

      this.playAgainLoading = true;
      this.playAgainError = "";

      const modePair = resolveSessionModePair(
        RULESET_VERSION_KEY,
        this.$store.settings,
      );

      try {
        let session;
        try {
          session = await createSession({
            gameTypeKey: GAME_TYPE_KEY,
            rulesetVersionKey: RULESET_VERSION_KEY,
            captureModeKey: modePair.captureModeKey,
            inputModeKey: modePair.inputModeKey,
            config: { source: "template", templateRef },
          });
        } catch {
          this.playAgainError = "Could not start a new session. Try again.";
          return;
        }

        this.$store.game.sessionId = session.sessionId;
        this.$store.game.participantRef = session.participants[0].ref;
        this.$store.game.idempotencyKey = null;
        this.$store.game.setSessionModes(modePair);

        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.pendingCheckoutScore = null;
        this.showDoubleConfirm = false;
        this.showSessionFinishConfirm = false;
        this.scoreInput.clear();
        this.error = "";
        this.hasActiveSession = true;

        const engine = factory.create(config);
        if (!(engine instanceof OneTwentyOneEngine)) return;
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());
      } finally {
        this.playAgainLoading = false;
      }
    },
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts`
Expected: PASS.

- [ ] **Step 6: Create the interface component**

Create `app/src/components/layout/games/interfaces/OneTwentyOne.astro`:

```astro
---
interface Props {
  [key: string]: unknown;
}

const { ...props }: Props = Astro.props;

import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import ScoreInput from "@components/layout/games/ScoreInput.astro";
import StatRow from "@components/layout/games/StatRow.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
  <SinglePlayerDisplay
    isTarget={true}
    target="remainingInAttempt()"
    class="max-h-2/5 h-full"
  >
    <div
      slot="progress"
      class="mt-2 flex w-full flex-col items-center gap-2 px-4"
    >
      <p
        class="text-sm font-mono font-semibold text-accent"
        x-show="checkoutHint()"
        x-text="checkoutHint()"
        x-cloak
      >
      </p>
      <dl class="w-full space-y-1">
        <StatRow
          label="Target"
          value="currentTargetLabel()"
        />
        <StatRow
          label="Visit"
          value="(visitsThisAttempt() + 1) + ' / 3'"
        />
        <StatRow
          label="Darts"
          value="dartsThrownThisSession()"
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

  <ScoreInput
    value="scoreInput.value"
    digitHandler="scoreInput.appendDigit"
    onDelete="scoreInput.deleteLast($event)"
    onSubmit="submitVisit()"
    submitDisabled="!scoreInput.value || showDoubleConfirm || showSessionFinishConfirm || finished"
    padDisabled="showDoubleConfirm || showSessionFinishConfirm || finished"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showDoubleConfirm || showSessionFinishConfirm || finished"
  />
</div>
```

`currentTargetLabel()` is defined on the play-data module in Step 4 above, alongside `remainingInAttempt` — it folds the *whole* session's turns (not just the open round) through `applyOneTwentyOneVisit`, since `currentTarget` only moves on a checkout and cannot be read off a single round's turns once an earlier round has already climbed it.

- [ ] **Step 7: Create the results modal**

Create `app/src/components/layout/games/result-modals/OneTwentyOneResults.astro`:

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
      170 checked out!
    </h2>

    <dl
      class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
      x-show="completionStatus === 'succeeded' && resultsSnapshot"
      x-cloak
    >
      <StatRow
        label="Visits"
        value="resultsSnapshot?.visits"
      />
      <StatRow
        label="Average"
        value="resultsSnapshot?.average.toFixed(1)"
      />
    </dl>

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
      <p
        class="text-sm text-success"
        x-show="completionStatus === 'succeeded'"
        x-cloak
      >
        Saved!
      </p>
    </div>

    <p
      class="alert alert-error mt-2 rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
      role="alert"
      x-text="playAgainError"
      x-show="playAgainError"
      x-cloak
    >
    </p>

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

- [ ] **Step 8: Create the play page**

Create `app/src/pages/games/121/play/index.astro`:

```astro
---
export const prerender = true;
import GameLayout from "@layouts/GameLayout.astro";
import OneTwentyOne from "@components/layout/games/interfaces/OneTwentyOne.astro";
import DoubleCheckoutConfirm from "@components/layout/games/DoubleCheckoutConfirm.astro";
import ConfirmDialog from "@components/ui/ConfirmDialog.astro";
import OneTwentyOneResults from "@components/layout/games/result-modals/OneTwentyOneResults.astro";
import NoSessionPanel from "@components/layout/games/NoSessionPanel.astro";
import ReconciliationBlocked from "@components/layout/games/ReconciliationBlocked.astro";
---

<GameLayout
  title="121 — Play"
  gameTitle="121"
>
  <div
    class="flex flex-col flex-1 min-h-0 p-3"
    x-data="oneTwentyOnePlay()"
    @confirm-exit.window="abandonAndExit()"
  >
    {/* Loading / reconciliation-blocked */}
    <ReconciliationBlocked />

    {/* No active session view */}
    <NoSessionPanel href="/games/121/setup" />

    {/* Gameplay view */}
    <OneTwentyOne
      x-show="!finished && hasActiveSession"
      x-cloak
    />

    {
      /* Double-out confirm — 121 can only know a checkout from a bust by asking */
    }
    <div
      x-show="showDoubleConfirm"
      x-cloak
    >
      <DoubleCheckoutConfirm />
    </div>

    {
      /* Session-finish confirm — a "Yes" here uploads and completes the whole session, so it gets its own irreversible-action confirm rather than recording straight from the first dialog */
    }
    <div
      x-show="showSessionFinishConfirm"
      x-cloak
    >
      <ConfirmDialog
        titleId="session-finish-confirm-title"
        title="Check out 170?"
        description="This checkout wins the session. Confirm to save and finish, or cancel to reconsider."
        cancelLabel="Cancel"
        onCancel="cancelSessionFinish()"
        onConfirm="confirmSessionFinish()"
        dismissible={false}
      />
    </div>

    {/* Results modal (overlay) */}
    <OneTwentyOneResults />
  </div>
</GameLayout>
```

- [ ] **Step 9: Format, typecheck, and run the full frontend suite for 121**

Run:
```bash
cd app && npm run format
npx astro check
npx vitest run tests/lib/game/one-twenty-one-setup.data.test.ts tests/lib/game/one-twenty-one-play.data.test.ts tests/lib/game/rulesets/
```
Expected: format clean, no new typecheck errors, all tests PASS.

- [ ] **Step 10: Commit**

```bash
git add app/src/lib/game/types.ts \
  app/src/lib/game/one-twenty-one-play.data.ts \
  app/tests/lib/game/one-twenty-one-play.data.test.ts \
  app/src/components/layout/games/interfaces/OneTwentyOne.astro \
  app/src/components/layout/games/result-modals/OneTwentyOneResults.astro \
  app/src/pages/games/121/play/index.astro
git commit -m "feat(121): add play flow"
```

---

## Task 6: Final validation and context maintenance

**Files:** none (verification only).

- [ ] **Step 1: Run the full validation sequence**

Run: `cd app && npm run validate:app`
Expected: PASS (db:status, db:migrate, db:introspect, fallow, tests, astro check, graph refresh all green — note this requires a real Neon dev database; run `npm run env:dev` first per `app/CLAUDE.md` if not already configured).

- [ ] **Step 2: Run the structural gates**

Run: `bash scripts/check-game-engines.sh && bash scripts/check-file-locations.sh && bash scripts/check-astro-conventions.sh && bash scripts/check-style-tokens.sh`
Expected: all `OK`, exit code 0. (Or invoke the `run-all-gates` skill, which dispatches the full changed-area gate set automatically.)

- [ ] **Step 3: Seed the dev database and run the live verification scripts**

Run:
```bash
npm run db:seed
psql "$DATABASE_URL" -f database/verification/0009_121_capability_checks.sql
```
Expected: `ALL 3 CHECKS PASSED`.

- [ ] **Step 4: Manual smoke test in the browser**

Run: `cd app && astro dev --background`, then visit `/games` and confirm the "121" card appears, `/games/121/setup` shows the info card with no settings and a working Start button, and `/games/121/play`:
- records an ordinary visit via the keypad
- triggers the double-confirm dialog on a checkout-reachable remainder, both "Yes" (climbs target) and "Bust / miss" (stays, remaining unchanged) paths
- exhausts a 3-visit budget without checking out and confirms the target stays the same with a fresh budget
- undo removes the last visit correctly
- (fastest way to reach the cap-target session-finish dialog: play several attempts checking out immediately, or temporarily lower `CAP_TARGET` in a local scratch build — do not ship a lowered cap)

Stop the dev server after: `astro dev stop`.

- [ ] **Step 5: Run the `context-maintenance` skill**

Invoke the `context-maintenance` skill per root `CLAUDE.md`'s mandatory-every-task rule: registers 121 in `docs/architecture/00-Context-Map.md`'s version history, checks whether `app/CLAUDE.md`/other `CLAUDE.md` files need a note (e.g. if this plan's `OneTwentyOneResultsSnapshot`/`play-lifecycle.ts`-doesn't-apply distinction reveals a documentation gap worth recording), and appends a `decisions/**` entry if a real decision was made worth recording (e.g. the `remainingInAttempt` state-shape clarification, or the "not `play-lifecycle.ts`" precedent note for future QUICK_SCORE-with-dialogs games).

- [ ] **Step 6: Final commit (if context-maintenance produced changes)**

```bash
git add -A
git commit -m "docs(121): context maintenance — register 121 v1 in context map and decisions"
```

- [ ] **Step 7: Hand off**

Invoke the `finishing-a-development-branch` skill to decide how to integrate `claude/shanghai-v1-implementation-2f8ndd` into `main` (PR, merge, or further work), per root `CLAUDE.md`'s "every task uses a dedicated branch... integrated into `main` via PR promptly" rule.
