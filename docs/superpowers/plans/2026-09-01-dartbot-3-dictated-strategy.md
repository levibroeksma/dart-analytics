# DartBot Phase 3 — Dictated Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `DictatedStrategy` — the target-selection layer for the five rulesets that dictate their own next target rather than letting the thrower choose one — and prove, in memory, that phase 1's throw engine plus this strategy can play a full session of each of those five rulesets to completion through the real `GameEngine.record()` contract, with nothing persisted.

**Architecture:** One pure-function module, `modules/dartbot/strategy/dictated.strategy.module.ts`, converts the ruleset's own next `BoardTarget` (`{ kind: "NUMBER" | "DOUBLE" | "BULL" }`, already shared across all nine engines via `@modules/game/board-progression.module`) into a `ThrowIntent` phase 1's `resolveAimPoint`/`throwDart` already consume. A new `DictatedView` interface, declared in `modules/dartbot/interfaces.ts` alongside `DartRng`, is the strategy's only input — it carries just the one `BoardTarget`, nothing about seats, engines or state shape. Five contract tests each drive one real ruleset engine (`aroundTheClockEngineFactory`, `bobs27EngineFactory`, `shanghaiEngineFactory`, `doublesTrainingEngineFactory`, `singlesTrainingEngineFactory`) through a shared, test-only harness that loops `state → target → chooseTarget → throwDart → record` until `engine.isComplete()`, using only phase 1's shipped modules and this phase's strategy — no API client, no `DartBot` class (that is phase 6's job, per `08-DartBot.md` "only its last task ... constructs a `DartBot`"), no persistence. This plan implements phase 3 of `docs/superpowers/specs/2026-09-01-dartbot-v1-delivery-design.md`, scoped from `docs/architecture/08-DartBot.md` §Strategy Layer and Game Coverage, §GameView contracts, the "per-ruleset throw engine" Anti-Patterns row, and the "Contract" Test Strategy row.

**Tech Stack:** TypeScript, Vitest, phase 1's `app/src/modules/dartbot/*` modules (`@modules/dartbot/rng.module`, `skill-profile.module`, `throw-engine.module`), the shipped ruleset engines and `@modules/game/board-progression.module`.

## Global Constraints

- `Math.random()` never appears in `modules/dartbot/` (`08-DartBot.md` §Determinism and Replay).
- `modules/dartbot/strategy/dictated.strategy.module.ts` imports only `@modules/types` (for `BoardTarget`) and its own folder's `interfaces.ts`/`types.ts` — never an engine, a ruleset snapshot type, or `@modules/game/board-progression.module`'s functions (`08-DartBot.md` §Import direction: "It imports no engine, and no engine imports it — the page wires the two together"). Resolving a `BoardTarget` from engine state is the test harness's job in this phase, standing in for the page adapter a later phase builds.
- The strategy never reads, computes, or steers toward a score (`08-DartBot.md` §Guiding Principle) — it converts a target, nothing else.
- A `type`-only import consumed from outside `modules/dartbot/` goes through the raised area barrel (`@lib/types`, `@modules/types`, `@modules/interfaces`) — never a deep alias into the defining folder; a VALUE import keeps its direct module path (`scripts/check-type-barrels.sh`).
- This also binds *inside* `modules/dartbot/`: `strategy/dictated.strategy.module.ts` is a subfolder of `dartbot/`, so a relative barrel import from it — `../interfaces`, `../types` — reaches past its own folder exactly as a deep alias would (rule 4 of `scripts/check-type-barrels.sh`, verified against this file while drafting this plan) and fails the gate. Use the aliased `@modules/interfaces` / `@modules/types` from any file that is not itself directly inside `modules/dartbot/`; relative `./types` / `./interfaces` is only for files in `modules/dartbot/` itself.
- Type and interface declarations go in the folder's `types.ts` / `interfaces.ts` barrels — never inline `export type` in a `.module.ts` (`08-DartBot.md` §Module Boundary).
- No `//` or `/* */` comments inside function bodies anywhere under `app/src/**/*.ts` (`app/CLAUDE.md`); the shared test harness lives under `app/tests/`, exempt from that rule, but JSDoc above a declaration is still house style. `dictated.strategy.module.ts` itself is under `app/src/` and follows the rule.
- Tests live under `app/tests/`, mirroring `app/src/` (`app/CLAUDE.md`); the shared harness is test-only support code with no `app/src/` mirror to maintain, exactly like phase 2's `simulate-tier.ts`/`distribution-compare.ts` precedent.
- A source edit with no test edit is not a completed task — every `.ts` file under `app/src/` needs a covering test (`app/CLAUDE.md`, D224).
- No DartBot class, no seat admission, no engine wiring beyond calling the existing `GameEngineFactory.create()`/`GameEngine.record()` contract directly — those are phases 4-7 (`docs/superpowers/specs/2026-09-01-dartbot-v1-delivery-design.md` §V1 Scope).
- Done means `cd app && npm run validate:app` exits zero with 0 errors/warnings/hints (`app/CLAUDE.md`).
- Run `cd app && npm run format` before considering any task's diff final.
- This repo does not use git worktrees — check out the task branch directly (`git checkout -b dartbot-3-dictated-strategy`) in the main working copy.
- Every task uses a dedicated branch; do not merge to `main` directly (root `CLAUDE.md` Hard Invariants).
- This branch is a single hop off `main`, not stacked on `dartbot-1-throw-engine` or `dartbot-2-calibration` (both already merged) — the delivery design's plan-sequencing table requires phases 1 and 2 to be merged to `main` before this branch is cut (root `CLAUDE.md` branch-stacking cap).

---

## File Structure

```
app/src/modules/dartbot/
├── interfaces.ts                          # + DictatedView
└── strategy/
    └── dictated.strategy.module.ts         # chooseTarget(view) -> ThrowIntent

app/tests/modules/dartbot/
├── strategy/
│   └── dictated.strategy.module.test.ts
└── harness/
    ├── play-dictated-session.ts            # drives one engine to completion
    ├── around-the-clock.contract.test.ts
    ├── shanghai.contract.test.ts
    ├── singles-training.contract.test.ts
    ├── bobs27.contract.test.ts
    └── doubles-training.contract.test.ts
```

`play-dictated-session.ts` is a plain `.ts` file, not `.test.ts` — Vitest's `include: ["tests/**/*.test.ts"]` does not collect it, exactly like phase 2's `simulate-tier.ts` precedent. Each of the five contract test files has exactly one ruleset as its responsibility; all five consume the one shared harness.

---

### Task 1: `DictatedView` and `chooseTarget()`

Converts a ruleset's own next `BoardTarget` into the `ThrowIntent` phase 1's `resolveAimPoint`/`throwDart` consume (`08-DartBot.md` §Strategy Layer and Game Coverage: "Five of nine rulesets dictate their own target, so `DictatedStrategy` is near-free once the engine exists").

**Files:**
- Modify: `app/src/modules/dartbot/interfaces.ts`
- Create: `app/src/modules/dartbot/strategy/dictated.strategy.module.ts`
- Test: `app/tests/modules/dartbot/strategy/dictated.strategy.module.test.ts`

**Interfaces:**
- Consumes: `ThrowIntent` (`@modules/dartbot/types`, phase 1), `BoardTarget` (`@modules/types`)
- Produces: `DictatedView` interface, `chooseTarget(view: DictatedView): ThrowIntent`

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/modules/dartbot/strategy/dictated.strategy.module.test.ts
import { describe, expect, it } from "vitest";
import { zoneCentroid } from "@lib/game/board/board-geometry.module";
import { chooseTarget } from "@modules/dartbot/strategy/dictated.strategy.module";

describe("chooseTarget", () => {
  it("aims a NUMBER target at that number's outer single", () => {
    const intent = chooseTarget({ target: { kind: "NUMBER", number: 14 } });
    expect(intent).toEqual({ targetNumber: 14, zoneKey: "OUTER_SINGLE" });
    expect(zoneCentroid(intent.targetNumber, intent.zoneKey)).not.toBeNull();
  });

  it("aims a DOUBLE target at that number's double", () => {
    const intent = chooseTarget({ target: { kind: "DOUBLE", number: 20 } });
    expect(intent).toEqual({ targetNumber: 20, zoneKey: "DOUBLE" });
    expect(zoneCentroid(intent.targetNumber, intent.zoneKey)).not.toBeNull();
  });

  it("aims a BULL target at the inner bull, target number 25", () => {
    const intent = chooseTarget({ target: { kind: "BULL" } });
    expect(intent).toEqual({ targetNumber: 25, zoneKey: "INNER_BULL" });
    expect(zoneCentroid(intent.targetNumber, intent.zoneKey)).toEqual({
      x: 0,
      y: 0,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/dartbot/strategy/dictated.strategy.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/dartbot/strategy/dictated.strategy.module'`

- [ ] **Step 3: Add `DictatedView` to interfaces.ts**

```typescript
// app/src/modules/dartbot/interfaces.ts — add below DartRng
import type { BoardTarget } from "@modules/types";

/**
 * Read-only view a dictated-target ruleset hands the strategy: the one
 * `BoardTarget` its own progression currently points at. The app's adapter
 * resolves this from engine state (`targetAt(path, seat.targetIndex)`); the
 * strategy never reads seat state or engine state itself.
 */
export interface DictatedView {
  target: BoardTarget;
}
```

- [ ] **Step 4: Write the implementation**

```typescript
// app/src/modules/dartbot/strategy/dictated.strategy.module.ts
import type { DictatedView } from "@modules/interfaces";
import type { ThrowIntent } from "@modules/types";

/**
 * The bull's board number, mirroring `BULL_TARGET_NUMBER` in
 * `@modules/game/board-progression.module` — kept as a local literal rather
 * than an import, since `modules/dartbot/*` may import `@modules/game/types`
 * but not `@modules/game/board-progression.module` (08-DartBot.md §Import
 * direction).
 */
const BULL_TARGET_NUMBER = 25;

/**
 * Converts the ruleset's own next `BoardTarget` into a `ThrowIntent`, for the
 * five rulesets that dictate their own target rather than letting the player
 * (or bot) choose one. A `NUMBER` target aims at the outer single — the
 * largest bed on that number, and the one a real player picks when told
 * "hit 14" with no zone specified. A `DOUBLE` target aims at that double
 * exactly, matching `isHitOn`'s strict double-only check. `BULL` aims at the
 * inner bull; `classify()` reports `targetNumber: 25` for a landing anywhere
 * in either bull ring, so a wide scatter still resolves to a real hit.
 */
export function chooseTarget(view: DictatedView): ThrowIntent {
  const { target } = view;
  if (target.kind === "BULL") {
    return { targetNumber: BULL_TARGET_NUMBER, zoneKey: "INNER_BULL" };
  }
  if (target.kind === "DOUBLE") {
    return { targetNumber: target.number, zoneKey: "DOUBLE" };
  }
  return { targetNumber: target.number, zoneKey: "OUTER_SINGLE" };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/dartbot/strategy/dictated.strategy.module.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/dartbot/interfaces.ts app/src/modules/dartbot/strategy/dictated.strategy.module.ts app/tests/modules/dartbot/strategy/dictated.strategy.module.test.ts
git commit -m "feat: add DartBot dictated-target strategy"
```

---

### Task 2: Shared in-memory play harness

One generic loop that drives any `GameEngine<DartObservation, TState>` to completion using `chooseTarget` and phase 1's `throwDart`, given only a per-ruleset function that reads the next `BoardTarget` off that engine's `state()`. Shared across Tasks 3-4 rather than five copies of the same loop (`08-DartBot.md` Anti-Patterns: "A per-ruleset throw engine — skill is ruleset-independent; only target selection varies", the same DRY principle applied one layer up to the drive loop itself).

**Files:**
- Create: `app/tests/modules/dartbot/harness/play-dictated-session.ts`

**Interfaces:**
- Consumes: `createDartRng`, `skillProfileForLevel`, `throwDart` (`@modules/dartbot/*`, phase 1), `chooseTarget` (Task 1), `GameEngine`, `DartObservation`, `BoardTarget` (`@modules/types`, `@modules/interfaces`)
- Produces: `playDictatedSessionToCompletion<TState>(engine, targetForState, level, seed, maxDarts?): { dartsThrown: number; state: TState }`

- [ ] **Step 1: Write the implementation**

No separate failing-test step for this task: it is test-support code with no independent behaviour of its own to assert against — its correctness is proven by Task 3/4's five contract tests, which is also how phase 2's `simulate-tier.ts`/`distribution-compare.ts` were introduced (no standalone test for the harness file itself, only for its consumers).

```typescript
// app/tests/modules/dartbot/harness/play-dictated-session.ts
import { createDartRng } from "@modules/dartbot/rng.module";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { throwDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/dictated.strategy.module";
import type { BoardTarget, DartObservation } from "@modules/types";
import type { GameEngine } from "@modules/interfaces";

/**
 * The most darts this harness will throw before giving up on a session ever
 * completing. Measured completion counts for all five dictated rulesets at
 * level 1 (the slowest tier) are 15-78 darts (see this plan's Self-Review);
 * 500 leaves roughly 6x headroom over the largest of those so a genuine
 * infinite-loop regression in the strategy or the engine still fails fast
 * rather than hanging the suite.
 */
const MAX_DARTS = 500;

export type DictatedSessionResult<TState> = {
  dartsThrown: number;
  state: TState;
};

/**
 * Drives `engine` to completion by repeatedly reading its next `BoardTarget`
 * via `targetForState`, converting it to a `ThrowIntent` through
 * `chooseTarget`, throwing it through phase 1's deterministic `throwDart`,
 * and recording the resulting `DartObservation` — the same join point a real
 * page uses (`08-DartBot.md` §Position in the System). Nothing here is
 * persisted; `engine.record()` is the real ruleset's own contract, so a
 * `record()` that rejects the emitted observation throws out of this
 * function rather than being swallowed.
 * @throws if the session has not completed after `maxDarts` darts.
 */
export function playDictatedSessionToCompletion<TState>(
  engine: GameEngine<DartObservation, TState>,
  targetForState: (state: TState) => BoardTarget,
  level: number,
  seed: number,
  maxDarts: number = MAX_DARTS,
): DictatedSessionResult<TState> {
  const profile = skillProfileForLevel(level);
  let dartIndex = 0;

  while (!engine.isComplete()) {
    if (dartIndex >= maxDarts) {
      throw new Error(
        `Session did not complete within ${maxDarts} darts (level ${level}, seed ${seed})`,
      );
    }
    const target = targetForState(engine.state());
    const intent = chooseTarget({ target });
    const rng = createDartRng(seed, dartIndex);
    const thrown = throwDart(intent, profile, rng);
    const observation: DartObservation = {
      hitTargetNumber: thrown.hit.targetNumber,
      hitZoneKey: thrown.hit.zoneKey,
      locationX: thrown.landing.x,
      locationY: thrown.landing.y,
    };
    engine.record(observation);
    dartIndex++;
  }

  return { dartsThrown: dartIndex, state: engine.state() };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/tests/modules/dartbot/harness/play-dictated-session.ts
git commit -m "test: add DartBot dictated-session play harness"
```

---

### Task 3: Contract tests — the three `numbersPath` rulesets

Around the Clock, Shanghai and Singles Training all walk `numbersPath()` by `targetIndex`, aiming at a plain number each round (`08-DartBot.md` §Strategy Layer and Game Coverage table). Each test builds a solo one-seat session with the exact config shape that engine's own test suite already uses, drives it to completion through Task 2's harness, and asserts the session actually finished with no `record()` rejection — the "Contract" row's guarantee (`08-DartBot.md` §Test Strategy: "Every emitted `DartObservation` is accepted by the target engine's `record()`").

**Files:**
- Create: `app/tests/modules/dartbot/harness/around-the-clock.contract.test.ts`
- Create: `app/tests/modules/dartbot/harness/shanghai.contract.test.ts`
- Create: `app/tests/modules/dartbot/harness/singles-training.contract.test.ts`

**Interfaces:**
- Consumes: `playDictatedSessionToCompletion` (Task 2), `aroundTheClockEngineFactory`, `shanghaiEngineFactory`, `singlesTrainingEngineFactory` (`@modules/game/*.engine.module`, shipped), `numbersPath`, `targetAt` (`@modules/game/board-progression.module`, shipped)

- [ ] **Step 1: Write the Around the Clock contract test**

```typescript
// app/tests/modules/dartbot/harness/around-the-clock.contract.test.ts
import { describe, expect, it } from "vitest";
import { aroundTheClockEngineFactory } from "@modules/game/around-the-clock.engine.module";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import type { AroundTheClockState } from "@modules/types";
import { playDictatedSessionToCompletion } from "./play-dictated-session";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

function targetForState(state: AroundTheClockState) {
  return targetAt(numbersPath(), state.seats[0]!.targetIndex);
}

describe("Around the Clock — dictated strategy plays a full solo circuit", () => {
  it("completes at level 1 with every dart accepted by the real engine", () => {
    const engine = aroundTheClockEngineFactory.create({ seats: SEATS });
    const result = playDictatedSessionToCompletion(
      engine,
      targetForState,
      1,
      1,
    );
    expect(result.state.status).toBe("COMPLETE");
    expect(result.dartsThrown).toBeGreaterThan(0);
  });

  it("completes at level 15 in no more darts than level 1 needed", () => {
    const level1 = playDictatedSessionToCompletion(
      aroundTheClockEngineFactory.create({ seats: SEATS }),
      targetForState,
      1,
      2,
    );
    const level15 = playDictatedSessionToCompletion(
      aroundTheClockEngineFactory.create({ seats: SEATS }),
      targetForState,
      15,
      2,
    );
    expect(level15.state.status).toBe("COMPLETE");
    expect(level15.dartsThrown).toBeLessThanOrEqual(level1.dartsThrown);
  });
});
```

- [ ] **Step 2: Write the Shanghai contract test**

```typescript
// app/tests/modules/dartbot/harness/shanghai.contract.test.ts
import { describe, expect, it } from "vitest";
import { shanghaiEngineFactory } from "@modules/game/shanghai.engine.module";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import type { ShanghaiState } from "@modules/types";
import { playDictatedSessionToCompletion } from "./play-dictated-session";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

function targetForState(state: ShanghaiState) {
  return targetAt(numbersPath(), state.seats[0]!.targetIndex);
}

describe("Shanghai — dictated strategy plays a full solo round", () => {
  it("completes at level 1 with every dart accepted by the real engine", () => {
    const engine = shanghaiEngineFactory.create({ seats: SEATS });
    const result = playDictatedSessionToCompletion(
      engine,
      targetForState,
      1,
      1,
    );
    expect(["COMPLETE", "SHANGHAI"]).toContain(result.state.status);
    expect(result.dartsThrown).toBeGreaterThan(0);
  });

  it("completes at level 15 without exceeding the 20-round dart budget", () => {
    const result = playDictatedSessionToCompletion(
      shanghaiEngineFactory.create({ seats: SEATS }),
      targetForState,
      15,
      3,
    );
    expect(["COMPLETE", "SHANGHAI"]).toContain(result.state.status);
    expect(result.dartsThrown).toBeLessThanOrEqual(60);
  });
});
```

- [ ] **Step 3: Write the Singles Training contract test**

```typescript
// app/tests/modules/dartbot/harness/singles-training.contract.test.ts
import { describe, expect, it } from "vitest";
import { singlesTrainingEngineFactory } from "@modules/game/singles-training.engine.module";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import type { SinglesTrainingState } from "@modules/types";
import { playDictatedSessionToCompletion } from "./play-dictated-session";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const config = {
  orderMode: "LOW_TO_HIGH" as const,
  targetOrder: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
  ],
  difficulty: "EASY" as const,
  pointsSingle: 1,
  pointsDouble: 2,
  pointsTreble: 3,
  seats: SEATS,
};

function targetForState(state: SinglesTrainingState) {
  return targetAt(numbersPath(config.targetOrder), state.seats[0]!.targetIndex);
}

describe("Singles Training — dictated strategy plays a full solo round", () => {
  it("completes at level 1 with every dart accepted by the real engine", () => {
    const engine = singlesTrainingEngineFactory.create(config);
    const result = playDictatedSessionToCompletion(
      engine,
      targetForState,
      1,
      1,
    );
    expect(result.state.status).toBe("COMPLETE");
    expect(result.dartsThrown).toBe(63);
  });

  it("completes at level 15 in exactly the same dart count — every round always throws all 3", () => {
    const result = playDictatedSessionToCompletion(
      singlesTrainingEngineFactory.create(config),
      targetForState,
      15,
      4,
    );
    expect(result.state.status).toBe("COMPLETE");
    expect(result.dartsThrown).toBe(63);
  });
});
```

- [ ] **Step 4: Run all three and verify they pass**

```bash
cd app && npx vitest run tests/modules/dartbot/harness/around-the-clock.contract.test.ts tests/modules/dartbot/harness/shanghai.contract.test.ts tests/modules/dartbot/harness/singles-training.contract.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/tests/modules/dartbot/harness/around-the-clock.contract.test.ts app/tests/modules/dartbot/harness/shanghai.contract.test.ts app/tests/modules/dartbot/harness/singles-training.contract.test.ts
git commit -m "test: add DartBot contract tests for the three numbersPath rulesets"
```

---

### Task 4: Contract tests — the two `doublesPath` rulesets

Bob's 27 and Doubles Training both walk `doublesPath()` by `targetIndex`, aiming at a specific double each round. Bob's 27 can end in either `WON` or `LOST` — a bot weak enough to miss enough doubles busts out below zero, which is a legitimate terminal state, not a defect: the "playable in memory" gate is about reaching a decided completion through the real engine, not about winning.

**Files:**
- Create: `app/tests/modules/dartbot/harness/bobs27.contract.test.ts`
- Create: `app/tests/modules/dartbot/harness/doubles-training.contract.test.ts`

**Interfaces:**
- Consumes: `playDictatedSessionToCompletion` (Task 2), `bobs27EngineFactory`, `doublesTrainingEngineFactory` (`@modules/game/*.engine.module`, shipped), `doublesPath`, `targetAt` (`@modules/game/board-progression.module`, shipped)

- [ ] **Step 1: Write the Bob's 27 contract test**

```typescript
// app/tests/modules/dartbot/harness/bobs27.contract.test.ts
import { describe, expect, it } from "vitest";
import { bobs27EngineFactory } from "@modules/game/bobs27.engine.module";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import type { Bobs27State } from "@modules/types";
import { playDictatedSessionToCompletion } from "./play-dictated-session";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const config = {
  startScore: 27,
  bullHitValue: 50,
  missPenaltyMultiplier: 1,
  seats: SEATS,
};

function targetForState(state: Bobs27State) {
  return targetAt(doublesPath(), state.seats[0]!.targetIndex);
}

describe("Bob's 27 — dictated strategy plays a full solo round", () => {
  it("reaches a decided outcome at level 1 with every dart accepted by the real engine", () => {
    const engine = bobs27EngineFactory.create(config);
    const result = playDictatedSessionToCompletion(
      engine,
      targetForState,
      1,
      1,
    );
    expect(["WON", "LOST"]).toContain(result.state.status);
    expect(result.dartsThrown).toBeGreaterThan(0);
  });

  it("wins at level 15 — accurate-enough doubles never bust the score below zero", () => {
    const result = playDictatedSessionToCompletion(
      bobs27EngineFactory.create(config),
      targetForState,
      15,
      5,
    );
    expect(result.state.status).toBe("WON");
  });
});
```

- [ ] **Step 2: Write the Doubles Training contract test**

```typescript
// app/tests/modules/dartbot/harness/doubles-training.contract.test.ts
import { describe, expect, it } from "vitest";
import { doublesTrainingEngineFactory } from "@modules/game/doubles-training.engine.module";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";
import type { DoublesTrainingState } from "@modules/types";
import { playDictatedSessionToCompletion } from "./play-dictated-session";

const SEATS = [
  {
    participantRef: "participant-1",
    displayName: "Levi",
    sideKey: "A",
    participantTypeKey: "PLAYER" as const,
  },
];

const config = {
  mode: "EASY" as const,
  orderMode: "LOW_TO_HIGH" as const,
  targetOrder: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
  ],
  seats: SEATS,
};

function targetForState(state: DoublesTrainingState) {
  return targetAt(doublesPath(config.targetOrder), state.seats[0]!.targetIndex);
}

describe("Doubles Training — dictated strategy plays a full solo round", () => {
  it("completes at level 1 with every dart accepted by the real engine", () => {
    const engine = doublesTrainingEngineFactory.create(config);
    const result = playDictatedSessionToCompletion(
      engine,
      targetForState,
      1,
      1,
    );
    expect(result.state.status).toBe("COMPLETE");
    expect(result.dartsThrown).toBeGreaterThan(0);
  });

  it("completes at level 15 in no more darts than level 1 needed", () => {
    const level1 = playDictatedSessionToCompletion(
      doublesTrainingEngineFactory.create(config),
      targetForState,
      1,
      6,
    );
    const level15 = playDictatedSessionToCompletion(
      doublesTrainingEngineFactory.create(config),
      targetForState,
      15,
      6,
    );
    expect(level15.state.status).toBe("COMPLETE");
    expect(level15.dartsThrown).toBeLessThanOrEqual(level1.dartsThrown);
  });
});
```

- [ ] **Step 3: Run both and verify they pass**

```bash
cd app && npx vitest run tests/modules/dartbot/harness/bobs27.contract.test.ts tests/modules/dartbot/harness/doubles-training.contract.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 4: Commit**

```bash
git add app/tests/modules/dartbot/harness/bobs27.contract.test.ts app/tests/modules/dartbot/harness/doubles-training.contract.test.ts
git commit -m "test: add DartBot contract tests for the two doublesPath rulesets"
```

---

### Task 5: Context maintenance and full validation

Repo-mandatory close-out (root `CLAUDE.md` §Context Maintenance) — not optional, regardless of this plan.

- [ ] **Step 1: Run the full app validation chain**

```bash
cd app && npm run format
cd app && npm run validate:app
```

Expected: `npm run format` reports no diffs (or the diffs it makes are committed in Step 3 below); `validate:app` exits zero with 0 errors, 0 warnings, 0 hints. If the sandboxed environment has no `DATABASE_URL`/Neon credentials, `validate:app` fails at its `db:status` step before reaching the DB-independent checks — an established limitation of this repo's sandboxed sessions (see phase 1/2's own completion reports), not something to work around silently. In that case run the DB-independent subset directly and report the gap explicitly:

```bash
cd app && npx fallow && npm test && npm run check
cd .. && bash scripts/refresh-graph.sh
```

- [ ] **Step 2: Run the `context-maintenance` skill**

Invoke the `context-maintenance` skill per root `CLAUDE.md`. This phase adds one new directory (`app/src/modules/dartbot/strategy/`) already documented in `08-DartBot.md` §Module Boundary's file layout from phase 1's own spec, and no new decision — confirm this rather than assume it, and only edit the context map / File Inventory / decision ledger if the skill's own checks find drift. Confirm `scripts/check-context-map.sh`, `scripts/check-doc-links.sh`, `scripts/check-context-budget.sh` all pass.

- [ ] **Step 3: Run the remaining gate scripts**

```bash
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-findings-log.sh
bash scripts/check-test-coverage.sh
bash scripts/check-type-barrels.sh
bash scripts/check-alias-sync.sh
bash scripts/check-no-inline-comments.sh
```

Report each script's result explicitly (`run-all-gates` skill).

- [ ] **Step 4: Commit any formatting or context-maintenance fixes**

```bash
git add -A
git status
```

Review the diff before committing — commit only if `git status` shows changes from Steps 1-3.

```bash
git commit -m "chore: context maintenance for DartBot phase 3"
```

- [ ] **Step 5: Push**

```bash
git push -u origin dartbot-3-dictated-strategy
```

---

## Self-Review

**Spec coverage:** every row of the phase-3 inheritance table in `docs/superpowers/specs/2026-09-01-dartbot-v1-delivery-design.md` is covered — §Strategy Layer and Game Coverage's five-dictated-rulesets table (Tasks 3-4, one test file per ruleset), §GameView contracts (Task 1's `DictatedView`, the same "small, read-only view interface" shape as the doc's own `X01View` example), the "per-ruleset throw engine" Anti-Patterns row (Task 2's one shared harness rather than five copies of the drive loop), and the "Contract" Test Strategy row (every one of Tasks 3-4's ten test cases asserts the session reached a decided completion with no `record()` rejection). The phase 3 gate itself ("Five rulesets playable in memory, nothing persisted") is Tasks 3-4 together — no test in either task calls anything under `@client/api` or touches the network.

**Placeholder scan:** no TBD/TODO; every step has real code or a real command with expected output. The dart counts and status values in Tasks 3-4's assertions and this section were measured by actually running this plan's exact strategy and harness code (a scratch build of Task 1-2's files, since discarded) against the real shipped engines before being written into this plan. Level 1, the seeds Task 3-4's first test of each pair uses: Around the Clock 78 darts (COMPLETE); Bob's 27 15 darts (LOST — busted below zero, a legitimate terminal state at this skill level); Shanghai 60 darts (COMPLETE); Doubles Training 62 darts (COMPLETE); Singles Training exactly 63 darts (COMPLETE, and always exactly 63 at any level — it advances every round after 3 darts regardless of hits, unlike the other four). The same-seed level-1-vs-level-15 pairs Task 3-4's second test of each pair asserts were run directly rather than assumed from the tier-band monotonicity phase 2 proved only in aggregate: Around the Clock seed 2 went 79→21 darts, Doubles Training seed 6 went 62→47, Bob's 27 seed 5 reached `WON` in 63 darts at level 15, Singles Training seed 4 stayed at exactly 63 (level-independent, per above), and Shanghai seed 3 reached `COMPLETE` in exactly 60 darts at level 15 (the bound Task 3's test asserts, `<= 60`, holds at equality). `MAX_DARTS = 500` in Task 2 leaves roughly 6x headroom over the largest of these.

**Type consistency:** `DictatedView` is defined once (Task 1, `interfaces.ts`) and consumed unchanged by `chooseTarget` and by every contract test's `targetForState` closure indirectly (through `chooseTarget`, never constructed by the tests themselves). `playDictatedSessionToCompletion`'s signature is defined once (Task 2) and called with the same four positional arguments — `(engine, targetForState, level, seed)` — by all ten test cases across Tasks 3-4, with `maxDarts` left at its default everywhere. `ThrowIntent`, `SkillProfile`, `DartRng` are phase 1's unchanged types, imported, never redeclared.

**Scope:** no `DartBot` class, no seat admission, no persistence, no API client, no `X01Strategy` — all correctly deferred to phases 4-7 per the delivery design. The strategy module itself imports nothing from `@modules/game/*` at all (only `@modules/types` for `BoardTarget`, plus its own folder's `interfaces.ts`/`types.ts`); every engine-specific piece (`numbersPath`/`doublesPath`/`targetAt`, the five factories, each config shape) lives only in the test harness and the five contract test files, which stand in for the page adapter a later phase will build.
