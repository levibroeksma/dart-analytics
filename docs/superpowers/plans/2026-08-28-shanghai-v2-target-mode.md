# Shanghai V2 — Target Needed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a new `SHANGHAI_V2` ruleset version adding one setting — a Normal/Hard "Target Needed" difficulty toggle — without touching `SHANGHAI_V1`, which is already live.

**Architecture:** New ruleset version threaded through the existing Shanghai stack exactly the way `121_V2` was added on top of `121_V1`: one shared engine module handles both versions via a config-shape union and a small normalizer function, a second server-side validator instance is registered for the new key, and the setup controller switches to creating `SHANGHAI_V2` sessions with the toggle wired through `configOverrides`. No schema migration; one new `ruleset_versions` seed row.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Zod, PostgreSQL (Neon), Vitest.

## Global Constraints

- `SHANGHAI_V1` (`app/src/lib/game/rulesets/types.ts`'s `ShanghaiConfig`, `app/src/modules/game/shanghai.engine.module.ts`'s V1 behavior) is never edited — only added to.
- New ruleset key: `SHANGHAI_V2`. New config field: `difficulty: "NORMAL" | "HARD"` (snake_case wire key `difficulty` — no underscore conversion needed, it's already one word).
- Hard-mode rule: a round (3-dart visit) with **zero** darts landing in the active number's single/double/treble halves the seat's running `totalScore`, computed as `Math.round(totalScore / 2)` (rounds `.5` up — correct here since `totalScore` is always non-negative). A round with **at least one** target hit is never halved, whatever it scores. `NORMAL` difficulty is a byte-identical no-op versus current V1 behavior.
- `SHANGHAI_V2` declares the same two capability pairs as V1: `RECREATIONAL`+`DETAILED_DARTS` and `ANALYTICS`+`VISUAL_BOARD`.
- No new `configuration_templates` seed row — `SHANGHAI_V2`'s setup controller reuses V1's existing "Shanghai — Standard" preset (`configuration: {}`) as its `templateRef`; `configOverrides` always supplies `difficulty`, and `session.service.ts` validates the *merged* template+overrides config server-side, so the empty base preset is sufficient (see Task 5 for why a second preset row would actually be a hazard here).
- No play/results UI changes — the running score already reflects halving live since it is derived state.
- Per `app/CLAUDE.md`: a new engine's `rulesetVersionKey` and its server-side validator must land in the **same commit** (`scripts/check-game-engines.sh` enforces this pre-commit) — Task 3 below lands the engine module, validator, and registry entry together as one commit.
- Per `app/CLAUDE.md`: any changed runtime `.ts` file under `app/src/` needs a covering test change in the same task (`scripts/check-test-coverage.sh`).
- Format via `cd app && npm run format` before any commit that touches `.astro`/`.ts` files with non-trivial formatting risk (Task 6 runs the authoritative pass; running it earlier is harmless).

---

## Task 1: Game rules doc — describe the implemented mechanic

**Files:**
- Modify: `docs/game-rules/rulesets/shanghai.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Add a Features table row**

In `docs/game-rules/rulesets/shanghai.md`, find the Features table (starts at line 7) and add a row right before the closing `| Standard dartboard scoring (assumed) | v1 |` row:

```markdown
| Target Needed difficulty (Normal/Hard)          | V2      |
```

- [ ] **Step 2: Describe the mechanic under "Later versions (V2+)"**

Find this block:

```markdown
## Later versions (V2+)

### Variants

- Round ranges: **1–20**, custom start/end
- **Score-only** mode (no instant-win Shanghai)
- Multiplayer: all players take each round; first Shanghai in throwing order wins that path; else highest total
```

Replace it with (adds one new subsection, leaves the rest untouched):

```markdown
## Later versions (V2+)

### Target Needed (V2 — implemented)

A difficulty toggle, **Normal** (default) or **Hard**:

- **Normal:** identical to V1 — only hits on the round's own number score; anything else scores 0 for that dart.
- **Hard:** a round must land at least one dart in the round's own single, double, or treble. A round with zero target hits halves the player's running total score (round-half-up) instead of merely adding 0. A round with at least one target hit is never penalized, whatever it scores.

Available under both Recreational and Analytical capture modes, same as V1.

### Variants

- Round ranges: **1–20**, custom start/end
- **Score-only** mode (no instant-win Shanghai)
- Multiplayer: all players take each round; first Shanghai in throwing order wins that path; else highest total
```

- [ ] **Step 3: Commit**

```bash
git add docs/game-rules/rulesets/shanghai.md
git commit -m "docs: describe Shanghai V2's Target Needed difficulty toggle"
```

---

## Task 2: Config schema and capabilities

**Files:**
- Modify: `app/src/lib/game/rulesets/types.ts`
- Modify: `app/src/lib/game/rulesets/capabilities.ts`
- Test: `app/tests/lib/game/rulesets/capabilities.test.ts`

**Interfaces:**
- Produces: `ShanghaiV2Config` (Zod schema), `ShanghaiV2ConfigData`, `ShanghaiV2Snapshot` (`{ difficulty: "NORMAL" | "HARD" }`), `RulesetVersionKey` gains `"SHANGHAI_V2"`, `RULESET_CONFIGS["SHANGHAI_V2"]`, `ConfigSnapshotFor<"SHANGHAI_V2">` resolving to `ShanghaiV2Snapshot`, `RULESET_CAPABILITIES["SHANGHAI_V2"]`.

- [ ] **Step 1: Write the failing capabilities test**

In `app/tests/lib/game/rulesets/capabilities.test.ts`:

Replace the sorted-keys array in `"declares a pair for every ruleset version"` (currently ends `"SHANGHAI_V1"`, `"SINGLES_V1"`, `"TUOD_V1"`):

```ts
  it("declares a pair for every ruleset version", () => {
    expect(Object.keys(RULESET_CAPABILITIES).sort()).toEqual([
      "121_V1",
      "121_V2",
      "501_V1",
      "AROUND_THE_CLOCK_V1",
      "BOBS27_V1",
      "DOUBLES_TRAINING_V1",
      "SCORE_TRAINING_V1",
      "SHANGHAI_V1",
      "SHANGHAI_V2",
      "SINGLES_V1",
      "TUOD_V1",
    ]);
  });
```

Add `"SHANGHAI_V2"` to the `it.each` RECREATIONAL+DETAILED_DARTS list:

```ts
  it.each([
    "SINGLES_V1",
    "BOBS27_V1",
    "DOUBLES_TRAINING_V1",
    "SHANGHAI_V1",
    "SHANGHAI_V2",
    "AROUND_THE_CLOCK_V1",
  ] as const)(
```

Add a new test right after `"gives 121_V2 the same pairs as 121_V1"`:

```ts
  it("gives SHANGHAI_V2 the same pairs as SHANGHAI_V1", () => {
    expect(supportsMode("SHANGHAI_V2", "RECREATIONAL", "DETAILED_DARTS")).toBe(
      true,
    );
    expect(supportsMode("SHANGHAI_V2", "ANALYTICS", "VISUAL_BOARD")).toBe(
      true,
    );
  });
```

Update the `capableRulesets` sorted-list test the same way as the first list (add `"SHANGHAI_V2"` in alphabetical position):

```ts
  it("lists every visual-capable ruleset", () => {
    expect([...capableRulesets("ANALYTICS", "VISUAL_BOARD")].sort()).toEqual([
      "121_V1",
      "121_V2",
      "501_V1",
      "AROUND_THE_CLOCK_V1",
      "BOBS27_V1",
      "DOUBLES_TRAINING_V1",
      "SCORE_TRAINING_V1",
      "SHANGHAI_V1",
      "SHANGHAI_V2",
      "SINGLES_V1",
      "TUOD_V1",
    ]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts`
Expected: FAIL — `RULESET_CAPABILITIES` has no `"SHANGHAI_V2"` key yet, `supportsMode("SHANGHAI_V2", ...)` returns `false`.

- [ ] **Step 3: Add `ShanghaiV2Config` to `types.ts`**

In `app/src/lib/game/rulesets/types.ts`, immediately after the existing `ShanghaiConfig` declaration (the block ending `export const ShanghaiConfig = z.object({}).strict();`), insert:

```ts
/**
 * Shanghai V2 adds exactly one setting over V1: Target Needed. `NORMAL`
 * (default) is byte-identical to V1's rules; `HARD` requires at least one
 * dart of the round's own single/double/treble to land, or the running
 * total is halved (round-half-up) for that round — see
 * `modules/game/shanghai.engine.module.ts`'s `applyShanghaiDart`. A new
 * ruleset version rather than an edit to `ShanghaiConfig`: V1 is already
 * live against real session data, exactly the same reasoning
 * `OneTwentyOneV2Config` documents for 121.
 */
export const ShanghaiV2Config = z
  .object({
    difficulty: z.enum(["NORMAL", "HARD"]),
  })
  .strict();
```

- [ ] **Step 4: Add `"SHANGHAI_V2"` to `RulesetVersionKey` and `RULESET_CONFIGS`**

Change:

```ts
export type RulesetVersionKey =
  | "SCORE_TRAINING_V1"
  | "BOBS27_V1"
  | "SINGLES_V1"
  | "DOUBLES_TRAINING_V1"
  | "501_V1"
  | "TUOD_V1"
  | "SHANGHAI_V1"
  | "121_V1"
  | "121_V2"
  | "AROUND_THE_CLOCK_V1";
```

to:

```ts
export type RulesetVersionKey =
  | "SCORE_TRAINING_V1"
  | "BOBS27_V1"
  | "SINGLES_V1"
  | "DOUBLES_TRAINING_V1"
  | "501_V1"
  | "TUOD_V1"
  | "SHANGHAI_V1"
  | "SHANGHAI_V2"
  | "121_V1"
  | "121_V2"
  | "AROUND_THE_CLOCK_V1";
```

Change:

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
  "121_V2": OneTwentyOneV2Config,
  AROUND_THE_CLOCK_V1: AroundTheClockConfig,
};
```

to:

```ts
export const RULESET_CONFIGS: Record<RulesetVersionKey, z.ZodTypeAny> = {
  SCORE_TRAINING_V1: ScoreTrainingConfig,
  BOBS27_V1: Bobs27Config,
  SINGLES_V1: SinglesConfig,
  DOUBLES_TRAINING_V1: DoublesTrainingConfig,
  "501_V1": FiveOhOneConfig,
  TUOD_V1: TuodConfig,
  SHANGHAI_V1: ShanghaiConfig,
  SHANGHAI_V2: ShanghaiV2Config,
  "121_V1": OneTwentyOneConfig,
  "121_V2": OneTwentyOneV2Config,
  AROUND_THE_CLOCK_V1: AroundTheClockConfig,
};
```

- [ ] **Step 5: Add `ShanghaiV2ConfigData` and `ShanghaiV2Snapshot`**

Change:

```ts
export type ScoreTrainingConfigData = z.infer<typeof ScoreTrainingConfig>;
export type Bobs27ConfigData = z.infer<typeof Bobs27Config>;
export type SinglesConfigData = z.infer<typeof SinglesConfig>;
export type DoublesTrainingConfigData = z.infer<typeof DoublesTrainingConfig>;
export type FiveOhOneConfigData = z.infer<typeof FiveOhOneConfig>;
export type TuodConfigData = z.infer<typeof TuodConfig>;
```

to:

```ts
export type ScoreTrainingConfigData = z.infer<typeof ScoreTrainingConfig>;
export type Bobs27ConfigData = z.infer<typeof Bobs27Config>;
export type SinglesConfigData = z.infer<typeof SinglesConfig>;
export type DoublesTrainingConfigData = z.infer<typeof DoublesTrainingConfig>;
export type FiveOhOneConfigData = z.infer<typeof FiveOhOneConfig>;
export type TuodConfigData = z.infer<typeof TuodConfig>;
export type ShanghaiV2ConfigData = z.infer<typeof ShanghaiV2Config>;
```

Change:

```ts
/** Shanghai v1 has nothing to configure — no fields to carry. */
export type ShanghaiSnapshot = Record<string, never>;
```

to:

```ts
/** Shanghai v1 has nothing to configure — no fields to carry. */
export type ShanghaiSnapshot = Record<string, never>;

/**
 * Shanghai V2 carries exactly the one field its schema adds over V1: the
 * Target Needed difficulty toggle.
 */
export type ShanghaiV2Snapshot = {
  difficulty: ShanghaiV2ConfigData["difficulty"];
};
```

- [ ] **Step 6: Add the `ConfigSnapshotFor` branch**

Change:

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
                : K extends "121_V1"
                  ? OneTwentyOneSnapshot
                  : K extends "121_V2"
                    ? OneTwentyOneV2Snapshot
                    : AroundTheClockSnapshot;
```

to:

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
                : K extends "SHANGHAI_V2"
                  ? ShanghaiV2Snapshot
                  : K extends "121_V1"
                    ? OneTwentyOneSnapshot
                    : K extends "121_V2"
                      ? OneTwentyOneV2Snapshot
                      : AroundTheClockSnapshot;
```

- [ ] **Step 7: Add the capability entry**

In `app/src/lib/game/rulesets/capabilities.ts`, change:

```ts
  SHANGHAI_V1: [DETAILED_DARTS, VISUAL_BOARD],
```

to:

```ts
  SHANGHAI_V1: [DETAILED_DARTS, VISUAL_BOARD],
  SHANGHAI_V2: [DETAILED_DARTS, VISUAL_BOARD],
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts`
Expected: PASS, all tests green.

Note: `cd app && npx vitest run tests/lib/game/rulesets/capability-seed-parity.test.ts` will now **fail** (`RULESET_CAPABILITIES` declares `SHANGHAI_V2` triples the seed file doesn't have yet) — expected until Task 5 seeds it; do not try to fix it here.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/game/rulesets/types.ts \
  app/src/lib/game/rulesets/capabilities.ts \
  app/tests/lib/game/rulesets/capabilities.test.ts
git commit -m "Add SHANGHAI_V2 config schema and capability declaration"
```

---

## Task 3: Engine, server validator, and registry (one commit — CLAUDE.md-mandated)

**Files:**
- Modify: `app/src/modules/game/shanghai.engine.module.ts`
- Modify: `app/src/services/rulesets/shanghai/shanghai.validator.ts`
- Modify: `app/src/services/rulesets/registry.ts`
- Test: `app/tests/modules/game/shanghai.engine.module.test.ts`
- Test: `app/tests/services/rulesets/shanghai/shanghai.validator.test.ts`
- Test: `app/tests/services/rulesets/registry.test.ts`

**Interfaces:**
- Consumes: `ShanghaiV2Config`, `ShanghaiV2Snapshot` (Task 2).
- Produces: `applyShanghaiDart(state, observation, difficulty?)` (3rd param, defaults `"NORMAL"`), `foldShanghaiState(facts, config)` accepting either config shape, `shanghaiV2EngineFactory` (registered under `SHANGHAI_V2`), `shanghaiV2Validator` (registered under `SHANGHAI_V2` in `services/rulesets/registry.ts`).

- [ ] **Step 1: Write the failing engine tests**

In `app/tests/modules/game/shanghai.engine.module.test.ts`, update the import block at the top:

```ts
import { describe, it, expect } from "vitest";
import {
  applyShanghaiDart,
  foldShanghaiState,
  initialShanghaiState,
  ShanghaiEngine,
  shanghaiEngineFactory,
  shanghaiV2EngineFactory,
  zoneBucketOf,
} from "@modules/game/shanghai.engine.module";
import { numbersPath, targetAt } from "@modules/game/board-progression.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import type {
  DartObservation,
  DartZoneKey,
  EngineFacts,
  ShanghaiSeatState,
  TurnFact,
} from "@modules/types";
import type { ShanghaiSnapshot, ShanghaiV2Snapshot, Seated } from "@lib/types";
```

Add these new `describe` blocks anywhere after the existing `describe("applyShanghaiDart — completion at round 20", ...)` block (e.g. right before `describe("applyShanghaiDart — terminal state guard", ...)`):

```ts
describe("applyShanghaiDart — Hard mode (Target Needed)", () => {
  function midGameState(totalScore: number): ShanghaiSeatState {
    return {
      participantRef: "participant-1",
      sideKey: "A",
      targetIndex: 1,
      totalScore,
      dartsThisVisit: [],
      status: "IN_PROGRESS",
    };
  }

  it("halves the running total, round-half-up, when a round lands zero target hits", () => {
    let state = midGameState(15);
    state = applyShanghaiDart(state, missObservation(), "HARD");
    state = applyShanghaiDart(state, missObservation(), "HARD");
    state = applyShanghaiDart(state, missObservation(), "HARD");
    expect(state.totalScore).toBe(8);
    expect(state.targetIndex).toBe(2);
    expect(state.status).toBe("IN_PROGRESS");
  });

  it("never halves a round with at least one target hit, however little it scores", () => {
    let state = midGameState(15);
    state = applyShanghaiDart(
      state,
      hitObservationFor(state, "SINGLE"),
      "HARD",
    );
    state = applyShanghaiDart(state, missObservation(), "HARD");
    state = applyShanghaiDart(state, missObservation(), "HARD");
    expect(state.totalScore).toBe(17);
  });

  it("is a no-op under NORMAL difficulty — a zero-hit round just adds 0, same as today", () => {
    let state = midGameState(15);
    state = applyShanghaiDart(state, missObservation(), "NORMAL");
    state = applyShanghaiDart(state, missObservation(), "NORMAL");
    state = applyShanghaiDart(state, missObservation(), "NORMAL");
    expect(state.totalScore).toBe(15);
  });

  it("defaults to NORMAL when no difficulty argument is passed (every V1 call site unaffected)", () => {
    let state = midGameState(15);
    state = applyShanghaiDart(state, missObservation());
    state = applyShanghaiDart(state, missObservation());
    state = applyShanghaiDart(state, missObservation());
    expect(state.totalScore).toBe(15);
  });

  it("a Shanghai is unaffected by difficulty, since it can never coincide with a zero-hit visit", () => {
    let state = initialShanghaiState(config).seats[0];
    state = applyShanghaiDart(
      state,
      hitObservationFor(state, "SINGLE"),
      "HARD",
    );
    state = applyShanghaiDart(
      state,
      hitObservationFor(state, "DOUBLE"),
      "HARD",
    );
    state = applyShanghaiDart(
      state,
      hitObservationFor(state, "TREBLE"),
      "HARD",
    );
    expect(state.status).toBe("SHANGHAI");
    expect(state.totalScore).toBe(6);
  });
});

describe("shanghaiV2EngineFactory", () => {
  it("registers itself under SHANGHAI_V2", () => {
    expect(shanghaiV2EngineFactory.rulesetVersionKey).toBe("SHANGHAI_V2");
    expect(getEngineFactory("SHANGHAI_V2")).toBe(shanghaiV2EngineFactory);
  });

  it("builds a ShanghaiEngine bound to SHANGHAI_V2, applying Hard-mode halving end to end", () => {
    const hardConfig: Seated<ShanghaiV2Snapshot> = {
      seats: SEATS,
      difficulty: "HARD",
    };
    const engine = shanghaiV2EngineFactory.create(hardConfig);
    expect(engine).toBeInstanceOf(ShanghaiEngine);
    expect(engine.rulesetVersionKey).toBe("SHANGHAI_V2");

    for (let round = 0; round < 2; round++) {
      engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
      engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
      engine.record(hitObservationFor(engine.state().seats[0], "SINGLE"));
    }
    expect(engine.state().seats[0].totalScore).toBe(9);

    engine.record(missObservation());
    engine.record(missObservation());
    engine.record(missObservation());
    expect(engine.state().seats[0].totalScore).toBe(5);
  });

  it("a SHANGHAI_V2 engine with NORMAL difficulty behaves exactly like V1", () => {
    const normalConfig: Seated<ShanghaiV2Snapshot> = {
      seats: SEATS,
      difficulty: "NORMAL",
    };
    const engine = shanghaiV2EngineFactory.create(normalConfig);
    engine.record(missObservation());
    engine.record(missObservation());
    engine.record(missObservation());
    expect(engine.state().seats[0].totalScore).toBe(0);
    expect(engine.state().seats[0].targetIndex).toBe(1);
  });
});
```

- [ ] **Step 2: Run the engine tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/shanghai.engine.module.test.ts`
Expected: FAIL — `applyShanghaiDart` doesn't accept a 3rd argument yet, `shanghaiV2EngineFactory` doesn't exist yet (TypeScript/import error).

- [ ] **Step 3: Write the failing validator tests**

In `app/tests/services/rulesets/shanghai/shanghai.validator.test.ts`, add this import and these `describe` blocks at the end of the file:

```ts
import { shanghaiV2Validator } from "@services/rulesets/shanghai/shanghai.validator";
```

```ts
describe("shanghaiV2Validator.validateConfig", () => {
  it("accepts RECREATIONAL + DETAILED_DARTS with a NORMAL difficulty config", () => {
    const result = shanghaiV2Validator.validateConfig({
      config: { difficulty: "NORMAL" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts a HARD difficulty config", () => {
    const result = shanghaiV2Validator.validateConfig({
      config: { difficulty: "HARD" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a config missing difficulty (the schema requires it)", () => {
    const result = shanghaiV2Validator.validateConfig({
      config: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects an unrecognized difficulty value", () => {
    const result = shanghaiV2Validator.validateConfig({
      config: { difficulty: "IMPOSSIBLE" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a config carrying an unrecognized key (the schema is .strict())", () => {
    const result = shanghaiV2Validator.validateConfig({
      config: { difficulty: "NORMAL", rounds: 7 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("accepts ANALYTICS + VISUAL_BOARD with a valid difficulty config", () => {
    const result = shanghaiV2Validator.validateConfig({
      config: { difficulty: "NORMAL" },
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });
});
```

In `app/tests/services/rulesets/registry.test.ts`, add this test right after `"returns the 121 V2 validator for 121_V2"`:

```ts
  it("returns the Shanghai V2 validator for SHANGHAI_V2", () => {
    expect(getRulesetValidator("SHANGHAI_V2")).toBeDefined();
  });
```

- [ ] **Step 4: Run the validator/registry tests to verify they fail**

Run: `cd app && npx vitest run tests/services/rulesets/shanghai/shanghai.validator.test.ts tests/services/rulesets/registry.test.ts`
Expected: FAIL — `shanghaiV2Validator` does not exist, `getRulesetValidator("SHANGHAI_V2")` returns `undefined`.

- [ ] **Step 5: Implement the engine changes**

In `app/src/modules/game/shanghai.engine.module.ts`, change the top import:

```ts
import type { ShanghaiSnapshot, Seated, SeatFact } from "@lib/types";
```

to:

```ts
import type {
  RulesetVersionKey,
  Seated,
  SeatFact,
  ShanghaiSnapshot,
  ShanghaiV2Snapshot,
} from "@lib/types";
```

Right after `const LAST_TARGET_INDEX = 19;`, insert:

```ts
type ShanghaiEngineConfig =
  | Seated<ShanghaiSnapshot>
  | Seated<ShanghaiV2Snapshot>;

type ShanghaiDifficulty = ShanghaiV2Snapshot["difficulty"];

/**
 * Reads the Hard-mode toggle off either ruleset version's config.
 * `"difficulty" in config` is false for every SHANGHAI_V1 config (its
 * schema has no such key at all), so a V1-created engine always folds as
 * `"NORMAL"` — byte-identical to today's behaviour.
 */
function difficultyOf(config: ShanghaiEngineConfig): ShanghaiDifficulty {
  return "difficulty" in config ? config.difficulty : "NORMAL";
}
```

Change the `initialShanghaiState` signature:

```ts
export function initialShanghaiState(
  config: Seated<ShanghaiSnapshot>,
): ShanghaiState {
```

to:

```ts
export function initialShanghaiState(
  config: ShanghaiEngineConfig,
): ShanghaiState {
```

Replace the whole `applyShanghaiDart` function body:

```ts
export function applyShanghaiDart(
  state: ShanghaiSeatState,
  observation: DartObservation,
): ShanghaiSeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session has ended; undo first to correct it.",
    );
  }

  const targetNumber = activeNumberAt(state.targetIndex);
  const onTarget =
    observation.hitTargetNumber === targetNumber &&
    zoneBucketOf(observation.hitZoneKey) !== null;
  const totalScore = onTarget
    ? state.totalScore + boardScore(targetNumber, observation.hitZoneKey)
    : state.totalScore;
  const dartsThisVisit = [
    ...state.dartsThisVisit,
    onTarget ? observation.hitZoneKey : null,
  ];

  if (dartsThisVisit.length < 3) {
    return { ...state, totalScore, dartsThisVisit };
  }
  if (isShanghai(dartsThisVisit)) {
    return { ...state, totalScore, dartsThisVisit: [], status: "SHANGHAI" };
  }
  if (state.targetIndex === LAST_TARGET_INDEX) {
    return { ...state, totalScore, dartsThisVisit: [], status: "COMPLETE" };
  }
  return {
    ...state,
    totalScore,
    dartsThisVisit: [],
    targetIndex: state.targetIndex + 1,
  };
}
```

with:

```ts
/**
 * Pure reducer: folds one dart observation onto one seat's `ShanghaiSeatState`.
 * `difficulty` defaults to `"NORMAL"` so every V1 call site (including this
 * file's own `foldShanghaiState` for a V1 config) is unaffected. Under
 * `"HARD"`, a visit that lands zero target hits — every entry in
 * `dartsThisVisit` is `null` once it reaches length 3 — halves `totalScore`
 * (round-half-up) instead of leaving it unchanged; a visit with at least one
 * hit is never penalized. This can never coincide with a Shanghai (which
 * needs all three zone kinds present), so the halving check runs ahead of
 * the Shanghai/complete/advance branch without affecting which of those
 * three a visit resolves to.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyShanghaiDart(
  state: ShanghaiSeatState,
  observation: DartObservation,
  difficulty: ShanghaiDifficulty = "NORMAL",
): ShanghaiSeatState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session has ended; undo first to correct it.",
    );
  }

  const targetNumber = activeNumberAt(state.targetIndex);
  const onTarget =
    observation.hitTargetNumber === targetNumber &&
    zoneBucketOf(observation.hitZoneKey) !== null;
  const totalScore = onTarget
    ? state.totalScore + boardScore(targetNumber, observation.hitZoneKey)
    : state.totalScore;
  const dartsThisVisit = [
    ...state.dartsThisVisit,
    onTarget ? observation.hitZoneKey : null,
  ];

  if (dartsThisVisit.length < 3) {
    return { ...state, totalScore, dartsThisVisit };
  }

  const missedEveryDart = dartsThisVisit.every((zone) => zone === null);
  const resolvedTotal =
    difficulty === "HARD" && missedEveryDart
      ? Math.round(totalScore / 2)
      : totalScore;

  if (isShanghai(dartsThisVisit)) {
    return {
      ...state,
      totalScore: resolvedTotal,
      dartsThisVisit: [],
      status: "SHANGHAI",
    };
  }
  if (state.targetIndex === LAST_TARGET_INDEX) {
    return {
      ...state,
      totalScore: resolvedTotal,
      dartsThisVisit: [],
      status: "COMPLETE",
    };
  }
  return {
    ...state,
    totalScore: resolvedTotal,
    dartsThisVisit: [],
    targetIndex: state.targetIndex + 1,
  };
}
```

Replace the `foldShanghaiState` signature and its `foldSeatStates` call:

```ts
export function foldShanghaiState(
  facts: EngineFacts,
  config: Seated<ShanghaiSnapshot>,
): ShanghaiState {
  const seats = foldSeatStates(
    facts.turns,
    config.seats,
    initialSeatState,
    applyShanghaiDart,
  );
```

with:

```ts
export function foldShanghaiState(
  facts: EngineFacts,
  config: ShanghaiEngineConfig,
): ShanghaiState {
  const difficulty = difficultyOf(config);
  const seats = foldSeatStates(
    facts.turns,
    config.seats,
    initialSeatState,
    (state, observation) => applyShanghaiDart(state, observation, difficulty),
  );
```

Replace the class field and constructor:

```ts
export class ShanghaiEngine implements GameEngine<
  DartObservation,
  ShanghaiState
> {
  readonly rulesetVersionKey = "SHANGHAI_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: Seated<ShanghaiSnapshot>,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }
```

with:

```ts
export class ShanghaiEngine implements GameEngine<
  DartObservation,
  ShanghaiState
> {
  readonly rulesetVersionKey: RulesetVersionKey;
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly turns: TurnFact[];

  constructor(
    private readonly config: ShanghaiEngineConfig,
    prior?: EngineFacts,
    rulesetVersionKey: RulesetVersionKey = "SHANGHAI_V1",
  ) {
    this.rulesetVersionKey = rulesetVersionKey;
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }
```

Finally, at the bottom of the file, right after the existing `registerEngineFactory(shanghaiEngineFactory);` line, add:

```ts
export const shanghaiV2EngineFactory: GameEngineFactory<
  Seated<ShanghaiV2Snapshot>,
  DartObservation,
  ShanghaiState
> = {
  rulesetVersionKey: "SHANGHAI_V2",
  stageOwnership: "PER_SEAT",
  create(config: Seated<ShanghaiV2Snapshot>, prior?: EngineFacts) {
    return new ShanghaiEngine(config, prior, "SHANGHAI_V2");
  },
};

registerEngineFactory(shanghaiV2EngineFactory);
```

- [ ] **Step 6: Run the engine tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/shanghai.engine.module.test.ts`
Expected: PASS, every test green (including all pre-existing V1 tests, unchanged).

- [ ] **Step 7: Implement the validator and registry changes**

In `app/src/services/rulesets/shanghai/shanghai.validator.ts`, replace the whole file body:

```ts
import { ShanghaiConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

/**
 * Shanghai supports two mode pairs, and asserts nothing beyond the shared
 * three-dart rules: a non-empty dart list per visit under either capture
 * mode, non-negative board scores under RECREATIONAL + DETAILED_DARTS, and
 * coordinate re-derivation under ANALYTICS + VISUAL_BOARD.
 */
export const shanghaiValidator: RulesetValidator = createThreeDartValidator({
  label: "Shanghai",
  configSchema: ShanghaiConfig,
  dartlessIssue: (clientKey) =>
    `turn ${clientKey} must carry dart rows — every Shanghai visit is exactly 3 darts, hit or miss, never a dartless total`,
});
```

with:

```ts
import { ShanghaiConfig, ShanghaiV2Config } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import { createThreeDartValidator } from "../three-dart.validator";

const DARTLESS_ISSUE = (clientKey: string) =>
  `turn ${clientKey} must carry dart rows — every Shanghai visit is exactly 3 darts, hit or miss, never a dartless total`;

/**
 * Shanghai supports two mode pairs, and asserts nothing beyond the shared
 * three-dart rules: a non-empty dart list per visit under either capture
 * mode, non-negative board scores under RECREATIONAL + DETAILED_DARTS, and
 * coordinate re-derivation under ANALYTICS + VISUAL_BOARD. `validateBatch`
 * never reads `config` against a schema — only `validateConfig` does — so
 * V1 and V2 share this one `createThreeDartValidator` shape, parameterised
 * only by which config schema `validateConfig` parses against, mirroring
 * `one-twenty-one.validator.ts`'s V1/V2 split.
 */
export const shanghaiValidator: RulesetValidator = createThreeDartValidator({
  label: "Shanghai",
  configSchema: ShanghaiConfig,
  dartlessIssue: DARTLESS_ISSUE,
});

export const shanghaiV2Validator: RulesetValidator = createThreeDartValidator({
  label: "Shanghai",
  configSchema: ShanghaiV2Config,
  dartlessIssue: DARTLESS_ISSUE,
});
```

In `app/src/services/rulesets/registry.ts`, change:

```ts
import { shanghaiValidator } from "./shanghai/shanghai.validator";
```

to:

```ts
import { shanghaiValidator } from "./shanghai/shanghai.validator";
import { shanghaiV2Validator } from "./shanghai/shanghai.validator";
```

and change:

```ts
  SHANGHAI_V1: shanghaiValidator,
```

to:

```ts
  SHANGHAI_V1: shanghaiValidator,
  SHANGHAI_V2: shanghaiV2Validator,
```

- [ ] **Step 8: Run the validator/registry tests to verify they pass**

Run: `cd app && npx vitest run tests/services/rulesets/shanghai/shanghai.validator.test.ts tests/services/rulesets/registry.test.ts`
Expected: PASS, every test green.

- [ ] **Step 9: Structural gate check**

Run: `bash scripts/check-game-engines.sh`
Expected: `OK: app/src/modules/game/shanghai.engine.module.ts conforms (rulesetVersionKey: SHANGHAI_V1 SHANGHAI_V2).` among the output, and `OK: all N game engine module(s) conform...` with no `FAIL` lines.

- [ ] **Step 10: Commit (engine + validator + registry together — do not split)**

```bash
git add app/src/modules/game/shanghai.engine.module.ts \
  app/src/services/rulesets/shanghai/shanghai.validator.ts \
  app/src/services/rulesets/registry.ts \
  app/tests/modules/game/shanghai.engine.module.test.ts \
  app/tests/services/rulesets/shanghai/shanghai.validator.test.ts \
  app/tests/services/rulesets/registry.test.ts
git commit -m "Add SHANGHAI_V2 engine, validator, and registry entry"
```

---

## Task 4: Setup UI — difficulty toggle

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/shanghai-setup.data.ts`
- Modify: `app/src/components/layout/games/setup/ShanghaiSetupForm.astro`
- Test: `app/tests/lib/game/shanghai-setup.data.test.ts`

**Interfaces:**
- Consumes: `createPresetSetupController` (`app/src/lib/game/setup-controller.ts`, unchanged), `Toggle.astro`/`SettingSectionShell.astro` (unchanged).
- Produces: `ShanghaiSetupContext` gains `difficulty: "NORMAL" | "HARD"`; `shanghaiSetup()` creates `SHANGHAI_V2` sessions with `difficulty` in `configOverrides`.

- [ ] **Step 1: Write the failing setup-data test**

Replace the whole contents of `app/tests/lib/game/shanghai-setup.data.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { shanghaiSetup } from "@lib/game/shanghai-setup.data";
import type { ShanghaiSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const STANDARD_PRESET = {
  configurationTemplateId: "tmpl-shanghai-standard",
  gameTypeKey: "SHANGHAI",
  name: "Shanghai — Standard",
  description: null,
  configuration: {},
  isSystemTemplate: true,
} as any;

describe("shanghaiSetup", () => {
  let store: ShanghaiSetupContext["$store"];

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
    overrides: Partial<ShanghaiSetupContext> = {},
  ): ShanghaiSetupContext {
    return {
      ...shanghaiSetup(),
      $store: store,
      ...overrides,
    } as ShanghaiSetupContext;
  }

  describe("init", () => {
    it("loads the single seeded preset and starts on NORMAL difficulty", () => {
      const setup = createSetup();
      expect(setup.difficulty).toBe("NORMAL");
    });

    it("loads the single seeded preset", async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

      await setup.init();

      expect(presetsApi.fetchConfigurationPresets).toHaveBeenCalledWith(
        "SHANGHAI",
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
        { sessionId: "match-id", gameTypeKey: "SHANGHAI" } as any,
      ]);
      store.game.sessionId = "match-id";

      await setup.init();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toEqual({
        sessionId: "match-id",
        gameTypeKey: "SHANGHAI",
      });
    });

    it('blocks with reconciliationFailed on "abandon_failed"', async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        STANDARD_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "server-id", gameTypeKey: "SHANGHAI" } as any,
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
          gameTypeKey: "SHANGHAI",
        } as any,
      });
      const locationSpy = { href: "/games/shanghai/setup" };
      vi.stubGlobal("location", locationSpy);

      setup.continueSession();

      expect(locationSpy.href).toBe("/games/shanghai/play");
    });

    it("abandons session when user clicks Abandon", async () => {
      const setup = createSetup({
        activeSession: {
          sessionId: "match-id",
          gameTypeKey: "SHANGHAI",
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
    it("creates a SHANGHAI_V2 session on NORMAL difficulty by default and redirects", async () => {
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
        gameTypeKey: "SHANGHAI",
        rulesetVersionKey: "SHANGHAI_V2",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
        config: {
          source: "template",
          templateRef: "tmpl-shanghai-standard",
          overrides: { difficulty: "NORMAL" },
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-shanghai-standard",
          configSnapshot: {
            difficulty: "NORMAL",
            seats: [
              {
                participantRef: "participant-1",
                displayName: "Player",
                sideKey: "A",
                participantTypeKey: "PLAYER",
              },
            ],
          },
        }),
      );
      expect(locationSpy.href).toBe("/games/shanghai/play");
    });

    it("applies HARD difficulty when chosen", async () => {
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        difficulty: "HARD",
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
          config: expect.objectContaining({
            overrides: { difficulty: "HARD" },
          }),
        }),
      );
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          configSnapshot: expect.objectContaining({ difficulty: "HARD" }),
        }),
      );
    });

    it("falls back to Shanghai's declared pair when settings holds a pair it does not declare", async () => {
      store.settings = {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
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
      expect(setup.error).toBe("Could not find a preset for Shanghai.");
    });

    it("re-reconciles into the active-session modal when create reports SESSION_ALREADY_ACTIVE", async () => {
      const setup = createSetup({ presets: [STANDARD_PRESET] });
      vi.mocked(sessionsApi.createSession).mockRejectedValue(
        Object.assign(new Error("already active"), {
          code: "SESSION_ALREADY_ACTIVE",
        }),
      );
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
        { sessionId: "active-1", gameTypeKey: "SHANGHAI" } as any,
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

- [ ] **Step 2: Run the setup-data test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/shanghai-setup.data.test.ts`
Expected: FAIL — `setup.difficulty` is `undefined`, `createSession` is still called with `rulesetVersionKey: "SHANGHAI_V1"` and no `overrides` key.

- [ ] **Step 3: Update `ShanghaiSetupContext`**

In `app/src/lib/game/types.ts`, change:

```ts
export type ShanghaiSetupContext = PresetSetupContext;
```

to:

```ts
export type ShanghaiSetupContext = PresetSetupContext & {
  difficulty: "NORMAL" | "HARD";
};
```

Also update the now-inaccurate comment above `PresetSetupControllerOptions` — change:

```ts
/**
 * What `createPresetSetupController` needs to know about one game. Everything
 * here is a fact about the game and nothing here is a behaviour switch — the
 * single exception, `configOverrides`, exists because Singles and Doubles
 * Training inject their chosen target order into both the config snapshot and
 * the create-session overrides, and nothing else in the six deviates at all.
 *
 * `label` is not derived from a key. The shipped copy reads `Bob's 27`, not
 * `BOBS27`, and a derivation would silently reword a user-visible message.
 */
```

to:

```ts
/**
 * What `createPresetSetupController` needs to know about one game. Everything
 * here is a fact about the game and nothing here is a behaviour switch — the
 * exception, `configOverrides`, exists because Singles Training, Doubles
 * Training, and Shanghai (V2's difficulty toggle) each inject one player-
 * chosen field into both the config snapshot and the create-session
 * overrides; nothing else among the games still on this controller deviates
 * at all.
 *
 * `label` is not derived from a key. The shipped copy reads `Bob's 27`, not
 * `BOBS27`, and a derivation would silently reword a user-visible message.
 */
```

- [ ] **Step 4: Update `shanghai-setup.data.ts`**

Replace the whole file:

```ts
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { ShanghaiSetupContext } from "./types";

export function shanghaiSetup() {
  return {
    difficulty: "NORMAL" as ShanghaiSetupContext["difficulty"],
    ...createPresetSetupController<ShanghaiSetupContext>({
      gameTypeKey: "SHANGHAI",
      rulesetVersionKey: "SHANGHAI_V2",
      playHref: "/games/shanghai/play",
      label: "Shanghai",
      configOverrides: (ctx) => ({
        difficulty: ctx.difficulty,
      }),
    }),
  };
}
```

- [ ] **Step 5: Run the setup-data test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/shanghai-setup.data.test.ts`
Expected: PASS, every test green.

- [ ] **Step 6: Add the Toggle to `ShanghaiSetupForm.astro`**

Replace the whole file:

```astro
---
// Components
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import SettingSectionShell from "./SettingSectionShell.astro";
import Toggle from "./Toggle.astro";
import UserSection from "./UserSection.astro";

// Data
const infoSection = {
  title: "Shanghai rules",
  description:
    "Twenty rounds, three darts each: round 1 targets the number 1, round 2 targets 2, and so on through 20. Only hits on the round's own number score — single is face value, double is 2x, treble is 3x. Anything else scores 0. Hit single, double and treble of the round's number in one visit, in any order, for a Shanghai — an instant win. Otherwise the session ends after round 20 with your total score.",
};

const difficultyOpts = [
  { value: "NORMAL", label: "Normal" },
  { value: "HARD", label: "Hard" },
];
---

<SetupShell title="Shanghai">
  <UserSection allowGuests />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />
  <SettingSectionShell>
    <Toggle
      orientation="horizontal"
      options={difficultyOpts}
      x-model="difficulty"
      hint="Hard: whiff every dart in a round and your total is halved."
      class="w-full"
    />
  </SettingSectionShell>
</SetupShell>
```

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/types.ts \
  app/src/lib/game/shanghai-setup.data.ts \
  app/src/components/layout/games/setup/ShanghaiSetupForm.astro \
  app/tests/lib/game/shanghai-setup.data.test.ts
git commit -m "Wire Shanghai setup screen to SHANGHAI_V2's difficulty toggle"
```

---

## Task 5: Database seed — SHANGHAI_V2 ruleset version and capabilities

**Files:**
- Create: `database/seeds/0012_shanghai_v2_game_engine_reference.sql`
- Modify: `database/seeds/0007_ruleset_version_capabilities.sql`
- Create: `database/verification/0012_shanghai_v2_capability_checks.sql`
- Test: `app/tests/lib/game/rulesets/capability-seed-parity.test.ts` (no edit — re-run only, it is self-checking)

**Interfaces:** none new — this task only makes the database agree with Task 2's `RULESET_CAPABILITIES` and gives `POST /api/sessions` a `ruleset_versions` row to resolve `SHANGHAI_V2` against.

Why no new `configuration_templates` row: `app/src/services/session.service.ts`'s `createSession` resolves `config.templateRef` scoped only by `gameTypeId` (`findConfigurationTemplate(db, templateRef, gameTypeId, playerId)` — there is no `ruleset_version_id` column on `configuration_templates` at all), then merges `template.configuration` with `config.overrides` and validates the **merged** result against the ruleset's own validator. Task 4's `shanghai-setup.data.ts` always supplies `difficulty` via `configOverrides`, so reusing V1's existing empty (`{}`) "Shanghai — Standard" preset as `SHANGHAI_V2`'s `templateRef` produces a valid merged config every time. Seeding a *second* preset row for the same `SHANGHAI` game type would only introduce risk: `GET /api/configuration-templates?gameType=SHANGHAI` would then return two rows, and `createPresetSetupController`'s `presets[0]` has no way to prefer the right one (unlike `121_V2`, whose own hand-written setup controller disambiguates several presets by filtering on a `duration_type` field none of Shanghai's config carries).

- [ ] **Step 1: Confirm the next free UUIDs**

Run:
```bash
grep -h "'0198f100-0000-7000-8000-" database/seeds/*.sql | sort
```
Expected: the highest existing value is `'0198f100-0000-7000-8000-000000000010'` (121_V2, from `0011_one_twenty_one_v2_game_engine_reference.sql`). If a different branch has since claimed `...000011`, use the next free value instead of what Step 2 below shows and adjust it there.

- [ ] **Step 2: Write `database/seeds/0012_shanghai_v2_game_engine_reference.sql`**

```sql
-- ============================================================
-- Seed: 0012_shanghai_v2_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for Shanghai V2: the same round-by-round
-- target mechanics as Shanghai V1 (rounds 1-20, full board,
-- Shanghai instant win), plus one added setting — Target Needed
-- (difficulty: NORMAL default, or HARD, which halves a seat's
-- running total, round-half-up, on any round with zero target
-- hits). No new game_types row: SHANGHAI_V2 is a new
-- ruleset_versions row under the same SHANGHAI game type 0008
-- already seeded. Without this seed there is no ruleset version
-- to start a SHANGHAI_V2 session from — POST /api/sessions has
-- nothing to look up for SHANGHAI_V2.
--
-- No new configuration_templates row: SHANGHAI_V2's setup
-- controller (app/src/lib/game/shanghai-setup.data.ts) reuses
-- 0008's existing "Shanghai — Standard" preset (configuration
-- {}) as its templateRef and always supplies `difficulty` via
-- its own configOverrides — session.service.ts's createSession
-- merges template.configuration with overrides and validates
-- the MERGED result ({"difficulty": "NORMAL"|"HARD"}) against
-- ShanghaiV2Config, so the empty base preset is sufficient. A
-- second preset row would only risk configuration-templates?
-- gameType=SHANGHAI returning two rows with no way for the
-- generic createPresetSetupController's presets[0] pick to
-- prefer the right one (unlike 121_V2, which disambiguates its
-- own several presets by a duration_type field the picker
-- filters on).
--
-- UUID allocation (continues the 0003 range, next after 0011's
-- 121_V2 row):
-- - 0198f100-...-000011 ruleset_versions (SHANGHAI_V2)
--
-- No game_type_features mapping: no opponent toggle to
-- configure, mirroring 0008's SHANGHAI_V1 reasoning. Round
-- range and Shanghai instant-win stay fixed, mirroring V1.
--
-- No exercise_templates row: nothing outside 0008's own
-- configuration_templates preset currently reads
-- exercise_templates at runtime.
--
-- Capability: SHANGHAI_V2 + RECREATIONAL + DETAILED_DARTS and
-- SHANGHAI_V2 + ANALYTICS + VISUAL_BOARD are declared in
-- seeds/0007_ruleset_version_capabilities.sql, not here — 0007
-- is the single running ledger every ruleset's capability rows
-- are appended to. verification/0012_shanghai_v2_capability_
-- checks.sql asserts the resulting rows.
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
        '0198f100-0000-7000-8000-000000000011',
        '0198f000-0000-7000-8000-000000000007',
        'SHANGHAI_V2',
        2,
        'Shanghai V2: adds a Target Needed difficulty toggle (NORMAL default, HARD) alongside V1''s unchanged round range, scoring and instant-win rules. HARD halves the running total, round-half-up, on any round with zero target hits.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
```

- [ ] **Step 3: Append capability rows to `database/seeds/0007_ruleset_version_capabilities.sql`**

Change:

```sql
            ('SHANGHAI_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SHANGHAI_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('121_V1', 'RECREATIONAL', 'QUICK_SCORE'),
```

to:

```sql
            ('SHANGHAI_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SHANGHAI_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SHANGHAI_V2', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SHANGHAI_V2', 'ANALYTICS', 'VISUAL_BOARD'),
            ('121_V1', 'RECREATIONAL', 'QUICK_SCORE'),
```

- [ ] **Step 4: Write `database/verification/0012_shanghai_v2_capability_checks.sql`**

```sql
-- ============================================================
-- Verification: 0012_shanghai_v2_capability_checks.sql
--
-- Mirrors 0011_one_twenty_one_v2_capability_checks.sql's shape,
-- re-scoped for the additive SHANGHAI_V2 rows appended to 0007_
-- ruleset_version_capabilities.sql's own VALUES list. No
-- PostgreSQL server exists in the container that authored this
-- file (D193), so it asserts against a real Neon database
-- before merge:
--
--   1. SHANGHAI_V2 + RECREATIONAL + DETAILED_DARTS resolved
--   2. SHANGHAI_V2 + ANALYTICS + VISUAL_BOARD resolved
--   3. no exercise_sessions row is left undeclared
--
-- Full-table exact-count parity lives in
-- 0007_capability_seed_checks.sql alone. This script owns only
-- SHANGHAI_V2's own additions.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0012_shanghai_v2_capability_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:seed` has applied seeds/0007 and seeds/0012.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Step 1: SHANGHAI_V2 + RECREATIONAL + DETAILED_DARTS resolved.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    'SHANGHAI_V2 / RECREATIONAL / DETAILED_DARTS resolves to a seeded row',
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN NULL
        WHEN rv.id IS NULL THEN 'no ruleset_versions row for SHANGHAI_V2'
        ELSE 'lookups resolved but no matching ruleset_version_capabilities row'
    END
FROM ruleset_versions rv
    LEFT JOIN capture_modes cm ON cm.implementation_key = 'RECREATIONAL'
    LEFT JOIN input_modes im ON im.implementation_key = 'DETAILED_DARTS'
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id
WHERE rv.implementation_key = 'SHANGHAI_V2';

-- ------------------------------------------------------------
-- Step 2: SHANGHAI_V2 + ANALYTICS + VISUAL_BOARD resolved.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    'SHANGHAI_V2 / ANALYTICS / VISUAL_BOARD resolves to a seeded row',
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN NULL
        WHEN rv.id IS NULL THEN 'no ruleset_versions row for SHANGHAI_V2'
        ELSE 'lookups resolved but no matching ruleset_version_capabilities row'
    END
FROM ruleset_versions rv
    LEFT JOIN capture_modes cm ON cm.implementation_key = 'ANALYTICS'
    LEFT JOIN input_modes im ON im.implementation_key = 'VISUAL_BOARD'
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id
WHERE rv.implementation_key = 'SHANGHAI_V2';

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

- [ ] **Step 5: Re-run the automatic parity test**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capability-seed-parity.test.ts`
Expected: PASS — the seed file's triples and `RULESET_CAPABILITIES` (Task 2) now agree exactly.

- [ ] **Step 6: Commit**

```bash
git add database/seeds/0012_shanghai_v2_game_engine_reference.sql \
  database/seeds/0007_ruleset_version_capabilities.sql \
  database/verification/0012_shanghai_v2_capability_checks.sql
git commit -m "Seed SHANGHAI_V2: ruleset version and capability rows"
```

*(A person with access to a real Neon database should run both verification scripts — `psql "$DATABASE_URL" -f database/verification/0007_capability_seed_checks.sql` and `psql "$DATABASE_URL" -f database/verification/0012_shanghai_v2_capability_checks.sql` — after `npm run db:seed`, before this branch merges. Note this in the PR description; it cannot run inside this container.)*

---

## Task 6: Final gates and full validation

**Files:** none (verification only)

- [ ] **Step 1: Structural gates**

Run:
```bash
bash scripts/check-game-engines.sh
bash scripts/check-game-wiring.sh
```
Expected: both `OK`, `check-game-engines.sh` listing `app/src/modules/game/shanghai.engine.module.ts conforms (rulesetVersionKey: SHANGHAI_V1 SHANGHAI_V2)`.

- [ ] **Step 2: Format**

Run: `cd app && npm run format`
Expected: no diff, or a diff that only touches files this plan edited — commit any formatting fixes separately if the run produces one:

```bash
git add -A
git commit -m "Format"
```

(Only if Step 2 actually produced a diff — skip this commit otherwise.)

- [ ] **Step 3: Full validation chain**

Run: `cd app && npm run validate:app`
Expected: every step exits 0; the type-check step reports 0 errors, 0 warnings, 0 hints (per `app/CLAUDE.md`'s zero-hint bar).

- [ ] **Step 4: Full test suite**

Run: `cd app && npx vitest run`
Expected: PASS, 0 failures across the whole suite (not just the files this plan touched — confirms `ShanghaiEngine`'s constructor-signature and `applyShanghaiDart`'s new-param changes didn't regress anything elsewhere).

- [ ] **Step 5: Manual smoke test (UI)**

Start the dev server in the background (`astro dev --background` per `app/CLAUDE.md`), then in a browser:
1. Go to `/games/shanghai/setup`. Confirm a Normal/Hard toggle renders under "Settings" with the hint caption, defaulting to Normal.
2. Start a Normal session, solo. Play a couple of rounds, including at least one round with zero darts on the active number. Confirm the total only ever adds up (never drops).
3. Start a Hard session, solo. Play one round hitting the target at least once (confirm score simply adds as usual) and one round missing the target entirely (confirm the running total visibly halves, rounding up on an odd total).
4. Confirm a Hard-mode Shanghai (single+double+treble in one visit) still triggers the instant win, with its full value added (no halving).
5. Start a 1v1 Hard session (one guest). Confirm each seat's own total halves independently on its own zero-hit rounds.
6. Confirm a `SHANGHAI_V1` session, if reachable from old data, still plays and replays without error.

Stop the dev server (`astro dev stop`) when done.

- [ ] **Step 6: Context maintenance**

Run the `context-maintenance` skill per root `CLAUDE.md`'s mandatory every-task requirement — updates the context map / decision ledger / knowledge graph as needed for this feature before the task is considered done.

---

## Execution note on Task 5's UUID

The exact UUID value in Task 5's seed file is chosen by continuing the existing `0198f100-0000-7000-8000-NNNNNNNNNNNN` sequential-decimal convention this codebase already uses for `ruleset_versions` (`...009` Around the Clock → `...010` 121_V2 → `...011` here). Task 5 Step 1 re-verifies this is still the next free value before writing the file; if another branch has landed a seed first and claimed it, bump to the next free value in the same sequence.
