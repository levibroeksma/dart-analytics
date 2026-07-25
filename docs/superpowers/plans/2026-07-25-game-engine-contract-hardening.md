# Game Engine Contract Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace five bespoke game engines with one config-driven `GameEngine` contract that owns the fact log, mints persistence keys, rehydrates from persisted facts, and is mechanically enforced for every future game.

**Architecture:** A ruleset version key + a validated config snapshot construct every engine. Engines consume dart/visit *observations* and emit `StageFact`/`TurnFact` records that map 1:1 onto `exercise_stages`/`turns`/`darts`. One generic payload builder replaces per-game payload modules. Config Zod schemas live in `lib/game/rulesets/` so the Worker validator and the browser engine share one definition. Running scores, training points and ratios stop being stored anywhere — they are derived from the facts.

**Tech Stack:** TypeScript, Astro, Alpine (`$persist`), Zod, Vitest, PostgreSQL/Neon seeds.

**Findings this plan closes:** `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` — C1, C2, I1–I8, M1–M6, P1–P4, ST1–ST7.

## Global Constraints

- Root `CLAUDE.md` Hard Invariants apply in full. Store facts; statistics live in views only.
- TDD is mandatory (`app/CLAUDE.md`): failing test first, verify it fails, minimal implementation, verify green, commit.
- **Every task ends green.** No task may leave a failing test or a non-compiling tree for a later task to fix.
- No `//` or `/* */` comments inside function bodies under `app/src/**/*.ts` — JSDoc above the declaration only.
- Tests live under `app/tests/`, mirroring `app/src/` — never colocated.
- `tsconfig.json` `paths` and `vitest.config.ts` `resolve.alias` must stay in sync.
- Imports use `@`-prefixed aliases; no deep relative paths.
- `export type` / `export interface` never inline in a `.module.ts` — they live in the folder's `types.ts` / `interfaces.ts`.
- Browser areas (`modules/`, `stores/`, `forms/`) must not import `services/`, `repositories/`, `lib/server/`.
- Before every PR: `cd app && npm run format`, commit the diff, confirm `npm run format:check` clean.
- Completion bar for the whole change set: `cd app && npm run validate:app`, plus all seven `scripts/check-*.sh`.
- Never modify applied migrations `0001`–`0016`. Seeds may be corrected in place, but a correction to an already-seeded row needs `ON CONFLICT (id) DO UPDATE`, not `DO NOTHING`.
- Rule changes to any `CLAUDE.md` / `AGENT.md` require explicit user approval before writing (self-learning gate, D107). Task 14 proposes; it does not apply without that approval.

## Approved decisions (2026-07-25)

1. **Merge order:** Task 0 fixes the Bob's 27 visit leak, then #41 → #42 → #43 → #48 merge into `main` in order. Tasks 1–14 run on one branch off `main`.
2. **Shared schema home:** `app/src/lib/game/rulesets/` is approved as the cross-runtime location for ruleset config schemas — `lib/` is the only tree both the Worker and the browser may import. Recorded as a decision in Task 13.
3. **Task ordering:** restructured so every task ends green. Config schemas precede the contract that references them; the store rewrite ships with the Score Training retrofit that consumes it; the old payload module is deleted by the task that moves its call site.

---

## File Structure

**New**

| Path | Responsibility |
| ---- | -------------- |
| `app/src/modules/game/board-progression.module.ts` | Shared `D1→D20→bull` / `1→20→bull` paths and the board-score table. |
| `app/src/lib/game/rulesets/types.ts` | `RulesetVersionKey` union + per-ruleset Zod config schemas + inferred snapshot types. |
| `app/src/lib/game/rulesets/config-codec.ts` | `toSnapshot()` / `toWireConfig()` — the one place snake_case DB config and camelCase client snapshots translate. |
| `app/src/modules/game/interfaces.ts` | `GameEngine`, `GameEngineFactory`. |
| `app/src/modules/game/engine.registry.ts` | `rulesetVersionKey → GameEngineFactory` lookup. |
| `app/src/modules/game/events.payload.module.ts` | Generic `buildEventsBatch(participantRef, facts)`. |
| `app/src/services/rulesets/{bobs27,singles-training,doubles-training,five-oh-one}/*.validator.ts` | Server-side config + batch validation per ruleset version. |
| `database/seeds/0003_game_engine_reference.sql` | `BOBS27` + `DOUBLES_TRAINING` game types, features, ruleset versions, presets. |
| `scripts/check-game-engines.sh` | Mechanical guard: every engine implements the contract, is registered, and has a validator. |

**Modified**

| Path | Change |
| ---- | ------ |
| `app/src/modules/game/types.ts` | Add `DartZoneKey`, `StageTypeKey`, `BoardTarget`, `DartObservation`, `DartFact`, `TurnFact`, `StageFact`, `EngineFacts`; prefix per-game type names. |
| `app/src/modules/game/*.engine.module.ts` (×5) | Retrofit to the contract. |
| `app/src/stores/game.store.ts`, `app/src/stores/types.ts` | Game-agnostic store: `rulesetVersionKey`, config union, `stages`, `turns`; `_v` → 2. |
| `app/src/lib/game/score-training-{setup,play}.data.ts` | Use the codec, the registry and the generic payload builder; fix the stuck `loading` flag. |
| `app/src/services/rulesets/registry.ts` | Register all five validators. |
| `database/seeds/0002_default_templates.sql` | Correct Singles presets to V1 scope; add `max_visit_score` to the 501 presets. |
| `docs/…`, `DECISIONS.md`, `00-Context-Map.md`, `CLAUDE.md`/`AGENT.md` | Tasks 13–14. |

**Deleted**

| Path | Deleted by | Reason |
| ---- | ---------- | ------ |
| `app/src/modules/game/score-training.payload.module.ts` | Task 5 | Superseded by `events.payload.module.ts` once the call site moves. |

---

## Phase 0 — Land the stack

### Task 0: Fix the Bob's 27 visit leak, then merge the stack

**Files:**
- Modify: `app/src/modules/game/bobs27.engine.module.ts:30-64`
- Test: `app/tests/modules/game/bobs27.engine.module.test.ts:206`

**Interfaces:**
- Consumes: nothing.
- Produces: `Bobs27State.dartsThisVisit` is `[]` immediately after a visit resolves (finding I6; matches the PR's own spec §3 step 5 and both sibling engines).

Work on branch `claude/bobs-27-engine-spec-2cz4pw` (PR #41), not the hardening branch.

- [ ] **Step 1: Write the failing test**

Add to `app/tests/modules/game/bobs27.engine.module.test.ts`:

```typescript
it("clears dartsThisVisit when the visit resolves", () => {
  const engine = new Bobs27Engine();
  engine.recordDart(true);
  engine.recordDart(false);
  const resolved = engine.recordDart(false);

  expect(engine.currentTarget()).toEqual({ kind: "DOUBLE", number: 2 });
  expect(resolved.dartsThisVisit).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/bobs27.engine.module.test.ts -t "clears dartsThisVisit"`
Expected: FAIL — `expected [ true, false, false ] to deeply equal []`

- [ ] **Step 3: Reset the visit at resolution instead of lazily**

```typescript
export function applyDart(state: Bobs27State, hit: boolean): Bobs27State {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the game has ended; undo first to correct it.",
    );
  }

  const target = targetForIndex(state.targetIndex);
  const dartsThisVisit = [...state.dartsThisVisit, hit];
  const score = hit ? state.score + targetValue(target) : state.score;

  if (dartsThisVisit.length < 3) {
    return { ...state, score, dartsThisVisit };
  }

  const visitHits = dartsThisVisit.filter(Boolean).length;
  const resolvedScore = visitHits === 0 ? score - targetValue(target) : score;

  if (resolvedScore <= 0) {
    return { ...state, score: resolvedScore, dartsThisVisit: [], status: "LOST" };
  }
  if (target.kind === "BULL") {
    return { ...state, score: resolvedScore, dartsThisVisit: [], status: "WON" };
  }
  return {
    ...state,
    score: resolvedScore,
    dartsThisVisit: [],
    targetIndex: state.targetIndex + 1,
  };
}
```

- [ ] **Step 4: Update the undo test that asserted the leaked value**

`bobs27.engine.module.test.ts:206` asserts `[false, false, false]` after undoing a resolved full-miss visit. Undo restores the *pre-third-dart* state, so the correct expectation is the two darts that had been thrown:

```typescript
expect(afterRestoredDart.dartsThisVisit).toEqual([false, false]);
```

- [ ] **Step 5: Run the engine suite**

Run: `cd app && npx vitest run tests/modules/game/bobs27.engine.module.test.ts`
Expected: PASS, 20 tests.

- [ ] **Step 6: Commit and push**

```bash
git add app/src/modules/game/bobs27.engine.module.ts app/tests/modules/game/bobs27.engine.module.test.ts
git commit -m "fix: clear Bob's 27 visit darts at visit resolution"
git push -u origin claude/bobs-27-engine-spec-2cz4pw
```

- [ ] **Step 7: Merge the stack in order**

Merge #41, then #42, then #43, then #48, letting GitHub retarget each PR to `main` as its parent lands. Then on `main`: `bash scripts/refresh-graph.sh` (closes P3) and `cd app && npm run validate:app` to confirm green.

---

## Phase 1 — The contract

### Task 1: Shared fact types and board progression

**Files:**
- Modify: `app/src/modules/game/types.ts`
- Create: `app/src/modules/game/board-progression.module.ts`
- Test: `app/tests/modules/game/board-progression.module.test.ts`

**Interfaces:**
- Produces, in `types.ts`:

```typescript
export type DartZoneKey =
  | "SINGLE" | "DOUBLE" | "TREBLE" | "OUTER_BULL" | "INNER_BULL" | "MISS";

export type StageTypeKey = "MATCH" | "SET" | "LEG" | "ROUND" | "EXERCISE_BLOCK";

export type BoardTarget =
  | { kind: "NUMBER"; number: number }
  | { kind: "DOUBLE"; number: number }
  | { kind: "BULL" };

/** What the player did, as observed at input time — the engine's only input. */
export type DartObservation = {
  hitTargetNumber: number | null;
  hitZoneKey: DartZoneKey;
};

/** One row of `darts`. `score` is the actual board score, never a game-specific point value. */
export type DartFact = {
  sequence: number;
  intendedTargetNumber: number | null;
  intendedZoneKey: DartZoneKey | null;
  hitTargetNumber: number | null;
  hitZoneKey: DartZoneKey;
  score: number;
};

/** One row of `turns`. `totalScore` is the counted board score — 0 for a void visit, never negative. */
export type TurnFact = {
  clientKey: string;
  stageClientKey: string;
  sequence: number;
  completedAt: string;
  totalScore: number;
  darts: DartFact[];
};

/** One row of `exercise_stages`. */
export type StageFact = {
  clientKey: string;
  stageTypeKey: StageTypeKey;
  parentClientKey: string | null;
  sequence: number;
};

export type EngineFacts = {
  stages: StageFact[];
  turns: TurnFact[];
};
```

- Produces, in `board-progression.module.ts`:

```typescript
export function doublesPath(): readonly BoardTarget[];   // D1..D20, BULL — 21 entries
export function numbersPath(): readonly BoardTarget[];   // 1..20, BULL — 21 entries
export function targetAt(path: readonly BoardTarget[], index: number): BoardTarget;
export function boardScore(targetNumber: number | null, zone: DartZoneKey): number;
export function isHitOn(target: BoardTarget, observation: DartObservation): boolean;
```

`boardScore` is the single source of dartboard arithmetic: `SINGLE` → n, `DOUBLE` → 2n, `TREBLE` → 3n, `OUTER_BULL` → 25, `INNER_BULL` → 50, `MISS` → 0. This replaces the `targetForIndex` helper triplicated across three engines (finding M1) — the engines adopt it in Tasks 6–8.

In the same task, rename `VisitOutcome` → `DoublesVisitOutcome` in `types.ts` and update `doubles-training.engine.module.ts` and its test (finding M2). This is a pure rename; the doubles test suite must stay green.

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/game/board-progression.module.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  boardScore,
  doublesPath,
  isHitOn,
  numbersPath,
  targetAt,
} from "@modules/game/board-progression.module";

describe("board progression", () => {
  it("walks D1 to D20 then bull", () => {
    const path = doublesPath();
    expect(path).toHaveLength(21);
    expect(targetAt(path, 0)).toEqual({ kind: "DOUBLE", number: 1 });
    expect(targetAt(path, 19)).toEqual({ kind: "DOUBLE", number: 20 });
    expect(targetAt(path, 20)).toEqual({ kind: "BULL" });
  });

  it("walks 1 to 20 then bull", () => {
    expect(targetAt(numbersPath(), 0)).toEqual({ kind: "NUMBER", number: 1 });
    expect(targetAt(numbersPath(), 20)).toEqual({ kind: "BULL" });
  });

  it("throws for an index past the end of the path", () => {
    expect(() => targetAt(doublesPath(), 21)).toThrow(/No target at index 21/);
  });

  it("scores the board", () => {
    expect(boardScore(20, "SINGLE")).toBe(20);
    expect(boardScore(20, "DOUBLE")).toBe(40);
    expect(boardScore(20, "TREBLE")).toBe(60);
    expect(boardScore(25, "OUTER_BULL")).toBe(25);
    expect(boardScore(25, "INNER_BULL")).toBe(50);
    expect(boardScore(20, "MISS")).toBe(0);
    expect(boardScore(null, "SINGLE")).toBe(0);
  });

  it("recognises a hit on the required double", () => {
    const target = targetAt(doublesPath(), 0);
    expect(isHitOn(target, { hitTargetNumber: 1, hitZoneKey: "DOUBLE" })).toBe(true);
    expect(isHitOn(target, { hitTargetNumber: 1, hitZoneKey: "SINGLE" })).toBe(false);
    expect(isHitOn(target, { hitTargetNumber: 2, hitZoneKey: "DOUBLE" })).toBe(false);
  });

  it("counts any scoring ring as a hit on a NUMBER target", () => {
    const target = targetAt(numbersPath(), 4);
    expect(isHitOn(target, { hitTargetNumber: 5, hitZoneKey: "TREBLE" })).toBe(true);
    expect(isHitOn(target, { hitTargetNumber: 5, hitZoneKey: "MISS" })).toBe(false);
  });

  it("treats inner bull as a hit on the bull target and outer bull as a miss", () => {
    const bull = targetAt(doublesPath(), 20);
    expect(isHitOn(bull, { hitTargetNumber: 25, hitZoneKey: "INNER_BULL" })).toBe(true);
    expect(isHitOn(bull, { hitTargetNumber: 25, hitZoneKey: "OUTER_BULL" })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/board-progression.module.test.ts`
Expected: FAIL — cannot resolve `@modules/game/board-progression.module`.

- [ ] **Step 3: Add the types**

Append the `types.ts` block from **Interfaces** to `app/src/modules/game/types.ts`.

- [ ] **Step 4: Implement the module**

```typescript
import type { BoardTarget, DartObservation, DartZoneKey } from "./types";

const BULL_TARGET_NUMBER = 25;

const DOUBLES_PATH: readonly BoardTarget[] = [
  ...Array.from({ length: 20 }, (_, i): BoardTarget => ({
    kind: "DOUBLE",
    number: i + 1,
  })),
  { kind: "BULL" },
];

const NUMBERS_PATH: readonly BoardTarget[] = [
  ...Array.from({ length: 20 }, (_, i): BoardTarget => ({
    kind: "NUMBER",
    number: i + 1,
  })),
  { kind: "BULL" },
];

export function doublesPath(): readonly BoardTarget[] {
  return DOUBLES_PATH;
}

export function numbersPath(): readonly BoardTarget[] {
  return NUMBERS_PATH;
}

export function targetAt(
  path: readonly BoardTarget[],
  index: number,
): BoardTarget {
  const target = path[index];
  if (!target) throw new Error(`No target at index ${index}`);
  return target;
}

export function boardScore(
  targetNumber: number | null,
  zone: DartZoneKey,
): number {
  if (zone === "MISS") return 0;
  if (zone === "OUTER_BULL") return 25;
  if (zone === "INNER_BULL") return 50;
  if (targetNumber === null) return 0;
  if (zone === "DOUBLE") return targetNumber * 2;
  if (zone === "TREBLE") return targetNumber * 3;
  return targetNumber;
}

export function isHitOn(
  target: BoardTarget,
  observation: DartObservation,
): boolean {
  if (target.kind === "BULL") {
    return (
      observation.hitTargetNumber === BULL_TARGET_NUMBER &&
      observation.hitZoneKey === "INNER_BULL"
    );
  }
  if (observation.hitTargetNumber !== target.number) return false;
  return target.kind === "DOUBLE"
    ? observation.hitZoneKey === "DOUBLE"
    : observation.hitZoneKey !== "MISS";
}
```

- [ ] **Step 5: Rename `VisitOutcome` → `DoublesVisitOutcome`**

In `types.ts`, `doubles-training.engine.module.ts` and `app/tests/modules/game/doubles-training.engine.module.test.ts`.

- [ ] **Step 6: Run the full suite**

Run: `cd app && npm test`
Expected: PASS — the new file plus every previously green test.

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/game app/tests/modules/game
git commit -m "feat: add shared engine fact types and board progression"
```

### Task 2: Shared ruleset config schemas and codec

**Files:**
- Create: `app/src/lib/game/rulesets/types.ts`, `app/src/lib/game/rulesets/config-codec.ts`
- Test: `app/tests/lib/game/rulesets/config-codec.test.ts`

**Interfaces:**
- Produces:

```typescript
export type RulesetVersionKey =
  | "SCORE_TRAINING_V1"
  | "BOBS27_V1"
  | "SINGLES_V1"
  | "DOUBLES_TRAINING_V1"
  | "501_V1";

export const RULESET_CONFIGS: Record<RulesetVersionKey, z.ZodTypeAny>;

export function toSnapshot<K extends RulesetVersionKey>(key: K, wire: unknown): ConfigSnapshotFor<K>;
export function toWireConfig<K extends RulesetVersionKey>(key: K, snapshot: ConfigSnapshotFor<K>): Record<string, unknown>;
```

Config keys are snake_case on the wire (exactly as `configuration_templates.configuration` stores them) and camelCase in client snapshots. Schemas, per ruleset version:

| Ruleset | Keys |
| ------- | ---- |
| `SCORE_TRAINING_V1` | `duration_type` (`ROUNDS`\|`MINUTES`), `duration_value` (int ≥ 1), `max_darts_per_turn` (int 1–3), `max_visit_score` (int, default 180) |
| `BOBS27_V1` | `start_score` (int, default 27), `bull_hit_value` (int, default 50), `miss_penalty_multiplier` (int, default 1) |
| `SINGLES_V1` | `order_mode` (`LOW_TO_HIGH`), `difficulty` (`EASY`), `points_single`/`points_double`/`points_treble` (int, defaults 1/2/3) |
| `DOUBLES_TRAINING_V1` | `mode` (`EASY`), `order_mode` (`LOW_TO_HIGH`) |
| `501_V1` | `starting_score` (int, default 501), `legs_to_win` (int 1–20), `check_in` (`STRAIGHT_IN`), `check_out` (`DOUBLE_OUT`), `max_darts_per_turn` (int 1–3), `max_visit_score` (int, default 180) |

V2+ values (`HIGH_TO_LOW`, `RANDOM`, `NORMAL`, `HARD`, `DOUBLE_IN`, `MASTER_OUT`) are deliberately **not** accepted — the schemas encode V1 scope, and Task 11 corrects the seeds that ship them. `max_visit_score` is what makes the score cap ruleset-owned per D15 / Database Agent Guide §8 (closes I7).

This is the single definition of each game's config: `services/rulesets/*` validate with it server-side (Task 10), `modules/game/*` construct engines from it client-side (Tasks 5–9). Closes C1 and ST3.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { toSnapshot, toWireConfig } from "@lib/game/rulesets/config-codec";

describe("config codec", () => {
  it("maps snake_case wire config onto a camelCase snapshot", () => {
    expect(
      toSnapshot("SCORE_TRAINING_V1", {
        duration_type: "ROUNDS",
        duration_value: 10,
        max_darts_per_turn: 3,
        max_visit_score: 180,
      }),
    ).toEqual({
      durationType: "ROUNDS",
      durationValue: 10,
      maxDartsPerTurn: 3,
      maxVisitScore: 180,
    });
  });

  it("round-trips back to wire shape", () => {
    const wire = {
      duration_type: "MINUTES",
      duration_value: 5,
      max_darts_per_turn: 3,
      max_visit_score: 180,
    };
    expect(
      toWireConfig("SCORE_TRAINING_V1", toSnapshot("SCORE_TRAINING_V1", wire)),
    ).toEqual(wire);
  });

  it("applies schema defaults for omitted optional keys", () => {
    const snapshot = toSnapshot("BOBS27_V1", { start_score: 27 });
    expect(snapshot).toEqual({
      startScore: 27,
      bullHitValue: 50,
      missPenaltyMultiplier: 1,
    });
  });

  it("rejects a config that fails its ruleset schema", () => {
    expect(() => toSnapshot("SCORE_TRAINING_V1", { duration_type: "WEEKS" })).toThrow();
  });

  it("rejects V2+ values the V1 rulesets do not support", () => {
    expect(() =>
      toSnapshot("SINGLES_V1", { order_mode: "RANDOM", difficulty: "HARD" }),
    ).toThrow();
  });

  it("carries the 501 leg count and visit cap", () => {
    const snapshot = toSnapshot("501_V1", {
      starting_score: 501,
      legs_to_win: 3,
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
      max_visit_score: 180,
    });
    expect(snapshot.legsToWin).toBe(3);
    expect(snapshot.maxVisitScore).toBe(180);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/rulesets/config-codec.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schemas** in `types.ts` per the table above, exporting `RulesetVersionKey`, one Zod object per ruleset, `RULESET_CONFIGS`, and the inferred snapshot types.

- [ ] **Step 4: Implement the codec** in `config-codec.ts`: parse with `RULESET_CONFIGS[key]`, throw on failure, convert key case in both directions. No per-game `if` chains in call sites.

- [ ] **Step 5: Run the test**

Run: `cd app && npx vitest run tests/lib/game/rulesets/config-codec.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/rulesets app/tests/lib/game/rulesets
git commit -m "feat: add shared ruleset config schemas and codec"
```

### Task 3: `GameEngine` contract and registry

**Files:**
- Create: `app/src/modules/game/interfaces.ts`, `app/src/modules/game/engine.registry.ts`
- Test: `app/tests/modules/game/engine.registry.test.ts`

**Interfaces:**
- Consumes: `EngineFacts` (Task 1), `RulesetVersionKey` (Task 2).
- Produces:

```typescript
export interface GameEngine<TInput, TState> {
  readonly rulesetVersionKey: RulesetVersionKey;
  record(input: TInput): TState;
  undo(): boolean;
  isComplete(): boolean;
  state(): TState;
  facts(): EngineFacts;
}

export interface GameEngineFactory<TConfig, TInput, TState> {
  readonly rulesetVersionKey: RulesetVersionKey;
  create(config: TConfig, prior?: EngineFacts): GameEngine<TInput, TState>;
}

export function registerEngineFactory(factory: GameEngineFactory<unknown, unknown, unknown>): void;
export function getEngineFactory(key: RulesetVersionKey): GameEngineFactory<unknown, unknown, unknown> | undefined;
```

`create(config, prior)` is the rehydrate path (closes I2): passing persisted `EngineFacts` back rebuilds the engine's state by replaying them, so a page refresh restores the game exactly.

The registry starts **empty**; Tasks 5–9 each register their factory. The registry's test uses a local fixture factory so it is green with zero games registered.

- [ ] **Step 1: Write the failing test**

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import {
  getEngineFactory,
  registerEngineFactory,
  resetEngineRegistry,
} from "@modules/game/engine.registry";
import type { GameEngineFactory } from "@modules/game/interfaces";

const fixture = {
  rulesetVersionKey: "SCORE_TRAINING_V1",
  create: () => {
    throw new Error("fixture");
  },
} as unknown as GameEngineFactory<never, never, never>;

describe("engine registry", () => {
  beforeEach(() => resetEngineRegistry());

  it("returns a registered factory by ruleset version key", () => {
    registerEngineFactory(fixture);
    expect(getEngineFactory("SCORE_TRAINING_V1")).toBe(fixture);
  });

  it("returns undefined for an unregistered ruleset version", () => {
    expect(getEngineFactory("501_V1")).toBeUndefined();
  });

  it("rejects a duplicate registration for the same ruleset version", () => {
    registerEngineFactory(fixture);
    expect(() => registerEngineFactory(fixture)).toThrow(/already registered/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/engine.registry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `interfaces.ts`** with the two interface declarations above.

- [ ] **Step 4: Implement `engine.registry.ts`**

```typescript
import type { RulesetVersionKey } from "@lib/game/rulesets/types";
import type { GameEngineFactory } from "./interfaces";

type AnyFactory = GameEngineFactory<never, never, never>;

const REGISTRY = new Map<RulesetVersionKey, AnyFactory>();

export function registerEngineFactory(factory: AnyFactory): void {
  if (REGISTRY.has(factory.rulesetVersionKey)) {
    throw new Error(
      `Engine factory already registered for ${factory.rulesetVersionKey}`,
    );
  }
  REGISTRY.set(factory.rulesetVersionKey, factory);
}

export function getEngineFactory(
  key: RulesetVersionKey,
): AnyFactory | undefined {
  return REGISTRY.get(key);
}

/** Test-only: clears registrations so each test starts from an empty registry. */
export function resetEngineRegistry(): void {
  REGISTRY.clear();
}
```

- [ ] **Step 5: Run the test**

Run: `cd app && npx vitest run tests/modules/game/engine.registry.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game app/tests/modules/game
git commit -m "feat: add GameEngine contract and engine registry"
```

### Task 4: Generic events payload builder

**Files:**
- Create: `app/src/modules/game/events.payload.module.ts`
- Test: `app/tests/modules/game/events.payload.module.test.ts`

**Interfaces:**
- Consumes: `EngineFacts` (Task 1).
- Produces: `buildEventsBatch(participantRef: string, facts: EngineFacts): EventsBatchRequestInput`

Stages come from the engine, so 501's `LEG` stages and Score Training's single `EXERCISE_BLOCK` use one builder (closes ST6). This task is purely additive — `score-training.payload.module.ts` stays until Task 5 moves its call site.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { buildEventsBatch } from "@modules/game/events.payload.module";

describe("buildEventsBatch", () => {
  it("nests turns under the stage that owns them", () => {
    const batch = buildEventsBatch("participant-1", {
      stages: [
        { clientKey: "leg-1", stageTypeKey: "LEG", parentClientKey: null, sequence: 1 },
        { clientKey: "leg-2", stageTypeKey: "LEG", parentClientKey: null, sequence: 2 },
      ],
      turns: [
        { clientKey: "t1", stageClientKey: "leg-1", sequence: 1, completedAt: "2026-07-25T10:00:00.000Z", totalScore: 60, darts: [] },
        { clientKey: "t2", stageClientKey: "leg-2", sequence: 1, completedAt: "2026-07-25T10:01:00.000Z", totalScore: 45, darts: [] },
      ],
    });

    expect(batch.stages).toHaveLength(2);
    expect(batch.stages[0].turns.map((t) => t.clientKey)).toEqual(["t1"]);
    expect(batch.stages[1].turns.map((t) => t.clientKey)).toEqual(["t2"]);
    expect(batch.stages[0].turns[0].participantRef).toBe("participant-1");
  });

  it("emits an empty darts array under quick-score capture", () => {
    const batch = buildEventsBatch("participant-1", {
      stages: [{ clientKey: "block-1", stageTypeKey: "EXERCISE_BLOCK", parentClientKey: null, sequence: 1 }],
      turns: [{ clientKey: "t1", stageClientKey: "block-1", sequence: 1, completedAt: "2026-07-25T10:00:00.000Z", totalScore: 100, darts: [] }],
    });
    expect(batch.stages[0].turns[0].darts).toEqual([]);
  });

  it("carries dart facts through unchanged when present", () => {
    const dart = {
      sequence: 1,
      intendedTargetNumber: 1,
      intendedZoneKey: "DOUBLE" as const,
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE" as const,
      score: 2,
    };
    const batch = buildEventsBatch("participant-1", {
      stages: [{ clientKey: "block-1", stageTypeKey: "EXERCISE_BLOCK", parentClientKey: null, sequence: 1 }],
      turns: [{ clientKey: "t1", stageClientKey: "block-1", sequence: 1, completedAt: "2026-07-25T10:00:00.000Z", totalScore: 2, darts: [dart] }],
    });
    expect(batch.stages[0].turns[0].darts).toEqual([dart]);
  });

  it("emits a stage with no turns rather than dropping it", () => {
    const batch = buildEventsBatch("participant-1", {
      stages: [{ clientKey: "leg-1", stageTypeKey: "LEG", parentClientKey: null, sequence: 1 }],
      turns: [],
    });
    expect(batch.stages[0].turns).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/events.payload.module.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import type { EventsBatchRequestInput } from "@client/api/types";
import type { EngineFacts } from "./types";

export function buildEventsBatch(
  participantRef: string,
  facts: EngineFacts,
): EventsBatchRequestInput {
  return {
    stages: facts.stages.map((stage) => ({
      clientKey: stage.clientKey,
      stageTypeKey: stage.stageTypeKey,
      parentClientKey: stage.parentClientKey,
      sequence: stage.sequence,
      turns: facts.turns
        .filter((turn) => turn.stageClientKey === stage.clientKey)
        .map((turn) => ({
          clientKey: turn.clientKey,
          participantRef,
          sequence: turn.sequence,
          totalScore: turn.totalScore,
          completedAt: turn.completedAt,
          darts: turn.darts,
        })),
    })),
  };
}
```

- [ ] **Step 4: Run the full suite**

Run: `cd app && npm test`
Expected: PASS — new file plus everything previously green.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game app/tests/modules/game
git commit -m "feat: add generic events batch builder"
```

---

## Phase 2 — Retrofit the engines

Each engine task: accept a validated config snapshot, consume observations, own an `EngineFacts` log with minted `clientKey`/`sequence`/`completedAt`, rehydrate from `prior`, register a `GameEngineFactory`. **Run the full TDD cycle per task — do not copy another engine's tests wholesale.**

### Task 5: Score Training on the contract, with the game-agnostic store

**Files:**
- Modify: `app/src/modules/game/score-training.engine.module.ts`, `app/src/stores/types.ts`, `app/src/stores/game.store.ts`, `app/src/lib/game/score-training-play.data.ts`, `app/src/lib/game/score-training-setup.data.ts`, `app/src/lib/client/alpine/register-stores.ts` (if the store signature changes)
- Delete: `app/src/modules/game/score-training.payload.module.ts`, `app/tests/modules/game/score-training.payload.module.test.ts`
- Test: `app/tests/modules/game/score-training.engine.module.test.ts`, `app/tests/stores/game.store.test.ts`, `app/tests/lib/game/score-training-play.data.test.ts`

This task moves the store and the engine together because they are one change: the store stops holding Score-Training-shaped config and per-turn records, and the engine becomes the fact-log owner the store persists.

**Interfaces:**
- Produces: `scoreTrainingEngineFactory: GameEngineFactory<ScoreTrainingSnapshot, number, ScoreTrainingState>`. `record(visitScore)` mints one `TurnFact` under a single `EXERCISE_BLOCK` stage (`clientKey: "block-1"`, `sequence: 1`).
- Produces: `gameStore` fields `gameTypeKey`, `rulesetVersionKey`, `sessionId`, `participantRef`, `configSnapshot`, `templateRef`, `stages`, `turns`, `timerRemainingMs`, `timerStartedAt`, `timerExpired`, `idempotencyKey`; methods `startSession(input)`, `recordFacts(facts)`, `reset()`. `STORE_VERSION` → `2`.

`GameConfigSnapshot` and `RecordedTurn` are deleted from `stores/types.ts` (closes ST1). The store no longer appends turns one at a time — `recordFacts` replaces the whole log from `engine.facts()`, so engine and store cannot diverge (closes ST2). D91: the `_v` bump discards incompatible persisted state.

- [ ] **Step 1: Write the failing engine tests**

```typescript
it("rehydrates from persisted facts and continues the sequence", () => {
  const config = { durationType: "ROUNDS", durationValue: 10, maxDartsPerTurn: 3, maxVisitScore: 180 } as const;
  const first = scoreTrainingEngineFactory.create(config);
  first.record(60);
  first.record(45);

  const resumed = scoreTrainingEngineFactory.create(config, first.facts());
  resumed.record(100);

  expect(resumed.facts().turns).toHaveLength(3);
  expect(resumed.facts().turns.at(-1)?.sequence).toBe(3);
  expect(resumed.undo()).toBe(true);
  expect(resumed.facts().turns).toHaveLength(2);
});

it("mints a unique clientKey and an ISO completedAt per visit", () => {
  const engine = scoreTrainingEngineFactory.create({ durationType: "ROUNDS", durationValue: 10, maxDartsPerTurn: 3, maxVisitScore: 180 });
  engine.record(60);
  engine.record(60);

  const [a, b] = engine.facts().turns;
  expect(a.clientKey).not.toBe(b.clientKey);
  expect(a.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
  expect(a.stageClientKey).toBe(engine.facts().stages[0].clientKey);
});

it("rejects a visit score above the ruleset cap", () => {
  const engine = scoreTrainingEngineFactory.create({ durationType: "ROUNDS", durationValue: 10, maxDartsPerTurn: 3, maxVisitScore: 180 });
  expect(() => engine.record(181)).toThrow(/0 and 180/);
  expect(() => engine.record(-1)).toThrow(/0 and 180/);
  expect(engine.facts().turns).toHaveLength(0);
});

it("completes after the configured number of rounds", () => {
  const engine = scoreTrainingEngineFactory.create({ durationType: "ROUNDS", durationValue: 2, maxDartsPerTurn: 3, maxVisitScore: 180 });
  engine.record(60);
  expect(engine.isComplete()).toBe(false);
  engine.record(60);
  expect(engine.isComplete()).toBe(true);
});
```

MINUTES-mode completion stays caller-driven (the timer lives in the store): keep a `timerExpired` setter on the engine state rather than a parameter on `isComplete()`, so the contract's zero-argument `isComplete()` holds (closes ST7).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/score-training.engine.module.test.ts -t "rehydrates"`
Expected: FAIL — `scoreTrainingEngineFactory` is not exported.

- [ ] **Step 3: Implement the engine against the contract**

Keep the existing key minting. Move the `0..180` guard out of `score-training-play.data.ts:153` into the engine, bounded by `config.maxVisitScore`. Emit the single `EXERCISE_BLOCK` stage. Replay `prior.turns` on construction to seed the sequence. Delete `currentTotal()`/`currentAverage()` — dead code the play page never called. Register via `registerEngineFactory`.

- [ ] **Step 4: Write the failing store tests**

```typescript
it("stores the ruleset version alongside the config snapshot", () => {
  const store = gameStore(persist as never);
  store.startSession({
    gameTypeKey: "SCORE_TRAINING",
    rulesetVersionKey: "SCORE_TRAINING_V1",
    sessionId: "s1",
    participantRef: "p1",
    templateRef: "tpl-1",
    configSnapshot: { durationType: "ROUNDS", durationValue: 10, maxDartsPerTurn: 3, maxVisitScore: 180 },
  });
  expect(store.rulesetVersionKey).toBe("SCORE_TRAINING_V1");
  expect(store.turns).toEqual([]);
  expect(store.stages).toEqual([]);
});

it("replaces the fact log wholesale so engine and store cannot diverge", () => {
  const store = gameStore(persist as never);
  store.recordFacts({
    stages: [{ clientKey: "block-1", stageTypeKey: "EXERCISE_BLOCK", parentClientKey: null, sequence: 1 }],
    turns: [{ clientKey: "t1", stageClientKey: "block-1", sequence: 1, completedAt: "2026-07-25T10:00:00.000Z", totalScore: 60, darts: [] }],
  });
  store.recordFacts({ stages: [], turns: [] });
  expect(store.turns).toEqual([]);
  expect(store.stages).toEqual([]);
});

it("clears every field on reset", () => {
  const store = gameStore(persist as never);
  store.startSession({ /* as above */ });
  store.reset();
  expect(store.sessionId).toBeNull();
  expect(store.rulesetVersionKey).toBeNull();
  expect(store.configSnapshot).toBeNull();
});
```

Use a `persist` stub that returns a fresh closure per call, mirroring D120's requirement.

- [ ] **Step 5: Rewrite the store**

`stores/types.ts` exports `ConfigSnapshot` (the union of Task 2's inferred snapshot types) and drops `GameConfigSnapshot`/`RecordedTurn`. `game.store.ts` follows the Interfaces block, one `persist()` call per field (D120), `STORE_VERSION = 2`.

- [ ] **Step 6: Rewire the data factories**

- `score-training-setup.data.ts`: replace the hand-written snake→camel mapping with `toSnapshot("SCORE_TRAINING_V1", preset.configuration)`; store `rulesetVersionKey` and `templateRef`.
- `score-training-play.data.ts`: build the engine via `getEngineFactory(store.rulesetVersionKey)` with `store` facts as `prior`; replace `buildEventsBatch(participantRef, completedTurns)` with `buildEventsBatch(participantRef, engine.facts())`; call `store.recordFacts(engine.facts())` after each `record`/`undo`; delete the engine-rebuild branch in `undoVisit` (rehydration makes it unnecessary); send `{ source: "template", templateRef: store.templateRef }` in `playAgain` so provenance matches first play (closes ST4).

- [ ] **Step 7: Fix the stuck loading flag (ST5)**

```typescript
async submitVisit(this: ScoreTrainingPlayContext) {
  if (!this.engine || this.finished || this.showFinishConfirm) return;
  this.loading = true;
  …
}
```

Add a regression test asserting `loading === false` after `submitVisit()` returns with no engine.

- [ ] **Step 8: Delete the superseded payload module**

```bash
git rm app/src/modules/game/score-training.payload.module.ts app/tests/modules/game/score-training.payload.module.test.ts
```

- [ ] **Step 9: Run the full suite**

Run: `cd app && npm test && npm run check`
Expected: PASS, and `astro check` reports 0 errors.

- [ ] **Step 10: Commit**

```bash
git add -A app/src app/tests
git commit -m "refactor: put Score Training on the GameEngine contract"
```

### Task 6: Bob's 27 on the contract

**Files:**
- Modify: `app/src/modules/game/bobs27.engine.module.ts`, `app/src/modules/game/types.ts`
- Test: `app/tests/modules/game/bobs27.engine.module.test.ts`

**Interfaces:**
- Consumes: `boardScore`, `isHitOn`, `doublesPath`, `targetAt` (Task 1); `Bobs27Snapshot` (Task 2); `registerEngineFactory` (Task 3).
- Produces: `bobs27EngineFactory: GameEngineFactory<Bobs27Snapshot, DartObservation, Bobs27State>`. `record(observation)` appends a `DartFact` to the open `TurnFact`; the visit closes on the third dart. `state().score` is **derived by folding the fact log**, never accumulated in a stored field (closes C2 for this engine). The reducer is renamed `applyBobs27Dart` (closes M2).

Persistence rule: the full-miss penalty is **not** written to `turns.total_score`. `totalScore` is the sum of the visit's dart board scores — always ≥ 0, satisfying `darts.score >= 0` and the documented `turns.total_score` denormalisation. The Bob's 27 running score is a derivation over the facts and belongs in a view, not a column (closes I5).

- [ ] **Step 1: Write the failing tests**

```typescript
const config = { startScore: 27, bullHitValue: 50, missPenaltyMultiplier: 1 };

it("derives the running score from the fact log", () => {
  const engine = bobs27EngineFactory.create(config);
  engine.record({ hitTargetNumber: 1, hitZoneKey: "DOUBLE" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });

  expect(engine.state().score).toBe(28);
  expect(engine.facts().turns).toHaveLength(1);
  expect(engine.facts().turns[0].darts).toHaveLength(3);
  expect(engine.facts().turns[0].totalScore).toBe(2);
});

it("never writes a negative turn total for a full-miss visit", () => {
  const engine = bobs27EngineFactory.create(config);
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });

  expect(engine.state().score).toBe(26);
  expect(engine.facts().turns[0].totalScore).toBe(0);
});

it("records the intended target on every dart", () => {
  const engine = bobs27EngineFactory.create(config);
  engine.record({ hitTargetNumber: 20, hitZoneKey: "TREBLE" });

  const dart = engine.facts().turns[0].darts[0];
  expect(dart.intendedTargetNumber).toBe(1);
  expect(dart.intendedZoneKey).toBe("DOUBLE");
  expect(dart.score).toBe(60);
});

it("rehydrates the derived score and target from persisted facts", () => {
  const first = bobs27EngineFactory.create(config);
  first.record({ hitTargetNumber: 1, hitZoneKey: "DOUBLE" });
  first.record({ hitTargetNumber: 1, hitZoneKey: "DOUBLE" });
  first.record({ hitTargetNumber: 1, hitZoneKey: "DOUBLE" });

  const resumed = bobs27EngineFactory.create(config, first.facts());
  expect(resumed.state().score).toBe(30);
  expect(resumed.state().targetIndex).toBe(1);
});

it("loses when the score reaches zero or below", () => {
  const engine = bobs27EngineFactory.create({ ...config, startScore: 1 });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });

  expect(engine.state().status).toBe("LOST");
  expect(engine.isComplete()).toBe(true);
});
```

Preserve the existing suite's win/loss-precedence and undo coverage, adapted to `record`/`undo`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/bobs27.engine.module.test.ts -t "derives the running score"`
Expected: FAIL — `bobs27EngineFactory` is not exported.

- [ ] **Step 3: Implement**, replacing the local `targetForIndex`/`targetValue` helpers with `doublesPath`/`targetAt`/`isHitOn`/`boardScore` (closes M1).

- [ ] **Step 4: Register the factory** via `registerEngineFactory(bobs27EngineFactory)` at module scope.

- [ ] **Step 5: Run the full suite**

Run: `cd app && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game app/tests/modules/game
git commit -m "refactor: put Bob's 27 on the GameEngine contract"
```

### Task 7: Singles Training on the contract

**Files:**
- Modify: `app/src/modules/game/singles-training.engine.module.ts`, `app/src/modules/game/types.ts`
- Test: `app/tests/modules/game/singles-training.engine.module.test.ts`

**Interfaces:**
- Produces: `singlesTrainingEngineFactory: GameEngineFactory<SinglesTrainingSnapshot, DartObservation, SinglesTrainingState>`; reducer renamed `applySinglesTrainingDart`.

Persistence rule: **training points are never stored.** `DartFact.score` carries the actual board score of the dart thrown; training points are derived from `hitZoneKey` relative to the visit's target using the config's `pointsSingle`/`pointsDouble`/`pointsTreble`, with `OUTER_BULL` → `pointsSingle` and `INNER_BULL` → `pointsDouble`. `state().totalPoints` folds the fact log. This is the direct fix for C2 and the analytics-corruption half of I5. `intendedTargetNumber`/`intendedZoneKey` come from the current target, which makes intention-vs-result accuracy available for free (D06).

- [ ] **Step 1: Write the failing tests**

```typescript
const config = {
  orderMode: "LOW_TO_HIGH", difficulty: "EASY",
  pointsSingle: 1, pointsDouble: 2, pointsTreble: 3,
} as const;

it("stores board score in the fact and derives training points", () => {
  const engine = singlesTrainingEngineFactory.create(config);
  engine.record({ hitTargetNumber: 1, hitZoneKey: "TREBLE" });

  const dart = engine.facts().turns[0].darts[0];
  expect(dart.score).toBe(3);
  expect(dart.intendedTargetNumber).toBe(1);
  expect(dart.intendedZoneKey).toBe("SINGLE");
  expect(engine.state().totalPoints).toBe(3);
});

it("scores a dart that missed the target as zero training points but keeps the board fact", () => {
  const engine = singlesTrainingEngineFactory.create(config);
  engine.record({ hitTargetNumber: 20, hitZoneKey: "TREBLE" });

  expect(engine.facts().turns[0].darts[0].score).toBe(60);
  expect(engine.state().totalPoints).toBe(0);
});

it("advances to the next target after three darts", () => {
  const engine = singlesTrainingEngineFactory.create(config);
  engine.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });

  expect(engine.state().targetIndex).toBe(1);
  expect(engine.facts().turns).toHaveLength(1);
  expect(engine.facts().turns[0].totalScore).toBe(3);
});

it("maps bull rings to the bull zones and their training points", () => {
  const engine = singlesTrainingEngineFactory.create(config, facts20TargetsPlayed());
  engine.record({ hitTargetNumber: 25, hitZoneKey: "INNER_BULL" });

  const dart = engine.facts().turns.at(-1)!.darts.at(-1)!;
  expect(dart.hitZoneKey).toBe("INNER_BULL");
  expect(dart.score).toBe(50);
  expect(engine.state().totalPoints).toBe(2);
});

it("completes after the bull visit", () => {
  const engine = singlesTrainingEngineFactory.create(config, facts20TargetsPlayed());
  engine.record({ hitTargetNumber: 25, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 25, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 25, hitZoneKey: "MISS" });

  expect(engine.isComplete()).toBe(true);
});
```

Write `facts20TargetsPlayed()` as a local helper that returns `EngineFacts` for 20 completed all-`MISS` visits, so the engine rehydrates onto the bull target.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts -t "stores board score"`
Expected: FAIL — `singlesTrainingEngineFactory` is not exported.

- [ ] **Step 3: Implement**, replacing the `DartRing` input with `DartObservation` and the local `targetForIndex` with `numbersPath`/`targetAt`.

- [ ] **Step 4: Register the factory** via `registerEngineFactory`.

- [ ] **Step 5: Run the full suite**

Run: `cd app && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game app/tests/modules/game
git commit -m "refactor: put Singles Training on the GameEngine contract"
```

### Task 8: Doubles Training on the contract

**Files:**
- Modify: `app/src/modules/game/doubles-training.engine.module.ts`, `app/src/modules/game/types.ts`
- Test: `app/tests/modules/game/doubles-training.engine.module.test.ts`

**Interfaces:**
- Produces: `doublesTrainingEngineFactory: GameEngineFactory<DoublesTrainingSnapshot, DartObservation, DoublesTrainingState>`; reducer renamed `applyDoublesTrainingDart`. Early visit termination on a hit is preserved. `DoublesVisitOutcome` becomes a **derivation** over `facts()` exposed as `state().outcomes`, not stored state.

- [ ] **Step 1: Write the failing tests**

```typescript
const config = { mode: "EASY", orderMode: "LOW_TO_HIGH" } as const;

it("ends the visit on a hit and records only the darts thrown", () => {
  const engine = doublesTrainingEngineFactory.create(config);
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "DOUBLE" });

  const turn = engine.facts().turns[0];
  expect(turn.darts).toHaveLength(2);
  expect(turn.totalScore).toBe(2);
  expect(engine.state().targetIndex).toBe(1);
});

it("derives which dart hit from the fact log", () => {
  const engine = doublesTrainingEngineFactory.create(config);
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "DOUBLE" });

  expect(engine.state().outcomes[0]).toEqual({ targetIndex: 0, hit: true, hitDartNumber: 2 });
});

it("records a full-miss visit as three darts and no hit", () => {
  const engine = doublesTrainingEngineFactory.create(config);
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 5, hitZoneKey: "SINGLE" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });

  expect(engine.facts().turns[0].darts).toHaveLength(3);
  expect(engine.state().outcomes[0]).toEqual({ targetIndex: 0, hit: false, hitDartNumber: null });
  expect(engine.state().targetIndex).toBe(1);
});

it("rehydrates the target and outcomes from persisted facts", () => {
  const first = doublesTrainingEngineFactory.create(config);
  first.record({ hitTargetNumber: 1, hitZoneKey: "DOUBLE" });

  const resumed = doublesTrainingEngineFactory.create(config, first.facts());
  expect(resumed.state().targetIndex).toBe(1);
  expect(resumed.state().outcomes).toHaveLength(1);
});

it("completes after the bull visit", () => {
  const engine = doublesTrainingEngineFactory.create(config, facts20TargetsPlayed());
  engine.record({ hitTargetNumber: 25, hitZoneKey: "INNER_BULL" });
  expect(engine.isComplete()).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts -t "ends the visit on a hit"`
Expected: FAIL — `doublesTrainingEngineFactory` is not exported.

- [ ] **Step 3: Implement**, using `doublesPath`/`targetAt`/`isHitOn`/`boardScore`.

- [ ] **Step 4: Register the factory** via `registerEngineFactory`.

- [ ] **Step 5: Run the full suite**

Run: `cd app && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game app/tests/modules/game
git commit -m "refactor: put Doubles Training on the GameEngine contract"
```

### Task 9: 501 on the contract, with real checkout, score cap and legs

**Files:**
- Modify: `app/src/modules/game/five-oh-one.engine.module.ts`, `app/src/modules/game/types.ts`
- Test: `app/tests/modules/game/five-oh-one.engine.module.test.ts`

**Interfaces:**
- Produces: `fiveOhOneEngineFactory: GameEngineFactory<FiveOhOneSnapshot, FiveOhOneVisitInput, FiveOhOneState>`; reducer renamed `applyFiveOhOneVisit`.

```typescript
export type FiveOhOneVisitInput = {
  scoreAttempted: number;
  finishedOnDouble?: boolean;    // did the dart that reached 0 land on a double
  dartsUsed?: 1 | 2 | 3;
  dartsAtDouble?: 0 | 1 | 2 | 3; // analytics only, never a win condition
};
```

Three rule fixes land here:
1. **Score cap (I7):** `scoreAttempted` must be an integer in `0..config.maxVisitScore`; anything else throws before any state change. Negative scores can no longer inflate the remaining total.
2. **Double-out (I8):** the win condition is `finishedOnDouble === true`, not `dartsOnDouble >= 1`. `dartsAtDouble` survives as an analytics fact only.
3. **Legs (I4/C1):** `config.legsToWin` drives one `LEG` stage per leg; a won leg opens the next stage and resets `remainingScore` to `config.startingScore`; the session completes when legs won reaches `legsToWin`. This makes the seeded `501 — Best of 5 Legs` preset executable.

The existing bust matrix is preserved: `wouldRemain < 0` → bust; `=== 1` → bust; `=== 0` without a qualifying finish → bust. A bust turn records `totalScore: 0` and leaves `remainingScore` unchanged — the attempted value is never persisted as the turn total.

- [ ] **Step 1: Write the failing tests**

```typescript
const config = () => ({
  startingScore: 501, legsToWin: 1, checkIn: "STRAIGHT_IN",
  checkOut: "DOUBLE_OUT", maxDartsPerTurn: 3, maxVisitScore: 180,
}) as const;

it("rejects an impossible visit score instead of inflating the total", () => {
  const engine = fiveOhOneEngineFactory.create(config());
  expect(() => engine.record({ scoreAttempted: -100 })).toThrow(/0 and 180/);
  expect(() => engine.record({ scoreAttempted: 181 })).toThrow(/0 and 180/);
  expect(engine.state().remainingScore).toBe(501);
  expect(engine.facts().turns).toHaveLength(0);
});

it("requires the finishing dart to be a double", () => {
  const engine = fiveOhOneEngineFactory.create(config());
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 101 });
  const busted = engine.record({ scoreAttempted: 40, finishedOnDouble: false, dartsAtDouble: 2 });

  expect(busted.status).toBe("IN_PROGRESS");
  expect(engine.state().remainingScore).toBe(40);
  expect(engine.facts().turns.at(-1)?.totalScore).toBe(0);
});

it("wins the leg when the finishing dart is a double", () => {
  const engine = fiveOhOneEngineFactory.create(config());
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 101 });
  const won = engine.record({ scoreAttempted: 40, finishedOnDouble: true, dartsUsed: 2, dartsAtDouble: 1 });

  expect(won.status).toBe("WON");
  expect(engine.isComplete()).toBe(true);
});

it("busts when the visit would leave exactly one", () => {
  const engine = fiveOhOneEngineFactory.create(config());
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 180 });
  engine.record({ scoreAttempted: 140 });
  expect(engine.state().remainingScore).toBe(1);
});

it("opens a new LEG stage per leg and completes at legsToWin", () => {
  const engine = fiveOhOneEngineFactory.create({ ...config(), legsToWin: 2 });
  winOneLeg(engine);
  expect(engine.isComplete()).toBe(false);
  expect(engine.state().remainingScore).toBe(501);
  expect(engine.facts().stages).toHaveLength(2);
  expect(engine.facts().stages[1].stageTypeKey).toBe("LEG");
  winOneLeg(engine);
  expect(engine.isComplete()).toBe(true);
});

it("rehydrates mid-leg from persisted facts", () => {
  const first = fiveOhOneEngineFactory.create(config());
  first.record({ scoreAttempted: 100 });
  const resumed = fiveOhOneEngineFactory.create(config(), first.facts());
  expect(resumed.state().remainingScore).toBe(401);
});
```

The third test's bust case leaves 40 remaining after a busted visit, so `winOneLeg(engine)` is a local helper that plays `180, 180, 101, 40 (finishedOnDouble)`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts -t "rejects an impossible visit score"`
Expected: FAIL — `fiveOhOneEngineFactory` is not exported.

- [ ] **Step 3: Implement** the three fixes on top of the existing bust matrix.

- [ ] **Step 4: Register the factory** via `registerEngineFactory`.

- [ ] **Step 5: Run the full suite**

Run: `cd app && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game app/tests/modules/game
git commit -m "refactor: put 501 on the GameEngine contract with leg and checkout rules"
```

---

## Phase 3 — Server and data alignment

### Task 10: Ruleset validators for all five games

**Files:**
- Create: `app/src/services/rulesets/{bobs27,singles-training,doubles-training,five-oh-one}/*.validator.ts`
- Modify: `app/src/services/rulesets/registry.ts`, `app/src/services/rulesets/score-training/score-training.validator.ts`, `app/src/services/rulesets/score-training/types.ts`
- Test: `app/tests/services/rulesets/*.validator.test.ts`

**Interfaces:**
- Consumes: `RULESET_CONFIGS` (Task 2).
- Produces: a `RulesetValidator` per ruleset version, all five registered. Each `validateConfig` parses with the shared schema instead of a private copy; each `validateBatch` enforces the capture/input-mode matrix (D07/D73) and the ruleset's own caps.

Without this, `POST /api/sessions` rejects every game but Score Training (`session.service.ts:249`) — closing I4. Score Training's local `ScoreTrainingConfig` schema is deleted in favour of the shared one, removing the last duplicate.

Capture/input matrix per game: Score Training and 501 are `RECREATIONAL` + `QUICK_SCORE` (turn totals, zero dart rows). Bob's 27, Singles Training and Doubles Training are `RECREATIONAL` + `DETAILED_DARTS` (hit-only dart rows, intention pair permitted) — their engines emit dart facts.

**Decide `.strict()` vs `.strip()` first.** Task 2's schemas use default `z.object()`, which **silently strips** unrecognized keys (verified against Zod 3.25.76: `z.object({a}).parse({a:1,b:2})` → `{a:1}`). Two seeded presets already carry keys no schema models — 501's `sets_to_win` and Singles Training's `duration_type`/`duration_value`/`max_darts_per_turn` — and every `toSnapshot` call destroys them without a word. Switch `RULESET_CONFIGS` to `.strict()` so a seed/schema divergence fails a test instead of quietly losing data, and add a test proving an unknown key is rejected. Task 11 then makes the seeds match. If you keep `.strip()`, say why in the report.

- [ ] **Step 1: Write the failing tests** (one file per validator; 501 shown)

```typescript
it("rejects a turn total above the ruleset cap", () => {
  const result = fiveOhOneValidator.validateBatch({
    config: {
      starting_score: 501, legs_to_win: 1, check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT", max_darts_per_turn: 3, max_visit_score: 180,
    },
    batch: {
      stages: [{
        clientKey: "leg-1", stageTypeKey: "LEG", parentClientKey: null, sequence: 1,
        turns: [{
          clientKey: "t1", participantRef: "p1", sequence: 1,
          totalScore: 181, completedAt: "2026-07-25T10:00:00.000Z", darts: [],
        }],
      }],
    },
    existingTurnCount: 0,
  });
  expect(result.valid).toBe(false);
});

it("rejects dart rows under QUICK_SCORE capture", () => { /* … */ });

it("rejects a capture/input mode combination the ruleset does not support", () => {
  const result = fiveOhOneValidator.validateConfig({
    config: { /* valid config */ },
    captureModeKey: "ANALYTICS",
    inputModeKey: "DETAILED_DARTS",
  });
  expect(result.valid).toBe(false);
});
```

Write the equivalent three cases per game, using each game's own cap and capture matrix.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/services/rulesets`
Expected: FAIL — validator modules not found.

- [ ] **Step 3: Implement the four new validators**, and repoint Score Training's at the shared schema.

- [ ] **Step 4: Register all five** in `services/rulesets/registry.ts`.

- [ ] **Step 5: Run the full suite**

Run: `cd app && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/services/rulesets app/tests/services/rulesets
git commit -m "feat: register ruleset validators for all five games"
```

### Task 11: Seed the missing games, correct the drifted presets

**Files:**
- Create: `database/seeds/0003_game_engine_reference.sql`
- Modify: `database/seeds/0002_default_templates.sql`, `docs/architecture/05-Database/10-Database-Agent-Guide.md`, `database/README.md`

**Interfaces:**
- Produces: `game_types` `BOBS27` + `DOUBLES_TRAINING`; matching `game_type_features` rows; `ruleset_versions` `BOBS27_V1` + `DOUBLES_TRAINING_V1`; `configuration_templates` presets for both, keyed exactly as the Task 2 schemas expect.

Also corrects every known seed/schema divergence (I4). The full list, verified against `database/seeds/0002_default_templates.sql`:

| Preset | Problem | Fix |
| ------ | ------- | --- |
| Singles Training (`…05`, `…06`, lines 172-189) | Ship V2+ `order_mode: HIGH_TO_LOW`/`RANDOM` and `difficulty: NORMAL`/`HARD`, which `SINGLES_V1` rejects | Bring to V1 scope (`LOW_TO_HIGH` + `EASY`) or drop the second preset |
| Singles Training (same rows) | Carry `duration_type`, `duration_value`, `max_darts_per_turn` — modeled by no schema and absent from the V1 ruleset doc | Remove; Singles Training has no duration concept |
| 501 (`…01`, `…02`, lines 102, 120) | Carry `sets_to_win`, modeled by no schema | Remove (sets are V2+ per the ruleset) and add `max_visit_score: 180` |

With Task 9 the `legs_to_win: 3` preset becomes playable, so 501 needs no scope change beyond those keys.

- [ ] **Step 1: Write the new seed with fixed ids**

Follow the Seed Checklist in `05-Database/10-Database-Agent-Guide.md`: explicit UUIDs continuing the existing ranges (`0198f000-*` game types, `0198f100-*` ruleset versions, `0198f300-*` configuration templates), `is_system_template = TRUE`, `player_id IS NULL`, explicit `BEGIN`/`COMMIT`, `ON CONFLICT (id) DO NOTHING` for new rows.

- [ ] **Step 2: Correct the drifted rows with `DO UPDATE`, not `DO NOTHING`**

`0002`'s `ON CONFLICT (id) DO NOTHING` means an edited row never re-applies to an already-seeded database. Corrections must use:

```sql
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    configuration = EXCLUDED.configuration,
    updated_at = now();
```

- [ ] **Step 3: Add a codec test that every seeded preset parses**

```typescript
it("parses every seeded preset for its ruleset version", () => {
  for (const [key, wire] of SEEDED_PRESETS) {
    expect(() => toSnapshot(key, wire)).not.toThrow();
  }
});
```

`SEEDED_PRESETS` is a fixture in the test file listing each preset's `rulesetVersionKey` and its exact `configuration` JSON copied from the seed files. This is what makes a future seed/schema drift fail a test instead of a session.

- [ ] **Step 4: Apply and verify against the dev branch**

Run: `cd app && npm run env:dev && npm run db:seed`
Then: `cd app && npm test`
Expected: seeds apply cleanly; suite green including the new preset test.

- [ ] **Step 5: Update the docs that name the seed chain** — `10-Database-Agent-Guide.md` "Current seeds" and `database/README.md` apply order gain `0003`.

- [ ] **Step 6: Commit**

```bash
git add database docs/architecture/05-Database/10-Database-Agent-Guide.md app/tests
git commit -m "feat: seed Bob's 27 and Doubles Training, correct drifted presets"
```

### Task 12: Mechanical engine guard

**Files:**
- Create: `scripts/check-game-engines.sh`
- Modify: `.github/workflows/checks.yml`

**Interfaces:**
- Produces: a check that fails when any `app/src/modules/game/*.engine.module.ts` (a) exports no `*EngineFactory`, (b) does not call `registerEngineFactory`, or (c) names a `rulesetVersionKey` absent from `services/rulesets/registry.ts`.

This is the D105/D110/D127 pattern — convert a discipline-only rule into an enforced one so engine #6 cannot repeat P4.

- [ ] **Step 1: Prove the check fails on a violation**

Create a temporary `app/src/modules/game/__fixture.engine.module.ts` exporting nothing, run the script, confirm non-zero exit and a message naming the file, then delete the fixture.

- [ ] **Step 2: Implement the script** following `scripts/check-file-locations.sh` — same output format, same exit conventions, same `set -euo pipefail` shape.

- [ ] **Step 3: Verify it passes on the real tree**

Run: `bash scripts/check-game-engines.sh`
Expected: exit 0, all five engines reported conforming.

- [ ] **Step 4: Wire into CI** — add the step to `.github/workflows/checks.yml` beside the other `check-*.sh` invocations.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-game-engines.sh .github/workflows/checks.yml
git commit -m "feat: enforce the game engine contract mechanically"
```

---

## Phase 4 — Documentation and agent guidelines

### Task 13: Canonical docs

**Files:**
- Modify: `docs/architecture/04-Architecture-patterns.md`, `docs/architecture/07-Frontend/04-Modules-And-OOP.md`, `docs/architecture/07-Frontend/02-Folder-Structure.md`, `docs/architecture/05-Database/10-Database-Agent-Guide.md`, `docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md`, `docs/architecture/00-Context-Map.md`, `DECISIONS.md`, `docs/game-rules/rulesets/{bobs-27,singles-training,doubles-training,501}.md`, `docs/game-rules/templates/GAME_ENGINE_TEMPLATE.md`

- [ ] **Step 1: Add Pattern 18 — Game Engine Contract** to `04-Architecture-patterns.md`, in the document's existing Principle / Application / Rule format: engines are constructed from a validated config snapshot bound to a ruleset version; they own the fact log; they mint `clientKey`/`sequence`/`completedAt`; they rehydrate from persisted facts; derived values (running score, training points, ratios, averages) are never stored in a fact. Closes P2 — the pattern is written down rather than copied by imitation.

- [ ] **Step 2: Update `07-Frontend/04-Modules-And-OOP.md`** — replace the Engine vs Payload table with the contract; keep the Key Ownership table (it was already right — the engines were wrong). Add anti-patterns: "engine accumulates a score field instead of folding facts", "engine that cannot be rebuilt from persisted facts", "per-game payload module".

- [ ] **Step 3: Register `lib/game/rulesets/` in `02-Folder-Structure.md`** as the cross-runtime home for ruleset config schemas, with the import-direction note: the Worker and the browser may both import it; it may import neither.

- [ ] **Step 4: Record the persistence semantics in `06-Spec/04-Runtime-Layer.md`** under `turns`/`darts`: `darts.score` is the actual board score of the dart thrown, never a game-specific point value; `turns.total_score` is the sum of counted dart scores (0 for a void visit) and is never negative; game-specific scores are derived. Closes I5.

- [ ] **Step 5: Write the resolved rules back into the ruleset docs** (closes M5) — move each engine spec's resolutions into the matching `docs/game-rules/rulesets/*.md` and delete the corresponding "Open questions" bullets: Bob's 27 bull = inner 50 only / outer = miss plus the face-value multi-hit math; Singles bull = outer 1 / inner 2; Doubles bull identity; 501 finishing-dart-is-a-double.

- [ ] **Step 6: Extend `10-Database-Agent-Guide.md` §"Add a new game type"** — steps 6–7 currently say "Frontend game engine (outside database)". Replace with the real checklist: shared config schema → server validator + registry entry → engine implementing the contract + registry entry → seeds → `check-game-engines.sh` green.

- [ ] **Step 7: Extend `GAME_ENGINE_TEMPLATE.md`** with a required "Capture" section: which capture/input mode the game needs, what one dart's fact looks like, and which stage type the game creates. A ruleset that answers this cannot produce an engine with an unpersistable state shape — the root cause of C2.

- [ ] **Step 8: Add decision entries to `DECISIONS.md`** (one line each, next free `D` numbers): the game engine contract; fact-log ownership and the derived-score rule; shared `lib/game/rulesets/` config schemas; the 501 double-out finishing-dart rule and ruleset-owned visit cap; `check-game-engines.sh` enforcement.

- [ ] **Step 9: Register everything in `00-Context-Map.md`** — add a "New game engine" context pack (`04-Architecture-patterns.md` Pattern 18, `07-Frontend/04-Modules-And-OOP.md`, `10-Database-Agent-Guide.md` §Add a new game type, the game's ruleset doc) with a token budget, and add the review-spec and plan rows with ISO dates.

- [ ] **Step 10: Run the seven checkers**

Run: `for s in check-context-map check-file-locations check-agent-mirrors check-astro-class-composition check-astro-conventions check-doc-links check-context-budget; do printf "%s: " "$s"; bash scripts/$s.sh >/dev/null 2>&1 && echo PASS || echo FAIL; done`
Expected: seven `PASS` lines.

- [ ] **Step 11: Commit**

```bash
git add docs DECISIONS.md
git commit -m "docs: record the game engine contract and persistence semantics"
```

### Task 14: Agent guideline hardening (requires explicit user approval)

**Files:**
- Modify: `app/CLAUDE.md` + `app/AGENT.md`, `CLAUDE.md` + `AGENT.md` (repo root)

Per D107 these are **proposals**. Present them, get an explicit yes, then write. Both mirrors stay byte-for-byte identical (`scripts/check-agent-mirrors.sh`).

- [ ] **Step 1: Propose the `app/CLAUDE.md` rule**

> **Game engines.** Every `*.engine.module.ts` implements the `GameEngine` contract (`07-Frontend/04-Modules-And-OOP.md`): constructed from a validated config snapshot bound to a `rulesetVersionKey`, owns its `EngineFacts` log, mints `clientKey`/`sequence`/`completedAt`, and rehydrates from persisted facts. Never store a value the fact log can derive — no accumulated score, points, ratio or average fields. `bash scripts/check-game-engines.sh` must pass.

- [ ] **Step 2: Propose the root `CLAUDE.md` scope rule**

> An engine-only task must still prove its state shape can be persisted: name the capture/input mode, the stage type, and the `turns`/`darts` mapping in the spec before implementation. Deferring persistence is allowed; choosing a state shape that cannot express it is not.

Rationale for the user: this is the single rule that would have caught C1, C2, I1 and I2 in the first PR instead of the fifth.

- [ ] **Step 3: Propose the stacked-branch rule** (closes P1)

> At most one open task branch may target another task branch. A third stacked branch means the first must land, or the work merges into one branch.

- [ ] **Step 4: Apply only the approved items, to both mirrors.**

- [ ] **Step 5: Verify mirrors and commit**

Run: `bash scripts/check-agent-mirrors.sh`
Expected: pass.

```bash
git add CLAUDE.md AGENT.md app/CLAUDE.md app/AGENT.md
git commit -m "docs: harden agent guidelines for game engine work"
```

---

## Completion gate

- [ ] `cd app && npm run validate:app` — green, including `npx fallow`, `npm test`, `astro check`.
- [ ] `cd app && npm run format && npm run format:check` — clean.
- [ ] All eight checkers pass (seven existing + `check-game-engines.sh`).
- [ ] `bash scripts/refresh-graph.sh` run and `graphify-out/graph.json` staged — or the CLI's absence recorded in the completion report (P3).
- [ ] Every finding in `2026-07-25-game-engine-review-design.md` is either closed by a task above or explicitly declined in the PR body with a reason.
- [ ] PR opened against `main`; `main` carries no unmerged engine branch behind it.
