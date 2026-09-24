# Bullseye Checkouts Exercise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `BULLSEYE_CHECKOUT` ("Bullseye Checkouts") as a routine-step exercise: each visit starts at 81, darts 1–2 free aim, dart 3 aimed at the bull; a checkout is setup total 31 + inner bull.

**Architecture:** New `DartExerciseEngine` (`BullseyeCheckoutEngine`) mirroring `ScoreThresholdEngine` — a pure fold over the turn log, clockless (D264). Server gets a parse-only validator and enum entries; seed `0029` puts the template in `v_exercise_template_catalog`; the routine play page gets an adapter, readouts and a panel. No schema change.

**Tech Stack:** TypeScript, Zod, Vitest, Astro + Alpine.js, PostgreSQL seeds.

**Spec:** `docs/superpowers/specs/2026-09-24-bullseye-checkout-exercise-design.md` (rules: `docs/game-rules/training/exercises/bullseye-checkout.md`). Precedent commit: `1f051a3` (65 or More) — every file touched here has a `score-threshold` sibling to read.

## Global Constraints

- Type key `BULLSEYE_CHECKOUT`; ruleset key `BULLSEYE_CHECKOUT_V1`; template name "Bullseye Checkouts"; step header "Bullseye checkouts"; panel key `bullseye-checkout`.
- Config `{ startScore: 81 }` — `z.literal(81)`, `.strict()`. Setup target `startScore − 50`, derived, never stored.
- Checkout = darts 1+2 board scores sum to exactly `startScore − 50` **and** dart 3 `hitZoneKey === "INNER_BULL"`. Outer bull never finishes.
- Darts 1–2: intended target/zone `null`. Dart 3: intended `25` / `INNER_BULL`, always — also after missed setup darts.
- `score` is the board score. One `EXERCISE_BLOCK` stage; one turn per three-dart visit.
- Visit never ends early; a visit with < 3 darts at timer expiry is not judged.
- Capture pair `ANALYTICS` + `VISUAL_BOARD` (D277) — via `DART_EXERCISE_TYPE_KEYS`.
- Seed IDs: type `0199a000-0000-7000-8000-000000000008`, ruleset `0199a100-0000-7000-8000-000000000007`, template `0199b000-0000-7000-8000-00000000000e`.
- Never modify applied migrations; no migration in this plan.
- All commands run from `app/` unless shown otherwise. `npm test -- <path>` runs one file.

## Review Focus

1. **Missed setup darts** — MISS, MISS, then dart 3: still recorded with bull intent, visit judged as a miss (Task 2 test "keeps the bull intent on dart 3 after missed setup darts").
2. **Undo across the finishing dart** — undo dart 3, re-record it: bull intent reapplied and the visit re-judged (Task 2 test "re-applies the bull intent when dart 3 is undone and re-thrown").
3. **Resume mid-visit** — rehydrate with 2 darts, record dart 3: bull intent from the rehydrated turn length (Task 2 test "gives the bull intent to dart 3 after rehydrating mid-visit").
4. **Overshot setup** — T20 + T20 leaves −39: Left reads `-39`, dart 3 still thrown, no checkout (Task 2 test "lets Left go negative when the setup overshoots").
5. **Bull as a setup dart** — outer bull 25 + S6 = 31 then inner bull is a checkout; inner bull on dart 1 is setup score 50 (Task 2 test "counts bulls on setup darts at board value").

---

### Task 1: Config schema

**Files:**
- Modify: `app/src/lib/training/exercises/rulesets/types.ts` (key union ~line 16, new schema after `ScoreThresholdV1Config` ~line 188, `EXERCISE_RULESET_CONFIGS` ~line 199)
- Test: `app/tests/lib/training/exercises/rulesets/types.test.ts`

**Interfaces:**
- Produces: `BullseyeCheckoutV1Config` (Zod schema), `type BullseyeCheckoutConfigData = { startScore: 81 }` (re-exported by `@lib/types` through the existing `export *` chain), `"BULLSEYE_CHECKOUT_V1"` in `ExerciseRulesetVersionKey`, `EXERCISE_RULESET_CONFIGS.BULLSEYE_CHECKOUT_V1`.

- [ ] **Step 1: Write the failing test** — add `BullseyeCheckoutV1Config` to the file's import list from `@lib/training/exercises/rulesets/types`, then append:

```ts
describe("BullseyeCheckoutV1Config", () => {
  it("accepts the 81 start score", () => {
    expect(BullseyeCheckoutV1Config.safeParse({ startScore: 81 }).success).toBe(
      true,
    );
  });

  it("rejects any other start score — V1 is 81 only", () => {
    for (const startScore of [61, 80, 82, 100, "81"]) {
      expect(BullseyeCheckoutV1Config.safeParse({ startScore }).success).toBe(
        false,
      );
    }
  });

  it("rejects a missing start score and an unknown key", () => {
    expect(BullseyeCheckoutV1Config.safeParse({}).success).toBe(false);
    expect(
      BullseyeCheckoutV1Config.safeParse({ startScore: 81, threshold: 65 })
        .success,
    ).toBe(false);
  });

  it("is registered under BULLSEYE_CHECKOUT_V1", () => {
    expect(EXERCISE_RULESET_CONFIGS.BULLSEYE_CHECKOUT_V1).toBe(
      BullseyeCheckoutV1Config,
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/lib/training/exercises/rulesets/types.test.ts`
Expected: FAIL — `BullseyeCheckoutV1Config` is not exported.

- [ ] **Step 3: Implement** — in `types.ts`:

Extend the union:

```ts
  | "SCORE_THRESHOLD_V1"
  | "BULLSEYE_CHECKOUT_V1";
```

Add after `ScoreThresholdConfigData`:

```ts
/**
 * Bullseye Checkout v1 ("Bullseye Checkouts"): every visit starts at
 * `startScore`; a checkout is a setup of `startScore − 50` on darts 1–2 and
 * the inner bull on dart 3
 * (`docs/game-rules/training/exercises/bullseye-checkout.md`). V1 accepts
 * 81 only; the start score still lives here so a later ruleset widens the
 * number without a new exercise type.
 */
export const BullseyeCheckoutV1Config = z
  .object({
    startScore: z.literal(81),
  })
  .strict();

export type BullseyeCheckoutConfigData = z.infer<
  typeof BullseyeCheckoutV1Config
>;
```

Add to `EXERCISE_RULESET_CONFIGS`:

```ts
  BULLSEYE_CHECKOUT_V1: BullseyeCheckoutV1Config,
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- tests/lib/training/exercises/rulesets/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/training/exercises/rulesets/types.ts app/tests/lib/training/exercises/rulesets/types.test.ts
git commit -m "feat(training): BullseyeCheckoutV1Config"
```

---

### Task 2: Engine

**Files:**
- Create: `app/src/modules/training/exercises/bullseye-checkout.engine.module.ts`
- Modify: `app/src/modules/training/exercises/types.ts` (append state type)
- Test: `app/tests/modules/training/exercises/bullseye-checkout.engine.module.test.ts`

**Interfaces:**
- Consumes: `BullseyeCheckoutV1Config`, `BullseyeCheckoutConfigData` (Task 1); `appendObservedDart`, `cloneTurns`, `doubleTargetIntent`, `exerciseBlockStage`, `openOrCreateTurn`, `undoLastDart` (`@modules/game/turn-log.module`); `registerDartExerciseEngineFactory` (`./dart-engine.registry`); `SOLO_PARTICIPANT_REF`.
- Produces:
  - `type BullseyeCheckoutState = { startScore: number; checkouts: number; visits: number; lastVisitCheckout: boolean | null; currentLeft: number; dartsInVisit: number; dartsThrown: number; status: "IN_PROGRESS" | "COMPLETE" }`
  - `foldBullseyeCheckoutState(facts: EngineFacts, config: BullseyeCheckoutConfigData, complete: boolean): BullseyeCheckoutState`
  - `class BullseyeCheckoutEngine implements DartExerciseEngine<BullseyeCheckoutState>` — `record(observation)`, `undo()`, `expireTimer()`, `isComplete()`, `state()`, `facts()`
  - `bullseyeCheckoutEngineFactory` registered under `"BULLSEYE_CHECKOUT_V1"`

- [ ] **Step 1: Write the failing test** — create the test file:

```ts
import { describe, expect, it } from "vitest";
import {
  BullseyeCheckoutEngine,
  bullseyeCheckoutEngineFactory,
  foldBullseyeCheckoutState,
} from "@modules/training/exercises/bullseye-checkout.engine.module";
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import type { BullseyeCheckoutConfigData } from "@lib/types";
import type { DartObservation } from "@modules/types";
import { buildEventsBatch } from "@modules/game/events.payload.module";
import { EventsBatchRequest } from "@pages/api/sessions/types";

const CONFIG: BullseyeCheckoutConfigData = { startScore: 81 };

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartObservation["hitZoneKey"],
): DartObservation {
  return { hitTargetNumber, hitZoneKey, locationX: null, locationY: null };
}

const MISS = dart(null, "MISS");
const S19 = dart(19, "SINGLE");
const S12 = dart(12, "SINGLE");
const S11 = dart(11, "SINGLE");
const S13 = dart(13, "SINGLE");
const T20 = dart(20, "TREBLE");
const BULL = dart(25, "INNER_BULL");
const OUTER = dart(25, "OUTER_BULL");

function play(
  engine: BullseyeCheckoutEngine,
  darts: DartObservation[],
): ReturnType<BullseyeCheckoutEngine["state"]> {
  darts.forEach((d) => engine.record(d));
  return engine.state();
}

function intents(engine: BullseyeCheckoutEngine) {
  return engine
    .facts()
    .turns.flatMap((turn) => turn.darts)
    .map((d) => [d.intendedTargetNumber, d.intendedZoneKey]);
}

describe("BullseyeCheckoutEngine", () => {
  it("starts at 81 with no visits and no last result", () => {
    const engine = bullseyeCheckoutEngineFactory.create(CONFIG);

    expect(engine.state()).toEqual({
      startScore: 81,
      checkouts: 0,
      visits: 0,
      lastVisitCheckout: null,
      currentLeft: 81,
      dartsInVisit: 0,
      dartsThrown: 0,
      status: "IN_PROGRESS",
    });
  });

  it("counts a 31 setup and the inner bull as a checkout", () => {
    const state = play(new BullseyeCheckoutEngine(CONFIG), [S19, S12, BULL]);

    expect(state.visits).toBe(1);
    expect(state.checkouts).toBe(1);
    expect(state.lastVisitCheckout).toBe(true);
    expect(state.currentLeft).toBe(81);
    expect(state.dartsInVisit).toBe(0);
  });

  it("does not count the outer bull as a finish", () => {
    const state = play(new BullseyeCheckoutEngine(CONFIG), [S19, S12, OUTER]);

    expect(state.visits).toBe(1);
    expect(state.checkouts).toBe(0);
    expect(state.lastVisitCheckout).toBe(false);
  });

  it("needs a setup of exactly 31", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    const state = play(engine, [S19, S11, BULL, S19, S13, BULL]);

    expect(state.visits).toBe(2);
    expect(state.checkouts).toBe(0);
  });

  it("counts bulls on setup darts at board value", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    const first = play(engine, [OUTER, dart(6, "SINGLE"), BULL]);
    expect(first.checkouts).toBe(1);

    engine.record(BULL);
    expect(engine.state().currentLeft).toBe(31);
  });

  it("shows what is left after each setup dart", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);

    expect(play(engine, [S19]).currentLeft).toBe(62);
    expect(play(engine, [S12]).currentLeft).toBe(50);
    expect(engine.state().dartsInVisit).toBe(2);
    expect(engine.state().visits).toBe(0);
  });

  it("lets Left go negative when the setup overshoots", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);

    expect(play(engine, [T20, T20]).currentLeft).toBe(-39);
    const state = play(engine, [BULL]);
    expect(state.visits).toBe(1);
    expect(state.checkouts).toBe(0);
  });

  it("records no intent on setup darts and the bull on dart 3", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19, S12, BULL, S19]);

    expect(intents(engine)).toEqual([
      [null, null],
      [null, null],
      [25, "INNER_BULL"],
      [null, null],
    ]);
  });

  it("keeps the bull intent on dart 3 after missed setup darts", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    const state = play(engine, [MISS, MISS, BULL]);

    expect(intents(engine)[2]).toEqual([25, "INNER_BULL"]);
    expect(state.visits).toBe(1);
    expect(state.checkouts).toBe(0);
  });

  it("re-applies the bull intent when dart 3 is undone and re-thrown", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19, S12, OUTER]);

    expect(engine.undo()).toBe(true);
    expect(engine.state().visits).toBe(0);
    expect(engine.state().currentLeft).toBe(50);

    const state = play(engine, [BULL]);
    expect(intents(engine)[2]).toEqual([25, "INNER_BULL"]);
    expect(state.checkouts).toBe(1);
  });

  it("gives the bull intent to dart 3 after rehydrating mid-visit", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19, S12]);

    const resumed = new BullseyeCheckoutEngine(CONFIG, engine.facts());
    const state = play(resumed, [BULL]);

    expect(intents(resumed)[2]).toEqual([25, "INNER_BULL"]);
    expect(state.checkouts).toBe(1);
  });

  it("leaves an unfinished visit unjudged at timer expiry", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19, S12, BULL, S19, S12]);
    engine.expireTimer();

    const state = engine.state();
    expect(state.status).toBe("COMPLETE");
    expect(state.visits).toBe(1);
    expect(state.checkouts).toBe(1);
    expect(state.dartsThrown).toBe(5);
  });

  it("un-completes before undoing a dart", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19]);
    engine.expireTimer();

    expect(engine.undo()).toBe(true);
    expect(engine.isComplete()).toBe(false);
    expect(engine.state().dartsThrown).toBe(1);
  });

  it("refuses to record once complete", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    engine.expireTimer();

    expect(() => engine.record(MISS)).toThrow();
  });

  it("rehydrates in-progress state from prior facts", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19, S12, BULL, T20]);

    const resumed = bullseyeCheckoutEngineFactory.create(
      CONFIG,
      engine.facts(),
    );

    expect(resumed.state()).toEqual(engine.state());
  });

  it("rejects a start score other than 81", () => {
    expect(
      () => new BullseyeCheckoutEngine({ startScore: 61 } as never),
    ).toThrow();
  });

  it("is registered as a dart exercise engine", () => {
    expect(getDartExerciseEngineFactory("BULLSEYE_CHECKOUT_V1")).toBe(
      bullseyeCheckoutEngineFactory,
    );
  });

  it("produces facts the events-batch API accepts", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19, S12, BULL]);

    const parsed = EventsBatchRequest.safeParse(
      buildEventsBatch(engine.facts()),
    );

    expect(parsed.success).toBe(true);
  });
});

describe("foldBullseyeCheckoutState", () => {
  it("derives state from a fact log without an engine instance", () => {
    const engine = new BullseyeCheckoutEngine(CONFIG);
    play(engine, [S19, S12, BULL, S19]);

    expect(foldBullseyeCheckoutState(engine.facts(), CONFIG, false)).toEqual(
      engine.state(),
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- tests/modules/training/exercises/bullseye-checkout.engine.module.test.ts`
Expected: FAIL — module `bullseye-checkout.engine.module` not found.

- [ ] **Step 3: Add the state type** — append to `app/src/modules/training/exercises/types.ts`:

```ts

/**
 * Bullseye Checkout ("Bullseye Checkouts") state, derived by replaying
 * `facts()` (`foldBullseyeCheckoutState`). A visit is judged once its third
 * dart lands: `visits` counts judged visits, `checkouts` those whose setup
 * darts total `startScore − 50` and whose third dart hit the inner bull.
 * `lastVisitCheckout` is `null` until a visit is judged. `currentLeft` is
 * `startScore` minus the open visit's darts — negative once the setup
 * overshoots.
 */
export type BullseyeCheckoutState = {
  startScore: number;
  checkouts: number;
  visits: number;
  lastVisitCheckout: boolean | null;
  currentLeft: number;
  dartsInVisit: number;
  dartsThrown: number;
  status: "IN_PROGRESS" | "COMPLETE";
};
```

- [ ] **Step 4: Implement the engine** — create `bullseye-checkout.engine.module.ts`:

```ts
import type { BullseyeCheckoutConfigData } from "@lib/types";
import { BullseyeCheckoutV1Config } from "@lib/training/exercises/rulesets/types";
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
import type { BullseyeCheckoutState } from "./types";

const EXERCISE_RULESET_VERSION_KEY = "BULLSEYE_CHECKOUT_V1" as const;
const STAGE = exerciseBlockStage();
const DARTS_PER_VISIT = 3;
const BULLSEYE_SCORE = 50;
/** Dart 3 is always thrown at the bull, whatever darts 1–2 did. */
const FINISHING_DART_INTENT = doubleTargetIntent({ kind: "BULL" });

type Progress = {
  checkouts: number;
  visits: number;
  lastVisitCheckout: boolean | null;
  currentVisitTotal: number;
  dartsInVisit: number;
  dartsThrown: number;
};

const INITIAL_PROGRESS: Progress = {
  checkouts: 0,
  visits: 0,
  lastVisitCheckout: null,
  currentVisitTotal: 0,
  dartsInVisit: 0,
  dartsThrown: 0,
};

/** A judged visit checks out when the setup leaves 50 and dart 3 is the bullseye. */
function isCheckout(startScore: number, turn: TurnFact): boolean {
  const [first, second, finishing] = turn.darts;
  return (
    first.score + second.score === startScore - BULLSEYE_SCORE &&
    finishing.hitZoneKey === "INNER_BULL"
  );
}

/**
 * Folds one visit onto the running progress. A visit of three darts is
 * judged; a shorter one is the visit still open — at timer expiry it stays
 * unjudged.
 */
function applyVisit(
  startScore: number,
  progress: Progress,
  turn: TurnFact,
): Progress {
  const dartsThrown = progress.dartsThrown + turn.darts.length;
  if (turn.darts.length < DARTS_PER_VISIT) {
    return {
      ...progress,
      currentVisitTotal: turn.darts.reduce((sum, d) => sum + d.score, 0),
      dartsInVisit: turn.darts.length,
      dartsThrown,
    };
  }
  const checkout = isCheckout(startScore, turn);
  return {
    checkouts: progress.checkouts + (checkout ? 1 : 0),
    visits: progress.visits + 1,
    lastVisitCheckout: checkout,
    currentVisitTotal: 0,
    dartsInVisit: 0,
    dartsThrown,
  };
}

/**
 * Folds the whole fact log into Bullseye Checkout state — a pure function
 * of `facts`/`config`/`complete`, mirroring `foldScoreThresholdState`.
 */
export function foldBullseyeCheckoutState(
  facts: EngineFacts,
  config: BullseyeCheckoutConfigData,
  complete: boolean,
): BullseyeCheckoutState {
  const { currentVisitTotal, ...progress } = facts.turns.reduce(
    (acc, turn) => applyVisit(config.startScore, acc, turn),
    INITIAL_PROGRESS,
  );

  return {
    startScore: config.startScore,
    ...progress,
    currentLeft: config.startScore - currentVisitTotal,
    status: complete ? "COMPLETE" : "IN_PROGRESS",
  };
}

/**
 * Bullseye Checkout ("Bullseye Checkouts"): every visit starts at 81, darts
 * 1–2 set up freely, dart 3 is thrown at the bull
 * (`docs/game-rules/training/exercises/bullseye-checkout.md`). One
 * `TurnFact` is one three-dart visit; only dart 3 carries an intent.
 * Clockless: completion arrives only through `expireTimer()` (D264).
 */
export class BullseyeCheckoutEngine implements DartExerciseEngine<BullseyeCheckoutState> {
  readonly exerciseRulesetVersionKey = EXERCISE_RULESET_VERSION_KEY;

  private readonly config: BullseyeCheckoutConfigData;
  private readonly turns: TurnFact[];
  private complete = false;

  constructor(config: BullseyeCheckoutConfigData, prior?: EngineFacts) {
    this.config = BullseyeCheckoutV1Config.parse(config);
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): BullseyeCheckoutState {
    return foldBullseyeCheckoutState(
      { stages: [{ ...STAGE }], turns: this.turns },
      this.config,
      this.complete,
    );
  }

  record(observation: DartObservation): BullseyeCheckoutState {
    if (this.complete) {
      throw new Error(
        "Cannot record a dart once the exercise is complete; undo first to correct it.",
      );
    }
    const turn = openOrCreateTurn(
      this.turns,
      STAGE.clientKey,
      SOLO_PARTICIPANT_REF,
      (last) => last.darts.length < DARTS_PER_VISIT,
    );
    if (turn.darts.length === DARTS_PER_VISIT - 1) {
      appendObservedDart(turn, observation, FINISHING_DART_INTENT);
      turn.completedAt = new Date().toISOString();
    } else {
      appendObservedDart(turn, observation);
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

  /** The step's countdown elapsed — the clock lives in the controller (D264). */
  expireTimer(): void {
    this.complete = true;
  }

  isComplete(): boolean {
    return this.complete;
  }

  state(): BullseyeCheckoutState {
    return this.deriveState();
  }

  facts(): EngineFacts {
    return { stages: [{ ...STAGE }], turns: cloneTurns(this.turns) };
  }
}

export const bullseyeCheckoutEngineFactory: DartExerciseEngineFactory<
  BullseyeCheckoutConfigData,
  BullseyeCheckoutState
> = {
  exerciseRulesetVersionKey: EXERCISE_RULESET_VERSION_KEY,
  create(config: BullseyeCheckoutConfigData, prior?: EngineFacts) {
    return new BullseyeCheckoutEngine(config, prior);
  },
};

registerDartExerciseEngineFactory(bullseyeCheckoutEngineFactory);
```

`undoLastDart` already clears `completedAt` on the reopened turn (`turn-log.module.ts:338`), so undo needs no engine-specific handling.

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- tests/modules/training/exercises/bullseye-checkout.engine.module.test.ts`
Expected: PASS (19 tests).

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/training/exercises/bullseye-checkout.engine.module.ts app/src/modules/training/exercises/types.ts app/tests/modules/training/exercises/bullseye-checkout.engine.module.test.ts
git commit -m "feat(training): BullseyeCheckoutEngine"
```

---

### Task 3: Server — validator, registry, step enums, capture pair

**Files:**
- Create: `app/src/services/exercise-rulesets/bullseye-checkout/bullseye-checkout.validator.ts`
- Modify: `app/src/services/exercise-rulesets/registry.ts` (import, `REGISTRY` ~line 15, `DART_WRITING_RULESET_VERSION_KEYS` ~line 36)
- Modify: `app/src/services/types.ts:46` (`exerciseTypeKey` union)
- Modify: `app/src/pages/api/training-sessions/types.ts:16` and `:47` (both enums)
- Modify: `app/src/services/training-session.service.ts:424` (`DART_EXERCISE_TYPE_KEYS`) and the comment above it (~line 410)
- Test: `app/tests/services/exercise-rulesets/bullseye-checkout.validator.test.ts` (create), `app/tests/services/exercise-rulesets/registry.test.ts`, `app/tests/pages/api/training-sessions/types.test.ts`, `app/tests/services/training-session.service.test.ts`

**Interfaces:**
- Consumes: `BullseyeCheckoutV1Config` (Task 1).
- Produces: `bullseyeCheckoutValidator: ExerciseRulesetValidator`; `"BULLSEYE_CHECKOUT"` accepted by `TrainingStepResolved` and `StartTrainingStepResponse`.

- [ ] **Step 1: Write the failing tests**

Create `bullseye-checkout.validator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bullseyeCheckoutValidator } from "@services/exercise-rulesets/bullseye-checkout/bullseye-checkout.validator";

const VALID = { startScore: 81 };

describe("bullseyeCheckoutValidator.validateConfig", () => {
  it("accepts the 81 start score", () => {
    const result = bullseyeCheckoutValidator.validateConfig({ config: VALID });

    expect(result).toEqual({ ok: true, config: VALID });
  });

  it("rejects another start score, naming startScore", () => {
    const result = bullseyeCheckoutValidator.validateConfig({
      config: { startScore: 61 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.join(" ")).toContain("startScore");
  });

  it("rejects a missing start score", () => {
    expect(bullseyeCheckoutValidator.validateConfig({ config: {} }).ok).toBe(
      false,
    );
  });
});
```

In `registry.test.ts`, add the import
`import { bullseyeCheckoutValidator } from "@services/exercise-rulesets/bullseye-checkout/bullseye-checkout.validator";`,
add inside `describe("getExerciseRulesetValidator")`:

```ts
  it("resolves BULLSEYE_CHECKOUT_V1", () => {
    expect(getExerciseRulesetValidator("BULLSEYE_CHECKOUT_V1")).toBe(
      bullseyeCheckoutValidator,
    );
  });
```

and next to the `SCORE_THRESHOLD_V1` line in `describe("exerciseRulesetWritesDarts")`:

```ts
    expect(exerciseRulesetWritesDarts("BULLSEYE_CHECKOUT_V1")).toBe(true);
```

In `pages/api/training-sessions/types.test.ts`, after the `SCORE_THRESHOLD` case in `describe("StartTrainingResponse")`:

```ts
  it("accepts a BULLSEYE_CHECKOUT step", () => {
    expect(
      StartTrainingResponse.safeParse({
        activityId: "act-1",
        routineTemplateId: "rt-1",
        routineName: "Custom",
        steps: [
          {
            sequenceNumber: 1,
            exerciseTypeKey: "BULLSEYE_CHECKOUT",
            exerciseRulesetVersionKey: "BULLSEYE_CHECKOUT_V1",
            gameTypeKey: null,
            gameRulesetVersionKey: null,
            durationSeconds: 600,
            configuration: { startScore: 81 },
          },
        ],
      }).success,
    ).toBe(true);
  });
```

In `training-session.service.test.ts`, after the `SCORE_THRESHOLD` case in `describe("startTrainingStep")`:

```ts
  it("inserts BULLSEYE_CHECKOUT under the ANALYTICS/VISUAL_BOARD capture pair", async () => {
    vi.mocked(trainingRepo.findActivityConfiguration).mockResolvedValue({
      routineName: "Custom",
      steps: [
        {
          sequenceNumber: 1,
          exerciseTypeKey: "BULLSEYE_CHECKOUT",
          exerciseRulesetVersionKey: "BULLSEYE_CHECKOUT_V1",
          gameTypeKey: null,
          gameRulesetVersionKey: null,
          durationSeconds: 600,
          configuration: { startScore: 81 },
        },
      ],
    } as any);
    vi.mocked(sessionRepo.findGameStatusId).mockResolvedValue(1);
    vi.mocked(sessionRepo.findExerciseTypeId).mockResolvedValue("et-bc81");
    vi.mocked(sessionRepo.findExerciseRulesetVersionId).mockResolvedValue(
      "erv-bc81",
    );
    vi.mocked(sessionRepo.findCaptureModeId).mockResolvedValue(3);
    vi.mocked(sessionRepo.findInputModeId).mockResolvedValue(4);
    vi.mocked(sessionRepo.findParticipantTypeId).mockResolvedValue(2);
    vi.mocked(sessionRepo.findPlayerDisplayName).mockResolvedValue("Levi");
    vi.mocked(sessionRepo.insertExerciseSessionRecord).mockResolvedValue({
      sessionId: "generated-id",
    });

    const result = await startTrainingStep("p1", "act-1", 1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.exerciseTypeKey).toBe("BULLSEYE_CHECKOUT");
    expect(sessionRepo.insertExerciseSessionRecord).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        exerciseRulesetVersionId: "erv-bc81",
        captureModeId: 3,
        inputModeId: 4,
      }),
    );
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- tests/services/exercise-rulesets tests/pages/api/training-sessions/types.test.ts tests/services/training-session.service.test.ts`
Expected: FAIL — validator module missing; `BULLSEYE_CHECKOUT` rejected by the step enum.

- [ ] **Step 3: Implement**

Create `bullseye-checkout.validator.ts`:

```ts
import { BullseyeCheckoutV1Config } from "@lib/training/exercises/rulesets/types";
import type { ExerciseRulesetValidator } from "@services/interfaces";
import type { ExerciseConfigValidationResult } from "@services/types";

/**
 * Bullseye Checkout v1 asserts only that the config parses — a start score
 * of 81, the one value V1 accepts
 * (`docs/game-rules/training/exercises/bullseye-checkout.md`).
 */
export const bullseyeCheckoutValidator: ExerciseRulesetValidator = {
  validateConfig({ config }): ExerciseConfigValidationResult {
    const parsed = BullseyeCheckoutV1Config.safeParse(config);
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

`registry.ts`: add
`import { bullseyeCheckoutValidator } from "./bullseye-checkout/bullseye-checkout.validator";`,
`BULLSEYE_CHECKOUT_V1: bullseyeCheckoutValidator,` in `REGISTRY`, and
`"BULLSEYE_CHECKOUT_V1",` in `DART_WRITING_RULESET_VERSION_KEYS`.

`services/types.ts:46`: add `| "BULLSEYE_CHECKOUT"` after `| "SCORE_THRESHOLD"`.

`pages/api/training-sessions/types.ts`: add `"BULLSEYE_CHECKOUT",` after `"SCORE_THRESHOLD",` in both enums (lines 16 and 47).

`training-session.service.ts`: add `"BULLSEYE_CHECKOUT",` after `"SCORE_THRESHOLD",` in `DART_EXERCISE_TYPE_KEYS`, and change the comment above it from
`Double Pattern, Target Scoring, Switching Target Scoring and Score Threshold capture every`
to
`Double Pattern, Target Scoring, Switching Target Scoring, Score Threshold and Bullseye Checkout capture every`
(rewrap to the file's width).

- [ ] **Step 4: Run to verify they pass**

Run: `npm test -- tests/services/exercise-rulesets tests/pages/api/training-sessions/types.test.ts tests/services/training-session.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/services app/src/pages/api/training-sessions/types.ts app/tests/services app/tests/pages/api/training-sessions/types.test.ts
git commit -m "feat(training): BULLSEYE_CHECKOUT server validator and step keys"
```

---

### Task 4: Seed `0029` and its verification script

**Files:**
- Create: `database/seeds/0029_bullseye_checkout_exercise_type.sql`
- Create: `database/verification/0029_bullseye_checkout_seed_checks.sql`

**Interfaces:**
- Consumes: key strings from Global Constraints.
- Produces: catalog row `exercise_type_key = 'BULLSEYE_CHECKOUT'` in `v_exercise_template_catalog`.

- [ ] **Step 1: Write the verification script first** (it is this task's failing test) — `database/verification/0029_bullseye_checkout_seed_checks.sql`:

```sql
-- ============================================================
-- Verification: 0029_bullseye_checkout_seed_checks.sql
--
-- Proves against a live database what seed
-- 0029_bullseye_checkout_exercise_type.sql can only claim locally:
-- the BULLSEYE_CHECKOUT exercise type is published, its v1 ruleset
-- belongs to it, the system template pins that ruleset with the
-- rules document's locked start score, and the template reaches
-- the routine builder through v_exercise_template_catalog.
--
-- Reads seeded rows only and ends in ROLLBACK, so it leaves
-- nothing behind and composes with the other verification
-- scripts.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0029_bullseye_checkout_seed_checks.sql
--
-- Expected: every result row reads PASS.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

INSERT INTO verification_results
SELECT '1',
    'BULLSEYE_CHECKOUT exercise type exists and is published',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s published row(s)', count(*))
FROM exercise_types
WHERE implementation_key = 'BULLSEYE_CHECKOUT'
    AND is_published;

INSERT INTO verification_results
SELECT '2',
    'BULLSEYE_CHECKOUT_V1 is version 1 of BULLSEYE_CHECKOUT',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching row(s)', count(*))
FROM exercise_ruleset_versions erv
    JOIN exercise_types et ON et.id = erv.exercise_type_id
WHERE erv.implementation_key = 'BULLSEYE_CHECKOUT_V1'
    AND erv.version_number = 1
    AND et.implementation_key = 'BULLSEYE_CHECKOUT';

INSERT INTO verification_results
SELECT '3',
    'the system template pins BULLSEYE_CHECKOUT_V1 with the 81 start score',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s matching template(s)', count(*))
FROM exercise_templates t
    JOIN exercise_types et ON et.id = t.exercise_type_id
    JOIN exercise_ruleset_versions erv ON erv.id = t.exercise_ruleset_version_id
WHERE et.implementation_key = 'BULLSEYE_CHECKOUT'
    AND erv.implementation_key = 'BULLSEYE_CHECKOUT_V1'
    AND t.is_system_template
    AND t.game_type_id IS NULL
    AND t.default_configuration = '{"startScore":81}'::jsonb;

INSERT INTO verification_results
SELECT '4',
    'the template is offered by v_exercise_template_catalog',
    CASE WHEN count(*) = 1 THEN 'PASS' ELSE 'FAIL' END,
    format('%s catalog row(s)', count(*))
FROM v_exercise_template_catalog
WHERE exercise_type_key = 'BULLSEYE_CHECKOUT'
    AND has_default_configuration;

SELECT step, result, check_name, detail
FROM verification_results
ORDER BY length(step), step, check_name;

SELECT CASE
        WHEN count(*) FILTER (WHERE result = 'FAIL') = 0 THEN format('ALL %s CHECKS PASSED', count(*))
        ELSE format('%s OF %s CHECKS FAILED', count(*) FILTER (WHERE result = 'FAIL'), count(*))
    END AS summary
FROM verification_results;

ROLLBACK;
```

- [ ] **Step 2: Run it to verify it fails** (only where `DATABASE_URL` is set; otherwise state that it was not run)

Run (repo root): `psql "$DATABASE_URL" -f database/verification/0029_bullseye_checkout_seed_checks.sql`
Expected: `4 OF 4 CHECKS FAILED`.

- [ ] **Step 3: Write the seed** — `database/seeds/0029_bullseye_checkout_exercise_type.sql`:

```sql
-- database/seeds/0029_bullseye_checkout_exercise_type.sql
--
-- ============================================================
-- Seed: 0029_bullseye_checkout_exercise_type.sql
--
-- Purpose:
-- Insert the BULLSEYE_CHECKOUT exercise type, its v1 ruleset and
-- one system exercise template, so the exercise appears in the
-- routine builder's catalog (v_exercise_template_catalog) as a
-- routine step. Rules:
-- docs/game-rules/training/exercises/bullseye-checkout.md.
-- No routine is seeded: V1 is a routine step only.
--
-- The template pins its ruleset version directly (migration
-- 0035's column), resolved by implementation_key like 0019.
-- The default configuration carries the start score, which V1
-- locks to 81.
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
		'0199a000-0000-7000-8000-000000000008',
		'BULLSEYE_CHECKOUT',
		'Bullseye Checkout',
		'Every visit starts at the start score: set up 50 with two darts, finish on the bullseye with the third.',
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
		'0199a100-0000-7000-8000-000000000007',
		'0199a000-0000-7000-8000-000000000008',
		'BULLSEYE_CHECKOUT_V1',
		1,
		'Initial bullseye checkout ruleset: a 31 setup on darts 1-2 and the inner bull on dart 3 checks out 81.',
		now()
	) ON CONFLICT (id) DO NOTHING;

INSERT INTO exercise_templates (
		id,
		exercise_type_id,
		exercise_ruleset_version_id,
		game_type_id,
		name,
		description,
		default_configuration,
		is_system_template,
		created_at,
		updated_at
	)
VALUES (
		'0199b000-0000-7000-8000-00000000000e',
		'0199a000-0000-7000-8000-000000000008',
		(
			SELECT id FROM exercise_ruleset_versions
			WHERE implementation_key = 'BULLSEYE_CHECKOUT_V1'
		),
		NULL,
		'Bullseye Checkouts',
		'Check out 81 in three darts, the last on the bullseye. How many before the time runs out?',
		'{"startScore":81}'::jsonb,
		TRUE,
		now(),
		now()
	) ON CONFLICT (id) DO NOTHING;

COMMIT;
```

Before saving, open `database/seeds/0025_score_threshold_exercise_type.sql:56-70` and confirm the `exercise_templates` column list matches this one exactly; copy it verbatim if it differs.

- [ ] **Step 4: Apply and verify** (only where `DATABASE_URL` is set)

Run (repo root): `psql "$DATABASE_URL" -f database/seeds/0029_bullseye_checkout_exercise_type.sql && psql "$DATABASE_URL" -f database/verification/0029_bullseye_checkout_seed_checks.sql`
Expected: `ALL 4 CHECKS PASSED`. Without `DATABASE_URL`, report the step as not run — never claim it passed.

- [ ] **Step 5: Commit**

```bash
git add database/seeds/0029_bullseye_checkout_exercise_type.sql database/verification/0029_bullseye_checkout_seed_checks.sql
git commit -m "feat(db): seed 0029 BULLSEYE_CHECKOUT exercise type"
```

---

### Task 5: Routine play — summary, adapter, controller, panel

**Files:**
- Modify: `app/src/modules/training/routines/routine-summary.module.ts` (add `summariseBullseyeCheckout` after `summariseScoreThreshold`)
- Create: `app/src/lib/training/routines/adapters/bullseye-checkout.adapter.ts`
- Modify: `app/src/lib/training/routines/adapters/types.ts` (`StepAdapterKey`, `StepPanel`)
- Modify: `app/src/lib/training/routines/adapters/step-adapter.registry.ts`
- Modify: `app/src/lib/training/routines/types.ts` (`RoutinePlayContext`)
- Modify: `app/src/lib/training/routines/routine-play.data.ts` (slot ~93, dispatch ~120, `activeDartEngine` ~140, `previewSegments` ~157, timer expiry ~398, record method ~449, readouts ~507)
- Create: `app/src/components/layout/training/exercises/BullseyeCheckoutPanel.astro`
- Modify: `app/src/components/layout/training/exercises/ExerciseBoardInputPanel.astro` (header comment list)
- Modify: `app/src/pages/training/routines/play/index.astro` (import + `<template x-if>`)
- Test: `app/tests/modules/training/routines/routine-summary.module.test.ts`, `app/tests/lib/training/routines/adapters/bullseye-checkout.adapter.test.ts` (create), `app/tests/lib/training/routines/adapters/step-adapter.registry.test.ts`, `app/tests/lib/training/routines/routine-play.data.test.ts`

**Interfaces:**
- Consumes: `BullseyeCheckoutEngine`, `BullseyeCheckoutState` (Task 2); `BullseyeCheckoutConfigData` (Task 1); `getDartExerciseEngineFactory`.
- Produces:
  - `summariseBullseyeCheckout(state: BullseyeCheckoutState): RoutineStepSummary`
  - `bullseyeCheckoutAdapter: StepAdapter` — key `"BULLSEYE_CHECKOUT"`, panel `"bullseye-checkout"`
  - `RoutinePlayContext` additions: `bullseyeCheckoutEngine: BullseyeCheckoutEngine | null`; `recordBullseyeCheckoutDart(observation): void`; `bullseyeCheckoutCheckouts(): number`; `bullseyeCheckoutVisits(): number`; `bullseyeCheckoutLeft(): number`; `bullseyeCheckoutLastResult(): string` (`"✓"`, `"✗"` or `"—"`); `bullseyeCheckoutRate(): string`

- [ ] **Step 1: Write the failing tests**

`routine-summary.module.test.ts` — add `summariseBullseyeCheckout` to the import from `@modules/training/routines/routine-summary.module` and `BullseyeCheckoutState` to the type import, then append:

```ts
describe("summariseBullseyeCheckout", () => {
  const STATE: BullseyeCheckoutState = {
    startScore: 81,
    checkouts: 3,
    visits: 8,
    lastVisitCheckout: false,
    currentLeft: 62,
    dartsInVisit: 1,
    dartsThrown: 25,
    status: "COMPLETE",
  };

  it("reports checkouts, visits, checkout rate and darts", () => {
    expect(summariseBullseyeCheckout(STATE)).toEqual({
      stepKey: "BULLSEYE_CHECKOUT",
      label: "Bullseye Checkouts",
      rows: [
        { label: "Checkouts", value: "3" },
        { label: "Visits", value: "8" },
        { label: "Checkout rate", value: "37.50%" },
        { label: "Darts", value: "25" },
      ],
    });
  });

  it("shows no rate before any visit is judged", () => {
    const rows = summariseBullseyeCheckout({
      ...STATE,
      checkouts: 0,
      visits: 0,
    }).rows;
    expect(rows[2]).toEqual({ label: "Checkout rate", value: "—" });
  });
});
```

Create `bullseye-checkout.adapter.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { bullseyeCheckoutAdapter } from "@lib/training/routines/adapters/bullseye-checkout.adapter";
import type { RoutinePlayContext } from "@lib/types";
import type { StartTrainingStepResponseData } from "@client/api/types";

function makeContext(): RoutinePlayContext {
  return {
    bullseyeCheckoutEngine: null,
    startStepTimer: vi.fn(),
  } as unknown as RoutinePlayContext;
}

function resultStub(): StartTrainingStepResponseData {
  return {
    sessionId: "s1",
    exerciseTypeKey: "BULLSEYE_CHECKOUT",
    configuration: { startScore: 81 },
    participant: { ref: "pt1", displayName: "Levi" },
  } as StartTrainingStepResponseData;
}

const S19 = { hitTargetNumber: 19, hitZoneKey: "SINGLE" as const, locationX: 0, locationY: 0 };
const S12 = { hitTargetNumber: 12, hitZoneKey: "SINGLE" as const, locationX: 0, locationY: 0 };
const BULL = { hitTargetNumber: 25, hitZoneKey: "INNER_BULL" as const, locationX: 0, locationY: 0 };

describe("bullseyeCheckoutAdapter", () => {
  it("declares its key, header label and panel", () => {
    expect(bullseyeCheckoutAdapter.key).toBe("BULLSEYE_CHECKOUT");
    expect(bullseyeCheckoutAdapter.headerLabel).toBe("Bullseye checkouts");
    expect(bullseyeCheckoutAdapter.panel).toBe("bullseye-checkout");
    expect(bullseyeCheckoutAdapter.completesOwnSession).toBe(false);
  });

  it("open() builds the engine and starts the step timer", () => {
    const ctx = makeContext();

    bullseyeCheckoutAdapter.open(ctx, resultStub(), 600);

    expect(ctx.bullseyeCheckoutEngine!.state().startScore).toBe(81);
    expect(ctx.startStepTimer).toHaveBeenCalledWith(600);
  });

  it("facts() reads the engine's fact log, and is null before open()", () => {
    const ctx = makeContext();
    expect(bullseyeCheckoutAdapter.facts(ctx)).toBeNull();

    bullseyeCheckoutAdapter.open(ctx, resultStub(), 600);
    expect(bullseyeCheckoutAdapter.facts(ctx)).toEqual(
      ctx.bullseyeCheckoutEngine!.facts(),
    );
  });

  it("summarise() is null before open(), and reports the live run after", () => {
    const ctx = makeContext();
    expect(bullseyeCheckoutAdapter.summarise(ctx)).toBeNull();
    bullseyeCheckoutAdapter.open(ctx, resultStub(), 600);

    [S19, S12, BULL].forEach((d) => ctx.bullseyeCheckoutEngine!.record(d));

    expect(bullseyeCheckoutAdapter.summarise(ctx)?.rows[0]).toEqual({
      label: "Checkouts",
      value: "1",
    });
  });

  it("close() nulls the engine", () => {
    const ctx = makeContext();
    bullseyeCheckoutAdapter.open(ctx, resultStub(), 600);

    bullseyeCheckoutAdapter.close(ctx);

    expect(ctx.bullseyeCheckoutEngine).toBeNull();
  });
});
```

`step-adapter.registry.test.ts` — add `"BULLSEYE_CHECKOUT",` after `"SCORE_THRESHOLD",` in the expected key list, and add:

```ts
  it("resolves the Bullseye Checkouts step", () => {
    expect(resolveStepAdapter("BULLSEYE_CHECKOUT")?.headerLabel).toBe(
      "Bullseye checkouts",
    );
  });
```

`routine-play.data.ts` test — append after the `describe("routinePlay — 65 or More")` block (reuse that file's existing `makeStore`, `stubAudioContext`, `trainingApi` helpers):

```ts
const BULLSEYE_CHECKOUT_STEP = {
  sequenceNumber: 1,
  exerciseTypeKey: "BULLSEYE_CHECKOUT",
  exerciseRulesetVersionKey: "BULLSEYE_CHECKOUT_V1",
  gameTypeKey: null,
  gameRulesetVersionKey: null,
  durationSeconds: 600,
  configuration: { startScore: 81 },
};

describe("routinePlay — Bullseye Checkouts", () => {
  const S19 = { hitTargetNumber: 19, hitZoneKey: "SINGLE" as const, locationX: 0, locationY: -100 };
  const S12 = { hitTargetNumber: 12, hitZoneKey: "SINGLE" as const, locationX: 0, locationY: -100 };
  const BULL = { hitTargetNumber: 25, hitZoneKey: "INNER_BULL" as const, locationX: 0, locationY: 0 };
  const OUTER = { hitTargetNumber: 25, hitZoneKey: "OUTER_BULL" as const, locationX: 0, locationY: 10 };
  const MISS = { hitTargetNumber: null, hitZoneKey: "MISS" as const, locationX: null, locationY: null };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    stubAudioContext();
    Object.defineProperty(globalThis, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
    vi.mocked(trainingApi.startTraining).mockResolvedValue({
      activityId: "act-1",
      routineTemplateId: "rt-1",
      routineName: "Custom",
      steps: [BULLSEYE_CHECKOUT_STEP] as never,
    });
    vi.mocked(trainingApi.startTrainingStep).mockResolvedValue({
      sessionId: "s1",
      exerciseTypeKey: "BULLSEYE_CHECKOUT",
      configuration: BULLSEYE_CHECKOUT_STEP.configuration,
      participant: { ref: "pt1", displayName: "Levi" },
    });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("startCurrentStep() builds the engine and its readouts start empty", async () => {
    const store = makeStore();
    await store.init();

    expect(store.bullseyeCheckoutEngine).not.toBeNull();
    expect(store.bullseyeCheckoutCheckouts()).toBe(0);
    expect(store.bullseyeCheckoutVisits()).toBe(0);
    expect(store.bullseyeCheckoutLeft()).toBe(81);
    expect(store.bullseyeCheckoutLastResult()).toBe("—");
    expect(store.bullseyeCheckoutRate()).toBe("—");
    expect(store.stepRemainingSeconds).toBe(600);
  });

  it("the readouts follow the setup and each judged visit", async () => {
    const store = makeStore();
    await store.init();

    store.recordBullseyeCheckoutDart(S19);
    store.recordBullseyeCheckoutDart(S12);
    expect(store.bullseyeCheckoutLeft()).toBe(50);
    expect(store.bullseyeCheckoutVisits()).toBe(0);

    store.recordBullseyeCheckoutDart(BULL);
    expect(store.bullseyeCheckoutCheckouts()).toBe(1);
    expect(store.bullseyeCheckoutVisits()).toBe(1);
    expect(store.bullseyeCheckoutLastResult()).toBe("✓");
    expect(store.bullseyeCheckoutLeft()).toBe(81);
    expect(store.bullseyeCheckoutRate()).toBe("100.00%");

    [S19, S12, OUTER].forEach((d) => store.recordBullseyeCheckoutDart(d));
    expect(store.bullseyeCheckoutLastResult()).toBe("✗");
    expect(store.dartsThrown()).toBe(6);
  });

  it("previewSegments() marks setup darts on the board as hit and dart 3 hit only on the bullseye", async () => {
    const store = makeStore();
    await store.init();

    store.recordBullseyeCheckoutDart(S19);
    store.recordBullseyeCheckoutDart(MISS);
    expect(store.previewSegments()).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "empty" },
    ]);

    store.recordBullseyeCheckoutDart(OUTER);
    expect(store.previewSegments()[2]).toEqual({ status: "miss" });
  });

  it("previewSegments() marks the bullseye on dart 3 as hit", async () => {
    const store = makeStore();
    await store.init();

    [S19, S12, BULL].forEach((d) => store.recordBullseyeCheckoutDart(d));

    expect(store.previewSegments()[2]).toEqual({ status: "hit" });
  });

  it("the step deadline expires the engine and uploads its darts", async () => {
    const sessionApi = await import("@client/api/sessions");
    vi.mocked(sessionApi.appendBatch).mockResolvedValue(undefined as never);
    vi.mocked(sessionApi.completeSession).mockResolvedValue(undefined as never);
    vi.mocked(trainingApi.completeTraining).mockResolvedValue({
      activityId: "act-1",
      completedAt: "2026-09-24T12:00:00.000Z",
    });
    const store = makeStore();
    await store.init();
    store.recordBullseyeCheckoutDart(S19);

    await vi.advanceTimersByTimeAsync(600_000);

    expect(sessionApi.appendBatch).toHaveBeenCalled();
    expect(store.stepSummaries[0]).toMatchObject({
      stepKey: "BULLSEYE_CHECKOUT",
    });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test -- tests/modules/training/routines/routine-summary.module.test.ts tests/lib/training/routines`
Expected: FAIL — `summariseBullseyeCheckout`, the adapter module and the store methods do not exist.

- [ ] **Step 3: Summary** — in `routine-summary.module.ts`, add `BullseyeCheckoutState` to the type import from the exercises types module, then after `summariseScoreThreshold`:

```ts
/**
 * Bullseye Checkouts' result is how many visits checked out 81 on the bull,
 * out of how many were judged. An unfinished visit at expiry is not judged,
 * so its darts count toward Darts but not Visits.
 */
export function summariseBullseyeCheckout(
  state: BullseyeCheckoutState,
): RoutineStepSummary {
  return {
    stepKey: "BULLSEYE_CHECKOUT",
    label: "Bullseye Checkouts",
    rows: [
      { label: "Checkouts", value: String(state.checkouts) },
      { label: "Visits", value: String(state.visits) },
      {
        label: "Checkout rate",
        value:
          state.visits === 0
            ? NO_VALUE
            : accuracyDisplay(state.checkouts, state.visits),
      },
      { label: "Darts", value: String(state.dartsThrown) },
    ],
  };
}
```

- [ ] **Step 4: Adapter + registry** — create `bullseye-checkout.adapter.ts`:

```ts
import { getDartExerciseEngineFactory } from "@modules/training/exercises/dart-engine.registry";
import { BullseyeCheckoutEngine } from "@modules/training/exercises/bullseye-checkout.engine.module";
import { summariseBullseyeCheckout } from "@modules/training/routines/routine-summary.module";
import type { BullseyeCheckoutConfigData } from "@lib/types";
import type { StepAdapter } from "./interfaces";

export const bullseyeCheckoutAdapter: StepAdapter = {
  key: "BULLSEYE_CHECKOUT",
  headerLabel: "Bullseye checkouts",
  panel: "bullseye-checkout",
  open(ctx, result, durationSeconds) {
    const factory = getDartExerciseEngineFactory("BULLSEYE_CHECKOUT_V1");
    const created = factory?.create(
      result.configuration as BullseyeCheckoutConfigData,
    );
    ctx.bullseyeCheckoutEngine =
      created instanceof BullseyeCheckoutEngine ? created : null;
    ctx.startStepTimer(durationSeconds);
  },
  facts(ctx) {
    return ctx.bullseyeCheckoutEngine?.facts() ?? null;
  },
  completesOwnSession: false,
  summarise(ctx) {
    if (!ctx.bullseyeCheckoutEngine) return null;
    return summariseBullseyeCheckout(ctx.bullseyeCheckoutEngine.state());
  },
  close(ctx) {
    ctx.bullseyeCheckoutEngine = null;
  },
};
```

`adapters/types.ts`: add `| "BULLSEYE_CHECKOUT"` after `| "SCORE_THRESHOLD"` in `StepAdapterKey`, and `| "bullseye-checkout"` after `| "score-threshold"` in `StepPanel`.

`step-adapter.registry.ts`: `import { bullseyeCheckoutAdapter } from "./bullseye-checkout.adapter";` and `BULLSEYE_CHECKOUT: bullseyeCheckoutAdapter,` after `SCORE_THRESHOLD: scoreThresholdAdapter,`.

- [ ] **Step 5: Context type** — in `app/src/lib/training/routines/types.ts`:

```ts
import type { BullseyeCheckoutEngine } from "@modules/training/exercises/bullseye-checkout.engine.module";
```

In `RoutinePlayContext`, after `scoreThresholdEngine: ScoreThresholdEngine | null;`:

```ts
  bullseyeCheckoutEngine: BullseyeCheckoutEngine | null;
```

after `scoreThresholdBeatRate(this: RoutinePlayContext): string;`:

```ts
  bullseyeCheckoutCheckouts(this: RoutinePlayContext): number;
  bullseyeCheckoutVisits(this: RoutinePlayContext): number;
  bullseyeCheckoutLeft(this: RoutinePlayContext): number;
  bullseyeCheckoutLastResult(this: RoutinePlayContext): string;
  bullseyeCheckoutRate(this: RoutinePlayContext): string;
```

add `| BullseyeCheckoutEngine` after `| ScoreThresholdEngine` in the `activeDartEngine` return union, and after `recordScoreThresholdDart(...)`:

```ts
  recordBullseyeCheckoutDart(
    this: RoutinePlayContext,
    observation: DartObservation,
  ): void;
```

- [ ] **Step 6: Controller** — in `routine-play.data.ts`:

Import: `import type { BullseyeCheckoutEngine } from "@modules/training/exercises/bullseye-checkout.engine.module";`

Initial state, after `scoreThresholdEngine: null,`: `bullseyeCheckoutEngine: null,`

Dart dispatch, after the `scoreThresholdEngine` branch:

```ts
        else if (self.bullseyeCheckoutEngine)
          self.recordBullseyeCheckoutDart(observation);
```

`activeDartEngine()`: add `| BullseyeCheckoutEngine` to the return type and `this.bullseyeCheckoutEngine ??` after `this.scoreThresholdEngine ??`.

`previewSegments()` — replace the `isHit` declaration and extend the doc comment with
`Bullseye Checkouts: setup darts as 65 or More; dart 3 (the one aimed at the bull) is a hit only on the bullseye.`:

```ts
      const isHit = this.bullseyeCheckoutEngine
        ? (dart: DartFact) =>
            dart.intendedZoneKey === "INNER_BULL"
              ? dart.hitZoneKey === "INNER_BULL"
              : dart.hitTargetNumber !== null
        : this.scoreThresholdEngine
          ? (dart: DartFact) => dart.hitTargetNumber !== null
          : this.targetScoringEngine || this.switchingTargetScoringEngine
            ? (dart: DartFact) =>
                dart.intendedTargetNumber !== null &&
                targetScoringPoints(dart.intendedTargetNumber, dart) !== null
            : (dart: DartFact) =>
                dart.hitTargetNumber === dart.intendedTargetNumber &&
                (!requireDouble || dart.hitZoneKey === "DOUBLE");
```

Step timer expiry, after `this.scoreThresholdEngine?.expireTimer();`: `this.bullseyeCheckoutEngine?.expireTimer();`

After `recordScoreThresholdDart`:

```ts
    recordBullseyeCheckoutDart(
      this: RoutinePlayContext,
      observation: DartObservation,
    ) {
      if (!this.bullseyeCheckoutEngine) return;
      this.bullseyeCheckoutEngine.record(observation);
    },
```

After `scoreThresholdBeatRate`:

```ts
    bullseyeCheckoutCheckouts(this: RoutinePlayContext): number {
      return this.bullseyeCheckoutEngine?.state().checkouts ?? 0;
    },

    bullseyeCheckoutVisits(this: RoutinePlayContext): number {
      return this.bullseyeCheckoutEngine?.state().visits ?? 0;
    },

    bullseyeCheckoutLeft(this: RoutinePlayContext): number {
      return this.bullseyeCheckoutEngine?.state().currentLeft ?? 0;
    },

    bullseyeCheckoutLastResult(this: RoutinePlayContext): string {
      const last = this.bullseyeCheckoutEngine?.state().lastVisitCheckout;
      if (last === undefined || last === null) return "—";
      return last ? "✓" : "✗";
    },

    bullseyeCheckoutRate(this: RoutinePlayContext): string {
      const state = this.bullseyeCheckoutEngine?.state();
      return !state || state.visits === 0
        ? "—"
        : accuracyDisplay(state.checkouts, state.visits);
    },
```

- [ ] **Step 7: Run to verify they pass**

Run: `npm test -- tests/modules/training/routines/routine-summary.module.test.ts tests/lib/training/routines`
Expected: PASS.

- [ ] **Step 8: Panel + page** — create `app/src/components/layout/training/exercises/BullseyeCheckoutPanel.astro`:

```astro
---
// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import VisitPreview from "@components/layout/games/VisitPreview.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import ExerciseBoardInputPanel from "./ExerciseBoardInputPanel.astro";
---

<div class="flex flex-col flex-1 min-h-0 gap-3 p-3">
  <SinglePlayerDisplay
    isTarget={false}
    score="bullseyeCheckoutCheckouts()"
  >
    <div
      slot="progress"
      class="mt-2 flex w-full flex-col items-center gap-2 px-4"
    >
      <dl class="w-full space-y-1">
        <StatRow
          label="Left"
          value="bullseyeCheckoutLeft()"
        />
        <StatRow
          label="Last"
          value="bullseyeCheckoutLastResult()"
        />
        <StatRow
          label="Visits"
          value="bullseyeCheckoutVisits()"
        />
        <StatRow
          label="Rate"
          value="bullseyeCheckoutRate()"
        />
        <StatRow
          label="Time"
          value="formattedStepRemaining()"
        />
      </dl>
    </div>
  </SinglePlayerDisplay>

  <VisitPreview />

  <ExerciseBoardInputPanel />
</div>
```

`pages/training/routines/play/index.astro`: add
`import BullseyeCheckoutPanel from "@components/layout/training/exercises/BullseyeCheckoutPanel.astro";`
after the `ScoreThresholdPanel` import, and after the `score-threshold` `<template>`:

```astro
    <template
      x-if="!loading && adapter?.panel === 'bullseye-checkout' && bullseyeCheckoutEngine"
    >
      <BullseyeCheckoutPanel />
    </template>
```

`ExerciseBoardInputPanel.astro` header comment: `Switching Target Scoring, 65 or More)` → `Switching Target Scoring, 65 or More, Bullseye Checkouts)` (rewrap).

- [ ] **Step 9: Full suite + type check**

Run: `npm test && npx astro check`
Expected: all tests pass; `astro check` reports 0 errors.

- [ ] **Step 10: Commit**

```bash
git add app/src app/tests
git commit -m "feat(training): Bullseye Checkouts routine step"
```

---

### Task 6: Docs, decision, context maintenance

**Files:**
- Modify: `docs/architecture/09-Training/01-Routines.md` (§3.4 list ~line 176; new section before `## Game Exercise` ~line 849)
- Modify: `decisions/game-engine.md` (append D361)
- Modify: `docs/architecture/00-File-Inventory.md` (seed + verification rows after the `0028` rows; engine row after `score-threshold.engine.module.ts`; validator row after `score-threshold.validator.ts`; adapter rows ~254–255; `decisions/game-engine.md` row ~348)
- Modify: `database/README.md` (seed list after line 78; verification table after the `0028` row ~123)
- Modify: `docs/architecture/00-Context-Map-History.md` (new 1.123.0 entry above 1.122.0, line ~20)
- Modify: `docs/CLAUDE.md:33`, `docs/architecture/README.md:140` (seed range `0028` → `0029`)
- Modify: `app/src/modules/training/CLAUDE.md` (engine list)
- Modify: `docs/game-rules/training/exercises/bullseye-checkout.md:3` (`Current version: V1`)

- [ ] **Step 1: Routines doc** — add `BULLSEYE_CHECKOUT` on the line after `SCORE_THRESHOLD` in the §3.4 `text` block. Before the `---` that precedes `## Game Exercise`, add:

````markdown
---

## Bullseye Checkouts (Bullseye Checkout)

Configuration:

```text
duration: 10m

startScore: 81
```

Every visit starts at 81: set up 50 with two darts, then finish on the bullseye with the third. How many checkouts before the time runs out? Rules: `docs/game-rules/training/exercises/bullseye-checkout.md`.

**Implemented** (`BULLSEYE_CHECKOUT_V1`, `app/src/modules/training/exercises/bullseye-checkout.engine.module.ts`, seed `0029`): `startScore` is the whole configuration and V1 accepts only `81`. Darts 1–2 carry no intended target; dart 3 always carries `25`/`INNER_BULL`. `score` is the board score. A visit is judged after its third dart and checks out when darts 1–2 total `startScore − 50` and dart 3 hits the inner bull; one unfinished at expiry is not judged. State carries checkouts, judged visits, the last result and what is left in the open visit. Capture pair and upload path match 65 or More. Routine step only in V1 (D361).
````

- [ ] **Step 2: Decision** — append to `decisions/game-engine.md`:

```markdown

### D361 — Bullseye Checkouts is its own exercise type, start score in config but locked to 81
Status: Accepted · Date: 2026-09-24
Decision: `BULLSEYE_CHECKOUT` / `BULLSEYE_CHECKOUT_V1` is a new exercise type (seed `0029`, template "Bullseye Checkouts") with its own `DartExerciseEngine` (`bullseye-checkout.engine.module.ts`). Each three-dart visit starts at `startScore`; darts 1–2 carry no intent, dart 3 always carries `25`/`INNER_BULL`. A visit is judged once its third dart lands and checks out when darts 1–2 total `startScore − 50` and dart 3 hits the inner bull; the outer bull never finishes. A visit unfinished at timer expiry is not judged. Configuration is `{ startScore }`, which V1 accepts only as `81`. Routine step only.
Reason: the rules (`docs/game-rules/training/exercises/bullseye-checkout.md`) judge a visit on its setup total and its last dart's ring together — neither `SCORE_THRESHOLD` (total only) nor the target types (per dart) do that. A separate engine keeps the shipped 65 or More engine untouched.
Consequences: another bull finish is widening `BullseyeCheckoutV1Config` plus a template, with no engine, seed-type or schema change. Board preview treats setup darts as 65 or More does and dart 3 as a hit only on the bullseye. Standalone play stays deferred (V2+).
Supersedes: none.
```

- [ ] **Step 3: File Inventory** — add rows (same column shape as the `0025`/score-threshold rows):

```markdown
| `database/seeds/0029_bullseye_checkout_exercise_type.sql` | `BULLSEYE_CHECKOUT` exercise type, its `BULLSEYE_CHECKOUT_V1` ruleset version and the "Bullseye Checkouts" system template (`{"startScore":81}`, pinned to that version) — reaches the routine builder via `v_exercise_template_catalog`; no routine seeded (2026-09-24) | canonical |
```

```markdown
| `database/verification/0029_bullseye_checkout_seed_checks.sql` | Live-DB proof of seed `0029`: type published, v1 ruleset linked, "Bullseye Checkouts" template pinned with `{"startScore":81}`, catalog row present (2026-09-24) | canonical |
```

```markdown
| `app/src/modules/training/exercises/bullseye-checkout.engine.module.ts` | `BullseyeCheckoutEngine`/factory for `BULLSEYE_CHECKOUT_V1` ("Bullseye Checkouts"): every visit starts at 81, darts 1–2 free aim, dart 3 intended at the inner bull; a checkout is a 31 setup plus the bullseye; an unfinished visit at expiry is not judged (`docs/game-rules/training/exercises/bullseye-checkout.md`, D361, 2026-09-24) | canonical |
```

```markdown
| `app/src/services/exercise-rulesets/bullseye-checkout/bullseye-checkout.validator.ts` | `bullseyeCheckoutValidator` for `BULLSEYE_CHECKOUT_V1` — parses `startScore` only (V1: `81`) (2026-09-24) | canonical |
```

In the `step-adapter.registry.ts` row, change `` `SCORE_THRESHOLD` (2026-09-23) `` to `` `SCORE_THRESHOLD` (2026-09-23), `BULLSEYE_CHECKOUT` (2026-09-24) ``. In the adapters row, append `` , `bullseye-checkout.adapter.ts` `` to the file list and change "The six non-game adapters" to "The seven non-game adapters". In the `decisions/game-engine.md` row, change `67 decisions` to `68 decisions` and append `, D361 Bullseye Checkouts is its own type locked to 81, 2026-09-24` before the closing `)`.

- [ ] **Step 4: database README** — after `28. \`seeds/0028_around_the_clock_routine_templates.sql\``:

```markdown
29. `seeds/0029_bullseye_checkout_exercise_type.sql`
```

After the `verification/0028_…` table row:

```markdown
| `verification/0029_bullseye_checkout_seed_checks.sql` | seed `0029`: the `BULLSEYE_CHECKOUT` type is published, `BULLSEYE_CHECKOUT_V1` is its version 1, the system template "Bullseye Checkouts" pins it with `{"startScore":81}`, and `v_exercise_template_catalog` offers it (4 checks) (2026-09-24) |
```

- [ ] **Step 5: Seed ranges, module CLAUDE.md, rules file, context history**

- `docs/CLAUDE.md:33` and `docs/architecture/README.md:140`: `` seeds `0001`–`0028` `` → `` seeds `0001`–`0029` ``.
- `app/src/modules/training/CLAUDE.md`: engine list `` `double-pattern`, `score-threshold`, `` → `` `bullseye-checkout`, `double-pattern`, `score-threshold`, ``.
- `docs/game-rules/training/exercises/bullseye-checkout.md:3`: `Current version: none (V1 in design)` → `Current version: V1`.
- `docs/architecture/00-Context-Map-History.md`, above the 1.122.0 entry:

```markdown
> **Version:** 1.123.0 (2026-09-24 — bullseye-checkout-exercise: new `BULLSEYE_CHECKOUT` exercise type, template "Bullseye Checkouts", routine step only. Rules `docs/game-rules/training/exercises/bullseye-checkout.md`; spec `docs/superpowers/specs/2026-09-24-bullseye-checkout-exercise-design.md`; plan `docs/superpowers/plans/2026-09-24-bullseye-checkout-exercise.md`. `BullseyeCheckoutEngine` (`BULLSEYE_CHECKOUT_V1`, 81 start, dart 3 intended at the inner bull), `BullseyeCheckoutV1Config` (`startScore` locked to 81), `bullseyeCheckoutValidator`, `bullseyeCheckoutAdapter` + `BullseyeCheckoutPanel.astro`, `summariseBullseyeCheckout`; seed `0029_bullseye_checkout_exercise_type.sql` + `verification/0029_bullseye_checkout_seed_checks.sql`, registered in `00-File-Inventory.md` and `database/README.md`. `09-Training/01-Routines.md` §3.4 and a new "Bullseye Checkouts" section; new **D361** (`decisions/game-engine.md`). Seed ranges bumped to `0001`–`0029`; rules file `Current version: V1`.)

```

Update the file's `updated:` front-matter date to `2026-09-24` if it differs.

- [ ] **Step 6: Gates** — run the `context-maintenance` and `run-all-gates` skills. At minimum (repo root):

```bash
bash scripts/check-game-rules.sh
bash scripts/check-context-map.sh
```

and from `app/`: `npm test && npx astro check`. Where `DATABASE_URL` is set, run the `validate-app` skill's sequence (`db:status`, `db:migrate`, `db:drift`) and Task 4's verification script. Report each script's pass/fail explicitly; report anything not run as not run.

- [ ] **Step 7: Commit**

```bash
git add docs decisions database/README.md app/src/modules/training/CLAUDE.md
git commit -m "docs(training): register Bullseye Checkouts (D361)"
```

- [ ] **Step 8: Finish** — follow `superpowers:finishing-a-development-branch` with the `finishing-a-dart-branch` skill (push + PR).
