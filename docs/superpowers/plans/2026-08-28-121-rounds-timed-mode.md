# 121 V2 — Rounds / Time Stop Conditions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 121 V2 — a new `121_V2` ruleset version that adds `ROUNDS` (stop after N attempts) and `MINUTES` (stop after N minutes) end conditions alongside 121's existing `TARGET` (climb-to-170) mode, so a player can end a 121 session as a normal `COMPLETED` game instead of always having to reach 170 or abandon.

**Architecture:** One `OneTwentyOneEngine` class (Pattern 18) serves both `121_V1` and `121_V2` via two separate `GameEngineFactory` registrations. `121_V1`'s config carries no duration fields at all (unchanged, `{}`); `121_V2`'s config carries `duration_type`/`duration_value`. The engine normalizes both into one internal shape via a small `durationOf()` helper, so `121_V1` behaves byte-for-byte as it does today. A new `attemptsCompleted` seat field (purely derived, folded from the fact log) drives `ROUNDS`/`MINUTES` completion, mirroring how Score Training's `durationSeatComplete` already drives its own `ROUNDS`/`MINUTES` modes off visit counts. The existing checkout-to-170 mechanic is untouched and composes with the new modes: reaching the cap target always wins the session immediately, in every `duration_type` — `ROUNDS`/`MINUTES` only add an *earlier* stop condition for the common case of not reaching the cap. `wouldComplete()`'s pre-record finish-confirm dialog only fires for a *checkout* that closes the budget (climb or cap); a 3rd-visit fail-reset that happens to be a session's final closing action completes silently through the existing post-record `isComplete()` safety net in `recordVisit`/`playCommitDart` — mirrors the asymmetry already present in `121_V1` today (busts never show a confirm dialog).

**Tech Stack:** Astro, TypeScript, Alpine.js, Zod, Vitest, PostgreSQL (Neon) seeds.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-28-121-rounds-timed-mode-design.md` — read it before starting; every task below implements a piece of it.
- Ruleset version key: `121_V2`. Same game type as `121_V1`: `ONE_TWENTY_ONE` (no new `game_types` row).
- `121_V1` stays exactly as shipped — its config schema (`{}`), its engine behaviour, its factory registration are never edited, only extended alongside.
- **Design clarification decided during planning (not in the original spec, but required to make it correct):** checking out the cap target (170) always wins the session immediately, in every `duration_type` — this requires zero engine changes since `applyOneTwentyOneVisit`'s existing checkout-at-cap branch is untouched; `ROUNDS`/`MINUTES` completion is evaluated as an *additional* OR condition on top of the existing `status === "WON"` check, never a replacement for it.
- **Design clarification, same reasoning:** the pre-record finish-confirm dialog (`wouldComplete()`) predicts completion only for a *checkout* visit/dart (climb or cap) that would close the `ROUNDS`/`MINUTES` budget. A 3rd-visit fail-reset that closes the budget completes without a pre-confirm, via the existing post-record `isComplete()` check already present in `recordVisit`/`commitDart` — this mirrors `121_V1`'s existing asymmetry (a bust never triggers a confirm dialog today) and avoids re-implementing `settleVisit`'s bust/close boundary logic a second time in a non-mutating context.
- `ROUNDS` bounds: 1–50. `MINUTES` bounds: 3–30. `TARGET` carries no `duration_value` at all (the key must be absent from the config, not merely `undefined`).
- `121`'s dart budget (9 darts / 3 visits per attempt), double-out rule, and fail rule (stay at the same target) are unchanged in every `duration_type`.
- `ROUNDS`/`MINUTES` are solo-only (enforced by the setup UI locking back to `TARGET` when a guest is added — same reasoning and same mechanism as `scoreTrainingSetup()`'s `forceRoundsIfGuested`/TUOD's own guest lock).
- Never put `//`/`/* */` comments inside function/method bodies in `app/src/**/*.ts` (JSDoc above the declaration only). Tests are exempt.
- Every `*.engine.module.ts`'s `rulesetVersionKey`(s) and their server-side validator registrations must land in the same commit — `scripts/check-game-engines.sh` runs pre-commit and rejects one without the other.
- `scripts/check-game-wiring.sh` currently assumes one `GAME_CARDS` entry maps to exactly one `RulesetVersionKey`; 121 V2 shares its existing card/route/data files with 121 V1. Task 1 patches the gate to support this (a ruleset version absent from `GAME_CARDS` is treated as wired, not stray, when it shares a code slug with another registered version that *does* have a card) — this is a prerequisite for every later task's gate to pass.
- Run `cd app && npm test` (or the specific test file) after every implementation step; do not move on with red tests.
- Run `bash scripts/check-game-engines.sh` and `bash scripts/check-game-wiring.sh` from the repo root before any commit that touches `registry.ts`, `capabilities.ts`, or the engine module.
- Format before any commit that touches `app/`: `cd app && npm run format`.
- Do not modify `database/migrations/**` — this feature is seed-only, no schema change.
- Never modify `database/seeds/0001`–`0006`, `0008`–`0010` — only append to `0007`'s existing `VALUES` list and create new file `0011`. Never modify `database/verification/0008`–`0010`; append to `0007_capability_seed_checks.sql`'s existing VALUES lists and counts, and create new file `0011`.
- Never edit `app/src/lib/game/rulesets/games-visibility.ts`'s `GAME_CARDS` — 121 V2 deliberately reuses the single existing `"121_V1"`-keyed card (one card, two playable ruleset versions behind it); adding a second card would render two "121" tiles on the games page, which nothing in the spec asks for.

---

## Task 1: Patch `check-game-wiring.sh` for a shared-card ruleset version

**Files:**
- Modify: `scripts/check-game-wiring.sh`

**Interfaces:**
- Produces: the gate now treats a registry key absent from `GAME_CARDS` as correctly wired (not stray) when its own code slug matches the code slug of another registry key that *does* have a card. No change to the gate's behaviour for every other existing key (each currently owns a distinct code slug, so `carded_code_slugs` never contains any of theirs by coincidence — verified in Step 4 below).

This has no Vitest test (it's a standalone bash script with no fixture harness in this repo); verification is running it directly against the real tree, both before 121 V2 exists (to confirm the fix doesn't change today's green result) and after Task 4 registers `121_V2` (to confirm it stays green instead of failing on the shared slug).

- [ ] **Step 1: Confirm today's baseline is green**

Run: `bash scripts/check-game-wiring.sh`
Expected: `OK: game wiring — 9 ruleset(s) checked against six shared registries` (exit 0).

- [ ] **Step 2: Patch the script**

In `scripts/check-game-wiring.sh`, the Python block currently does one pass over `entries` (around line 134's `for key, binding in entries:`). Add a pre-pass immediately before that loop (after the `registered = ...` / `data_imports = ...` block, i.e. right before the `code_slugs = set()` / `checked = 0` lines around line 131) that computes each key's code slug up front, and the set of code slugs already carded:

```python
code_slug_of = {}
for key, binding in entries:
    module = imports.get(binding)
    if module:
        code_slug_of[key] = module.split("/")[0]

carded_code_slugs = {
    code_slug_of[k] for k in cards if k in code_slug_of
}
```

Then, inside the main loop, replace the branch that currently reads:

```python
    if key not in cards:
        for stray in (setup_data, play_data):
            if stray.is_file():
                err(
                    f"{key} is engine-only (absent from {VISIBILITY}) but `{stray}` exists — "
                    "a game is either wired end to end or not wired at all"
                )
        stray_pages = app / f"src/pages/games/{code_slug}"
        if stray_pages.is_dir():
            err(
                f"{key} is engine-only (absent from {VISIBILITY}) but `{stray_pages}` exists"
            )
        checked += 1
        continue
```

with:

```python
    if key not in cards:
        if code_slug in carded_code_slugs:
            # This ruleset version has no card of its own, but shares its code
            # slug (data files, pages, Alpine registration) with a sibling key
            # that does — e.g. 121_V2 shares 121_V1's card/route. The sibling
            # key's own pass through this loop already verified pages/Alpine
            # wiring for this code slug; there is nothing stray to check here,
            # and requiring an absent data file would be wrong.
            ok(f"{key} shares code slug `{code_slug}` with a carded ruleset version")
            checked += 1
            continue
        for stray in (setup_data, play_data):
            if stray.is_file():
                err(
                    f"{key} is engine-only (absent from {VISIBILITY}) but `{stray}` exists — "
                    "a game is either wired end to end or not wired at all"
                )
        stray_pages = app / f"src/pages/games/{code_slug}"
        if stray_pages.is_dir():
            err(
                f"{key} is engine-only (absent from {VISIBILITY}) but `{stray_pages}` exists"
            )
        checked += 1
        continue
```

Update the file's header comment (around line 16-18) to add a third bullet documenting the new case:

```
#   3c. Shared-card games (absent from GAME_CARDS, but the same code slug as
#       a key that IS carded): treated as wired via the sibling key — nothing
#       further to check, since the sibling's own pass already verified it.
```

- [ ] **Step 3: Re-run against today's tree — must still be green**

Run: `bash scripts/check-game-wiring.sh`
Expected: identical output to Step 1 — `OK: game wiring — 9 ruleset(s) checked against six shared registries`. No existing key's own code slug coincides with any other carded key's slug today, so `carded_code_slugs` changes nothing yet.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-game-wiring.sh
git commit -m "Allow a ruleset version to share a game-wiring card with a sibling key"
```

(The positive proof that this actually fixes the 121_V2 case runs at the end of Task 4, once `121_V2` exists in `registry.ts`.)

---

## Task 2: `121_V2` config schema

**Files:**
- Modify: `app/src/lib/game/rulesets/types.ts`
- Test: `app/tests/lib/game/rulesets/types.test.ts` (check first with `ls app/tests/lib/game/rulesets/ | grep types` — create if absent)

**Interfaces:**
- Produces: `OneTwentyOneV2Config` (Zod schema, exported), `OneTwentyOneV2ConfigData` (`z.infer`), `OneTwentyOneV2Snapshot` (`{ durationType: "TARGET" | "ROUNDS" | "MINUTES"; durationValue: number | undefined }`), `RulesetVersionKey` gains `"121_V2"`, `RULESET_CONFIGS` and `ConfigSnapshotFor` gain matching entries. Later tasks import `OneTwentyOneV2Snapshot` via `@lib/types`.

- [ ] **Step 1: Write the failing test**

Create (or extend) `app/tests/lib/game/rulesets/types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  OneTwentyOneV2Config,
  RULESET_CONFIGS,
} from "@lib/game/rulesets/types";

describe("OneTwentyOneV2Config", () => {
  it("accepts TARGET with no duration_value", () => {
    const result = OneTwentyOneV2Config.safeParse({ duration_type: "TARGET" });
    expect(result.success).toBe(true);
  });

  it("rejects TARGET carrying a duration_value", () => {
    const result = OneTwentyOneV2Config.safeParse({
      duration_type: "TARGET",
      duration_value: 10,
    });
    expect(result.success).toBe(false);
  });

  it("accepts ROUNDS at the bounds (1 and 50)", () => {
    expect(
      OneTwentyOneV2Config.safeParse({ duration_type: "ROUNDS", duration_value: 1 })
        .success,
    ).toBe(true);
    expect(
      OneTwentyOneV2Config.safeParse({ duration_type: "ROUNDS", duration_value: 50 })
        .success,
    ).toBe(true);
  });

  it("rejects ROUNDS outside 1..50", () => {
    expect(
      OneTwentyOneV2Config.safeParse({ duration_type: "ROUNDS", duration_value: 0 })
        .success,
    ).toBe(false);
    expect(
      OneTwentyOneV2Config.safeParse({ duration_type: "ROUNDS", duration_value: 51 })
        .success,
    ).toBe(false);
  });

  it("accepts MINUTES at the bounds (3 and 30)", () => {
    expect(
      OneTwentyOneV2Config.safeParse({ duration_type: "MINUTES", duration_value: 3 })
        .success,
    ).toBe(true);
    expect(
      OneTwentyOneV2Config.safeParse({ duration_type: "MINUTES", duration_value: 30 })
        .success,
    ).toBe(true);
  });

  it("rejects MINUTES outside 3..30", () => {
    expect(
      OneTwentyOneV2Config.safeParse({ duration_type: "MINUTES", duration_value: 2 })
        .success,
    ).toBe(false);
    expect(
      OneTwentyOneV2Config.safeParse({ duration_type: "MINUTES", duration_value: 31 })
        .success,
    ).toBe(false);
  });

  it("rejects ROUNDS/MINUTES with duration_value omitted", () => {
    expect(
      OneTwentyOneV2Config.safeParse({ duration_type: "ROUNDS" }).success,
    ).toBe(false);
  });

  it("rejects an unknown key (the schema is .strict())", () => {
    expect(
      OneTwentyOneV2Config.safeParse({
        duration_type: "TARGET",
        extra: 1,
      }).success,
    ).toBe(false);
  });
});

describe("RULESET_CONFIGS", () => {
  it("registers 121_V2", () => {
    expect(RULESET_CONFIGS["121_V2"]).toBe(OneTwentyOneV2Config);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/rulesets/types.test.ts`
Expected: FAIL — `OneTwentyOneV2Config` is not exported.

- [ ] **Step 3: Add the config schema, snapshot type, and registry entries**

In `app/src/lib/game/rulesets/types.ts`, immediately after `OneTwentyOneConfig` (currently lines 165-171) and before the `AroundTheClockConfig` comment block:

```typescript
/**
 * 121 V2 adds three end conditions instead of 121 V1's one: `TARGET` (climb
 * to cap 170, identical to v1's only mode), `ROUNDS` (stop after N attempts),
 * `MINUTES` (stop after N minutes). `duration_value` is omitted entirely for
 * `TARGET` — the cap is fixed at 170, not player-chosen — which is why the
 * bound is a `superRefine` rather than `.min()`/`.max()` on the field alone:
 * it needs to read `duration_type` to know whether the field is even allowed.
 * A new, independent ruleset version rather than an edit to `OneTwentyOneConfig`:
 * v1's schema is already live against real session data, and changing it would
 * reinterpret every existing v1 config snapshot's meaning after the fact.
 */
export const OneTwentyOneV2Config = z
  .object({
    duration_type: z.enum(["TARGET", "ROUNDS", "MINUTES"]),
    duration_value: z.number().int().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.duration_type === "TARGET") {
      if (val.duration_value !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["duration_value"],
          message: "duration_value must be omitted for TARGET",
        });
      }
      return;
    }
    const [min, max] = val.duration_type === "ROUNDS" ? [1, 50] : [3, 30];
    if (
      val.duration_value === undefined ||
      val.duration_value < min ||
      val.duration_value > max
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration_value"],
        message: `duration_value must be between ${min} and ${max} for ${val.duration_type}`,
      });
    }
  });
```

Then update the `RulesetVersionKey` union (currently lines 182-191):

```typescript
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

And `RULESET_CONFIGS` (currently lines 193-203), adding one line after `"121_V1": OneTwentyOneConfig,`:

```typescript
  "121_V2": OneTwentyOneV2Config,
```

Then, immediately after `export type OneTwentyOneSnapshot = Record<string, never>;` (currently line 262), add:

```typescript
export type OneTwentyOneV2ConfigData = z.infer<typeof OneTwentyOneV2Config>;

/**
 * `durationValue` stays `number | undefined` (not optional-key) because the
 * Zod schema's own field is `.optional()` — mirrors how `ScoreTrainingSnapshot`
 * carries every one of `ScoreTrainingConfigData`'s fields verbatim.
 */
export type OneTwentyOneV2Snapshot = {
  durationType: OneTwentyOneV2ConfigData["duration_type"];
  durationValue: OneTwentyOneV2ConfigData["duration_value"];
};
```

Finally, update the `ConfigSnapshotFor<K>` conditional (currently lines 267-284) to add a branch between `"121_V1"` and the final `AroundTheClockSnapshot` fallback:

```typescript
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/rulesets/types.test.ts`
Expected: PASS, all cases green.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/rulesets/types.ts app/tests/lib/game/rulesets/types.test.ts
git commit -m "Add 121_V2 config schema (TARGET/ROUNDS/MINUTES duration_type)"
```

---

## Task 3: Capability declaration

**Files:**
- Modify: `app/src/lib/game/rulesets/capabilities.ts`
- Modify: `app/tests/lib/game/rulesets/capabilities.test.ts`

**Interfaces:**
- Consumes: `RulesetVersionKey` (Task 2, now includes `"121_V2"`).
- Produces: `RULESET_CAPABILITIES["121_V2"]` — same mode pairs as `121_V1` (`RECREATIONAL`+`QUICK_SCORE`, `ANALYTICS`+`VISUAL_BOARD`), since 121 V2 changes only the completion condition, not capture/input mode support.

- [ ] **Step 1: Write the failing test**

In `app/tests/lib/game/rulesets/capabilities.test.ts`, update the two hardcoded sorted-key-list assertions (lines 11-21 and 108-119) to include `"121_V2"`:

```typescript
describe("RULESET_CAPABILITIES", () => {
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
      "SINGLES_V1",
      "TUOD_V1",
    ]);
  });
```

and

```typescript
describe("capableRulesets", () => {
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
      "SINGLES_V1",
      "TUOD_V1",
    ]);
  });
```

Also add one new focused test in the `supportsMode` describe block:

```typescript
  it("gives 121_V2 the same pairs as 121_V1", () => {
    expect(supportsMode("121_V2", "RECREATIONAL", "QUICK_SCORE")).toBe(true);
    expect(supportsMode("121_V2", "ANALYTICS", "VISUAL_BOARD")).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts`
Expected: FAIL — `RULESET_CAPABILITIES` has no `"121_V2"` key yet.

- [ ] **Step 3: Add the capability declaration**

In `app/src/lib/game/rulesets/capabilities.ts`, add one line to `RULESET_CAPABILITIES` (currently lines 39-49) immediately after `"121_V1": [QUICK_SCORE, VISUAL_BOARD],`:

```typescript
  "121_V2": [QUICK_SCORE, VISUAL_BOARD],
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/rulesets/capabilities.ts app/tests/lib/game/rulesets/capabilities.test.ts
git commit -m "Declare 121_V2's capture/input mode capability"
```

---

## Task 4: Validator, registered under both `121_V1` and `121_V2`

**Files:**
- Modify: `app/src/services/rulesets/one-twenty-one/one-twenty-one.validator.ts`
- Modify: `app/src/services/rulesets/registry.ts`
- Modify: `app/tests/services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts`
- Modify: `app/tests/services/rulesets/registry.test.ts`

**Interfaces:**
- Consumes: `OneTwentyOneConfig`, `OneTwentyOneV2Config` (Task 2).
- Produces: `createOneTwentyOneValidator(configSchema)` (exported factory), `oneTwentyOneValidator` (bound to `OneTwentyOneConfig`, unchanged behaviour), `oneTwentyOneV2Validator` (bound to `OneTwentyOneV2Config`). `registry.ts` maps `"121_V1"` and `"121_V2"` to these two.
- Note: `validateBatch` never reads `config` against a schema at all (only `validateConfig` does) — so both validators share the exact same `validateBatch` implementation unmodified; only `validateConfig`'s schema differs.

- [ ] **Step 1: Write the failing test**

In `app/tests/services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts`, add a new describe block at the end of the file:

```typescript
import { oneTwentyOneV2Validator } from "@services/rulesets/one-twenty-one/one-twenty-one.validator";

describe("oneTwentyOneV2Validator.validateConfig", () => {
  it("accepts TARGET with no duration_value", () => {
    const result = oneTwentyOneV2Validator.validateConfig({
      config: { duration_type: "TARGET" },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts ROUNDS with a duration_value in range", () => {
    const result = oneTwentyOneV2Validator.validateConfig({
      config: { duration_type: "ROUNDS", duration_value: 10 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects ROUNDS with duration_value out of range", () => {
    const result = oneTwentyOneV2Validator.validateConfig({
      config: { duration_type: "ROUNDS", duration_value: 51 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a capture/input mode combination the ruleset does not support", () => {
    const result = oneTwentyOneV2Validator.validateConfig({
      config: { duration_type: "TARGET" },
      captureModeKey: "ANALYTICS",
      inputModeKey: "DETAILED_DARTS",
    });
    expect(result.valid).toBe(false);
  });
});

describe("oneTwentyOneV2Validator.validateBatch", () => {
  it("accepts the same batch shapes as oneTwentyOneValidator (shared implementation)", () => {
    const result = oneTwentyOneV2Validator.validateBatch({
      config: { duration_type: "ROUNDS", duration_value: 10 },
      batch: batchWithTurns([0, 0, 121]),
      existingTurnCounts: {},
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });
});
```

In `app/tests/services/rulesets/registry.test.ts`, add:

```typescript
  it("returns the 121 V2 validator for 121_V2", () => {
    expect(getRulesetValidator("121_V2")).toBeDefined();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts tests/services/rulesets/registry.test.ts`
Expected: FAIL — `oneTwentyOneV2Validator` is not exported, `getRulesetValidator("121_V2")` returns `undefined`.

- [ ] **Step 3: Factor the validator into a builder, and add the V2 instance**

Rewrite `app/src/services/rulesets/one-twenty-one/one-twenty-one.validator.ts` in full:

```typescript
import { OneTwentyOneConfig, OneTwentyOneV2Config } from "@lib/types";
import type { z } from "zod";
import type { ExistingTurnCounts } from "@repositories/interfaces";
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
 * 121 supports two mode pairs, unchanged between ruleset versions. Under
 * RECREATIONAL + QUICK_SCORE every turn is a visit total with no dart rows,
 * capped at 180. Under ANALYTICS + VISUAL_BOARD every dart carries a landing
 * coordinate, re-derived and cross-checked by `validateVisualBoardTurns` —
 * mirrors `five-oh-one.validator.ts`. `validateBatch` never reads `config`
 * against a schema — only `validateConfig` does — so `121_V1` and `121_V2`
 * share this one implementation, parameterised only by which config schema
 * `validateConfig` parses against.
 */
export function createOneTwentyOneValidator(
  configSchema: z.ZodTypeAny,
): RulesetValidator {
  return {
    validateConfig({
      config,
      captureModeKey,
      inputModeKey,
    }): ConfigValidationResult {
      if (!isQuickScoreOrVisualBoardCapture(captureModeKey, inputModeKey)) {
        return {
          valid: false,
          issues: [`121 only supports ${QUICK_SCORE_OR_VISUAL_BOARD_MODES}`],
        };
      }
      const parsed = configSchema.safeParse(config);
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
      existingTurnCounts: ExistingTurnCounts;
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
}

export const oneTwentyOneValidator: RulesetValidator =
  createOneTwentyOneValidator(OneTwentyOneConfig);

export const oneTwentyOneV2Validator: RulesetValidator =
  createOneTwentyOneValidator(OneTwentyOneV2Config);
```

In `app/src/services/rulesets/registry.ts`, add the import and the registry entry:

```typescript
import {
  oneTwentyOneValidator,
  oneTwentyOneV2Validator,
} from "./one-twenty-one/one-twenty-one.validator";
```

(replacing the existing single-name import on line 6), and add one line to the `REGISTRY` object (currently lines 12-22) after `"121_V1": oneTwentyOneValidator,`:

```typescript
  "121_V2": oneTwentyOneV2Validator,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/services/rulesets/one-twenty-one/ tests/services/rulesets/registry.test.ts`
Expected: PASS, including the original (unmodified-behaviour) `oneTwentyOneValidator` tests.

- [ ] **Step 5: Confirm the shared-card wiring gate now proves what Task 1 set out to prove**

Run: `bash scripts/check-game-engines.sh && bash scripts/check-game-wiring.sh`
Expected: both `OK`. `check-game-wiring.sh` should print `OK: 121_V2 shares code slug \`one-twenty-one\` with a carded ruleset version` (or equivalent) among its output, and the final summary line should read `10 ruleset(s) checked`.

- [ ] **Step 6: Commit**

```bash
git add app/src/services/rulesets/one-twenty-one/one-twenty-one.validator.ts \
  app/src/services/rulesets/registry.ts \
  app/tests/services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts \
  app/tests/services/rulesets/registry.test.ts
git commit -m "Register 121_V2's validator alongside 121_V1's"
```

---

## Task 5: Engine — `attemptsCompleted`, duration-aware completion, both ruleset keys

**Files:**
- Modify: `app/src/modules/game/types.ts`
- Modify: `app/src/modules/game/one-twenty-one.engine.module.ts`
- Modify: `app/tests/modules/game/one-twenty-one.engine.module.test.ts`

**Interfaces:**
- Consumes: `OneTwentyOneV2Snapshot` (Task 2).
- Produces: `OneTwentyOneSeatState.attemptsCompleted: number`, `OneTwentyOneState.timerExpired: boolean`, `foldOneTwentyOneState(facts, config, timerExpired)` (3rd param), `OneTwentyOneEngine.expireTimer()`, `oneTwentyOneV2EngineFactory` (registered under `"121_V2"`), `OneTwentyOneEngine.rulesetVersionKey` now an instance field reporting whichever key the engine was constructed under (both factories still exist and both still call `registerEngineFactory`, so `check-game-engines.sh` sees two conforming entries in one file).

### Part A — types

- [ ] **Step 1: Add the new fields to `app/src/modules/game/types.ts`**

Change (currently lines 218-223 and 225-228):

```typescript
export type OneTwentyOneSeatState = SeatState & {
  currentTarget: number;
  remainingInAttempt: number;
  visitsThisAttempt: number;
  status: "IN_PROGRESS" | "WON";
  attemptsCompleted: number;
};

export type OneTwentyOneState = MultiSeatState<OneTwentyOneSeatState> & {
  status: "IN_PROGRESS" | "WON";
  winningSideKey: string | null;
  timerExpired: boolean;
};
```

(Doc comments above these two types already exist — extend the `OneTwentyOneSeatState` one with one added sentence: "`attemptsCompleted` counts attempts that have fully resolved — checkout climb, checkout at the cap, or a 3rd-visit fail-reset — never a mid-attempt (visit 1 or 2) reduction or bust. Drives `ROUNDS`/`MINUTES` completion in `121_V2`; always 0-and-climbing under `121_V1` too, simply unread there.")

### Part B — engine

- [ ] **Step 2: Write the failing tests**

Add to `app/tests/modules/game/one-twenty-one.engine.module.test.ts`. First, extend the import line to add `oneTwentyOneV2EngineFactory` and `OneTwentyOneV2Snapshot`:

```typescript
import {
  applyOneTwentyOneVisit,
  OneTwentyOneEngine,
  oneTwentyOneEngineFactory,
  oneTwentyOneV2EngineFactory,
  initialOneTwentyOneState,
} from "@modules/game/one-twenty-one.engine.module";
```

```typescript
import type { OneTwentyOneSnapshot, OneTwentyOneV2Snapshot, Seated } from "@lib/types";
```

Then add these new describe blocks at the end of the file:

```typescript
describe("attemptsCompleted folding", () => {
  it("stays 0 through a mid-attempt reduction", () => {
    const next = applyOneTwentyOneVisit(
      initialOneTwentyOneState(config()).seats[0],
      { scoreAttempted: 45 },
    );
    expect(next.attemptsCompleted).toBe(0);
  });

  it("increments on a sub-cap checkout", () => {
    const state: OneTwentyOneSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 121,
      remainingInAttempt: 40,
      visitsThisAttempt: 1,
      status: "IN_PROGRESS",
      attemptsCompleted: 3,
    };
    const next = applyOneTwentyOneVisit(state, {
      scoreAttempted: 40,
      finishedOnDouble: true,
    });
    expect(next.attemptsCompleted).toBe(4);
  });

  it("increments on a cap checkout (WON)", () => {
    const state: OneTwentyOneSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 170,
      remainingInAttempt: 40,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
      attemptsCompleted: 49,
    };
    const next = applyOneTwentyOneVisit(state, {
      scoreAttempted: 40,
      finishedOnDouble: true,
    });
    expect(next.attemptsCompleted).toBe(50);
  });

  it("increments on a 3rd-visit fail-reset", () => {
    const state: OneTwentyOneSeatState = {
      participantRef: "participant-1",
      sideKey: "A",
      currentTarget: 130,
      remainingInAttempt: 30,
      visitsThisAttempt: 2,
      status: "IN_PROGRESS",
      attemptsCompleted: 2,
    };
    const next = applyOneTwentyOneVisit(state, { scoreAttempted: 40 });
    expect(next.attemptsCompleted).toBe(3);
  });
});

describe("oneTwentyOneV2EngineFactory", () => {
  const v2Config = (
    durationType: OneTwentyOneV2Snapshot["durationType"],
    durationValue?: number,
  ): Seated<OneTwentyOneV2Snapshot> => ({
    seats: SEATS,
    durationType,
    durationValue,
  });

  it("registers itself under 121_V2", () => {
    expect(oneTwentyOneV2EngineFactory.rulesetVersionKey).toBe("121_V2");
    expect(getEngineFactory("121_V2")).toBe(oneTwentyOneV2EngineFactory);
  });

  it("builds an engine reporting rulesetVersionKey 121_V2", () => {
    const engine = oneTwentyOneV2EngineFactory.create(v2Config("TARGET"));
    expect(engine).toBeInstanceOf(OneTwentyOneEngine);
    expect(engine.rulesetVersionKey).toBe("121_V2");
  });

  it("121_V1's own factory keeps reporting rulesetVersionKey 121_V1", () => {
    const engine = oneTwentyOneEngineFactory.create(config());
    expect(engine.rulesetVersionKey).toBe("121_V1");
  });

  describe("TARGET — identical to 121_V1", () => {
    it("only completes on a cap checkout, exactly like 121_V1", () => {
      const engine = oneTwentyOneV2EngineFactory.create(v2Config("TARGET"));
      expect(engine.isComplete()).toBe(false);
      engine.record({ scoreAttempted: 60 });
      expect(engine.isComplete()).toBe(false);
    });
  });

  describe("ROUNDS", () => {
    it("is not complete before the round budget is reached", () => {
      const engine = oneTwentyOneV2EngineFactory.create(v2Config("ROUNDS", 2));
      bustAttempt(engine as unknown as OneTwentyOneGameEngine);
      expect(engine.isComplete()).toBe(false);
    });

    it("completes once attemptsCompleted reaches duration_value, via a fail-reset", () => {
      const engine = oneTwentyOneV2EngineFactory.create(v2Config("ROUNDS", 2));
      bustAttempt(engine as unknown as OneTwentyOneGameEngine);
      bustAttempt(engine as unknown as OneTwentyOneGameEngine);
      expect(engine.isComplete()).toBe(true);
      expect(engine.state().seats[0].attemptsCompleted).toBe(2);
    });

    it("completes early via a checkout that reaches the round budget, and wouldComplete predicts it", () => {
      const engine = oneTwentyOneV2EngineFactory.create(v2Config("ROUNDS", 1));
      expect(
        engine.wouldComplete({ scoreAttempted: 121, finishedOnDouble: true }),
      ).toBe(true);
      const after = engine.record({
        scoreAttempted: 121,
        finishedOnDouble: true,
      });
      expect(engine.isComplete()).toBe(true);
      expect(after.seats[0].attemptsCompleted).toBe(1);
      expect(after.seats[0].currentTarget).toBe(122);
    });

    it("a checkout still climbs to the cap and wins the session even mid-ROUNDS-budget", () => {
      const engine = oneTwentyOneV2EngineFactory.create(v2Config("ROUNDS", 50));
      for (let target = 121; target < 170; target++) {
        engine.record({ scoreAttempted: target, finishedOnDouble: true });
      }
      const won = engine.record({ scoreAttempted: 170, finishedOnDouble: true });
      expect(won.status).toBe("WON");
      expect(engine.isComplete()).toBe(true);
    });
  });

  describe("MINUTES", () => {
    it("is not complete before the timer expires, even after several attempts", () => {
      const engine = oneTwentyOneV2EngineFactory.create(v2Config("MINUTES", 5));
      bustAttempt(engine as unknown as OneTwentyOneGameEngine);
      bustAttempt(engine as unknown as OneTwentyOneGameEngine);
      expect(engine.isComplete()).toBe(false);
    });

    it("stays false mid-attempt after the timer expires — finishes the in-flight attempt first", () => {
      const engine = oneTwentyOneV2EngineFactory.create(v2Config("MINUTES", 5));
      engine.record({ scoreAttempted: 40 });
      engine.expireTimer();
      expect(engine.isComplete()).toBe(false);
    });

    it("flips true the instant the in-flight attempt closes, once the timer has expired", () => {
      const engine = oneTwentyOneV2EngineFactory.create(v2Config("MINUTES", 5));
      engine.record({ scoreAttempted: 40 });
      engine.expireTimer();
      engine.record({ scoreAttempted: 60 });
      engine.record({ scoreAttempted: 60 });
      expect(engine.isComplete()).toBe(true);
    });

    it("wouldComplete predicts a checkout that closes the attempt once the timer has expired", () => {
      const engine = oneTwentyOneV2EngineFactory.create(v2Config("MINUTES", 5));
      engine.expireTimer();
      expect(
        engine.wouldComplete({ scoreAttempted: 121, finishedOnDouble: true }),
      ).toBe(true);
    });

    it("wouldComplete is false for a checkout before the timer has expired", () => {
      const engine = oneTwentyOneV2EngineFactory.create(v2Config("MINUTES", 5));
      expect(
        engine.wouldComplete({ scoreAttempted: 121, finishedOnDouble: true }),
      ).toBe(false);
    });
  });

  describe("rehydration carries duration config", () => {
    it("a resumed 121_V2 ROUNDS engine keeps evaluating against the same budget", () => {
      const first = oneTwentyOneV2EngineFactory.create(v2Config("ROUNDS", 1));
      first.record({ scoreAttempted: 121, finishedOnDouble: true });
      const resumed = oneTwentyOneV2EngineFactory.create(
        v2Config("ROUNDS", 1),
        first.facts(),
      );
      expect(resumed.isComplete()).toBe(true);
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts`
Expected: many FAILs — `attemptsCompleted` missing from every seat object, `oneTwentyOneV2EngineFactory` not exported. Also expect a large batch of *pre-existing* test failures once you make the seat-shape change in Step 4 below — see Step 6.

- [ ] **Step 4: Implement the engine changes**

In `app/src/modules/game/one-twenty-one.engine.module.ts`:

Change the top import (line 1) to add the two new types:

```typescript
import type {
  OneTwentyOneSnapshot,
  OneTwentyOneV2Snapshot,
  RulesetVersionKey,
  Seated,
  SeatFact,
} from "@lib/types";
```

Add a local config-union type and a normalizer, immediately after the existing constants (after line 35, before `roundStage`):

```typescript
/**
 * Both ruleset versions' seated config, unioned. `121_V1`'s carries no
 * duration fields at all (its schema is `{}`); `121_V2`'s always carries
 * `durationType`, and `durationValue` when the mode needs one.
 */
type OneTwentyOneEngineConfig =
  | Seated<OneTwentyOneSnapshot>
  | Seated<OneTwentyOneV2Snapshot>;

/**
 * Normalizes either ruleset version's config into one shape. `"durationType"
 * in config` is false for every `121_V1` config (an empty `{seats}` — the
 * key is genuinely absent, not merely `undefined`), so a `121_V1`-created
 * engine always reads `TARGET` here regardless of what config it is handed —
 * behaviour identical to today, byte for byte.
 */
function durationOf(config: OneTwentyOneEngineConfig): {
  durationType: "TARGET" | "ROUNDS" | "MINUTES";
  durationValue?: number;
} {
  if ("durationType" in config) {
    return {
      durationType: config.durationType,
      durationValue: config.durationValue,
    };
  }
  return { durationType: "TARGET" };
}
```

In `initialSeatState` (currently lines 60-69), add the new field:

```typescript
function initialSeatState(seat: SeatFact): OneTwentyOneSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    currentTarget: START_TARGET,
    remainingInAttempt: START_TARGET,
    visitsThisAttempt: 0,
    status: "IN_PROGRESS",
    attemptsCompleted: 0,
  };
}
```

In `applyOneTwentyOneVisit` (currently lines 172-224), add `attemptsCompleted: state.attemptsCompleted + 1,` to the three attempt-closing branches only (the mid-attempt carry branch is untouched — it already carries the field forward via `...state`):

```typescript
  if (outcome.checkedOut) {
    if (state.currentTarget === CAP_TARGET) {
      return {
        ...state,
        remainingInAttempt: 0,
        visitsThisAttempt: 0,
        status: "WON",
        attemptsCompleted: state.attemptsCompleted + 1,
      };
    }
    const nextTarget = state.currentTarget + 1;
    return {
      ...state,
      currentTarget: nextTarget,
      remainingInAttempt: nextTarget,
      visitsThisAttempt: 0,
      status: "IN_PROGRESS",
      attemptsCompleted: state.attemptsCompleted + 1,
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
    ...state,
    remainingInAttempt: state.currentTarget,
    visitsThisAttempt: 0,
    attemptsCompleted: state.attemptsCompleted + 1,
  };
```

Update `foldOneTwentyOneState`'s signature and body (currently lines 265-300) to take and thread the third parameter:

```typescript
export function foldOneTwentyOneState(
  facts: EngineFacts,
  config: OneTwentyOneEngineConfig,
  timerExpired: boolean,
): OneTwentyOneState {
  const openVisit =
    facts.turns.at(-1)?.completedAt === null ? facts.turns.at(-1)! : null;

  const seats = config.seats.map((seat) => {
    const closed = deriveClosedSeatState(seat, facts.turns);
    if (openVisit && openVisit.participantRef === seat.participantRef) {
      return {
        ...closed,
        remainingInAttempt: closed.remainingInAttempt - openVisit.totalScore,
      };
    }
    return closed;
  });

  const winningSideKey =
    seats.length === 1
      ? null
      : raceWinner(
          seats.map((seat) => ({
            sideKey: seat.sideKey,
            finished: seat.status === "WON",
          })),
        );

  return {
    activeParticipantRef: activeSeat(facts, config.seats, "PER_SEAT")
      .participantRef,
    status: seats.some((seat) => seat.status === "WON") ? "WON" : "IN_PROGRESS",
    winningSideKey,
    timerExpired,
    seats,
  };
}
```

(Update its doc comment to add: "`timerExpired` is threaded through purely so `state().timerExpired` is readable — mirrors `foldScoreTrainingState`'s own third parameter. It plays no role in this fold's own `status`/`winningSideKey` computation: `ROUNDS`/`MINUTES` completion is an engine-level concern (`isComplete()`/`wouldComplete()`), not a fold-level one, because it is solo-only and has no seat-level `status` value of its own.")

Update the class (currently lines 310-345):

```typescript
export class OneTwentyOneEngine implements GameEngine<
  OneTwentyOneInput,
  OneTwentyOneState
> {
  readonly rulesetVersionKey: RulesetVersionKey;
  readonly stageOwnership = "PER_SEAT" as const;
  private readonly stages: StageFact[];
  private readonly turns: TurnFact[];
  private timerExpired = false;

  constructor(
    private readonly config: OneTwentyOneEngineConfig,
    prior?: EngineFacts,
    rulesetVersionKey: RulesetVersionKey = "121_V1",
  ) {
    this.rulesetVersionKey = rulesetVersionKey;
    this.stages =
      prior && prior.stages.length > 0
        ? prior.stages.map((stage) => ({ ...stage }))
        : [roundStage(1)];
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }

  private deriveState(): OneTwentyOneState {
    return foldOneTwentyOneState(
      { stages: this.stages, turns: this.turns },
      this.config,
      this.timerExpired,
    );
  }
```

Update `seatBeforeVisit` (currently lines 374-379) to pass the third argument:

```typescript
  private seatBeforeVisit(visit: TurnFact): OneTwentyOneSeatState {
    return foldOneTwentyOneState(
      { stages: this.stages, turns: turnsBeforeVisit(this.turns, visit) },
      this.config,
      this.timerExpired,
    ).seats.find((seat) => seat.participantRef === visit.participantRef)!;
  }
```

Add `expireTimer()` immediately before `record()` (mirrors `ScoreTrainingEngine.expireTimer()`):

```typescript
  /**
   * Records that the MINUTES countdown has elapsed. The countdown itself
   * lives in `game.store.ts`, not the engine, so expiry arrives as an
   * explicit call — mirrors `ScoreTrainingEngine.expireTimer()`. No-op in
   * effect unless `durationOf(this.config).durationType === "MINUTES"`;
   * nothing reads the flag otherwise.
   */
  expireTimer(): void {
    this.timerExpired = true;
  }
```

Replace `wouldComplete` (currently lines 555-577) with:

```typescript
  /**
   * Whether recording `input` would close the active seat's current attempt
   * via a checkout (climb or cap) that also satisfies the session's
   * completion rule for its own `durationType`. Only a checkout is predicted
   * here — a 3rd-visit fail-reset that happens to be the session's final
   * closing action completes silently through the post-record `isComplete()`
   * check `recordVisit`/`commitDart` already run, mirroring the existing
   * asymmetry that a bust never opens a finish-confirm dialog.
   */
  wouldComplete(input: OneTwentyOneInput): boolean {
    if (isDartObservationInput(input)) {
      return this.wouldCompleteDart(input);
    }

    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;
    if (!isPlayableVisitScore(input.scoreAttempted)) return false;
    if (checkoutDartsRejectionFor(activeSeatState, input) !== null)
      return false;

    const after = applyOneTwentyOneVisit(activeSeatState, input);
    if (after.status === "WON") return true;

    const outcome = resolveOneTwentyOneVisit(
      activeSeatState.remainingInAttempt,
      input,
    );
    if (!outcome.checkedOut) return false;

    const { durationType, durationValue } = durationOf(this.config);
    if (durationType === "ROUNDS") {
      return after.attemptsCompleted >= (durationValue ?? 0);
    }
    if (durationType === "MINUTES") {
      return this.timerExpired;
    }
    return false;
  }
```

Replace `wouldCompleteDart` (currently lines 538-553, the private helper `wouldComplete` calls) with:

```typescript
  /**
   * The dart-input counterpart to `wouldComplete`'s visit branch — same
   * checkout-only prediction, same reasoning for why a non-checkout closing
   * dart is not predicted here.
   */
  private wouldCompleteDart(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;
    const activeSeatState = before.seats.find(
      (seat) => seat.participantRef === before.activeParticipantRef,
    )!;
    if (activeSeatState.status !== "IN_PROGRESS") return false;

    const resolved = resolveObservation(observation);
    const { checkedOut } = resolveCheckoutAttempt(
      activeSeatState.remainingInAttempt,
      resolved.score,
      resolved.zoneKey === "DOUBLE",
    );
    if (!checkedOut) return false;
    if (activeSeatState.currentTarget === CAP_TARGET) return true;

    const { durationType, durationValue } = durationOf(this.config);
    if (durationType === "ROUNDS") {
      return activeSeatState.attemptsCompleted + 1 >= (durationValue ?? 0);
    }
    if (durationType === "MINUTES") {
      return this.timerExpired;
    }
    return false;
  }
```

Replace `isComplete()` (currently lines 579-581):

```typescript
  /**
   * A cap checkout always ends the session, in every `durationType` — this
   * mechanic is untouched from `121_V1`. `ROUNDS`/`MINUTES` add an earlier
   * stop condition on top of it: `ROUNDS` once the sole seat's
   * `attemptsCompleted` reaches `duration_value`; `MINUTES` once the
   * countdown has expired AND the in-flight attempt has closed (so the
   * current attempt always finishes before the session stops). Read off the
   * sole seat — `ROUNDS`/`MINUTES` are solo-only by setup-UI convention, not
   * an engine-level guard (see spec's Decisions section).
   */
  isComplete(): boolean {
    const state = this.deriveState();
    if (state.status === "WON") return true;

    const { durationType, durationValue } = durationOf(this.config);
    if (durationType === "TARGET") return false;
    const seat = state.seats[0];
    if (durationType === "ROUNDS") {
      return seat.attemptsCompleted >= (durationValue ?? 0);
    }
    return this.timerExpired && seat.attemptsCompleted >= 1;
  }
```

Finally, add the second factory at the bottom of the file, after the existing `oneTwentyOneEngineFactory` block:

```typescript
export const oneTwentyOneV2EngineFactory: GameEngineFactory<
  Seated<OneTwentyOneV2Snapshot>,
  OneTwentyOneInput,
  OneTwentyOneState
> = {
  rulesetVersionKey: "121_V2",
  stageOwnership: "PER_SEAT",
  create(config: Seated<OneTwentyOneV2Snapshot>, prior?: EngineFacts) {
    return new OneTwentyOneEngine(config, prior, "121_V2");
  },
};

registerEngineFactory(oneTwentyOneV2EngineFactory);
```

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts -t "attemptsCompleted folding"`
Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts -t "oneTwentyOneV2EngineFactory"`
Expected: PASS.

- [ ] **Step 6: Fix every pre-existing exhaustive `toEqual` assertion broken by the new `attemptsCompleted` field**

`OneTwentyOneSeatState` gained a required field, so every existing `expect(seatObject).toEqual({ ...six fields... })` in this file (there is no `attemptsCompleted` in any of them yet) now fails on an unexpected extra key. This is mechanical and the correct value is objectively derivable from each test's own scenario (see the rule in Step 4's `applyOneTwentyOneVisit` change: +1 exactly on a checkout-climb, checkout-at-cap, or 3rd-visit fail-reset; unchanged on a mid-attempt carry) — but rather than hand-deriving ~20 values by eye, use the test runner itself as the source of truth for each one:

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts 2>&1 | grep -A 3 "toEqual"`

For every reported failure whose diff shows an unexpected `+ attemptsCompleted: N` line (vitest's own diff output, not a guess), open the file at the reported line and add `attemptsCompleted: N,` to that expected object, using exactly the value vitest's diff reports as the actual value. Before accepting a value, sanity-check it against the rule above from the test's own visit sequence (e.g. a test that runs `bustAttempt` once from a fresh engine should report `attemptsCompleted: 1`; a test asserting the state immediately after `initialOneTwentyOneState` or a single non-checkout, non-3rd visit should report `attemptsCompleted: 0`). This covers (non-exhaustively — trust the runner's full list over this summary): every `toEqual` block under "applyOneTwentyOneVisit — checkout climbs the ladder", "applyOneTwentyOneVisit — fail rule (v1: stay)", `OneTwentyOneEngine.undo`'s per-seat assertions, the visual-board-capture describe block's checkout assertions, and the "turnsBeforeVisit wiring" test's final `toEqual`.

Do not touch any assertion that only reads specific fields (`expect(x.status).toBe(...)`, `expect(x.currentTarget).toBe(...)`, etc.) — those are unaffected by the new field and must stay exactly as they are.

Re-run after each batch of fixes:

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts`

Repeat until the full file is green.

- [ ] **Step 7: Full suite green**

Run: `cd app && npx vitest run tests/modules/game/one-twenty-one.engine.module.test.ts`
Expected: PASS, 0 failures.

- [ ] **Step 8: Gates**

Run: `bash scripts/check-game-engines.sh`
Expected: `OK: ... one-twenty-one.engine.module.ts conforms (rulesetVersionKey: 121_V1 121_V2).` among the output, overall `OK`.

- [ ] **Step 9: Commit**

```bash
git add app/src/modules/game/types.ts \
  app/src/modules/game/one-twenty-one.engine.module.ts \
  app/tests/modules/game/one-twenty-one.engine.module.test.ts
git commit -m "Add 121_V2 engine support: attemptsCompleted, duration-aware completion"
```

---

## Task 6: Duration clamp helper

**Files:**
- Create: `app/src/lib/game/one-twenty-one-duration.ts`
- Create: `app/tests/lib/game/one-twenty-one-duration.test.ts`
- Modify: `app/src/lib/game/types.ts` (add `OneTwentyOneDurationType`)

**Interfaces:**
- Produces: `OneTwentyOneDurationType = "TARGET" | "ROUNDS" | "MINUTES"` (in `lib/game/types.ts`, mirrors `ScoreTrainingDurationType`/`TuodDurationType`), `oneTwentyOneDurationBounds(type)`, `clampOneTwentyOneDuration(type, value)`, `oneTwentyOneDurationClampNotice(type)` — all three take only `"ROUNDS" | "MINUTES"` (never `"TARGET"`, which has no clampable value).

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/game/one-twenty-one-duration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  clampOneTwentyOneDuration,
  oneTwentyOneDurationBounds,
  oneTwentyOneDurationClampNotice,
} from "@lib/game/one-twenty-one-duration";

describe("oneTwentyOneDurationBounds", () => {
  it("gives ROUNDS a 1-50 range", () => {
    expect(oneTwentyOneDurationBounds("ROUNDS")).toEqual({ min: 1, max: 50 });
  });

  it("gives MINUTES a 3-30 range", () => {
    expect(oneTwentyOneDurationBounds("MINUTES")).toEqual({ min: 3, max: 30 });
  });
});

describe("clampOneTwentyOneDuration", () => {
  it("floors and passes through an in-range value", () => {
    expect(clampOneTwentyOneDuration("ROUNDS", 10.9)).toEqual({
      value: 10,
      clamped: true,
    });
  });

  it("clamps above the max", () => {
    expect(clampOneTwentyOneDuration("ROUNDS", 100)).toEqual({
      value: 50,
      clamped: true,
    });
  });

  it("clamps below the min", () => {
    expect(clampOneTwentyOneDuration("MINUTES", 0)).toEqual({
      value: 3,
      clamped: true,
    });
  });

  it("clamps a non-finite value to the mode minimum", () => {
    expect(clampOneTwentyOneDuration("MINUTES", null)).toEqual({
      value: 3,
      clamped: true,
    });
  });

  it("reports not-clamped for an exact in-range integer", () => {
    expect(clampOneTwentyOneDuration("ROUNDS", 10)).toEqual({
      value: 10,
      clamped: false,
    });
  });
});

describe("oneTwentyOneDurationClampNotice", () => {
  it("names the ROUNDS range", () => {
    expect(oneTwentyOneDurationClampNotice("ROUNDS")).toBe(
      "Allowed range: 1–50 rounds",
    );
  });

  it("names the MINUTES range", () => {
    expect(oneTwentyOneDurationClampNotice("MINUTES")).toBe(
      "Allowed range: 3–30 minutes",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-duration.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Add to `app/src/lib/game/types.ts`, immediately after `export type TuodDurationType = "ROUNDS" | "MINUTES";` (currently line 58):

```typescript
export type OneTwentyOneDurationType = "TARGET" | "ROUNDS" | "MINUTES";
```

Create `app/src/lib/game/one-twenty-one-duration.ts`:

```typescript
import type { OneTwentyOneDurationType } from "./types";

type ClampableDuration = Exclude<OneTwentyOneDurationType, "TARGET">;

export function oneTwentyOneDurationBounds(type: ClampableDuration): {
  min: number;
  max: number;
} {
  return type === "ROUNDS" ? { min: 1, max: 50 } : { min: 3, max: 30 };
}

/**
 * Floors finite numbers, then clamps into the mode's inclusive bounds.
 * Non-finite / non-number inputs clamp to the mode minimum. Mirrors
 * `clampScoreTrainingDuration` exactly, re-scoped to 121's own bounds — never
 * called for `"TARGET"`, which has no `duration_value` to clamp.
 */
export function clampOneTwentyOneDuration(
  type: ClampableDuration,
  value: unknown,
): { value: number; clamped: boolean } {
  const { min, max } = oneTwentyOneDurationBounds(type);
  const numeric = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return { value: min, clamped: true };
  }
  const floored = Math.floor(numeric);
  const clampedValue = Math.min(max, Math.max(min, floored));
  return {
    value: clampedValue,
    clamped: clampedValue !== numeric,
  };
}

export function oneTwentyOneDurationClampNotice(
  type: ClampableDuration,
): string {
  return type === "ROUNDS"
    ? "Allowed range: 1–50 rounds"
    : "Allowed range: 3–30 minutes";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-duration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/one-twenty-one-duration.ts \
  app/tests/lib/game/one-twenty-one-duration.test.ts
git commit -m "Add 121's duration clamp helper (ROUNDS 1-50, MINUTES 3-30)"
```

---

## Task 7: Setup controller — hand-written duration picker

**Files:**
- Modify: `app/src/lib/game/types.ts` (replace `OneTwentyOneSetupContext` alias with a hand-written type)
- Modify: `app/src/lib/game/one-twenty-one-setup.data.ts`
- Modify: `app/src/components/layout/games/setup/OneTwentyOneSetupForm.astro`
- Create: `app/tests/lib/game/one-twenty-one-setup.data.test.ts`

**Interfaces:**
- Consumes: `OneTwentyOneDurationType` (Task 6), `clampOneTwentyOneDuration`/`oneTwentyOneDurationClampNotice` (Task 6).
- Produces: `oneTwentyOneSetup()` — a hand-written controller (opts out of `createPresetSetupController`, mirrors `scoreTrainingSetup()`), creating sessions against `"121_V2"`. `OneTwentyOneSetupContext` gains `durationType`, `durationValue`, `clampNotice`, `$watch`, `selectMode`, `presetForMode`, `forceTargetIfGuested`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/game/one-twenty-one-setup.data.test.ts` — this mirrors `app/tests/lib/game/score-training-setup.data.test.ts` structurally, re-scoped to 121's three presets and `RULESET_VERSION_KEY: "121_V2"`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { oneTwentyOneSetup } from "@lib/game/one-twenty-one-setup.data";
import type { OneTwentyOneSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const TARGET_PRESET = {
  configurationTemplateId: "tmpl-target",
  name: "121 — 170",
  configuration: { duration_type: "TARGET" },
} as any;

const ROUNDS_PRESET = {
  configurationTemplateId: "tmpl-rounds",
  name: "121 — 10 Rounds",
  configuration: { duration_type: "ROUNDS", duration_value: 10 },
} as any;

const MINUTES_PRESET = {
  configurationTemplateId: "tmpl-minutes",
  name: "121 — 5 Minutes",
  configuration: { duration_type: "MINUTES", duration_value: 5 },
} as any;

describe("oneTwentyOneSetup", () => {
  let store: OneTwentyOneSetupContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = {
      game: { sessionId: null, reset: vi.fn(), startSession: vi.fn() },
      settings: { captureModeKey: "RECREATIONAL", inputModeKey: "QUICK_SCORE" },
    };
  });

  let watchers: Array<{ key: string; callback: (value: never) => void }>;

  function createSetup(
    overrides: Partial<OneTwentyOneSetupContext> = {},
  ): OneTwentyOneSetupContext {
    watchers = [];
    return {
      ...oneTwentyOneSetup(),
      $store: store,
      $watch: (key: string, callback: (value: never) => void) => {
        watchers.push({ key, callback });
      },
      ...overrides,
    } as OneTwentyOneSetupContext;
  }

  describe("init duration defaults", () => {
    it("defaults to TARGET with no duration_value", async () => {
      const setup = createSetup();
      vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
        TARGET_PRESET,
        ROUNDS_PRESET,
        MINUTES_PRESET,
      ]);
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
      await setup.init();
      expect(setup.durationType).toBe("TARGET");
      expect(setup.durationValue).toBeNull();
    });
  });

  describe("selectMode", () => {
    it("clears durationValue when switching to TARGET", () => {
      const setup = createSetup({
        presets: [TARGET_PRESET, ROUNDS_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        durationValue: 20,
      });
      setup.selectMode("TARGET");
      expect(setup.durationType).toBe("TARGET");
      expect(setup.durationValue).toBeNull();
    });

    it("resets durationValue to the mode preset default when switching to ROUNDS", () => {
      const setup = createSetup({
        presets: [TARGET_PRESET, ROUNDS_PRESET, MINUTES_PRESET],
        durationType: "TARGET",
        durationValue: null,
      });
      setup.selectMode("ROUNDS");
      expect(setup.durationType).toBe("ROUNDS");
      expect(setup.durationValue).toBe(10);
    });
  });

  describe("forceTargetIfGuested", () => {
    it("locks ROUNDS back to TARGET once a guest is added", () => {
      const ctx = oneTwentyOneSetup() as unknown as {
        durationType: string;
        durationValue: number | string | null;
        guests: { displayName: string }[];
        newGuestName: string;
        addGuest: () => void;
      };
      ctx.durationType = "ROUNDS";
      ctx.durationValue = 10;
      ctx.newGuestName = "Guest 1";
      ctx.addGuest();
      expect(ctx.durationType).toBe("TARGET");
    });
  });

  describe("session creation", () => {
    it("creates a TARGET session with no duration_value override", async () => {
      const setup = createSetup({
        presets: [TARGET_PRESET, ROUNDS_PRESET, MINUTES_PRESET],
        durationType: "TARGET",
        durationValue: null,
      });
      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          { ref: "participant-1", displayName: "Player", participantTypeKey: "PLAYER" },
        ],
      } as any);
      vi.stubGlobal("location", { href: "" });

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          gameTypeKey: "ONE_TWENTY_ONE",
          rulesetVersionKey: "121_V2",
          config: {
            source: "template",
            templateRef: "tmpl-target",
            overrides: { duration_type: "TARGET" },
          },
        }),
      );
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          configSnapshot: expect.objectContaining({ durationType: "TARGET" }),
        }),
      );
      expect(location.href).toBe("/games/121/play");
    });

    it("creates a ROUNDS session with a clamped duration_value override", async () => {
      const setup = createSetup({
        presets: [TARGET_PRESET, ROUNDS_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        durationValue: 999,
      });
      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          { ref: "participant-1", displayName: "Player", participantTypeKey: "PLAYER" },
        ],
      } as any);
      vi.stubGlobal("location", { href: "" });

      await setup.start();

      expect(setup.durationValue).toBe(50);
      expect(setup.clampNotice).toBe("Allowed range: 1–50 rounds");
      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          config: {
            source: "template",
            templateRef: "tmpl-rounds",
            overrides: { duration_type: "ROUNDS", duration_value: 50 },
          },
        }),
      );
    });

    it("errors when no preset matches the mode", async () => {
      const setup = createSetup({
        presets: [TARGET_PRESET],
        durationType: "MINUTES",
        durationValue: 5,
      });
      await setup.start();
      expect(sessionsApi.createSession).not.toHaveBeenCalled();
      expect(setup.error).toBe("Could not find a preset for this mode.");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-setup.data.test.ts`
Expected: FAIL — `oneTwentyOneSetup()` currently returns `createPresetSetupController(...)`'s shape, which has no `durationType`/`selectMode`/etc.

- [ ] **Step 3: Replace `OneTwentyOneSetupContext` with a hand-written type**

In `app/src/lib/game/types.ts`, replace the current line `export type OneTwentyOneSetupContext = PresetSetupContext;` (currently line 835) with:

```typescript
export type OneTwentyOneSetupContext = {
  presets: ConfigurationPresetData[];
  durationType: OneTwentyOneDurationType;
  durationValue: number | string | null;
  clampNotice: string;
  loading: boolean;
  error: string;
  activeSession: SessionActiveData | null;
  showActiveSessionModal: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  guests: { displayName: string }[];
  showAddGuestModal: boolean;
  newGuestName: string;
  $store: {
    game: {
      sessionId: string | null;
      startSession(input: unknown): void;
      reset(): void;
    };
    settings: {
      captureModeKey: string;
      inputModeKey: string;
    };
  };
  $watch(
    key: "durationType",
    callback: (value: OneTwentyOneDurationType) => void,
  ): void;
  init(this: OneTwentyOneSetupContext): Promise<void>;
  reconcile(
    this: OneTwentyOneSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: OneTwentyOneSetupContext): Promise<void>;
  continueSession(this: OneTwentyOneSetupContext): void;
  abandonSession(this: OneTwentyOneSetupContext): Promise<void>;
  selectMode(
    this: OneTwentyOneSetupContext,
    type: OneTwentyOneDurationType,
  ): void;
  presetForMode(
    this: OneTwentyOneSetupContext,
    type: OneTwentyOneDurationType,
  ): ConfigurationPresetData | undefined;
  addGuest(this: OneTwentyOneSetupContext): void;
  removeGuest(this: OneTwentyOneSetupContext, index: number): void;
  forceTargetIfGuested(this: OneTwentyOneSetupContext): void;
  start(this: OneTwentyOneSetupContext): Promise<void>;
};
```

(`OneTwentyOneDurationType` is already imported in this file's local scope since it is declared in the same file, per Task 6.)

- [ ] **Step 4: Rewrite the setup controller**

Replace `app/src/lib/game/one-twenty-one-setup.data.ts` in full:

```typescript
import {
  fetchConfigurationPresets,
  type ConfigurationPresetData,
} from "@client/api/configuration-templates";
import {
  createSession,
  fetchActiveSessions,
  completeSession,
  type SessionActiveData,
} from "@client/api/sessions";
import {
  clampOneTwentyOneDuration,
  oneTwentyOneDurationClampNotice,
} from "@lib/game/one-twenty-one-duration";
import { toSnapshot } from "@lib/game/rulesets/config-codec";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { addTypedGuest } from "@lib/game/guest-list";
import {
  participantsFromGuests,
  resolveSessionModePair,
  startSessionInput,
} from "@lib/game/session-mode-resolution";
import type { RulesetVersionKey } from "@lib/types";
import type {
  OneTwentyOneDurationType,
  OneTwentyOneSetupContext,
} from "./types";

const GAME_TYPE_KEY = "ONE_TWENTY_ONE";
const RULESET_VERSION_KEY: RulesetVersionKey = "121_V2";

type ClampableDuration = Exclude<OneTwentyOneDurationType, "TARGET">;

const FALLBACK_DURATION: Record<ClampableDuration, number> = {
  ROUNDS: 10,
  MINUTES: 5,
};

/**
 * Reads `duration_value` off a preset's `configuration`, which the API types
 * as `Record<string, unknown>`. Returns undefined when the key is absent or
 * not a number (always the case for the TARGET preset), so callers fall back
 * to `FALLBACK_DURATION` for ROUNDS/MINUTES, or to `null` for TARGET.
 */
function durationValueOf(preset: ConfigurationPresetData | undefined) {
  const raw = preset?.configuration?.duration_value;
  return typeof raw === "number" ? raw : undefined;
}

export function oneTwentyOneSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    durationType: "TARGET" as OneTwentyOneDurationType,
    durationValue: null as number | string | null,
    clampNotice: "",
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,
    guests: [] as { displayName: string }[],
    showAddGuestModal: false,
    newGuestName: "",

    async init(this: OneTwentyOneSetupContext) {
      this.$watch("durationType", (type) => {
        this.selectMode(type);
      });

      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(GAME_TYPE_KEY),
          fetchActiveSessions(),
        ]);

        this.presets = presets;
        this.durationType = "TARGET";
        this.durationValue = null;
        this.clampNotice = "";

        await this.reconcile(activeSessions);
      } catch {
        this.showActiveSessionModal = false;
        this.error =
          "Could not load setup. Check your connection and try again.";
      } finally {
        this.loadingReconciliation = false;
      }
    },

    presetForMode(
      this: OneTwentyOneSetupContext,
      type: OneTwentyOneDurationType,
    ) {
      return this.presets.find((p) => {
        const cfg = p.configuration as { duration_type?: string } | null;
        return cfg?.duration_type === type;
      });
    },

    selectMode(
      this: OneTwentyOneSetupContext,
      type: OneTwentyOneDurationType,
    ) {
      this.durationType = type;
      this.durationValue =
        type === "TARGET"
          ? null
          : (durationValueOf(this.presetForMode(type)) ??
            FALLBACK_DURATION[type]);
      this.clampNotice = "";
    },

    addGuest(this: OneTwentyOneSetupContext) {
      if (addTypedGuest(this)) this.forceTargetIfGuested();
    },

    removeGuest(this: OneTwentyOneSetupContext, index: number) {
      this.guests.splice(index, 1);
    },

    /**
     * ROUNDS/MINUTES have no established 1v1 win condition (see the design
     * spec's Decisions section) — mirrors `scoreTrainingSetup()`'s own
     * `forceRoundsIfGuested`.
     */
    forceTargetIfGuested(this: OneTwentyOneSetupContext) {
      if (this.guests.length > 0) this.durationType = "TARGET";
    },

    async reconcile(
      this: OneTwentyOneSetupContext,
      activeSessions: SessionActiveData[],
    ) {
      const result = await reconcileActiveSession(
        GAME_TYPE_KEY,
        this.$store.game.sessionId,
        activeSessions,
        this.$store.game,
      );

      if (result.action === "match") {
        this.activeSession = result.activeSession;
        this.showActiveSessionModal = true;
        this.reconciliationFailed = false;
      } else if (result.action === "abandon_failed") {
        this.showActiveSessionModal = false;
        this.reconciliationFailed = true;
      } else {
        this.showActiveSessionModal = false;
        this.reconciliationFailed = false;
      }
    },

    async retryReconciliation(this: OneTwentyOneSetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: OneTwentyOneSetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/121/play";
    },

    async abandonSession(this: OneTwentyOneSetupContext) {
      if (!this.activeSession || this.loading) return;
      this.loading = true;
      this.error = "";
      try {
        await completeSession(this.activeSession.sessionId, "ABANDONED");
        this.$store.game.reset();
        this.showActiveSessionModal = false;
        this.activeSession = null;
      } catch {
        this.error = "Could not abandon session. Try again.";
      } finally {
        this.loading = false;
      }
    },

    async start(this: OneTwentyOneSetupContext) {
      if (this.loading) return;
      const preset = this.presetForMode(this.durationType);
      if (!preset) {
        this.error = "Could not find a preset for this mode.";
        return;
      }

      let overrides: Record<string, unknown> = {
        duration_type: this.durationType,
      };
      if (this.durationType !== "TARGET") {
        const { value, clamped } = clampOneTwentyOneDuration(
          this.durationType,
          this.durationValue,
        );
        this.durationValue = value;
        this.clampNotice = clamped
          ? oneTwentyOneDurationClampNotice(this.durationType)
          : "";
        overrides = { ...overrides, duration_value: value };
      } else {
        this.clampNotice = "";
      }

      this.loading = true;
      this.error = "";
      try {
        const wire = {
          ...(preset.configuration as Record<string, unknown>),
          ...overrides,
        };
        const configSnapshot = toSnapshot(RULESET_VERSION_KEY, wire);
        const modePair = resolveSessionModePair(
          RULESET_VERSION_KEY,
          this.$store.settings,
        );
        const participants = participantsFromGuests(this.guests);
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
            overrides,
          },
          participants,
        });
        this.$store.game.startSession(
          startSessionInput({
            gameTypeKey: GAME_TYPE_KEY,
            rulesetVersionKey: RULESET_VERSION_KEY,
            session,
            templateRef: preset.configurationTemplateId,
            configSnapshot,
            modePair,
          }),
        );
        globalThis.location.href = "/games/121/play";
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === "SESSION_ALREADY_ACTIVE") {
          await this.retryReconciliation();
          return;
        }
        this.error = "Could not start the session. Try again.";
      } finally {
        this.loading = false;
      }
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-setup.data.test.ts`
Expected: PASS.

- [ ] **Step 6: Update the setup form markup**

Replace `app/src/components/layout/games/setup/OneTwentyOneSetupForm.astro` in full — mirrors `ScoreTrainingSetupForm.astro`'s structure, re-scoped to three modes and TARGET's no-value case:

```astro
---
import Input from "@components/forms/Input.astro";
import Toggle from "./Toggle.astro";
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import SettingSectionShell from "./SettingSectionShell.astro";
import UserSection from "./UserSection.astro";

const formatOpts = [
  { value: "TARGET", label: "170" },
  { value: "ROUNDS", label: "Rounds" },
  { value: "MINUTES", label: "Time" },
];

const infoSection = {
  title: "121 rules",
  description:
    "Start at 121 and check out to exactly zero on a double, using up to 3 visits (9 darts). Check out and the target climbs by one — 122, 123, and so on. Miss all 3 visits and you try the same target again. Check out 170 to win, or stop after your chosen number of rounds or minutes.",
};
---

<SetupShell title="121">
  <UserSection allowGuests />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />
  <SettingSectionShell>
    <template x-if="guests.length === 0">
      <Fragment>
        <Toggle
          orientation="horizontal"
          options={formatOpts}
          x-model="durationType"
          class="w-full"
        />
        <template x-if="durationType !== 'TARGET'">
          <Fragment>
            <Input
              id="durationValue"
              name="durationValue"
              type="text"
              inputmode="numeric"
              :placeholder="durationType === 'ROUNDS' ? 'Number of rounds' : 'Number of minutes'"
              x-model.number="durationValue"
              @input="clampNotice = ''"
              class="glass border-tab-border rounded-full mt-4"
            />
            <label
              for="durationValue"
              class="text-xs text-muted-foreground px-4 py-0 italic"
              x-text="durationType === 'ROUNDS' ? 'Rounds' : 'Minutes'"
            ></label>
            <p
              class="text-sm text-muted-foreground px-4 py-0"
              role="status"
              x-show="clampNotice"
              x-text="clampNotice"
              x-cloak
            >
            </p>
          </Fragment>
        </template>
      </Fragment>
    </template>
    <template x-if="guests.length > 0">
      <p class="text-sm text-muted-foreground px-4 py-0">
        Check out 170 to win — Rounds and Time modes are solo only.
      </p>
    </template>
  </SettingSectionShell>

  <p
    class="alert alert-error mt-2 rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>
</SetupShell>
```

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/one-twenty-one-setup.data.ts \
  app/src/components/layout/games/setup/OneTwentyOneSetupForm.astro \
  app/tests/lib/game/one-twenty-one-setup.data.test.ts
git commit -m "Add 121's TARGET/ROUNDS/MINUTES duration picker to setup"
```

---

## Task 8: Play controller — version-aware resume, round counter, countdown

**Files:**
- Modify: `app/src/lib/game/types.ts` (`OneTwentyOnePlayContext`, `OneTwentyOneResultsSnapshot`)
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts`
- Modify: `app/src/components/layout/games/interfaces/OneTwentyOne.astro`
- Modify: `app/src/components/layout/games/result-modals/OneTwentyOneResults.astro`
- Modify: `app/tests/lib/game/one-twenty-one-play.data.test.ts`

**Interfaces:**
- Consumes: `OneTwentyOneV2Snapshot` (Task 2), `oneTwentyOneV2EngineFactory` (Task 5), `SegmentTimer` (existing).
- Produces: `resumeEngine` resolves either `"121_V1"` or `"121_V2"`; `playAgain` replays whichever ruleset version the prior session used; `state()` threads `timerExpired`; new getters `durationType()`, `attemptLabel()`, `remainingLabel()`; `computeStats`'s `target` reads the owner seat's actual `currentTarget` instead of a hardcoded 170; `OneTwentyOneResultsSnapshot` gains `status: "WON" | "COMPLETE"`.

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/lib/game/one-twenty-one-play.data.test.ts` (read the existing file's `baseStore()`/`createPlay()` helpers first — reuse them):

```typescript
describe("resumeEngine — version-aware", () => {
  it("resumes a 121_V2 session", async () => {
    store.rulesetVersionKey = "121_V2";
    store.configSnapshot = { seats: SEATS, durationType: "ROUNDS", durationValue: 10 };
    const play = createPlay();

    await play.init();

    expect(play.hasActiveSession).toBe(true);
    expect(play.engine).not.toBeNull();
  });

  it("refuses to resume a session under a different game's ruleset key", async () => {
    store.rulesetVersionKey = "SCORE_TRAINING_V1" as any;
    const play = createPlay();

    await play.init();

    expect(play.hasActiveSession).toBe(false);
  });
});

describe("playAgain — version-aware", () => {
  it("replays a 121_V2 session against 121_V2, carrying its own duration config", async () => {
    store.rulesetVersionKey = "121_V2";
    store.configSnapshot = { seats: SEATS, durationType: "ROUNDS", durationValue: 10 };
    const play = createPlay({ resultsSnapshot: { target: 130, visits: 5, average: 40, winningSideKey: null, status: "COMPLETE" } });
    (sessionsApi.createSession as any).mockResolvedValue({
      sessionId: "new-session-id",
      participants: [{ ref: "participant-1", displayName: "Levi", participantTypeKey: "PLAYER" }],
    });

    await play.playAgain();

    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ rulesetVersionKey: "121_V2" }),
    );
  });

  it("replays a 121_V1 session against 121_V1", async () => {
    const play = createPlay({ resultsSnapshot: { target: 170, visits: 5, average: 40, winningSideKey: null, status: "WON" } });
    (sessionsApi.createSession as any).mockResolvedValue({
      sessionId: "new-session-id",
      participants: [{ ref: "participant-1", displayName: "Levi", participantTypeKey: "PLAYER" }],
    });

    await play.playAgain();

    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ rulesetVersionKey: "121_V1" }),
    );
  });
});

describe("durationType / attemptLabel / remainingLabel", () => {
  it("durationType reads TARGET for a 121_V1 session", () => {
    const play = createPlay();
    expect(play.durationType()).toBe("TARGET");
  });

  it("durationType reads the config for a 121_V2 session", () => {
    store.configSnapshot = { seats: SEATS, durationType: "ROUNDS", durationValue: 10 } as any;
    const play = createPlay();
    expect(play.durationType()).toBe("ROUNDS");
  });

  it("attemptLabel reads attemptsCompleted against duration_value", () => {
    store.configSnapshot = { seats: SEATS, durationType: "ROUNDS", durationValue: 10 } as any;
    const play = createPlay();
    play.engine = oneTwentyOneV2EngineFactory.create(store.configSnapshot as any) as any;
    play.engine!.record({ scoreAttempted: 121, finishedOnDouble: true });
    store.recordFacts(play.engine!.facts());
    expect(play.attemptLabel()).toBe("2 of 10");
  });

  it("remainingLabel formats $store.game.timerRemainingMs as mm:ss", () => {
    store.timerRemainingMs = 65000;
    const play = createPlay();
    expect(play.remainingLabel()).toBe("01:05");
  });
});

describe("computeStats target — generalizes off the owner seat's ladder position", () => {
  it("reports the ladder position reached at a ROUNDS completion, not a hardcoded 170", async () => {
    store.configSnapshot = { seats: SEATS, durationType: "ROUNDS", durationValue: 1 } as any;
    store.rulesetVersionKey = "121_V2";
    const play = createPlay();
    play.engine = oneTwentyOneV2EngineFactory.create(store.configSnapshot as any) as any;
    play.engine!.record({ scoreAttempted: 121, finishedOnDouble: true });
    store.recordFacts(play.engine!.facts());

    await play.uploadAndCompleteSession();

    expect(play.resultsSnapshot?.target).toBe(122);
    expect(play.resultsSnapshot?.status).toBe("COMPLETE");
  });

  it("still reports 170 and status WON for a genuine cap checkout", async () => {
    const play = createPlay();
    play.engine = oneTwentyOneEngineFactory.create(config) as any;
    for (let target = 121; target < 170; target++) {
      play.engine!.record({ scoreAttempted: target, finishedOnDouble: true });
    }
    play.engine!.record({ scoreAttempted: 170, finishedOnDouble: true });
    store.recordFacts(play.engine!.facts());

    await play.uploadAndCompleteSession();

    expect(play.resultsSnapshot?.target).toBe(170);
    expect(play.resultsSnapshot?.status).toBe("WON");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts`
Expected: FAIL — `durationType`/`attemptLabel`/`remainingLabel` don't exist; `resumeEngine` rejects `"121_V2"`; `resultsSnapshot.status` doesn't exist.

- [ ] **Step 3: `OneTwentyOnePlayContext` / `OneTwentyOneResultsSnapshot` type changes**

In `app/src/lib/game/types.ts`, change `OneTwentyOneResultsSnapshot` (currently line 639):

```typescript
/** `attempt` is 1-indexed: which attempt at the winning target succeeded — always the attempt whose 3rd-or-earlier visit checked out at 170. `status` is `"WON"` only for a genuine cap-170 checkout; a ROUNDS/MINUTES session that stopped without reaching the cap reports `"COMPLETE"`. */
export type OneTwentyOneResultsSnapshot = {
  target: number;
  visits: number;
  average: number;
  winningSideKey: string | null;
  status: "WON" | "COMPLETE";
};
```

Change `OneTwentyOnePlayContext`'s `$store` field (currently line 665) and add the three new getters to the type (after `visitsThisAttempt`, currently line 677):

```typescript
  $store: PlayStoreContext<OneTwentyOneSnapshot | OneTwentyOneV2Snapshot>;
```

```typescript
  durationType(this: OneTwentyOnePlayContext): OneTwentyOneDurationType;
  attemptLabel(this: OneTwentyOnePlayContext): string;
  remainingLabel(this: OneTwentyOnePlayContext): string;
```

Add `timer: SegmentTimer | null;` to the field list (after `engine: OneTwentyOneEngine | null;`, currently line 666) — needed for the MINUTES countdown, mirrors `ScoreTrainingPlayContext.timer`:

```typescript
  timer: SegmentTimer | null;
```

Add `destroy(this: OneTwentyOnePlayContext): void;` to the method list (after `abandonAndExit`, currently line 704) — mirrors `ScoreTrainingPlayContext.destroy`, stops the countdown on navigation away:

```typescript
  destroy(this: OneTwentyOnePlayContext): void;
```

Add `OneTwentyOneV2Snapshot` to this file's rulesets-types import list (currently around line 48, alongside `OneTwentyOneSnapshot`):

```typescript
  OneTwentyOneV2Snapshot,
```

- [ ] **Step 4: Play controller changes**

In `app/src/lib/game/one-twenty-one-play.data.ts`:

Add imports:

```typescript
import { SegmentTimer } from "@modules/ui/segment-timer.module";
```

```typescript
import type { OneTwentyOneDurationType } from "./types";
```

Remove the hardcoded `RULESET_VERSION_KEY` constant (currently line 47) — it is replaced by version-aware logic in `resumeEngine`/`playAgain`. Keep `GAME_TYPE_KEY` and `DARTS_PER_VISIT`.

Replace `resumeEngine` (currently lines 55-67):

```typescript
const RESUMABLE_RULESET_VERSIONS = new Set(["121_V1", "121_V2"]);

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Accepts either ruleset version
 * — both build the same `OneTwentyOneEngine` class (Task 5) — since
 * `/games/121/play` is shared between them.
 */
function resumeEngine(
  game: OneTwentyOnePlayContext["$store"]["game"],
): OneTwentyOneEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (
    !configSnapshot ||
    !rulesetVersionKey ||
    !RESUMABLE_RULESET_VERSIONS.has(rulesetVersionKey)
  )
    return null;
  const factory = getEngineFactory(rulesetVersionKey);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof OneTwentyOneEngine ? engine : null;
}
```

Add a duration-reading helper immediately after `dartsLeftInOpenVisit` (currently ends at line 104):

```typescript
/**
 * Normalizes either ruleset version's config into `durationType`, mirroring
 * the engine's own `durationOf()` — `121_V1`'s snapshot carries no duration
 * fields at all, so it always reads `TARGET`.
 */
function durationTypeOf(
  config: OneTwentyOnePlayContext["$store"]["game"]["configSnapshot"],
): OneTwentyOneDurationType {
  if (config && "durationType" in config) return config.durationType;
  return "TARGET";
}

function durationValueOf(
  config: OneTwentyOnePlayContext["$store"]["game"]["configSnapshot"],
): number | null {
  if (config && "durationType" in config && config.durationType !== "TARGET") {
    return config.durationValue ?? null;
  }
  return null;
}

function formatRemaining(ms: number | null | undefined): string {
  const totalSeconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Starts the MINUTES countdown, resuming from the persisted remaining time
 * when a prior session left one and starting a fresh segment otherwise.
 * Mirrors `score-training-play.data.ts`'s own `startCountdown`.
 */
function startCountdown(
  game: OneTwentyOnePlayContext["$store"]["game"],
  durationValue: number,
  engine: OneTwentyOneEngine,
): SegmentTimer {
  const resumedRemainingMs = game.timerRemainingMs;
  const durationMinutes =
    resumedRemainingMs != null ? resumedRemainingMs / 60000 : durationValue;

  game.timerRemainingMs = durationMinutes * 60000;
  if (resumedRemainingMs == null) {
    game.timerStartedAt = new Date().toISOString();
  }

  const timer = new SegmentTimer({
    totalMinutes: durationMinutes,
    intervalMinutes: durationMinutes,
    onTick: (secondsRemaining) => {
      game.timerRemainingMs = secondsRemaining * 1000;
    },
    onComplete: () => {
      game.timerExpired = true;
      engine.expireTimer();
    },
  });
  timer.start();
  return timer;
}
```

Update `computeStats` (currently lines 106-127) to generalize `target` and add `status`:

```typescript
function computeStats(
  state: OneTwentyOneState,
  turns: TurnFact[],
  owner: string | null,
): {
  target: number;
  visits: number;
  average: number;
  winningSideKey: string | null;
  status: "WON" | "COMPLETE";
} {
  const ownerTurns =
    owner === null
      ? turns
      : turns.filter((turn) => turn.participantRef === owner);
  const total = ownerTurns.reduce((sum, turn) => sum + turn.totalScore, 0);
  const ownerSeat =
    state.seats.find((seat) => seat.participantRef === owner) ??
    state.seats[0];
  return {
    target: ownerSeat.currentTarget,
    visits: ownerTurns.length,
    average: ownerTurns.length === 0 ? 0 : total / ownerTurns.length,
    winningSideKey: state.winningSideKey,
    status: state.status === "WON" ? "WON" : "COMPLETE",
  };
}
```

Add `timer: null as SegmentTimer | null,` to the returned object literal in `oneTwentyOnePlay()` (currently after `engine: null as OneTwentyOneEngine | null,`, line 163).

Add the three new getters immediately after `dartsThrownThisSession` (currently ends line 245):

```typescript
    durationType(this: OneTwentyOnePlayContext): OneTwentyOneDurationType {
      return durationTypeOf(this.$store.game.configSnapshot);
    },

    attemptLabel(this: OneTwentyOnePlayContext): string {
      const state = this.state();
      const durationValue = durationValueOf(this.$store.game.configSnapshot);
      if (!state || durationValue == null) return "";
      const attemptsCompleted = state.seats[0].attemptsCompleted;
      return `${Math.min(attemptsCompleted + 1, durationValue)} of ${durationValue}`;
    },

    remainingLabel(this: OneTwentyOnePlayContext): string {
      return formatRemaining(this.$store.game.timerRemainingMs);
    },
```

Update `state()` (currently lines 175-182) to pass `timerExpired`:

```typescript
    state(this: OneTwentyOnePlayContext): OneTwentyOneState | null {
      const config = this.$store.game.configSnapshot;
      if (!config) return null;
      return foldOneTwentyOneState(
        { stages: this.$store.game.stages, turns: this.$store.game.turns },
        config,
        this.$store.game.timerExpired ?? false,
      );
    },
```

Update `init()` (currently lines 247-288) to start the countdown for a resumed MINUTES session, mirroring `score-training-play.data.ts`'s own `init()` — insert immediately after `this.$store.game.recordFacts(engine.facts());` and before `this.hasActiveSession = true;`:

```typescript
        const durationType = durationTypeOf(config);
        if (durationType === "MINUTES") {
          if (this.$store.game.timerExpired) {
            engine.expireTimer();
          } else {
            const durationValue = durationValueOf(config);
            if (durationValue != null) {
              this.timer = startCountdown(this.$store.game, durationValue, engine);
            }
          }
        }
```

Add a `destroy()` method at the end of the returned object, mirroring `ScoreTrainingPlayContext.destroy`:

```typescript
    destroy(this: OneTwentyOnePlayContext) {
      this.timer?.stop();
    },
```

Update `abandonAndExit` to stop the timer before navigating away (add `this.timer?.stop();` immediately before `this.$store.game.reset();` inside the `try` block, mirroring `score-training-play.data.ts`'s own `abandonAndExit`).

Replace `playAgain` (currently lines 615-673) to be version-aware and start a fresh countdown for MINUTES:

```typescript
    /**
     * Replays the same configuration template the first session used, against
     * whichever ruleset version that session actually used — `121_V1` stays
     * on `121_V1`, `121_V2` stays on `121_V2` and its own `duration_type`/
     * `duration_value`.
     */
    async playAgain(this: OneTwentyOnePlayContext) {
      const config = this.$store.game.configSnapshot;
      const templateRef = this.$store.game.templateRef;
      const rulesetVersionKey = this.$store.game.rulesetVersionKey;
      if (
        !config ||
        !templateRef ||
        !rulesetVersionKey ||
        !RESUMABLE_RULESET_VERSIONS.has(rulesetVersionKey) ||
        this.playAgainLoading
      )
        return;
      const factory = getEngineFactory(rulesetVersionKey);
      if (!factory) return;

      this.playAgainLoading = true;
      this.playAgainError = "";

      const modePair = resolveSessionModePair(
        rulesetVersionKey,
        this.$store.settings,
      );

      try {
        let session;
        try {
          session = await createSession({
            gameTypeKey: GAME_TYPE_KEY,
            rulesetVersionKey,
            captureModeKey: modePair.captureModeKey,
            inputModeKey: modePair.inputModeKey,
            config: { source: "template", templateRef },
            participants: participantsFromSeats(config.seats),
          });
        } catch {
          this.playAgainError = "Could not start a new session. Try again.";
          return;
        }

        const seatedSnapshot = reseatSnapshot(config, session.participants);

        this.$store.game.sessionId = session.sessionId;
        this.$store.game.configSnapshot = seatedSnapshot;
        this.$store.game.idempotencyKey = null;
        this.$store.game.setSessionModes(modePair);
        this.$store.game.timerRemainingMs = null;
        this.$store.game.timerStartedAt = null;
        this.$store.game.timerExpired = false;

        this.finished = false;
        this.completionStatus = "pending";
        this.completionError = "";
        this.resultsSnapshot = null;
        this.pendingCheckoutScore = null;
        this.pendingDartObservation = null;
        this.showDoubleConfirm = false;
        this.showSessionFinishConfirm = false;
        clearHiddenTimer(this);
        this.scoreInput.clear();
        this.error = "";
        this.hasActiveSession = true;

        const engine = factory.create(seatedSnapshot);
        if (!(engine instanceof OneTwentyOneEngine)) return;
        this.engine = engine;
        this.$store.game.recordFacts(engine.facts());

        const durationType = durationTypeOf(seatedSnapshot);
        if (durationType === "MINUTES") {
          const durationValue = durationValueOf(seatedSnapshot);
          if (durationValue != null) {
            this.timer?.stop();
            this.timer = startCountdown(this.$store.game, durationValue, engine);
          }
        }
      } finally {
        this.playAgainLoading = false;
      }
    },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts`
Expected: PASS.

- [ ] **Step 6: Interface markup — round counter and countdown**

In `app/src/components/layout/games/interfaces/OneTwentyOne.astro`, inside the solo (`SinglePlayerDisplay`) branch's `progress` slot, add two conditional `StatRow`s immediately after the existing "Visit" `StatRow` (currently lines 41-44):

```astro
          <template x-if="durationType() === 'ROUNDS'">
            <StatRow
              label="Attempt"
              value="attemptLabel()"
            />
          </template>
          <template x-if="durationType() === 'MINUTES'">
            <StatRow
              label="Time"
              value="remainingLabel()"
            />
          </template>
```

(`ROUNDS`/`MINUTES` are solo-only, so the 1v1 `SplitScoreboard` branch needs no equivalent — matches the design's Decisions section.)

- [ ] **Step 7: Results modal — don't claim a checkout that didn't happen**

In `app/src/components/layout/games/result-modals/OneTwentyOneResults.astro`, replace the title `x-text` expression (currently lines 17-21):

```astro
    <h2
      class="font-display text-lg font-semibold text-foreground"
      x-text="
        resultsSnapshot?.status !== 'WON'
          ? 'Session complete'
          : (!resultsSnapshot?.winningSideKey || ($store.game.seats?.length ?? 1) < 2
              ? '170 checked out!'
              : ($store.game.seats.find((s) => s.sideKey === resultsSnapshot.winningSideKey)?.displayName + ' checks out 170!'))
      "
    >
    </h2>
```

- [ ] **Step 8: Full play-page test file green**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts`
Expected: PASS, 0 failures (including every pre-existing test in this file — confirm nothing regressed).

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/one-twenty-one-play.data.ts \
  app/src/components/layout/games/interfaces/OneTwentyOne.astro \
  app/src/components/layout/games/result-modals/OneTwentyOneResults.astro \
  app/tests/lib/game/one-twenty-one-play.data.test.ts
git commit -m "Make 121's play page resume/replay either ruleset version, add round/time UI"
```

---

## Task 9: Database — `121_V2` seed and capability rows

**Files:**
- Create: `database/seeds/0011_one_twenty_one_v2_game_engine_reference.sql`
- Modify: `database/seeds/0007_ruleset_version_capabilities.sql`
- Create: `database/verification/0011_one_twenty_one_v2_capability_checks.sql`
- Modify: `database/verification/0007_capability_seed_checks.sql`

**Interfaces:**
- Produces: a `ruleset_versions` row for `121_V2` (same `game_types` row as `121_V1`, id `0198f000-0000-7000-8000-000000000008`), three `configuration_templates` presets (`121 — 170` / `121 — 10 Rounds` / `121 — 5 Minutes`), two new `ruleset_version_capabilities` rows.

This task is SQL-only; there is no local PostgreSQL server in this container (D193), so every check below is a manual review of the SQL's shape (mirrors the two files' own existing sibling seeds/checks) plus the one automatic Vitest parity test that does run locally.

- [ ] **Step 1: Append the two `121_V2` capability rows to seed 0007**

In `database/seeds/0007_ruleset_version_capabilities.sql`, add two lines to the `VALUES` list (currently lines 36-54) immediately after `('121_V1', 'ANALYTICS', 'VISUAL_BOARD'),`:

```sql
            ('121_V2', 'RECREATIONAL', 'QUICK_SCORE'),
            ('121_V2', 'ANALYTICS', 'VISUAL_BOARD'),
```

- [ ] **Step 2: Verify the automatic parity test picks this up**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capability-seed-parity.test.ts`
Expected: FAIL at this point (Task 3 already added `"121_V2"` to `RULESET_CAPABILITIES` in code, but the seed file's new rows and the code's new entry must literally match — run this now to catch any typo before moving on, then re-run once Step 1 above is actually in place; if Task 3 already landed, this should already PASS after Step 1).

- [ ] **Step 3: Create the seed file**

Create `database/seeds/0011_one_twenty_one_v2_game_engine_reference.sql`. Note the `configuration_templates` insert is a single multi-row `VALUES (...), (...), (...)` with exactly one `ON CONFLICT (id) DO NOTHING` clause at the very end — PostgreSQL applies one `ON CONFLICT` per statement, not per row:

```sql
-- ============================================================
-- Seed: 0011_one_twenty_one_v2_game_engine_reference.sql
--
-- Purpose:
-- Seed reference data for 121 V2: the same checkout-ladder
-- mechanics as 121 V1, plus two additional end conditions —
-- ROUNDS (stop after N attempts) and MINUTES (stop after N
-- minutes) — alongside the unchanged TARGET (climb to 170)
-- mode. No new game_types row: 121_V2 is a new ruleset_versions
-- row under the same ONE_TWENTY_ONE game type 0009 already
-- seeded. Without this seed there is no ruleset version or
-- preset to start a 121_V2 session from — POST /api/sessions
-- has nothing to look up for 121_V2.
--
-- UUID allocation (continues the 0003 range, next after 0010's
-- Around the Clock row):
-- - 0198f100-...-000010 ruleset_versions        (121_V2)
-- - 0198f300-...-000014 configuration_templates (121 — 170)
-- - 0198f300-...-000015 configuration_templates (121 — 10 Rounds)
-- - 0198f300-...-000016 configuration_templates (121 — 5 Minutes)
--
-- Configuration JSONB follows the ruleset configuration schema
-- (app/src/lib/game/rulesets/types.ts) — OneTwentyOneV2Config:
-- `duration_type` is always present; `duration_value` is
-- present for ROUNDS/MINUTES and OMITTED (not merely null) for
-- TARGET, matching the schema's own superRefine.
--
-- No game_type_features mapping: no opponent toggle to
-- configure, mirroring 0009's 121_V1 reasoning. ROUNDS/MINUTES
-- are solo-only by setup-UI convention (docs/superpowers/specs/
-- 2026-08-28-121-rounds-timed-mode-design.md), not a database
-- constraint.
--
-- No exercise_templates row: nothing outside this file's own
-- configuration_templates presets currently reads exercise_
-- templates at runtime.
--
-- Capability: 121_V2 + RECREATIONAL + QUICK_SCORE and 121_V2 +
-- ANALYTICS + VISUAL_BOARD are declared in seeds/0007_ruleset_
-- version_capabilities.sql, not here — 0007 is the single
-- running ledger every ruleset's capability rows are appended
-- to. verification/0011_one_twenty_one_v2_capability_checks.sql
-- asserts the resulting rows.
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
        '0198f100-0000-7000-8000-000000000010',
        '0198f000-0000-7000-8000-000000000008',
        '121_V2',
        2,
        '121 V2: adds ROUNDS (stop after N attempts) and MINUTES (stop after N minutes) end conditions alongside the unchanged TARGET (climb to cap 170) mode. Dart budget, double-out, fail rule unchanged from V1 in every mode.',
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- ============================================================
-- Configuration presets
-- ============================================================
INSERT INTO configuration_templates (
        id,
        game_type_id,
        player_id,
        name,
        description,
        configuration,
        is_system_template,
        created_at,
        updated_at
    )
VALUES (
        '0198f300-0000-7000-8000-000000000014',
        '0198f000-0000-7000-8000-000000000008',
        NULL,
        '121 — 170',
        'Start at 121, double out, 3 visits per attempt, check out 170 to win.',
        '{"duration_type": "TARGET"}'::jsonb,
        TRUE,
        now(),
        now()
    ),
    (
        '0198f300-0000-7000-8000-000000000015',
        '0198f000-0000-7000-8000-000000000008',
        NULL,
        '121 — 10 Rounds',
        'Stop after 10 attempts, whatever target you reach.',
        '{"duration_type": "ROUNDS", "duration_value": 10}'::jsonb,
        TRUE,
        now(),
        now()
    ),
    (
        '0198f300-0000-7000-8000-000000000016',
        '0198f000-0000-7000-8000-000000000008',
        NULL,
        '121 — 5 Minutes',
        'Stop after 5 minutes — the attempt in progress finishes before the session ends.',
        '{"duration_type": "MINUTES", "duration_value": 5}'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
COMMIT;
```

- [ ] **Step 4: Create the verification script**

Create `database/verification/0011_one_twenty_one_v2_capability_checks.sql` — mirrors `0009_121_capability_checks.sql`'s shape, re-scoped to 121_V2's two capability rows plus a check that all three presets parse the expected `duration_type`:

```sql
-- ============================================================
-- Verification: 0011_one_twenty_one_v2_capability_checks.sql
--
-- Mirrors 0009_121_capability_checks.sql's shape, re-scoped for
-- the additive 121_V2 rows appended to 0007_ruleset_version_
-- capabilities.sql's own VALUES list. No PostgreSQL server
-- exists in the container that authored this file (D193), so it
-- asserts against a real Neon database before merge:
--
--   1. 121_V2 + RECREATIONAL + QUICK_SCORE resolved
--   2. 121_V2 + ANALYTICS + VISUAL_BOARD resolved
--   3. all three 121_V2 presets exist with the right duration_type
--   4. no exercise_sessions row is left undeclared
--
-- Full-table exact-count parity lives in
-- 0007_capability_seed_checks.sql alone. This script owns only
-- 121_V2's own additions.
--
-- Usage:
--   psql "$DATABASE_URL" -f database/verification/0011_one_twenty_one_v2_capability_checks.sql
--
-- Expected: every result row reads PASS. Run only after
-- `npm run db:seed` has applied seeds/0007 and seeds/0011.
-- ============================================================
BEGIN;

CREATE TEMP TABLE verification_results (
    step TEXT NOT NULL,
    check_name TEXT NOT NULL,
    result TEXT NOT NULL,
    detail TEXT
) ON COMMIT DROP;

-- ------------------------------------------------------------
-- Step 1: 121_V2 + RECREATIONAL + QUICK_SCORE resolved.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '1',
    '121_V2 / RECREATIONAL / QUICK_SCORE resolves to a seeded row',
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN NULL
        WHEN rv.id IS NULL THEN 'no ruleset_versions row for 121_V2'
        ELSE 'lookups resolved but no matching ruleset_version_capabilities row'
    END
FROM ruleset_versions rv
    LEFT JOIN capture_modes cm ON cm.implementation_key = 'RECREATIONAL'
    LEFT JOIN input_modes im ON im.implementation_key = 'QUICK_SCORE'
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id
WHERE rv.implementation_key = '121_V2';

-- ------------------------------------------------------------
-- Step 2: 121_V2 + ANALYTICS + VISUAL_BOARD resolved.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '2',
    '121_V2 / ANALYTICS / VISUAL_BOARD resolves to a seeded row',
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    CASE
        WHEN c.ruleset_version_id IS NOT NULL THEN NULL
        WHEN rv.id IS NULL THEN 'no ruleset_versions row for 121_V2'
        ELSE 'lookups resolved but no matching ruleset_version_capabilities row'
    END
FROM ruleset_versions rv
    LEFT JOIN capture_modes cm ON cm.implementation_key = 'ANALYTICS'
    LEFT JOIN input_modes im ON im.implementation_key = 'VISUAL_BOARD'
    LEFT JOIN ruleset_version_capabilities c ON c.ruleset_version_id = rv.id
    AND c.capture_mode_id = cm.id
    AND c.input_mode_id = im.id
WHERE rv.implementation_key = '121_V2';

-- ------------------------------------------------------------
-- Step 3: all three 121_V2 presets exist with the right
-- duration_type.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '3',
    format('preset %s carries duration_type %s', expected.name, expected.duration_type),
    CASE
        WHEN ct.id IS NOT NULL THEN 'PASS'
        ELSE 'FAIL'
    END,
    CASE
        WHEN ct.id IS NOT NULL THEN NULL
        ELSE 'no configuration_templates row found with that name and duration_type'
    END
FROM (
        VALUES ('121 — 170', 'TARGET'),
            ('121 — 10 Rounds', 'ROUNDS'),
            ('121 — 5 Minutes', 'MINUTES')
    ) AS expected(name, duration_type)
    LEFT JOIN configuration_templates ct ON ct.name = expected.name
    AND ct.configuration ->> 'duration_type' = expected.duration_type;

-- ------------------------------------------------------------
-- Step 4: no live exercise_sessions row is left undeclared.
-- ------------------------------------------------------------
INSERT INTO verification_results
SELECT '4',
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

- [ ] **Step 5: Append the two `121_V2` triples to `0007_capability_seed_checks.sql`**

In `database/verification/0007_capability_seed_checks.sql`:

1. Add two lines to the Step 2 `VALUES` list (currently lines 91-108), immediately after `('121_V1', 'ANALYTICS', 'VISUAL_BOARD'),`:

```sql
                    ('121_V2', 'RECREATIONAL', 'QUICK_SCORE'),
                    ('121_V2', 'ANALYTICS', 'VISUAL_BOARD'),
```

2. Add the same two lines to the Step 4 `VALUES` list (currently lines 188-205), same position.

3. Update the three hardcoded counts from `18` to `20`: line 54 (`'seed inserted exactly the 18 declared rows'` → `'seed inserted exactly the 20 declared rows'`), line 56 (`WHEN count(*) = 18` → `WHEN count(*) = 20`), line 59 (`'expected 18, found %s'` → `'expected 20, found %s'`), line 122 (`'all 18 declared triples were actually checked'` → `'all 20 declared triples were actually checked'`), line 124 (`WHEN count(*) = 18` → `WHEN count(*) = 20`), line 127 (`'%s of 18 triple checks ran'` → `'%s of 20 triple checks ran'`).

- [ ] **Step 6: Re-run the automatic parity test**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capability-seed-parity.test.ts`
Expected: PASS — the seed file's triples and `RULESET_CAPABILITIES` (Task 3) now agree exactly, 20 triples on both sides.

- [ ] **Step 7: Commit**

```bash
git add database/seeds/0011_one_twenty_one_v2_game_engine_reference.sql \
  database/seeds/0007_ruleset_version_capabilities.sql \
  database/verification/0011_one_twenty_one_v2_capability_checks.sql \
  database/verification/0007_capability_seed_checks.sql
git commit -m "Seed 121_V2: ruleset version, three duration presets, capability rows"
```

*(A person with access to a real Neon database should run both verification scripts — `psql "$DATABASE_URL" -f database/verification/0007_capability_seed_checks.sql` and `psql "$DATABASE_URL" -f database/verification/0011_one_twenty_one_v2_capability_checks.sql` — after `npm run db:seed`, before this branch merges. Note this in the PR description; it cannot run inside this container.)*

---

## Task 10: Final gates and full validation

**Files:** none (verification only)

- [ ] **Step 1: Structural gates**

Run:
```bash
bash scripts/check-game-engines.sh
bash scripts/check-game-wiring.sh
```
Expected: both `OK`, `check-game-engines.sh` listing `one-twenty-one.engine.module.ts conforms (rulesetVersionKey: 121_V1 121_V2)`, `check-game-wiring.sh` reporting `10 ruleset(s) checked`.

- [ ] **Step 2: Format**

Run: `cd app && npm run format`
Expected: no diff, or a diff that only touches files this plan edited — commit any formatting fixes separately if the run produces a diff:

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
Expected: PASS, 0 failures across the whole suite (not just the files this plan touched — confirms nothing elsewhere regressed from the `OneTwentyOneSeatState`/`OneTwentyOneState`/`OneTwentyOnePlayContext` shape changes).

- [ ] **Step 5: Manual smoke test (UI)**

Start the dev server in the background (`astro dev --background` per `app/CLAUDE.md`), then in a browser:
1. Go to `/games/121/setup`. Confirm three duration options render (170 / Rounds / Time), Rounds/Minutes show a number field, adding a guest locks the picker back to TARGET.
2. Start a Rounds (e.g. 3) session. Play through 3 attempts (mix of checkouts and busts). Confirm the session completes and uploads as `COMPLETED` (not `ABANDONED`) once the 3rd attempt resolves, and the results modal reads "Session complete" (not "170 checked out!") unless attempt 3 happened to check out at 170.
3. Start a Minutes (e.g. 3) session. Confirm a countdown label renders and counts down; let it expire mid-attempt; confirm the session does NOT complete until the in-flight attempt resolves, then completes automatically.
4. Confirm a `121_V1` session (if any old data/route still reachable) still plays and replays ("Play again") without error — version-aware `resumeEngine`/`playAgain` did not break the original mode.

Stop the dev server (`astro dev stop`) when done.

- [ ] **Step 6: Context maintenance**

Run the `context-maintenance` skill per root `CLAUDE.md`'s mandatory every-task requirement — updates the context map / decision ledger / knowledge graph as needed for this feature before the task is considered done.

---

## Execution note on Task 9's UUIDs

The exact UUID values in Task 9's seed file are chosen by continuing the existing `0198fXXX-0000-7000-8000-NNNNNNNNNNNN` sequential-decimal convention this codebase already uses (`ruleset_versions` at `...008`, `...009` → `...010`; `configuration_templates` at `...012`, `...013` → `...014`, `...015`, `...016`). Before running Task 9, re-verify these are still the next free values by re-running:

```bash
grep -h "'0198f100-0000-7000-8000-" database/seeds/*.sql | sort
grep -h "'0198f300-0000-7000-8000-" database/seeds/*.sql | sort
```

If another branch has landed a seed file first and claimed one of these IDs, bump Task 9's values to the next free ones in the same sequence before writing the seed file.
