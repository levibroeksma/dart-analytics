# Singles & Doubles Training — Analytics Capture (VISUAL_BOARD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `SINGLES_V1` and `DOUBLES_TRAINING_V1` the `ANALYTICS` + `VISUAL_BOARD` capability pair (board-tap coordinate capture) alongside their existing `RECREATIONAL` + `DETAILED_DARTS` keypad capture, mirroring Bob's 27's already-shipped pair.

**Architecture:** Generalize the shared `play-lifecycle.ts` module (rather than re-forking each ruleset into a bespoke play-data module the way Bob's 27 did) to optionally support board input: an additive `hiddenTimer` field plus a mode-gated reveal-then-clear branch in `playCommitDart`, and a new shared `playVisitMarkers` helper extracted from Bob's 27's own override. Both engines gain a one-line fix so a dart's real `locationX`/`locationY` reaches its fact instead of a hardcoded `null`. Validators gain the same `isDetailedDartsOrVisualBoardCapture` dispatch shape `bobs27.validator.ts` already uses.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, PostgreSQL (Neon) seeds, Vitest.

**Design spec:** `docs/superpowers/specs/2026-08-15-singles-doubles-training-analytics-design.md` (approved).

## Global Constraints

- Branch: `claude/singles-doubles-analytics-4qzc9j`. Never push to a different branch. Do not open a PR unless explicitly asked.
- Never modify applied migrations (`0001`–`0021`). No schema/migration change is needed for this work — `location_x`/`location_y` and `chk_dart_location_pair` already exist (migration `0018`).
- Store facts, derive meaning: engines never persist accumulated values — only extend what's already stored (`locationX`/`locationY` on the dart fact).
- No `//`/`/* */` comments inside TypeScript function/method bodies (`app/src/**/*.ts`); put necessary detail in JSDoc above the declaration.
- Semantic Tailwind tokens only in `.astro`; reuse `BoardInputPanel.astro` unchanged.
- Tests live under `app/tests/`, mirroring `app/src/`'s structure — never colocated.
- Run `cd app && npm run format` and confirm `npm run format:check` is clean before any commit that touches formatting-sensitive files.
- Full validation gate: `cd app && npm run validate:app` must pass before the branch is considered done (final task).
- A new engine's `rulesetVersionKey` + server-side validator must land in the same commit (`scripts/check-game-engines.sh`, pre-commit) — not applicable here (no new engine), but keep each task's own commit self-consistent so the full test suite is green after every commit.
- Commit after every task's tests pass. Use clear, descriptive commit messages.

---

## Task 1: Singles Training engine — carry dart location facts

**Files:**
- Modify: `app/src/modules/game/singles-training.engine.module.ts:200-209`
- Test: `app/tests/modules/game/singles-training.engine.module.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SinglesTrainingEngine.record()`'s `DartFact.locationX`/`locationY` now reflect the recorded `DartObservation`'s own `locationX`/`locationY` instead of always `null`. No signature change.

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/modules/game/singles-training.engine.module.test.ts`, after the existing `describe("SinglesTrainingEngine.facts", ...)` block (before `describe("SinglesTrainingEngine", ...)`):

```ts
describe("SinglesTrainingEngine — dart location facts", () => {
  it("carries the observation's locationX/locationY onto the dart fact", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: 12.5,
      locationY: -40.25,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.locationX).toBe(12.5);
    expect(dart.locationY).toBe(-40.25);
  });

  it("keeps the dart's location null for a keypad-entered dart", () => {
    const engine = new SinglesTrainingEngine(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.locationX).toBeNull();
    expect(dart.locationY).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify the first one fails**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts -t "dart location facts"`
Expected: the "carries the observation's locationX/locationY" case FAILS (`expected null to be 12.5`); the keypad-null case passes already.

- [ ] **Step 3: Fix the engine**

In `app/src/modules/game/singles-training.engine.module.ts`, inside `record()`:

```ts
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
```

(only the last two field values change, from `null` to `observation.locationX`/`observation.locationY`)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
cd app && git add src/modules/game/singles-training.engine.module.ts tests/modules/game/singles-training.engine.module.test.ts
git commit -m "fix(singles-training): carry dart location onto the fact log"
```

---

## Task 2: Doubles Training engine — carry dart location facts

**Files:**
- Modify: `app/src/modules/game/doubles-training.engine.module.ts:220-233`
- Test: `app/tests/modules/game/doubles-training.engine.module.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `DoublesTrainingEngine.record()`'s `DartFact.locationX`/`locationY` now reflect the observation. No signature change.

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/modules/game/doubles-training.engine.module.test.ts`, after the existing `describe("DoublesTrainingEngine.facts", ...)` block (before `describe("DoublesTrainingEngine", ...)`):

```ts
describe("DoublesTrainingEngine — dart location facts", () => {
  it("carries the observation's locationX/locationY onto the dart fact", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: 5,
      locationY: -132,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.locationX).toBe(5);
    expect(dart.locationY).toBe(-132);
  });

  it("keeps the dart's location null for a keypad-entered dart", () => {
    const engine = new DoublesTrainingEngine(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.locationX).toBeNull();
    expect(dart.locationY).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify the first one fails**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts -t "dart location facts"`
Expected: the first case FAILS (`expected null to be 5`).

- [ ] **Step 3: Fix the engine**

In `app/src/modules/game/doubles-training.engine.module.ts`, inside `record()`:

```ts
    const dart: DartFact = {
      sequence: openTurn.darts.length + 1,
      intendedTargetNumber:
        target.kind === "BULL" ? BULL_TARGET_NUMBER : target.number,
      intendedZoneKey,
      hitTargetNumber: observation.hitTargetNumber,
      hitZoneKey: observation.hitZoneKey,
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
      locationX: observation.locationX,
      locationY: observation.locationY,
    };
```

(only the last two field values change)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
cd app && git add src/modules/game/doubles-training.engine.module.ts tests/modules/game/doubles-training.engine.module.test.ts
git commit -m "fix(doubles-training): carry dart location onto the fact log"
```

---

## Task 3: Singles Training — VISUAL_BOARD capability, validator, seed, verification

**Files:**
- Modify: `app/src/lib/game/rulesets/capabilities.ts`
- Modify: `app/src/services/rulesets/singles-training/singles-training.validator.ts`
- Modify: `database/seeds/0007_ruleset_version_capabilities.sql`
- Modify: `database/verification/0007_capability_seed_checks.sql`
- Modify: `app/tests/lib/game/rulesets/games-visibility.test.ts`
- Test: `app/tests/services/rulesets/singles-training/singles-training.validator.test.ts`

**Interfaces:**
- Consumes: `isVisualBoardCapture`, `validateVisualBoardTurns`, `VISUAL_BOARD_MODES` from `app/src/services/rulesets/visual-board.validator.ts` (unchanged, already used by `bobs27.validator.ts`).
- Produces: `RULESET_CAPABILITIES.SINGLES_V1 = [DETAILED_DARTS, VISUAL_BOARD]`; `singlesTrainingValidator` accepts and routes both mode pairs.

- [ ] **Step 1: Write the failing validator tests**

Add to `app/tests/services/rulesets/singles-training/singles-training.validator.test.ts`, at the end of the file:

```ts
describe("singlesTrainingValidator.validateConfig — visual board", () => {
  it("accepts ANALYTICS + VISUAL_BOARD with a valid config", () => {
    const result = singlesTrainingValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });
});

describe("singlesTrainingValidator.validateBatch — visual board", () => {
  it("validates a visual-board batch through the coordinate validator", () => {
    const batch = {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "turn-1",
              participantRef: "p1",
              sequence: 1,
              totalScore: 60,
              completedAt: "2026-08-15T12:00:00.000Z",
              darts: [
                {
                  sequence: 1,
                  intendedTargetNumber: null,
                  intendedZoneKey: null,
                  hitTargetNumber: 20,
                  hitZoneKey: "TREBLE",
                  score: 60,
                  locationX: 0,
                  locationY: -102,
                },
              ],
            },
          ],
        },
      ],
    };

    const result = singlesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batch as never,
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(true);
  });

  it("rejects a dartless turn under VISUAL_BOARD capture", () => {
    const result = singlesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[]]),
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a dart whose claimed zone disagrees with its location", () => {
    const batch = {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "turn-1",
              participantRef: "p1",
              sequence: 1,
              totalScore: 20,
              completedAt: "2026-08-15T12:00:00.000Z",
              darts: [
                {
                  sequence: 1,
                  intendedTargetNumber: null,
                  intendedZoneKey: null,
                  hitTargetNumber: 20,
                  hitZoneKey: "SINGLE",
                  score: 20,
                  locationX: 0,
                  locationY: -102,
                },
              ],
            },
          ],
        },
      ],
    };

    const result = singlesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batch as never,
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/services/rulesets/singles-training/singles-training.validator.test.ts`
Expected: the four new tests FAIL — `validateConfig` currently rejects any pair except `RECREATIONAL + DETAILED_DARTS`.

- [ ] **Step 3: Rewrite the validator**

Replace the full contents of `app/src/services/rulesets/singles-training/singles-training.validator.ts`:

```ts
import { SinglesConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import {
  isVisualBoardCapture,
  validateVisualBoardTurns,
  VISUAL_BOARD_MODES,
} from "../visual-board.validator";
import type { EventsBatchRequestInput } from "@routes/types";
import type {
  BatchValidationResult,
  ConfigValidationResult,
} from "@services/types";

const ALLOWED_CAPTURE_MODE = "RECREATIONAL";
const ALLOWED_INPUT_MODE = "DETAILED_DARTS";
const DETAILED_DARTS_MODES = `${ALLOWED_CAPTURE_MODE} + ${ALLOWED_INPUT_MODE}`;

/** Same ceiling every other coordinate-capturing ruleset uses for a dartless keypad visit (3 darts, treble 20 max) — Singles Training has no `max_visit_score` config field to read one from. */
const DEFAULT_MAX_TURN_SCORE = 180;

/** Whether a session's mode pair is Singles Training's own per-dart keypad capture. */
function isDetailedDartsCapture(
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  return (
    captureModeKey === ALLOWED_CAPTURE_MODE &&
    inputModeKey === ALLOWED_INPUT_MODE
  );
}

/**
 * Whether a session's mode pair is one Singles Training actually implements:
 * RECREATIONAL + DETAILED_DARTS for a per-dart keypad capture, or
 * ANALYTICS + VISUAL_BOARD for a coordinate capture. Mirrors
 * `bobs27.validator.ts`'s `isDetailedDartsOrVisualBoardCapture`.
 */
function isDetailedDartsOrVisualBoardCapture(
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  return (
    isDetailedDartsCapture(captureModeKey, inputModeKey) ||
    isVisualBoardCapture(captureModeKey, inputModeKey)
  );
}

/**
 * Every Singles Training visit, under either capture mode, carries at least
 * one dart row — never a dartless total. Returns the rejection, or `null`
 * when every turn in the batch carries at least one dart.
 */
function rejectDartlessTurn(
  batch: EventsBatchRequestInput,
): BatchValidationResult | null {
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
      if (turn.darts.length === 0) {
        return {
          valid: false,
          code: "VALIDATION_FAILED",
          issues: [
            `turn ${turn.clientKey} must carry dart rows — every Singles Training visit is exactly 3 darts, hit or miss, never a dartless total`,
          ],
        };
      }
    }
  }
  return null;
}

/**
 * Under RECREATIONAL + DETAILED_DARTS every dart's board score must be
 * non-negative. Returns the rejection, or `null` when every dart in the batch
 * clears that floor.
 */
function rejectNegativeDartScore(
  batch: EventsBatchRequestInput,
): BatchValidationResult | null {
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
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
  return null;
}

/**
 * Singles Training supports two mode pairs. Under RECREATIONAL +
 * DETAILED_DARTS its engine emits one dart row per throw, so every turn in a
 * batch must carry at least one and no dart's board score may be negative.
 * Under ANALYTICS + VISUAL_BOARD every dart carries a landing coordinate,
 * re-derived and cross-checked by `validateVisualBoardTurns`.
 */
export const singlesTrainingValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (!isDetailedDartsOrVisualBoardCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [
          `Singles Training V1 only supports ${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES}`,
        ],
      };
    }
    const parsed = SinglesConfig.safeParse(config);
    if (!parsed.success) {
      return { valid: false, issues: parsed.error.issues };
    }
    return { valid: true, config: parsed.data };
  },

  validateBatch({
    batch,
    captureModeKey,
    inputModeKey,
  }: {
    config: Record<string, unknown>;
    batch: EventsBatchRequestInput;
    existingTurnCount: number;
    captureModeKey: string;
    inputModeKey: string;
  }): BatchValidationResult {
    const dartlessRejection = rejectDartlessTurn(batch);
    if (dartlessRejection) return dartlessRejection;

    if (isVisualBoardCapture(captureModeKey, inputModeKey)) {
      return validateVisualBoardTurns(batch, DEFAULT_MAX_TURN_SCORE);
    }

    const negativeScoreRejection = rejectNegativeDartScore(batch);
    if (negativeScoreRejection) return negativeScoreRejection;

    return { valid: true };
  },
};
```

- [ ] **Step 4: Declare the capability**

In `app/src/lib/game/rulesets/capabilities.ts`, change:

```ts
  SINGLES_V1: [DETAILED_DARTS],
```

to:

```ts
  SINGLES_V1: [DETAILED_DARTS, VISUAL_BOARD],
```

- [ ] **Step 5: Run the validator and parity tests**

Run: `cd app && npx vitest run tests/services/rulesets/singles-training/singles-training.validator.test.ts tests/lib/game/rulesets/capability-validator-parity.test.ts`
Expected: PASS, all tests.

- [ ] **Step 6: Update `games-visibility.test.ts`**

`SINGLES_V1` is no longer the sole `ANALYTICS`-pair exception. In `app/tests/lib/game/rulesets/games-visibility.test.ts`, replace the top comment block:

```ts
// Every card in GAME_CARDS is a ruleset that has a real setup route, so a key
// asserted here is a card that can actually render. Visibility is keyed on
// capture mode alone, not the exact declared pair (see `visibleGames`'s own
// doc comment for why). Most carded rulesets declare a pair under both
// RECREATIONAL and ANALYTICS and so are visible under both real app modes —
// SINGLES_V1 is the first exception, declaring only RECREATIONAL +
// DETAILED_DARTS, so its card is RECREATIONAL-only.
```

with:

```ts
// Every card in GAME_CARDS is a ruleset that has a real setup route, so a key
// asserted here is a card that can actually render. Visibility is keyed on
// capture mode alone, not the exact declared pair (see `visibleGames`'s own
// doc comment for why). Most carded rulesets declare a pair under both
// RECREATIONAL and ANALYTICS and so are visible under both real app modes —
// DOUBLES_TRAINING_V1 is the remaining exception, declaring only
// RECREATIONAL + DETAILED_DARTS, so its card is RECREATIONAL-only.
```

and replace the analytics-visibility test:

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
    expect(keys).not.toContain("AROUND_THE_CLOCK_V1");
  });
```

with:

```ts
  it("shows every carded game that declares an analytics pair, and no others, under analytics", () => {
    const keys = visibleGames("ANALYTICS", null)
      .map((game) => game.rulesetVersionKey)
      .sort();
    expect(keys).toEqual([
      "501_V1",
      "BOBS27_V1",
      "SCORE_TRAINING_V1",
      "SINGLES_V1",
    ]);
    expect(keys).not.toContain("DOUBLES_TRAINING_V1");
    expect(keys).not.toContain("SHANGHAI_V1");
    expect(keys).not.toContain("121_V1");
    expect(keys).not.toContain("AROUND_THE_CLOCK_V1");
  });
```

- [ ] **Step 7: Add the seed row**

In `database/seeds/0007_ruleset_version_capabilities.sql`, change:

```sql
            ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
```

to:

```sql
            ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SINGLES_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
```

- [ ] **Step 8: Update the verification script in lockstep**

In `database/verification/0007_capability_seed_checks.sql`, there are 3 places tracking the seed's declared triples. All four locations below currently track only the first 9 seeded triples (a pre-existing gap versus the 12-row seed file — leave `SHANGHAI_V1`/`121_V1`/`AROUND_THE_CLOCK_V1` out of scope; only extend by the one new `SINGLES_V1` row so the arithmetic stays internally consistent with itself).

Change:

```sql
INSERT INTO verification_results
SELECT '1',
    'seed inserted exactly the 9 declared rows',
    CASE
        WHEN count(*) = 9 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 9, found %s', count(*))
FROM ruleset_version_capabilities;
```

to:

```sql
INSERT INTO verification_results
SELECT '1',
    'seed inserted exactly the 10 declared rows',
    CASE
        WHEN count(*) = 10 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 10, found %s', count(*))
FROM ruleset_version_capabilities;
```

Change:

```sql
FROM (
        VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS')
    ) AS declared(ruleset_key, capture_key, input_key)
    LEFT JOIN ruleset_versions rv ON rv.implementation_key = declared.ruleset_key
```

to:

```sql
FROM (
        VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SINGLES_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS')
    ) AS declared(ruleset_key, capture_key, input_key)
    LEFT JOIN ruleset_versions rv ON rv.implementation_key = declared.ruleset_key
```

Change:

```sql
INSERT INTO verification_results
SELECT '2',
    'all 9 declared triples were actually checked',
    CASE
        WHEN count(*) = 9 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 9 triple checks ran', count(*))
FROM verification_results
WHERE step = '2';
```

to:

```sql
INSERT INTO verification_results
SELECT '2',
    'all 10 declared triples were actually checked',
    CASE
        WHEN count(*) = 10 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 10 triple checks ran', count(*))
FROM verification_results
WHERE step = '2';
```

Change:

```sql
        FROM (
                VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS')
            ) AS declared(ruleset_key, capture_key, input_key)
```

to:

```sql
        FROM (
                VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('SINGLES_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS')
            ) AS declared(ruleset_key, capture_key, input_key)
```

Per D193 this script needs a live Neon database to run and cannot execute in this container — do not attempt `psql`; note it as unexecuted, same as every prior capability addition.

- [ ] **Step 9: Run the full targeted test set**

Run: `cd app && npx vitest run tests/services/rulesets/singles-training tests/lib/game/rulesets`
Expected: PASS, all tests (includes `capability-seed-parity.test.ts`, `capability-validator-parity.test.ts`, `games-visibility.test.ts`).

- [ ] **Step 10: Commit**

```bash
cd app && git add src/lib/game/rulesets/capabilities.ts src/services/rulesets/singles-training/singles-training.validator.ts tests/services/rulesets/singles-training/singles-training.validator.test.ts tests/lib/game/rulesets/games-visibility.test.ts
cd .. && git add database/seeds/0007_ruleset_version_capabilities.sql database/verification/0007_capability_seed_checks.sql
git commit -m "feat(singles-training): add ANALYTICS + VISUAL_BOARD capability"
```

---

## Task 4: Doubles Training — VISUAL_BOARD capability, validator, seed, verification

**Files:**
- Modify: `app/src/lib/game/rulesets/capabilities.ts`
- Modify: `app/src/services/rulesets/doubles-training/doubles-training.validator.ts`
- Modify: `database/seeds/0007_ruleset_version_capabilities.sql`
- Modify: `database/verification/0007_capability_seed_checks.sql`
- Modify: `app/tests/lib/game/rulesets/games-visibility.test.ts`
- Test: `app/tests/services/rulesets/doubles-training/doubles-training.validator.test.ts`

**Interfaces:**
- Consumes: same `visual-board.validator.ts` exports as Task 3.
- Produces: `RULESET_CAPABILITIES.DOUBLES_TRAINING_V1 = [DETAILED_DARTS, VISUAL_BOARD]`; `doublesTrainingValidator` accepts and routes both mode pairs.

- [ ] **Step 1: Write the failing validator tests**

Add to `app/tests/services/rulesets/doubles-training/doubles-training.validator.test.ts`, at the end of the file:

```ts
describe("doublesTrainingValidator.validateConfig — visual board", () => {
  it("accepts ANALYTICS + VISUAL_BOARD with a valid config", () => {
    const result = doublesTrainingValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });
});

describe("doublesTrainingValidator.validateBatch — visual board", () => {
  it("validates a visual-board batch through the coordinate validator", () => {
    const batch = {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "turn-1",
              participantRef: "p1",
              sequence: 1,
              totalScore: 60,
              completedAt: "2026-08-15T12:00:00.000Z",
              darts: [
                {
                  sequence: 1,
                  intendedTargetNumber: 20,
                  intendedZoneKey: "DOUBLE",
                  hitTargetNumber: 20,
                  hitZoneKey: "TREBLE",
                  score: 60,
                  locationX: 0,
                  locationY: -102,
                },
              ],
            },
          ],
        },
      ],
    };

    const result = doublesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batch as never,
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(true);
  });

  it("rejects a dartless turn under VISUAL_BOARD capture", () => {
    const result = doublesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[]]),
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a dart whose claimed zone disagrees with its location", () => {
    const batch = {
      stages: [
        {
          clientKey: "block-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
          turns: [
            {
              clientKey: "turn-1",
              participantRef: "p1",
              sequence: 1,
              totalScore: 20,
              completedAt: "2026-08-15T12:00:00.000Z",
              darts: [
                {
                  sequence: 1,
                  intendedTargetNumber: 20,
                  intendedZoneKey: "DOUBLE",
                  hitTargetNumber: 20,
                  hitZoneKey: "SINGLE",
                  score: 20,
                  locationX: 0,
                  locationY: -102,
                },
              ],
            },
          ],
        },
      ],
    };

    const result = doublesTrainingValidator.validateBatch({
      config: validConfig,
      batch: batch as never,
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/services/rulesets/doubles-training/doubles-training.validator.test.ts`
Expected: the four new tests FAIL.

- [ ] **Step 3: Rewrite the validator**

Replace the full contents of `app/src/services/rulesets/doubles-training/doubles-training.validator.ts`:

```ts
import { DoublesTrainingConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import {
  isVisualBoardCapture,
  validateVisualBoardTurns,
  VISUAL_BOARD_MODES,
} from "../visual-board.validator";
import type { EventsBatchRequestInput } from "@routes/types";
import type {
  BatchValidationResult,
  ConfigValidationResult,
} from "@services/types";

const ALLOWED_CAPTURE_MODE = "RECREATIONAL";
const ALLOWED_INPUT_MODE = "DETAILED_DARTS";
const DETAILED_DARTS_MODES = `${ALLOWED_CAPTURE_MODE} + ${ALLOWED_INPUT_MODE}`;

/** Same ceiling every other coordinate-capturing ruleset uses for a dartless keypad visit (3 darts, treble 20 max) — Doubles Training has no `max_visit_score` config field to read one from. */
const DEFAULT_MAX_TURN_SCORE = 180;

/** Whether a session's mode pair is Doubles Training's own per-dart keypad capture. */
function isDetailedDartsCapture(
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  return (
    captureModeKey === ALLOWED_CAPTURE_MODE &&
    inputModeKey === ALLOWED_INPUT_MODE
  );
}

/**
 * Whether a session's mode pair is one Doubles Training actually implements:
 * RECREATIONAL + DETAILED_DARTS for a per-dart keypad capture, or
 * ANALYTICS + VISUAL_BOARD for a coordinate capture. Mirrors
 * `bobs27.validator.ts`'s `isDetailedDartsOrVisualBoardCapture`.
 */
function isDetailedDartsOrVisualBoardCapture(
  captureModeKey: string,
  inputModeKey: string,
): boolean {
  return (
    isDetailedDartsCapture(captureModeKey, inputModeKey) ||
    isVisualBoardCapture(captureModeKey, inputModeKey)
  );
}

/**
 * Every Doubles Training visit, under either capture mode, carries at least
 * one dart row — a hit can end a visit after 1 or 2 darts, but never with
 * zero. Returns the rejection, or `null` when every turn in the batch carries
 * at least one dart.
 */
function rejectDartlessTurn(
  batch: EventsBatchRequestInput,
): BatchValidationResult | null {
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
      if (turn.darts.length === 0) {
        return {
          valid: false,
          code: "VALIDATION_FAILED",
          issues: [
            `turn ${turn.clientKey} must carry dart rows — every Doubles Training visit carries at least one dart, never a dartless total`,
          ],
        };
      }
    }
  }
  return null;
}

/**
 * Under RECREATIONAL + DETAILED_DARTS every dart's board score must be
 * non-negative. Returns the rejection, or `null` when every dart in the batch
 * clears that floor.
 */
function rejectNegativeDartScore(
  batch: EventsBatchRequestInput,
): BatchValidationResult | null {
  for (const stage of batch.stages) {
    for (const turn of stage.turns) {
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
  return null;
}

/**
 * Doubles Training supports two mode pairs. Under RECREATIONAL +
 * DETAILED_DARTS its engine emits one dart row per throw, so every turn in a
 * batch must carry at least one and no dart's board score may be negative.
 * Under ANALYTICS + VISUAL_BOARD every dart carries a landing coordinate,
 * re-derived and cross-checked by `validateVisualBoardTurns`.
 */
export const doublesTrainingValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (!isDetailedDartsOrVisualBoardCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [
          `Doubles Training V1 only supports ${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES}`,
        ],
      };
    }
    const parsed = DoublesTrainingConfig.safeParse(config);
    if (!parsed.success) {
      return { valid: false, issues: parsed.error.issues };
    }
    return { valid: true, config: parsed.data };
  },

  validateBatch({
    batch,
    captureModeKey,
    inputModeKey,
  }: {
    config: Record<string, unknown>;
    batch: EventsBatchRequestInput;
    existingTurnCount: number;
    captureModeKey: string;
    inputModeKey: string;
  }): BatchValidationResult {
    const dartlessRejection = rejectDartlessTurn(batch);
    if (dartlessRejection) return dartlessRejection;

    if (isVisualBoardCapture(captureModeKey, inputModeKey)) {
      return validateVisualBoardTurns(batch, DEFAULT_MAX_TURN_SCORE);
    }

    const negativeScoreRejection = rejectNegativeDartScore(batch);
    if (negativeScoreRejection) return negativeScoreRejection;

    return { valid: true };
  },
};
```

- [ ] **Step 4: Declare the capability**

In `app/src/lib/game/rulesets/capabilities.ts`, change:

```ts
  DOUBLES_TRAINING_V1: [DETAILED_DARTS],
```

to:

```ts
  DOUBLES_TRAINING_V1: [DETAILED_DARTS, VISUAL_BOARD],
```

- [ ] **Step 5: Run the validator and parity tests**

Run: `cd app && npx vitest run tests/services/rulesets/doubles-training/doubles-training.validator.test.ts tests/lib/game/rulesets/capability-validator-parity.test.ts`
Expected: PASS, all tests.

- [ ] **Step 6: Update `games-visibility.test.ts`**

No carded ruleset remains `RECREATIONAL`-only after this task. Replace the comment block (as left by Task 3):

```ts
// Every card in GAME_CARDS is a ruleset that has a real setup route, so a key
// asserted here is a card that can actually render. Visibility is keyed on
// capture mode alone, not the exact declared pair (see `visibleGames`'s own
// doc comment for why). Most carded rulesets declare a pair under both
// RECREATIONAL and ANALYTICS and so are visible under both real app modes —
// DOUBLES_TRAINING_V1 is the remaining exception, declaring only
// RECREATIONAL + DETAILED_DARTS, so its card is RECREATIONAL-only.
```

with:

```ts
// Every card in GAME_CARDS is a ruleset that has a real setup route, so a key
// asserted here is a card that can actually render. Visibility is keyed on
// capture mode alone, not the exact declared pair (see `visibleGames`'s own
// doc comment for why). Every carded ruleset now declares a pair under both
// RECREATIONAL and ANALYTICS, so every card is visible under both real app
// modes.
```

and replace the analytics-visibility test (as left by Task 3):

```ts
  it("shows every carded game that declares an analytics pair, and no others, under analytics", () => {
    const keys = visibleGames("ANALYTICS", null)
      .map((game) => game.rulesetVersionKey)
      .sort();
    expect(keys).toEqual([
      "501_V1",
      "BOBS27_V1",
      "SCORE_TRAINING_V1",
      "SINGLES_V1",
    ]);
    expect(keys).not.toContain("DOUBLES_TRAINING_V1");
    expect(keys).not.toContain("SHANGHAI_V1");
    expect(keys).not.toContain("121_V1");
    expect(keys).not.toContain("AROUND_THE_CLOCK_V1");
  });
```

with:

```ts
  it("shows every carded game that declares an analytics pair, and no others, under analytics", () => {
    const keys = visibleGames("ANALYTICS", null)
      .map((game) => game.rulesetVersionKey)
      .sort();
    expect(keys).toEqual([
      "501_V1",
      "BOBS27_V1",
      "DOUBLES_TRAINING_V1",
      "SCORE_TRAINING_V1",
      "SINGLES_V1",
    ]);
    expect(keys).not.toContain("SHANGHAI_V1");
    expect(keys).not.toContain("121_V1");
    expect(keys).not.toContain("AROUND_THE_CLOCK_V1");
  });
```

- [ ] **Step 7: Add the seed row**

In `database/seeds/0007_ruleset_version_capabilities.sql`, change:

```sql
            ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SHANGHAI_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
```

to:

```sql
            ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('DOUBLES_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SHANGHAI_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
```

- [ ] **Step 8: Update the verification script in lockstep**

In `database/verification/0007_capability_seed_checks.sql`, bump the same 4 spots Task 3 touched, from 10 to 11 and add the new triple.

Change:

```sql
INSERT INTO verification_results
SELECT '1',
    'seed inserted exactly the 10 declared rows',
    CASE
        WHEN count(*) = 10 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 10, found %s', count(*))
FROM ruleset_version_capabilities;
```

to:

```sql
INSERT INTO verification_results
SELECT '1',
    'seed inserted exactly the 11 declared rows',
    CASE
        WHEN count(*) = 11 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 11, found %s', count(*))
FROM ruleset_version_capabilities;
```

Change:

```sql
FROM (
        VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SINGLES_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS')
    ) AS declared(ruleset_key, capture_key, input_key)
    LEFT JOIN ruleset_versions rv ON rv.implementation_key = declared.ruleset_key
```

to:

```sql
FROM (
        VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SINGLES_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('DOUBLES_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD')
    ) AS declared(ruleset_key, capture_key, input_key)
    LEFT JOIN ruleset_versions rv ON rv.implementation_key = declared.ruleset_key
```

Change:

```sql
INSERT INTO verification_results
SELECT '2',
    'all 10 declared triples were actually checked',
    CASE
        WHEN count(*) = 10 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 10 triple checks ran', count(*))
FROM verification_results
WHERE step = '2';
```

to:

```sql
INSERT INTO verification_results
SELECT '2',
    'all 11 declared triples were actually checked',
    CASE
        WHEN count(*) = 11 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 11 triple checks ran', count(*))
FROM verification_results
WHERE step = '2';
```

Change:

```sql
        FROM (
                VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('SINGLES_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS')
            ) AS declared(ruleset_key, capture_key, input_key)
```

to:

```sql
        FROM (
                VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('SINGLES_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('DOUBLES_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD')
            ) AS declared(ruleset_key, capture_key, input_key)
```

Same D193 caveat as Task 3 — cannot execute in this container.

- [ ] **Step 9: Run the full targeted test set**

Run: `cd app && npx vitest run tests/services/rulesets/doubles-training tests/lib/game/rulesets`
Expected: PASS, all tests.

- [ ] **Step 10: Commit**

```bash
cd app && git add src/lib/game/rulesets/capabilities.ts src/services/rulesets/doubles-training/doubles-training.validator.ts tests/services/rulesets/doubles-training/doubles-training.validator.test.ts tests/lib/game/rulesets/games-visibility.test.ts
cd .. && git add database/seeds/0007_ruleset_version_capabilities.sql database/verification/0007_capability_seed_checks.sql
git commit -m "feat(doubles-training): add ANALYTICS + VISUAL_BOARD capability"
```

---

## Task 5: Generalize `play-lifecycle.ts` for board input

**Files:**
- Modify: `app/src/lib/game/types.ts` (`PlayLifecycleContext`)
- Modify: `app/src/lib/game/play-lifecycle.ts`
- Test: `app/tests/lib/game/play-lifecycle.test.ts`

**Interfaces:**
- Consumes: `markersForTurns` from `@lib/game/board-input.data` (existing export); `BoardMarker` type from `./types` (existing export).
- Produces: `PlayLifecycleContext` gains an optional `hiddenTimer?: ReturnType<typeof setTimeout> | null`. New exported `playVisitMarkers<TConfig, TEngine, TResults>(context): BoardMarker[]`. `playCommitDart`, `playUndoVisit`, `runPlayAgain` all now manage `hiddenTimer` alongside `hiddenTurnKey`. Every existing consumer (Shanghai, 121, Around the Clock, and this task's own fake-engine tests) is unaffected: `inputModeKey` is never `"VISUAL_BOARD"` for them, so the new branch is dead code on their path.

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/lib/game/play-lifecycle.test.ts`. First, add `playVisitMarkers` to the existing import from `@lib/game/play-lifecycle`:

```ts
import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playRetryReconciliation,
  playUndoVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
```

Then append, at the end of the file:

```ts
describe("playCommitDart — reveal-then-clear under VISUAL_BOARD", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules hiddenTurnKey 1.5s after a resolving dart when inputModeKey is VISUAL_BOARD", async () => {
    const context = makeContext();
    context.$store.game.inputModeKey = "VISUAL_BOARD";
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(context.hiddenTurnKey).toBeNull();
    expect(context.hiddenTimer).not.toBeNull();

    vi.advanceTimersByTime(1500);

    expect(context.hiddenTurnKey).toBe("t1");
  });

  it("sets hiddenTurnKey immediately, with no timer, when inputModeKey is not VISUAL_BOARD", async () => {
    const context = makeContext();
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(context.hiddenTurnKey).toBe("t1");
    expect(context.hiddenTimer).toBeUndefined();
  });

  it("clears a still-pending hide timer before scheduling a new one", async () => {
    const context = makeContext();
    context.$store.game.inputModeKey = "VISUAL_BOARD";
    await playInit(context, GAME_TYPE_KEY, resumeEngine);

    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    const firstTimer = context.hiddenTimer;

    vi.advanceTimersByTime(1400);
    await playCommitDart(context, {
      hitTargetNumber: 2,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    expect(context.hiddenTimer).not.toBe(firstTimer);

    vi.advanceTimersByTime(200);
    expect(context.hiddenTurnKey).toBeNull();

    vi.advanceTimersByTime(1300);
    expect(context.hiddenTurnKey).toBe("t2");
  });
});

describe("playUndoVisit — cancels a pending hide timer", () => {
  it("clears hiddenTimer so a reopened visit stays visible", async () => {
    vi.useFakeTimers();
    const context = makeContext();
    context.$store.game.inputModeKey = "VISUAL_BOARD";
    await playInit(context, GAME_TYPE_KEY, resumeEngine);
    await playCommitDart(context, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });

    vi.advanceTimersByTime(1000);
    playUndoVisit(context);
    vi.advanceTimersByTime(1000);

    expect(context.hiddenTurnKey).toBeNull();
    vi.useRealTimers();
  });
});

describe("playVisitMarkers", () => {
  it("returns the last turn's located darts when not hidden", () => {
    const turns: TurnFact[] = [
      {
        clientKey: "t1",
        stageClientKey: "block-1",
        sequence: 1,
        completedAt: "2026-08-15T00:00:00.000Z",
        totalScore: 60,
        darts: [
          {
            sequence: 1,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: 20,
            hitZoneKey: "TREBLE",
            score: 60,
            locationX: 0,
            locationY: -102,
          },
        ],
      },
    ];
    const context = makeContext({
      hiddenTurnKey: null,
      $store: {
        ...makeContext().$store,
        game: { ...makeContext().$store.game, turns },
      },
    });

    const markers = playVisitMarkers(context);
    expect(markers).toHaveLength(1);
    expect(markers[0].sequence).toBe(1);
  });

  it("returns empty once the last turn's key matches hiddenTurnKey", () => {
    const turns: TurnFact[] = [
      {
        clientKey: "t1",
        stageClientKey: "block-1",
        sequence: 1,
        completedAt: "2026-08-15T00:00:00.000Z",
        totalScore: 60,
        darts: [
          {
            sequence: 1,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: 20,
            hitZoneKey: "TREBLE",
            score: 60,
            locationX: 0,
            locationY: -102,
          },
        ],
      },
    ];
    const context = makeContext({
      hiddenTurnKey: "t1",
      $store: {
        ...makeContext().$store,
        game: { ...makeContext().$store.game, turns },
      },
    });

    expect(playVisitMarkers(context)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts`
Expected: the new tests FAIL — `playVisitMarkers` doesn't exist yet (import error / `undefined` calls), and `hiddenTimer` is never set.

- [ ] **Step 3: Add `hiddenTimer` to `PlayLifecycleContext`**

In `app/src/lib/game/types.ts`, inside `PlayLifecycleContext`, change:

```ts
  resultsSnapshot: TResults | null;
  hiddenTurnKey: string | null;
  $store: PlayStoreContext<TConfig>;
```

to:

```ts
  resultsSnapshot: TResults | null;
  hiddenTurnKey: string | null;
  hiddenTimer?: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<TConfig>;
```

- [ ] **Step 4: Generalize `playCommitDart`, `playUndoVisit`, `runPlayAgain`; add `playVisitMarkers`**

In `app/src/lib/game/play-lifecycle.ts`, add to the imports:

```ts
import { markersForTurns } from "@lib/game/board-input.data";
import type {
  PlayAgainOverrides,
  PlayLifecycleContext,
  PlayStoreContext,
} from "./types";
import type { BoardMarker } from "./types";
```

(the last two type imports can merge into the existing `import type { ... } from "./types";` block — end result: `PlayAgainOverrides`, `PlayLifecycleContext`, `PlayStoreContext`, `BoardMarker` all imported from `./types`)

Replace `playCommitDart`'s body:

```ts
export async function playCommitDart<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  observation: DartObservation,
): Promise<void> {
  if (!context.engine) return;
  try {
    context.engine.record(observation);
  } catch (err: unknown) {
    context.error = (err as Error).message;
    return;
  }
  context.error = "";
  const facts = context.engine.facts();
  context.$store.game.recordFacts(facts);

  const resolvedTurn = facts.turns.at(-1);
  if (resolvedTurn?.completedAt) {
    if (context.hiddenTimer) {
      clearTimeout(context.hiddenTimer);
      context.hiddenTimer = null;
    }
    if (context.$store.game.inputModeKey === "VISUAL_BOARD") {
      const clientKey = resolvedTurn.clientKey;
      context.hiddenTimer = setTimeout(() => {
        context.hiddenTurnKey = clientKey;
      }, 1500);
    } else {
      context.hiddenTurnKey = resolvedTurn.clientKey;
    }
  }

  if (context.engine.isComplete()) {
    context.finished = true;
    context.completionStatus = "pending";
    await context.uploadAndCompleteSession();
  }
}
```

Replace `playUndoVisit`'s body:

```ts
export function playUndoVisit<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(context: PlayLifecycleContext<TConfig, TEngine, TResults>): void {
  if (context.finished) return;
  if (!context.engine || !context.engine.undo()) return;
  if (context.hiddenTimer) {
    clearTimeout(context.hiddenTimer);
    context.hiddenTimer = null;
  }
  context.hiddenTurnKey = null;
  context.$store.game.recordFacts(context.engine.facts());
  context.error = "";
}
```

In `runPlayAgain`, change:

```ts
    context.finished = false;
    context.completionStatus = "pending";
    context.completionError = "";
    context.resultsSnapshot = null;
    context.hiddenTurnKey = null;
    context.error = "";
    context.hasActiveSession = true;
```

to:

```ts
    context.finished = false;
    context.completionStatus = "pending";
    context.completionError = "";
    context.resultsSnapshot = null;
    if (context.hiddenTimer) {
      clearTimeout(context.hiddenTimer);
      context.hiddenTimer = null;
    }
    context.hiddenTurnKey = null;
    context.error = "";
    context.hasActiveSession = true;
```

Add a new exported function, placed after `playUndoVisit` and before `playUploadAndCompleteSession`:

```ts
/**
 * The darts a VISUAL_BOARD session's board should currently show stuck in
 * it: the last turn's located darts, or none once that turn's own
 * reveal-then-clear timer (`playCommitDart`) has fired. Extracted from Bob's
 * 27's own `visitMarkers` override so Singles/Doubles Training can reuse it
 * instead of hand-rolling the same hidden-turn check.
 */
export function playVisitMarkers<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(context: PlayLifecycleContext<TConfig, TEngine, TResults>): BoardMarker[] {
  if (context.$store.game.turns.at(-1)?.clientKey === context.hiddenTurnKey) {
    return [];
  }
  return markersForTurns(context.$store.game.turns);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 6: Run the full suite to confirm no regression in existing `play-lifecycle.ts` consumers**

Run: `cd app && npx vitest run tests/lib/game tests/modules/game/shanghai.engine.module.test.ts tests/modules/game/one-twenty-one.engine.module.test.ts tests/modules/game/around-the-clock.engine.module.test.ts`
Expected: PASS, all tests (this does not exercise the engines' own logic beyond confirming the shared module's generalization is additive).

- [ ] **Step 7: Commit**

```bash
cd app && git add src/lib/game/types.ts src/lib/game/play-lifecycle.ts tests/lib/game/play-lifecycle.test.ts
git commit -m "feat(play-lifecycle): support VISUAL_BOARD reveal-then-clear and shared visit markers"
```

---

## Task 6: Singles Training play data — board input

**Files:**
- Modify: `app/src/lib/game/types.ts` (`SinglesTrainingPlayContext`)
- Modify: `app/src/lib/game/singles-training-play.data.ts`
- Test: `app/tests/lib/game/singles-training-play.data.test.ts`

**Interfaces:**
- Consumes: `boardInputData` from `@lib/game/board-input.data`; `playVisitMarkers` from `@lib/game/play-lifecycle` (Task 5).
- Produces: `singlesTrainingPlay()` gains `recordDart(observation): Promise<void>`, `visitMarkers(): BoardMarker[]`, and every `boardInputData`-contributed field/method (`board`, `onPointerDown`, etc. — untyped on `SinglesTrainingPlayContext`, exactly like `Bobs27PlayContext` today).

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/lib/game/singles-training-play.data.test.ts`, at the end of the file:

```ts
describe("recordDart (board input)", () => {
  it("records a dart via the board path and mirrors it into the store", async () => {
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "TREBLE",
      locationX: 5,
      locationY: -10,
    });

    const dart = play.$store.game.turns[0].darts[0];
    expect(dart.locationX).toBe(5);
    expect(dart.locationY).toBe(-10);
    expect(play.currentPoints.call(play)).toBe("3");
  });

  it("does nothing once finished", async () => {
    const play = makePlay({ turns: priorTurnsThroughNumber(20) });
    await play.init.call(play);
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    expect(play.finished).toBe(true);

    await play.recordDart.call(play, {
      hitTargetNumber: 25,
      hitZoneKey: "OUTER_BULL",
      locationX: 1,
      locationY: 1,
    });

    expect(play.$store.game.turns).toHaveLength(21);
  });
});

describe("reveal-then-clear under VISUAL_BOARD", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides the resolved visit's markers 1.5s after the 3rd dart", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });
    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });
    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBeNull();
    expect(play.visitMarkers.call(play)).not.toEqual([]);

    vi.advanceTimersByTime(1500);

    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.visitMarkers.call(play)).toEqual([]);
  });

  it("hides the resolved visit's preview immediately under DETAILED_DARTS, with no timer", async () => {
    const play = makePlay({ inputModeKey: "DETAILED_DARTS" });
    await play.init.call(play);

    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");
    await play.recordTap.call(play, "SINGLE");

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.hiddenTimer).toBeNull();
  });

  it("undoVisit cancels a pending hide timer so a reopened visit stays visible", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);
    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });
    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });
    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 1,
      locationY: 1,
    });

    vi.advanceTimersByTime(1000);
    play.undoVisit.call(play);
    vi.advanceTimersByTime(1000);

    expect(play.hiddenTurnKey).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: the new tests FAIL to even compile/run — `play.recordDart`/`play.visitMarkers`/`play.hiddenTimer` don't exist yet.

- [ ] **Step 3: Add the new members to `SinglesTrainingPlayContext`**

In `app/src/lib/game/types.ts`, inside `SinglesTrainingPlayContext`, change:

```ts
  resultsSnapshot: { points: number } | null;
  hiddenTurnKey: string | null;
  $store: PlayStoreContext<SinglesSnapshot>;
  engine: SinglesTrainingEngine | null;
  currentTargetLabel(this: SinglesTrainingPlayContext): string;
```

to:

```ts
  resultsSnapshot: { points: number } | null;
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<SinglesSnapshot>;
  engine: SinglesTrainingEngine | null;
  visitMarkers(this: SinglesTrainingPlayContext): BoardMarker[];
  recordDart(
    this: SinglesTrainingPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  currentTargetLabel(this: SinglesTrainingPlayContext): string;
```

- [ ] **Step 4: Wire board input into `singlesTrainingPlay()`**

In `app/src/lib/game/singles-training-play.data.ts`, add to the imports:

```ts
import { boardInputData } from "@lib/game/board-input.data";
import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playRetryReconciliation,
  playUndoVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
```

Change:

```ts
export function singlesTrainingPlay() {
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
    resultsSnapshot: null as { points: number } | null,
    hiddenTurnKey: null as string | null,
    engine: null as SinglesTrainingEngine | null,
```

to:

```ts
export function singlesTrainingPlay() {
  let self: SinglesTrainingPlayContext;

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
    resultsSnapshot: null as { points: number } | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as SinglesTrainingEngine | null,
    ...boardInputData((observation) => self.recordDart(observation)),
```

Change:

```ts
    init(this: SinglesTrainingPlayContext) {
      return playInit(this, GAME_TYPE_KEY, resumeEngine);
    },
```

to:

```ts
    init(this: SinglesTrainingPlayContext) {
      self = this;
      return playInit(this, GAME_TYPE_KEY, resumeEngine);
    },
```

Change:

```ts
    commitDart(this: SinglesTrainingPlayContext, observation: DartObservation) {
      return playCommitDart(this, observation);
    },

    undoVisit(this: SinglesTrainingPlayContext) {
      playUndoVisit(this);
    },
```

to:

```ts
    commitDart(this: SinglesTrainingPlayContext, observation: DartObservation) {
      return playCommitDart(this, observation);
    },

    async recordDart(
      this: SinglesTrainingPlayContext,
      observation: DartObservation,
    ) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    /** Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Delegates to `play-lifecycle.ts`'s shared implementation. */
    visitMarkers(this: SinglesTrainingPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    undoVisit(this: SinglesTrainingPlayContext) {
      playUndoVisit(this);
    },
```

Also add `BoardMarker` to the existing `import type { ... } from "./types";` block at the top of the file (alongside `SinglesPreviewSegment`, `SinglesTrainingPlayContext`).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: PASS, all tests in the file (including every pre-existing test — this is an additive change).

- [ ] **Step 6: Commit**

```bash
cd app && git add src/lib/game/types.ts src/lib/game/singles-training-play.data.ts tests/lib/game/singles-training-play.data.test.ts
git commit -m "feat(singles-training): wire board input into the play page"
```

---

## Task 7: Doubles Training play data — board input

**Files:**
- Modify: `app/src/lib/game/types.ts` (`DoublesTrainingPlayContext`)
- Modify: `app/src/lib/game/doubles-training-play.data.ts`
- Test: `app/tests/lib/game/doubles-training-play.data.test.ts`

**Interfaces:**
- Consumes: same as Task 6.
- Produces: `doublesTrainingPlay()` gains `recordDart(observation): Promise<void>`, `visitMarkers(): BoardMarker[]`, and `boardInputData`'s fields.

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/lib/game/doubles-training-play.data.test.ts`, at the end of the file:

```ts
describe("recordDart (board input)", () => {
  it("records a dart via the board path and mirrors it into the store", async () => {
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: 5,
      locationY: -10,
    });

    const dart = play.$store.game.turns[0].darts[0];
    expect(dart.locationX).toBe(5);
    expect(dart.locationY).toBe(-10);
    expect(play.currentTargetLabel.call(play)).toBe("D2");
  });

  it("does nothing once finished", async () => {
    const play = makePlay({ turns: priorHitTurnsThroughDouble(20) });
    await play.init.call(play);
    await play.recordTap.call(play, true);
    expect(play.finished).toBe(true);

    await play.recordDart.call(play, {
      hitTargetNumber: 25,
      hitZoneKey: "INNER_BULL",
      locationX: 1,
      locationY: 1,
    });

    expect(play.$store.game.turns).toHaveLength(21);
  });
});

describe("reveal-then-clear under VISUAL_BOARD", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides a hit visit's markers 1.5s after the resolving dart, even though it ended before 3 darts", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: 1,
      locationY: 1,
    });

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBeNull();
    expect(play.visitMarkers.call(play)).not.toEqual([]);

    vi.advanceTimersByTime(1500);

    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.visitMarkers.call(play)).toEqual([]);
  });

  it("hides the resolved visit's preview immediately under DETAILED_DARTS, with no timer", async () => {
    const play = makePlay({ inputModeKey: "DETAILED_DARTS" });
    await play.init.call(play);

    await play.recordTap.call(play, true);

    const clientKey = play.$store.game.turns[0].clientKey;
    expect(play.hiddenTurnKey).toBe(clientKey);
    expect(play.hiddenTimer).toBeNull();
  });

  it("undoVisit cancels a pending hide timer so a reopened visit stays visible", async () => {
    vi.mocked(fetchActiveSessions).mockResolvedValue([
      { ...ACTIVE_SESSION, inputModeKey: "VISUAL_BOARD" },
    ]);
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);
    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: 1,
      locationY: 1,
    });

    vi.advanceTimersByTime(1000);
    play.undoVisit.call(play);
    vi.advanceTimersByTime(1000);

    expect(play.hiddenTurnKey).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts`
Expected: the new tests FAIL to compile/run.

- [ ] **Step 3: Add the new members to `DoublesTrainingPlayContext`**

In `app/src/lib/game/types.ts`, inside `DoublesTrainingPlayContext`, change:

```ts
  resultsSnapshot: { hits: number; misses: number } | null;
  hiddenTurnKey: string | null;
  $store: PlayStoreContext<DoublesTrainingSnapshot>;
  engine: DoublesTrainingEngine | null;
  currentTargetLabel(this: DoublesTrainingPlayContext): string;
```

to:

```ts
  resultsSnapshot: { hits: number; misses: number } | null;
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<DoublesTrainingSnapshot>;
  engine: DoublesTrainingEngine | null;
  visitMarkers(this: DoublesTrainingPlayContext): BoardMarker[];
  recordDart(
    this: DoublesTrainingPlayContext,
    observation: DartObservation,
  ): Promise<void>;
  currentTargetLabel(this: DoublesTrainingPlayContext): string;
```

- [ ] **Step 4: Wire board input into `doublesTrainingPlay()`**

In `app/src/lib/game/doubles-training-play.data.ts`, add to the imports:

```ts
import { boardInputData } from "@lib/game/board-input.data";
import {
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playInit,
  playRetryReconciliation,
  playUndoVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
} from "@lib/game/play-lifecycle";
```

Change:

```ts
export function doublesTrainingPlay() {
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
    resultsSnapshot: null as { hits: number; misses: number } | null,
    hiddenTurnKey: null as string | null,
    engine: null as DoublesTrainingEngine | null,
```

to:

```ts
export function doublesTrainingPlay() {
  let self: DoublesTrainingPlayContext;

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
    resultsSnapshot: null as { hits: number; misses: number } | null,
    hiddenTurnKey: null as string | null,
    hiddenTimer: null as ReturnType<typeof setTimeout> | null,
    engine: null as DoublesTrainingEngine | null,
    ...boardInputData((observation) => self.recordDart(observation)),
```

Change:

```ts
    init(this: DoublesTrainingPlayContext) {
      return playInit(this, GAME_TYPE_KEY, resumeEngine);
    },
```

to:

```ts
    init(this: DoublesTrainingPlayContext) {
      self = this;
      return playInit(this, GAME_TYPE_KEY, resumeEngine);
    },
```

Change:

```ts
    commitDart(this: DoublesTrainingPlayContext, observation: DartObservation) {
      return playCommitDart(this, observation);
    },

    undoVisit(this: DoublesTrainingPlayContext) {
      playUndoVisit(this);
    },
```

to:

```ts
    commitDart(this: DoublesTrainingPlayContext, observation: DartObservation) {
      return playCommitDart(this, observation);
    },

    async recordDart(
      this: DoublesTrainingPlayContext,
      observation: DartObservation,
    ) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    /** Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Delegates to `play-lifecycle.ts`'s shared implementation. */
    visitMarkers(this: DoublesTrainingPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },

    undoVisit(this: DoublesTrainingPlayContext) {
      playUndoVisit(this);
    },
```

Also add `BoardMarker` to the existing `import type { ... } from "./types";` block at the top of the file.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 6: Commit**

```bash
cd app && git add src/lib/game/types.ts src/lib/game/doubles-training-play.data.ts tests/lib/game/doubles-training-play.data.test.ts
git commit -m "feat(doubles-training): wire board input into the play page"
```

---

## Task 8: Frontend — board UI on both play screens

**Files:**
- Modify: `app/src/components/layout/games/interfaces/SinglesTraining.astro`
- Modify: `app/src/components/layout/games/interfaces/DoublesTraining.astro`

**Interfaces:**
- Consumes: `BoardInputPanel.astro` (unchanged, reads `board`, `visitMarkers()`, `onPointerDown`/etc., `undoVisit()`, `recordUnseen()`, `finished`, `hasActiveSession`, `$store.game.inputModeKey` off the page's own Alpine scope — all now present after Tasks 6/7).

- [ ] **Step 1: Gate the keypad and add the board panel — Singles Training**

In `app/src/components/layout/games/interfaces/SinglesTraining.astro`, add to the imports:

```astro
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
```

Change:

```astro
  <VisitPreview />

  <SinglesRecreationalInput />
</div>
```

to:

```astro
  <VisitPreview />

  <SinglesRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the tap row above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

- [ ] **Step 2: Gate the keypad and add the board panel — Doubles Training**

In `app/src/components/layout/games/interfaces/DoublesTraining.astro`, add to the imports:

```astro
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
```

Change:

```astro
  <VisitPreview />

  <DoublesPathRecreationalInput />
</div>
```

to:

```astro
  <VisitPreview />

  <DoublesPathRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the tap row above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

- [ ] **Step 3: Type-check and format**

Run: `cd app && npx astro check && npm run format:check`
Expected: 0 errors (baseline hints/warnings unchanged); format clean. If `format:check` fails, run `npm run format` and re-check.

- [ ] **Step 4: Manual smoke test**

Run: `cd app && astro dev --background`, then:
1. Set app mode to Analytics (`ANALYTICS` + `VISUAL_BOARD`) from the profile/settings page.
2. Start a Singles Training session; confirm the board renders instead of the S/D/T/Miss row, tapping the board records a dart, Undo/Bounce-out work, and the visit's markers linger ~1.5s after the 3rd dart before clearing.
3. Repeat for Doubles Training, confirming a visit that resolves early (dart 1 or 2 hit) still shows the reveal-then-clear behavior.
4. Switch back to Recreational mode and confirm both play screens still show their original tap rows unchanged.

Stop the dev server afterward: `astro dev stop`. If no browser is available in this environment, state so explicitly rather than claiming the manual check passed.

- [ ] **Step 5: Commit**

```bash
cd app && git add src/components/layout/games/interfaces/SinglesTraining.astro src/components/layout/games/interfaces/DoublesTraining.astro
git commit -m "feat(frontend): render the board input panel on Singles/Doubles Training"
```

---

## Task 9: Decision ledger entry and context maintenance

**Files:**
- Modify: `decisions/game-engine.md`
- Modify: `docs/architecture/00-Context-Map.md` (Version changelog line)

**Interfaces:** none (documentation only).

- [ ] **Step 1: Derive the next decision id**

Run: `git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' decisions/**.md | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1`
Use the printed number + 1 as `<next>` below (per `DECISIONS.md`'s "How to add a decision" — do not trust the D210 figure quoted elsewhere in this repo without re-deriving it, since other branches may have landed decisions since).

- [ ] **Step 2: Append the decision block**

Append to the end of `decisions/game-engine.md` (after its existing table/blocks, never inside them):

```markdown
### D<next> — Generalize play-lifecycle.ts for VISUAL_BOARD input
Status: Accepted · Date: 2026-08-15
Decision: `play-lifecycle.ts` (`playCommitDart`, `playUndoVisit`, `runPlayAgain`) now optionally supports board input — an additive `hiddenTimer` field on `PlayLifecycleContext` and a mode-gated reveal-then-clear branch, plus a new shared `playVisitMarkers` helper — rather than re-forking Singles/Doubles Training into bespoke play-data modules the way Bob's 27 did.
Reason: D209 excluded Bob's 27 from `play-lifecycle.ts` specifically because `VISUAL_BOARD` needed the board-tap DOM bridge and the 1.5s reveal-then-clear timer the shared module didn't have. With Singles Training and Doubles Training now needing exactly that shape too, re-forking a second and third time would reintroduce the class of duplication D208/D209 paid down. Generalizing is additive and safe: every existing `play-lifecycle.ts` consumer's `inputModeKey` is never `VISUAL_BOARD`, so the new branch is dead code on their path.
Consequences: Bob's 27 itself is unchanged — its own `commitDart`/`undoVisit`/`visitMarkers` stay bespoke, not a forced migration onto the now-generalized shared module. A fourth ruleset needing board input reuses `play-lifecycle.ts` directly with no further architectural change.
Supersedes: D209
```

- [ ] **Step 3: Verify the decision ledger gate**

Run: `bash scripts/check-decision-ids.sh`
Expected: exits 0.

- [ ] **Step 4: Add a Context Map changelog entry**

Following the exact convention of every prior entry in `docs/architecture/00-Context-Map.md`'s `> **Version:**` line (see the entries this line already contains, e.g. the Around the Clock v1 entry), prepend a new entry summarizing what actually shipped on this branch: the capability/validator/seed change for both rulesets, the engine location-fact fix, the `play-lifecycle.ts` generalization and its new decision (`D<next>`, supersedes D209), the frontend board-panel wiring, and the real full-suite test count/regression status measured in Step 6 below. Bump the version number by one patch level from whatever is currently first in the file. State plainly which verification steps could not run in this container (`db:verify`, the manual browser smoke test if no browser was available) per the established D193 precedent — flag, don't claim.

- [ ] **Step 5: Run the full validation gate**

Run: `cd app && npm run validate:app`
Expected: 0 errors. This includes the full Vitest suite, `astro check`, and the structural gate scripts (`file-locations`, `agent-mirrors`, `astro-class-composition`, `astro-conventions`, `game-engines`, `refinement-coverage`, `type-barrels`, `alias-sync`, `constraint-mirror`, `no-inline-comments`, `style-tokens`).

- [ ] **Step 6: Confirm formatting is clean**

Run: `cd app && npm run format && npm run format:check`
Expected: no diff produced by `format`; `format:check` clean. If `format` produced changes, stage and commit them separately before the final commit below.

- [ ] **Step 7: Commit**

```bash
git add decisions/game-engine.md docs/architecture/00-Context-Map.md
git commit -m "docs: record D<next> and context-map entry for singles/doubles analytics capture"
```

- [ ] **Step 8: Push**

```bash
git push -u origin claude/singles-doubles-analytics-4qzc9j
```

Do not open a pull request unless explicitly asked.

---

## Self-Review Notes

- **Spec coverage:** Capability & validation layer → Tasks 3–4. Engine layer → Tasks 1–2. Shared lifecycle generalization → Task 5. Play-data `recordDart`/`boardInputData` wiring → Tasks 6–7. Frontend → Task 8. Testing (every file the spec's Testing section names) → covered inline in each task plus `capability-seed-parity`/`capability-validator-parity`/`games-visibility` in Tasks 3–4. Decisions → Task 9. Out-of-scope items (schema, Bob's 27 itself, `v_*` views) are untouched by every task above, matching the spec.
- **Placeholder scan:** no "TBD"/"similar to Task N" — every task's validator/engine/lifecycle rewrite is given in full, not by reference.
- **Type consistency:** `recordDart(observation: DartObservation): Promise<void>`, `visitMarkers(): BoardMarker[]`, and `hiddenTimer: ReturnType<typeof setTimeout> | null` are named identically across Tasks 5–7 and their `types.ts` declarations. `playVisitMarkers`'s generic signature (`<TConfig, TEngine extends GameEngine<DartObservation, unknown>, TResults>`) matches every other `play-lifecycle.ts` export's shape, and is called the same way `playCommitDart`/`playUndoVisit` already are from both play-data modules (passing `this` typed as the ruleset-specific `*PlayContext`, exactly as those two already do today).
