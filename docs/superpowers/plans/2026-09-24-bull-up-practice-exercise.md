# Bull Up Practice Exercise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `BULL_UP` ("Bull Up Practice") as a routine-step exercise: one dart per throw, always aimed at the bullseye; each throw is a Bullseye, Outer bull or Miss.

**Architecture:** New `DartExerciseEngine` (`BullUpEngine`) mirroring `BullseyeCheckoutEngine` — a pure fold over the turn log, clockless (D264), one dart per turn. Server gets a parse-only validator and enum entries; seed `0030` puts the template in `v_exercise_template_catalog`; the routine play page gets an adapter, readouts and a panel. No schema change.

**Tech Stack:** TypeScript, Zod, Vitest, Astro + Alpine.js, PostgreSQL seeds.

**Spec:** `docs/superpowers/specs/2026-09-24-bull-up-practice-exercise-design.md` (rules: `docs/game-rules/training/exercises/bull-up-practice.md`). Precedent commit: `423242b` (Bullseye Checkouts, #586) — every file touched here has a `bullseye-checkout` sibling to read first.

## Global Constraints

- Type key `BULL_UP`; ruleset key `BULL_UP_V1`; template name "Bull Up Practice"; step header "Bull up practice"; panel key `bull-up`.
- Config `{}` — `z.object({}).strict()`. `{}` passes `chk_configuration_not_empty` (`jsonb_typeof = 'object'`, `database/migrations/0007_constraints.sql`) and `has_default_configuration` (`IS NOT NULL`, migration `0040`).
- Every dart: intended `25` / `INNER_BULL` via `doubleTargetIntent({ kind: "BULL" })`. `score` is the board score.
- One `EXERCISE_BLOCK` stage; **one turn per dart**, `completedAt` stamped on write.
- Tier: `INNER_BULL` → `BULLSEYE`; `OUTER_BULL` → `OUTER_BULL`; anything else (incl. `MISS`) → `MISS`. Bulls = bullseyes + outer bulls.
- Rates derived at display (`accuracyDisplay`), `—` at zero throws; never in state, never stored.
- Capture pair `ANALYTICS` + `VISUAL_BOARD` (D277) — via `DART_EXERCISE_TYPE_KEYS`.
- Seed IDs: type `0199a000-0000-7000-8000-000000000009`, ruleset `0199a100-0000-7000-8000-000000000008`, template `0199b000-0000-7000-8000-00000000000f`.
- Decision id: `D362` — re-run `bash scripts/next-decision-id.sh` before the PR.
- Never modify applied migrations; no migration in this plan.
- All commands run from `app/` unless shown otherwise. `npm test -- <path>` runs one file.

## Review Focus

1. **One-dart turns** — every `record()` opens a fresh turn; no turn ever holds two darts (Task 2 "writes each throw as its own completed turn").
2. **Undo** — pops the dart and its now-empty turn (`undoLastDart`), then a re-throw opens a fresh turn with sequence reused (Task 2 "undo removes the throw and its turn").
3. **Expiry** — no unjudged throw exists; `expireTimer()` only flips status (Task 2 "expiry judges every throw").
4. **Zero-throw rates** — panel and summary show `—`, never `NaN` (Task 5).

---

### Task 1: Config schema

**Files:**
- Modify: `app/src/lib/training/exercises/rulesets/types.ts` (key union ~line 17, new schema after `BullseyeCheckoutConfigData` ~line 207, `EXERCISE_RULESET_CONFIGS`)
- Test: `app/tests/lib/training/exercises/rulesets/types.test.ts`

**Interfaces:**
- Produces: `BullUpV1Config`, `type BullUpConfigData = Record<string, never>` (inferred; re-exported by `@lib/types` via the existing `export *` chain), `"BULL_UP_V1"` in `ExerciseRulesetVersionKey`, `EXERCISE_RULESET_CONFIGS.BULL_UP_V1`.

- [ ] **Step 1: Write the failing test** — add `BullUpV1Config` to the import list, append:

```ts
describe("BullUpV1Config", () => {
  it("accepts the empty configuration — the target is always the bull", () => {
    expect(BullUpV1Config.safeParse({}).success).toBe(true);
  });

  it("rejects any key", () => {
    expect(BullUpV1Config.safeParse({ target: 25 }).success).toBe(false);
    expect(BullUpV1Config.safeParse({ startScore: 81 }).success).toBe(false);
  });

  it("is registered under BULL_UP_V1", () => {
    expect(EXERCISE_RULESET_CONFIGS.BULL_UP_V1).toBe(BullUpV1Config);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/lib/training/exercises/rulesets/types.test.ts`
Expected: FAIL — `BullUpV1Config` is not exported.

- [ ] **Step 3: Implement**

```ts
  | "BULLSEYE_CHECKOUT_V1"
  | "BULL_UP_V1";
```

After `BullseyeCheckoutConfigData`:

```ts
/**
 * Bull Up v1 ("Bull Up Practice"): one dart per throw, always at the bull
 * (`docs/game-rules/training/exercises/bull-up-practice.md`). Nothing is
 * configurable — duration is the routine step's — so the config is the
 * empty object.
 */
export const BullUpV1Config = z.object({}).strict();

export type BullUpConfigData = z.infer<typeof BullUpV1Config>;
```

In `EXERCISE_RULESET_CONFIGS`:

```ts
  BULL_UP_V1: BullUpV1Config,
```

- [ ] **Step 4: Run to verify it passes** — same command. Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(training): BullUpV1Config schema"`

---

### Task 2: Engine

**Files:**
- Modify: `app/src/modules/training/exercises/types.ts` (append `BullUpState`, `BullUpTier`)
- Create: `app/src/modules/training/exercises/bull-up.engine.module.ts`
- Test: `app/tests/modules/training/exercises/bull-up.engine.module.test.ts`

**Interfaces:**
- Consumes: `BullUpConfigData`, `BullUpV1Config` (Task 1); `appendObservedDart`, `cloneTurns`, `doubleTargetIntent`, `exerciseBlockStage`, `openOrCreateTurn`, `undoLastDart` (`@modules/game/turn-log.module`).
- Produces: `BullUpEngine`, `bullUpEngineFactory`, `foldBullUpState(facts, complete)`, `BullUpState`, `BullUpTier`.

- [ ] **Step 1: State type** — append to `types.ts`:

```ts
/** One throw's outcome in Bull Up Practice. */
export type BullUpTier = "BULLSEYE" | "OUTER_BULL" | "MISS";

/**
 * Bull Up ("Bull Up Practice") state, derived by replaying `facts()`
 * (`foldBullUpState`). Every throw is one dart and is judged when it lands:
 * `bulls` counts bullseyes and outer bulls together. `lastTier` is `null`
 * before the first throw. Rates are derived at display, not held here.
 */
export type BullUpState = {
  throws: number;
  bullseyes: number;
  bulls: number;
  lastTier: BullUpTier | null;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};
```

`dartsThrown` equals `throws`; it stays because `routinePlay.dartsThrown()` reads it from every `activeDartEngine()`.

- [ ] **Step 2: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  BullUpEngine,
  bullUpEngineFactory,
  foldBullUpState,
} from "@modules/training/exercises/bull-up.engine.module";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import type { DartObservation } from "@modules/types";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { EventsBatchRequest } from "@pages/api/sessions/types";

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const MISS = dart(null, "MISS");
const S20 = dart(20, "SINGLE");
const BULL = dart(25, "INNER_BULL");
const OUTER = dart(25, "OUTER_BULL");

function play(engine: BullUpEngine, darts: DartObservation[]) {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

describe("BullUpEngine", () => {
  it("starts with no throws and no last tier", () => {
    expect(bullUpEngineFactory.create({}).state()).toEqual({
      throws: 0,
      bullseyes: 0,
      bulls: 0,
      lastTier: null,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("counts a bullseye as a bullseye and a bull", () => {
    const state = play(new BullUpEngine({}), [BULL]);
    expect(state).toMatchObject({ throws: 1, bullseyes: 1, bulls: 1, lastTier: "BULLSEYE" });
  });

  it("counts an outer bull as a bull only", () => {
    const state = play(new BullUpEngine({}), [OUTER]);
    expect(state).toMatchObject({ throws: 1, bullseyes: 0, bulls: 1, lastTier: "OUTER_BULL" });
  });

  it("counts any other hit and off-board as a miss", () => {
    const state = play(new BullUpEngine({}), [S20, MISS]);
    expect(state).toMatchObject({ throws: 2, bullseyes: 0, bulls: 0, lastTier: "MISS" });
  });

  it("aims every dart at the inner bull and records the board score", () => {
    const engine = new BullUpEngine({});
    play(engine, [BULL, OUTER, S20, MISS]);
    const darts = engine.facts().turns.flatMap((t) => t.darts);
    expect(darts.map((d) => [d.intendedTargetNumber, d.intendedZoneKey])).toEqual(
      Array(4).fill([25, "INNER_BULL"]),
    );
    expect(darts.map((d) => d.score)).toEqual([50, 25, 20, 0]);
  });

  it("writes each throw as its own completed turn", () => {
    const engine = new BullUpEngine({});
    play(engine, [BULL, OUTER, MISS]);
    const turns = engine.facts().turns;
    expect(turns).toHaveLength(3);
    expect(turns.map((t) => t.darts.length)).toEqual([1, 1, 1]);
    expect(turns.map((t) => t.sequence)).toEqual([1, 2, 3]);
    expect(turns.every((t) => t.completedAt !== null)).toBe(true);
    expect(turns.map((t) => t.totalScore)).toEqual([50, 25, 0]);
    expect(engine.facts().stages).toEqual([
      expect.objectContaining({ stageTypeKey: "EXERCISE_BLOCK", sequence: 1 }),
    ]);
  });

  it("expiry judges every throw — none is left open", () => {
    const engine = new BullUpEngine({});
    play(engine, [BULL, OUTER]);
    engine.expireTimer();
    expect(engine.isComplete()).toBe(true);
    expect(engine.state()).toMatchObject({ throws: 2, bulls: 2, status: "COMPLETE" });
  });

  it("refuses a throw once complete", () => {
    const engine = new BullUpEngine({});
    engine.expireTimer();
    expect(() => engine.record(BULL)).toThrow();
  });

  it("undo un-completes first, then removes the throw and its turn", () => {
    const engine = new BullUpEngine({});
    play(engine, [BULL, OUTER]);
    engine.expireTimer();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.facts().turns).toHaveLength(2);

    expect(engine.undo()).toBe(true);
    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.state()).toMatchObject({ throws: 1, lastTier: "BULLSEYE" });

    engine.record(MISS);
    expect(engine.facts().turns.map((t) => t.sequence)).toEqual([1, 2]);
  });

  it("undo on an empty log returns false", () => {
    expect(new BullUpEngine({}).undo()).toBe(false);
  });

  it("rehydrates from prior facts and keeps counting", () => {
    const first = new BullUpEngine({});
    play(first, [BULL, MISS]);
    const resumed = new BullUpEngine({}, first.facts());
    expect(resumed.state()).toEqual(first.state());
    resumed.record(OUTER);
    expect(resumed.state()).toMatchObject({ throws: 3, bullseyes: 1, bulls: 2 });
  });

  it("foldBullUpState matches the live state", () => {
    const engine = new BullUpEngine({});
    play(engine, [BULL, OUTER, S20]);
    expect(foldBullUpState(engine.facts(), false)).toEqual(engine.state());
  });

  it("rejects a non-empty config", () => {
    expect(() => new BullUpEngine({ target: 25 } as never)).toThrow();
  });

  it("is registered under BULL_UP_V1", () => {
    expect(getDartExerciseEngineFactory("BULL_UP_V1")).toBe(bullUpEngineFactory);
  });

  it("produces facts the events batch accepts", () => {
    const engine = new BullUpEngine({});
    play(engine, [BULL, OUTER, MISS]);
    expect(EventsBatchRequest.safeParse(buildEventsBatch(engine.facts())).success).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- tests/modules/training/exercises/bull-up.engine.module.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement** `bull-up.engine.module.ts`:

```ts
import type { BullUpConfigData } from "@lib/types";
import { BullUpV1Config } from "@lib/training/exercises/rulesets/types";
import type { DartObservation, EngineFacts, TurnFact } from "@modules/types";
import {
  appendObservedDart,
  cloneTurns,
  doubleTargetIntent,
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
import type { BullUpState, BullUpTier } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "BULL_UP_V1" as const;
const STAGE = exerciseBlockStage();
/** Every throw is aimed at the bullseye. */
const BULL_INTENT = doubleTargetIntent({ kind: "BULL" });

function tierOf(turn: TurnFact): BullUpTier {
  const zone = turn.darts[0]?.hitZoneKey;
  if (zone === "INNER_BULL") return "BULLSEYE";
  if (zone === "OUTER_BULL") return "OUTER_BULL";
  return "MISS";
}

/**
 * Folds the fact log into Bull Up state — a pure function of
 * `facts`/`complete`, mirroring `foldBullseyeCheckoutState`. One turn is one
 * throw, judged when written.
 */
export function foldBullUpState(
  facts: EngineFacts,
  complete: boolean,
): BullUpState {
  const initial: BullUpState = {
    throws: 0,
    bullseyes: 0,
    bulls: 0,
    lastTier: null,
    dartsThrown: 0,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
  return facts.turns.reduce((state, turn) => {
    const tier = tierOf(turn);
    return {
      ...state,
      throws: state.throws + 1,
      bullseyes: state.bullseyes + (tier === "BULLSEYE" ? 1 : 0),
      bulls: state.bulls + (tier === "MISS" ? 0 : 1),
      lastTier: tier,
      dartsThrown: state.dartsThrown + turn.darts.length,
    };
  }, initial);
}

/**
 * Bull Up ("Bull Up Practice"): one dart per throw, always at the bull
 * (`docs/game-rules/training/exercises/bull-up-practice.md`). One
 * `TurnFact` is one throw of one dart, complete when written. Clockless:
 * completion arrives only through `expireTimer()` (D264).
 */
export class BullUpEngine implements DartExerciseEngine<BullUpState> {
  readonly exerciseRulesetVersionKey = EXERCISE_RULESET_VERSION_KEY;

  private readonly turns: TurnFact[];
  private complete = false;

  constructor(config: BullUpConfigData, prior?: EngineFacts) {
    BullUpV1Config.parse(config);
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): BullUpState {
    return foldBullUpState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.complete,
    );
  }

  record(observation: DartObservation): BullUpState {
    if (this.complete) {
      throw new Error(
        "Cannot record a dart once the exercise is complete; undo first to correct it.",
      );
    }
    const turn = openOrCreateTurn(
      this.turns,
      STAGE.clientKey,
      SOLO_PARTICIPANT_REF,
      () => false,
    );
    appendObservedDart(turn, observation, BULL_INTENT);
    turn.completedAt = new Date().toISOString();
    return this.deriveState();
  }

  undo(): boolean {
    if (this.complete) {
      this.complete = false;
      return true;
    }
    return undoLastDart(this.turns);
  }

  /** The step's countdown elapsed — the clock lives in the controller (D264). */
  expireTimer(): void {
    this.complete = true;
  }

  isComplete(): boolean {
    return this.complete;
  }

  state(): BullUpState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const bullUpEngineFactory: DartExerciseEngineFactory<
  BullUpConfigData,
  BullUpState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  create(config: BullUpConfigData, prior?: EngineFacts) {
    return new BullUpEngine(config, prior);
  },
};

registerDartExerciseEngineFactory(bullUpEngineFactory);
```

`exerciseRulesetVersionKey` is typed `ExerciseRulesetVersionKey` (`interfaces.ts`), which Task 1 already widened.

- [ ] **Step 5: Run to verify it passes** — same command. Expected: PASS.

- [ ] **Step 6: Commit** — `git commit -m "feat(training): BullUpEngine (BULL_UP_V1)"`

---

### Task 3: Server — validator, registry, step enums, capture pair

**Files:**
- Create: `app/src/services/exercise-rulesets/bull-up/bull-up.validator.ts`
- Modify: `app/src/services/exercise-rulesets/registry.ts` (`REGISTRY`, `DART_WRITING_RULESET_VERSION_KEYS`)
- Modify: `app/src/services/types.ts` (`TrainingStepResolved.exerciseTypeKey`)
- Modify: `app/src/pages/api/training-sessions/types.ts` (both `exerciseTypeKey` enums)
- Modify: `app/src/services/training-session.service.ts` (`DART_EXERCISE_TYPE_KEYS` + its doc comment)
- Test: `app/tests/services/exercise-rulesets/bull-up.validator.test.ts`, `registry.test.ts`, `app/tests/pages/api/training-sessions/types.test.ts`, `app/tests/services/training-session.service.test.ts`

- [ ] **Step 1: Failing tests** — each mirrors its `BULLSEYE_CHECKOUT` sibling:
  - validator: `{}` → `{ ok: true, config: {} }`; `{ target: 25 }` → `ok: false` with an issue string.
  - `registry.test.ts:52` sibling: `getExerciseRulesetValidator("BULL_UP_V1")` is `bullUpValidator`; `registry.test.ts:72` sibling: `exerciseRulesetWritesDarts("BULL_UP_V1")` is `true`.
  - `types.test.ts:116` sibling: accepts a `BULL_UP` step (both schemas).
  - `training-session.service.test.ts:661` sibling: "inserts BULL_UP under the ANALYTICS/VISUAL_BOARD capture pair", with `exerciseRulesetVersionKey: "BULL_UP_V1"` and `defaultConfiguration: {}`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- tests/services/exercise-rulesets tests/pages/api/training-sessions/types.test.ts tests/services/training-session.service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** — validator:

```ts
import { BullUpV1Config } from "@lib/training/exercises/rulesets/types";
import type { ExerciseRulesetValidator } from "@services/interfaces";
import type { ExerciseConfigValidationResult } from "@services/types";

/**
 * Bull Up v1 asserts only that the config parses — the empty object; the
 * target is always the bull
 * (`docs/game-rules/training/exercises/bull-up-practice.md`).
 */
export const bullUpValidator: ExerciseRulesetValidator = {
  validateConfig({ config }): ExerciseConfigValidationResult {
    const parsed = BullUpV1Config.safeParse(config);
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

Then add `BULL_UP_V1: bullUpValidator` and `"BULL_UP_V1"` in `registry.ts`; `| "BULL_UP"` in `services/types.ts`; `"BULL_UP"` before `"GAME"` in both API enums; `"BULL_UP"` in `DART_EXERCISE_TYPE_KEYS`, and "and Bull Up" in its doc comment's list.

- [ ] **Step 4: Run to verify they pass** — same command. Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(training): server wiring for BULL_UP_V1"`

---

### Task 4: Seed `0030` and its verification script

**Files:**
- Create: `database/seeds/0030_bull_up_exercise_type.sql`
- Create: `database/verification/0030_bull_up_seed_checks.sql`

- [ ] **Step 1: Seed** — copy `0029_bullseye_checkout_exercise_type.sql` and change only:
  - header: seed name, `BULL_UP`, rules path `bull-up-practice.md`; last paragraph → "The default configuration is the empty object: the target is always the bull and duration is the routine step's."
  - `exercise_types`: id `0199a000-0000-7000-8000-000000000009`, key `BULL_UP`, name `Bull Up`, description `One dart at the bull, retrieve, throw again: the throw that decides who starts a match.`
  - `exercise_ruleset_versions`: id `0199a100-0000-7000-8000-000000000008`, type id above, key `BULL_UP_V1`, description `Initial bull up ruleset: one dart per throw at the bull; bullseye, outer bull or miss.`
  - `exercise_templates`: id `0199b000-0000-7000-8000-00000000000f`, type id above, subselect `BULL_UP_V1`, name `Bull Up Practice`, description `One dart at the bull, again and again. How many bullseyes before the time runs out?`, `default_configuration` `'{}'::jsonb`.

- [ ] **Step 2: Verification** — copy `0029_bullseye_checkout_seed_checks.sql`; replace `BULLSEYE_CHECKOUT` → `BULL_UP`, seed file name, and in check 3 the name `the system template pins BULL_UP_V1 with the empty configuration` and `t.default_configuration = '{}'::jsonb`.

- [ ] **Step 3: Apply and verify** (repo root; needs `DATABASE_URL`):

```bash
cd app && npm run db:status && npm run db:seed && npm run db:verify
```

Expected: `0030_bull_up_seed_checks.sql` reports `ALL 4 CHECKS PASSED`. No `DATABASE_URL` → say so in the completion report; do not claim this step.

- [ ] **Step 4: Commit** — `git commit -m "feat(db): seed 0030 BULL_UP exercise type"`

---

### Task 5: Routine play — summary, adapter, controller, panel

**Files:**
- Modify: `app/src/modules/training/routines/routine-summary.module.ts` (`summariseBullUp`)
- Create: `app/src/lib/training/routines/adapters/bull-up.adapter.ts`
- Modify: `app/src/lib/training/routines/adapters/types.ts` (`StepAdapterKey`, `StepPanel`), `step-adapter.registry.ts`
- Modify: `app/src/lib/training/routines/types.ts` (`RoutinePlayContext`), `routine-play.data.ts`
- Create: `app/src/components/layout/training/exercises/BullUpPanel.astro`
- Modify: `app/src/pages/training/routines/play/index.astro`, `app/src/components/layout/training/exercises/ExerciseBoardInputPanel.astro` (doc comment list)
- Test: `routine-summary.module.test.ts`, `adapters/bull-up.adapter.test.ts`, `adapters/step-adapter.registry.test.ts`, `routine-play.data.test.ts`

- [ ] **Step 1: Failing tests**
  - Summary: zero throws → rows `Throws 0`, `Bullseyes 0`, `Bulls 0`, `Bullseye rate —`, `Bull rate —`; after `[BULL, OUTER, MISS, MISS]` → `4`, `1`, `2`, `accuracyDisplay(1, 4)`, `accuracyDisplay(2, 4)`; `stepKey: "BULL_UP"`, `label: "Bull Up Practice"`.
  - Adapter: mirror `adapters/bullseye-checkout.adapter.test.ts` with `configuration: {}` and `exerciseTypeKey: "BULL_UP"` — `open` sets `ctx.bullUpEngine` and starts the timer; `facts` returns the engine's facts; `summarise` returns `summariseBullUp`; `close` nulls the slot.
  - Registry: `step-adapter.registry.test.ts:21`/`:34` siblings — `BULL_UP` present, header `"Bull up practice"`.
  - Controller (`routine-play.data.test.ts`, mirror `describe("routinePlay — Bullseye Checkouts")` at line 1472): after open, `bullUpBullseyes()` 0, `bullUpThrows()` 0, `bullUpBulls()` 0, `bullUpLastResult()` `"—"`, both rates `"—"`; record BULL → bullseyes 1, last `"Bullseye"`, bullseye rate `"100.00%"`; record OUTER → bulls 2, last `"Outer bull"`; record S20 → last `"Miss"`. `previewSegments()`: inner and outer bull `hit`, anything else `miss`. Step timeout calls `bullUpEngine.expireTimer()`.

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- tests/modules/training/routines tests/lib/training/routines`
Expected: FAIL.

- [ ] **Step 3: Summary** — in `routine-summary.module.ts` import `BullUpState` and add after `summariseBullseyeCheckout`:

```ts
/**
 * Bull Up Practice's result is how often a single cold dart found the bull,
 * split by ring. Every throw is judged on landing; none is left open.
 */
export function summariseBullUp(state: BullUpState): RoutineStepSummary {
  const rate = (hits: number) =>
    state.throws === 0 ? NO_VALUE : accuracyDisplay(hits, state.throws);
  return {
    stepKey: "BULL_UP",
    label: "Bull Up Practice",
    rows: [
      { label: "Throws", value: String(state.throws) },
      { label: "Bullseyes", value: String(state.bullseyes) },
      { label: "Bulls", value: String(state.bulls) },
      { label: "Bullseye rate", value: rate(state.bullseyes) },
      { label: "Bull rate", value: rate(state.bulls) },
    ],
  };
}
```

- [ ] **Step 4: Adapter** — `bull-up.adapter.ts`:

```ts
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { BullUpEngine } from "@modules/training/exercises/bull-up.engine.module";
import { summariseBullUp } from "@modules/training/routines/routine-summary.module";
import type { BullUpConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const bullUpAdapter: StepAdapter = {
  key: "BULL_UP",
  headerLabel: "Bull up practice",
  panel: "bull-up",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("BULL_UP_V1");
    const created = factory?.create(result.configuration as BullUpConfigData);
    ctx.bullUpEngine = created instanceof BullUpEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.bullUpEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.bullUpEngine) return null;
    return summariseBullUp(ctx.bullUpEngine.state());
  },
  close(ctx) {
    ctx.bullUpEngine = null;
  },
};
```

Add `| "BULL_UP"` to `StepAdapterKey`, `| "bull-up"` to `StepPanel`, and `BULL_UP: bullUpAdapter` (with import) to `STEP_ADAPTERS`.

- [ ] **Step 5: Controller** — follow every `bullseyeCheckout` hunk of commit `423242b` in `routine-play.data.ts` and `routines/types.ts`:
  - type import `BullUpEngine`; slot `bullUpEngine: null`; dispatch `else if (self.bullUpEngine) self.recordBullUpDart(observation);`; `| BullUpEngine` and `this.bullUpEngine ??` in `activeDartEngine()`; `this.bullUpEngine?.expireTimer();` on step timeout; `recordBullUpDart`.
  - `previewSegments()` — prepend a branch and extend the doc comment ("Bull Up Practice: either bull is a hit."):

```ts
      const isHit = this.bullUpEngine
        ? (dart: DartFact) =>
            dart.hitZoneKey === "INNER_BULL" || dart.hitZoneKey === "OUTER_BULL"
        : this.bullseyeCheckoutEngine
          ? /* existing chain, re-indented */
```

  - Readouts:

```ts
    bullUpThrows(this: RoutinePlayContext): number {
      return this.bullUpEngine?.state().throws ?? 0;
    },

    bullUpBullseyes(this: RoutinePlayContext): number {
      return this.bullUpEngine?.state().bullseyes ?? 0;
    },

    bullUpBulls(this: RoutinePlayContext): number {
      return this.bullUpEngine?.state().bulls ?? 0;
    },

    bullUpLastResult(this: RoutinePlayContext): string {
      const last = this.bullUpEngine?.state().lastTier ?? null;
      if (last === null) return "—";
      return last === "BULLSEYE" ? "Bullseye" : last === "OUTER_BULL" ? "Outer bull" : "Miss";
    },

    bullUpBullseyeRate(this: RoutinePlayContext): string {
      const state = this.bullUpEngine?.state();
      return !state || state.throws === 0
        ? "—"
        : accuracyDisplay(state.bullseyes, state.throws);
    },

    bullUpBullRate(this: RoutinePlayContext): string {
      const state = this.bullUpEngine?.state();
      return !state || state.throws === 0
        ? "—"
        : accuracyDisplay(state.bulls, state.throws);
    },
```

  - Matching signatures in `RoutinePlayContext`.

- [ ] **Step 6: Panel** — `BullUpPanel.astro`, same shape as `BullseyeCheckoutPanel.astro`: `score="bullUpBullseyes()"`; `StatRow`s Last `bullUpLastResult()`, Throws `bullUpThrows()`, Bulls `bullUpBulls()`, Bullseye rate `bullUpBullseyeRate()`, Bull rate `bullUpBullRate()`, Time `formattedStepRemaining()`; then `VisitPreview` and `ExerciseBoardInputPanel`. In `play/index.astro` import it and add:

```astro
    <template
      x-if="!loading && adapter?.panel === 'bull-up' && bullUpEngine"
    >
      <BullUpPanel />
    </template>
```

Add "Bull Up Practice" to `ExerciseBoardInputPanel.astro`'s doc comment list.

- [ ] **Step 7: Run to verify they pass** — same command, then `npm test` and `npx astro check`. Expected: PASS, 0 errors.

- [ ] **Step 8: Commit** — `git commit -m "feat(training): Bull Up Practice routine play"`

---

### Task 6: Docs, decision, context maintenance

**Files:** as commit `423242b`'s docs hunks, for Bull Up.

- [ ] **Step 1:** `docs/architecture/09-Training/01-Routines.md` — add `BULL_UP` to the §3.4 type list and a `## Bull Up Practice (Bull Up)` section after `## Bullseye Checkouts`, same shape: configuration block (`duration: 5m`), one-paragraph rules, rules link, **Implemented** paragraph (`BULL_UP_V1`, engine path, seed `0030`, one dart per turn, intent `25`/`INNER_BULL`, capture pair D277, routine step only, D362).
- [ ] **Step 2:** `decisions/game-engine.md` — append **D362 — Bull Up Practice is its own exercise type with one-dart turns** (Status Accepted, 2026-09-24; Decision: type/ruleset/template, one `turns` row per dart, every dart `25`/`INNER_BULL`, tiers, `{}` config, routine step only; Reason: no engine models a one-dart visit — every other exercise judges three-dart visits; Target Scoring's bull target builds chains; Consequences: first one-dart-turn exercise, distance readout and standalone entry stay V2+; Supersedes: none). Run `bash scripts/next-decision-id.sh` first; if not `D362`, use its value throughout.
- [ ] **Step 3:** `docs/architecture/00-File-Inventory.md` — rows for seed `0030`, verification `0030`, engine, validator; extend the adapter and `step-adapter.registry.ts` rows; `09-Training/01-Routines.md` row token estimate; `decisions/game-engine.md` row count 69 and D362 mention. ISO dates on every changed row.
- [ ] **Step 4:** Seed ranges `0001`–`0030` in `docs/CLAUDE.md` and `docs/architecture/README.md` (+ `updated:`); `database/README.md` seed list `30.` and verification row.
- [ ] **Step 5:** `docs/architecture/00-Context-Map-History.md` — `1.124.0` entry, same shape as `1.123.0`.
- [ ] **Step 6:** `app/src/modules/training/CLAUDE.md` exercise engine list gains `bull-up`.
- [ ] **Step 7:** `docs/game-rules/training/exercises/bull-up-practice.md` — `Current version: V1 (shipped YYYY-MM-DD)`.
- [ ] **Step 8:** Gates — `run-all-gates` skill; at least `bash scripts/check-game-rules.sh`, `check-decision-ids.sh`, `check-doc-links.sh`, `check-context-map.sh`, `check-doc-sync.sh`, `check-file-locations.sh`, `check-game-engines.sh`, `check-test-coverage.sh`; `validate-app` skill for `app/`. Every script PASS.
- [ ] **Step 9: Commit** — `git commit -m "docs: Bull Up Practice exercise (D362)"`; then `finishing-a-dart-branch` (push + PR).
