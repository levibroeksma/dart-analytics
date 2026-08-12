# Bob's 27 Phase 2 — ANALYTICS + VISUAL_BOARD Capability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Declare and implement `ANALYTICS + VISUAL_BOARD` as a second supported mode pair for `BOBS27_V1`, so Phase 4's board-tap input has a session it can actually create and upload against. `BOBS27_V1` today only declares `RECREATIONAL + DETAILED_DARTS`.

**Architecture:** Server-side only — no page/component work. Four independent changes: (1) declare the pair in `capabilities.ts` and mirror it into seed `0007` and its verification SQL, extending `bobs27.validator.ts` to accept and route both pairs; (2) fix a real bug in `Bobs27Engine.record()` that currently hardcodes `locationX: null, locationY: null` on every dart regardless of what was observed — without this, a board tap can never carry a coordinate, breaking both `classify()` re-derivation in the validator and marker rendering; (3) generalize `resolveSessionModePair`'s hardcoded `QUICK_SCORE` fallback to the ruleset's own first declared pair, since `BOBS27_V1` doesn't support `QUICK_SCORE` at all and the old fallback would silently hand a Bob's 27 setup page a pair its own engine can't play; (4) final verification.

**Tech Stack:** TypeScript, Vitest, PostgreSQL (seed SQL, verification SQL — not locally runnable in this container per D193; ships for the owner to run against real Neon before merge).

## Global Constraints

- TDD: red → green, every step in this plan follows write-failing-test → verify fail → implement → verify pass.
- `app/src/**/*.ts` function/method bodies carry no `//`/`/* */` comments — JSDoc above the declaration only.
- **Task 1 touches six files in one commit, deliberately.** `capabilities.ts`, `database/seeds/0007_ruleset_version_capabilities.sql`, and `bobs27.validator.ts` are each checked against `capabilities.ts` by an existing, generic (no-edit-needed) Vitest test — `capability-seed-parity.test.ts` and `capability-validator-parity.test.ts` — that iterates `RULESET_CAPABILITIES` and fails the instant one side declares a pair the other doesn't. Editing `capabilities.ts` alone turns both tests red until the seed and the validator catch up; there is no smaller unit that leaves `npm test` green at every commit.
- No new decision-ledger entry this phase — this phase is a mechanical extension of already-decided patterns (D196 capability declaration, D197 validateConfig-admits-every-pair, D198 shape dispatch), per the design spec's cross-phase notes. Do not touch `decisions/**`.
- No page/component/route work — this phase is entirely `app/src/lib`, `app/src/modules`, `app/src/services`, `database/seeds`, `database/verification`.
- Work on a dedicated branch off the latest `main` (`bobs27-phase-2-visual-board-capability`, already cut from `main` post-Phase-1-merge). Never commit directly to `main`.
- `database/verification/0007_capability_seed_checks.sql` cannot be executed in this container (no `DATABASE_URL`) — per D193, it ships for the owner to run against real Neon before merge. Keep it textually consistent with the seed file; do not attempt to run it.
- This container has no `DATABASE_URL`, so `npm run validate:app`'s DB-dependent steps (`db:status`, `db:migrate`, `db:introspect`, graph refresh) cannot complete. Per the `validate-app` skill's mid-task gate, run the DB-independent checks directly instead: `npm test`, `npm run check`, `npx fallow`, `npm run format:check`.
- Before considering this phase done: run the `run-all-gates` skill and the `context-maintenance` skill (root `CLAUDE.md`'s mandatory protocol) — not part of this plan's own tasks, run them after Task 4.

---

### Task 1: Declare `ANALYTICS + VISUAL_BOARD` for Bob's 27 (capability, seed, validator)

**Files:**
- Modify: `app/src/lib/game/rulesets/capabilities.ts:44`
- Modify: `app/tests/lib/game/rulesets/capabilities.test.ts`
- Modify: `database/seeds/0007_ruleset_version_capabilities.sql`
- Modify: `database/verification/0007_capability_seed_checks.sql`
- Modify: `app/src/services/rulesets/bobs27/bobs27.validator.ts`
- Modify: `app/tests/services/rulesets/bobs27/bobs27.validator.test.ts`

**Interfaces:**
- Consumes: `isVisualBoardCapture`, `validateVisualBoardTurns`, `VISUAL_BOARD_MODES` from `app/src/services/rulesets/visual-board.validator.ts` (already used by `five-oh-one.validator.ts` — same import path, `../visual-board.validator`, since `bobs27.validator.ts` lives one directory deeper than `rulesets/`).
- Produces: `RULESET_CAPABILITIES.BOBS27_V1` is `[DETAILED_DARTS, VISUAL_BOARD]` (order matters — Task 3 relies on `DETAILED_DARTS` being first). `bobs27Validator.validateConfig`/`validateBatch` accept both pairs.

- [ ] **Step 1: Write the failing test cases**

In `app/tests/lib/game/rulesets/capabilities.test.ts`, inside `describe("supportsMode", ...)`, insert two new tests directly after the existing `"accepts visual board for Score Training"` test (before `"rejects visual board for a game with no visual engine path"`):

```ts
  it("accepts visual board for Bob's 27", () => {
    expect(supportsMode("BOBS27_V1", "ANALYTICS", "VISUAL_BOARD")).toBe(true);
  });

  it("keeps Bob's 27's original DETAILED_DARTS pair supported", () => {
    expect(supportsMode("BOBS27_V1", "RECREATIONAL", "DETAILED_DARTS")).toBe(
      true,
    );
  });
```

In the same file, replace the `describe("capableRulesets", ...)` block's first test (the capability, not just the test name, has changed — this is the same guarantee re-asserted against the new correct set, not a re-point to a different subject):

```ts
describe("capableRulesets", () => {
  it("lists only the two visual-capable rulesets", () => {
    expect([...capableRulesets("ANALYTICS", "VISUAL_BOARD")].sort()).toEqual([
      "501_V1",
      "SCORE_TRAINING_V1",
    ]);
  });
```

replace with:

```ts
describe("capableRulesets", () => {
  it("lists every visual-capable ruleset", () => {
    expect([...capableRulesets("ANALYTICS", "VISUAL_BOARD")].sort()).toEqual([
      "501_V1",
      "BOBS27_V1",
      "SCORE_TRAINING_V1",
    ]);
  });
```

In `app/tests/services/rulesets/bobs27/bobs27.validator.test.ts`, add to `describe("bobs27Validator.validateConfig", ...)`, directly after the `"accepts RECREATIONAL + DETAILED_DARTS with a valid config"` test:

```ts
  it("accepts ANALYTICS + VISUAL_BOARD with a valid config", () => {
    const result = bobs27Validator.validateConfig({
      config: validConfig,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });
    expect(result.valid).toBe(true);
  });
```

Add to `describe("bobs27Validator.validateBatch", ...)`, at the end of the block:

```ts

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
              completedAt: "2026-08-05T12:00:00.000Z",
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

    const result = bobs27Validator.validateBatch({
      config: validConfig,
      batch: batch as never,
      existingTurnCount: 0,
      captureModeKey: "ANALYTICS",
      inputModeKey: "VISUAL_BOARD",
    });

    expect(result.valid).toBe(true);
  });
```

- [ ] **Step 2: Run the affected tests, verify they fail**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts tests/services/rulesets/bobs27/bobs27.validator.test.ts tests/lib/game/rulesets/capability-seed-parity.test.ts tests/lib/game/rulesets/capability-validator-parity.test.ts`

Expected: FAIL — the two new `capabilities.test.ts` assertions and the `capableRulesets` rewrite fail because `BOBS27_V1` doesn't declare `VISUAL_BOARD` yet; the two new `bobs27.validator.test.ts` assertions fail because `validateConfig`/`validateBatch` still refuse `ANALYTICS + VISUAL_BOARD`. `capability-seed-parity.test.ts` and `capability-validator-parity.test.ts` still pass at this point (nothing has changed yet in `capabilities.ts` itself).

- [ ] **Step 3: Declare the pair in `capabilities.ts`**

In `app/src/lib/game/rulesets/capabilities.ts`, change:

```ts
  BOBS27_V1: [DETAILED_DARTS],
```

to:

```ts
  BOBS27_V1: [DETAILED_DARTS, VISUAL_BOARD],
```

- [ ] **Step 4: Run the full suite, confirm the new capability breakage**

Run: `cd app && npm test`

Expected: FAIL — `capability-seed-parity.test.ts` (`"declares exactly the same triples on both sides"`) and `capability-validator-parity.test.ts` (`"BOBS27_V1 accepts every pair it declares"`) now fail, since the seed and the validator haven't caught up. This confirms the coupling the Global Constraints section describes — proceed to Steps 5–6 before re-running.

- [ ] **Step 5: Mirror the pair into seed `0007`**

In `database/seeds/0007_ruleset_version_capabilities.sql`, change the `VALUES` list from:

```sql
    ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS')
```

to:

```sql
    ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
            ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
            ('BOBS27_V1', 'ANALYTICS', 'VISUAL_BOARD'),
            ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS')
```

Leave the file's header comment (the "Correction over the original task-2 brief" note) untouched — it's still accurate; it describes `BOBS27_V1`'s `DETAILED_DARTS` row, not the new `VISUAL_BOARD` one.

- [ ] **Step 6: Update the verification SQL to match (no automated check — textual consistency only)**

In `database/verification/0007_capability_seed_checks.sql`, make three edits:

1. Step 1's row-count assertion — change:

```sql
INSERT INTO verification_results
SELECT '1',
    'seed inserted exactly the 8 declared rows',
    CASE
        WHEN count(*) = 8 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('expected 8, found %s', count(*))
FROM ruleset_version_capabilities;
```

to:

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

2. Step 2's `VALUES` list (the one feeding the `LEFT JOIN` resolution check) — add the new row in the same position as the seed file, and update the "all N declared triples were actually checked" assertion from 8 to 9:

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
    LEFT JOIN capture_modes cm ON cm.implementation_key = declared.capture_key
    LEFT JOIN input_modes im ON im.implementation_key = declared.input_key
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id;

-- Driven by a fixed 8-row VALUES list, so this can only be short if the
-- VALUES list above was edited down — guard it anyway per house style.
INSERT INTO verification_results
SELECT '2',
    'all 8 declared triples were actually checked',
    CASE
        WHEN count(*) = 8 THEN 'PASS'
        ELSE 'FAIL'
    END,
    format('%s of 8 triple checks ran', count(*))
FROM verification_results
WHERE step = '2';
```

becomes:

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
    LEFT JOIN capture_modes cm ON cm.implementation_key = declared.capture_key
    LEFT JOIN input_modes im ON im.implementation_key = declared.input_key
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id;

-- Driven by a fixed 9-row VALUES list, so this can only be short if the
-- VALUES list above was edited down — guard it anyway per house style.
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

3. Step 4's `VALUES` list (the bidirectional-parity check) — same addition, same position:

```sql
        FROM (
                VALUES ('501_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('501_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('SCORE_TRAINING_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SCORE_TRAINING_V1', 'ANALYTICS', 'VISUAL_BOARD'),
                    ('TUOD_V1', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('SINGLES_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('BOBS27_V1', 'RECREATIONAL', 'DETAILED_DARTS'),
                    ('DOUBLES_TRAINING_V1', 'RECREATIONAL', 'DETAILED_DARTS')
            ) AS declared(ruleset_key, capture_key, input_key)
```

becomes:

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

- [ ] **Step 7: Rewrite `bobs27.validator.ts` to accept and route both pairs**

Replace the entire contents of `app/src/services/rulesets/bobs27/bobs27.validator.ts` with:

```ts
import { Bobs27Config } from "@lib/types";
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

/** Same ceiling every other coordinate-capturing ruleset uses for a dartless keypad visit (3 darts, treble 20 max) — Bob's 27 has no `max_visit_score` config field to read one from. */
const DEFAULT_MAX_TURN_SCORE = 180;

/** Whether a session's mode pair is Bob's 27's own per-dart keypad capture. */
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
 * Whether a session's mode pair is one Bob's 27 actually implements:
 * RECREATIONAL + DETAILED_DARTS for a per-dart keypad capture, or
 * ANALYTICS + VISUAL_BOARD for a coordinate capture. Named once here rather
 * than duplicated inline, mirroring `isQuickScoreOrVisualBoardCapture`
 * (`quick-score.validator.ts`) for the DETAILED_DARTS-vs-VISUAL_BOARD case.
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
 * Bob's 27 supports two mode pairs. Under RECREATIONAL + DETAILED_DARTS its
 * engine emits one dart row per throw, so every turn in a batch must carry at
 * least one and no dart's board score may be negative. Under
 * ANALYTICS + VISUAL_BOARD every dart carries a landing coordinate, re-derived
 * and cross-checked by `validateVisualBoardTurns`.
 */
export const bobs27Validator: RulesetValidator = {
  validateConfig({
    config,
    captureModeKey,
    inputModeKey,
  }): ConfigValidationResult {
    if (!isDetailedDartsOrVisualBoardCapture(captureModeKey, inputModeKey)) {
      return {
        valid: false,
        issues: [
          `Bob's 27 V1 only supports ${DETAILED_DARTS_MODES} or ${VISUAL_BOARD_MODES}`,
        ],
      };
    }
    const parsed = Bobs27Config.safeParse(config);
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
      return validateVisualBoardTurns(batch, DEFAULT_MAX_TURN_SCORE);
    }

    for (const stage of batch.stages) {
      for (const turn of stage.turns) {
        if (turn.darts.length === 0) {
          return {
            valid: false,
            code: "VALIDATION_FAILED",
            issues: [
              `turn ${turn.clientKey} must carry dart rows (${DETAILED_DARTS_MODES})`,
            ],
          };
        }
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

    return { valid: true };
  },
};
```

Note: the three existing `validateBatch` tests in `bobs27.validator.test.ts` call it without `captureModeKey`/`inputModeKey` at all — this still compiles (call sites type-check against `RulesetValidator`'s optional fields, not this file's stricter literal signature, exactly as `five-oh-one.validator.ts` already does) and still behaves correctly at runtime (`isVisualBoardCapture(undefined, undefined)` is `false`, so those three tests fall through to the unchanged DETAILED_DARTS branch). Do not edit those three tests.

- [ ] **Step 8: Run the full suite, verify everything passes**

Run: `cd app && npm test`

Expected: PASS — all suites green, including `capabilities.test.ts`, `bobs27.validator.test.ts`, `capability-seed-parity.test.ts`, and `capability-validator-parity.test.ts`.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/game/rulesets/capabilities.ts \
  app/tests/lib/game/rulesets/capabilities.test.ts \
  database/seeds/0007_ruleset_version_capabilities.sql \
  database/verification/0007_capability_seed_checks.sql \
  app/src/services/rulesets/bobs27/bobs27.validator.ts \
  app/tests/services/rulesets/bobs27/bobs27.validator.test.ts
git commit -m "feat(bobs27): declare and validate ANALYTICS + VISUAL_BOARD capability"
```

---

### Task 2: `Bobs27Engine.record()` carries the observed dart location

**Files:**
- Modify: `app/src/modules/game/bobs27.engine.module.ts:189-190`
- Modify: `app/tests/modules/game/bobs27.engine.module.test.ts`

**Interfaces:**
- Consumes: `DartObservation.locationX`/`locationY` (`app/src/modules/types.ts:150-151`), already passed into `record(observation)` but currently discarded.
- Produces: `DartFact.locationX`/`locationY` now equal the observation's, not always `null`. No signature change to `record()`. Required by Phase 4's board input for `classify()` re-derivation (Task 1's `validateVisualBoardTurns`) and marker rendering to have anything to work with.

- [ ] **Step 1: Write the failing tests**

In `app/tests/modules/game/bobs27.engine.module.test.ts`, insert two new tests directly after the `"records the intended target on every dart"` test (inside `describe("Bobs27Engine — fact log and derived score (Task 6 acceptance)", ...)`, before `"rehydrates the derived score and target from persisted facts"`):

```ts

  it("carries the observed dart location onto the recorded fact", () => {
    const engine = bobs27EngineFactory.create(config);
    engine.record({
      hitTargetNumber: 1,
      hitZoneKey: "DOUBLE",
      locationX: 12.5,
      locationY: -3.25,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.locationX).toBe(12.5);
    expect(dart.locationY).toBe(-3.25);
  });

  it("carries a null location through for an unseen (bounce-out) dart", () => {
    const engine = bobs27EngineFactory.create(config);
    engine.record({
      hitTargetNumber: null,
      hitZoneKey: "MISS",
      locationX: null,
      locationY: null,
    });

    const dart = engine.facts().turns[0].darts[0];
    expect(dart.locationX).toBeNull();
    expect(dart.locationY).toBeNull();
  });
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `cd app && npx vitest run tests/modules/game/bobs27.engine.module.test.ts`

Expected: FAIL — `"carries the observed dart location onto the recorded fact"` fails: `dart.locationX` is `null`, not `12.5` (the current code hardcodes `null` regardless of the observation).

- [ ] **Step 3: Fix `record()` to pass the observation's location through**

In `app/src/modules/game/bobs27.engine.module.ts`, change:

```ts
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
      locationX: null,
      locationY: null,
    };
```

to:

```ts
      score: boardScore(observation.hitTargetNumber, observation.hitZoneKey),
      locationX: observation.locationX,
      locationY: observation.locationY,
    };
```

- [ ] **Step 4: Run the full suite, verify it passes**

Run: `cd app && npm test`

Expected: PASS — all suites green, including both new assertions and every existing `bobs27.engine.module.test.ts` test (they all pass `locationX: null, locationY: null` observations, so `null` still comes through unchanged for them).

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/bobs27.engine.module.ts \
  app/tests/modules/game/bobs27.engine.module.test.ts
git commit -m "fix(bobs27): record() carries the observed dart's location instead of always null"
```

---

### Task 3: Generalize `resolveSessionModePair`'s fallback

**Files:**
- Modify: `app/src/lib/game/session-mode-resolution.ts`
- Modify: `app/tests/lib/game/session-mode-resolution.test.ts`

**Interfaces:**
- Consumes: `RULESET_CAPABILITIES` from `app/src/lib/game/rulesets/capabilities.ts` (Task 1 already declares `BOBS27_V1: [DETAILED_DARTS, VISUAL_BOARD]` — `DETAILED_DARTS` first, so `RULESET_CAPABILITIES.BOBS27_V1[0]` is `{ captureModeKey: "RECREATIONAL", inputModeKey: "DETAILED_DARTS" }`).
- Produces: `resolveSessionModePair`'s fallback is now the ruleset's own first declared pair instead of a hardcoded `QUICK_SCORE` constant. No signature change — same `(rulesetVersionKey, settings) => ModePair`.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/lib/game/session-mode-resolution.test.ts`, inside `describe("resolveSessionModePair", ...)`, after the last existing test:

```ts

  it("falls back to the ruleset's own first declared pair for a ruleset without QUICK_SCORE", () => {
    expect(resolveSessionModePair("BOBS27_V1", undefined)).toEqual({
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
  });

  it("falls back to the ruleset's own first declared pair when the chosen pair is undeclared", () => {
    expect(
      resolveSessionModePair("BOBS27_V1", {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
      }),
    ).toEqual({
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
    });
  });

  it("passes through Bob's 27's visual-board pair when chosen", () => {
    expect(
      resolveSessionModePair("BOBS27_V1", {
        captureModeKey: "ANALYTICS",
        inputModeKey: "VISUAL_BOARD",
      }),
    ).toEqual({ captureModeKey: "ANALYTICS", inputModeKey: "VISUAL_BOARD" });
  });
```

- [ ] **Step 2: Run the test, verify the new cases fail**

Run: `cd app && npx vitest run tests/lib/game/session-mode-resolution.test.ts`

Expected: FAIL — the first two new tests fail because the current hardcoded fallback returns `{ captureModeKey: "RECREATIONAL", inputModeKey: "QUICK_SCORE" }`, which `BOBS27_V1` doesn't support at all. The third new test already passes (Task 1 already declared the pair and `supportsMode` already accepts it) — that's expected; it's here to lock in the pass-through behavior alongside the fallback fix.

- [ ] **Step 3: Generalize the fallback**

Replace the entire contents of `app/src/lib/game/session-mode-resolution.ts` with:

```ts
import {
  RULESET_CAPABILITIES,
  supportsMode,
} from "@lib/game/rulesets/capabilities";
import type { ModePair, RulesetVersionKey } from "@lib/types";

/**
 * The capture/input mode pair a setup page's `createSession` call should
 * send, given the player's chosen mode from the `settings` store.
 *
 * The fallback is the ruleset's own first pair declared in
 * `RULESET_CAPABILITIES`, not a hardcoded constant — a ruleset that never
 * declares `RECREATIONAL + QUICK_SCORE` (e.g. `BOBS27_V1`, which declares
 * `RECREATIONAL + DETAILED_DARTS` and `ANALYTICS + VISUAL_BOARD`) still
 * starts a session under a pair it actually supports when `settings` hasn't
 * finished loading, has no saved row for the player, or is absent in a test
 * double.
 *
 * `createSession` (`services/session.service.ts`) rejects an undeclared pair
 * via `supportsMode` before any write, and would reject `undefined` outright,
 * so this never forwards either.
 */
export function resolveSessionModePair(
  rulesetVersionKey: RulesetVersionKey,
  settings: Partial<ModePair> | null | undefined,
): ModePair {
  const fallback = RULESET_CAPABILITIES[rulesetVersionKey][0];
  const captureModeKey = settings?.captureModeKey ?? fallback.captureModeKey;
  const inputModeKey = settings?.inputModeKey ?? fallback.inputModeKey;

  if (supportsMode(rulesetVersionKey, captureModeKey, inputModeKey)) {
    return { captureModeKey, inputModeKey };
  }

  return fallback;
}

/**
 * The store payload that starts a session, assembled once for both setup
 * pages. They differ only in game type, ruleset and config snapshot; every
 * other field is read off the same two objects, so a new session field (the
 * mode pair was the most recent) is added here rather than in two places that
 * must be kept in step by hand.
 */
export function startSessionInput(input: {
  gameTypeKey: string;
  rulesetVersionKey: RulesetVersionKey;
  session: { sessionId: string; participants: { ref: string }[] };
  templateRef: string;
  configSnapshot: unknown;
  modePair: ModePair;
}) {
  return {
    gameTypeKey: input.gameTypeKey,
    rulesetVersionKey: input.rulesetVersionKey,
    sessionId: input.session.sessionId,
    participantRef: input.session.participants[0].ref,
    templateRef: input.templateRef,
    configSnapshot: input.configSnapshot,
    captureModeKey: input.modePair.captureModeKey,
    inputModeKey: input.modePair.inputModeKey,
  };
}
```

(The local hardcoded `QUICK_SCORE` constant is removed entirely — it's no longer referenced. `startSessionInput` is unchanged, reproduced above only because it shares the file.)

- [ ] **Step 4: Run the full suite, verify it passes**

Run: `cd app && npm test`

Expected: PASS — all suites green, including all 8 `resolveSessionModePair` tests. The four pre-existing tests for `501_V1`/`SCORE_TRAINING_V1` still pass unchanged: both rulesets declare `QUICK_SCORE` as their first pair in `RULESET_CAPABILITIES`, so the generalized fallback resolves to the exact same value the old hardcoded constant did.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/session-mode-resolution.ts \
  app/tests/lib/game/session-mode-resolution.test.ts
git commit -m "fix(session-mode-resolution): fall back to a ruleset's own first declared pair, not a hardcoded QUICK_SCORE"
```

---

### Task 4: Final Verification & Branch State

**Files:** none (verification only).

- [ ] **Step 1: Run the DB-independent validation checks directly**

```bash
cd app
npm run format
npm run format:check
npm test
npx fallow
npm run check
```

Expected: `format` produces no diffs (or commit them if it does); `format:check`, `npm test`, `fallow`, and `check` all report clean/passing. Do not run the full `npm run validate:app` chain — it halts at the first DB-dependent step (`db:status`) in this container, per the Global Constraints note above.

- [ ] **Step 2: Confirm branch state**

```bash
git log --oneline main..HEAD
git status --short
```

Expected: 3 commits (Tasks 1–3, in order); working tree clean.

- [ ] **Step 3: Record concerns, if any**

If `npm run validate:app`'s DB-dependent steps or `database/verification/0007_capability_seed_checks.sql` cannot be run in this container, note that explicitly as an expected environment limitation (per D193 and the `validate-app` skill's mid-task gate) — not a defect blocking completion.

---

## Acceptance (from the design spec)

- `capabilities.test.ts`, `capability-seed-parity.test.ts`, and `capability-validator-parity.test.ts` all green.
- `bobs27.validator.test.ts` covers both mode pairs' accept/reject paths.
- `check-game-engines.sh` and `check-refinement-coverage.sh` stay green (no schema change — both are structural gates unaffected by these changes).
- `0007_capability_seed_checks.sql` green against a real branch when the owner runs it (not locally verifiable in this container).
- No page/component/route files touched.
