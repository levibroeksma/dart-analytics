# 121, Shanghai, Around the Clock — Analytics Capture (VISUAL_BOARD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `121_V1`, `SHANGHAI_V1`, and `AROUND_THE_CLOCK_V1` the `ANALYTICS` + `VISUAL_BOARD` capability pair (board-tap coordinate capture) alongside their existing capture mode, matching the pattern already shipped for Bob's 27, Singles Training, and Doubles Training.

**Architecture:** Shanghai and Around the Clock already take `DartObservation` as their engine input and already carry real coordinates into dart facts — they only need capability/validator/seed/frontend wiring, mirroring `singles-training-play.data.ts` byte-for-byte. `121` records whole-visit totals, not darts, so it needs a real engine change first: a dual-shape `record()`/`undo()`/`wouldComplete()` dispatch mirroring `FiveOhOneEngine`, adapted for 121's round-based ladder (a visit boundary that must NOT be conflated with 501's simpler leg boundary — see Task 4's design note on `deriveState`).

**Tech Stack:** Astro, TypeScript, Alpine.js, Vitest, PostgreSQL/Neon (seed SQL only, no schema change).

## Global Constraints

- All work happens on branch `claude/analytics-dartboard-input-ji763d` (already checked out).
- Full test suite must pass after every task (`npm test` from `app/`) — this repo runs the whole suite always, never a subset.
- No `//` or `/* */` comments inside TypeScript function/method bodies (`app/CLAUDE.md`); put necessary detail in JSDoc above the declaration.
- No schema/migration change — `location_x`/`location_y` and `chk_dart_location_pair` already exist.
- `npm run format` before any commit that touches `.astro`/`.ts` files whose diff wasn't already formatted by the editor; `npm run format:check` must be clean.
- Reference design: `docs/superpowers/specs/2026-08-15-121-shanghai-atc-analytics-design.md`.
- No new `decisions/**` entry (every pattern applied here is already decided — see design doc's Decisions section).
- Run the `context-maintenance` skill's procedure at the end of Task 6, not per-task.

---

### Task 1: Capability, seed, and validator layer (all three rulesets)

**Files:**
- Modify: `app/src/lib/game/rulesets/capabilities.ts`
- Modify: `app/src/services/rulesets/shanghai/shanghai.validator.ts`
- Modify: `app/src/services/rulesets/around-the-clock/around-the-clock.validator.ts`
- Modify: `app/src/services/rulesets/one-twenty-one/one-twenty-one.validator.ts`
- Modify: `database/seeds/0007_ruleset_version_capabilities.sql`
- Modify: `database/verification/0007_capability_seed_checks.sql`
- Test: `app/tests/services/rulesets/shanghai/shanghai.validator.test.ts`
- Test: `app/tests/services/rulesets/around-the-clock/around-the-clock.validator.test.ts`
- Test: `app/tests/services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts`
- Test: `app/tests/lib/game/rulesets/games-visibility.test.ts`
- (Auto-covered, no edit needed) `app/tests/lib/game/rulesets/capability-seed-parity.test.ts`, `app/tests/lib/game/rulesets/capability-validator-parity.test.ts`

**Interfaces:**
- Consumes: `isDetailedDartsOrVisualBoardCapture`-style dispatch shape already proven in `app/src/services/rulesets/singles-training/singles-training.validator.ts`; `isQuickScoreOrVisualBoardCapture`/`validateQuickScoreTurns` from `app/src/services/rulesets/quick-score.validator.ts`; `isVisualBoardCapture`/`validateVisualBoardTurns` from `app/src/services/rulesets/visual-board.validator.ts`.
- Produces: `RULESET_CAPABILITIES.SHANGHAI_V1 = [DETAILED_DARTS, VISUAL_BOARD]`, `.AROUND_THE_CLOCK_V1 = [DETAILED_DARTS, VISUAL_BOARD]`, `."121_V1" = [QUICK_SCORE, VISUAL_BOARD]` — read by `resolveSessionModePair`, `games-visibility.ts`, and Tasks 2/3/5's frontend work.

- [ ] **Step 1: Widen `capabilities.ts`**

In `app/src/lib/game/rulesets/capabilities.ts`, change:

```ts
  SHANGHAI_V1: [DETAILED_DARTS],
  "121_V1": [QUICK_SCORE],
  AROUND_THE_CLOCK_V1: [DETAILED_DARTS],
```

to:

```ts
  SHANGHAI_V1: [DETAILED_DARTS, VISUAL_BOARD],
  "121_V1": [QUICK_SCORE, VISUAL_BOARD],
  AROUND_THE_CLOCK_V1: [DETAILED_DARTS, VISUAL_BOARD],
```

- [ ] **Step 2: Rewrite `shanghai.validator.ts`**

Replace the full file `app/src/services/rulesets/shanghai/shanghai.validator.ts` with:

```ts
import { ShanghaiConfig } from "@lib/types";
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

/** Whether a session's mode pair is Shanghai's own per-dart keypad capture. */
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
 * Whether a session's mode pair is one Shanghai actually implements:
 * RECREATIONAL + DETAILED_DARTS for a per-dart keypad capture, or
 * ANALYTICS + VISUAL_BOARD for a coordinate capture. Mirrors
 * `singles-training.validator.ts`'s `isDetailedDartsOrVisualBoardCapture`.
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
 * Every Shanghai visit, under either capture mode, carries at least one dart
 * row — never a dartless total. Returns the rejection, or `null` when every
 * turn in the batch carries at least one dart.
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
            `turn ${turn.clientKey} must carry dart rows — every Shanghai visit is exactly 3 darts, hit or miss, never a dartless total`,
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

/** Same ceiling every other coordinate-capturing ruleset uses for a dartless keypad visit (3 darts, treble 20 max) — Shanghai has no `max_visit_score` config field to read one from. */
const DEFAULT_MAX_TURN_SCORE = 180;

/**
 * Shanghai supports two mode pairs. Under RECREATIONAL + DETAILED_DARTS its
 * engine emits one dart row per throw, so every turn in a batch must carry at
 * least one and no dart's board score may be negative. Under
 * ANALYTICS + VISUAL_BOARD every dart carries a landing coordinate,
 * re-derived and cross-checked by `validateVisualBoardTurns`.
 */
export const shanghaiValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (!isDetailedDartsOrVisualBoardCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [
          `Shanghai V1 only supports ${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES}`,
        ],
      };
    }
    const parsed = ShanghaiConfig.safeParse(config);
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

- [ ] **Step 3: Rewrite `around-the-clock.validator.ts`**

Replace the full file `app/src/services/rulesets/around-the-clock/around-the-clock.validator.ts` with:

```ts
import { AroundTheClockConfig } from "@lib/types";
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

/** Whether a session's mode pair is Around the Clock's own per-dart keypad capture. */
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
 * Whether a session's mode pair is one Around the Clock actually implements:
 * RECREATIONAL + DETAILED_DARTS for a per-dart keypad capture, or
 * ANALYTICS + VISUAL_BOARD for a coordinate capture. Mirrors
 * `singles-training.validator.ts`'s `isDetailedDartsOrVisualBoardCapture`.
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
 * Every Around the Clock visit, under either capture mode, carries at least
 * one dart row — never a dartless total. A turn can legitimately hold fewer
 * than 3 darts (a BULL hit ends the session immediately), so this only
 * checks for zero darts, never an exact count. Returns the rejection, or
 * `null` when every turn in the batch carries at least one dart.
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
            `turn ${turn.clientKey} must carry dart rows (${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES})`,
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

/** Same ceiling every other coordinate-capturing ruleset uses for a dartless keypad visit (3 darts, treble 20 max) — Around the Clock has no `max_visit_score` config field to read one from. */
const DEFAULT_MAX_TURN_SCORE = 180;

/**
 * Around the Clock supports two mode pairs. Under RECREATIONAL +
 * DETAILED_DARTS its engine emits one dart row per throw, so every turn in a
 * batch must carry at least one and no dart's board score may be negative.
 * Under ANALYTICS + VISUAL_BOARD every dart carries a landing coordinate,
 * re-derived and cross-checked by `validateVisualBoardTurns`.
 */
export const aroundTheClockValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (!isDetailedDartsOrVisualBoardCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [
          `Around the Clock V1 only supports ${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES}`,
        ],
      };
    }
    const parsed = AroundTheClockConfig.safeParse(config);
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

- [ ] **Step 4: Rewrite `one-twenty-one.validator.ts`**

Replace the full file `app/src/services/rulesets/one-twenty-one/one-twenty-one.validator.ts` with:

```ts
import { OneTwentyOneConfig } from "@lib/types";
import type { RulesetValidator } from "@services/interfaces";
import {
  QUICK_SCORE_OR_VISUAL_BOARD_MODES,
  isQuickScoreCapture,
  isQuickScoreOrVisualBoardCapture,
  validateQuickScoreTurns,
} from "../quick-score.validator";
import {
  isVisualBoardCapture,
  validateVisualBoardTurns,
} from "../visual-board.validator";
import type { EventsBatchRequestInput } from "@routes/types";
import type {
  BatchValidationResult,
  ConfigValidationResult,
} from "@services/types";

/** The highest total a single 121 visit can legitimately carry — the highest three-dart score on a standard board (T20 T20 T20). */
const MAX_VISIT_SCORE = 180;

/**
 * 121 supports two mode pairs. Under RECREATIONAL + QUICK_SCORE every turn is
 * a visit total with no dart rows, capped at 180. Under
 * ANALYTICS + VISUAL_BOARD every dart carries a landing coordinate,
 * re-derived and cross-checked by `validateVisualBoardTurns` — mirrors
 * `five-oh-one.validator.ts`.
 */
export const oneTwentyOneValidator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (!isQuickScoreOrVisualBoardCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [`121 V1 only supports ${QUICK_SCORE_OR_VISUAL_BOARD_MODES}`],
      };
    }
    const parsed = OneTwentyOneConfig.safeParse(config);
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
    if (isVisualBoardCapture(captureModeKey, inputModeKey)) {
      return validateVisualBoardTurns(batch, MAX_VISIT_SCORE);
    }

    if (!isQuickScoreCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        code: "VALIDATION_FAILED",
        issues: [`unsupported mode pair ${captureModeKey} + ${inputModeKey}`],
      };
    }

    return validateQuickScoreTurns(batch, MAX_VISIT_SCORE);
  },
};
```

- [ ] **Step 5: Append the three new seed rows**

In `database/seeds/0007_ruleset_version_capabilities.sql`, change the VALUES list from:

```sql
            ('SHANGHAI_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('121_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('AROUND_THE_CLOCK_V1', 'RECREATIONAL', 'DETAILED_DARTS')
    ) AS declared(ruleset_key, capture_key, input_key)
```

to:

```sql
            ('SHANGHAI_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SHANGHAI_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('121_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('121_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('AROUND_THE_CLOCK_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('AROUND_THE_CLOCK_V1', 'ANALYTICS', 'VISUAL_BOARD')
    ) AS declared(ruleset_key, capture_key, input_key)
```

- [ ] **Step 6: Update `database/verification/0007_capability_seed_checks.sql`**

Four edits in this file, all mechanical (mirrors the 9→10→11 edit the Singles/Doubles Training task made):

1. Step 1's count assertion: change both `11` literals to `14`:

```sql
INSERT INTO verification_results
SELECT '1',
    'seed inserted exactly the 14 declared rows',
    CASE
        WHEN count(*) = 14 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 14, found %s', count(*))
FROM ruleset_version_capabilities;
```

2. Step 2's first VALUES list — append the three new triples right before the closing `)`:

```sql
            ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('DOUBLES_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SHANGHAI_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('SHANGHAI_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('121_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('121_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('AROUND_THE_CLOCK_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('AROUND_THE_CLOCK_V1', 'ANALYTICS', 'VISUAL_BOARD')
    ) AS declared(ruleset_key, capture_key, input_key)
```

3. Step 2's "all N declared triples were actually checked" guard — change both `11` literals to `14`:

```sql
INSERT INTO verification_results
SELECT '2',
    'all 14 declared triples were actually checked',
    CASE
        WHEN count(*) = 14 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 14 triple checks ran', count(*))
FROM verification_results
WHERE step = '2';
```

4. Step 4's VALUES list — same three-triple append as edit 2, inside the `NOT EXISTS` subquery:

```sql
                    ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('DOUBLES_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('SHANGHAI_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('SHANGHAI_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('121_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('121_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('AROUND_THE_CLOCK_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('AROUND_THE_CLOCK_V1', 'ANALYTICS', 'VISUAL_BOARD')
            ) AS declared(ruleset_key, capture_key, input_key)
```

Also update the file's header comment doc-list (the numbered "1. seeds/0007 inserted..." block) only if it names a row count — it does not, so no further edit needed there.

- [ ] **Step 7: Update `shanghai.validator.test.ts`**

In `app/tests/services/rulesets/shanghai/shanghai.validator.test.ts`, the existing test at line 49 currently asserts `ANALYTICS + VISUAL_BOARD` is rejected — that pair is now valid, so retarget it at a genuinely unsupported pair and add new visual-board coverage. Replace the whole file with:

```ts
import { describe, it, expect } from "vitest";
import { shanghaiValidator } from "@services/rulesets/shanghai/shanghai.validator";
import type { DartFactInput } from "@routes/types";

const validConfig = {};

const hitDart: DartFactInput = {
  sequence: 1,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber: 1,
  hitZoneKey: "SINGLE",
  score: 1,
  locationX: null,
  locationY: null,
};

function batchWithTurns(darts: DartFactInput[][]) {
  return {
    stages: [
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: darts.map((turnDarts, i) => ({
          clientKey: `t${i + 1}`,
          participantRef: "p1",
          sequence: i + 1,
          totalScore: turnDarts.reduce((total, dart) => total + dart.score, 0),
          completedAt: null,
          darts: turnDarts,
        })),
      },
    ],
  };
}

describe("shanghaiValidator.validateConfig", () => {
  it("accepts RECREATIONAL + DETAILED_DARTS with the empty config", () => {
    const result = shanghaiValidator.validateConfig({
      config: validConfig,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a capture/input mode combination the ruleset does not support", () => {
    const result = shanghaiValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a config carrying an unrecognized key (the schema is .strict())", () => {
    const result = shanghaiValidator.validateConfig({
      config: { rounds: 7 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });
});

describe("shanghaiValidator.validateBatch", () => {
  it("accepts turns carrying dart rows with non-negative scores", () => {
    const result = shanghaiValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[hitDart]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a turn with no dart rows under DETAILED_DARTS capture", () => {
    const result = shanghaiValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a dart with a negative score", () => {
    const result = shanghaiValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[{ ...hitDart, score: -1 }]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });
});

describe("shanghaiValidator.validateConfig — visual board", () => {
  it("accepts ANALYTICS + VISUAL_BOARD with the empty config", () => {
    const result = shanghaiValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });
});

describe("shanghaiValidator.validateBatch — visual board", () => {
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

    const result = shanghaiValidator.validateBatch({
      config: validConfig,
      batch: batch as never,
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(true);
  });

  it("rejects a dartless turn under VISUAL_BOARD capture", () => {
    const result = shanghaiValidator.validateBatch({
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

    const result = shanghaiValidator.validateBatch({
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

- [ ] **Step 8: Update `around-the-clock.validator.test.ts`**

Replace the whole file `app/tests/services/rulesets/around-the-clock/around-the-clock.validator.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { aroundTheClockValidator } from "@services/rulesets/around-the-clock/around-the-clock.validator";
import type { DartFactInput } from "@routes/types";

const validConfig = {};

const hitDart: DartFactInput = {
  sequence: 1,
  intendedTargetNumber: null,
  intendedZoneKey: null,
  hitTargetNumber: 1,
  hitZoneKey: "SINGLE",
  score: 1,
  locationX: null,
  locationY: null,
};

function batchWithTurns(darts: DartFactInput[][]) {
  return {
    stages: [
      {
        clientKey: "block-1",
        stageTypeKey: "EXERCISE_BLOCK",
        parentClientKey: null,
        sequence: 1,
        turns: darts.map((turnDarts, i) => ({
          clientKey: `t${i + 1}`,
          participantRef: "p1",
          sequence: i + 1,
          totalScore: turnDarts.reduce((total, dart) => total + dart.score, 0),
          completedAt: null,
          darts: turnDarts,
        })),
      },
    ],
  };
}

describe("aroundTheClockValidator.validateConfig", () => {
  it("accepts RECREATIONAL + DETAILED_DARTS with the empty config", () => {
    const result = aroundTheClockValidator.validateConfig({
      config: validConfig,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a capture/input mode combination the ruleset does not support", () => {
    const result = aroundTheClockValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a config carrying an unrecognized key (the schema is .strict())", () => {
    const result = aroundTheClockValidator.validateConfig({
      config: { direction: "HIGH_TO_LOW" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });
});

describe("aroundTheClockValidator.validateBatch", () => {
  it("accepts turns carrying dart rows with non-negative scores", () => {
    const result = aroundTheClockValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[hitDart]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("accepts a 1-dart turn (a visit that closed early on a BULL hit)", () => {
    const result = aroundTheClockValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([
        [
          {
            ...hitDart,
            hitTargetNumber: 25,
            hitZoneKey: "OUTER_BULL",
            score: 25,
          },
        ],
      ]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a turn with no dart rows under DETAILED_DARTS capture", () => {
    const result = aroundTheClockValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a dart with a negative score", () => {
    const result = aroundTheClockValidator.validateBatch({
      config: validConfig,
      batch: batchWithTurns([[{ ...hitDart, score: -1 }]]),
      existingTurnCount: 0,
    });
    expect(result.valid).toBe(false);
  });
});

describe("aroundTheClockValidator.validateConfig — visual board", () => {
  it("accepts ANALYTICS + VISUAL_BOARD with the empty config", () => {
    const result = aroundTheClockValidator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });
});

describe("aroundTheClockValidator.validateBatch — visual board", () => {
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
              totalScore: 25,
              completedAt: "2026-08-15T12:00:00.000Z",
              darts: [
                {
                  sequence: 1,
                  intendedTargetNumber: null,
                  intendedZoneKey: null,
                  hitTargetNumber: 25,
                  hitZoneKey: "OUTER_BULL",
                  score: 25,
                  locationX: 0,
                  locationY: -12,
                },
              ],
            },
          ],
        },
      ],
    };

    const result = aroundTheClockValidator.validateBatch({
      config: validConfig,
      batch: batch as never,
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(true);
  });

  it("rejects a dartless turn under VISUAL_BOARD capture", () => {
    const result = aroundTheClockValidator.validateBatch({
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

    const result = aroundTheClockValidator.validateBatch({
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

Note: the "location resolves to a treble" fixture used for Shanghai/Singles Training (`locationY: -102` at sector 20) is deliberately NOT reused for Around the Clock's happy-path test — Around the Clock's engine hits are evaluated only for hit-vs-miss, not treble-specific scoring, so an `OUTER_BULL` fixture (`locationY: -12`, resolving inside the outer bull ring) is used instead to keep the fixture's claimed zone/score self-consistent with `classify()`'s real geometry. If `classify(0, -12)` does not resolve to `OUTER_BULL`/score 25 in this codebase's `board-geometry.module.ts`, adjust the coordinate to whatever `board-input.data.test.ts` or `board-geometry.module.test.ts` already pins for the outer bull ring, keeping `hitTargetNumber`/`hitZoneKey`/`score` consistent with that resolved value.

- [ ] **Step 9: Update `one-twenty-one.validator.test.ts`**

The existing test at line 36 currently asserts `ANALYTICS + VISUAL_BOARD` is rejected — retarget it, and add visual-board coverage. Replace the whole file `app/tests/services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts` with:

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
      inputModeKey: "DETAILED_DARTS",
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

describe("oneTwentyOneValidator.validateConfig — visual board", () => {
  it("accepts ANALYTICS + VISUAL_BOARD with the empty config", () => {
    const result = oneTwentyOneValidator.validateConfig({
      config: {},
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });
});

describe("oneTwentyOneValidator.validateBatch — visual board", () => {
  it("validates a visual-board batch through the coordinate validator", () => {
    const batch = {
      stages: [
        {
          clientKey: "round-1",
          stageTypeKey: "ROUND",
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

    const result = oneTwentyOneValidator.validateBatch({
      config: {},
      batch: batch as never,
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(true);
  });

  it("still rejects dart rows in a quick-score batch", () => {
    const batch = batchWithTurns([60]);
    batch.stages[0].turns[0].darts = [
      {
        sequence: 1,
        intendedTargetNumber: null,
        intendedZoneKey: null,
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
        locationX: null,
        locationY: null,
      },
    ];

    const result = oneTwentyOneValidator.validateBatch({
      config: {},
      batch,
      existingTurnCount: 0,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });

    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 10: Update `games-visibility.test.ts`**

In `app/tests/lib/game/rulesets/games-visibility.test.ts`, the "shows every carded game that declares an analytics pair" test currently excludes the three rulesets this task just widened. Replace lines 28–42 (the whole `it("shows every carded game that declares an analytics pair...")` block) with:

```ts
  it("shows every carded game under analytics — every carded ruleset now declares an analytics pair", () => {
    const keys = visibleGames("ANALYTICS", null)
      .map((game) => game.rulesetVersionKey)
      .sort();
    expect(keys).toEqual(
      [
        "SCORE_TRAINING_V1",
        "501_V1",
        "BOBS27_V1",
        "SINGLES_V1",
        "DOUBLES_TRAINING_V1",
        "SHANGHAI_V1",
        "121_V1",
        "AROUND_THE_CLOCK_V1",
      ].sort(),
    );
  });
```

- [ ] **Step 11: Run the full suite**

```bash
cd app && npm test
```

Expected: all tests pass, including `capability-seed-parity.test.ts` and `capability-validator-parity.test.ts` (auto-extended, no edit needed) and the three validator test files and `games-visibility.test.ts` just edited.

- [ ] **Step 12: Format and commit**

```bash
cd app && npm run format
git add app/src/lib/game/rulesets/capabilities.ts \
  app/src/services/rulesets/shanghai/shanghai.validator.ts \
  app/src/services/rulesets/around-the-clock/around-the-clock.validator.ts \
  app/src/services/rulesets/one-twenty-one/one-twenty-one.validator.ts \
  database/seeds/0007_ruleset_version_capabilities.sql \
  database/verification/0007_capability_seed_checks.sql \
  app/tests/services/rulesets/shanghai/shanghai.validator.test.ts \
  app/tests/services/rulesets/around-the-clock/around-the-clock.validator.test.ts \
  app/tests/services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts \
  app/tests/lib/game/rulesets/games-visibility.test.ts
git commit -m "Widen 121/Shanghai/Around the Clock capability to ANALYTICS + VISUAL_BOARD"
```

---

### Task 2: Shanghai board input frontend

**Files:**
- Modify: `app/src/lib/game/shanghai-play.data.ts`
- Modify: `app/src/lib/game/types.ts` (`ShanghaiPlayContext`)
- Modify: `app/src/components/layout/games/interfaces/Shanghai.astro`
- Test: `app/tests/lib/game/shanghai-play.data.test.ts`

**Interfaces:**
- Consumes: `boardInputData`/`markersForTurns` (`app/src/lib/game/board-input.data.ts`), `playVisitMarkers` (`app/src/lib/game/play-lifecycle.ts`, already generalized — no change needed there), `BoardInputPanel.astro`.
- Produces: `shanghaiPlay().recordDart(observation)`, `.visitMarkers()` — read by `Shanghai.astro`'s `<BoardInputPanel />`.

- [ ] **Step 1: Add `recordDart`/`visitMarkers`/board spread to `shanghai-play.data.ts`**

In `app/src/lib/game/shanghai-play.data.ts`:

Add to the import list:

```ts
import { boardInputData } from "@lib/game/board-input.data";
```

and add `playVisitMarkers` to the existing `@lib/game/play-lifecycle` import:

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

and widen the type import:

```ts
import type { BoardMarker, ShanghaiPlayContext, ShanghaiPreviewSegment } from "./types";
```

Change `export function shanghaiPlay() {` to open a `self` closure, mirroring `singles-training-play.data.ts`:

```ts
export function shanghaiPlay() {
  let self: ShanghaiPlayContext;

  return {
```

Inside the returned object, add the board spread right after `engine: null as ShanghaiEngine | null,`:

```ts
    engine: null as ShanghaiEngine | null,
    ...boardInputData((observation) => self.recordDart(observation)),
```

Assign `self` at the top of `init()`:

```ts
    init(this: ShanghaiPlayContext) {
      self = this;
      return playInit(this, GAME_TYPE_KEY, resumeEngine);
    },
```

Add `recordDart` and `visitMarkers` right after `commitDart`:

```ts
    commitDart(this: ShanghaiPlayContext, observation: DartObservation) {
      return playCommitDart(this, observation);
    },

    async recordDart(this: ShanghaiPlayContext, observation: DartObservation) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    /** Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Delegates to `play-lifecycle.ts`'s shared implementation. */
    visitMarkers(this: ShanghaiPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },
```

- [ ] **Step 2: Widen `ShanghaiPlayContext` in `types.ts`**

In `app/src/lib/game/types.ts`, find the `ShanghaiPlayContext` type (search for `export type ShanghaiPlayContext`). Add `hiddenTimer` next to the existing `hiddenTurnKey` field, and add `visitMarkers`/`recordDart` method signatures, mirroring the exact shape `SinglesTrainingPlayContext` already carries:

```ts
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<ShanghaiSnapshot>;
  engine: ShanghaiEngine | null;
  visitMarkers(this: ShanghaiPlayContext): BoardMarker[];
  recordDart(
    this: ShanghaiPlayContext,
    observation: DartObservation,
  ): Promise<void>;
```

(Insert `hiddenTimer` immediately after the existing `hiddenTurnKey: string | null;` line, and the two method signatures immediately after the existing `engine: ShanghaiEngine | null;` line, keeping every other existing field/method in `ShanghaiPlayContext` unchanged.)

- [ ] **Step 3: Wire `BoardInputPanel` into `Shanghai.astro`**

In `app/src/components/layout/games/interfaces/Shanghai.astro`, add the import:

```astro
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
```

and change the final line from:

```astro
  <SinglesRecreationalInput />
```

to:

```astro
  <SinglesRecreationalInput
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the tap row above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
```

- [ ] **Step 4: Add `recordDart` and reveal-then-clear tests**

Append to `app/tests/lib/game/shanghai-play.data.test.ts` (create the file with this content plus the existing suite's `makePlay`/`gameStub`/`ACTIVE_SESSION` helpers if the file does not already exist — check first with `ls app/tests/lib/game/shanghai-play.data.test.ts`; if it exists, keep its existing content and only append the two new `describe` blocks below, adjusting `makePlay`'s inner `$store.game.inputModeKey` overrides to match its existing helper signature):

```ts
describe("recordDart (board input)", () => {
  it("records a dart via the board path and mirrors it into the store", async () => {
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 5,
      locationY: -10,
    });

    const dart = play.$store.game.turns[0].darts[0];
    expect(dart.locationX).toBe(5);
    expect(dart.locationY).toBe(-10);
    expect(play.currentScore.call(play)).toBe("1");
  });

  it("does nothing once finished", async () => {
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);
    play.finished = true;

    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 5,
      locationY: -10,
    });

    expect(play.$store.game.turns).toHaveLength(0);
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
});
```

If `shanghai-play.data.test.ts` does not exist yet, create it with the standard header this repo's play-data test files use — mirror `tests/lib/game/singles-training-play.data.test.ts`'s imports/`ACTIVE_SESSION`/`gameStub`/`settingsStub`/`makePlay` structure exactly, substituting `shanghaiPlay`/`shanghaiEngineFactory`/`ShanghaiPlayContext`/`SHANGHAI_V1`/`SHANGHAI` for the singles-training equivalents, `configSnapshot: {}` (Shanghai's config is the empty object), and the `STAGE` constant `{ clientKey: "block-1", stageTypeKey: "EXERCISE_BLOCK", parentClientKey: null, sequence: 1 }` (matches `shanghai.engine.module.ts`'s own `STAGE` constant) — then append the two `describe` blocks above.

- [ ] **Step 5: Run the full suite, format, commit**

```bash
cd app && npm test
npm run format
cd .. && git add app/src/lib/game/shanghai-play.data.ts app/src/lib/game/types.ts \
  app/src/components/layout/games/interfaces/Shanghai.astro \
  app/tests/lib/game/shanghai-play.data.test.ts
git commit -m "Shanghai: wire board-tap (VISUAL_BOARD) play input"
```

---

### Task 3: Around the Clock board input frontend

**Files:**
- Modify: `app/src/lib/game/around-the-clock-play.data.ts`
- Modify: `app/src/lib/game/types.ts` (`AroundTheClockPlayContext`)
- Modify: `app/src/components/layout/games/interfaces/AroundTheClock.astro`
- Test: `app/tests/lib/game/around-the-clock-play.data.test.ts`

**Interfaces:**
- Consumes: same as Task 2 (`boardInputData`, `playVisitMarkers`, `BoardInputPanel.astro`).
- Produces: `aroundTheClockPlay().recordDart(observation)`, `.visitMarkers()`.

- [ ] **Step 1: Add `recordDart`/`visitMarkers`/board spread to `around-the-clock-play.data.ts`**

Apply the exact same shape of edit as Task 2 Step 1, to `app/src/lib/game/around-the-clock-play.data.ts` instead:

- Add `import { boardInputData } from "@lib/game/board-input.data";`.
- Add `playVisitMarkers` to the `@lib/game/play-lifecycle` import list.
- Widen the type import to include `BoardMarker`:
  ```ts
  import type {
    AroundTheClockPlayContext,
    AroundTheClockPreviewSegment,
    BoardMarker,
  } from "./types";
  ```
- Open a `let self: AroundTheClockPlayContext;` closure in `aroundTheClockPlay()`.
- Add `...boardInputData((observation) => self.recordDart(observation)),` right after `engine: null as AroundTheClockEngine | null,`.
- Assign `self = this;` at the top of `init()`.
- Add, right after the existing `commitDart` method:

```ts
    async recordDart(
      this: AroundTheClockPlayContext,
      observation: DartObservation,
    ) {
      if (!this.engine || this.finished) return;
      await this.commitDart(observation);
    },

    /** Overrides `boardInputData`'s own `visitMarkers` — object-literal key
     * order means this later definition wins, so the shared module needs no
     * change. Delegates to `play-lifecycle.ts`'s shared implementation. */
    visitMarkers(this: AroundTheClockPlayContext): BoardMarker[] {
      return playVisitMarkers(this);
    },
```

- [ ] **Step 2: Widen `AroundTheClockPlayContext` in `types.ts`**

Same shape of edit as Task 2 Step 2, applied to `AroundTheClockPlayContext`:

```ts
  hiddenTurnKey: string | null;
  hiddenTimer: ReturnType<typeof setTimeout> | null;
  $store: PlayStoreContext<AroundTheClockSnapshot>;
  engine: AroundTheClockEngine | null;
  visitMarkers(this: AroundTheClockPlayContext): BoardMarker[];
  recordDart(
    this: AroundTheClockPlayContext,
    observation: DartObservation,
  ): Promise<void>;
```

- [ ] **Step 3: Wire `BoardInputPanel` into `AroundTheClock.astro`**

Same edit as Task 2 Step 3, applied to `app/src/components/layout/games/interfaces/AroundTheClock.astro`: add the `BoardInputPanel` import, gate `SinglesRecreationalInput` behind `x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"` + `x-cloak`, and render `<BoardInputPanel />` after it, with the same explanatory comment used in Task 2 Step 3.

- [ ] **Step 4: Add board-input tests, respecting the BULL-visit mid-visit target change**

Around the Clock's target can advance mid-visit (a lucky visit can clear multiple numbers), so its board test must throw a dart that is a genuine hit on the CURRENT engine target at throw time — read `this.engine.state().targetIndex` before constructing each observation, mirroring how `recordTap` already does it. Append to `app/tests/lib/game/around-the-clock-play.data.test.ts` (create following the same header pattern as Task 2 Step 4 if it does not exist, substituting `aroundTheClockPlay`/`aroundTheClockEngineFactory`/`AroundTheClockPlayContext`/`AROUND_THE_CLOCK_V1`/`AROUND_THE_CLOCK`, `configSnapshot: {}`, and the same `EXERCISE_BLOCK` stage shape `around-the-clock.engine.module.ts` itself uses):

```ts
describe("recordDart (board input)", () => {
  it("records a dart via the board path and mirrors it into the store", async () => {
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 5,
      locationY: -10,
    });

    const dart = play.$store.game.turns[0].darts[0];
    expect(dart.locationX).toBe(5);
    expect(dart.locationY).toBe(-10);
  });

  it("does nothing once finished", async () => {
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);
    play.finished = true;

    await play.recordDart.call(play, {
      hitTargetNumber: 1,
      hitZoneKey: "SINGLE",
      locationX: 5,
      locationY: -10,
    });

    expect(play.$store.game.turns).toHaveLength(0);
  });

  it("a BULL hit ends the session immediately, even mid-visit", async () => {
    const play = makePlay({ inputModeKey: "VISUAL_BOARD" });
    await play.init.call(play);

    for (let number = 1; number <= 20; number += 1) {
      await play.recordDart.call(play, {
        hitTargetNumber: number,
        hitZoneKey: "SINGLE",
        locationX: 1,
        locationY: 1,
      });
    }
    expect(play.isBullVisit.call(play)).toBe(true);

    await play.recordDart.call(play, {
      hitTargetNumber: 25,
      hitZoneKey: "OUTER_BULL",
      locationX: 0,
      locationY: -12,
    });

    expect(play.finished).toBe(true);
  });
});
```

- [ ] **Step 5: Run the full suite, format, commit**

```bash
cd app && npm test
npm run format
cd .. && git add app/src/lib/game/around-the-clock-play.data.ts app/src/lib/game/types.ts \
  app/src/components/layout/games/interfaces/AroundTheClock.astro \
  app/tests/lib/game/around-the-clock-play.data.test.ts
git commit -m "Around the Clock: wire board-tap (VISUAL_BOARD) play input"
```

---

### Task 4: 121 engine — dual-shape dart support

**Files:**
- Modify: `app/src/modules/game/one-twenty-one.engine.module.ts`
- Modify: `app/src/modules/game/types.ts` (add `OneTwentyOneInput`)
- Test: `app/tests/modules/game/one-twenty-one.engine.module.test.ts`

**Interfaces:**
- Consumes: `classify` (`@lib/game/board/board-geometry.module`), `DartObservation`/`DartFact` (`./types`).
- Produces: `OneTwentyOneEngine.record(input: OneTwentyOneInput)`, `.undo()`, `.wouldComplete(input: OneTwentyOneInput)` — all now dual-shape, consumed by Task 5's `one-twenty-one-play.data.ts`.

**Design note — why this is not a blind copy of `FiveOhOneEngine`:** 501 has no per-round visit cap, so folding an *open* (still-being-thrown) turn's running total through `applyFiveOhOneVisit` only ever touches `remainingScore` — safe. 121 has `visitsThisAttempt` (capped at 3 per round), and `applyOneTwentyOneVisit` treats every turn it folds as a *finished* visit — it always evaluates the bust/checkout matrix and, on a non-checkout, increments `visitsThisAttempt`. Folding a still-open turn's partial total through it therefore prematurely counts an unfinished visit as a finished one. `deriveState()` below is split accordingly: closed turns fold normally (this is where `visitsThisAttempt`/`currentTarget`/`status` come from); the currently open turn (if any) only overlays a live subtraction onto `remainingInAttempt` for on-board display, never touching the visit counter. This never changes behavior for a pure keypad session: `recordVisitTotal` (the renamed old `record()`) always stamps `completedAt` immediately, so a keypad-only game log never has an open turn and `deriveState()` folds identically to before.

- [ ] **Step 1: Add `OneTwentyOneInput` to `modules/game/types.ts`**

In `app/src/modules/game/types.ts`, immediately after the existing `OneTwentyOneVisitInput` type, add:

```ts
/** 121 accepts a visit total under QUICK_SCORE, one dart under VISUAL_BOARD. */
export type OneTwentyOneInput = OneTwentyOneVisitInput | DartObservation;
```

(`DartObservation` is already defined later in the same file — forward references between type aliases in the same module are fine in TypeScript.) Also correct the now-stale comment on `OneTwentyOneVisitInput` itself — it currently reads "121 is quick-score only in v1, so there is no dart-observation variant."; delete that sentence, since it is no longer true.

- [ ] **Step 2: Write failing engine tests for dart-based visit building**

Append to `app/tests/modules/game/one-twenty-one.engine.module.test.ts`. First add these imports/fixtures near the top of the file if not already present (check the existing `import` block; add only what's missing):

```ts
import type { DartObservation, DartZoneKey } from "@modules/types";
```

Then append:

```ts
describe("visual board capture", () => {
  /**
   * A located dart. The engine re-classifies from the coordinate, so the
   * claimed zone is never authoritative — but it is stated truthfully anyway.
   */
  const dartAt = (
    x: number,
    y: number,
    hitZoneKey: DartZoneKey,
    hitTargetNumber: number | null,
  ): DartObservation => ({ hitTargetNumber, hitZoneKey, locationX: x, locationY: y });

  const trebleTwenty = dartAt(0, -102, "TREBLE", 20);
  const doubleTwenty = dartAt(0, -166, "DOUBLE", 20);

  it("deducts each dart from the remaining live total as it lands", () => {
    const engine = oneTwentyOneEngineFactory.create({}) as OneTwentyOneEngine;

    engine.record(trebleTwenty);
    expect(engine.state().remainingInAttempt).toBe(61);

    engine.record(trebleTwenty);
    expect(engine.state().remainingInAttempt).toBe(1);
  });

  it("does not prematurely advance the visit counter while a visit is still open", () => {
    const engine = oneTwentyOneEngineFactory.create({}) as OneTwentyOneEngine;

    engine.record(trebleTwenty);

    expect(engine.state().visitsThisAttempt).toBe(0);
  });

  it("keeps dart rows with real scores when a visit busts", () => {
    const engine = oneTwentyOneEngineFactory.create({}) as OneTwentyOneEngine;

    engine.record(trebleTwenty);
    engine.record(dartAt(0, -102, "TREBLE", 20));
    engine.record(dartAt(0, -102, "TREBLE", 20));

    const busted = engine.facts().turns.at(-1)!;
    expect(busted.totalScore).toBe(0);
    expect(busted.darts.map((dart) => dart.score)).toEqual([60, 60, 60]);
    expect(engine.state().remainingInAttempt).toBe(121);
    expect(engine.state().visitsThisAttempt).toBe(1);
  });

  it("checks out on a double and climbs the ladder", () => {
    const engine = oneTwentyOneEngineFactory.create({}) as OneTwentyOneEngine;
    engine.record({ scoreAttempted: 41, finishedOnDouble: false });

    engine.record(doubleTwenty);
    engine.record(dartAt(0, -166, "DOUBLE", 20));

    expect(engine.state()).toEqual({
      currentTarget: 122,
      remainingInAttempt: 122,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
    });
  });

  it("wins the session on a checkout at the 170 cap target", () => {
    const engine = oneTwentyOneEngineFactory.create({}) as OneTwentyOneEngine;
    for (let target = 121; target < 170; target += 1) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true });
    }
    expect(engine.state().currentTarget).toBe(170);

    engine.record(dartAt(0, -12, "OUTER_BULL", 25));
    engine.record(dartAt(0, -12, "OUTER_BULL", 25));
    engine.record(dartAt(0, -12, "INNER_BULL", 25));

    expect(engine.isComplete()).toBe(true);
    expect(engine.state().status).toBe("WON");
  });

  it("leaves keypad behaviour unchanged", () => {
    const engine = oneTwentyOneEngineFactory.create({}) as OneTwentyOneEngine;

    engine.record({ scoreAttempted: 60 });

    expect(engine.state().remainingInAttempt).toBe(61);
    expect(engine.facts().turns.at(-1)!.darts).toHaveLength(0);
  });
});

describe("OneTwentyOneEngine.wouldComplete — visual board", () => {
  const dartAt = (
    x: number,
    y: number,
    hitZoneKey: DartZoneKey,
    hitTargetNumber: number | null,
  ): DartObservation => ({ hitTargetNumber, hitZoneKey, locationX: x, locationY: y });

  it("is false for a dart that merely opens a visit", () => {
    const engine = oneTwentyOneEngineFactory.create({}) as OneTwentyOneEngine;
    expect(engine.wouldComplete(dartAt(0, -102, "TREBLE", 20))).toBe(false);
  });

  it("is true for the checkout dart at the cap target", () => {
    const engine = oneTwentyOneEngineFactory.create({}) as OneTwentyOneEngine;
    for (let target = 121; target < 170; target += 1) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true });
    }
    engine.record(dartAt(0, -12, "OUTER_BULL", 25));
    engine.record(dartAt(0, -12, "OUTER_BULL", 25));

    expect(engine.wouldComplete(dartAt(0, -12, "INNER_BULL", 25))).toBe(true);
  });

  it("is false for the same checkout short of the cap target", () => {
    const engine = oneTwentyOneEngineFactory.create({}) as OneTwentyOneEngine;
    expect(
      engine.wouldComplete(dartAt(0, -166, "DOUBLE", 20)),
    ).toBe(false);
  });

  it("does not mutate the fact log", () => {
    const engine = oneTwentyOneEngineFactory.create({}) as OneTwentyOneEngine;
    const before = engine.facts();

    engine.wouldComplete(dartAt(0, -102, "TREBLE", 20));

    expect(engine.facts()).toEqual(before);
  });
});

describe("OneTwentyOneEngine.undo — dispatches on the fact log's shape", () => {
  const dartAt = (
    x: number,
    y: number,
    hitZoneKey: DartZoneKey,
    hitTargetNumber: number | null,
  ): DartObservation => ({ hitTargetNumber, hitZoneKey, locationX: x, locationY: y });

  it("undoes one dart at a time, reopening the visit", () => {
    const engine = oneTwentyOneEngineFactory.create({}) as OneTwentyOneEngine;
    engine.record(dartAt(0, -102, "TREBLE", 20));
    engine.record(dartAt(0, -102, "TREBLE", 20));

    expect(engine.undo()).toBe(true);

    expect(engine.facts().turns).toHaveLength(1);
    expect(engine.facts().turns[0].darts).toHaveLength(1);
    expect(engine.state().remainingInAttempt).toBe(61);
  });

  it("removes the whole turn once its last dart is undone", () => {
    const engine = oneTwentyOneEngineFactory.create({}) as OneTwentyOneEngine;
    engine.record(dartAt(0, -102, "TREBLE", 20));

    expect(engine.undo()).toBe(true);

    expect(engine.facts().turns).toHaveLength(0);
    expect(engine.state().remainingInAttempt).toBe(121);
  });

  it("undoes a checkout that opened a new round, popping the round stage and reopening the checkout visit", () => {
    const engine = oneTwentyOneEngineFactory.create({}) as OneTwentyOneEngine;
    engine.record({ scoreAttempted: 41, finishedOnDouble: false });
    engine.record(dartAt(0, -166, "DOUBLE", 20));
    engine.record(dartAt(0, -166, "DOUBLE", 20));
    expect(engine.facts().stages).toHaveLength(2);

    expect(engine.undo()).toBe(true);

    expect(engine.facts().stages).toHaveLength(1);
    const reopened = engine.facts().turns.at(-1)!;
    expect(reopened.darts).toHaveLength(1);
    expect(reopened.completedAt).toBeNull();
    expect(engine.state().currentTarget).toBe(121);
  });

  it("a keypad-recorded turn still undoes as a whole visit, not a dart", () => {
    const engine = oneTwentyOneEngineFactory.create({}) as OneTwentyOneEngine;
    engine.record({ scoreAttempted: 60 });

    expect(engine.undo()).toBe(true);

    expect(engine.facts().turns).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run the new tests to see them fail**

```bash
cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts
```

Expected: FAIL — `engine.record(dartAt(...))` throws or misbehaves because `record()` does not yet dispatch on shape.

- [ ] **Step 4: Rewrite `one-twenty-one.engine.module.ts`**

Replace the full file `app/src/modules/game/one-twenty-one.engine.module.ts` with:

```ts
import type { OneTwentyOneSnapshot } from "@lib/types";
import { newClientKey } from "./client-key.module";
import { classify } from "@lib/game/board/board-geometry.module";
import { registerEngineFactory } from "./engine.registry";
import type { GameEngine, GameEngineFactory } from "./interfaces";
import type {
  DartFact,
  DartObservation,
  EngineFacts,
  OneTwentyOneInput,
  OneTwentyOneState,
  OneTwentyOneVisitInput,
  OneTwentyOneVisitOutcome,
  StageFact,
  TurnFact,
} from "./types";

const START_TARGET = 121;
const CAP_TARGET = 170;
const VISITS_PER_ATTEMPT = 3;
const DARTS_PER_VISIT = 3;
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

/**
 * Discriminates `OneTwentyOneInput` by shape, never by session mode: only
 * `DartObservation` carries `hitZoneKey`, so its presence is a sound type
 * guard no matter which mode the session was created in — mirrors
 * `five-oh-one.engine.module.ts`'s `isDartObservation`.
 */
function isDartObservation(input: OneTwentyOneInput): input is DartObservation {
  return "hitZoneKey" in input;
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
 * Pure reducer: folds one FINISHED visit onto a `OneTwentyOneState`. A
 * checkout at the cap target (170) wins the session; any other checkout
 * climbs the target by one and opens a fresh 3-visit budget. A visit that
 * neither checks out nor is the attempt's 3rd carries its remaining score to
 * the next visit in the same attempt. The 3rd non-checkout visit applies the
 * v1 fail rule — stay on the same target with a fresh budget — whether that
 * visit busted or simply fell short.
 *
 * Callers must only fold a visit that has actually resolved (checked out,
 * busted, or reached its 3rd dart) — this always treats its input as a
 * finished visit and will prematurely count `visitsThisAttempt` for a visit
 * still being thrown. `OneTwentyOneEngine.deriveState()` enforces this split.
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
 * visits (9 darts) and won by a visit whose final dart lands in a double.
 * Under QUICK_SCORE the engine owns one turn per visit, carrying the visit
 * total with no dart rows. Under VISUAL_BOARD it owns one dart at a time,
 * exactly mirroring `FiveOhOneEngine`'s dual-shape `record()` — see this
 * file's own `deriveState()` for why 121's derivation cannot simply copy
 * 501's (the per-round visit cap 501 does not have).
 */
export class OneTwentyOneEngine implements GameEngine<
  OneTwentyOneInput,
  OneTwentyOneState
> {
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
   * Folds every CLOSED turn as the finished visit that produced it. Never
   * called with an open turn — `deriveState()` is the only caller and keeps
   * an open turn out of this fold on purpose.
   */
  private deriveClosedState(turns: readonly TurnFact[]): OneTwentyOneState {
    return turns
      .filter((turn) => turn.completedAt !== null)
      .reduce(
        (state, turn) =>
          applyOneTwentyOneVisit(state, {
            scoreAttempted: turn.totalScore,
            finishedOnDouble: true,
          }),
        initialOneTwentyOneState(),
      );
  }

  /**
   * The full derived state: every closed visit folded in full (this is
   * where `currentTarget`/`visitsThisAttempt`/`status` come from), with the
   * currently open visit's running total (if any) overlaid onto
   * `remainingInAttempt` only — a live countdown as darts land, without
   * counting an unfinished visit against the round's 3-visit budget. A
   * keypad-only game log never has an open turn (`recordVisitTotal` always
   * stamps `completedAt` immediately), so this is byte-identical to folding
   * every turn for a pure keypad session.
   */
  private deriveState(): OneTwentyOneState {
    const state = this.deriveClosedState(this.turns);
    const open = this.openVisit();
    if (!open) return state;
    return {
      ...state,
      remainingInAttempt: state.remainingInAttempt - open.totalScore,
    };
  }

  /**
   * Classifies one board observation into the target, zone, and score it
   * struck. A miss carries no coordinates, so it resolves to a scoreless
   * `MISS` hit using the observation's own zone key rather than going
   * through `classify()` — mirrors `five-oh-one.engine.module.ts`.
   */
  private resolveObservation(observation: DartObservation) {
    return observation.locationX === null || observation.locationY === null
      ? {
          targetNumber: null,
          zoneKey: observation.hitZoneKey,
          score: 0,
        }
      : classify(observation.locationX, observation.locationY);
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

  /** The visit still being thrown, or null when the last one closed. */
  private openVisit(): TurnFact | null {
    const last = this.turns.at(-1);
    if (!last || last.completedAt !== null) return null;
    return last;
  }

  /** Appends an empty visit to the open round and returns it. */
  private openNewVisit(): TurnFact {
    const round = this.openRound();
    const visit: TurnFact = {
      clientKey: newClientKey(),
      stageClientKey: round.clientKey,
      sequence: this.turnCountIn(round.clientKey) + 1,
      completedAt: null,
      totalScore: 0,
      darts: [],
    };
    this.turns.push(visit);
    return visit;
  }

  /**
   * What the attempt's remaining score was immediately before `visit`
   * opened — every turn strictly before `visit` in `this.turns` is always
   * already closed (an engine only ever has one open turn, the last one),
   * so folding them through `deriveClosedState` is safe and exact.
   */
  private remainingBeforeVisit(visit: TurnFact): number {
    const index = this.turns.indexOf(visit);
    return this.deriveClosedState(this.turns.slice(0, index)).remainingInAttempt;
  }

  /**
   * Appends one visit to the open round, then opens the next round's stage
   * when that visit resolved the attempt (checkout or a 3rd non-checkout)
   * and the session continues. Stages and turns move together so the log
   * never holds a turn without its stage.
   * @throws when the score is out of range or the session has already
   *   ended; the fact log is left untouched.
   */
  private recordVisitTotal(input: OneTwentyOneVisitInput): OneTwentyOneState {
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
   * Applies the bust and checkout rules to a visit that just took a dart,
   * and stamps `completedAt` when the visit resolves.
   * @returns whether this dart resolved (closed) the visit — the caller
   *   uses this, not merely "the round changed", to decide whether to open
   *   a new round stage, since an already-in-progress round's
   *   `visitsThisAttempt` can coincidentally read 0 before the round's very
   *   first visit has even closed.
   */
  private settleVisit(visit: TurnFact): boolean {
    const thrown = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    const remainingAfter = this.remainingBeforeVisit(visit) - thrown;
    const lastDart = visit.darts.at(-1)!;
    const checkedOut = remainingAfter === 0 && lastDart.hitZoneKey === "DOUBLE";
    const busted =
      remainingAfter < 0 ||
      remainingAfter === 1 ||
      (remainingAfter === 0 && !checkedOut);

    if (busted) {
      visit.totalScore = 0;
      visit.completedAt = new Date().toISOString();
      return true;
    }

    visit.totalScore = thrown;
    const resolved = checkedOut || visit.darts.length === DARTS_PER_VISIT;
    if (resolved) {
      visit.completedAt = new Date().toISOString();
    }
    return resolved;
  }

  /**
   * Records one dart. The visit closes when it busts, when it checks out on
   * a double, or on the third dart — mirrors
   * `five-oh-one.engine.module.ts`'s `recordDart`, adapted for the round
   * boundary (see class-level doc).
   * @throws when the session is already complete; the fact log is left
   *   untouched.
   */
  private recordDart(observation: DartObservation): OneTwentyOneState {
    if (this.deriveState().status !== "IN_PROGRESS") {
      throw new Error("Cannot record a visit once the session is complete");
    }

    const resolved = this.resolveObservation(observation);
    const visit = this.openVisit() ?? this.openNewVisit();

    visit.darts.push({
      sequence: visit.darts.length + 1,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: resolved.targetNumber,
      hitZoneKey: resolved.zoneKey,
      score: resolved.score,
      locationX: observation.locationX,
      locationY: observation.locationY,
    });

    const visitResolved = this.settleVisit(visit);

    const after = this.deriveState();
    if (
      visitResolved &&
      after.visitsThisAttempt === 0 &&
      after.status === "IN_PROGRESS"
    ) {
      this.stages.push(roundStage(this.stages.length + 1));
    }

    return after;
  }

  record(input: OneTwentyOneInput): OneTwentyOneState {
    if (isDartObservation(input)) {
      return this.recordDart(input);
    }
    return this.recordVisitTotal(input);
  }

  /**
   * Pops the last recorded visit or dart, including one replayed from
   * persisted facts. Dispatches on the shape of the last recorded turn — a
   * turn built from a keypad total always has `darts: []`; a turn built
   * from a board dart always holds at least one dart from the moment it
   * exists in the log — mirrors `five-oh-one.engine.module.ts`'s `undo`.
   * @returns true if a dart or a visit was removed; false if there was
   *   nothing to undo.
   */
  undo(): boolean {
    const last = this.turns.at(-1);
    if (!last) return false;

    return last.darts.length > 0 ? this.undoDart() : this.undoVisitTotal();
  }

  private undoVisitTotal(): boolean {
    const removed = this.turns.pop();
    if (!removed) return false;

    this.popStageOpenedBy(removed.stageClientKey);
    return true;
  }

  private undoDart(): boolean {
    const visit = this.turns.at(-1);
    if (!visit) return false;

    visit.darts.pop();
    this.popStageOpenedBy(visit.stageClientKey);

    if (visit.darts.length === 0) {
      this.turns.pop();
      return true;
    }

    visit.totalScore = visit.darts.reduce((sum, dart) => sum + dart.score, 0);
    visit.completedAt = null;
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
   * Whether the dart under consideration would check out the cap target —
   * the one way a 121 session can complete on a single dart.
   */
  private wouldCompleteDart(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;

    const resolved = this.resolveObservation(observation);
    const remainingAfter = before.remainingInAttempt - resolved.score;
    const checksOut = remainingAfter === 0 && resolved.zoneKey === "DOUBLE";
    return checksOut && before.currentTarget === CAP_TARGET;
  }

  /**
   * Answers whether recording `input` would win the session, without
   * mutating the fact log or the derived state. Only a checkout at the cap
   * target (170) can ever complete a 121 session.
   */
  wouldComplete(input: OneTwentyOneInput): boolean {
    if (isDartObservation(input)) {
      return this.wouldCompleteDart(input);
    }

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
  OneTwentyOneInput,
  OneTwentyOneState
> = {
  rulesetVersionKey: "121_V1",
  create(config: OneTwentyOneSnapshot, prior?: EngineFacts) {
    return new OneTwentyOneEngine(config, prior);
  },
};

registerEngineFactory(oneTwentyOneEngineFactory);
```

- [ ] **Step 5: Run the tests to see them pass**

```bash
cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts
```

Expected: PASS, all existing and new cases.

- [ ] **Step 6: Run the full suite**

```bash
cd app && npm test
```

Expected: all tests pass — `one-twenty-one-play.data.test.ts` and `one-twenty-one.validator.test.ts` must still pass unmodified, since `record({scoreAttempted, finishedOnDouble})` keypad calls are byte-identical to before.

- [ ] **Step 7: Format and commit**

```bash
cd app && npm run format
git add app/src/modules/game/one-twenty-one.engine.module.ts app/src/modules/game/types.ts \
  app/tests/modules/game/one-twenty-one.engine.module.test.ts
git commit -m "121 engine: dual-shape record()/undo()/wouldComplete() for board darts"
```

---

### Task 5: 121 board input frontend

**Files:**
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts`
- Modify: `app/src/lib/game/types.ts` (`OneTwentyOnePlayContext`)
- Modify: `app/src/components/layout/games/interfaces/OneTwentyOne.astro`
- Test: `app/tests/lib/game/one-twenty-one-play.data.test.ts`

**Interfaces:**
- Consumes: `boardInputData` (`app/src/lib/game/board-input.data.ts`, no override of its default `visitMarkers()` needed — 121 has no reveal-then-clear/hidden-turn concept, matching `five-oh-one-play.data.ts`'s precedent of not overriding it either), `BoardInputPanel.astro`, `OneTwentyOneEngine`'s new dual-shape `record`/`wouldComplete` (Task 4).
- Produces: `oneTwentyOnePlay().recordDart(observation)`, `.commitDart(observation)`, `.pendingDartObservation`.

**Design note:** `foldRoundState`/`currentTargetLabel`'s current implementation folds every turn (including a still-open board turn) through `applyOneTwentyOneVisit` directly — the exact premature-visit-count bug Task 4 fixed inside the engine. Both are rewritten here to apply the same closed/open split, reusing `TurnFact.completedAt` the same way the engine does. `dartsThrownThisSession` needs no change — it already calls the shared `dartsThrownCount` helper (`app/src/lib/game/play-visit-stats.ts`), which already handles the open/closed split generically.

- [ ] **Step 1: Rewrite `one-twenty-one-play.data.ts`**

Replace the full file `app/src/lib/game/one-twenty-one-play.data.ts` with:

```ts
import { ScoreInputBuffer } from "@modules/game/score-input.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import {
  applyOneTwentyOneVisit,
  initialOneTwentyOneState,
} from "@modules/game/one-twenty-one.engine.module";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
import { resolveSessionModePair } from "@lib/game/session-mode-resolution";
import { boardInputData } from "@lib/game/board-input.data";
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
import type {
  DartObservation,
  EngineFacts,
  OneTwentyOneState,
  TurnFact,
} from "@modules/types";
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
 * Folds `turns` into a `OneTwentyOneState` for reactive display, exactly
 * like the engine's own `deriveState()` — every CLOSED turn folds fully
 * (this is where `currentTarget`/`visitsThisAttempt`/`status` come from);
 * the currently open turn, if any, only overlays a live subtraction onto
 * `remainingInAttempt`, never touching the visit counter. Reads only the
 * reactive `$store.game` fields, never `engine.state()`, so every Alpine
 * display expression that calls this re-renders when `recordFacts` writes a
 * new turn.
 */
function foldRoundState(turns: readonly TurnFact[]): OneTwentyOneState {
  const closed = turns.filter((turn) => turn.completedAt !== null);
  const state = closed.reduce(
    (s, turn) =>
      applyOneTwentyOneVisit(s, {
        scoreAttempted: turn.totalScore,
        finishedOnDouble: true,
      }),
    initialOneTwentyOneState(),
  );

  const last = turns.at(-1);
  if (!last || last.completedAt !== null) return state;
  return {
    ...state,
    remainingInAttempt: state.remainingInAttempt - last.totalScore,
  };
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
 * `self` exists only so `boardInputData`'s `onCommit` callback can reach this
 * page's own `recordDart` with the live, reactive `this` Alpine binds to
 * every directive-driven call — mirrors `five-oh-one-play.data.ts`'s own
 * `self` pattern.
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
    pendingDartObservation: null as DartObservation | null,
    showDoubleConfirm: false,
    showSessionFinishConfirm: false,
    engine: null as OneTwentyOneEngine | null,
    ...boardInputData((observation) => self.recordDart(observation)),

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
      return String(foldRoundState(this.$store.game.turns).currentTarget);
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
     * The board's per-dart counterpart to `recordVisit`: every dart the
     * player throws arrives here from `boardInputData`'s `onCommit`. A dart
     * that would complete the whole session is gated behind
     * `showSessionFinishConfirm`, because recording it uploads and completes
     * the session immediately and that step is irreversible; a
     * ladder-climbing checkout or a bust commits straight away — mirrors
     * `five-oh-one-play.data.ts`'s `recordDart`.
     */
    async recordDart(this: OneTwentyOnePlayContext, observation: DartObservation) {
      if (
        !this.engine ||
        this.finished ||
        this.showDoubleConfirm ||
        this.showSessionFinishConfirm
      )
        return;

      if (this.engine.wouldComplete(observation)) {
        this.pendingDartObservation = observation;
        this.showSessionFinishConfirm = true;
        return;
      }

      await this.commitDart(observation);
    },

    /**
     * Records one dart against the engine and refreshes displayed state
     * exactly as `recordVisit` does for a whole visit — shared by the
     * immediate path (`recordDart`) and the deferred session-finish confirm
     * (`confirmSessionFinish`).
     */
    async commitDart(this: OneTwentyOnePlayContext, observation: DartObservation) {
      if (!this.engine) return;
      this.engine.record(observation);
      this.error = "";
      this.$store.game.recordFacts(this.engine.facts());

      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
    },

    /**
     * 121 is double-out but this app's keypad only captures a visit's total,
     * not individual darts — so when the entered score would bring the
     * attempt's remaining total to exactly 0, the app cannot know from the
     * number alone whether the last dart was a double (a checkout) or not (a
     * bust). `isCheckoutAttempt` gates a "Finished on a double?" confirm
     * before anything is recorded; every other visit records immediately.
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
     * ladder records immediately. A checkout at the cap target (170) wins
     * the whole session and is irreversible once uploaded, so this asks
     * `engine.wouldComplete` and opens a second confirm instead of
     * recording right away, mirroring `five-oh-one-play.data.ts`'s
     * `confirmDouble`.
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
     * Confirm on the second, session-ending dialog: records whichever the
     * player was deferred on — the board's dart (`recordDart`'s gate) or the
     * keypad's checkout (`confirmDouble`'s deferral) — mirrors
     * `five-oh-one-play.data.ts`'s `confirmMatchFinish`.
     */
    async confirmSessionFinish(this: OneTwentyOnePlayContext) {
      if (!this.engine || this.finished || !this.showSessionFinishConfirm)
        return;

      if (this.pendingDartObservation) {
        const observation = this.pendingDartObservation;
        this.pendingDartObservation = null;
        this.showSessionFinishConfirm = false;
        await this.commitDart(observation);
        return;
      }

      if (this.pendingCheckoutScore == null) return;
      const score = this.pendingCheckoutScore;
      this.pendingCheckoutScore = null;
      this.showSessionFinishConfirm = false;
      await this.recordVisit(score, true);
    },

    /**
     * Cancel on the second, session-ending dialog. Nothing is recorded; a
     * deferred keypad score returns to the keypad, a deferred dart is simply
     * discarded (the player throws again) — mirrors
     * `five-oh-one-play.data.ts`'s `cancelMatchFinish`.
     */
    cancelSessionFinish(this: OneTwentyOnePlayContext) {
      if (!this.showSessionFinishConfirm) return;

      if (this.pendingDartObservation) {
        this.pendingDartObservation = null;
        this.showSessionFinishConfirm = false;
        return;
      }

      if (this.pendingCheckoutScore == null) return;
      this.scoreInput.setValue(String(this.pendingCheckoutScore));
      this.pendingCheckoutScore = null;
      this.showSessionFinishConfirm = false;
    },

    undoVisit(this: OneTwentyOnePlayContext) {
      if (
        this.finished ||
        this.showDoubleConfirm ||
        this.showSessionFinishConfirm
      )
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
    async uploadAndCompleteSession(
      this: OneTwentyOnePlayContext,
    ): Promise<void> {
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
        this.pendingDartObservation = null;
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

- [ ] **Step 2: Widen `OneTwentyOnePlayContext` in `types.ts`**

In `app/src/lib/game/types.ts`, find `export type OneTwentyOnePlayContext`. Add `pendingDartObservation` next to the existing `pendingCheckoutScore` field, and add `recordDart`/`commitDart` method signatures right after `recordVisit`'s, mirroring `FiveOhOnePlayContext`'s exact shape:

```ts
  pendingCheckoutScore: number | null;
  pendingDartObservation: DartObservation | null;
  showDoubleConfirm: boolean;
  showSessionFinishConfirm: boolean;
  $store: PlayStoreContext<OneTwentyOneSnapshot>;
  engine: OneTwentyOneEngine | null;
```

and, right after the existing `recordVisit(...)` signature:

```ts
  recordVisit(
    this: OneTwentyOnePlayContext,
    score: number,
    finishedOnDouble: boolean,
  ): Promise<void>;
  recordDart(
    this: OneTwentyOnePlayContext,
    observation: DartObservation,
  ): Promise<void>;
  commitDart(
    this: OneTwentyOnePlayContext,
    observation: DartObservation,
  ): Promise<void>;
```

`DartObservation` is already imported into `types.ts` (used by `FiveOhOnePlayContext` already) — no new import needed.

- [ ] **Step 3: Wire `BoardInputPanel` into `OneTwentyOne.astro`**

Replace the full file `app/src/components/layout/games/interfaces/OneTwentyOne.astro` with:

```astro
---
interface Props {
  [key: string]: unknown;
}

const { ...props }: Props = Astro.props;

import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import ScoreInput from "@components/layout/games/ScoreInput.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import BoardInputPanel from "@components/layout/games/BoardInputPanel.astro";
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
    x-show="$store.game.inputModeKey !== 'VISUAL_BOARD'"
    x-cloak
  />
  {
    /* Visual board — shown instead of the keypad above for an
    ANALYTICS + VISUAL_BOARD session, which enters every dart by pointer. */
  }
  <BoardInputPanel />
</div>
```

- [ ] **Step 4: Add board-input tests**

Append to `app/tests/lib/game/one-twenty-one-play.data.test.ts` (its existing header/`baseStore`/`createPlay` helpers stay as-is):

```ts
describe("recordDart (board input)", () => {
  it("opens a visit and records one dart without closing it", async () => {
    const play = createPlay();
    play.engine = oneTwentyOneEngineFactory.create({}) as any;

    await play.recordDart.call(play, {
      hitTargetNumber: 20,
      hitZoneKey: "TREBLE",
      locationX: 0,
      locationY: -102,
    });

    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].completedAt).toBeNull();
    expect(play.remainingInAttempt.call(play)).toBe(61);
  });

  it("closes the visit on the third dart", async () => {
    const play = createPlay();
    play.engine = oneTwentyOneEngineFactory.create({}) as any;

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

    expect(play.$store.game.turns[0].completedAt).not.toBeNull();
    expect(play.$store.game.turns[0].darts).toHaveLength(3);
  });

  it("undo removes one dart at a time, not the whole visit", async () => {
    const play = createPlay();
    play.engine = oneTwentyOneEngineFactory.create({}) as any;
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

    play.undoVisit.call(play);

    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].darts).toHaveLength(1);
  });
});

describe("recordDart — session-ending checkout defers to the confirm dialog", () => {
  it("opens showSessionFinishConfirm instead of recording immediately", async () => {
    const play = createPlay();
    const engine = oneTwentyOneEngineFactory.create({}) as any;
    for (let target = 121; target < 170; target += 1) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true });
    }
    play.engine = engine;
    play.$store.game.recordFacts(engine.facts());

    await play.recordDart.call(play, {
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: -166,
    });

    expect(play.showSessionFinishConfirm).toBe(true);
    expect(play.pendingDartObservation).toEqual({
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: -166,
    });
    expect(play.finished).toBe(false);
  });

  it("confirmSessionFinish records the deferred dart and finishes", async () => {
    vi.mocked(sessionsApi.appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 1 },
    } as any);
    vi.mocked(sessionsApi.completeSession).mockResolvedValue({
      sessionId: "session-1",
      statusKey: "COMPLETED",
      completedAt: "now",
    } as any);

    const play = createPlay();
    const engine = oneTwentyOneEngineFactory.create({}) as any;
    for (let target = 121; target < 170; target += 1) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true });
    }
    play.engine = engine;
    play.$store.game.recordFacts(engine.facts());
    await play.recordDart.call(play, {
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: -166,
    });

    await play.confirmSessionFinish.call(play);

    expect(play.showSessionFinishConfirm).toBe(false);
    expect(play.pendingDartObservation).toBeNull();
    expect(play.finished).toBe(true);
  });

  it("cancelSessionFinish records nothing", async () => {
    const play = createPlay();
    const engine = oneTwentyOneEngineFactory.create({}) as any;
    for (let target = 121; target < 170; target += 1) {
      engine.record({ scoreAttempted: target, finishedOnDouble: true });
    }
    play.engine = engine;
    play.$store.game.recordFacts(engine.facts());
    const turnCountBefore = play.$store.game.turns.length;
    await play.recordDart.call(play, {
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: 0,
      locationY: -166,
    });

    play.cancelSessionFinish.call(play);

    expect(play.showSessionFinishConfirm).toBe(false);
    expect(play.pendingDartObservation).toBeNull();
    expect(play.$store.game.turns).toHaveLength(turnCountBefore);
    expect(play.finished).toBe(false);
  });
});
```

Check the top of `app/tests/lib/game/one-twenty-one-play.data.test.ts` for its existing `vi.mock("@client/api/sessions")` setup (it already mocks the whole module per line 6 of the current file) — the two `vi.mocked(sessionsApi.*)` calls above match that existing mock style; adjust only if the current file's mock shape differs.

- [ ] **Step 5: Run the full suite, format, commit**

```bash
cd app && npm test
npm run format
cd .. && git add app/src/lib/game/one-twenty-one-play.data.ts app/src/lib/game/types.ts \
  app/src/components/layout/games/interfaces/OneTwentyOne.astro \
  app/tests/lib/game/one-twenty-one-play.data.test.ts
git commit -m "121: wire board-tap (VISUAL_BOARD) play input"
```

---

### Task 6: Full regression pass and context maintenance

**Files:** none new — verification only, plus whatever `context-maintenance` and `run-all-gates` touch (context map, decision ledger check, gate scripts).

- [ ] **Step 1: Run the full validation sequence**

```bash
cd app && npm run validate:app
```

Expected: passes (or reports the same pre-existing no-`DATABASE_URL` limitations every recent task in this repo has flagged — `db:status`/`db:migrate`/`db:introspect` cannot run in this container; note this rather than treat it as a failure, matching established precedent).

- [ ] **Step 2: Run the `run-all-gates` skill**

Invoke the `run-all-gates` skill (dispatches the right `check-*.sh` scripts for `app/`, `database/`, `docs/` changes made across Tasks 1–5) and resolve any reported failure before proceeding.

- [ ] **Step 3: Manually verify seed/verification SQL row counts**

```bash
grep -c "'ANALYTICS', 'VISUAL_BOARD'" database/seeds/0007_ruleset_version_capabilities.sql
```

Expected: `8` (501, Score Training, Singles, Bob's 27, Doubles Training, Shanghai, 121, Around the Clock).

- [ ] **Step 4: Run the `context-maintenance` skill**

Invoke the `context-maintenance` skill to update `docs/architecture/00-Context-Map.md`'s version header/changelog entry, confirm no `decisions/**` entry is needed (per the design doc's Decisions section), and confirm the design spec + this plan are registered in the File Inventory.

- [ ] **Step 5: Final full-suite confirmation and commit**

```bash
cd app && npm test
```

Expected: full green suite. If Step 2 or Step 4 produced file changes (context map, gate-script fixes), commit them:

```bash
cd .. && git add docs/architecture/00-Context-Map.md
git commit -m "Context maintenance: 121/Shanghai/Around the Clock ANALYTICS + VISUAL_BOARD"
```

---

## Self-Review

**Spec coverage:** Design doc's Group A (Shanghai/Around the Clock) → Tasks 2/3. Group B (121, engine + validator + frontend) → Tasks 4/5, plus Task 1 for 121's validator/capability. Capability & seed layer (all three) → Task 1. Testing section → each task's own Step 4/tests plus Task 6's full-suite runs. Decisions section (no new entry) → Task 6 Step 4 confirms this explicitly. Out of scope items (schema, `v_*` views, Bob's 27) → untouched by every task, no gap.

**Placeholder scan:** No TBD/TODO; every step carries complete code or an exact shell command with expected output.

**Type consistency:** `OneTwentyOneInput` (Task 4 Step 1, `modules/game/types.ts`) is consumed by `OneTwentyOneEngine.record`/`.wouldComplete` (Task 4 Step 4) and never referenced again outside that module — Task 5's play-data calls `engine.record(observation)`/`engine.record({scoreAttempted, finishedOnDouble})` positionally, matching the union without needing the type name itself. `recordDart`/`commitDart`/`pendingDartObservation` names match exactly between Task 5 Step 1 (implementation) and Step 2 (`OneTwentyOnePlayContext` type). `visitMarkers`/`recordDart` names in Tasks 2/3 match `SinglesTrainingPlayContext`'s already-shipped shape exactly, confirmed against `app/src/lib/game/types.ts` directly. `foldRoundState`'s new signature (`readonly TurnFact[]`) is compatible with both of its Task 5 call sites (`turnsInCurrentRound()` returns `TurnFact[]`, `$store.game.turns` is `TurnFact[]`).
