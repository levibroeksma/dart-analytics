# Switching, Double Pattern & Balanced Training Seed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `SWITCHING` and `DOUBLE_PATTERN` exercise types (engines, config schemas, validators), generalize `WARM_UP` to proportional (weight-based) phase durations, and seed the "Balanced Training" system routine that composes all four exercise types (`WARM_UP`, `SWITCHING`, `DOUBLE_PATTERN`, `GAME`/TUOD).

**Architecture:** `SWITCHING`/`DOUBLE_PATTERN` are dart-driven exercises (09-training-routines.md §13, "analytics-mode input") — the existing `ExerciseEngine<TState>` contract (`advance`/`undo`/`isComplete`/`state`/`facts`, no input) only fits phase-driven exercises like `WARM_UP`. This plan adds a sibling contract, `DartExerciseEngine<TState>`, with a `record(observation: DartObservation): TState` method mirroring `GameEngine<TInput, TState>`'s shape — additive only, `ExerciseEngine`/`WarmUpEngine` are untouched by this change. Both new engines reuse the existing `EXERCISE_BLOCK` stage type and the `turns`/`darts` fact-log machinery already shared by every `GameEngine` (`modules/game/turn-log.module.ts`), following the same "pure reducer + fold-from-facts" idiom `SinglesTrainingEngine` already uses, so `state()` is always a pure replay of `facts()` with no engine holding mutable derived fields. `WARM_UP`'s `durationSeconds`-per-phase config becomes `weight`-per-phase; the engine resolves each phase's actual duration from the routine step's total duration at construction time, so the same template serves both the existing 5-minute Warm-Up routine and Balanced Training's 10-minute step with no second template.

**Tech Stack:** TypeScript, Zod, Vitest, PostgreSQL (Neon) seed SQL (`psql`-runnable, `dbmate`-style migration/seed convention already in `database/`).

## Global Constraints

- Never modify applied migrations (`0001`–`0031`) or existing seed files (`0001`–`0015`) — every change here is either a new module/test file or a new seed file (`0016`, `0017`).
- `ExerciseEngine<TState>` and `WarmUpEngine`'s public shape stay untouched except the one documented, intentional config-shape change (§5.1 of the design spec); no other engine, page, or route in the repo may need to change for this plan to compile.
- No engine may own a clock (D264, `app/CLAUDE.md`) — `SwitchingEngine`/`DoublePatternEngine` gain an `expireTimer()` method exactly like `TuodEngine`/`ScoreTrainingEngine`; nothing inside either engine reads `Date.now()` to decide completion.
- `EXERCISE_RULESET_CONFIGS` (`lib/exercise/rulesets/types.ts`) must have exactly one entry per member of `ExerciseRulesetVersionKey` — TypeScript's `Record<ExerciseRulesetVersionKey, z.ZodTypeAny>` enforces this; do not let it drift.
- No DB credentials are available in this sandbox (established precedent, D193 / `database/CLAUDE.md`): seed files are written and reviewed, never applied with `db:migrate`/`db:seed` here. Verification for Tasks 9–10 is read-through + `psql`-syntax sanity (balanced parens/quotes, `ON CONFLICT`/idempotency shape matching `0014`/`0015`), not a live apply.
- This plan explicitly excludes: the training-session API route, wiring `RoutineDetail.astro`'s `Start` button, the ping sound, the Warm-Up dartboard highlight, `LADDER`, and the `lib/trivia`→`lib/training` rename (F77). None of those are touched by any task below.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/src/modules/exercise/interfaces.ts` (modify) | Adds `DartExerciseEngine<TState>` / `DartExerciseEngineFactory<TConfig, TState>`, parallel to the existing phase-driven `ExerciseEngine`. |
| `app/src/modules/exercise/dart-engine.registry.ts` (new) | Factory registry for dart-driven exercise engines, mirroring `engine.registry.ts`. |
| `app/src/modules/exercise/solo-participant.module.ts` (new) | The one fixed `participantRef` every solo exercise session's turns log under. |
| `app/src/lib/exercise/rulesets/types.ts` (modify) | `ExerciseRulesetVersionKey` union gains `SWITCHING_V1`/`DOUBLE_PATTERN_V1`; `WarmUpPhaseConfig` moves `durationSeconds`→`weight`; adds `WarmUpEngineInputSchema`, `SwitchingV1Config`, `DoublePatternV1Config`; `EXERCISE_RULESET_CONFIGS` gains the two new entries. |
| `app/src/modules/exercise/types.ts` (modify) | Adds `SwitchingState`, `DoublePatternState`. |
| `app/src/modules/exercise/warm-up.engine.module.ts` (modify) | `WarmUpEngine` resolves `phaseDurationSeconds` from `stepDurationSeconds * weight / sum(weights)` instead of a fixed per-phase field. |
| `app/src/modules/exercise/switching.engine.module.ts` (new) | `SwitchingEngine` + `applySwitchingDart`/`foldSwitchingState` pure functions. |
| `app/src/modules/exercise/double-pattern.engine.module.ts` (new) | `DoublePatternEngine` + `applyDoublePatternDart`/`foldDoublePatternState` pure functions. |
| `app/src/services/exercise-rulesets/switching/switching.validator.ts` (new) | Server-side `validateConfig` for `SWITCHING_V1`. |
| `app/src/services/exercise-rulesets/double-pattern/double-pattern.validator.ts` (new) | Server-side `validateConfig` for `DOUBLE_PATTERN_V1`. |
| `app/src/services/exercise-rulesets/registry.ts` (modify) | Registers the two new validators. |
| `database/seeds/0016_switching_double_pattern_exercise_types.sql` (new) | Catalog rows: `exercise_types`, `exercise_ruleset_versions` for `SWITCHING`/`DOUBLE_PATTERN`. |
| `database/seeds/0017_balanced_training_routine.sql` (new) | Updates the Warm-Up template to weight-based config; seeds the Switching/Double-Pattern/Finishing exercise templates and the Balanced Training routine + its 4 steps. |
| `docs/architecture/09-training-routines.md` (modify) | §17 gains "Implemented" notes pointing the illustrative Switching/Double-Pattern examples at the real config shapes. |
| `docs/architecture/00-File-Inventory.md` (modify) | Registers every new file (context maintenance). |
| `decisions/game-engine.md` (modify) | New decision: `DartExerciseEngine` as the analytics-mode exercise contract. |

---

### Task 1: Dart-driven exercise engine contract + registry

**Files:**
- Modify: `app/src/modules/exercise/interfaces.ts`
- Create: `app/src/modules/exercise/dart-engine.registry.ts`
- Test: `app/tests/modules/exercise/dart-engine.registry.test.ts`

**Interfaces:**
- Consumes: `ExerciseRulesetVersionKey` (`@lib/types`), `EngineFacts` (`@modules/types`), `DartObservation` (`@modules/game/types`).
- Produces: `DartExerciseEngine<TState>` (methods `record(observation): TState`, `undo(): boolean`, `isComplete(): boolean`, `state(): TState`, `facts(): EngineFacts`, field `exerciseRulesetVersionKey`), `DartExerciseEngineFactory<TConfig, TState>` (field `exerciseRulesetVersionKey`, method `create(config, prior?): DartExerciseEngine<TState>`), `registerDartExerciseEngineFactory`, `getDartExerciseEngineFactory`, `resetDartExerciseEngineRegistry` — Tasks 3 and 6 both consume all of these.

- [ ] **Step 1: Write the failing registry test**

```typescript
// app/tests/modules/exercise/dart-engine.registry.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  getDartExerciseEngineFactory,
  registerDartExerciseEngineFactory,
  resetDartExerciseEngineRegistry,
} from "@modules/exercise/dart-engine.registry";

const stubFactory = {
  exerciseRulesetVersionKey: "SWITCHING_V1" as const,
  create: () => {
    throw new Error("not used");
  },
};

describe("dart exercise engine registry", () => {
  beforeEach(() => {
    resetDartExerciseEngineRegistry();
  });

  it("returns a registered factory by key", () => {
    registerDartExerciseEngineFactory(stubFactory);

    expect(getDartExerciseEngineFactory("SWITCHING_V1")).toBe(stubFactory);
  });

  it("returns undefined for an unregistered key", () => {
    expect(getDartExerciseEngineFactory("SWITCHING_V1")).toBeUndefined();
  });

  it("refuses a duplicate registration", () => {
    registerDartExerciseEngineFactory(stubFactory);

    expect(() => registerDartExerciseEngineFactory(stubFactory)).toThrow(
      /already registered/,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/exercise/dart-engine.registry.test.ts`
Expected: FAIL — `Cannot find module '@modules/exercise/dart-engine.registry'` (Task 1's `SWITCHING_V1` key also won't type-check yet; that's fixed in Task 2, so for now this test's `"SWITCHING_V1" as const` cast is enough for it to compile once the module exists — it does not need the real union member yet).

- [ ] **Step 3: Add `DartExerciseEngine`/`DartExerciseEngineFactory` to the interfaces module**

```typescript
// app/src/modules/exercise/interfaces.ts
import type { ExerciseRulesetVersionKey } from "@lib/types";
import type { DartObservation } from "@modules/game/types";
import type { EngineFacts } from "@modules/types";

/**
 * Contract every exercise engine implements, parallel to `GameEngine` and
 * never built on top of one (09-training-routines.md §10). `TState` is the
 * shape `state()` and `advance()` return.
 */
export interface ExerciseEngine<TState> {
  readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  advance(): TState;
  undo(): boolean;
  isComplete(): boolean;
  state(): TState;
  facts(): EngineFacts;
}

/**
 * Builds an `ExerciseEngine` for one exercise ruleset version.
 * `create(config, prior)` replays persisted facts to restore an in-progress
 * exercise after a page refresh.
 */
export interface ExerciseEngineFactory<TConfig, TState> {
  readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  create(config: TConfig, prior?: EngineFacts): ExerciseEngine<TState>;
}

/**
 * Contract for an exercise engine that operates in analytics mode
 * (09-training-routines.md §13) — one that takes dart input rather than
 * advancing through timed phases. Sibling to `ExerciseEngine`, not an
 * extension of it: nothing here has a phase to `advance()` through, and
 * nothing in `ExerciseEngine` has an observation to `record()`. Shaped like
 * `GameEngine<DartObservation, TState>` minus `stageOwnership`/
 * `wouldComplete`, which don't apply — a routine step has no seats and no
 * finish-confirm prompt to gate.
 */
export interface DartExerciseEngine<TState> {
  readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  record(observation: DartObservation): TState;
  undo(): boolean;
  isComplete(): boolean;
  state(): TState;
  facts(): EngineFacts;
}

/**
 * Builds a `DartExerciseEngine` for one exercise ruleset version, mirroring
 * `ExerciseEngineFactory`.
 */
export interface DartExerciseEngineFactory<TConfig, TState> {
  readonly exerciseRulesetVersionKey: ExerciseRulesetVersionKey;
  create(config: TConfig, prior?: EngineFacts): DartExerciseEngine<TState>;
}
```

- [ ] **Step 4: Create the registry module**

```typescript
// app/src/modules/exercise/dart-engine.registry.ts
import type { ExerciseRulesetVersionKey } from "@lib/types";
import type { DartExerciseEngineFactory } from "./interfaces";

/**
 * Type-erased view of a `DartExerciseEngineFactory` used at the registry
 * boundary, mirroring `engine.registry.ts`. `unknown` fills the erased
 * parameters so a concrete factory upcasts with no unsafe cast.
 */
type AnyDartExerciseEngineFactory = DartExerciseEngineFactory<
  unknown,
  unknown
>;

const REGISTRY = new Map<
  ExerciseRulesetVersionKey,
  AnyDartExerciseEngineFactory
>();

export function registerDartExerciseEngineFactory(
  factory: AnyDartExerciseEngineFactory,
): void {
  if (REGISTRY.has(factory.exerciseRulesetVersionKey)) {
    throw new Error(
      `Dart exercise engine factory already registered for ${factory.exerciseRulesetVersionKey}`,
    );
  }
  REGISTRY.set(factory.exerciseRulesetVersionKey, factory);
}

export function getDartExerciseEngineFactory(
  key: ExerciseRulesetVersionKey,
): AnyDartExerciseEngineFactory | undefined {
  return REGISTRY.get(key);
}

/** Test-only: clears registrations so each test starts from an empty registry. */
export function resetDartExerciseEngineRegistry(): void {
  REGISTRY.clear();
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/exercise/dart-engine.registry.test.ts`
Expected: PASS (3 tests) — TypeScript will still flag `"SWITCHING_V1"` as not assignable to `ExerciseRulesetVersionKey` until Task 2 lands; Vitest's esbuild transform does not type-check, so the test runs and passes regardless. `npm run check` is deferred to Task 2's end, once the union includes `SWITCHING_V1`.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/exercise/interfaces.ts app/src/modules/exercise/dart-engine.registry.ts app/tests/modules/exercise/dart-engine.registry.test.ts
git commit -m "feat(exercise): add DartExerciseEngine contract and registry"
```

---

### Task 2: `SWITCHING` config schema

**Files:**
- Modify: `app/src/lib/exercise/rulesets/types.ts`
- Test: `app/tests/lib/exercise/rulesets/types.test.ts` (new)

**Interfaces:**
- Produces: `ExerciseRulesetVersionKey` (now `"WARM_UP_V1" | "SWITCHING_V1" | "DOUBLE_PATTERN_V1"`), `SwitchingScoringConfig`, `SwitchingV1Config`, `SwitchingConfigData` (`{ targets: number[]; scoring: { single: number; double: number; treble: number } }`) — consumed by Task 3 and Task 4.

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/lib/exercise/rulesets/types.test.ts
import { describe, expect, it } from "vitest";
import { SwitchingV1Config } from "@lib/exercise/rulesets/types";

describe("SwitchingV1Config", () => {
  const VALID = {
    targets: [20, 19, 18],
    scoring: { single: 1, double: 2, treble: 3 },
  };

  it("accepts a well-formed configuration", () => {
    expect(SwitchingV1Config.safeParse(VALID).success).toBe(true);
  });

  it("rejects an empty target list", () => {
    const result = SwitchingV1Config.safeParse({ ...VALID, targets: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a target outside the board", () => {
    const result = SwitchingV1Config.safeParse({ ...VALID, targets: [26] });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = SwitchingV1Config.safeParse({
      ...VALID,
      captureModeKey: "ANALYTICS",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative scoring values", () => {
    const result = SwitchingV1Config.safeParse({
      ...VALID,
      scoring: { single: -1, double: 2, treble: 3 },
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/exercise/rulesets/types.test.ts`
Expected: FAIL — `SwitchingV1Config` is not exported yet.

- [ ] **Step 3: Add the schema**

Replace the whole file `app/src/lib/exercise/rulesets/types.ts` with:

```typescript
import { z } from "zod";

/**
 * Exercise ruleset versions, kept deliberately separate from the game
 * `RulesetVersionKey` union. `scripts/check-game-wiring.sh` requires every
 * key in `services/rulesets/registry.ts` to declare a capture/input mode
 * pair and game pages; an exercise ruleset has neither
 * (09-training-routines.md §24).
 */
export type ExerciseRulesetVersionKey =
  | "WARM_UP_V1"
  | "SWITCHING_V1"
  | "DOUBLE_PATTERN_V1";

/**
 * One timed section of a warm-up. `targets` are board numbers the player
 * aims at during the section; 25 is the bull. Nothing is recorded against
 * them — the warm-up takes no dart input (§16). `weight` is proportional,
 * not absolute: the engine resolves each phase's actual duration from the
 * routine step's own total duration at construction time
 * (`WarmUpEngine.deriveState()`), which is what lets the same template serve
 * routines of different lengths (design spec 2026-09-11 §5.1).
 */
export const WarmUpPhaseConfig = z
  .object({
    name: z.string().min(1).max(40),
    targets: z.array(z.number().int().min(1).max(25)).min(1).max(6),
    weight: z.number().positive().max(100),
  })
  .strict();

/**
 * Warm-Up v1: an ordered, non-empty list of timed phases and nothing else.
 * The upper phase bound is a sanity ceiling, not a product rule; the §7
 * sixty-minute routine cap is enforced by `routine-duration.module.ts`
 * across all steps. This is the *template* shape — what is validated at
 * rest in `exercise_templates.default_configuration` and by
 * `warmUpValidator`. `WarmUpEngineInputSchema` below is the engine's own
 * construction-time input, which additionally needs the step's actual
 * duration.
 */
export const WarmUpV1Config = z
  .object({
    phases: z.array(WarmUpPhaseConfig).min(1).max(12),
  })
  .strict();

export type WarmUpConfigData = z.infer<typeof WarmUpV1Config>;

/**
 * What `warmUpEngineFactory.create()` actually takes: the template's phases
 * plus the routine step's own total duration, in seconds — structural data
 * that lives in `routine_steps.duration_type_id`/`duration_value`, never in
 * the template's own JSONB (migration 0028's own comment). Not part of
 * `EXERCISE_RULESET_CONFIGS`: that registry validates what is stored or
 * submitted as template configuration, and `stepDurationSeconds` is neither.
 */
export const WarmUpEngineInputSchema = z
  .object({
    phases: z.array(WarmUpPhaseConfig).min(1).max(12),
    stepDurationSeconds: z.number().int().min(1).max(3600),
  })
  .strict();

export type WarmUpEngineInput = z.infer<typeof WarmUpEngineInputSchema>;

/**
 * Per-zone points for one Switching target: a dart that lands on the
 * intended target number scores by which ring it hit; a dart landing
 * anywhere else scores 0 ("outside", 09-training-routines.md §14/§17) —
 * there is deliberately no `outside` key, since it is not a configurable
 * value.
 */
export const SwitchingScoringConfig = z
  .object({
    single: z.number().int().min(0).max(100),
    double: z.number().int().min(0).max(100),
    treble: z.number().int().min(0).max(100),
  })
  .strict();

/**
 * Switching v1: a fixed, ordered list of board-number targets, cycled dart
 * by dart for the step's full duration — one visit is one full pass through
 * `targets` (design spec 2026-09-11 §5.2).
 */
export const SwitchingV1Config = z
  .object({
    targets: z.array(z.number().int().min(1).max(25)).min(1).max(20),
    scoring: SwitchingScoringConfig,
  })
  .strict();

export type SwitchingConfigData = z.infer<typeof SwitchingV1Config>;

/**
 * Double Pattern v1: a fixed, ordered list of double-number patterns
 * (`D20`, not `20`), cycled pattern by pattern for the step's full duration.
 * One visit is one pattern; each pattern's own length is how many darts
 * that visit throws. Every hit double scores 1 point, nothing else scores
 * (design spec 2026-09-11 §5.3) — there is no configurable scoring, unlike
 * Switching.
 */
export const DoublePatternV1Config = z
  .object({
    patterns: z
      .array(z.array(z.number().int().min(1).max(20)).min(1).max(3))
      .min(1)
      .max(12),
  })
  .strict();

export type DoublePatternConfigData = z.infer<typeof DoublePatternV1Config>;

export const EXERCISE_RULESET_CONFIGS: Record<
  ExerciseRulesetVersionKey,
  z.ZodTypeAny
> = {
  WARM_UP_V1: WarmUpV1Config,
  SWITCHING_V1: SwitchingV1Config,
  DOUBLE_PATTERN_V1: DoublePatternV1Config,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/exercise/rulesets/types.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Update the existing Warm-Up fixtures for the new `weight` field**

In `app/tests/modules/exercise/warm-up.engine.module.test.ts`, replace the `CONFIG` constant and every `warmUpEngineFactory.create(...)` call:

```typescript
import { describe, expect, it } from "vitest";
import { warmUpEngineFactory } from "@modules/exercise/warm-up.engine.module";
import type { WarmUpEngineInput } from "@lib/types";

const CONFIG: WarmUpEngineInput = {
  phases: [
    { name: "Upper", targets: [5, 20, 1], weight: 1 },
    { name: "Lower", targets: [19, 3, 17], weight: 1 },
    { name: "Bull", targets: [25], weight: 1 },
  ],
  stepDurationSeconds: 180,
};

describe("warmUpEngineFactory", () => {
  it("starts on the first phase with one stage fact", () => {
    const engine = warmUpEngineFactory.create(CONFIG);

    expect(engine.state()).toEqual({
      phaseIndex: 0,
      phaseName: "Upper",
      targets: [5, 20, 1],
      phaseDurationSeconds: 60,
      phaseCount: 3,
      status: "IN_PROGRESS",
    });
    expect(engine.facts().stages).toHaveLength(1);
    expect(engine.facts().stages[0]).toMatchObject({
      stageTypeKey: "EXERCISE_SECTION",
      parentClientKey: null,
      sequence: 1,
    });
    expect(engine.facts().turns).toEqual([]);
  });

  it("appends one stage per phase entered", () => {
    const engine = warmUpEngineFactory.create(CONFIG);

    expect(engine.advance().phaseName).toBe("Lower");
    expect(engine.facts().stages.map((s) => s.sequence)).toEqual([1, 2]);
  });

  it("completes on advancing past the final phase without adding a stage", () => {
    const engine = warmUpEngineFactory.create(CONFIG);
    engine.advance();
    engine.advance();

    expect(engine.isComplete()).toBe(false);
    expect(engine.advance().status).toBe("COMPLETE");
    expect(engine.isComplete()).toBe(true);
    expect(engine.facts().stages).toHaveLength(3);
  });

  it("undoes completion, then phases, then refuses", () => {
    const engine = warmUpEngineFactory.create(CONFIG);
    engine.advance();
    engine.advance();
    engine.advance();

    expect(engine.undo()).toBe(true);
    expect(engine.state().status).toBe("IN_PROGRESS");
    expect(engine.state().phaseIndex).toBe(2);
    expect(engine.undo()).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.state().phaseIndex).toBe(0);
    expect(engine.undo()).toBe(false);
  });

  it("rehydrates in progress from prior facts", () => {
    const engine = warmUpEngineFactory.create(CONFIG);
    engine.advance();
    const prior = engine.facts();

    const resumed = warmUpEngineFactory.create(CONFIG, prior);

    expect(resumed.state().phaseIndex).toBe(1);
    expect(resumed.state().status).toBe("IN_PROGRESS");
    expect(resumed.facts().stages.map((s) => s.clientKey)).toEqual(
      prior.stages.map((s) => s.clientKey),
    );
  });

  it("returns copies, never live internals", () => {
    const engine = warmUpEngineFactory.create(CONFIG);

    engine.facts().stages.push({
      clientKey: "x",
      stageTypeKey: "EXERCISE_SECTION",
      parentClientKey: null,
      sequence: 99,
    });

    expect(engine.facts().stages).toHaveLength(1);
  });

  it("rejects an empty phase list", () => {
    expect(() =>
      warmUpEngineFactory.create({ phases: [], stepDurationSeconds: 60 }),
    ).toThrow();
  });

  it("splits step duration proportionally to phase weight", () => {
    const engine = warmUpEngineFactory.create({
      phases: [
        { name: "Long", targets: [20], weight: 3 },
        { name: "Short", targets: [19], weight: 1 },
      ],
      stepDurationSeconds: 600,
    });

    expect(engine.state().phaseDurationSeconds).toBe(450);
    expect(engine.advance().phaseDurationSeconds).toBe(150);
  });
});
```

This test file's own `it("rejects an empty phase list", ...)` step now fails until Task 8 changes `WarmUpEngine`'s constructor to parse `WarmUpEngineInputSchema` — leave it red for now; Task 8 turns the whole file green. Do **not** run this file's tests yet.

In `app/tests/services/exercise-rulesets/warm-up.validator.test.ts`, replace every `durationSeconds: 60` with `weight: 1` in the fixtures (the validator itself is untouched — it still validates `WarmUpV1Config`, which now expects `weight`):

```typescript
import { describe, expect, it } from "vitest";
import { warmUpValidator } from "@services/exercise-rulesets/warm-up/warm-up.validator";

const VALID = {
  phases: [{ name: "Upper", targets: [5, 20, 1], weight: 1 }],
};

describe("warmUpValidator.validateConfig", () => {
  it("accepts a well-formed configuration", () => {
    const result = warmUpValidator.validateConfig({ config: VALID });

    expect(result).toEqual({ ok: true, config: VALID });
  });

  it("rejects an empty phase list", () => {
    const result = warmUpValidator.validateConfig({ config: { phases: [] } });

    expect(result.ok).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = warmUpValidator.validateConfig({
      config: { ...VALID, captureModeKey: "ANALYTICS" },
    });

    expect(result.ok).toBe(false);
  });

  it("rejects a target outside the board", () => {
    const result = warmUpValidator.validateConfig({
      config: { phases: [{ name: "Bad", targets: [26], weight: 1 }] },
    });

    expect(result.ok).toBe(false);
  });

  it("names the offending path in its issues", () => {
    const result = warmUpValidator.validateConfig({
      config: { phases: [{ name: "", targets: [5], weight: 1 }] },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("phases");
  });
});
```

Run: `cd app && npx vitest run tests/services/exercise-rulesets/warm-up.validator.test.ts`
Expected: PASS (5 tests) — this file does not depend on the engine change, so it is green immediately.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/exercise/rulesets/types.ts app/tests/lib/exercise/rulesets/types.test.ts app/tests/modules/exercise/warm-up.engine.module.test.ts app/tests/services/exercise-rulesets/warm-up.validator.test.ts
git commit -m "feat(exercise): add SWITCHING/DOUBLE_PATTERN config schemas, weight-based WARM_UP config"
```

---

### Task 3: `SwitchingEngine`

**Files:**
- Create: `app/src/modules/exercise/solo-participant.module.ts`
- Create: `app/src/modules/exercise/switching.engine.module.ts`
- Test: `app/tests/modules/exercise/switching.engine.module.test.ts`

**Interfaces:**
- Consumes: `DartExerciseEngine`/`DartExerciseEngineFactory` (Task 1), `SwitchingV1Config`/`SwitchingConfigData` (Task 2), `exerciseBlockStage`/`cloneTurns`/`openOrCreateTurn`/`appendObservedDart`/`undoLastDart` (`@modules/game/turn-log.module`), `DartObservation`/`DartFact`/`EngineFacts`/`TurnFact` (`@modules/game/types`).
- Produces: `SOLO_PARTICIPANT_REF` (string constant, also consumed by Task 6), `SwitchingState` (`{ currentTargetNumber: number; targetIndex: number; totalPoints: number; dartsThrown: number; status: "IN_PROGRESS" | "COMPLETE" }`), `applySwitchingDart`, `foldSwitchingState`, `switchingEngineFactory`.

- [ ] **Step 1: Add `SwitchingState` to the exercise types module**

```typescript
// app/src/modules/exercise/types.ts
/**
 * Warm-Up state, derived on every `state()` call. It carries no elapsed time:
 * an `ExerciseEngine` is deterministic with respect to its inputs,
 * configuration and ruleset (09-training-routines.md §9), so the clock lives in
 * the caller and transitions arrive as `advance()` calls.
 */
export type WarmUpState = {
  phaseIndex: number;
  phaseName: string;
  targets: readonly number[];
  phaseDurationSeconds: number;
  phaseCount: number;
  status: "IN_PROGRESS" | "COMPLETE";
};

/**
 * Switching state, derived on every `state()` call by replaying `facts()`
 * (`foldSwitchingState`) — nothing here is held as mutable engine state.
 * `targetIndex` is the position in `config.targets` the *next* dart scores
 * against; `currentTargetNumber` is that same target's board number, so a
 * caller never has to index into its own copy of the config to render it.
 */
export type SwitchingState = {
  currentTargetNumber: number;
  targetIndex: number;
  totalPoints: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};
```

- [ ] **Step 2: Write the failing test**

```typescript
// app/tests/modules/exercise/switching.engine.module.test.ts
import { describe, expect, it } from "vitest";
import { switchingEngineFactory } from "@modules/exercise/switching.engine.module";
import type { SwitchingConfigData } from "@lib/types";
import type { DartObservation } from "@modules/types";

const CONFIG: SwitchingConfigData = {
  targets: [20, 19, 18],
  scoring: { single: 1, double: 2, treble: 3 },
};

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

describe("switchingEngineFactory", () => {
  it("starts aimed at the first target with no points", () => {
    const engine = switchingEngineFactory.create(CONFIG);

    expect(engine.state()).toEqual({
      currentTargetNumber: 20,
      targetIndex: 0,
      totalPoints: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("scores a treble hit on the current target and advances the target", () => {
    const engine = switchingEngineFactory.create(CONFIG);

    const state = engine.record(dart(20, "TREBLE"));

    expect(state.totalPoints).toBe(3);
    expect(state.dartsThrown).toBe(1);
    expect(state.targetIndex).toBe(1);
    expect(state.currentTargetNumber).toBe(19);
  });

  it("scores zero for a dart that lands outside the current target", () => {
    const engine = switchingEngineFactory.create(CONFIG);

    const state = engine.record(dart(5, "TREBLE"));

    expect(state.totalPoints).toBe(0);
    expect(state.dartsThrown).toBe(1);
  });

  it("wraps back to the first target after a full cycle", () => {
    const engine = switchingEngineFactory.create(CONFIG);
    engine.record(dart(20, "SINGLE"));
    engine.record(dart(19, "SINGLE"));

    const state = engine.record(dart(18, "SINGLE"));

    expect(state.dartsThrown).toBe(3);
    expect(state.totalPoints).toBe(3);
    expect(state.targetIndex).toBe(0);
    expect(state.currentTargetNumber).toBe(20);
  });

  it("undoes the last dart", () => {
    const engine = switchingEngineFactory.create(CONFIG);
    engine.record(dart(20, "DOUBLE"));

    expect(engine.undo()).toBe(true);
    expect(engine.state()).toEqual({
      currentTargetNumber: 20,
      targetIndex: 0,
      totalPoints: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
    expect(engine.undo()).toBe(false);
  });

  it("completes only on expireTimer, and refuses to record after", () => {
    const engine = switchingEngineFactory.create(CONFIG);
    engine.record(dart(20, "SINGLE"));

    expect(engine.isComplete()).toBe(false);
    engine.expireTimer();
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().status).toBe("COMPLETE");
    expect(() => engine.record(dart(19, "SINGLE"))).toThrow();
  });

  it("rehydrates in-progress totals from prior facts", () => {
    const engine = switchingEngineFactory.create(CONFIG);
    engine.record(dart(20, "TREBLE"));
    engine.record(dart(19, "DOUBLE"));
    const prior = engine.facts();

    const resumed = switchingEngineFactory.create(CONFIG, prior);

    expect(resumed.state()).toEqual({
      currentTargetNumber: 18,
      targetIndex: 2,
      totalPoints: 5,
      dartsThrown: 2,
      status: "IN_PROGRESS",
    });
  });

  it("returns copies, never live internals", () => {
    const engine = switchingEngineFactory.create(CONFIG);
    engine.record(dart(20, "SINGLE"));

    engine.facts().turns.push({
      clientKey: "x",
      stageClientKey: "block-1",
      participantRef: "solo",
      sequence: 99,
      completedAt: null,
      totalScore: 0,
      darts: [],
    });

    expect(engine.facts().turns).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/exercise/switching.engine.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/exercise/switching.engine.module'`.

- [ ] **Step 4: Create the solo-participant constant**

```typescript
// app/src/modules/exercise/solo-participant.module.ts
/**
 * The one participant every solo exercise session's `turns` log under.
 * Training routines have no seat or opponent concept, unlike a `GameEngine`
 * session (09-training-routines.md §3-4), so there is nothing to derive this
 * from — it is a fixed constant, not a configured seat.
 */
export const SOLO_PARTICIPANT_REF = "solo";
```

- [ ] **Step 5: Implement `SwitchingEngine`**

```typescript
// app/src/modules/exercise/switching.engine.module.ts
import type { SwitchingConfigData } from "@lib/exercise/rulesets/types";
import { SwitchingV1Config } from "@lib/exercise/rulesets/types";
import type {
  DartFact,
  DartObservation,
  EngineFacts,
  TurnFact,
} from "@modules/game/types";
import {
  appendObservedDart,
  cloneTurns,
  exerciseBlockStage,
  openOrCreateTurn,
  undoLastDart,
} from "@modules/game/turn-log.module";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import type {
  DartExerciseEngine,
  DartExerciseEngineFactory,
} from "./interfaces";
import { SOLO_PARTICIPANT_REF } from "./solo-participant.module";
import type { SwitchingState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "SWITCHING_V1" as const;
const STAGE = exerciseBlockStage();

/**
 * Every `DartZoneKey` a single ring can produce, mirroring
 * `singles-training.engine.module.ts`'s own local copy — kept local rather
 * than shared, matching how every other `GameEngine` module already
 * declares its own copy of this set.
 */
const SINGLE_ZONE_KEYS = new Set(["SINGLE", "INNER_SINGLE", "OUTER_SINGLE"]);

/**
 * Points for one dart already known to have been thrown at `intendedTarget`
 * — a dart that landed on a different number than the visit's own current
 * target always scores 0 ("outside", 09-training-routines.md §14/§17).
 */
function pointsFor(
  intendedTarget: number,
  scoring: SwitchingConfigData["scoring"],
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): number {
  if (hitTargetNumber !== intendedTarget) return 0;
  if (SINGLE_ZONE_KEYS.has(hitZoneKey)) return scoring.single;
  if (hitZoneKey === "DOUBLE") return scoring.double;
  if (hitZoneKey === "TREBLE") return scoring.treble;
  return 0;
}

type SwitchingProgress = {
  targetIndex: number;
  totalPoints: number;
  dartsThrown: number;
};

const INITIAL_PROGRESS: SwitchingProgress = {
  targetIndex: 0,
  totalPoints: 0,
  dartsThrown: 0,
};

/**
 * Pure reducer: folds one dart fact onto the running Switching progress.
 * Exported for direct unit testing independent of the engine class.
 */
export function applySwitchingDart(
  config: SwitchingConfigData,
  progress: SwitchingProgress,
  dart: Pick<DartFact, "hitTargetNumber" | "hitZoneKey">,
): SwitchingProgress {
  const intendedTarget = config.targets[progress.targetIndex];
  const points = pointsFor(
    intendedTarget,
    config.scoring,
    dart.hitTargetNumber,
    dart.hitZoneKey,
  );
  return {
    targetIndex: (progress.targetIndex + 1) % config.targets.length,
    totalPoints: progress.totalPoints + points,
    dartsThrown: progress.dartsThrown + 1,
  };
}

/**
 * Folds the whole fact log into Switching state — a pure function of
 * `facts`/`config`/`complete`, mirroring `foldSinglesTrainingState`. `turns`
 * is flattened in write order: `openOrCreateTurn`'s reuse rule guarantees
 * darts are appended in the same order they were recorded, so replaying
 * turn-by-turn, dart-by-dart reproduces the exact target cycle position.
 */
export function foldSwitchingState(
  facts: EngineFacts,
  config: SwitchingConfigData,
  complete: boolean,
): SwitchingState {
  const progress = facts.turns
    .flatMap((turn) => turn.darts)
    .reduce(
      (acc, dart) => applySwitchingDart(config, acc, dart),
      INITIAL_PROGRESS,
    );

  return {
    currentTargetNumber: config.targets[progress.targetIndex],
    targetIndex: progress.targetIndex,
    totalPoints: progress.totalPoints,
    dartsThrown: progress.dartsThrown,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

/**
 * Switching: cycles a fixed target list dart by dart, scoring each dart by
 * the ring it hit relative to its own visit's current target
 * (09-training-routines.md §17, design spec 2026-09-11 §5.2). One visit —
 * one `TurnFact` — is one full pass through `config.targets`. The engine
 * owns no clock: completion arrives only through `expireTimer()`, called by
 * the (not yet built) controller driving the step's countdown, exactly like
 * `TuodEngine`/`ScoreTrainingEngine` (D264).
 */
class SwitchingEngine implements DartExerciseEngine<SwitchingState> {
  readonly exerciseRulesetVersionKey = EXERCISE_RULESET_VERSION_KEY;

  private readonly config: SwitchingConfigData;
  private readonly turns: TurnFact[];
  private complete = false;

  constructor(config: SwitchingConfigData, prior?: EngineFacts) {
    this.config = SwitchingV1Config.parse(config);
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): SwitchingState {
    return foldSwitchingState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
      this.complete,
    );
  }

  record(observation: DartObservation): SwitchingState {
    if (this.complete) {
      throw new Error(
        "Cannot record a dart once the exercise is complete; undo first to correct it.",
      );
    }
    const turn = openOrCreateTurn(
      this.turns,
      STAGE.clientKey,
      SOLO_PARTICIPANT_REF,
      (last) => last.darts.length < this.config.targets.length,
    );
    const intendedTarget =
      this.config.targets[
        foldSwitchingState(
          { stages: [{ ...STAGE }], turns: this.turns },
          this.config,
          false,
        ).targetIndex
      ];
    appendObservedDart(turn, observation, {
      intendedTargetNumber: intendedTarget,
      intendedZoneKey: null,
    });
    if (turn.darts.length === this.config.targets.length) {
      turn.completedAt = new Date().toISOString();
    }
    return this.deriveState();
  }

  undo(): boolean {
    if (this.complete) {
      this.complete = false;
      return true;
    }
    return undoLastDart(this.turns);
  }

  /**
   * Records that the step's countdown has elapsed. The countdown itself
   * lives in the controller, not the engine — mirrors
   * `TuodEngine.expireTimer()` (D264).
   */
  expireTimer(): void {
    this.complete = true;
  }

  isComplete(): boolean {
    return this.complete;
  }

  state(): SwitchingState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const switchingEngineFactory: DartExerciseEngineFactory<
  SwitchingConfigData,
  SwitchingState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  create(config: SwitchingConfigData, prior?: EngineFacts) {
    return new SwitchingEngine(config, prior);
  },
};

registerDartExerciseEngineFactory(switchingEngineFactory);
```

Note: computing `intendedTarget` inside `record()` by calling `foldSwitchingState` again (before the new dart is appended) is intentional — it keeps `applySwitchingDart`/`foldSwitchingState` the single source of truth for "which target is next," so `record()` never duplicates that arithmetic locally and can never drift from what `state()` reports.

- [ ] **Step 6: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/exercise/switching.engine.module.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/exercise/types.ts app/src/modules/exercise/solo-participant.module.ts app/src/modules/exercise/switching.engine.module.ts app/tests/modules/exercise/switching.engine.module.test.ts
git commit -m "feat(exercise): implement SwitchingEngine"
```

---

### Task 4: `SWITCHING` server-side validator

**Files:**
- Create: `app/src/services/exercise-rulesets/switching/switching.validator.ts`
- Modify: `app/src/services/exercise-rulesets/registry.ts`
- Test: `app/tests/services/exercise-rulesets/switching.validator.test.ts`

**Interfaces:**
- Consumes: `SwitchingV1Config` (Task 2), `ExerciseRulesetValidator`/`ExerciseConfigValidationResult` (`@services/interfaces`, `@services/types`).
- Produces: `switchingValidator`, registered in `getExerciseRulesetValidator` under `"SWITCHING_V1"`.

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/services/exercise-rulesets/switching.validator.test.ts
import { describe, expect, it } from "vitest";
import { switchingValidator } from "@services/exercise-rulesets/switching/switching.validator";

const VALID = {
  targets: [20, 19, 18],
  scoring: { single: 1, double: 2, treble: 3 },
};

describe("switchingValidator.validateConfig", () => {
  it("accepts a well-formed configuration", () => {
    const result = switchingValidator.validateConfig({ config: VALID });

    expect(result).toEqual({ ok: true, config: VALID });
  });

  it("rejects an empty target list", () => {
    const result = switchingValidator.validateConfig({
      config: { ...VALID, targets: [] },
    });

    expect(result.ok).toBe(false);
  });

  it("names the offending path in its issues", () => {
    const result = switchingValidator.validateConfig({
      config: { ...VALID, scoring: { single: -1, double: 2, treble: 3 } },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("scoring");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/services/exercise-rulesets/switching.validator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the validator**

```typescript
// app/src/services/exercise-rulesets/switching/switching.validator.ts
import { SwitchingV1Config } from "@lib/exercise/rulesets/types";
import type { ExerciseRulesetValidator } from "@services/interfaces";
import type { ExerciseConfigValidationResult } from "@services/types";

/**
 * Switching v1 asserts only that the target list and scoring parse: the
 * ruleset has no mode pair to cross-check and no dart rows to bound
 * (09-training-routines.md §17). The §7 sixty-minute cap spans a whole
 * routine, so it belongs to `modules/training/routine-duration.module.ts`,
 * not here.
 */
export const switchingValidator: ExerciseRulesetValidator = {
  validateConfig({ config }): ExerciseConfigValidationResult {
    const parsed = SwitchingV1Config.safeParse(config);
    if (!parsed.success) {
      return {
        ok: false,
        issues: parsed.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      };
    }
    return { ok: true, config: parsed.data as Record<string, unknown> };
  },
};
```

- [ ] **Step 4: Register it**

```typescript
// app/src/services/exercise-rulesets/registry.ts
import type { ExerciseRulesetValidator } from "./interfaces";
import { warmUpValidator } from "./warm-up/warm-up.validator";
import { switchingValidator } from "./switching/switching.validator";

const REGISTRY: Record<string, ExerciseRulesetValidator> = {
  WARM_UP_V1: warmUpValidator,
  SWITCHING_V1: switchingValidator,
};

export function getExerciseRulesetValidator(
  exerciseRulesetVersionKey: string,
): ExerciseRulesetValidator | undefined {
  return REGISTRY[exerciseRulesetVersionKey];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/services/exercise-rulesets/switching.validator.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add app/src/services/exercise-rulesets/switching/switching.validator.ts app/src/services/exercise-rulesets/registry.ts app/tests/services/exercise-rulesets/switching.validator.test.ts
git commit -m "feat(exercise): add SWITCHING server-side validator"
```

---

### Task 5: `DOUBLE_PATTERN` state type (setup for Task 6)

**Files:**
- Modify: `app/src/modules/exercise/types.ts`

**Interfaces:**
- Produces: `DoublePatternState` (`{ patternIndex: number; targetWithinPattern: number; currentDoubleNumber: number; totalPoints: number; dartsThrown: number; status: "IN_PROGRESS" | "COMPLETE" }`) — consumed by Task 6.

- [ ] **Step 1: Add the type**

Append to `app/src/modules/exercise/types.ts`:

```typescript
/**
 * Double Pattern state, derived on every `state()` call by replaying
 * `facts()` (`foldDoublePatternState`), exactly like `SwitchingState`.
 * `patternIndex`/`targetWithinPattern` locate the *next* dart inside
 * `config.patterns`; `currentDoubleNumber` is that double's own board
 * number, e.g. `20` for `D20`.
 */
export type DoublePatternState = {
  patternIndex: number;
  targetWithinPattern: number;
  currentDoubleNumber: number;
  totalPoints: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};
```

- [ ] **Step 2: Type-check**

Run: `cd app && npx tsc --noEmit -p .`
Expected: no new errors attributable to this file (`DoublePatternState` is unused until Task 6, which is fine — it is exported, not a local unused binding).

- [ ] **Step 3: Commit**

```bash
git add app/src/modules/exercise/types.ts
git commit -m "feat(exercise): add DoublePatternState type"
```

---

### Task 6: `DoublePatternEngine`

**Files:**
- Create: `app/src/modules/exercise/double-pattern.engine.module.ts`
- Test: `app/tests/modules/exercise/double-pattern.engine.module.test.ts`

**Interfaces:**
- Consumes: `DartExerciseEngine`/`DartExerciseEngineFactory` (Task 1), `DoublePatternV1Config`/`DoublePatternConfigData` (Task 2), `DoublePatternState` (Task 5), `SOLO_PARTICIPANT_REF` (Task 3), the same `turn-log.module` helpers as Task 3.
- Produces: `applyDoublePatternDart`, `foldDoublePatternState`, `doublePatternEngineFactory`.

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/modules/exercise/double-pattern.engine.module.test.ts
import { describe, expect, it } from "vitest";
import { doublePatternEngineFactory } from "@modules/exercise/double-pattern.engine.module";
import type { DoublePatternConfigData } from "@lib/types";
import type { DartObservation } from "@modules/types";

const CONFIG: DoublePatternConfigData = {
  patterns: [
    [20, 10, 5],
    [16, 8, 4],
  ],
};

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

describe("doublePatternEngineFactory", () => {
  it("starts on the first pattern's first double", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);

    expect(engine.state()).toEqual({
      patternIndex: 0,
      targetWithinPattern: 0,
      currentDoubleNumber: 20,
      totalPoints: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("scores 1 point for a hit double and advances within the pattern", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);

    const state = engine.record(dart(20, "DOUBLE"));

    expect(state.totalPoints).toBe(1);
    expect(state.dartsThrown).toBe(1);
    expect(state.targetWithinPattern).toBe(1);
    expect(state.currentDoubleNumber).toBe(10);
  });

  it("scores 0 for a non-double hit on the right number", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);

    const state = engine.record(dart(20, "TREBLE"));

    expect(state.totalPoints).toBe(0);
  });

  it("scores 0 for a double on the wrong number", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);

    const state = engine.record(dart(10, "DOUBLE"));

    expect(state.totalPoints).toBe(0);
  });

  it("advances to the next pattern after the current one completes", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);
    engine.record(dart(20, "DOUBLE"));
    engine.record(dart(10, "DOUBLE"));

    const state = engine.record(dart(5, "DOUBLE"));

    expect(state.totalPoints).toBe(3);
    expect(state.dartsThrown).toBe(3);
    expect(state.patternIndex).toBe(1);
    expect(state.targetWithinPattern).toBe(0);
    expect(state.currentDoubleNumber).toBe(16);
  });

  it("wraps back to the first pattern after a full cycle", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);
    for (const n of [20, 10, 5, 16, 8, 4]) {
      engine.record(dart(n, "DOUBLE"));
    }

    const state = engine.state();
    expect(state.dartsThrown).toBe(6);
    expect(state.totalPoints).toBe(6);
    expect(state.patternIndex).toBe(0);
    expect(state.targetWithinPattern).toBe(0);
    expect(state.currentDoubleNumber).toBe(20);
  });

  it("undoes the last dart", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);
    engine.record(dart(20, "DOUBLE"));

    expect(engine.undo()).toBe(true);
    expect(engine.state().dartsThrown).toBe(0);
    expect(engine.state().totalPoints).toBe(0);
  });

  it("completes only on expireTimer, and refuses to record after", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);

    engine.expireTimer();
    expect(engine.isComplete()).toBe(true);
    expect(engine.state().status).toBe("COMPLETE");
    expect(() => engine.record(dart(20, "DOUBLE"))).toThrow();
  });

  it("rehydrates in-progress totals from prior facts", () => {
    const engine = doublePatternEngineFactory.create(CONFIG);
    engine.record(dart(20, "DOUBLE"));
    const prior = engine.facts();

    const resumed = doublePatternEngineFactory.create(CONFIG, prior);

    expect(resumed.state()).toEqual({
      patternIndex: 0,
      targetWithinPattern: 1,
      currentDoubleNumber: 10,
      totalPoints: 1,
      dartsThrown: 1,
      status: "IN_PROGRESS",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/exercise/double-pattern.engine.module.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `DoublePatternEngine`**

```typescript
// app/src/modules/exercise/double-pattern.engine.module.ts
import type { DoublePatternConfigData } from "@lib/exercise/rulesets/types";
import { DoublePatternV1Config } from "@lib/exercise/rulesets/types";
import type {
  DartFact,
  DartObservation,
  EngineFacts,
  TurnFact,
} from "@modules/game/types";
import {
  appendObservedDart,
  cloneTurns,
  exerciseBlockStage,
  openOrCreateTurn,
  undoLastDart,
} from "@modules/game/turn-log.module";
import { registerDartExerciseEngineFactory } from "./dart-engine.registry";
import type {
  DartExerciseEngine,
  DartExerciseEngineFactory,
} from "./interfaces";
import { SOLO_PARTICIPANT_REF } from "./solo-participant.module";
import type { DoublePatternState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "DOUBLE_PATTERN_V1" as const;
const STAGE = exerciseBlockStage();

type PatternPosition = { patternIndex: number; targetWithinPattern: number };

/**
 * Where `dartsThrown` (0-indexed count of darts already thrown, i.e. the
 * position of the *next* dart) falls in the flattened, repeating sequence
 * of `patterns`. `patterns` is non-empty and every pattern has at least one
 * element (`DoublePatternV1Config`), so `cycleLength` is always positive and
 * the loop always finds a position.
 */
function positionFor(
  patterns: readonly number[][],
  dartsThrown: number,
): PatternPosition {
  const cycleLength = patterns.reduce((sum, p) => sum + p.length, 0);
  let offset = dartsThrown % cycleLength;
  for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
    const length = patterns[patternIndex].length;
    if (offset < length) return { patternIndex, targetWithinPattern: offset };
    offset -= length;
  }
  /* istanbul ignore next -- unreachable: offset < cycleLength by construction */
  throw new Error("unreachable");
}

type DoublePatternProgress = {
  dartsThrown: number;
  totalPoints: number;
};

const INITIAL_PROGRESS: DoublePatternProgress = {
  dartsThrown: 0,
  totalPoints: 0,
};

/**
 * Pure reducer: folds one dart fact onto the running Double Pattern
 * progress. Exported for direct unit testing independent of the engine
 * class.
 */
export function applyDoublePatternDart(
  config: DoublePatternConfigData,
  progress: DoublePatternProgress,
  dart: Pick<DartFact, "hitTargetNumber" | "hitZoneKey">,
): DoublePatternProgress {
  const { patternIndex, targetWithinPattern } = positionFor(
    config.patterns,
    progress.dartsThrown,
  );
  const intendedDouble = config.patterns[patternIndex][targetWithinPattern];
  const hit =
    dart.hitTargetNumber === intendedDouble && dart.hitZoneKey === "DOUBLE";
  return {
    dartsThrown: progress.dartsThrown + 1,
    totalPoints: progress.totalPoints + (hit ? 1 : 0),
  };
}

/**
 * Folds the whole fact log into Double Pattern state — a pure function of
 * `facts`/`config`/`complete`, mirroring `foldSwitchingState`.
 */
export function foldDoublePatternState(
  facts: EngineFacts,
  config: DoublePatternConfigData,
  complete: boolean,
): DoublePatternState {
  const progress = facts.turns
    .flatMap((turn) => turn.darts)
    .reduce(
      (acc, dart) => applyDoublePatternDart(config, acc, dart),
      INITIAL_PROGRESS,
    );
  const { patternIndex, targetWithinPattern } = positionFor(
    config.patterns,
    progress.dartsThrown,
  );

  return {
    patternIndex,
    targetWithinPattern,
    currentDoubleNumber: config.patterns[patternIndex][targetWithinPattern],
    totalPoints: progress.totalPoints,
    dartsThrown: progress.dartsThrown,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

/**
 * Double Pattern: cycles a fixed list of double-number patterns, one visit
 * per pattern — each visit throws as many darts as its own pattern has
 * entries (09-training-routines.md §17, design spec 2026-09-11 §5.3). Every
 * hit double scores 1 point; nothing else scores. The engine owns no clock:
 * completion arrives only through `expireTimer()` (D264), exactly like
 * `SwitchingEngine`.
 */
class DoublePatternEngine implements DartExerciseEngine<DoublePatternState> {
  readonly exerciseRulesetVersionKey = EXERCISE_RULESET_VERSION_KEY;

  private readonly config: DoublePatternConfigData;
  private readonly turns: TurnFact[];
  private complete = false;

  constructor(config: DoublePatternConfigData, prior?: EngineFacts) {
    this.config = DoublePatternV1Config.parse(config);
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private dartsThrownSoFar(): number {
    return this.turns.reduce((sum, turn) => sum + turn.darts.length, 0);
  }

  private deriveState(): DoublePatternState {
    return foldDoublePatternState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
      this.complete,
    );
  }

  record(observation: DartObservation): DoublePatternState {
    if (this.complete) {
      throw new Error(
        "Cannot record a dart once the exercise is complete; undo first to correct it.",
      );
    }
    const { patternIndex, targetWithinPattern } = positionFor(
      this.config.patterns,
      this.dartsThrownSoFar(),
    );
    const patternLength = this.config.patterns[patternIndex].length;
    const intendedDouble = this.config.patterns[patternIndex][
      targetWithinPattern
    ];

    const turn = openOrCreateTurn(
      this.turns,
      STAGE.clientKey,
      SOLO_PARTICIPANT_REF,
      (last) => last.darts.length < patternLength,
    );
    appendObservedDart(turn, observation, {
      intendedTargetNumber: intendedDouble,
      intendedZoneKey: "DOUBLE",
    });
    if (turn.darts.length === patternLength) {
      turn.completedAt = new Date().toISOString();
    }
    return this.deriveState();
  }

  undo(): boolean {
    if (this.complete) {
      this.complete = false;
      return true;
    }
    return undoLastDart(this.turns);
  }

  /**
   * Records that the step's countdown has elapsed — mirrors
   * `TuodEngine.expireTimer()` (D264).
   */
  expireTimer(): void {
    this.complete = true;
  }

  isComplete(): boolean {
    return this.complete;
  }

  state(): DoublePatternState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const doublePatternEngineFactory: DartExerciseEngineFactory<
  DoublePatternConfigData,
  DoublePatternState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  create(config: DoublePatternConfigData, prior?: EngineFacts) {
    return new DoublePatternEngine(config, prior);
  },
};

registerDartExerciseEngineFactory(doublePatternEngineFactory);
```

Note the turn-boundary bug this avoids: `openOrCreateTurn`'s reuse predicate must check against *this pattern's own length* (`patternLength`, resolved from `dartsThrownSoFar()` before the new dart), not `this.config.targets.length` (there is no such field on this config) — patterns can vary in length pattern to pattern, unlike Switching's single fixed-length `targets` list.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/exercise/double-pattern.engine.module.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/exercise/double-pattern.engine.module.ts app/tests/modules/exercise/double-pattern.engine.module.test.ts
git commit -m "feat(exercise): implement DoublePatternEngine"
```

---

### Task 7: `DOUBLE_PATTERN` server-side validator

**Files:**
- Create: `app/src/services/exercise-rulesets/double-pattern/double-pattern.validator.ts`
- Modify: `app/src/services/exercise-rulesets/registry.ts`
- Test: `app/tests/services/exercise-rulesets/double-pattern.validator.test.ts`

**Interfaces:**
- Consumes: `DoublePatternV1Config` (Task 2).
- Produces: `doublePatternValidator`, registered under `"DOUBLE_PATTERN_V1"`.

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/services/exercise-rulesets/double-pattern.validator.test.ts
import { describe, expect, it } from "vitest";
import { doublePatternValidator } from "@services/exercise-rulesets/double-pattern/double-pattern.validator";

const VALID = {
  patterns: [
    [20, 10, 5],
    [16, 8, 4],
  ],
};

describe("doublePatternValidator.validateConfig", () => {
  it("accepts a well-formed configuration", () => {
    const result = doublePatternValidator.validateConfig({ config: VALID });

    expect(result).toEqual({ ok: true, config: VALID });
  });

  it("rejects an empty pattern list", () => {
    const result = doublePatternValidator.validateConfig({
      config: { patterns: [] },
    });

    expect(result.ok).toBe(false);
  });

  it("rejects a pattern with more than 3 doubles", () => {
    const result = doublePatternValidator.validateConfig({
      config: { patterns: [[20, 10, 5, 2]] },
    });

    expect(result.ok).toBe(false);
  });

  it("names the offending path in its issues", () => {
    const result = doublePatternValidator.validateConfig({
      config: { patterns: [[21]] },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("patterns");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/services/exercise-rulesets/double-pattern.validator.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the validator**

```typescript
// app/src/services/exercise-rulesets/double-pattern/double-pattern.validator.ts
import { DoublePatternV1Config } from "@lib/exercise/rulesets/types";
import type { ExerciseRulesetValidator } from "@services/interfaces";
import type { ExerciseConfigValidationResult } from "@services/types";

/**
 * Double Pattern v1 asserts only that the pattern list parses — no mode
 * pair, no dart rows to bound (09-training-routines.md §17). The §7
 * sixty-minute cap spans a whole routine, handled elsewhere.
 */
export const doublePatternValidator: ExerciseRulesetValidator = {
  validateConfig({ config }): ExerciseConfigValidationResult {
    const parsed = DoublePatternV1Config.safeParse(config);
    if (!parsed.success) {
      return {
        ok: false,
        issues: parsed.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`,
        ),
      };
    }
    return { ok: true, config: parsed.data as Record<string, unknown> };
  },
};
```

- [ ] **Step 4: Register it**

```typescript
// app/src/services/exercise-rulesets/registry.ts
import type { ExerciseRulesetValidator } from "./interfaces";
import { warmUpValidator } from "./warm-up/warm-up.validator";
import { switchingValidator } from "./switching/switching.validator";
import { doublePatternValidator } from "./double-pattern/double-pattern.validator";

const REGISTRY: Record<string, ExerciseRulesetValidator> = {
  WARM_UP_V1: warmUpValidator,
  SWITCHING_V1: switchingValidator,
  DOUBLE_PATTERN_V1: doublePatternValidator,
};

export function getExerciseRulesetValidator(
  exerciseRulesetVersionKey: string,
): ExerciseRulesetValidator | undefined {
  return REGISTRY[exerciseRulesetVersionKey];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/services/exercise-rulesets/double-pattern.validator.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add app/src/services/exercise-rulesets/double-pattern/double-pattern.validator.ts app/src/services/exercise-rulesets/registry.ts app/tests/services/exercise-rulesets/double-pattern.validator.test.ts
git commit -m "feat(exercise): add DOUBLE_PATTERN server-side validator"
```

---

### Task 8: `WarmUpEngine` weight-based generalization

**Files:**
- Modify: `app/src/modules/exercise/warm-up.engine.module.ts`

**Interfaces:**
- Consumes: `WarmUpEngineInputSchema`/`WarmUpEngineInput` (Task 2).
- Produces: `WarmUpEngine` now takes `WarmUpEngineInput` (adds `stepDurationSeconds`); `WarmUpState.phaseDurationSeconds` is now proportional, not fixed. This is the task that turns Task 2's `warm-up.engine.module.test.ts` fully green.

- [ ] **Step 1: Confirm the target test is currently red**

Run: `cd app && npx vitest run tests/modules/exercise/warm-up.engine.module.test.ts`
Expected: FAIL — `WarmUpV1Config.parse` rejects the `stepDurationSeconds` field (`.strict()` on the old schema) and `phase.durationSeconds` is `undefined` (the fixture no longer has it).

- [ ] **Step 2: Update `WarmUpEngine`**

Replace `app/src/modules/exercise/warm-up.engine.module.ts` with:

```typescript
import { WarmUpEngineInputSchema } from "@lib/exercise/rulesets/types";
import type { WarmUpEngineInput } from "@lib/types";
import { newClientKey } from "@modules/game/client-key.module";
import type { EngineFacts, StageFact } from "@modules/types";
import { registerExerciseEngineFactory } from "./engine.registry";
import type { ExerciseEngine, ExerciseEngineFactory } from "./interfaces";
import type { WarmUpState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "WARM_UP_V1" as const;

function newSectionStage(sequence: number): StageFact {
  return {
    clientKey: newClientKey(),
    stageTypeKey: "EXERCISE_SECTION",
    parentClientKey: null,
    sequence,
  };
}

function cloneStages(stages: readonly StageFact[]): StageFact[] {
  return stages.map((stage) => ({ ...stage }));
}

/**
 * Warm-Up: ordered timed sections, no dart input, no score
 * (09-training-routines.md §16). One `EXERCISE_SECTION` stage is appended per
 * section entered, flat under the exercise session — the session already
 * represents the exercise, so no grouping stage is created.
 *
 * The engine owns no clock. A caller drives section transitions with
 * `advance()`; elapsed time belongs to the controller, which keeps this engine
 * deterministic with respect to its configuration alone (§9).
 *
 * Each phase's own duration is resolved from `config.stepDurationSeconds`
 * (the routine step's total duration) split proportionally to
 * `phase.weight` — not a fixed per-phase value — so the same template
 * config serves routines of different lengths (design spec 2026-09-11
 * §5.1). Rounding is per-phase (`Math.round`), so the sum of all
 * `phaseDurationSeconds` across a routine's steps can differ from
 * `stepDurationSeconds` by at most a handful of seconds — acceptable for a
 * UI-facing duration display, not a value anything sums back up.
 */
class WarmUpEngine implements ExerciseEngine<WarmUpState> {
  readonly exerciseRulesetVersionKey = EXERCISE_RULESET_VERSION_KEY;

  private readonly config: WarmUpEngineInput;
  private stages: StageFact[];
  private complete = false;

  constructor(config: WarmUpEngineInput, prior?: EngineFacts) {
    this.config = WarmUpEngineInputSchema.parse(config);
    this.stages =
      prior && prior.stages.length > 0
        ? cloneStages(prior.stages)
        : [newSectionStage(1)];
  }

  private deriveState(): WarmUpState {
    const phaseIndex = this.stages.length - 1;
    const phase = this.config.phases[phaseIndex];
    const totalWeight = this.config.phases.reduce(
      (sum, p) => sum + p.weight,
      0,
    );
    const phaseDurationSeconds = Math.round(
      (this.config.stepDurationSeconds * phase.weight) / totalWeight,
    );
    return {
      phaseIndex,
      phaseName: phase.name,
      targets: [...phase.targets],
      phaseDurationSeconds,
      phaseCount: this.config.phases.length,
      status: this.complete ? "COMPLETE" : "IN_PROGRESS",
    };
  }

  advance(): WarmUpState {
    if (this.complete) return this.deriveState();
    if (this.stages.length < this.config.phases.length) {
      this.stages.push(newSectionStage(this.stages.length + 1));
    } else {
      this.complete = true;
    }
    return this.deriveState();
  }

  undo(): boolean {
    if (this.complete) {
      this.complete = false;
      return true;
    }
    if (this.stages.length <= 1) return false;
    this.stages.pop();
    return true;
  }

  isComplete(): boolean {
    return this.complete;
  }

  state(): WarmUpState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: cloneStages(this.stages), turns: [] };
  }
}

export const warmUpEngineFactory: ExerciseEngineFactory<
  WarmUpEngineInput,
  WarmUpState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  create(config: WarmUpEngineInput, prior?: EngineFacts) {
    return new WarmUpEngine(config, prior);
  },
};

registerExerciseEngineFactory(warmUpEngineFactory);
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/exercise/warm-up.engine.module.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 4: Run the full exercise suite and type-check**

Run: `cd app && npx vitest run tests/modules/exercise tests/services/exercise-rulesets tests/lib/exercise && npx tsc --noEmit -p .`
Expected: all PASS, zero type errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/exercise/warm-up.engine.module.ts
git commit -m "feat(exercise): generalize WarmUpEngine to proportional phase durations"
```

---

### Task 9: Seed — `SWITCHING`/`DOUBLE_PATTERN` catalog rows

**Files:**
- Create: `database/seeds/0016_switching_double_pattern_exercise_types.sql`

**Interfaces:**
- Produces: `exercise_types` rows for `SWITCHING`/`DOUBLE_PATTERN`, `exercise_ruleset_versions` rows for `SWITCHING_V1`/`DOUBLE_PATTERN_V1` — consumed by Task 10's `exercise_templates` rows via `exercise_type_id` FK.

- [ ] **Step 1: Write the seed file**

```sql
-- database/seeds/0016_switching_double_pattern_exercise_types.sql
--
-- ============================================================
-- Seed: 0016_switching_double_pattern_exercise_types.sql
--
-- Purpose:
-- Insert the SWITCHING and DOUBLE_PATTERN exercise types and
-- their v1 rulesets (09-training-routines.md 3.4, design spec
-- 2026-09-11 5.2/5.3). Catalog rows only — the Balanced Training
-- routine that uses them is seeded separately in
-- 0017_balanced_training_routine.sql, mirroring the 0014/0015
-- split for WARM_UP.
-- ============================================================
BEGIN;

INSERT INTO exercise_types (
        id,
        implementation_key,
        name,
        description,
        is_published,
        created_at,
        updated_at
    )
VALUES (
        '0199a000-0000-7000-8000-000000000003',
        'SWITCHING',
        'Switching',
        'Cycles a fixed target list dart by dart, scored by zone.',
        TRUE,
        now(),
        now()
    ),
    (
        '0199a000-0000-7000-8000-000000000004',
        'DOUBLE_PATTERN',
        'Double Pattern',
        'Cycles a fixed list of double-number patterns; each hit double scores.',
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;

INSERT INTO exercise_ruleset_versions (
        id,
        exercise_type_id,
        implementation_key,
        version_number,
        description,
        created_at
    )
VALUES (
        '0199a100-0000-7000-8000-000000000002',
        '0199a000-0000-7000-8000-000000000003',
        'SWITCHING_V1',
        1,
        'Initial switching ruleset: fixed target list, zone scoring.',
        now()
    ),
    (
        '0199a100-0000-7000-8000-000000000003',
        '0199a000-0000-7000-8000-000000000004',
        'DOUBLE_PATTERN_V1',
        1,
        'Initial double-pattern ruleset: fixed double patterns, hit scoring.',
        now()
    ) ON CONFLICT (id) DO NOTHING;

COMMIT;
```

- [ ] **Step 2: Sanity-check the file**

Run: `cd database && cat seeds/0016_switching_double_pattern_exercise_types.sql | grep -c "INSERT INTO"`
Expected: `2` (one `exercise_types` insert, one `exercise_ruleset_versions` insert). No live database is available in this sandbox (D193) — this and the `ON CONFLICT (id) DO NOTHING` idempotency shape matching `0014_exercise_types.sql` is the verification for this task.

- [ ] **Step 3: Commit**

```bash
git add database/seeds/0016_switching_double_pattern_exercise_types.sql
git commit -m "feat(db): seed SWITCHING/DOUBLE_PATTERN exercise-type catalog rows"
```

---

### Task 10: Seed — Balanced Training routine

**Files:**
- Create: `database/seeds/0017_balanced_training_routine.sql`

**Interfaces:**
- Consumes: Task 9's `exercise_types`/`exercise_ruleset_versions` rows; existing `0198f000-...-000000000002` (TUOD `game_types.id`), `0199a000-...-000000000001`/`...002` (GAME/WARM_UP `exercise_types.id`, from `0014`), `0199b000-...-000000000001` (the existing Warm-Up `exercise_templates` row, from `0015`), duration_type id `2` (MINUTES, from `0001`).
- Produces: updated Warm-Up template config (weight-based), new `exercise_templates` rows for Switching/Double-Pattern/Finishing, a new `routine_templates` row for Balanced Training, 4 new `routine_steps` rows.

- [ ] **Step 1: Write the seed file**

```sql
-- database/seeds/0017_balanced_training_routine.sql
--
-- ============================================================
-- Seed: 0017_balanced_training_routine.sql
--
-- Purpose:
-- Insert the second system routine: Balanced Training, 4 steps,
-- 30 minutes (design spec 2026-09-11 4). Reuses the existing
-- Warm-Up exercise template (0015_warm_up_routine.sql) rather
-- than creating a second one, per design spec 5.1 — its
-- default_configuration is updated in place from fixed
-- durationSeconds-per-phase to proportional weight-per-phase, a
-- change the seed 0015 phase content is compatible with:
-- five equal-weight phases reproduce the original 60s-each split
-- exactly (5 x weight 1 over a 300s step), so the existing
-- 5-minute Warm-Up routine's behaviour is unchanged.
--
-- UPDATE, not a second INSERT with ON CONFLICT DO NOTHING: this
-- is the one legitimate case for mutating already-seeded content
-- (seeds are idempotent INSERTs by id; there is no id to conflict
-- on for changing an existing row's JSONB). Written to be
-- idempotent under re-run: the new phases JSONB always
-- overwrites with the same value, whatever the row currently
-- holds.
-- ============================================================
BEGIN;

UPDATE exercise_templates
SET default_configuration = '{"phases":[
        {"name":"Upper","targets":[5,20,1],"weight":1},
        {"name":"Lower","targets":[19,3,17],"weight":1},
        {"name":"Right","targets":[13,6,10],"weight":1},
        {"name":"Left","targets":[8,11,14],"weight":1},
        {"name":"Bull","targets":[25],"weight":1}
    ]}'::jsonb,
    updated_at = now()
WHERE id = '0199b000-0000-7000-8000-000000000001';

INSERT INTO exercise_templates (
        id,
        exercise_type_id,
        game_type_id,
        name,
        description,
        default_configuration,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0199b000-0000-7000-8000-000000000002',
        '0199a000-0000-7000-8000-000000000003',
        NULL,
        'Switching',
        'One dart each at a fixed target list, scored by zone.',
        '{"targets":[20,19,18],"scoring":{"single":1,"double":2,"treble":3}}'::jsonb,
        TRUE,
        now(),
        now()
    ),
    (
        '0199b000-0000-7000-8000-000000000003',
        '0199a000-0000-7000-8000-000000000004',
        NULL,
        'Double Pattern',
        'Cycles a fixed list of double-number patterns.',
        '{"patterns":[[20,10,5],[16,8,4],[12,6,3]]}'::jsonb,
        TRUE,
        now(),
        now()
    ),
    (
        '0199b000-0000-7000-8000-000000000004',
        '0199a000-0000-7000-8000-000000000001',
        '0198f000-0000-7000-8000-000000000002',
        'Finishing',
        'Ten Up One Down, timed.',
        NULL,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;

INSERT INTO routine_templates (
        id,
        player_id,
        name,
        description,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0199c000-0000-7000-8000-000000000002',
        NULL,
        'Balanced Training',
        'Warm-up, two switching drills, and a timed finishing game — 30 minutes.',
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;

INSERT INTO routine_steps (
        id,
        routine_template_id,
        exercise_template_id,
        sequence_number,
        duration_type_id,
        duration_value,
        configuration,
        created_at
    )
VALUES (
        '0199d000-0000-7000-8000-000000000002',
        '0199c000-0000-7000-8000-000000000002',
        '0199b000-0000-7000-8000-000000000001',
        1,
        2,
        10,
        NULL,
        now()
    ),
    (
        '0199d000-0000-7000-8000-000000000003',
        '0199c000-0000-7000-8000-000000000002',
        '0199b000-0000-7000-8000-000000000002',
        2,
        2,
        5,
        NULL,
        now()
    ),
    (
        '0199d000-0000-7000-8000-000000000004',
        '0199c000-0000-7000-8000-000000000002',
        '0199b000-0000-7000-8000-000000000003',
        3,
        2,
        5,
        NULL,
        now()
    ),
    (
        '0199d000-0000-7000-8000-000000000005',
        '0199c000-0000-7000-8000-000000000002',
        '0199b000-0000-7000-8000-000000000004',
        4,
        2,
        10,
        '{"rulesetVersionKey":"TUOD_V1","durationType":"MINUTES","durationValue":10}'::jsonb,
        now()
    ) ON CONFLICT (id) DO NOTHING;

COMMIT;
```

- [ ] **Step 2: Sanity-check the file**

Run: `cd database && cat seeds/0017_balanced_training_routine.sql | grep -c "INSERT INTO\|^UPDATE"`
Expected: `4` (1 `UPDATE` + 3 `INSERT INTO` statements). Confirm by inspection: every `exercise_template_id` in the `routine_steps` insert matches an id either already seeded (`...b000-...0001`, from `0015`) or inserted earlier in this same file (`...002`, `...003`, `...004`); `duration_value` sums to 30 (10+5+5+10), matching design spec §4's total.

- [ ] **Step 3: Commit**

```bash
git add database/seeds/0017_balanced_training_routine.sql
git commit -m "feat(db): seed Balanced Training routine"
```

---

### Task 11: Docs, decision ledger, context maintenance

**Files:**
- Modify: `docs/architecture/09-training-routines.md`
- Modify: `docs/architecture/00-File-Inventory.md`
- Modify: `decisions/game-engine.md`

**Interfaces:** none (docs/decisions only).

- [ ] **Step 1: Point §17's illustrative examples at the real shapes**

In `docs/architecture/09-training-routines.md`, immediately after the `## Switching` subsection's "Runtime state may include" code block (ends `---` before `## Double Patterns`), insert:

```markdown
**Implemented** (`SWITCHING_V1`, `app/src/modules/exercise/switching.engine.module.ts`): `targets: number[]` (board numbers, e.g. `[20, 19, 18]`) and `scoring: { single, double, treble }` replace this section's `T20`/`evaluation` notation one-for-one. There is no `outside` config key — a dart landing on any number other than the visit's own current target always scores 0, by omission rather than by a configured value.
```

Immediately after the `## Double Patterns` subsection's closing paragraph ("The engine tracks the current pattern and evaluates each observed dart against the intended target."), before its `---`, insert:

```markdown
**Implemented** (`DOUBLE_PATTERN_V1`, `app/src/modules/exercise/double-pattern.engine.module.ts`): `patterns: number[][]` (e.g. `[[20, 10, 5], [16, 8, 4], [12, 6, 3]]`) replaces the `D20 → D10 → D5` notation — each element is a board number whose double counts. One point per hit double; nothing else scores.
```

In the `## 16. Warm-Up Exercise` section, immediately before the closing sentence "The warm-up should not invent artificial performance metrics simply to conform to analytics exercises.", insert:

```markdown
**Implemented** (`WARM_UP_V1`, `app/src/modules/exercise/warm-up.engine.module.ts`): each phase's configuration carries a `weight`, not a fixed `durationSeconds` — the engine splits the routine step's own total duration proportionally to weight at construction time, so the same template serves both this routine (5 phases, 5 minutes) and Balanced Training's Warm-Up step (same 5 phases, 10 minutes) without a second template.
```

- [ ] **Step 2: Register the new/changed files in the File Inventory**

Find the existing `warm-up.engine.module.ts` row in `docs/architecture/00-File-Inventory.md`:

Run: `grep -n "warm-up.engine.module.ts" docs/architecture/00-File-Inventory.md`

Using that row as the format template, add rows for: `app/src/modules/exercise/interfaces.ts` (modified — note the `DartExerciseEngine` addition), `app/src/modules/exercise/dart-engine.registry.ts`, `app/src/modules/exercise/solo-participant.module.ts`, `app/src/modules/exercise/switching.engine.module.ts`, `app/src/modules/exercise/double-pattern.engine.module.ts`, `app/src/services/exercise-rulesets/switching/switching.validator.ts`, `app/src/services/exercise-rulesets/double-pattern/double-pattern.validator.ts`, `database/seeds/0016_switching_double_pattern_exercise_types.sql`, `database/seeds/0017_balanced_training_routine.sql`, in the same section/table the Warm-Up equivalents already live under. Match the existing table's column structure exactly — do not invent new columns.

- [ ] **Step 3: Append the decision**

Derive the next decision id (do not hardcode — parallel branches may have claimed ids since this plan was written):

Run: `git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1`

Append to the end of `decisions/game-engine.md` (after its existing table, using the derived id — shown here as `D<next>`):

```markdown
### D<next> — Add DartExerciseEngine for analytics-mode exercises
Status: Accepted · Date: 2026-09-11
Decision: Analytics-mode exercises (09-training-routines.md §13) that take dart input — `SWITCHING`, `DOUBLE_PATTERN` — implement a new `DartExerciseEngine<TState>` contract (`record`/`undo`/`isComplete`/`state`/`facts`), not `ExerciseEngine<TState>` (`advance`/`undo`/`isComplete`/`state`/`facts`). The two are siblings, not a hierarchy: `DartExerciseEngine` is not built on `GameEngine` either, mirroring D264's existing rule that `ExerciseEngine` is never layered on `GameEngine`.
Reason: `ExerciseEngine` was designed for `WARM_UP` alone, which has phases to advance through and no dart input. Forcing `SWITCHING`/`DOUBLE_PATTERN` into that same shape would mean either a meaningless no-op `advance()` or bolting an input parameter onto an interface every existing `WarmUpEngine` caller assumes takes none. A second, additive interface keeps `ExerciseEngine`/`WarmUpEngine` byte-for-byte unchanged while giving dart-driven exercises the same `record(observation)` shape `GameEngine` already uses, so both engine families read the same way.
Consequences: A future training-session route dispatching by `exercise_type_id` must check both `modules/exercise/engine.registry.ts` (phase-driven) and `modules/exercise/dart-engine.registry.ts` (dart-driven) rather than one shared registry — left to that route's own implementation plan, not resolved here. `SwitchingEngine`/`DoublePatternEngine` both gained `expireTimer()`, unifying with `TuodEngine`/`ScoreTrainingEngine`'s existing "the engine owns no clock" pattern (D264) rather than inventing a new one.
```

- [ ] **Step 4: Run the decision-id and doc gate checks**

Run: `bash scripts/check-decision-ids.sh`
Expected: PASS — no duplicate ids.

Run: `git status --short docs/ decisions/`
Expected: shows only the files this task modified.

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/09-training-routines.md docs/architecture/00-File-Inventory.md decisions/game-engine.md
git commit -m "docs: register SWITCHING/DOUBLE_PATTERN implementation and DartExerciseEngine decision"
```

---

## Final Verification

- [ ] Run the full exercise-related test suite and type-check:

```bash
cd app && npx vitest run tests/modules/exercise tests/services/exercise-rulesets tests/lib/exercise && npx tsc --noEmit -p .
```

Expected: all tests PASS, zero type errors.

- [ ] Run the applicable gate scripts (per `run-all-gates`'s dispatch-by-changed-area, this touches `app/`, `database/`, `docs/`, `decisions/`):

```bash
bash scripts/check-decision-ids.sh
```

(Other gates that require a live database — `db:status`, `db:migrate`, `db:introspect`, `refresh-graph.sh`'s real refresh — cannot run in this sandbox, established precedent D193/`database/CLAUDE.md`. Note this explicitly in the completion report rather than silently skipping it.)

- [ ] Confirm no other part of the repo needed to change: `git diff --stat main` should show only the files listed in "File Structure" above, plus this plan document itself if it was committed.
