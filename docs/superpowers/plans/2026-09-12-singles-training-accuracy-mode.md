# Singles Training — Accuracy Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `SINGLES_V3` ruleset version to Singles Training with a `scoring_mode` toggle — `STANDARD` (today's ring-quality scoring, byte-identical) and `ACCURACY` (1 point for the outer/large single on a number target, or either bull ring; 0 for everything else). Setup screen gets a third horizontal toggle, visible only under `ANALYTICS`+`VISUAL_BOARD` capture, defaulting to `STANDARD`.

**Architecture:** One `SinglesTrainingEngine` class already serves `SINGLES_V1`/`SINGLES_V2` via two `GameEngineFactory` registrations (Pattern 18); this plan adds a third registration for `SINGLES_V3`, carrying every `SinglesV2Config` field unchanged plus `scoring_mode`. A `scoringModeOf(config)` presence check (mirroring Shanghai's `difficultyOf`) lets the shared `trainingPointsFor` branch on scoring mode without breaking V1/V2, which carry no `scoringMode` field at all. `singles-training-play.data.ts` carries an unavoidable duplicate copy of the same ring-classification logic across the module boundary (already true for V1/V2) and gets the identical branch.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Zod, PostgreSQL (Neon), Vitest.

## Global Constraints

- Every ruleset config schema is `.strict()` Zod — an unrecognized key fails the parse. `SINGLES_V1`'s `SinglesConfig` has no `scoring_mode` key, so it must never be sent for a guested/bot session.
- A shipped ruleset version's config schema is never widened in place (D243/D245/D247) — this is a new ruleset version key (`SINGLES_V3`), not an edit to `SinglesV2Config`.
- `scripts/check-game-engines.sh` (pre-commit) requires that the moment `singles-training.engine.module.ts` names `rulesetVersionKey: "SINGLES_V3"`, both `app/src/services/rulesets/registry.ts` and `app/src/lib/game/rulesets/capabilities.ts` already carry a `SINGLES_V3` entry, in the **same commit** — a partial commit fails the hook.
- `scripts/check-test-coverage.sh` (pre-commit, D224) fails any commit that touches a runtime `.ts` file under `app/src/` without also touching a test that imports it. Type-only edits are exempt.
- Accuracy mode is coordinate-capture-only: keypad (`RECREATIONAL`+`DETAILED_DARTS`) only ever emits a generic `SINGLE` zone key with no inner/outer distinction, so `ACCURACY` is rejected under that mode pair by the validator.
- `SINGLES_V3` is solo-only, inheriting `SINGLES_V2`'s existing gap (`FINDINGS.md` F69) — no `RULESET_DARTBOT` entry. Not this task's to fix.
- Never fix an incidentally-noticed, unrelated defect in the same pass — log it to `FINDINGS.md` instead (Hard Invariants).
- `npm run validate:app` (from `app/`) must pass with 0 errors/warnings/hints before the task is done (`validate-app` skill); `run-all-gates` skill dispatches the structural check-*.sh scripts.
- Design spec: `docs/superpowers/specs/2026-09-12-singles-training-accuracy-mode-design.md`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `app/src/lib/game/rulesets/types.ts` | `SinglesV3Config` Zod schema, `SinglesV3Snapshot` type, `RulesetVersionKey`/`RULESET_CONFIGS`/`ConfigSnapshotFor` wiring |
| `app/src/lib/game/rulesets/refinement-contract.ts` | `singlesTrainingV3Contract` boundary-probe entry |
| `app/src/modules/game/singles-training.engine.module.ts` | `scoringModeOf`/`accuracyPointsFor`, `trainingPointsFor` branch, `singlesTrainingV3EngineFactory` |
| `app/src/services/rulesets/singles-training/singles-training.validator.ts` | `singlesTrainingV3Validator` (composes `createThreeDartValidator`, adds ACCURACY/capture-mode cross-check) |
| `app/src/services/rulesets/registry.ts` | `SINGLES_V3` → `singlesTrainingV3Validator` |
| `app/src/lib/game/rulesets/capabilities.ts` | `RULESET_CAPABILITIES.SINGLES_V3` |
| `app/src/lib/game/types.ts` | `SinglesTrainingSetupContext.scoringMode` |
| `app/src/lib/game/singles-training-setup.data.ts` | `scoringMode` state, conditional `configOverrides`, reset on guest/bot add |
| `app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro` | Third `Toggle`, capture-mode-gated |
| `app/src/lib/game/singles-training-play.data.ts` | `SinglesConfigSnapshot` widen, duplicate `scoringModeOf`/`accuracyPointsFor`, `playAgain` wire builder |
| `database/seeds/0018_singles_training_v3_game_engine_reference.sql` | New `ruleset_versions` row |
| `database/seeds/0007_ruleset_version_capabilities.sql` | Two appended capability rows |
| `database/verification/0018_singles_training_v3_capability_checks.sql` | Live-DB assertion for the two new rows |
| `docs/game-rules/rulesets/singles-training.md` | Features table, new subsection, config table |
| `decisions/game-engine.md` | New decision entry |

---

## Task 1: Config schema and refinement contract

**Files:**
- Modify: `app/src/lib/game/rulesets/types.ts`
- Modify: `app/src/lib/game/rulesets/refinement-contract.ts`
- Test: `app/tests/lib/game/rulesets/refinement-contract.test.ts`

**Interfaces:**
- Produces: `SinglesV3Config` (Zod schema), `SinglesV3ConfigData` (`z.infer`), `SinglesV3Snapshot` (camelCase snapshot type), `RulesetVersionKey` gains `"SINGLES_V3"`, `RULESET_CONFIGS.SINGLES_V3`, `ConfigSnapshotFor<"SINGLES_V3">` = `SinglesV3Snapshot`.

- [ ] **Step 1: Write the failing test**

In `app/tests/lib/game/rulesets/refinement-contract.test.ts`, add this test immediately after the existing `"covers SinglesV2Config's target_order refinement"` test (around line 34):

```ts
  it("covers SinglesV3Config's target_order refinement", () => {
    expect(
      REFINEMENT_CONTRACTS.map((contract) => contract.schemaName),
    ).toContain("SinglesV3Config");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/rulesets/refinement-contract.test.ts`
Expected: FAIL — `expected [ ... ] to contain "SinglesV3Config"`

- [ ] **Step 3: Add `SinglesV3Config` to `types.ts`**

In `app/src/lib/game/rulesets/types.ts`, insert immediately after the `SinglesV2Config` export (after its closing `});`, before the `DoublesTrainingConfig` export, around line 129):

```ts
/**
 * Singles Training V3 adds an Accuracy scoring mode over V2: `scoring_mode`
 * "STANDARD" (identical point ladder to V1/V2) or "ACCURACY" (1 point for
 * the outer/large single on a NUMBER target, or either bull ring; 0 for
 * everything else — miss, double, treble, inner single, wrong target). A
 * new ruleset version rather than an edit to `SinglesV2Config`: V2 is
 * already live against real session data, same reasoning D243/D245/D247
 * document for their own rule-shape additions. Every other field is carried
 * unchanged from V2 — the schema duplicates them rather than being
 * expressed as a diff, since Zod object schemas do not compose that way and
 * `target_order`'s own `superRefine` must be re-declared per
 * `check-refinement-coverage.sh`'s "nearest preceding export" attribution
 * rule.
 */
export const SinglesV3Config = z
  .object({
    order_mode: z.enum(["LOW_TO_HIGH", "HIGH_TO_LOW", "RANDOM"]),
    target_order: z.array(z.number().int()).length(21),
    difficulty: z.enum(["EASY", "HARD", "EXTREME"]),
    scoring_mode: z.enum(["STANDARD", "ACCURACY"]),
    points_single: z.number().int().default(1),
    points_double: z.number().int().default(2),
    points_treble: z.number().int().default(3),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (!isValidTargetOrder(val.target_order)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target_order"],
        message:
          "target_order must contain each of 1..20 and 25 (BULL) exactly once",
      });
    }
  });
```

- [ ] **Step 4: Wire `RulesetVersionKey`, `RULESET_CONFIGS`, `SinglesV3ConfigData`, `SinglesV3Snapshot`, `ConfigSnapshotFor`**

In the same file, update the `RulesetVersionKey` union (around line 291-303):

```ts
export type RulesetVersionKey =
  | "SCORE_TRAINING_V1"
  | "BOBS27_V1"
  | "SINGLES_V1"
  | "SINGLES_V2"
  | "SINGLES_V3"
  | "DOUBLES_TRAINING_V1"
  | "501_V1"
  | "TUOD_V1"
  | "SHANGHAI_V1"
  | "SHANGHAI_V2"
  | "121_V1"
  | "121_V2"
  | "AROUND_THE_CLOCK_V1";
```

Update `RULESET_CONFIGS` (around line 305-318) — add a line after `SINGLES_V2: SinglesV2Config,`:

```ts
  SINGLES_V3: SinglesV3Config,
```

`SinglesV2ConfigData` is already exported at line 323 (`export type SinglesV2ConfigData = z.infer<typeof SinglesV2Config>;`). Add a new line directly after it:

```ts
export type SinglesV3ConfigData = z.infer<typeof SinglesV3Config>;
```

Add after the `SinglesV2Snapshot` type (around line 363, after its closing `};`):

```ts
/**
 * Singles Training V3 carries every V2 field unchanged plus `scoringMode` —
 * the Accuracy/Standard toggle.
 */
export type SinglesV3Snapshot = {
  orderMode: SinglesV3ConfigData["order_mode"];
  targetOrder: SinglesV3ConfigData["target_order"];
  difficulty: SinglesV3ConfigData["difficulty"];
  scoringMode: SinglesV3ConfigData["scoring_mode"];
  pointsSingle: SinglesV3ConfigData["points_single"];
  pointsDouble: SinglesV3ConfigData["points_double"];
  pointsTreble: SinglesV3ConfigData["points_treble"];
};
```

Update `ConfigSnapshotFor` (around line 418-441) to insert a `"SINGLES_V3"` branch between `"SINGLES_V2"` and `"DOUBLES_TRAINING_V1"`:

```ts
export type ConfigSnapshotFor<K extends RulesetVersionKey> =
  K extends "SCORE_TRAINING_V1"
    ? ScoreTrainingSnapshot
    : K extends "BOBS27_V1"
      ? Bobs27Snapshot
      : K extends "SINGLES_V1"
        ? SinglesSnapshot
        : K extends "SINGLES_V2"
          ? SinglesV2Snapshot
          : K extends "SINGLES_V3"
            ? SinglesV3Snapshot
            : K extends "DOUBLES_TRAINING_V1"
              ? DoublesTrainingSnapshot
              : K extends "501_V1"
                ? FiveOhOneSnapshot
                : K extends "TUOD_V1"
                  ? TuodSnapshot
                  : K extends "SHANGHAI_V1"
                    ? ShanghaiSnapshot
                    : K extends "SHANGHAI_V2"
                      ? ShanghaiV2Snapshot
                      : K extends "121_V1"
                        ? OneTwentyOneSnapshot
                        : K extends "121_V2"
                          ? OneTwentyOneV2Snapshot
                          : AroundTheClockSnapshot;
```

- [ ] **Step 5: Add the refinement contract entry**

In `app/src/lib/game/rulesets/refinement-contract.ts`, add `SinglesV3Config` to the import from `"./types"` (after `SinglesV2Config,`):

```ts
  SinglesV2Config,
  SinglesV3Config,
```

Add after the existing `singlesTrainingV2Contract` definition (before `type DoublesTrainingInput = ...` / the doubles training section):

```ts
type SinglesV3Input = z.input<typeof SinglesV3Config>;

const singlesV3Base = {
  order_mode: "LOW_TO_HIGH",
  difficulty: "EASY",
  scoring_mode: "STANDARD",
  points_single: 1,
  points_double: 2,
  points_treble: 3,
} satisfies Omit<SinglesV3Input, "target_order">;

/**
 * Mirrors `singlesTrainingV2Contract` exactly — `SinglesV3Config`
 * re-declares the identical `target_order` `superRefine` (Zod schemas
 * don't compose a diff), so the same two probes apply verbatim.
 */
const singlesTrainingV3Contract: SchemaRefinementContract<SinglesV3Input> = {
  schemaName: "SinglesV3Config",
  schema: SinglesV3Config,
  fields: [
    {
      field: "target_order",
      accept: [
        {
          label: "a valid permutation of 1..20 and 25",
          config: { ...singlesV3Base, target_order: ASCENDING_TARGET_ORDER },
        },
      ],
      reject: [
        {
          label:
            "a duplicate value (two 1s, missing 2) — load-bearing, length stays 21",
          config: {
            ...singlesV3Base,
            target_order: [
              1, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
              20, 25,
            ],
          },
        },
        {
          label: "wrong length (20 entries, missing BULL)",
          config: {
            ...singlesV3Base,
            target_order: [
              1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
              20,
            ],
          },
        },
      ],
    },
  ],
};
```

Add `singlesTrainingV3Contract,` to the `REFINEMENT_CONTRACTS` array, immediately after `singlesTrainingV2Contract,`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/rulesets/refinement-contract.test.ts`
Expected: PASS, all tests including the new one.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/rulesets/types.ts app/src/lib/game/rulesets/refinement-contract.ts app/tests/lib/game/rulesets/refinement-contract.test.ts
git commit -m "feat: add SinglesV3Config schema for Singles Training accuracy mode"
```

---

## Task 2: Engine, validator, capabilities, registry (SINGLES_V3 wiring)

`scripts/check-game-engines.sh` requires the engine module's `rulesetVersionKey: "SINGLES_V3"`, `registry.ts`'s `SINGLES_V3` entry, and `capabilities.ts`'s `RULESET_CAPABILITIES.SINGLES_V3` entry to all exist in the same commit. This task makes all four file changes (engine, validator, registry, capabilities) and commits once at the end.

**Files:**
- Modify: `app/src/modules/game/singles-training.engine.module.ts`
- Modify: `app/src/services/rulesets/singles-training/singles-training.validator.ts`
- Modify: `app/src/services/rulesets/registry.ts`
- Modify: `app/src/lib/game/rulesets/capabilities.ts`
- Test: `app/tests/modules/game/singles-training.engine.module.test.ts`
- Test: `app/tests/services/rulesets/singles-training/singles-training.validator.test.ts`
- Test: `app/tests/lib/game/rulesets/capability-validator-parity.test.ts`

**Interfaces:**
- Consumes: `SinglesV3Config`, `SinglesV3ConfigData`, `SinglesV3Snapshot` (Task 1).
- Produces: `singlesTrainingV3EngineFactory` (`GameEngineFactory<Seated<SinglesV3Snapshot>, DartObservation, SinglesTrainingState>`, `rulesetVersionKey: "SINGLES_V3"`), `singlesTrainingV3Validator` (`RulesetValidator`).

- [ ] **Step 1: Write failing engine tests**

In `app/tests/modules/game/singles-training.engine.module.test.ts`, update the import block at the top: add `singlesTrainingV3EngineFactory` to the named import from `@modules/game/singles-training.engine.module`, and add `SinglesV3Snapshot` to the type import from `@lib/types`:

```ts
import {
  applySinglesTrainingDart,
  foldSinglesTrainingState,
  initialSinglesTrainingState,
  SinglesTrainingEngine,
  singlesTrainingEngineFactory,
  singlesTrainingV2EngineFactory,
  singlesTrainingV3EngineFactory,
} from "@modules/game/singles-training.engine.module";
```

```ts
import type {
  SinglesSnapshot,
  SinglesV2Snapshot,
  SinglesV3Snapshot,
  Seated,
} from "@lib/types";
```

Add these `describe` blocks at the end of the file (after the existing `describe("foldSinglesTrainingState", ...)` block):

```ts
describe("singlesTrainingV3EngineFactory", () => {
  it("registers itself under SINGLES_V3", () => {
    expect(singlesTrainingV3EngineFactory.rulesetVersionKey).toBe(
      "SINGLES_V3",
    );
    expect(getEngineFactory("SINGLES_V3")).toBe(singlesTrainingV3EngineFactory);
  });

  it("builds a SinglesTrainingEngine bound to SINGLES_V3, with STANDARD behaving exactly like V2", () => {
    const v3Config: Seated<SinglesV3Snapshot> = {
      ...config,
      difficulty: "EASY",
      scoringMode: "STANDARD",
    };
    const engine = singlesTrainingV3EngineFactory.create(v3Config);
    expect(engine).toBeInstanceOf(SinglesTrainingEngine);
    expect(engine.rulesetVersionKey).toBe("SINGLES_V3");
    expect(engine.state()).toEqual(initialSinglesTrainingState(v3Config));
  });
});

describe("applySinglesTrainingDart — ACCURACY scoring mode", () => {
  const accuracyConfig: Seated<SinglesV3Snapshot> = {
    ...config,
    scoringMode: "ACCURACY",
  };

  it("scores 1 point for an OUTER_SINGLE hit on the right number", () => {
    const state = initialSeat();
    const next = applySinglesTrainingDart(accuracyConfig, state, {
      hitTargetNumber: 1,
      hitZoneKey: "OUTER_SINGLE",
      locationX: 0,
      locationY: 0,
    });
    expect(next.totalPoints).toBe(1);
  });

  it("scores 0 for an INNER_SINGLE hit on the right number", () => {
    const state = initialSeat();
    const next = applySinglesTrainingDart(accuracyConfig, state, {
      hitTargetNumber: 1,
      hitZoneKey: "INNER_SINGLE",
      locationX: 0,
      locationY: 0,
    });
    expect(next.totalPoints).toBe(0);
  });

  it("scores 0 for a DOUBLE hit on the right number", () => {
    const state = initialSeat();
    const next = applySinglesTrainingDart(accuracyConfig, state, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: 0,
    });
    expect(next.totalPoints).toBe(0);
  });

  it("scores 0 for a TREBLE hit on the right number", () => {
    const state = initialSeat();
    const next = applySinglesTrainingDart(accuracyConfig, state, {
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: 0,
      locationY: 0,
    });
    expect(next.totalPoints).toBe(0);
  });

  it("scores 0 for a MISS", () => {
    const state = initialSeat();
    const next = applySinglesTrainingDart(accuracyConfig, state, {
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    expect(next.totalPoints).toBe(0);
  });

  it("scores 0 for a genuine hit on the wrong number", () => {
    const state = initialSeat();
    const next = applySinglesTrainingDart(accuracyConfig, state, {
      hitTargetNumber: 20,
      hitZoneKey: "OUTER_SINGLE",
      locationX: 0,
      locationY: 0,
    });
    expect(next.totalPoints).toBe(0);
  });

  it("scores 1 point for an OUTER_BULL hit on the bull visit", () => {
    const bullState: SinglesTrainingSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 20,
      totalPoints: 0,
      dartsThisVisit: 0,
      hitsThisVisit: 0,
      status: "IN_PROGRESS",
    };
    const next = applySinglesTrainingDart(accuracyConfig, bullState, {
      hitTargetNumber: 25,
      hitZoneKey: "OUTER_BULL",
      locationX: 0,
      locationY: 0,
    });
    expect(next.totalPoints).toBe(1);
  });

  it("scores 1 point for an INNER_BULL hit on the bull visit — bull always a point, no inner/outer distinction", () => {
    const bullState: SinglesTrainingSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 20,
      totalPoints: 0,
      dartsThisVisit: 0,
      hitsThisVisit: 0,
      status: "IN_PROGRESS",
    };
    const next = applySinglesTrainingDart(accuracyConfig, bullState, {
      hitTargetNumber: 25,
      hitZoneKey: "INNER_BULL",
      locationX: 0,
      locationY: 0,
    });
    expect(next.totalPoints).toBe(1);
  });

  it("scores 0 for a MISS on the bull visit", () => {
    const bullState: SinglesTrainingSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 20,
      totalPoints: 0,
      dartsThisVisit: 0,
      hitsThisVisit: 0,
      status: "IN_PROGRESS",
    };
    const next = applySinglesTrainingDart(accuracyConfig, bullState, {
      hitTargetNumber: 25,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    expect(next.totalPoints).toBe(0);
  });
});

describe("applySinglesTrainingDart — scoringMode absence defaults to STANDARD", () => {
  it("V1/V2 configs (no scoringMode key) score via the STANDARD ring ladder, not ACCURACY", () => {
    const state = initialSeat();
    const next = applySinglesTrainingDart(config, state, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    expect(next.totalPoints).toBe(2);
  });
});

describe("applySinglesTrainingDart — HARD combined with ACCURACY", () => {
  const accuracyHardConfig: Seated<SinglesV3Snapshot> = {
    ...config,
    difficulty: "HARD",
    scoringMode: "ACCURACY",
  };

  it("a visit landing an INNER_SINGLE (0 accuracy points) still counts as a hit for the mandatory-hit bust check", () => {
    let state = initialSeat();
    state = applySinglesTrainingDart(accuracyHardConfig, state, {
      hitTargetNumber: 1,
      hitZoneKey: "INNER_SINGLE",
      locationX: 0,
      locationY: 0,
    });
    state = applySinglesTrainingDart(accuracyHardConfig, state, {
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    state = applySinglesTrainingDart(accuracyHardConfig, state, {
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.totalPoints).toBe(0);
    expect(state.targetIndex).toBe(1);
  });

  it("a visit with zero hits still ends the seat as LOST, independent of accuracy points", () => {
    let state = initialSeat();
    state = applySinglesTrainingDart(accuracyHardConfig, state, {
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    state = applySinglesTrainingDart(accuracyHardConfig, state, {
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    state = applySinglesTrainingDart(accuracyHardConfig, state, {
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });
    expect(state.status).toBe("LOST");
  });
});
```

- [ ] **Step 2: Run engine tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: FAIL — `singlesTrainingV3EngineFactory` is not exported / `SinglesV3Snapshot` has no exported member (compile error), and the ACCURACY tests fail since `scoringMode` is silently ignored (0 points expected but STANDARD scoring runs instead is not yet possible — the whole file fails to type-check/import until Step 3).

- [ ] **Step 3: Implement the engine changes**

In `app/src/modules/game/singles-training.engine.module.ts`, update the type import at the top (add `SinglesV3Snapshot`):

```ts
import type {
  RulesetVersionKey,
  Seated,
  SeatFact,
  SinglesSnapshot,
  SinglesV2Snapshot,
  SinglesV3Snapshot,
} from "@lib/types";
```

Widen the `SinglesEngineConfig` type (currently line 41):

```ts
type SinglesEngineConfig =
  | Seated<SinglesSnapshot>
  | Seated<SinglesV2Snapshot>
  | Seated<SinglesV3Snapshot>;
```

Insert two new functions immediately before `trainingPointsFor` (currently starting at line 112):

```ts
/** `scoringMode` is absent on every V1/V2 config; reads as `"STANDARD"` —
 * the ring-quality point ladder both those versions have always used. */
function scoringModeOf(config: SinglesEngineConfig): "STANDARD" | "ACCURACY" {
  return "scoringMode" in config ? config.scoringMode : "STANDARD";
}

/**
 * Accuracy scoring: 1 point for the outer/large single on a NUMBER target,
 * or either bull ring — 0 for everything else, including a genuine hit on
 * the wrong ring (inner single, double, treble) or the wrong target.
 */
function accuracyPointsFor(
  target: BoardTarget,
  observation: DartObservation,
): number {
  if (target.kind === "BULL") {
    if (observation.hitTargetNumber !== BULL_TARGET_NUMBER) return 0;
    return observation.hitZoneKey === "OUTER_BULL" ||
      observation.hitZoneKey === "INNER_BULL"
      ? 1
      : 0;
  }
  if (observation.hitTargetNumber !== target.number) return 0;
  return observation.hitZoneKey === "OUTER_SINGLE" ? 1 : 0;
}
```

Replace the existing `trainingPointsFor` function body to branch at the top:

```ts
function trainingPointsFor(
  target: BoardTarget,
  config: SinglesEngineConfig,
  observation: DartObservation,
): number {
  if (scoringModeOf(config) === "ACCURACY") {
    return accuracyPointsFor(target, observation);
  }
  if (target.kind === "BULL") {
    if (observation.hitTargetNumber !== BULL_TARGET_NUMBER) return 0;
    if (observation.hitZoneKey === "OUTER_BULL") return config.pointsSingle;
    if (observation.hitZoneKey === "INNER_BULL") return config.pointsDouble;
    return 0;
  }
  if (observation.hitTargetNumber !== target.number) return 0;
  if (SINGLE_ZONE_KEYS.has(observation.hitZoneKey)) return config.pointsSingle;
  if (observation.hitZoneKey === "DOUBLE") return config.pointsDouble;
  if (observation.hitZoneKey === "TREBLE") return config.pointsTreble;
  return 0;
}
```

Add the new factory registration at the end of the file, after the existing `registerEngineFactory(singlesTrainingV2EngineFactory);` line:

```ts

export const singlesTrainingV3EngineFactory: GameEngineFactory<
  Seated<SinglesV3Snapshot>,
  DartObservation,
  SinglesTrainingState
> = {
  rulesetVersionKey: "SINGLES_V3",
  stageOwnership: "PER_SEAT",
  create(config: Seated<SinglesV3Snapshot>, prior?: EngineFacts) {
    return new SinglesTrainingEngine(config, prior, "SINGLES_V3");
  },
};

registerEngineFactory(singlesTrainingV3EngineFactory);
```

- [ ] **Step 4: Write failing validator tests**

In `app/tests/services/rulesets/singles-training/singles-training.validator.test.ts`, update the import at the top:

```ts
import {
  singlesTrainingValidator,
  singlesTrainingV2Validator,
  singlesTrainingV3Validator,
} from "@services/rulesets/singles-training/singles-training.validator";
```

Add a `validConfigV3` fixture right after `validConfig`:

```ts
const validConfigV3 = {
  ...validConfig,
  scoring_mode: "STANDARD",
};
```

Add these `describe` blocks at the end of the file:

```ts
describe("singlesTrainingV3Validator.validateConfig", () => {
  it("accepts RECREATIONAL + DETAILED_DARTS with STANDARD scoring", () => {
    const result = singlesTrainingV3Validator.validateConfig({
      config: validConfigV3,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts ANALYTICS + VISUAL_BOARD with STANDARD scoring", () => {
    const result = singlesTrainingV3Validator.validateConfig({
      config: validConfigV3,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts ANALYTICS + VISUAL_BOARD with ACCURACY scoring", () => {
    const result = singlesTrainingV3Validator.validateConfig({
      config: { ...validConfigV3, scoring_mode: "ACCURACY" },
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects RECREATIONAL + DETAILED_DARTS with ACCURACY scoring — keypad cannot distinguish inner/outer single", () => {
    const result = singlesTrainingV3Validator.validateConfig({
      config: { ...validConfigV3, scoring_mode: "ACCURACY" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a scoring_mode value outside STANDARD/ACCURACY", () => {
    const result = singlesTrainingV3Validator.validateConfig({
      config: { ...validConfigV3, scoring_mode: "PRECISE" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a capture/input mode combination the ruleset does not support", () => {
    const result = singlesTrainingV3Validator.validateConfig({
      config: validConfigV3,
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("accepts HARD/EXTREME difficulty combined with ACCURACY scoring", () => {
    const result = singlesTrainingV3Validator.validateConfig({
      config: { ...validConfigV3, difficulty: "HARD", scoring_mode: "ACCURACY" },
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });
});
```

- [ ] **Step 5: Run validator tests to verify they fail**

Run: `cd app && npx vitest run tests/services/rulesets/singles-training/singles-training.validator.test.ts`
Expected: FAIL — `singlesTrainingV3Validator` is not exported.

- [ ] **Step 6: Implement the validator**

Replace the full contents of `app/src/services/rulesets/singles-training/singles-training.validator.ts`:

```ts
import { SinglesConfig, SinglesV2Config, SinglesV3Config } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";
import { isVisualBoardCapture } from "../visual-board.validator";

const DARTLESS_ISSUE = (clientKey: string) =>
  `turn ${clientKey} must carry dart rows — every Singles Training visit is exactly 3 darts, hit or miss, never a dartless total`;

/**
 * Singles Training supports two mode pairs, and asserts nothing beyond the
 * shared three-dart rules. `validateBatch` never reads `config` against a
 * schema — only `validateConfig` does — so V1 and V2 share this one
 * `createThreeDartValidator` shape, parameterised only by which config
 * schema `validateConfig` parses against, mirroring
 * `shanghai.validator.ts`'s V1/V2 split.
 */
export const singlesTrainingValidator: RulesetValidator =
  createThreeDartValidator({
    label: "Singles Training",
    configSchema: SinglesConfig,
    dartlessIssue: DARTLESS_ISSUE,
  });

export const singlesTrainingV2Validator: RulesetValidator =
  createThreeDartValidator({
    label: "Singles Training",
    configSchema: SinglesV2Config,
    dartlessIssue: DARTLESS_ISSUE,
  });

/**
 * V3 adds one rule V1/V2 have no need for: ACCURACY only means anything
 * under coordinate capture — only VISUAL_BOARD can tell an outer single
 * from an inner one, while DETAILED_DARTS's per-dart keypad only ever
 * emits a generic "SINGLE" zone key. Composes `createThreeDartValidator`'s
 * base validator (per `three-dart.validator.ts`'s own guidance) rather
 * than forking it.
 */
export const singlesTrainingV3Validator: RulesetValidator = (() => {
  const base = createThreeDartValidator({
    label: "Singles Training",
    configSchema: SinglesV3Config,
    dartlessIssue: DARTLESS_ISSUE,
  });
  return {
    ...base,
    validateConfig(input) {
      const result = base.validateConfig(input);
      if (
        result.valid &&
        result.config.scoring_mode === "ACCURACY" &&
        !isVisualBoardCapture(input.captureModeKey, input.inputModeKey)
      ) {
        return {
          valid: false,
          issues: [
            "Singles Training Accuracy mode requires ANALYTICS + VISUAL_BOARD capture",
          ],
        };
      }
      return result;
    },
  };
})();
```

- [ ] **Step 7: Wire the registry and capabilities**

In `app/src/services/rulesets/registry.ts`, replace the two singles-training import lines:

```ts
import { singlesTrainingValidator } from "./singles-training/singles-training.validator";
import { singlesTrainingV2Validator } from "./singles-training/singles-training.validator";
import { singlesTrainingV3Validator } from "./singles-training/singles-training.validator";
```

And add to the `REGISTRY` object, after `SINGLES_V2: singlesTrainingV2Validator,`:

```ts
  SINGLES_V3: singlesTrainingV3Validator,
```

In `app/src/lib/game/rulesets/capabilities.ts`, add to `RULESET_CAPABILITIES`, after `SINGLES_V2: [DETAILED_DARTS, VISUAL_BOARD],`:

```ts
  SINGLES_V3: [DETAILED_DARTS, VISUAL_BOARD],
```

Do not add a `RULESET_DARTBOT` entry for `SINGLES_V3` — it stays solo-only (`FINDINGS.md` F69).

- [ ] **Step 8: Update the capability/validator parity test's ruleset count**

In `app/tests/lib/game/rulesets/capability-validator-parity.test.ts`, change:

```ts
  it("covers every ruleset", () => {
    expect(rulesetKeys.length).toBe(12);
  });
```

to:

```ts
  it("covers every ruleset", () => {
    expect(rulesetKeys.length).toBe(13);
  });
```

- [ ] **Step 9: Run all four affected test files**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts tests/services/rulesets/singles-training/singles-training.validator.test.ts tests/lib/game/rulesets/capability-validator-parity.test.ts tests/lib/game/rulesets/refinement-contract.test.ts`
Expected: PASS, all tests.

- [ ] **Step 10: Run the game-engine structural gate**

Run: `bash scripts/check-game-engines.sh`
Expected: `OK: all N game engine module(s) conform to the GameEngine contract.`

- [ ] **Step 11: Commit**

```bash
git add app/src/modules/game/singles-training.engine.module.ts \
  app/src/services/rulesets/singles-training/singles-training.validator.ts \
  app/src/services/rulesets/registry.ts \
  app/src/lib/game/rulesets/capabilities.ts \
  app/tests/modules/game/singles-training.engine.module.test.ts \
  app/tests/services/rulesets/singles-training/singles-training.validator.test.ts \
  app/tests/lib/game/rulesets/capability-validator-parity.test.ts
git commit -m "feat: add SINGLES_V3 engine, validator, and capability wiring for accuracy mode"
```

---

## Task 3: Setup UI

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/singles-training-setup.data.ts`
- Modify: `app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro`
- Test: `app/tests/lib/game/singles-training-setup.data.test.ts`

**Interfaces:**
- Consumes: `singlesTrainingV3Validator`/`RULESET_CAPABILITIES.SINGLES_V3` (Task 2, indirectly via `createSession`/`resolveSessionModePair`, not called directly here).
- Produces: `SinglesTrainingSetupContext.scoringMode: "STANDARD" | "ACCURACY"`.

- [ ] **Step 1: Write failing setup-data tests**

In `app/tests/lib/game/singles-training-setup.data.test.ts`, the `"start"` describe block has two tests whose full expected `overrides` object must gain `scoring_mode: "STANDARD"`, and whose `rulesetVersionKey` must change from `"SINGLES_V2"` to `"SINGLES_V3"`.

Replace the `"creates a session with the default order mode override and redirects"` test body's assertion block:

```ts
      expect(sessionsApi.createSession).toHaveBeenCalledWith({
        gameTypeKey: "SINGLES_TRAINING",
        rulesetVersionKey: "SINGLES_V3",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
        config: {
          source: "template",
          templateRef: "tmpl-singles-standard",
          overrides: {
            order_mode: "LOW_TO_HIGH",
            target_order: ascending,
            difficulty: "EASY",
            scoring_mode: "STANDARD",
          },
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-singles-standard",
          configSnapshot: expect.objectContaining({
            orderMode: "LOW_TO_HIGH",
            targetOrder: ascending,
            difficulty: "EASY",
            scoringMode: "STANDARD",
            pointsSingle: 1,
            pointsDouble: 2,
            pointsTreble: 3,
          }),
        }),
      );
```

Replace the `"sends the selected order mode and its resolved target order"` test body's assertion block:

```ts
      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            overrides: {
              order_mode: "HIGH_TO_LOW",
              target_order: descending,
              difficulty: "EASY",
              scoring_mode: "STANDARD",
            },
          }),
        }),
      );
```

Add these new tests to the `"start"` describe block, after the existing `"sends the selected difficulty override"` test:

```ts
    it("sends the selected scoring mode override", async () => {
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        scoringMode: "ACCURACY",
      });
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
          rulesetVersionKey: "SINGLES_V3",
          config: expect.objectContaining({
            overrides: expect.objectContaining({ scoring_mode: "ACCURACY" }),
          }),
        }),
      );
    });

    it("omits scoring_mode from the overrides once a guest is added — SinglesConfig (V1) is strict", async () => {
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        scoringMode: "ACCURACY",
      });
      setup.newGuestName = "Guest 1";
      setup.addGuest();
      expect(setup.scoringMode).toBe("STANDARD");

      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
          {
            ref: "participant-2",
            displayName: "Guest 1",
            participantTypeKey: "GUEST",
          },
        ],
      } as any);
      vi.stubGlobal("location", { href: "" });

      await setup.start();

      const call = vi.mocked(sessionsApi.createSession).mock.calls[0][0] as {
        rulesetVersionKey: string;
        config: { overrides: Record<string, unknown> };
      };
      expect(call.rulesetVersionKey).toBe("SINGLES_V1");
      expect(call.config.overrides).not.toHaveProperty("scoring_mode");
    });

    it("omits scoring_mode from the overrides once a DartBot is seated", async () => {
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        scoringMode: "ACCURACY",
      });
      setup.addBot();
      expect(setup.scoringMode).toBe("STANDARD");

      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
          {
            ref: "bot-1",
            displayName: "DartBot",
            participantTypeKey: "DARTBOT",
            dartbot: { level: 8, seed: 1, levelSource: "MANUAL" },
          },
        ],
      } as any);
      vi.stubGlobal("location", { href: "" });

      await setup.start();

      const call = vi.mocked(sessionsApi.createSession).mock.calls[0][0] as {
        rulesetVersionKey: string;
        config: { overrides: Record<string, unknown> };
      };
      expect(call.rulesetVersionKey).toBe("SINGLES_V1");
      expect(call.config.overrides).not.toHaveProperty("scoring_mode");
    });
```

Also update the two existing guest/bot tests (`"resolves SINGLES_V1 and forces difficulty back to EASY once a guest is added"` and `"...once a DartBot is seated"`) to seed `scoringMode: "ACCURACY"` before adding the guest/bot, so they exercise the reset too — add `scoringMode: "ACCURACY",` to each test's `createSetup({...})` call alongside the existing `difficulty: "HARD"`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/singles-training-setup.data.test.ts`
Expected: FAIL — `rulesetVersionKey` mismatch (`"SINGLES_V2"` vs expected `"SINGLES_V3"`), missing `scoring_mode` key, `setup.scoringMode` undefined.

- [ ] **Step 3: Add `scoringMode` to `SinglesTrainingSetupContext`**

In `app/src/lib/game/types.ts`, replace:

```ts
export type SinglesTrainingSetupContext = PresetSetupContext & {
  orderMode: TargetOrderMode;
  difficulty: "EASY" | "HARD" | "EXTREME";
};
```

with:

```ts
export type SinglesTrainingSetupContext = PresetSetupContext & {
  orderMode: TargetOrderMode;
  difficulty: "EASY" | "HARD" | "EXTREME";
  scoringMode: "STANDARD" | "ACCURACY";
};
```

- [ ] **Step 4: Update `singlesTrainingSetup()`**

Replace the full contents of `app/src/lib/game/singles-training-setup.data.ts`:

```ts
import { createPresetSetupController } from "@lib/game/setup-controller";
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
import { targetOrderFor } from "@lib/game/target-order";
import type { SinglesTrainingSetupContext } from "./types";

/** Whether this session will seat a second player — guest or DartBot. */
function guested(ctx: SinglesTrainingSetupContext): boolean {
  return ctx.guests.length > 0 || ctx.bot !== null;
}

export function singlesTrainingSetup() {
  return {
    orderMode: "LOW_TO_HIGH" as SinglesTrainingSetupContext["orderMode"],
    difficulty: "EASY" as SinglesTrainingSetupContext["difficulty"],
    scoringMode: "STANDARD" as SinglesTrainingSetupContext["scoringMode"],
    ...createPresetSetupController<SinglesTrainingSetupContext>({
      gameTypeKey: "SINGLES_TRAINING",
      rulesetVersionKey: (ctx) => (guested(ctx) ? "SINGLES_V1" : "SINGLES_V3"),
      playHref: "/games/singles-training/play",
      label: "Singles Training",
      configOverrides: (ctx) =>
        guested(ctx)
          ? {
              order_mode: ctx.orderMode,
              target_order: targetOrderFor(ctx.orderMode),
              difficulty: ctx.difficulty,
            }
          : {
              order_mode: ctx.orderMode,
              target_order: targetOrderFor(ctx.orderMode),
              difficulty: ctx.difficulty,
              scoring_mode: ctx.scoringMode,
            },
    }),
    addGuest(this: SinglesTrainingSetupContext) {
      if (addTypedGuest(this)) {
        this.difficulty = "EASY";
        this.scoringMode = "STANDARD";
      }
    },
    addBot(this: SinglesTrainingSetupContext) {
      if (addBotOpponent(this)) {
        this.difficulty = "EASY";
        this.scoringMode = "STANDARD";
      }
    },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/singles-training-setup.data.test.ts`
Expected: PASS, all tests.

- [ ] **Step 6: Update the setup form**

Replace the full contents of `app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro`:

```astro
---
// Components
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import SettingSectionShell from "./SettingSectionShell.astro";
import Toggle from "./Toggle.astro";
import UserSection from "./UserSection.astro";
import { supportsDartbot } from "@lib/game/rulesets/capabilities";

// Data
const infoSection = {
  title: "Singles training rules",
  description:
    "One target at a time, three darts each: 1 through 20 and bull, in the order you choose below. Single = 1 point, double = 2, treble = 3 — only on the current target. On the bull, outer = 1 point, inner = 2, no treble. Misses score 0. The session ends once every target has been visited once. Hard requires at least 1 dart on target each visit, Extreme at least 2 — miss the requirement and it's game over. Accuracy mode only scores the outer (large) single ring on a number target, or either bull ring — misses, doubles, trebles, the inner single, and the wrong target all score nothing.",
};

const orderModeOpts = [
  { value: "LOW_TO_HIGH", label: "Low → High" },
  { value: "HIGH_TO_LOW", label: "High → Low" },
  { value: "RANDOM", label: "Random" },
];

const difficultyOpts = [
  { value: "EASY", label: "Easy" },
  { value: "HARD", label: "Hard" },
  { value: "EXTREME", label: "Extreme" },
];

const scoringModeOpts = [
  { value: "STANDARD", label: "Standard" },
  { value: "ACCURACY", label: "Accuracy" },
];
const labelClass = "text-xs text-muted-foreground italic ml-2 ";
---

<SetupShell title="Singles training">
  <UserSection
    allowGuests
    allowDartbot={supportsDartbot("SINGLES_V1")}
  />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />
  <SettingSectionShell>
    <div class="flex flex-col gap-3">
      <div>
        <label class={labelClass}>Target order</label>
        <Toggle
          orientation="horizontal"
          options={orderModeOpts}
          x-model="orderMode"
          class="w-full"
        />
      </div>
      <div>
        <label class={labelClass}>Difficulty</label>
        <Toggle
          orientation="horizontal"
          options={difficultyOpts}
          x-model="difficulty"
          class="w-full"
        />
      </div>
      <div
        x-show="$store.settings.captureModeKey === 'ANALYTICS'"
        x-cloak
      >
        <label class={labelClass}>Scoring</label>
        <Toggle
          orientation="horizontal"
          options={scoringModeOpts}
          x-model="scoringMode"
          class="w-full"
        />
      </div>
    </div>
  </SettingSectionShell>
</SetupShell>
```

- [ ] **Step 7: Format and typecheck**

Run: `cd app && npm run format && npx astro check`
Expected: no formatting diffs beyond what `format` writes; `astro check` reports 0 errors/warnings/hints.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/game/types.ts \
  app/src/lib/game/singles-training-setup.data.ts \
  app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro \
  app/tests/lib/game/singles-training-setup.data.test.ts
git commit -m "feat: add scoring mode toggle to Singles Training setup screen"
```

---

## Task 4: Play data

**Files:**
- Modify: `app/src/lib/game/singles-training-play.data.ts`
- Test: `app/tests/lib/game/singles-training-play.data.test.ts`

**Interfaces:**
- Consumes: `singlesTrainingV3EngineFactory` (Task 2), `SinglesV3Snapshot` (Task 1).
- Produces: `RESUMABLE_RULESET_VERSIONS` includes `"SINGLES_V3"`; `playAgain`'s wire builder conditionally includes `scoring_mode`.

- [ ] **Step 1: Write failing tests**

In `app/tests/lib/game/singles-training-play.data.test.ts`, update imports:

```ts
import {
  singlesTrainingEngineFactory,
  singlesTrainingV2EngineFactory,
  singlesTrainingV3EngineFactory,
} from "@modules/game/singles-training.engine.module";
```

```ts
import type {
  SinglesSnapshot,
  SinglesV3Snapshot,
  Seated,
  SeatFact,
  SinglesTrainingPlayContext,
} from "@lib/types";
```

Add a helper near `defaultConfig`:

```ts
function defaultV3Config(
  scoringMode: "STANDARD" | "ACCURACY" = "STANDARD",
): Seated<SinglesV3Snapshot> {
  return { ...defaultConfig(), scoringMode };
}
```

Update the `beforeEach` block to also register the V3 factory:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(singlesTrainingEngineFactory);
  registerEngineFactory(singlesTrainingV2EngineFactory);
  registerEngineFactory(singlesTrainingV3EngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
});
```

Add a new test to the `describe("init", ...)` block, after the existing `"resumes the engine for a SINGLES_V2 session..."` test:

```ts
  it("resumes the engine for a SINGLES_V3 session just as it does for SINGLES_V1/V2", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, rulesetVersionKey: "SINGLES_V3" },
    ]);
    const play = makePlay({
      rulesetVersionKey: "SINGLES_V3",
      configSnapshot: defaultV3Config("ACCURACY"),
    });
    await play.init.call(play);
    expect(play.hasActiveSession).toBe(true);
    expect(play.engine).not.toBeNull();
    expect(play.engine?.rulesetVersionKey).toBe("SINGLES_V3");
  });
```

Add a new top-level describe block, after the existing `describe("previewSegments", ...)` block:

```ts
describe("previewSegments — ACCURACY scoring mode", () => {
  it("marks an OUTER_SINGLE hit on target as a hit, an INNER_SINGLE hit as a miss", async () => {
    const play = makePlay({ configSnapshot: defaultV3Config("ACCURACY") });
    await play.init.call(play);

    await play.commitDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "OUTER_SINGLE",
      locationX: 0,
      locationY: 0,
    });
    await play.commitDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "INNER_SINGLE",
      locationX: 0,
      locationY: 0,
    });

    expect(play.previewSegments.call(play)).toEqual([
      { status: "hit" },
      { status: "miss" },
      { status: "empty" },
    ]);
  });

  it("marks a DOUBLE/TREBLE hit on target as a miss under ACCURACY", async () => {
    const play = makePlay({ configSnapshot: defaultV3Config("ACCURACY") });
    await play.init.call(play);

    await play.commitDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: 0,
    });

    expect(play.previewSegments.call(play)).toEqual([
      { status: "miss" },
      { status: "empty" },
      { status: "empty" },
    ]);
  });
});

describe("playAgain — scoring_mode presence", () => {
  it("carries scoring_mode when replaying a SINGLES_V3 session", async () => {
    const play = makePlay({
      rulesetVersionKey: "SINGLES_V3",
      turns: priorTurnsThroughNumber(20),
      configSnapshot: defaultV3Config("ACCURACY"),
    });
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

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        rulesetVersionKey: "SINGLES_V3",
        config: expect.objectContaining({
          overrides: expect.objectContaining({ scoring_mode: "ACCURACY" }),
        }),
      }),
    );
  });

  it("omits scoring_mode when replaying a SINGLES_V1 session", async () => {
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

    const call = vi.mocked(createSession).mock.calls[0][0] as {
      config: { overrides: Record<string, unknown> };
    };
    expect(call.config.overrides).not.toHaveProperty("scoring_mode");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: FAIL — `singlesTrainingV3EngineFactory` not exported yet (should already exist from Task 2 — if this fails on import, verify Task 2 landed), `RESUMABLE_RULESET_VERSIONS` doesn't include `"SINGLES_V3"` so `resumeEngine` returns null, `previewSegments` shows "hit" instead of "miss" for the DOUBLE/INNER_SINGLE cases (STANDARD scoring still runs), `playAgain` never sends `scoring_mode`.

- [ ] **Step 3: Implement the play-data changes**

In `app/src/lib/game/singles-training-play.data.ts`, update the type import at the top:

```ts
import type {
  RulesetVersionKey,
  SeatFact,
  SinglesSnapshot,
  SinglesV2Snapshot,
  SinglesV3Snapshot,
} from "@lib/types";
```

Update `RESUMABLE_RULESET_VERSIONS`:

```ts
const RESUMABLE_RULESET_VERSIONS = new Set<RulesetVersionKey>([
  "SINGLES_V1",
  "SINGLES_V2",
  "SINGLES_V3",
]);
```

Update `SinglesConfigSnapshot`:

```ts
type SinglesConfigSnapshot = SinglesSnapshot | SinglesV2Snapshot | SinglesV3Snapshot;
```

Insert two new functions immediately before `trainingPointsFor` (after `targetHitCounts`):

```ts
/** Mirrors the engine's own (unexported) `scoringModeOf` — same
 * module-boundary duplication as `SINGLE_ZONE_KEYS` above. */
function scoringModeOf(
  config: SinglesConfigSnapshot,
): "STANDARD" | "ACCURACY" {
  return "scoringMode" in config ? config.scoringMode : "STANDARD";
}

/** Mirrors the engine's own (unexported) `accuracyPointsFor`. */
function accuracyPointsFor(target: BoardTarget, dart: DartFact): number {
  if (target.kind === "BULL") {
    if (dart.hitTargetNumber !== BULL_TARGET_NUMBER) return 0;
    return dart.hitZoneKey === "OUTER_BULL" || dart.hitZoneKey === "INNER_BULL"
      ? 1
      : 0;
  }
  if (dart.hitTargetNumber !== target.number) return 0;
  return dart.hitZoneKey === "OUTER_SINGLE" ? 1 : 0;
}
```

Replace the existing `trainingPointsFor` function body to branch at the top:

```ts
function trainingPointsFor(
  target: BoardTarget,
  config: SinglesConfigSnapshot,
  dart: DartFact,
): number {
  if (scoringModeOf(config) === "ACCURACY") {
    return accuracyPointsFor(target, dart);
  }
  if (target.kind === "BULL") {
    if (dart.hitTargetNumber !== BULL_TARGET_NUMBER) return 0;
    if (dart.hitZoneKey === "OUTER_BULL") return config.pointsSingle;
    if (dart.hitZoneKey === "INNER_BULL") return config.pointsDouble;
    return 0;
  }
  if (dart.hitTargetNumber !== target.number) return 0;
  if (SINGLE_ZONE_KEYS.has(dart.hitZoneKey)) return config.pointsSingle;
  if (dart.hitZoneKey === "DOUBLE") return config.pointsDouble;
  if (dart.hitZoneKey === "TREBLE") return config.pointsTreble;
  return 0;
}
```

In `playAgain`, replace the wire-object builder's return statement:

```ts
        (priorConfig) => {
          const targetOrder = targetOrderFor(priorConfig.orderMode);
          return {
            snapshot: { ...priorConfig, targetOrder },
            wire: {
              order_mode: priorConfig.orderMode,
              target_order: targetOrder,
              difficulty: priorConfig.difficulty,
              ...("scoringMode" in priorConfig
                ? { scoring_mode: priorConfig.scoringMode }
                : {}),
            },
          };
        },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Run the whole affected test surface plus the resumable-ruleset structural gate**

Run: `bash scripts/check-game-engines.sh && cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts tests/services/rulesets/singles-training/singles-training.validator.test.ts tests/lib/game/singles-training-setup.data.test.ts tests/lib/game/singles-training-play.data.test.ts tests/lib/game/rulesets/capability-validator-parity.test.ts tests/lib/game/rulesets/refinement-contract.test.ts`
Expected: `check-game-engines.sh` reports OK (including the "$PLAY_FILE never references rulesetVersionKey" check now satisfied for `SINGLES_V3`); all vitest files PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/singles-training-play.data.ts app/tests/lib/game/singles-training-play.data.test.ts
git commit -m "feat: resume and replay Singles Training accuracy-mode sessions in play data"
```

---

## Task 5: Seeds and verification SQL

**Files:**
- Create: `database/seeds/0018_singles_training_v3_game_engine_reference.sql`
- Modify: `database/seeds/0007_ruleset_version_capabilities.sql`
- Create: `database/verification/0018_singles_training_v3_capability_checks.sql`

**Interfaces:**
- Consumes: `ruleset_versions` row for `SINGLES_TRAINING` game type (`0198f000-0000-7000-8000-000000000003`, already seeded by `0003`).

- [ ] **Step 1: Create the ruleset_versions seed**

Create `database/seeds/0018_singles_training_v3_game_engine_reference.sql`:

```sql
-- ============================================================
-- Seed: 0018_singles_training_v3_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Singles Training V3: adds an
-- Accuracy scoring mode (`scoring_mode` STANDARD/ACCURACY) on
-- top of V2's unchanged 21-target path, ring-quality STANDARD
-- scoring, Hard/Extreme mandatory-hit difficulties, and
-- score-compare/elimination match outcome. Under ACCURACY, only
-- the outer/large single on a NUMBER target, or either bull
-- ring, scores 1 point; everything else (miss, double, treble,
-- inner single, wrong target) scores 0 — see
-- app/src/modules/game/singles-training.engine.module.ts. No
-- new game_types row: SINGLES_V3 is a new ruleset_versions row
-- under the same SINGLES_TRAINING game type 0003 already
-- seeded. Without this seed there is no ruleset version to
-- start a SINGLES_V3 session from — POST /api/sessions has
-- nothing to look up for SINGLES_V3.
--
-- No new configuration_templates row: SINGLES_V3's setup
-- controller (app/src/lib/game/singles-training-setup.data.ts)
-- reuses 0002's existing "Singles — Low to High, Easy" preset
-- as its templateRef and always supplies `order_mode`,
-- `target_order`, `difficulty`, and `scoring_mode` via its own
-- configOverrides — session.service.ts's createSession merges
-- template.configuration with overrides and validates the
-- MERGED result against SinglesV3Config, so the existing preset
-- is sufficient, exactly as 0013 established for SINGLES_V2.
--
-- UUID allocation (continues the 0003 range, next after 0013's
-- SINGLES_V2 row):
-- - 0198f100-...-000018 ruleset_versions (SINGLES_V3)
--
-- No game_type_features mapping: no opponent toggle to
-- configure beyond what 0001/0003 already established for
-- SINGLES_TRAINING; SinglesV3Config models no duration field
-- either (TIMED_MODE/ROUNDS_MODE do not apply, same as V1/V2).
--
-- No exercise_templates row: nothing outside 0002's own
-- configuration_templates preset currently reads
-- exercise_templates at runtime.
--
-- Capability: SINGLES_V3 + RECREATIONAL + DETAILED_DARTS and
-- SINGLES_V3 + ANALYTICS + VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, not here — 0007
-- is the single running ledger every ruleset's capability rows
-- are appended to. verification/0018_singles_training_v3_
-- capability_checks.sql asserts the resulting rows.
-- ============================================================
BEGIN;
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
        '0198f100-0000-7000-8000-000000000018',
        '0198f000-0000-7000-8000-000000000003',
        'SINGLES_V3',
        3,
        'Singles Training V3: adds an Accuracy scoring mode (only the outer/large single on a NUMBER target, or either bull ring, scores 1 point; everything else scores 0) alongside V2''s unchanged Standard scoring and Hard/Extreme mandatory-hit difficulties.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
```

- [ ] **Step 2: Append the two capability rows to seeds/0007**

In `database/seeds/0007_ruleset_version_capabilities.sql`, add two lines to the `VALUES` list, immediately after `('SINGLES_V2', 'ANALYTICS', 'VISUAL_BOARD'),`:

```sql
            ('SINGLES_V3', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SINGLES_V3', 'ANALYTICS', 'VISUAL_BOARD'),
```

- [ ] **Step 3: Create the verification script**

Create `database/verification/0018_singles_training_v3_capability_checks.sql`:

```sql
-- ============================================================
-- Verification: 0018_singles_training_v3_capability_checks.sql
--
-- Mirrors 0013_singles_training_v2_capability_checks.sql's
-- shape, re-scoped for the additive SINGLES_V3 rows appended to
-- 0007_ruleset_version_capabilities.sql's own VALUES list. No
-- PostgreSQL server exists in the container that authored this
-- file (D193), so it asserts against a real Neon database
-- before merge:
--
--   1. SINGLES_V3 + RECREATIONAL + DETAILED_DARTS resolved
--   2. SINGLES_V3 + ANALYTICS + VISUAL_BOARD resolved
--   3. no exercise_sessions row is left undeclared
--
-- Full-table exact-count parity lives in
-- 0007_capability_seed_checks.sql alone. This script owns only
-- SINGLES_V3's own additions.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0018_singles_training_v3_capability_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:seed` has applied seeds/0007 and seeds/0018.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Step 1: SINGLES_V3 + RECREATIONAL + DETAILED_DARTS resolved.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'SINGLES_V3 / RECREATIONAL / DETAILED_DARTS resolves to a seeded row',
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN NULL
        WHEN rv.id IS NULL THEN 'no ruleset_versions row for SINGLES_V3'
        ELSE 'lookups resolved but no matching ruleset_version_capabilities row'
    END
FROM ruleset_versions rv
    LEFT JOIN capture_modes cm ON cm.implementation_key = 'RECREATIONAL'
    LEFT JOIN input_modes im ON im.implementation_key = 'DETAILED_DARTS'
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id
WHERE rv.implementation_key = 'SINGLES_V3';

-- ------------------------------------------------------------
-- Step 2: SINGLES_V3 + ANALYTICS + VISUAL_BOARD resolved.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'SINGLES_V3 / ANALYTICS / VISUAL_BOARD resolves to a seeded row',
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN NULL
        WHEN rv.id IS NULL THEN 'no ruleset_versions row for SINGLES_V3'
        ELSE 'lookups resolved but no matching ruleset_version_capabilities row'
    END
FROM ruleset_versions rv
    LEFT JOIN capture_modes cm ON cm.implementation_key = 'ANALYTICS'
    LEFT JOIN input_modes im ON im.implementation_key = 'VISUAL_BOARD'
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id
WHERE rv.implementation_key = 'SINGLES_V3';

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

- [ ] **Step 4: Note on `0007_capability_seed_checks.sql`**

Do NOT modify `database/verification/0007_capability_seed_checks.sql`. Its own `VALUES` lists were never updated for `SINGLES_V2`/`SHANGHAI_V2` either (confirmed: neither pair appears in that file's Step 2/Step 4 lists even though both are live in `seeds/0007`) — established precedent from D243/D245/D247 is that each new ruleset version ships its own narrow verification script (like this task's `0018`) rather than touching the master one. This is a pre-existing gap, logged as a finding in Task 6, not fixed here.

- [ ] **Step 5: Commit**

```bash
git add database/seeds/0018_singles_training_v3_game_engine_reference.sql \
  database/seeds/0007_ruleset_version_capabilities.sql \
  database/verification/0018_singles_training_v3_capability_checks.sql
git commit -m "feat: seed SINGLES_V3 ruleset version and capability rows"
```

Note: this task's SQL cannot be executed in this container (no live Postgres/Neon connection, D193) — flag both `0018` SQL files for the PR reviewer to run `npm run db:seed` then `psql "$DATABASE_URL" -f database/verification/0018_singles_training_v3_capability_checks.sql` against a real database before merge.

---

## Task 6: Docs, decision entry, findings, and final validation

**Files:**
- Modify: `docs/game-rules/rulesets/singles-training.md`
- Modify: `decisions/game-engine.md`
- Modify: `FINDINGS.md`

- [ ] **Step 1: Update the ruleset doc's Features table**

In `docs/game-rules/rulesets/singles-training.md`, add a row to the Features table, after the `Extreme: at least 2 darts must hit` row:

```markdown
| Accuracy mode: only outer single / either bull ring scores | V3      |
```

- [ ] **Step 2: Add the Accuracy mode subsection**

In the same file, add a new subsection under `## Later versions (V2+)`, immediately after the `### Hard / Extreme difficulty (V2 — implemented)` subsection's `Available under both Recreational and Analytical capture modes, same as V1.` line and before `### Variants`:

```markdown
### Accuracy mode (V3 — implemented)

A scoring-mode toggle, **Standard** (default, identical to V1/V2's ring-quality scoring) or **Accuracy**, editable on the config screen alongside order and difficulty:

- **Standard:** identical to V1/V2 — single = 1, double = 2, treble = 3 on a NUMBER target; outer bull = 1, inner bull = 2.
- **Accuracy:** only the outer (large) single ring on a NUMBER target scores — 1 point. A miss, a double, a treble, the inner single, or a hit on the wrong target all score 0 for that dart. On the BULL, either ring (outer or inner) scores 1 point — the bull has no "outer single" equivalent, so the whole segment counts.

Accuracy mode is combinable with Hard/Extreme: the mandatory-hit bust check still counts a dart as "hit" whenever it lands anywhere in the current section (any ring), independent of whether that ring actually scores under Accuracy.

Accuracy mode requires `ANALYTICS` + `VISUAL_BOARD` capture (coordinate capture is the only way to distinguish an outer single from an inner one) — the per-dart keypad (`RECREATIONAL` + `DETAILED_DARTS`) only ever records a generic single hit, so the setup screen hides the Accuracy toggle under keypad capture, and the toggle defaults to Standard.
```

- [ ] **Step 3: Update the Config & presets table**

In the same file, add a row to the `## Config & presets (V1)` table (the table's own heading stays "(V1)" per existing convention — V2/V3 additions are described in prose in "Later versions" instead), after the `Points` row:

```markdown
| Scoring    | Standard (default) or Accuracy — editable from V3 onward         | Editable (V3+)         |
```

- [ ] **Step 4: Append the decision entry**

In `decisions/game-engine.md`, append after the existing `### D267` entry (or whatever is the file's current last entry — confirm with `tail -30 decisions/game-engine.md` before appending):

```markdown

### D268 — Singles Training V3 adds an Accuracy scoring mode as a new ruleset version, not a V2 config widen
Status: Accepted · Date: 2026-09-12
Decision: A new `SINGLES_V3` ruleset version (`SinglesV3Config`: same `order_mode`/`target_order`/`difficulty`/`points_*` fields as V2, plus `scoring_mode` `"STANDARD"|"ACCURACY"`) is registered alongside the untouched `SINGLES_V1`/`SINGLES_V2`, all three served by one `SinglesTrainingEngine` class via three `GameEngineFactory` registrations (Pattern 18) and a `scoringModeOf()` config normalizer that reads `"STANDARD"` for any config with no `scoringMode` key at all — every `SINGLES_V1`/`SINGLES_V2` config, unaffected by construction. Under `ACCURACY`, `trainingPointsFor` delegates to a new `accuracyPointsFor(target, observation)`: 1 point for an `OUTER_SINGLE` hit on the matching NUMBER target, or an `OUTER_BULL`/`INNER_BULL` hit on the BULL visit (the bull has no "outer single" equivalent, so either ring counts); 0 for everything else, including a genuine hit on the wrong ring or the wrong target. `isHitOnTarget` (the Hard/Extreme mandatory-hit bust check) is unchanged — "landed in the section at all" already meant something independent of point value, so Accuracy combines with Hard/Extreme with zero engine changes to the bust logic itself. `singlesTrainingV3Validator` composes `createThreeDartValidator` (per `three-dart.validator.ts`'s own stated guidance to compose rather than fork) and adds one extra rule: `scoring_mode: "ACCURACY"` is rejected outright under any capture pair other than `ANALYTICS`+`VISUAL_BOARD`, since the per-dart keypad (`RECREATIONAL`+`DETAILED_DARTS`) only ever emits a generic `SINGLE` zone key with no inner/outer distinction. `singlesTrainingSetup()`'s `configOverrides` sends `scoring_mode` only on the non-guested branch (which resolves to `SINGLES_V3`) — the guested branch still resolves to `SINGLES_V1`, whose `.strict()` schema has no such key, so sending it unconditionally would reject every guest/bot session at `toSnapshot`.
Reason: Feature request to add a "large single ring only" precision-training mode to Singles Training, combinable with the existing Hard/Extreme difficulty. `SINGLES_V2`'s config schema and engine behaviour are never edited in place — a new ruleset version key is the established pattern for a rule-shape change once a version has shipped against real session data (same reasoning as D243/D245/D247). Clarifying questions resolved before implementation: keypad capture cannot support Accuracy at all (only VISUAL_BOARD's coordinate capture distinguishes outer/inner single), so the setup toggle is hidden under keypad app mode and the validator rejects the combination server-side as defense in depth; the bull, having no outer-single equivalent, scores a point on either ring under Accuracy; Accuracy is combinable with Hard/Extreme rather than mutually exclusive.
Consequences: `SinglesEngineConfig` widens to `Seated<SinglesSnapshot> | Seated<SinglesV2Snapshot> | Seated<SinglesV3Snapshot>`; `singles-training-play.data.ts` carries its own unavoidable duplicate of `scoringModeOf`/`accuracyPointsFor` across the module boundary (the same duplication `SINGLE_ZONE_KEYS`/`trainingPointsFor` already had for V1/V2), used only for the play page's own hit/miss preview highlighting. `RESUMABLE_RULESET_VERSIONS` and `playAgain`'s wire-object builder (a `"scoringMode" in priorConfig` presence check, mirroring `configOverrides`'s guested/non-guested split) both gain `SINGLES_V3` support so a session started under any of the three versions resumes and replays correctly. `services/rulesets/registry.ts` gains `singlesTrainingV3Validator`; `capabilities.ts`'s `RULESET_CAPABILITIES` gains a `SINGLES_V3` entry identical to V1/V2's two declared pairs — no `RULESET_DARTBOT` entry, so `SINGLES_V3` stays solo-only, the same pre-existing gap `SINGLES_V2` has (`FINDINGS.md` F69, not fixed here). One new seed (`database/seeds/0018_singles_training_v3_game_engine_reference.sql`, a `ruleset_versions` row only) plus two appended `seeds/0007` capability rows and a new `database/verification/0018_singles_training_v3_capability_checks.sql`; the verification script requires a live Neon database and was not executed in this session's container (D193) — flagged for the PR reviewer to run before merge. `docs/game-rules/rulesets/singles-training.md` gains a `### Accuracy mode (V3 — implemented)` subsection under "Later versions (V2+)", mirroring `### Hard / Extreme difficulty (V2 — implemented)`'s structure. Full design and implementation plan: `docs/superpowers/specs/2026-09-12-singles-training-accuracy-mode-design.md`, `docs/superpowers/plans/2026-09-12-singles-training-accuracy-mode.md`.
```

- [ ] **Step 5: Log the pre-existing `0007_capability_seed_checks.sql` staleness as a finding**

In `FINDINGS.md`, update the front matter block (lines 1-7): change `updated: 2026-09-11` to `updated: 2026-09-12` and `highest-issued: F88` to `highest-issued: F89`. Then add a new block immediately after the `---` separator (line 47) and before `### F79` (i.e. it becomes the new first entry):

```markdown
### F89 — `0007_capability_seed_checks.sql`'s VALUES lists were never updated for `SINGLES_V2`/`SHANGHAI_V2`, so its Step 4 parity check already fails against current seed data
Status: Open · Found: 2026-09-12 · Task: claude/singles-accuracy-mode-4g5857
Claim: `database/verification/0007_capability_seed_checks.sql`'s own header states it asserts "the table holds exactly the triples declared in `app/src/lib/game/rulesets/capabilities.ts`, no more and no fewer"
Evidence: `database/seeds/0007_ruleset_version_capabilities.sql`'s `VALUES` list includes `SINGLES_V2` and `SHANGHAI_V2` pairs (added by D247 and D245 respectively), and `capabilities.ts`'s `RULESET_CAPABILITIES` declares both — but `database/verification/0007_capability_seed_checks.sql`'s own Step 2 and Step 4 `VALUES` lists still only enumerate the original 20 triples from the file's initial authoring, never updated when either V2 was added. Discovered while adding `SINGLES_V3`'s own narrow `0018_singles_training_v3_capability_checks.sql` per the same D243/D245/D247 precedent (append a new script, don't touch the master one) and confirming that precedent's actual state
Impact: Step 4 ("table holds no capability row outside capabilities.ts") would already report FAIL against any live database with `seeds/0007` fully applied, since the `SINGLES_V2`/`SHANGHAI_V2` rows are real rows the script's own `NOT EXISTS` VALUES list doesn't know about. Step 1's hardcoded `count(*) = 20` would also already read FAIL (actual count is 24). Nobody has run this script against a live database since those two ruleset versions shipped (D193 — no Postgres in this container), so the drift is invisible until someone does
Proposed: add the 4 missing triples (`SINGLES_V2`/`SHANGHAI_V2` × `RECREATIONAL`+`DETAILED_DARTS`/`ANALYTICS`+`VISUAL_BOARD`) to both `0007_capability_seed_checks.sql`'s Step 2 and Step 4 `VALUES` lists and bump Step 1's expected count from 20 to 24 — mechanical, but touches a shared verification script outside this task's own ruleset-scoped change, and needs a live database to confirm the fix actually passes
```

- [ ] **Step 6: Run the context-maintenance skill**

Invoke the `context-maintenance` skill to confirm the context map, `app/CLAUDE.md`/root `CLAUDE.md`, and knowledge graph need no further edits beyond what this task already made, and that the decision/finding entries above are correctly registered.

- [ ] **Step 7: Run the full validation chain**

Run: `cd app && npm run validate:app`
Expected: every step exits 0; the type-check step reports 0 errors, 0 warnings, 0 hints.

Run: `bash scripts/check-game-engines.sh && bash scripts/check-game-wiring.sh && bash scripts/check-refinement-coverage.sh && bash scripts/check-findings-log.sh`
Expected: all four report OK/PASS.

Run: `cd app && npm test`
Expected: full suite passes.

- [ ] **Step 8: Format check**

Run: `cd app && npm run format:check`
Expected: clean, no diffs.

- [ ] **Step 9: Commit**

```bash
git add docs/game-rules/rulesets/singles-training.md decisions/game-engine.md FINDINGS.md
git commit -m "docs: document Singles Training accuracy mode (D268) and log F89"
```

- [ ] **Step 10: Push**

```bash
git push -u origin claude/singles-accuracy-mode-4g5857
```

---

## Testing Plan Summary

- **Engine:** `accuracyPointsFor`'s full ring/target matrix (outer single hit/miss, inner single/double/treble as misses, wrong-number miss, both bull rings as hits, bull miss); `scoringModeOf`'s V1/V2 default vs. V3 explicit value; STANDARD-under-V3 byte-identical to V2; Hard/Extreme's mandatory-hit check unaffected by scoring mode.
- **Validator:** `SinglesV3Config` accepts/rejects `scoring_mode` values; `singlesTrainingV3Validator` rejects ACCURACY under keypad, accepts it under VISUAL_BOARD, accepts STANDARD under either; capability/validator parity count updated.
- **Setup data:** non-guested `configOverrides` carries `scoring_mode`, guested never does; `addGuest`/`addBot` reset `scoringMode` to STANDARD.
- **Play data:** `SINGLES_V3` resumes; preview segments classify by accuracy scoring when active; `playAgain` carries `scoring_mode` only for V3 sessions.
- **Structural gates:** `check-game-engines.sh`, `check-game-wiring.sh`, `check-refinement-coverage.sh`, `check-test-coverage.sh` (pre-commit, run automatically), `check-findings-log.sh`.
