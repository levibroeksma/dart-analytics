# Game Engine Contract Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace five bespoke game engines with one config-driven `GameEngine` contract that owns the fact log, mints persistence keys, rehydrates from persisted facts, and is mechanically enforced for every future game.

**Architecture:** A ruleset version key + a validated config snapshot construct every engine. Engines consume dart/visit *observations* and emit `StageFact`/`TurnFact` records that map 1:1 onto `exercise_stages`/`turns`/`darts`. One generic payload builder replaces per-game payload modules. Config Zod schemas move to `lib/game/rulesets/` so the Worker validator and the browser engine share one definition. Running scores, training points and ratios stop being stored anywhere — they are derived from the facts.

**Tech Stack:** TypeScript, Astro, Alpine (`$persist`), Zod, Vitest, PostgreSQL/Neon seeds.

**Findings this plan closes:** `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` — C1, C2, I1–I8, M1–M6, P1–P4, ST1–ST7.

## Global Constraints

- Root `CLAUDE.md` Hard Invariants apply in full. Store facts; statistics live in views only.
- TDD is mandatory (`app/CLAUDE.md`): failing test first, verify it fails, minimal implementation, verify green, commit.
- No `//` or `/* */` comments inside function bodies under `app/src/**/*.ts` — JSDoc above the declaration only.
- Tests live under `app/tests/`, mirroring `app/src/` — never colocated.
- `tsconfig.json` `paths` and `vitest.config.ts` `resolve.alias` must stay in sync.
- Imports use `@`-prefixed aliases; no deep relative paths.
- `export type` / `export interface` never inline in a `.module.ts` — they live in the folder's `types.ts` / `interfaces.ts`.
- Browser areas (`modules/`, `stores/`, `forms/`) must not import `services/`, `repositories/`, `lib/server/`.
- Before every PR: `cd app && npm run format`, commit the diff, confirm `npm run format:check` clean.
- Completion bar for the whole change set: `cd app && npm run validate:app`, plus all seven `scripts/check-*.sh`.
- Never modify applied migrations `0001`–`0016`. Seeds may be corrected in place, but a correction to an already-seeded row needs `ON CONFLICT (id) DO UPDATE`, not `DO NOTHING`.
- Rule changes to any `CLAUDE.md` / `AGENT.md` require explicit user approval before writing (self-learning gate, D107). Tasks 15–16 propose; they do not apply without that approval.

## Assumption on merge order (revisit before Task 1)

The four PRs are green, reviewed, and wire no routes — nothing user-facing ships by merging them. They are also stacked four deep against a `main` that has not moved, which root `CLAUDE.md`/D96 call a defect outright. **Plan assumes: fix the one verified in-branch bug (Task 0), merge #41 → #42 → #43 → #48 in order, then execute Tasks 1–16 on a single branch off `main`.** If you would rather not land non-conforming engines on `main` at all, close the four PRs and start at Task 1 — no other task changes.

---

## File Structure

**New**

| Path | Responsibility |
| ---- | -------------- |
| `app/src/lib/game/rulesets/types.ts` | `RulesetVersionKey` union + per-ruleset Zod config schemas + inferred config types. Single definition shared by Worker validators and browser engines. |
| `app/src/lib/game/rulesets/config-codec.ts` | `toSnapshot()` / `toWireConfig()` — the one place snake_case DB config and camelCase client snapshots translate. |
| `app/src/modules/game/interfaces.ts` | `GameEngine`, `GameEngineFactory`. |
| `app/src/modules/game/board-progression.module.ts` | Shared `D1→D20→bull` / `1→20→bull` paths and the board-score table. |
| `app/src/modules/game/events.payload.module.ts` | Generic `buildEventsBatch(participantRef, stages, turns)`. |
| `app/src/modules/game/engine.registry.ts` | `rulesetVersionKey → GameEngineFactory` lookup. |
| `app/src/services/rulesets/{bobs27,singles-training,doubles-training,five-oh-one}/*.validator.ts` | Server-side config + batch validation per ruleset version. |
| `database/seeds/0003_game_engine_reference.sql` | `BOBS27` + `DOUBLES_TRAINING` game types, features, ruleset versions, presets. |
| `scripts/check-game-engines.sh` | Mechanical guard: every engine implements the contract, is registered, and has a validator. |

**Modified**

| Path | Change |
| ---- | ------ |
| `app/src/modules/game/types.ts` | Add `DartZoneKey`, `DartObservation`, `DartFact`, `TurnFact`, `StageFact`, `EngineFacts`; prefix per-game type names. |
| `app/src/modules/game/*.engine.module.ts` (×5) | Retrofit to the contract. |
| `app/src/stores/game.store.ts`, `app/src/stores/types.ts` | Game-agnostic store: `rulesetVersionKey`, config union, `stages`, `turns`; `_v` → 2. |
| `app/src/lib/game/score-training-{setup,play}.data.ts` | Use the codec, the registry and the generic payload builder; fix the stuck `loading` flag. |
| `app/src/services/rulesets/registry.ts` | Register all five validators. |
| `database/seeds/0002_default_templates.sql` | Correct Singles presets to V1 scope; align 501 presets with the shipped leg scope. |
| `docs/…` (Task 15), `DECISIONS.md`, `00-Context-Map.md`, `CLAUDE.md`/`AGENT.md` (Task 16) | Documentation + guideline hardening. |

**Deleted**

| Path | Reason |
| ---- | ------ |
| `app/src/modules/game/score-training.payload.module.ts` | Superseded by `events.payload.module.ts`. |

---

## Phase 0 — Land the stack

### Task 0: Fix the Bob's 27 visit leak before merging #41

**Files:**
- Modify: `app/src/modules/game/bobs27.engine.module.ts:30-64`
- Test: `app/tests/modules/game/bobs27.engine.module.test.ts:206`

**Interfaces:**
- Consumes: nothing.
- Produces: `Bobs27State.dartsThisVisit` is `[]` immediately after a visit resolves (finding I6; matches the PR's own spec §3 step 5 and both sibling engines).

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

In `bobs27.engine.module.ts`, drop the lazy-clear line and reset in the three resolution branches:

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

`bobs27.engine.module.test.ts:206` currently asserts `[false, false, false]` after undoing a resolved full-miss visit. Undo restores the *pre-third-dart* state, so the correct expectation is the two darts that had been thrown:

```typescript
expect(afterRestoredDart.dartsThisVisit).toEqual([false, false]);
```

- [ ] **Step 5: Run the whole engine suite**

Run: `cd app && npx vitest run tests/modules/game/bobs27.engine.module.test.ts`
Expected: PASS, 20 tests.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game/bobs27.engine.module.ts app/tests/modules/game/bobs27.engine.module.test.ts
git commit -m "fix: clear Bob's 27 visit darts at visit resolution"
```

- [ ] **Step 7: Merge the stack in order**

Merge #41, then #42, then #43, then #48, letting GitHub retarget each to `main` as its parent lands. Refresh the knowledge graph once on `main` afterwards (`bash scripts/refresh-graph.sh`; closes P3) and confirm `main` is green: `cd app && npm run validate:app`.

---

## Phase 1 — The contract

### Task 1: Fact types shared by every engine

**Files:**
- Modify: `app/src/modules/game/types.ts`
- Test: `app/tests/modules/game/types.test.ts` (create)

**Interfaces:**
- Produces:

```typescript
export type DartZoneKey =
  | "SINGLE" | "DOUBLE" | "TREBLE" | "OUTER_BULL" | "INNER_BULL" | "MISS";

export type StageTypeKey = "MATCH" | "SET" | "LEG" | "ROUND" | "EXERCISE_BLOCK";

/** What the player did, as observed at input time — the engine's only input. */
export type DartObservation = {
  hitTargetNumber: number | null;
  hitZoneKey: DartZoneKey;
};

/** One row of `darts`. `score` is the actual board score, never a game-specific point value. */
export type DartFact = {
  dartNumber: 1 | 2 | 3;
  intendedTargetNumber: number | null;
  intendedZoneKey: DartZoneKey | null;
  hitTargetNumber: number | null;
  hitZoneKey: DartZoneKey | null;
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

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/game/types.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { boardScore } from "@modules/game/board-progression.module";
import type { DartFact } from "@modules/game/types";

describe("dart fact shape", () => {
  it("carries board score, not game points", () => {
    const fact: DartFact = {
      dartNumber: 1,
      intendedTargetNumber: 5,
      intendedZoneKey: "SINGLE",
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      score: boardScore(20, "TREBLE"),
    };
    expect(fact.score).toBe(60);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/types.test.ts`
Expected: FAIL — cannot resolve `@modules/game/board-progression.module`.

- [ ] **Step 3: Add the types**

Append the block from **Interfaces** to `app/src/modules/game/types.ts`. In the same edit, rename the collision-prone per-game names (finding M2): `VisitOutcome` → `DoublesVisitOutcome`, and update `doubles-training.engine.module.ts` + its test accordingly.

- [ ] **Step 4: Leave the test red**

It stays red until Task 2 lands `boardScore`. Do not stub it here.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/doubles-training.engine.module.ts app/tests/modules/game/
git commit -m "feat: add shared engine fact types"
```

### Task 2: Shared board progression and scoring

**Files:**
- Create: `app/src/modules/game/board-progression.module.ts`
- Test: `app/tests/modules/game/board-progression.module.test.ts`

**Interfaces:**
- Consumes: `DartZoneKey` from Task 1.
- Produces:

```typescript
export type BoardTarget =
  | { kind: "NUMBER"; number: number }
  | { kind: "DOUBLE"; number: number }
  | { kind: "BULL" };

export function doublesPath(): readonly BoardTarget[];   // D1..D20, BULL — 21 entries
export function numbersPath(): readonly BoardTarget[];   // 1..20, BULL — 21 entries
export function targetAt(path: readonly BoardTarget[], index: number): BoardTarget;
export function boardScore(targetNumber: number | null, zone: DartZoneKey): number;
export function isHitOn(target: BoardTarget, observation: DartObservation): boolean;
```

`boardScore` is the single source of dartboard arithmetic: `SINGLE` → n, `DOUBLE` → 2n, `TREBLE` → 3n, `OUTER_BULL` → 25, `INNER_BULL` → 50, `MISS` → 0.

- [ ] **Step 1: Write the failing test**

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

  it("scores the board", () => {
    expect(boardScore(20, "SINGLE")).toBe(20);
    expect(boardScore(20, "DOUBLE")).toBe(40);
    expect(boardScore(20, "TREBLE")).toBe(60);
    expect(boardScore(25, "OUTER_BULL")).toBe(25);
    expect(boardScore(25, "INNER_BULL")).toBe(50);
    expect(boardScore(20, "MISS")).toBe(0);
  });

  it("recognises a hit on the required double", () => {
    const target = targetAt(doublesPath(), 0);
    expect(isHitOn(target, { hitTargetNumber: 1, hitZoneKey: "DOUBLE" })).toBe(true);
    expect(isHitOn(target, { hitTargetNumber: 1, hitZoneKey: "SINGLE" })).toBe(false);
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
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import type { DartObservation, DartZoneKey } from "./types";
import type { BoardTarget } from "./types";

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

Move `BoardTarget` into `app/src/modules/game/types.ts` (no inline `export type` in a `.module.ts`).

- [ ] **Step 4: Run both test files**

Run: `cd app && npx vitest run tests/modules/game/board-progression.module.test.ts tests/modules/game/types.test.ts`
Expected: PASS, both files.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/board-progression.module.ts app/src/modules/game/types.ts app/tests/modules/game/
git commit -m "feat: add shared board progression and scoring"
```

### Task 3: `GameEngine` contract and registry

**Files:**
- Create: `app/src/modules/game/interfaces.ts`, `app/src/modules/game/engine.registry.ts`
- Test: `app/tests/modules/game/engine.registry.test.ts`

**Interfaces:**
- Consumes: `EngineFacts`, `StageFact`, `TurnFact` (Task 1).
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
```

`create(config, prior)` is the rehydrate path (finding I2): passing the persisted `EngineFacts` back rebuilds the engine's state by replaying them, so a page refresh restores the game exactly.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { getEngineFactory } from "@modules/game/engine.registry";

describe("engine registry", () => {
  it("returns a factory for every registered ruleset version", () => {
    expect(getEngineFactory("SCORE_TRAINING_V1")?.rulesetVersionKey).toBe(
      "SCORE_TRAINING_V1",
    );
  });

  it("returns undefined for an unknown ruleset version", () => {
    expect(getEngineFactory("NOT_A_RULESET" as never)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/engine.registry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the interfaces**

`app/src/modules/game/interfaces.ts` — the two interface declarations above, importing `EngineFacts` from `./types` and `RulesetVersionKey` from `@lib/game/rulesets/types` (created in Task 4; import it now and accept the red type until then).

- [ ] **Step 4: Implement the registry**

```typescript
import type { RulesetVersionKey } from "@lib/game/rulesets/types";
import type { GameEngineFactory } from "./interfaces";
import { scoreTrainingEngineFactory } from "./score-training.engine.module";

const REGISTRY = {
  SCORE_TRAINING_V1: scoreTrainingEngineFactory,
} as const satisfies Partial<
  Record<RulesetVersionKey, GameEngineFactory<never, never, never>>
>;

export function getEngineFactory(
  key: RulesetVersionKey,
): GameEngineFactory<never, never, never> | undefined {
  return REGISTRY[key as keyof typeof REGISTRY];
}
```

Registrations for the other four engines are added by Tasks 8–11.

- [ ] **Step 5: Run the test**

Run: `cd app && npx vitest run tests/modules/game/engine.registry.test.ts`
Expected: PASS after Task 4 and Task 7 land; until then the `SCORE_TRAINING_V1` case fails on the missing factory export. Land Tasks 4 and 7 before re-running.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game/interfaces.ts app/src/modules/game/engine.registry.ts app/tests/modules/game/engine.registry.test.ts
git commit -m "feat: add GameEngine contract and engine registry"
```

### Task 4: Shared ruleset config schemas and codec

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

export const ScoreTrainingConfig: z.ZodType<…>;   // duration_type, duration_value, max_darts_per_turn
export const Bobs27Config: z.ZodType<…>;          // start_score, path, bull_hit_value, miss_penalty_multiplier
export const SinglesTrainingConfig: z.ZodType<…>; // order_mode, difficulty, points_single/double/treble
export const DoublesTrainingConfig: z.ZodType<…>; // mode, order_mode
export const FiveOhOneConfig: z.ZodType<…>;       // starting_score, legs_to_win, check_in, check_out, max_darts_per_turn, max_visit_score
export const RULESET_CONFIGS: Record<RulesetVersionKey, z.ZodTypeAny>;

export function toSnapshot<K extends RulesetVersionKey>(key: K, wire: unknown): ConfigSnapshotFor<K>;
export function toWireConfig<K extends RulesetVersionKey>(key: K, snapshot: ConfigSnapshotFor<K>): Record<string, unknown>;
```

This is the **one** definition of each game's config: `services/rulesets/*` validate with it server-side, `modules/game/*` construct engines from it client-side. It closes C1 and ST3. `lib/` is importable from both runtimes; `services/` is not importable from the browser.

> **Decision required (self-learning gate):** placing shared ruleset schemas under `lib/game/rulesets/` is a new cross-runtime location. Get user approval before Task 15 writes it into `07-Frontend/02-Folder-Structure.md` and `DECISIONS.md`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { toSnapshot, toWireConfig } from "@lib/game/rulesets/config-codec";

describe("config codec", () => {
  it("maps snake_case wire config onto a camelCase snapshot", () => {
    const snapshot = toSnapshot("SCORE_TRAINING_V1", {
      duration_type: "ROUNDS",
      duration_value: 10,
      max_darts_per_turn: 3,
    });
    expect(snapshot).toEqual({
      durationType: "ROUNDS",
      durationValue: 10,
      maxDartsPerTurn: 3,
    });
  });

  it("round-trips back to wire shape", () => {
    const wire = { duration_type: "MINUTES", duration_value: 5, max_darts_per_turn: 3 };
    expect(toWireConfig("SCORE_TRAINING_V1", toSnapshot("SCORE_TRAINING_V1", wire))).toEqual(wire);
  });

  it("rejects a config that fails its ruleset schema", () => {
    expect(() => toSnapshot("SCORE_TRAINING_V1", { duration_type: "WEEKS" })).toThrow();
  });

  it("caps 501 visit scores at 180", () => {
    const snapshot = toSnapshot("501_V1", {
      starting_score: 501,
      legs_to_win: 1,
      check_in: "STRAIGHT_IN",
      check_out: "DOUBLE_OUT",
      max_darts_per_turn: 3,
      max_visit_score: 180,
    });
    expect(snapshot.maxVisitScore).toBe(180);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/rulesets/config-codec.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the schemas**

`app/src/lib/game/rulesets/types.ts` holds the `RulesetVersionKey` union, one Zod object per ruleset version keyed in snake_case exactly as the seeds store it, the `RULESET_CONFIGS` map, and the inferred snapshot types. `501_V1` gains `max_visit_score` (default 180) so the score cap is ruleset-owned per D15 / Database Agent Guide §8 — this is what closes finding I7.

- [ ] **Step 4: Implement the codec**

`config-codec.ts` parses with `RULESET_CONFIGS[key]`, throws on failure, and converts key case in both directions. No per-game `if` chains in call sites ever again.

- [ ] **Step 5: Run the test**

Run: `cd app && npx vitest run tests/lib/game/rulesets/config-codec.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/rulesets app/tests/lib/game/rulesets
git commit -m "feat: add shared ruleset config schemas and codec"
```

### Task 5: Generic events payload builder

**Files:**
- Create: `app/src/modules/game/events.payload.module.ts`
- Delete: `app/src/modules/game/score-training.payload.module.ts`
- Test: `app/tests/modules/game/events.payload.module.test.ts` (replaces `score-training.payload.module.test.ts`)

**Interfaces:**
- Consumes: `EngineFacts` (Task 1).
- Produces: `buildEventsBatch(participantRef: string, facts: EngineFacts): EventsBatchRequestInput`

Stages come from the engine, so 501's `LEG` stages and Score Training's single `EXERCISE_BLOCK` use the same builder (closes ST6).

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

- [ ] **Step 4: Delete the Score Training payload module and its test**

```bash
git rm app/src/modules/game/score-training.payload.module.ts app/tests/modules/game/score-training.payload.module.test.ts
```

- [ ] **Step 5: Run the test**

Run: `cd app && npx vitest run tests/modules/game/events.payload.module.test.ts`
Expected: PASS, 2 tests. `score-training-play.data.ts` will not compile until Task 7 — that is expected.

- [ ] **Step 6: Commit**

```bash
git add -A app/src/modules/game app/tests/modules/game
git commit -m "feat: replace per-game payload module with generic batch builder"
```

### Task 6: Game-agnostic store

**Files:**
- Modify: `app/src/stores/types.ts`, `app/src/stores/game.store.ts`
- Test: `app/tests/stores/game.store.test.ts`

**Interfaces:**
- Consumes: `EngineFacts`, `StageFact`, `TurnFact` (Task 1); `RulesetVersionKey`, `ConfigSnapshot` (Task 4).
- Produces: `gameStore` fields `gameTypeKey`, `rulesetVersionKey`, `sessionId`, `participantRef`, `configSnapshot: ConfigSnapshot | null`, `stages: StageFact[]`, `turns: TurnFact[]`, timer fields, `idempotencyKey`; methods `startSession`, `recordFacts(facts: EngineFacts)`, `reset()`.

`RecordedTurn` and the Score-Training-shaped `GameConfigSnapshot` are deleted (closes ST1). The store no longer appends turns one at a time — the engine owns the fact log and the store persists a snapshot of it, which removes the duplicate log (closes ST2). `_v` goes to `2`; D91 discards incompatible persisted state on bump.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { gameStore } from "@stores/game.store";

const persist = () => <T,>(value: T) => ({ as: () => value });

describe("gameStore", () => {
  it("stores the ruleset version alongside the config snapshot", () => {
    const store = gameStore(persist() as never);
    store.startSession({
      gameTypeKey: "501",
      rulesetVersionKey: "501_V1",
      sessionId: "s1",
      participantRef: "p1",
      configSnapshot: { startingScore: 501, legsToWin: 1, checkIn: "STRAIGHT_IN", checkOut: "DOUBLE_OUT", maxDartsPerTurn: 3, maxVisitScore: 180 },
    });
    expect(store.rulesetVersionKey).toBe("501_V1");
    expect(store.turns).toEqual([]);
    expect(store.stages).toEqual([]);
  });

  it("replaces the fact log wholesale so engine and store cannot diverge", () => {
    const store = gameStore(persist() as never);
    store.recordFacts({
      stages: [{ clientKey: "leg-1", stageTypeKey: "LEG", parentClientKey: null, sequence: 1 }],
      turns: [{ clientKey: "t1", stageClientKey: "leg-1", sequence: 1, completedAt: "2026-07-25T10:00:00.000Z", totalScore: 60, darts: [] }],
    });
    store.recordFacts({ stages: [], turns: [] });
    expect(store.turns).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/stores/game.store.test.ts`
Expected: FAIL — `startSession` rejects `rulesetVersionKey`.

- [ ] **Step 3: Implement**

Rewrite `stores/types.ts` to export `ConfigSnapshot` (the union from Task 4) and delete `GameConfigSnapshot`/`RecordedTurn`. Rewrite `game.store.ts` per the Interfaces block, keeping one `persist()` call per field (D120) and bumping `STORE_VERSION` to `2`.

- [ ] **Step 4: Run the test**

Run: `cd app && npx vitest run tests/stores/game.store.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/stores app/tests/stores
git commit -m "feat: make the game store game-agnostic and fact-log owning"
```

---

## Phase 2 — Retrofit the engines

Each engine task follows the same shape: accept a validated config, consume observations, own an `EngineFacts` log with minted `clientKey`/`sequence`/`completedAt`, rehydrate from `prior` facts, and export a `GameEngineFactory`. **Repeat the full TDD cycle per task — do not copy another engine's tests wholesale.**

### Task 7: Score Training on the contract

**Files:**
- Modify: `app/src/modules/game/score-training.engine.module.ts`, `app/src/lib/game/score-training-play.data.ts`, `app/src/lib/game/score-training-setup.data.ts`
- Test: `app/tests/modules/game/score-training.engine.module.test.ts`, `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: `scoreTrainingEngineFactory: GameEngineFactory<ScoreTrainingSnapshot, number, ScoreTrainingState>`; `record(visitScore: number)` mints one `TurnFact` under a single `EXERCISE_BLOCK` stage.

- [ ] **Step 1: Write the failing tests**

```typescript
it("rehydrates from persisted facts and continues the sequence", () => {
  const config = { durationType: "ROUNDS", durationValue: 10, maxDartsPerTurn: 3 } as const;
  const first = scoreTrainingEngineFactory.create(config);
  first.record(60);
  first.record(45);

  const resumed = scoreTrainingEngineFactory.create(config, first.facts());
  const turn = resumed.record(100);

  expect(resumed.facts().turns).toHaveLength(3);
  expect(turn.turns.at(-1)?.sequence).toBe(3);
  expect(resumed.undo()).toBe(true);
  expect(resumed.facts().turns).toHaveLength(2);
});

it("rejects a visit score above the ruleset cap", () => {
  const engine = scoreTrainingEngineFactory.create({
    durationType: "ROUNDS", durationValue: 10, maxDartsPerTurn: 3,
  });
  expect(() => engine.record(181)).toThrow(/0 and 180/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/score-training.engine.module.test.ts -t "rehydrates"`
Expected: FAIL — `scoreTrainingEngineFactory` is not exported.

- [ ] **Step 3: Implement the engine against the contract**

Keep `clientKey`/`sequence`/`completedAt` minting (it was already correct), move the `0..180` guard into the engine from `play.data.ts:153`, emit one `EXERCISE_BLOCK` stage, replay `prior.turns` on construction to set the sequence base, and delete `currentTotal()`/`currentAverage()` (dead code — the play page computes stats from facts).

- [ ] **Step 4: Rewire the play and setup data factories**

In `score-training-setup.data.ts`, replace the hand-written snake→camel mapping with `toSnapshot("SCORE_TRAINING_V1", preset.configuration)` and store `rulesetVersionKey`. In `score-training-play.data.ts`: build the engine via `getEngineFactory(store.rulesetVersionKey)`, pass `store` facts as `prior`, replace `buildEventsBatch(participantRef, completedTurns)` with `buildEventsBatch(participantRef, engine.facts())`, delete the engine-rebuild branch in `undoVisit` (rehydration makes it unnecessary), and send `{ source: "template", templateRef }` in `playAgain` using the stored template ref so provenance matches first play (closes ST4).

- [ ] **Step 5: Fix the stuck loading flag (ST5)**

```typescript
async submitVisit(this: ScoreTrainingPlayContext) {
  if (!this.engine || this.finished || this.showFinishConfirm) return;
  this.loading = true;
  …
}
```

Add a regression test asserting `loading === false` after `submitVisit()` returns with no engine.

- [ ] **Step 6: Run the app suite**

Run: `cd app && npm test`
Expected: PASS — every previously green test still green.

- [ ] **Step 7: Commit**

```bash
git add app/src app/tests
git commit -m "refactor: put Score Training on the GameEngine contract"
```

### Task 8: Bob's 27 on the contract

**Files:**
- Modify: `app/src/modules/game/bobs27.engine.module.ts`, `app/src/modules/game/types.ts`
- Test: `app/tests/modules/game/bobs27.engine.module.test.ts`

**Interfaces:**
- Produces: `bobs27EngineFactory: GameEngineFactory<Bobs27Snapshot, DartObservation, Bobs27State>`. `record(observation)` appends a `DartFact` to the open `TurnFact`; the visit closes on the third dart. `state().score` is **derived by folding the facts**, never accumulated into a stored field (closes C2 for this engine).

Persistence rule: the full-miss penalty is **not** written to `turns.total_score` — `totalScore` is the sum of the visit's dart board scores (always ≥ 0, satisfying `darts.score >= 0` and the documented `turns.total_score` denormalisation). The running Bob's 27 score is a derivation over the fact log and belongs in a view, not a column (closes I5).

- [ ] **Step 1: Write the failing tests**

```typescript
it("derives the running score from the fact log", () => {
  const engine = bobs27EngineFactory.create({ startScore: 27, bullHitValue: 50, missPenaltyMultiplier: 1 });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "DOUBLE" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });

  expect(engine.state().score).toBe(28);
  expect(engine.facts().turns).toHaveLength(1);
  expect(engine.facts().turns[0].darts).toHaveLength(3);
  expect(engine.facts().turns[0].totalScore).toBe(2);
});

it("never writes a negative turn total for a full-miss visit", () => {
  const engine = bobs27EngineFactory.create({ startScore: 27, bullHitValue: 50, missPenaltyMultiplier: 1 });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });

  expect(engine.state().score).toBe(26);
  expect(engine.facts().turns[0].totalScore).toBe(0);
});

it("rehydrates the derived score from persisted facts", () => {
  const config = { startScore: 27, bullHitValue: 50, missPenaltyMultiplier: 1 };
  const first = bobs27EngineFactory.create(config);
  first.record({ hitTargetNumber: 1, hitZoneKey: "DOUBLE" });
  first.record({ hitTargetNumber: 1, hitZoneKey: "DOUBLE" });
  first.record({ hitTargetNumber: 1, hitZoneKey: "DOUBLE" });

  const resumed = bobs27EngineFactory.create(config, first.facts());
  expect(resumed.state().score).toBe(30);
  expect(resumed.state().targetIndex).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/bobs27.engine.module.test.ts -t "derives the running score"`
Expected: FAIL — `bobs27EngineFactory` is not exported.

- [ ] **Step 3: Implement**

Replace `applyDart(state, hit: boolean)` with `applyObservation(state, observation)` using `isHitOn`/`boardScore` from Task 2, keep the reducer pure, fold the score from `facts.turns`, and rename the exported reducer to `applyBobs27Dart` (closes M1/M2 alongside the shared progression helper).

- [ ] **Step 4: Register the factory**

Add `BOBS27_V1: bobs27EngineFactory` to `engine.registry.ts`.

- [ ] **Step 5: Run the suite**

Run: `cd app && npx vitest run tests/modules/game/bobs27.engine.module.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game app/tests/modules/game
git commit -m "refactor: put Bob's 27 on the GameEngine contract"
```

### Task 9: Singles Training on the contract

**Files:**
- Modify: `app/src/modules/game/singles-training.engine.module.ts`, `app/src/modules/game/types.ts`
- Test: `app/tests/modules/game/singles-training.engine.module.test.ts`

**Interfaces:**
- Produces: `singlesTrainingEngineFactory: GameEngineFactory<SinglesTrainingSnapshot, DartObservation, SinglesTrainingState>`.

Persistence rule: **training points are never stored.** `DartFact.score` carries the actual board score of the dart thrown; training points are derived from `hitZoneKey` relative to the visit's target. `state().totalPoints` folds the fact log. This is the direct fix for C2 and the analytics-corruption half of I5. `intendedTargetNumber`/`intendedZoneKey` are populated from the current target, which makes intention-vs-result accuracy available for free (D06).

- [ ] **Step 1: Write the failing tests**

```typescript
it("stores board score in the fact and derives training points", () => {
  const engine = singlesTrainingEngineFactory.create({
    orderMode: "LOW_TO_HIGH", difficulty: "EASY",
    pointsSingle: 1, pointsDouble: 2, pointsTreble: 3,
  });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "TREBLE" });

  const dart = engine.facts().turns[0].darts[0];
  expect(dart.score).toBe(3);
  expect(dart.intendedTargetNumber).toBe(1);
  expect(dart.intendedZoneKey).toBe("SINGLE");
  expect(engine.state().totalPoints).toBe(3);
});

it("scores a dart that missed the target as zero training points but keeps the board fact", () => {
  const engine = singlesTrainingEngineFactory.create({
    orderMode: "LOW_TO_HIGH", difficulty: "EASY",
    pointsSingle: 1, pointsDouble: 2, pointsTreble: 3,
  });
  engine.record({ hitTargetNumber: 20, hitZoneKey: "TREBLE" });

  expect(engine.facts().turns[0].darts[0].score).toBe(60);
  expect(engine.state().totalPoints).toBe(0);
});

it("maps bull rings to the bull zones", () => {
  const config = { orderMode: "LOW_TO_HIGH", difficulty: "EASY", pointsSingle: 1, pointsDouble: 2, pointsTreble: 3 } as const;
  const engine = singlesTrainingEngineFactory.create(config, bullVisitFacts(config));
  engine.record({ hitTargetNumber: 25, hitZoneKey: "INNER_BULL" });

  const dart = engine.facts().turns.at(-1)!.darts.at(-1)!;
  expect(dart.hitZoneKey).toBe("INNER_BULL");
  expect(dart.score).toBe(50);
  expect(engine.state().totalPoints).toBe(2);
});
```

Write `bullVisitFacts(config)` as a local test helper that plays 20 full visits of `MISS` so the engine is on the bull target.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts -t "stores board score"`
Expected: FAIL — `singlesTrainingEngineFactory` is not exported.

- [ ] **Step 3: Implement**

Replace `DartRing` input with `DartObservation`; derive training points from the config's `pointsSingle`/`pointsDouble`/`pointsTreble` and the bull mapping (`OUTER_BULL` → `pointsSingle`, `INNER_BULL` → `pointsDouble`); rename the reducer to `applySinglesTrainingDart`.

- [ ] **Step 4: Register the factory** in `engine.registry.ts` as `SINGLES_V1`.

- [ ] **Step 5: Run the suite**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game app/tests/modules/game
git commit -m "refactor: put Singles Training on the GameEngine contract"
```

### Task 10: Doubles Training on the contract

**Files:**
- Modify: `app/src/modules/game/doubles-training.engine.module.ts`, `app/src/modules/game/types.ts`
- Test: `app/tests/modules/game/doubles-training.engine.module.test.ts`

**Interfaces:**
- Produces: `doublesTrainingEngineFactory: GameEngineFactory<DoublesTrainingSnapshot, DartObservation, DoublesTrainingState>`. Early visit termination on a hit is preserved; `DoublesVisitOutcome` becomes a derivation over `facts()` rather than stored state.

- [ ] **Step 1: Write the failing tests**

```typescript
it("ends the visit on a hit and records only the darts thrown", () => {
  const engine = doublesTrainingEngineFactory.create({ mode: "EASY", orderMode: "LOW_TO_HIGH" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "DOUBLE" });

  const turn = engine.facts().turns[0];
  expect(turn.darts).toHaveLength(2);
  expect(turn.totalScore).toBe(2);
  expect(engine.state().targetIndex).toBe(1);
});

it("derives which dart hit from the fact log", () => {
  const engine = doublesTrainingEngineFactory.create({ mode: "EASY", orderMode: "LOW_TO_HIGH" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "DOUBLE" });

  expect(engine.state().outcomes[0]).toEqual({ targetIndex: 0, hit: true, hitDartNumber: 2 });
});

it("records a full-miss visit as three darts and no hit", () => {
  const engine = doublesTrainingEngineFactory.create({ mode: "EASY", orderMode: "LOW_TO_HIGH" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "MISS" });
  engine.record({ hitTargetNumber: 5, hitZoneKey: "SINGLE" });
  engine.record({ hitTargetNumber: 1, hitZoneKey: "SINGLE" });

  expect(engine.facts().turns[0].darts).toHaveLength(3);
  expect(engine.state().outcomes[0].hit).toBe(false);
  expect(engine.state().targetIndex).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts -t "ends the visit on a hit"`
Expected: FAIL — `doublesTrainingEngineFactory` is not exported.

- [ ] **Step 3: Implement**, renaming the reducer to `applyDoublesTrainingDart`.

- [ ] **Step 4: Register the factory** in `engine.registry.ts` as `DOUBLES_TRAINING_V1`.

- [ ] **Step 5: Run the suite**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game app/tests/modules/game
git commit -m "refactor: put Doubles Training on the GameEngine contract"
```

### Task 11: 501 on the contract, with real checkout and score rules

**Files:**
- Modify: `app/src/modules/game/five-oh-one.engine.module.ts`, `app/src/modules/game/types.ts`
- Test: `app/tests/modules/game/five-oh-one.engine.module.test.ts`

**Interfaces:**
- Produces: `fiveOhOneEngineFactory: GameEngineFactory<FiveOhOneSnapshot, FiveOhOneVisitInput, FiveOhOneState>` with

```typescript
export type FiveOhOneVisitInput = {
  scoreAttempted: number;
  finishedOnDouble?: boolean;   // did the dart that reached 0 land on a double
  dartsUsed?: 1 | 2 | 3;
  dartsAtDouble?: 0 | 1 | 2 | 3; // analytics only, never a win condition
};
```

Three rule fixes land here:
1. **Score cap (I7):** `scoreAttempted` must be an integer in `0..config.maxVisitScore`; anything else throws. Negative scores can no longer inflate the remaining total.
2. **Double-out (I8):** the win condition becomes `finishedOnDouble === true`, not `dartsOnDouble >= 1`. `dartsAtDouble` survives as an analytics fact only.
3. **Legs (I4/C1):** `config.legsToWin` drives a `LEG` stage per leg; the session completes when a player reaches `legsToWin`. This makes the seeded `501 — Best of 5 Legs` preset executable.

- [ ] **Step 1: Write the failing tests**

```typescript
it("rejects an impossible visit score instead of inflating the total", () => {
  const engine = fiveOhOneEngineFactory.create(config());
  expect(() => engine.record({ scoreAttempted: -100 })).toThrow(/0 and 180/);
  expect(() => engine.record({ scoreAttempted: 181 })).toThrow(/0 and 180/);
  expect(engine.state().remainingScore).toBe(501);
});

it("requires the finishing dart to be a double", () => {
  const engine = fiveOhOneEngineFactory.create(config());
  engine.record({ scoreAttempted: 461 });
  const busted = engine.record({ scoreAttempted: 40, finishedOnDouble: false, dartsAtDouble: 2 });

  expect(busted.status).toBe("IN_PROGRESS");
  expect(engine.state().remainingScore).toBe(40);
  expect(engine.facts().turns.at(-1)?.totalScore).toBe(0);
});

it("wins the leg when the finishing dart is a double", () => {
  const engine = fiveOhOneEngineFactory.create(config());
  engine.record({ scoreAttempted: 461 });
  const won = engine.record({ scoreAttempted: 40, finishedOnDouble: true, dartsUsed: 2, dartsAtDouble: 1 });
  expect(won.status).toBe("WON");
});

it("opens a new LEG stage per leg and completes at legsToWin", () => {
  const engine = fiveOhOneEngineFactory.create({ ...config(), legsToWin: 2 });
  winOneLeg(engine);
  expect(engine.isComplete()).toBe(false);
  expect(engine.facts().stages).toHaveLength(2);
  expect(engine.facts().stages[1].stageTypeKey).toBe("LEG");
  winOneLeg(engine);
  expect(engine.isComplete()).toBe(true);
});
```

Write `config()` and `winOneLeg(engine)` as local test helpers.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts -t "rejects an impossible visit score"`
Expected: FAIL — `fiveOhOneEngineFactory` is not exported.

- [ ] **Step 3: Implement**

Keep the existing bust matrix (`< 0`, `=== 1`, `=== 0` without a qualifying finish) and add the three fixes. A bust turn records `totalScore: 0` with the attempted value **not** persisted as the turn total (per the PR's own forward-compat note). Rename the reducer to `applyFiveOhOneVisit`.

- [ ] **Step 4: Register the factory** in `engine.registry.ts` as `501_V1`.

- [ ] **Step 5: Run the suite**

Run: `cd app && npx vitest run tests/modules/game/five-oh-one.engine.module.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game app/tests/modules/game
git commit -m "refactor: put 501 on the GameEngine contract with leg and checkout rules"
```

---

## Phase 3 — Server and data alignment

### Task 12: Ruleset validators for all five games

**Files:**
- Create: `app/src/services/rulesets/{bobs27,singles-training,doubles-training,five-oh-one}/*.validator.ts`
- Modify: `app/src/services/rulesets/registry.ts`, `app/src/services/rulesets/score-training/score-training.validator.ts`
- Test: `app/tests/services/rulesets/*.validator.test.ts`

**Interfaces:**
- Consumes: `RULESET_CONFIGS` (Task 4).
- Produces: a `RulesetValidator` per ruleset version, all registered. Each `validateConfig` parses with the shared schema instead of a private copy; each `validateBatch` enforces the capture/input-mode matrix (D07/D73) and the ruleset's own caps.

Without this, `POST /api/sessions` rejects every game but Score Training (`session.service.ts:249`) — closing finding I4.

- [ ] **Step 1: Write the failing test** (per game; 501 shown)

```typescript
it("rejects a turn total above the ruleset cap", () => {
  const result = fiveOhOneValidator.validateBatch({
    config: { starting_score: 501, legs_to_win: 1, check_in: "STRAIGHT_IN", check_out: "DOUBLE_OUT", max_darts_per_turn: 3, max_visit_score: 180 },
    batch: { stages: [{ clientKey: "leg-1", stageTypeKey: "LEG", parentClientKey: null, sequence: 1, turns: [{ clientKey: "t1", participantRef: "p1", sequence: 1, totalScore: 181, completedAt: "2026-07-25T10:00:00.000Z", darts: [] }] }] },
    existingTurnCount: 0,
  });
  expect(result.valid).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/services/rulesets`
Expected: FAIL — validator modules not found.

- [ ] **Step 3: Implement the four new validators and repoint Score Training's at the shared schema.**

- [ ] **Step 4: Register all five** in `services/rulesets/registry.ts`.

- [ ] **Step 5: Run the tests**

Run: `cd app && npx vitest run tests/services/rulesets`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/services/rulesets app/tests/services/rulesets
git commit -m "feat: register ruleset validators for all five games"
```

### Task 13: Seed the missing games and correct the drifted presets

**Files:**
- Create: `database/seeds/0003_game_engine_reference.sql`
- Modify: `database/seeds/0002_default_templates.sql`

**Interfaces:**
- Produces: `game_types` `BOBS27` + `DOUBLES_TRAINING`; `game_type_features` rows; `ruleset_versions` `BOBS27_V1` + `DOUBLES_TRAINING_V1`; `configuration_templates` presets for both, keyed exactly as the Task 4 schemas expect.

Also corrects the two documented seed/ruleset mismatches (I4): the Singles presets shipping V2+ `HIGH_TO_LOW`/`RANDOM`/`NORMAL`/`HARD`, and the 501 presets. With Task 11 the `legs_to_win: 3` preset becomes playable, so 501 needs only the added `max_visit_score` key.

- [ ] **Step 1: Write the seed with fixed ids**

Follow the Seed Checklist in `05-Database/10-Database-Agent-Guide.md`: explicit UUIDs in the existing ranges (`0198f000-*` game types, `0198f100-*` ruleset versions, `0198f300-*` configuration templates), `is_system_template = TRUE`, `player_id IS NULL`, explicit `BEGIN`/`COMMIT`.

- [ ] **Step 2: Correct the drifted rows with `DO UPDATE`, not `DO NOTHING`**

`0002`'s existing `ON CONFLICT (id) DO NOTHING` means an edited row will not re-apply to an already-seeded database. Corrections must use:

```sql
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    configuration = EXCLUDED.configuration,
    updated_at = now();
```

- [ ] **Step 3: Apply and verify against the dev branch**

Run: `cd app && npm run env:dev && npm run db:seed`
Then confirm every ruleset version has a preset that parses:

Run: `cd app && npx vitest run tests/lib/game/rulesets/config-codec.test.ts`
Expected: PASS.

- [ ] **Step 4: Update the docs that name the seed chain**

`05-Database/10-Database-Agent-Guide.md` "Current seeds" list and `database/README.md` apply order gain `0003`.

- [ ] **Step 5: Commit**

```bash
git add database docs/architecture/05-Database/10-Database-Agent-Guide.md
git commit -m "feat: seed Bob's 27 and Doubles Training, correct drifted presets"
```

### Task 14: Mechanical engine guard

**Files:**
- Create: `scripts/check-game-engines.sh`
- Modify: `.github/workflows/checks.yml`

**Interfaces:**
- Produces: a check that fails when any `app/src/modules/game/*.engine.module.ts` (a) exports no `*EngineFactory`, (b) is absent from `engine.registry.ts`, or (c) names a `rulesetVersionKey` with no entry in `services/rulesets/registry.ts`.

This is the D105/D110/D127 pattern — convert a discipline-only rule into an enforced one, so engine #6 cannot repeat P4.

- [ ] **Step 1: Write the failing check**

Add a temporary `app/src/modules/game/__fixture.engine.module.ts` exporting nothing, run the script, confirm it exits non-zero, then delete the fixture.

- [ ] **Step 2: Implement the script** following the shape of `scripts/check-file-locations.sh` (same output format, same exit conventions).

- [ ] **Step 3: Verify it passes on the real tree**

Run: `bash scripts/check-game-engines.sh`
Expected: exit 0, all five engines listed as conforming.

- [ ] **Step 4: Wire into CI** — add the step to `.github/workflows/checks.yml` beside the other `check-*.sh` invocations.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-game-engines.sh .github/workflows/checks.yml
git commit -m "feat: enforce the game engine contract mechanically"
```

---

## Phase 4 — Documentation and agent guidelines

### Task 15: Canonical docs

**Files:**
- Modify: `docs/architecture/04-Architecture-patterns.md`, `docs/architecture/07-Frontend/04-Modules-And-OOP.md`, `docs/architecture/07-Frontend/02-Folder-Structure.md`, `docs/architecture/05-Database/10-Database-Agent-Guide.md`, `docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md`, `docs/architecture/00-Context-Map.md`, `DECISIONS.md`, `docs/game-rules/rulesets/{bobs-27,singles-training,doubles-training,501}.md`, `docs/game-rules/templates/GAME_ENGINE_TEMPLATE.md`

- [ ] **Step 1: Add Pattern 18 — Game Engine Contract** to `04-Architecture-patterns.md`

State the contract in the document's existing Principle/Application/Rule format: engines are constructed from a validated config snapshot bound to a ruleset version; they own the fact log; they mint `clientKey`/`sequence`/`completedAt`; they rehydrate from persisted facts; derived values (running score, training points, ratios, averages) are never stored in a fact. Closes P2 — the pattern is now written down rather than copied by imitation.

- [ ] **Step 2: Update `07-Frontend/04-Modules-And-OOP.md`**

Replace the Engine vs Payload table with the contract; keep the Key Ownership table (it was already right — the engines were wrong). Add anti-patterns: "engine accumulates a score field instead of folding facts", "engine that cannot be rebuilt from persisted facts", "per-game payload module".

- [ ] **Step 3: Register `lib/game/rulesets/` in `02-Folder-Structure.md`** as the cross-runtime home for ruleset config schemas, with the import-direction note (Worker and browser may both import it; it may import neither).

- [ ] **Step 4: Record the persistence semantics in `06-Spec/04-Runtime-Layer.md`**

Under `turns`/`darts`: `darts.score` is the actual board score of the dart thrown, never a game-specific point value; `turns.total_score` is the sum of counted dart scores (0 for a void visit) and is never negative; game-specific scores are derived. Closes I5.

- [ ] **Step 5: Write the resolved rules back into the ruleset docs** (closes M5)

Move each engine spec's resolutions into the matching `docs/game-rules/rulesets/*.md` and delete the corresponding "Open questions" bullets: Bob's 27 bull = inner 50 only / outer = miss and the face-value multi-hit math; Singles bull = outer 1 / inner 2; Doubles bull identity; 501 finishing-dart-is-a-double.

- [ ] **Step 6: Extend `10-Database-Agent-Guide.md` §"Add a new game type"**

Steps 6–7 currently say "Frontend game engine (outside database)". Replace with the real checklist: shared config schema → server validator + registry entry → engine implementing the contract + registry entry → seeds → `check-game-engines.sh` green.

- [ ] **Step 7: Extend `GAME_ENGINE_TEMPLATE.md`**

Add a required "Capture" section to the ruleset template: which capture/input mode the game needs, what one dart's fact looks like, and which stage type the game creates. Rulesets that answer this cannot produce an engine with an unpersistable state shape — the root cause of C2.

- [ ] **Step 8: Add decision entries to `DECISIONS.md`** (one line each, next free `D` numbers): game engine contract; fact-log ownership and derived-score rule; shared `lib/game/rulesets/` config schemas; 501 double-out finishing-dart rule + ruleset-owned visit cap; `check-game-engines.sh` enforcement.

- [ ] **Step 9: Register everything in `00-Context-Map.md`**

Add a "New game engine" context pack (`04-Architecture-patterns.md` Pattern 18, `07-Frontend/04-Modules-And-OOP.md`, `10-Database-Agent-Guide.md` §Add a new game type, the game's ruleset doc) with a token budget, and add the two new spec/plan rows with ISO dates.

- [ ] **Step 10: Run the seven checkers**

Run: `for s in check-context-map check-file-locations check-agent-mirrors check-astro-class-composition check-astro-conventions check-doc-links check-context-budget; do bash scripts/$s.sh || echo "FAIL $s"; done`
Expected: all pass, no `FAIL` lines.

- [ ] **Step 11: Commit**

```bash
git add docs DECISIONS.md
git commit -m "docs: record the game engine contract and persistence semantics"
```

### Task 16: Agent guideline hardening (requires explicit user approval)

**Files:**
- Modify: `app/CLAUDE.md` + `app/AGENT.md`, `CLAUDE.md` + `AGENT.md` (repo root)

Per D107 these are **proposals**. Present them in chat, get an explicit yes, then write. Both mirrors must stay byte-for-byte identical (`scripts/check-agent-mirrors.sh`).

- [ ] **Step 1: Propose the `app/CLAUDE.md` rule**

> **Game engines.** Every `*.engine.module.ts` implements the `GameEngine` contract (`07-Frontend/04-Modules-And-OOP.md`): constructed from a validated config snapshot bound to a `rulesetVersionKey`, owns its `EngineFacts` log, mints `clientKey`/`sequence`/`completedAt`, and rehydrates from persisted facts. Never store a value the fact log can derive — no accumulated score, points, ratio or average fields. `bash scripts/check-game-engines.sh` must pass.

- [ ] **Step 2: Propose the root `CLAUDE.md` scope rule**

> An engine-only task must still prove its state shape can be persisted: name the capture/input mode, the stage type, and the `turns`/`darts` mapping in the spec before implementation. Deferring persistence is allowed; choosing a state shape that cannot express it is not.

Rationale for the user: this is the single rule that would have caught C1, C2, I1 and I2 in the first PR instead of the fifth.

- [ ] **Step 3: Propose the stacked-branch rule** (closes P1)

> At most one open task branch may target another task branch. A third stacked branch means the first must land or the work must merge into one branch.

- [ ] **Step 4: Apply only the approved items, to both mirrors**

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
- [ ] `bash scripts/refresh-graph.sh` run and `graphify-out/graph.json` staged — or the absence of the CLI recorded in the completion report (P3).
- [ ] Every finding in `2026-07-25-game-engine-review-design.md` is either closed by a task above or explicitly declined in the PR body with a reason.
- [ ] PR opened against `main`; `main` carries no unmerged engine branch behind it.
