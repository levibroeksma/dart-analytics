# TUOD Round/Time Configuration Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TUOD's solo setup gets the same editable round/time configuration Score Training already has: a mode toggle (Rounds/Time) plus a free-typed value, clamped to bounds on submit, carried through play-again. 1v1 is unchanged — it already has an editable rounds field.

**Architecture:** Keep `TUOD_V1`. Add a `superRefine` to `TuodConfig` mirroring `ScoreTrainingConfig`'s (ROUNDS 1–100, MINUTES 3–30). Generalize `tuod-duration.ts` from a ROUNDS-only helper to a type-aware one, mirroring `score-training-duration.ts`. `tuod-setup.data.ts` gains `selectMode`/`$watch` and always clamps + overrides `duration_value` on `start()` (today it only does this when a guest is present). `TuodSetupForm.astro`'s solo branch gains the `Input` + clamp-notice block Score Training's already has. `tuod-play.data.ts`'s `playAgain()` starts sending `overrides: { duration_value: config.durationValue }` instead of none, so a replayed custom-duration session doesn't silently reset to the preset default.

**Tech Stack:** Astro, Alpine.js, Zod (`TuodConfig`), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-29-tuod-round-time-config-design.md`

## Global Constraints

- TUOD only — do not change Score Training's bounds, setup, or any other game
- Ruleset key stays `TUOD_V1` (no new ruleset version)
- No new migration, no seed changes — the two seeded presets (10 rounds / 10 minutes) stay as-is; only their role changes, from locked choice to typed default
- Session create stays `source: "template"` + `overrides: { duration_value }` — never full inline config
- Bounds: ROUNDS **1–100** (unchanged from today's `tuodRoundsBounds()`), MINUTES **3–30** (new — today has no ceiling)
- Mode switch resets `durationValue` to that mode's preset default (fallback ROUNDS 10 / MINUTES 10 — TUOD's own existing defaults, not Score Training's); clears `clampNotice`
- Invalid input: clamp then start; notice only when a clamp occurred
- Clamp notice copy: `Allowed range: 1–100 rounds` / `Allowed range: 3–30 minutes`
- Missing mode preset error stays: `Could not find a preset for this mode.`
- Clear `clampNotice` with `@input` on the field — never an Alpine `$watch` on `durationValue` (the existing `$watch("durationType", ...)` this task adds is a different field and is fine)
- Duration field uses `Input.astro`, never a raw `<input>`
- `durationValue` stays typed `number | string | null`
- 1v1 (`forceRoundsIfGuested`, guest-branch UI) is already at parity — do not touch its behavior, only reuse the same clamp/override path it already exercises
- No engine changes, no new API routes, no play-page UI changes beyond `playAgain()`'s create payload
- Worktrees forbidden — dedicated branch in the main working copy
- Do not commit unless the user asks (plan steps still list commit commands for when they do)
- Tests under `app/tests/` only; no colocated tests; no re-pointing bound tests at unrelated inputs (D148)
- No inline `//` comments inside `app/src/**/*.ts` function bodies — `// …` lines inside code snippets below are **plan annotations only**; do not copy them into source (`scripts/check-no-inline-comments.sh` fails on them)

## File Structure

| File | Responsibility |
| ---- | --------------- |
| `app/src/lib/game/rulesets/types.ts` | `TuodConfig` gains a `superRefine` bounding `duration_value` by `duration_type` |
| `app/src/lib/game/rulesets/refinement-contract.ts` | New `tuodContract` — accept/reject probes + blind-spot JSDoc |
| `app/tests/lib/game/rulesets/types.test.ts` | `TuodConfig bounds` describe block gains `duration_value` bound tests |
| `app/tests/lib/game/rulesets/refinement-contract.test.ts` | Named check that `tuodContract` is registered |
| `app/tests/services/rulesets/tuod/tuod.validator.test.ts` | `validateConfig` bound tests through the validator |
| `app/src/lib/game/tuod-duration.ts` | ROUNDS-only helpers → type-aware (`tuodDurationBounds`/`clampTuodDuration`/`tuodDurationClampNotice`) |
| `app/tests/lib/game/tuod-duration.test.ts` | Rewritten for the type-aware API |
| `app/src/lib/game/types.ts` | `TuodSetupContext` gains `$watch` and `selectMode` signatures |
| `app/src/lib/game/tuod-setup.data.ts` | `selectMode`, unconditional clamp/override, `FALLBACK_DURATION` |
| `app/tests/lib/game/tuod-setup.data.test.ts` | `selectMode` coverage; solo-session override test replaces "does not override" test |
| `app/src/components/layout/games/setup/TuodSetupForm.astro` | Solo branch gains `Input` + label + clamp notice; mode-only Toggle labels |
| `app/src/lib/game/tuod-play.data.ts` | `playAgain()` sends `overrides: { duration_value }` |
| `app/tests/lib/game/tuod-play.data.test.ts` | ST4 test updated; two new "replays with the session's own round/minute count" tests |
| `docs/game-rules/rulesets/ten-up-one-down.md` | Config table + Objective note updated for editable value |

---

### Task 1: `TuodConfig` duration bounds (schema + refinement contract + validator)

**Files:**

- Modify: `app/src/lib/game/rulesets/types.ts:146-155`
- Modify: `app/src/lib/game/rulesets/refinement-contract.ts`
- Test: `app/tests/lib/game/rulesets/types.test.ts:120-164`
- Test: `app/tests/lib/game/rulesets/refinement-contract.test.ts:18-22`
- Test: `app/tests/services/rulesets/tuod/tuod.validator.test.ts:37-73`

**Interfaces:**

- Consumes: nothing new — `TuodConfig`, `tuodValidator`, `REFINEMENT_CONTRACTS` all already exist
- Produces: `TuodConfig` now rejects `duration_value` outside `[1,100]` for ROUNDS / `[3,30]` for MINUTES — every later task that clamps client-side must land in these same bounds or the server rejects a client-accepted value

- [ ] **Step 1: Write the failing schema bound tests**

In `app/tests/lib/game/rulesets/types.test.ts`, inside the existing `describe("TuodConfig bounds", ...)` block (after the existing `validRest` const and its current four tests, before the closing `});` at line 164), add:

```ts
  it("rejects duration_value: 0 for ROUNDS, one below the floor", () => {
    const result = TuodConfig.safeParse({
      ...validRest,
      starting_target: 41,
      duration_value: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts duration_value: 100 for ROUNDS, the ceiling", () => {
    const result = TuodConfig.safeParse({
      ...validRest,
      starting_target: 41,
      duration_value: 100,
    });
    expect(result.success).toBe(true);
  });

  it("rejects duration_value: 101 for ROUNDS, one past the ceiling", () => {
    const result = TuodConfig.safeParse({
      ...validRest,
      starting_target: 41,
      duration_value: 101,
    });
    expect(result.success).toBe(false);
  });

  it("rejects duration_value: 2 for MINUTES, one below the floor", () => {
    const result = TuodConfig.safeParse({
      ...validRest,
      starting_target: 41,
      duration_type: "MINUTES",
      duration_value: 2,
    });
    expect(result.success).toBe(false);
  });

  it("accepts duration_value: 3 for MINUTES, the floor", () => {
    const result = TuodConfig.safeParse({
      ...validRest,
      starting_target: 41,
      duration_type: "MINUTES",
      duration_value: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts duration_value: 30 for MINUTES, the ceiling", () => {
    const result = TuodConfig.safeParse({
      ...validRest,
      starting_target: 41,
      duration_type: "MINUTES",
      duration_value: 30,
    });
    expect(result.success).toBe(true);
  });

  it("rejects duration_value: 31 for MINUTES, one past the ceiling", () => {
    const result = TuodConfig.safeParse({
      ...validRest,
      starting_target: 41,
      duration_type: "MINUTES",
      duration_value: 31,
    });
    expect(result.success).toBe(false);
  });
```

- [ ] **Step 2: Run and confirm the new tests fail**

```bash
cd app && npx vitest run tests/lib/game/rulesets/types.test.ts -t "TuodConfig bounds"
```

Expected: the ceiling/MINUTES-floor cases FAIL — today's schema has no `superRefine` on `TuodConfig`, so `duration_value: 101` and `duration_value: 2` under `MINUTES` both currently parse successfully.

- [ ] **Step 3: Add the `superRefine` to `TuodConfig`**

In `app/src/lib/game/rulesets/types.ts`, replace the `TuodConfig` declaration (lines 146-155):

```ts
export const TuodConfig = z
  .object({
    starting_target: z.number().int().min(2),
    finish_bonus: z.number().int().min(1),
    miss_penalty: z.number().int().min(1),
    duration_type: z.enum(["ROUNDS", "MINUTES"]),
    duration_value: z.number().int().min(1),
    max_darts_per_turn: z.number().int().min(1).max(3),
  })
  .strict()
  .superRefine((val, ctx) => {
    const [min, max] = val.duration_type === "ROUNDS" ? [1, 100] : [3, 30];
    if (val.duration_value < min || val.duration_value > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration_value"],
        message: `duration_value must be between ${min} and ${max} for ${val.duration_type}`,
      });
    }
  });
```

Also extend the JSDoc block immediately above it (the one starting "Ten Up One Down: a checkout ladder...") with one sentence noting the bound now matches Score Training's exactly:

```ts
/**
 * Ten Up One Down: a checkout ladder that climbs by `finish_bonus` on a
 * successful attempt and falls by `miss_penalty` on a failed one, played for a
 * `duration_type`/`duration_value` session exactly as Score Training is.
 * `duration_value` is bounded conditionally by `duration_type` — ROUNDS 1..100,
 * MINUTES 3..30 — identical to `ScoreTrainingConfig`'s own bound, which is why
 * it lives in a whole-object `superRefine` rather than `.min()`/`.max()` on the
 * field alone.
 *
 * `starting_target` shares `FiveOhOneConfig.starting_score`'s floor of 2, the
 * minimum a double-out attempt can ever finish from (D1 = 2). `finish_bonus`
 * and `miss_penalty` each have a floor of 1: a step of 0 would leave the ladder
 * frozen on one target, which is not the game. No key carries a default —
 * every one is present in both seeded presets, and defaulting a ladder step
 * would silently invent a rule the preset never stated.
 *
 * V1 models no ladder floor. Whether a failed attempt may drop the target below
 * the start score is an open question in
 * `docs/game-rules/rulesets/ten-up-one-down.md`, so no key expresses it yet.
 */
```

- [ ] **Step 4: Run and confirm the tests pass**

```bash
cd app && npx vitest run tests/lib/game/rulesets/types.test.ts -t "TuodConfig bounds"
```

Expected: PASS, all eleven cases (four pre-existing + seven new).

- [ ] **Step 5: Register the refinement contract**

`scripts/check-refinement-coverage.sh` requires every schema carrying a `superRefine` to have a matching entry in `refinement-contract.ts`, or the pre-commit gate fails. In `app/src/lib/game/rulesets/refinement-contract.ts`:

Add the import:

```ts
import {
  DoublesTrainingConfig,
  OneTwentyOneV2Config,
  ScoreTrainingConfig,
  SinglesConfig,
  TuodConfig,
} from "./types";
```

After the `oneTwentyOneV2Contract` declaration (before the final `REFINEMENT_CONTRACTS` export), add:

```ts
type TuodInput = z.input<typeof TuodConfig>;

const tuodBase = {
  starting_target: 41,
  finish_bonus: 10,
  miss_penalty: 1,
  duration_type: "ROUNDS",
  duration_value: 1,
  max_darts_per_turn: 3,
} satisfies TuodInput;

const tuodMinutesBase = {
  ...tuodBase,
  duration_type: "MINUTES",
  duration_value: 5,
} satisfies TuodInput;

/**
 * `TuodConfig.duration_value` is bounded conditionally by `duration_type` —
 * identical to `ScoreTrainingConfig`'s own bound (ROUNDS 1..100, MINUTES
 * 3..30) — which is why it lives in a whole-object `superRefine` instead of
 * `.min()`/`.max()` on the field alone.
 *
 * Same blind spot as `scoreTrainingContract`: ROUNDS floor (1) duplicates the
 * field-level `.min(1)`, so `duration_value: 0` for ROUNDS is rejected either
 * way and that reject probe is not load-bearing on its own. MINUTES floor (3)
 * is strictly above `.min(1)`, so `duration_value: 2` for MINUTES clears
 * `.min(1)` and is rejected only by this `superRefine` — that probe is the
 * first genuinely load-bearing floor probe in this contract. Ceiling probes
 * on both duration types are load-bearing: nothing else bounds the top.
 */
const tuodContract: SchemaRefinementContract<TuodInput> = {
  schemaName: "TuodConfig",
  schema: TuodConfig,
  fields: [
    {
      field: "duration_value",
      accept: [
        {
          label: "duration_value 1 for ROUNDS, the floor",
          config: { ...tuodBase, duration_value: 1 },
        },
        {
          label: "duration_value 100 for ROUNDS, the ceiling",
          config: { ...tuodBase, duration_value: 100 },
        },
      ],
      reject: [
        {
          label: "duration_value 0 for ROUNDS, one below the floor",
          config: { ...tuodBase, duration_value: 0 },
        },
        {
          label: "duration_value 101 for ROUNDS, one past the ceiling",
          config: { ...tuodBase, duration_value: 101 },
        },
      ],
    },
    {
      field: "duration_value",
      accept: [
        {
          label: "duration_value 3 for MINUTES, the floor",
          config: { ...tuodMinutesBase, duration_value: 3 },
        },
        {
          label: "duration_value 30 for MINUTES, the ceiling",
          config: { ...tuodMinutesBase, duration_value: 30 },
        },
      ],
      reject: [
        {
          label: "duration_value 2 for MINUTES, one below the floor",
          config: { ...tuodMinutesBase, duration_value: 2 },
        },
        {
          label: "duration_value 31 for MINUTES, one past the ceiling",
          config: { ...tuodMinutesBase, duration_value: 31 },
        },
      ],
    },
  ],
};
```

Add `tuodContract` to the exported array:

```ts
export const REFINEMENT_CONTRACTS: readonly SchemaRefinementContract[] = [
  scoreTrainingContract,
  singlesTrainingContract,
  doublesTrainingContract,
  oneTwentyOneV2Contract,
  tuodContract,
];
```

- [ ] **Step 6: Add the named coverage check**

In `app/tests/lib/game/rulesets/refinement-contract.test.ts`, after the existing `"covers OneTwentyOneV2Config's TARGET/ROUNDS/MINUTES bounds"` test (line 22), add:

```ts
  it("covers TuodConfig's ROUNDS/MINUTES bounds", () => {
    expect(
      REFINEMENT_CONTRACTS.map((contract) => contract.schemaName),
    ).toContain("TuodConfig");
  });
```

- [ ] **Step 7: Run the refinement suite and the coverage gate**

```bash
cd app && npx vitest run tests/lib/game/rulesets/refinement-contract.test.ts tests/lib/game/rulesets/types.test.ts
cd /home/user/dart-analytics && bash scripts/check-refinement-coverage.sh
```

Expected: all PASS.

- [ ] **Step 8: Write failing validator bound tests**

In `app/tests/services/rulesets/tuod/tuod.validator.test.ts`, after the existing `"rejects a config carrying a key the schema does not model"` test (before the closing `});` of `describe("tuodValidator.validateConfig", ...)` at line 73), add — reusing the file's own `validConfig`/`minutesConfig` consts:

```ts
  it("accepts duration_value: 100, the ROUNDS ceiling", () => {
    const result = tuodValidator.validateConfig({
      config: { ...validConfig, duration_value: 100 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects duration_value: 101, one past the ROUNDS ceiling", () => {
    const result = tuodValidator.validateConfig({
      config: { ...validConfig, duration_value: 101 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("rejects duration_value: 2, one below the MINUTES floor", () => {
    const result = tuodValidator.validateConfig({
      config: { ...minutesConfig, duration_value: 2 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });

  it("accepts duration_value: 30, the MINUTES ceiling", () => {
    const result = tuodValidator.validateConfig({
      config: { ...minutesConfig, duration_value: 30 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects duration_value: 31, one past the MINUTES ceiling", () => {
    const result = tuodValidator.validateConfig({
      config: { ...minutesConfig, duration_value: 31 },
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
    });
    expect(result.valid).toBe(false);
  });
```

- [ ] **Step 9: Run and confirm pass**

```bash
cd app && npx vitest run tests/services/rulesets/tuod/tuod.validator.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add app/src/lib/game/rulesets/types.ts \
  app/src/lib/game/rulesets/refinement-contract.ts \
  app/tests/lib/game/rulesets/types.test.ts \
  app/tests/lib/game/rulesets/refinement-contract.test.ts \
  app/tests/services/rulesets/tuod/tuod.validator.test.ts
git commit -m "$(cat <<'EOF'
feat(tuod): bound duration_value by duration_type

TuodConfig now rejects duration_value outside 1-100 for ROUNDS or
3-30 for MINUTES, mirroring ScoreTrainingConfig's own bound.
EOF
)"
```

---

### Task 2: Duration helper — ROUNDS-only to type-aware

**Files:**

- Modify: `app/src/lib/game/tuod-duration.ts` (full rewrite)
- Test: `app/tests/lib/game/tuod-duration.test.ts` (full rewrite)

**Interfaces:**

- Consumes: `TuodDurationType` from `app/src/lib/game/types.ts` (already exists — used by `TuodSetupContext.durationType` today)
- Produces: `tuodDurationBounds(type: TuodDurationType): { min: number; max: number }`, `clampTuodDuration(type: TuodDurationType, value: unknown): { value: number; clamped: boolean }`, `tuodDurationClampNotice(type: TuodDurationType): string` — Task 3's `tuod-setup.data.ts` imports these three by name

- [ ] **Step 1: Write the failing type-aware tests**

Replace the full contents of `app/tests/lib/game/tuod-duration.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  clampTuodDuration,
  tuodDurationBounds,
  tuodDurationClampNotice,
} from "@lib/game/tuod-duration";

describe("tuodDurationBounds", () => {
  it("returns 1–100 for ROUNDS", () => {
    expect(tuodDurationBounds("ROUNDS")).toEqual({ min: 1, max: 100 });
  });
  it("returns 3–30 for MINUTES", () => {
    expect(tuodDurationBounds("MINUTES")).toEqual({ min: 3, max: 30 });
  });
});

describe("clampTuodDuration", () => {
  it("leaves an in-range integer unchanged", () => {
    expect(clampTuodDuration("ROUNDS", 10)).toEqual({
      value: 10,
      clamped: false,
    });
  });
  it("floors a non-integer then clamps", () => {
    expect(clampTuodDuration("ROUNDS", 10.9)).toEqual({
      value: 10,
      clamped: true,
    });
  });
  it("clamps above max", () => {
    expect(clampTuodDuration("ROUNDS", 150)).toEqual({
      value: 100,
      clamped: true,
    });
    expect(clampTuodDuration("MINUTES", 45)).toEqual({
      value: 30,
      clamped: true,
    });
  });
  it("clamps below min, NaN, and non-finite to min", () => {
    expect(clampTuodDuration("ROUNDS", 0)).toEqual({
      value: 1,
      clamped: true,
    });
    expect(clampTuodDuration("MINUTES", 1)).toEqual({
      value: 3,
      clamped: true,
    });
    expect(clampTuodDuration("ROUNDS", Number.NaN)).toEqual({
      value: 1,
      clamped: true,
    });
    expect(
      clampTuodDuration("ROUNDS", Number.POSITIVE_INFINITY),
    ).toEqual({
      value: 1,
      clamped: true,
    });
  });

  it("clamps what x-model.number actually produces for a blank or unparseable field", () => {
    expect(clampTuodDuration("ROUNDS", null)).toEqual({
      value: 1,
      clamped: true,
    });
    expect(clampTuodDuration("MINUTES", "abc")).toEqual({
      value: 3,
      clamped: true,
    });
    expect(clampTuodDuration("ROUNDS", undefined)).toEqual({
      value: 1,
      clamped: true,
    });
  });
});

describe("tuodDurationClampNotice", () => {
  it("returns the allowed-range copy per mode", () => {
    expect(tuodDurationClampNotice("ROUNDS")).toBe(
      "Allowed range: 1–100 rounds",
    );
    expect(tuodDurationClampNotice("MINUTES")).toBe(
      "Allowed range: 3–30 minutes",
    );
  });
});
```

- [ ] **Step 2: Run and confirm it fails**

```bash
cd app && npx vitest run tests/lib/game/tuod-duration.test.ts
```

Expected: FAIL — `@lib/game/tuod-duration` exports `clampTuodRounds`/`tuodRoundsBounds`/`tuodRoundsClampNotice` today, not the type-aware names this test imports.

- [ ] **Step 3: Rewrite the helper**

Replace the full contents of `app/src/lib/game/tuod-duration.ts`:

```ts
import type { TuodDurationType } from "./types";

/**
 * `duration_value` bounds by mode, identical to
 * `score-training-duration.ts`'s own bounds: ROUNDS 1..100, MINUTES 3..30.
 */
export function tuodDurationBounds(type: TuodDurationType): {
  min: number;
  max: number;
} {
  return type === "ROUNDS" ? { min: 1, max: 100 } : { min: 3, max: 30 };
}

/**
 * Floors finite numbers, then clamps into the mode's inclusive bounds.
 * Non-finite / non-number inputs clamp to the mode minimum.
 */
export function clampTuodDuration(
  type: TuodDurationType,
  value: unknown,
): { value: number; clamped: boolean } {
  const { min, max } = tuodDurationBounds(type);
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

export function tuodDurationClampNotice(type: TuodDurationType): string {
  return type === "ROUNDS"
    ? "Allowed range: 1–100 rounds"
    : "Allowed range: 3–30 minutes";
}
```

- [ ] **Step 4: Run and confirm it passes**

```bash
cd app && npx vitest run tests/lib/game/tuod-duration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/tuod-duration.ts app/tests/lib/game/tuod-duration.test.ts
git commit -m "$(cat <<'EOF'
feat(tuod): generalize duration helper to ROUNDS and MINUTES

Solo TUOD setup is about to make MINUTES editable too, so the clamp
helper needs both modes' bounds, not just ROUNDS.
EOF
)"
```

---

### Task 3: Setup factory — `selectMode`, unconditional clamp/override

**Files:**

- Modify: `app/src/lib/game/types.ts:64-105` (`TuodSetupContext`)
- Modify: `app/src/lib/game/tuod-setup.data.ts` (full file)
- Test: `app/tests/lib/game/tuod-setup.data.test.ts`

**Interfaces:**

- Consumes: `clampTuodDuration`, `tuodDurationClampNotice` from Task 2's `tuod-duration.ts`
- Produces: `tuodSetup().selectMode(type: TuodDurationType): void` — new; `start()` now always sends `overrides: { duration_value }`, dropping the old `overrideValue: number | null` guest-only branch — no other task depends on this signature, but it changes `start()`'s observable POST payload for solo sessions

- [ ] **Step 1: Add `$watch` and `selectMode` to `TuodSetupContext`**

In `app/src/lib/game/types.ts`, replace the `TuodSetupContext` type (lines 64-105) — this makes `selectMode` and `$watch` typed the same way `ScoreTrainingSetupContext` already has them:

```ts
export type TuodSetupContext = {
  presets: ConfigurationPresetData[];
  durationType: TuodDurationType;
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
    callback: (value: TuodDurationType) => void,
  ): void;
  init(this: TuodSetupContext): Promise<void>;
  reconcile(
    this: TuodSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: TuodSetupContext): Promise<void>;
  continueSession(this: TuodSetupContext): void;
  abandonSession(this: TuodSetupContext): Promise<void>;
  selectMode(this: TuodSetupContext, type: TuodDurationType): void;
  presetForMode(
    this: TuodSetupContext,
    type: TuodDurationType,
  ): ConfigurationPresetData | undefined;
  addGuest(this: TuodSetupContext): void;
  removeGuest(this: TuodSetupContext, index: number): void;
  forceRoundsIfGuested(this: TuodSetupContext): void;
  start(this: TuodSetupContext): Promise<void>;
};
```

- [ ] **Step 2: Write the failing setup factory tests**

In `app/tests/lib/game/tuod-setup.data.test.ts`:

Add a `describe("selectMode", ...)` block after the `describe("presetForMode", ...)` block (after line 192, before `describe("start", ...)`):

```ts
  describe("selectMode", () => {
    it("switches mode, resets durationValue to that mode's preset default, and clears clampNotice", () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        durationValue: 25,
        clampNotice: "Allowed range: 1–100 rounds",
      });

      setup.selectMode("MINUTES");

      expect(setup.durationType).toBe("MINUTES");
      expect(setup.durationValue).toBe(10);
      expect(setup.clampNotice).toBe("");
    });

    it("falls back to the literal default when no preset matches the mode", () => {
      const setup = createSetup({
        presets: [ROUND_PRESET],
        durationType: "ROUNDS",
      });

      setup.selectMode("MINUTES");

      expect(setup.durationValue).toBe(10);
    });
  });
```

Replace the existing `"does not override duration_value for a solo session"` test (lines 393-418) — solo sessions now clamp and override too, exactly like guest sessions:

```ts
    it("clamps and overrides duration_value for a solo session too", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "ROUNDS",
        durationValue: 25,
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
          config: {
            source: "template",
            templateRef: "tmpl-rounds",
            overrides: { duration_value: 25 },
          },
        }),
      );
    });

    it("clamps an out-of-range typed value and sets a notice for a solo MINUTES session", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "MINUTES",
        durationValue: 45,
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

      expect(setup.durationValue).toBe(30);
      expect(setup.clampNotice).toBe("Allowed range: 3–30 minutes");
    });
```

Also update the first `"creates a session from the selected preset's template, unmodified"` test (lines 195-239): since `start()` now always overrides, this session create call gains an `overrides` key. Rename and adjust it:

```ts
    it("creates a session from the selected preset's template, with the (unclamped) typed value as override", async () => {
      const setup = createSetup({
        presets: [ROUND_PRESET, MINUTES_PRESET],
        durationType: "MINUTES",
        durationValue: 10,
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
      const locationSpy = { href: "" };
      vi.stubGlobal("location", locationSpy);

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith({
        gameTypeKey: "TUOD",
        rulesetVersionKey: "TUOD_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
        config: {
          source: "template",
          templateRef: "tmpl-minutes",
          overrides: { duration_value: 10 },
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-minutes",
          configSnapshot: expect.objectContaining({
            startingTarget: 41,
            finishBonus: 10,
            missPenalty: 1,
            durationType: "MINUTES",
            durationValue: 10,
            maxDartsPerTurn: 3,
          }),
        }),
      );
      expect(locationSpy.href).toBe("/games/tuod/play");
    });
```

- [ ] **Step 3: Run and confirm the new/changed tests fail**

```bash
cd app && npx vitest run tests/lib/game/tuod-setup.data.test.ts
```

Expected: FAIL — `selectMode` doesn't exist yet, and today's `start()` only overrides `duration_value` when `guests.length > 0`, so the solo-session override assertions fail.

- [ ] **Step 4: Rewrite `tuod-setup.data.ts`**

Replace the full contents of `app/src/lib/game/tuod-setup.data.ts`:

```ts
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
import { toSnapshot } from "@lib/game/rulesets/config-codec";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { addTypedGuest } from "@lib/game/guest-list";
import {
  clampTuodDuration,
  tuodDurationClampNotice,
} from "@lib/game/tuod-duration";
import {
  participantsFromGuests,
  resolveSessionModePair,
  startSessionInput,
} from "@lib/game/session-mode-resolution";
import type { TuodDurationType, TuodSetupContext } from "./types";

const GAME_TYPE_KEY = "TUOD";
const RULESET_VERSION_KEY = "TUOD_V1";

const FALLBACK_DURATION: Record<TuodDurationType, number> = {
  ROUNDS: 10,
  MINUTES: 10,
};

/**
 * Reads `duration_value` off a preset's `configuration`, which the API types
 * as `Record<string, unknown>`. Returns undefined when the key is absent or
 * not a number, so callers fall back to `FALLBACK_DURATION`. Mirrors
 * `score-training-setup.data.ts`'s `durationValueOf`.
 */
function durationValueOf(preset: ConfigurationPresetData | undefined) {
  const raw = preset?.configuration?.duration_value;
  return typeof raw === "number" ? raw : undefined;
}

export function tuodSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    durationType: "ROUNDS" as TuodDurationType,
    durationValue: FALLBACK_DURATION.ROUNDS as number | string | null,
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

    async init(this: TuodSetupContext) {
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
        this.durationType = "ROUNDS";
        this.durationValue =
          durationValueOf(this.presetForMode("ROUNDS")) ??
          FALLBACK_DURATION.ROUNDS;
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

    presetForMode(this: TuodSetupContext, type: TuodDurationType) {
      return this.presets.find((p) => {
        const cfg = p.configuration as { duration_type?: string } | null;
        return cfg?.duration_type === type;
      });
    },

    selectMode(this: TuodSetupContext, type: TuodDurationType) {
      this.durationType = type;
      this.durationValue =
        durationValueOf(this.presetForMode(type)) ?? FALLBACK_DURATION[type];
      this.clampNotice = "";
    },

    addGuest(this: TuodSetupContext) {
      if (addTypedGuest(this)) this.forceRoundsIfGuested();
    },

    removeGuest(this: TuodSetupContext, index: number) {
      this.guests.splice(index, 1);
    },

    /**
     * A 1v1 match needs a fixed round count both seats share, not a
     * wall-clock timer running through alternating turns — see
     * `2026-08-22-single-opponent-seat-remaining-engines-design.md`. Once a
     * guest is added, TIMED (MINUTES) is locked back to ROUNDS.
     */
    forceRoundsIfGuested(this: TuodSetupContext) {
      if (this.guests.length > 0) this.durationType = "ROUNDS";
    },

    async reconcile(
      this: TuodSetupContext,
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

    async retryReconciliation(this: TuodSetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: TuodSetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/tuod/play";
    },

    async abandonSession(this: TuodSetupContext) {
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

    async start(this: TuodSetupContext) {
      if (this.loading) return;
      const preset = this.presetForMode(this.durationType);
      if (!preset) {
        this.error = "Could not find a preset for this mode.";
        return;
      }

      const { value, clamped } = clampTuodDuration(
        this.durationType,
        this.durationValue,
      );
      this.durationValue = value;
      this.clampNotice = clamped ? tuodDurationClampNotice(this.durationType) : "";

      this.loading = true;
      this.error = "";
      try {
        const wire = {
          ...(preset.configuration as Record<string, unknown>),
          duration_value: value,
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
            overrides: { duration_value: value },
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
        globalThis.location.href = "/games/tuod/play";
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

Note what dropped versus today's file: `FALLBACK_ROUNDS`, the `overrideValue: number | null` local in `start()`, and the `guests.length > 0` conditional around clamping — `start()` now always clamps and always overrides, for both solo and 1v1.

- [ ] **Step 5: Run and confirm all setup tests pass**

```bash
cd app && npx vitest run tests/lib/game/tuod-setup.data.test.ts
```

Expected: PASS — including the untouched guest-path tests (`"overrides duration_value with the clamped rounds count once a guest is added"`, `"clamps an out-of-range typed rounds count..."`), since guest sessions already exercised this same clamp/override path and nothing about that path changed.

- [ ] **Step 6: Run the type check**

```bash
cd app && npx astro check
```

Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/game/types.ts \
  app/src/lib/game/tuod-setup.data.ts \
  app/tests/lib/game/tuod-setup.data.test.ts
git commit -m "$(cat <<'EOF'
feat(tuod): make solo setup duration editable

Solo TUOD sessions now clamp and override duration_value the same
way a 1v1 session already does, with a selectMode() that resets the
value to the new mode's preset default on toggle, mirroring Score
Training's setup factory.
EOF
)"
```

---

### Task 4: Setup form — editable field in the solo branch

**Files:**

- Modify: `app/src/components/layout/games/setup/TuodSetupForm.astro` (full file)

**Interfaces:**

- Consumes: `durationType`, `durationValue`, `clampNotice`, `selectMode` (bound via `x-model`/`@input`, not called directly) from Task 3's `tuodSetup()`
- Produces: nothing new for other tasks — this is the leaf UI

- [ ] **Step 1: Rewrite the form**

Replace the full contents of `app/src/components/layout/games/setup/TuodSetupForm.astro`:

```astro
---
// Components
import Input from "@components/forms/Input.astro";
import Toggle from "./Toggle.astro";
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import SettingSectionShell from "./SettingSectionShell.astro";
import UserSection from "./UserSection.astro";

// Data
const durationOpts = [
  { value: "ROUNDS", label: "Rounds" },
  { value: "MINUTES", label: "Time" },
];

const infoSection = {
  title: "Ten Up One Down rules",
  description:
    "Start at 41. One visit (3 darts) to check out on a double. Check out and the next target climbs +10; miss and it drops -1, floored at 2 — the lowest target any double can finish.",
};
---

<SetupShell title="Ten Up One Down">
  <UserSection allowGuests />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />
  <SettingSectionShell>
    <template x-if="guests.length === 0">
      <div class="contents">
        <Toggle
          orientation="horizontal"
          options={durationOpts}
          x-model="durationType"
          class="w-full"
        />
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
      </div>
    </template>
    <template x-if="guests.length > 0">
      <div class="contents">
        <Input
          id="durationValue"
          name="durationValue"
          type="text"
          inputmode="numeric"
          placeholder="Number of rounds"
          x-model.number="durationValue"
          @input="clampNotice = ''"
          class="glass border-tab-border rounded-full mt-4"
        />
        <p
          class="text-sm text-muted-foreground px-4 py-0"
          role="status"
          x-show="clampNotice"
          x-text="clampNotice"
          x-cloak
        >
        </p>
      </div>
    </template>
  </SettingSectionShell>
</SetupShell>
```

Only two things changed from the current file: `durationOpts`' labels ("10 Rounds"/"10 Minutes" → "Rounds"/"Time", matching `ScoreTrainingSetupForm.astro`'s `formatOpts`), and the solo branch (`x-if="guests.length === 0"`) gaining the `Input` + label + clamp-notice block. The guest branch is untouched.

- [ ] **Step 2: Manually verify in the browser**

No Vitest coverage exists for `.astro` markup (D101 — branching logic stays inline, untested by design). Verify by hand:

```bash
cd app && npm run dev -- --background
```

Navigate to `/games/tuod/setup`. Confirm:
- Solo (no guest added): the Rounds/Time toggle now shows an editable numeric field beneath it, labeled "Rounds" or "Minutes" depending on the toggle, with the same "glass" pill styling Score Training's setup uses.
- Typing a value and tapping "Rounds"/"Time" resets the field to that mode's default (10) and clears any clamp notice.
- Adding a guest still shows only the rounds field (no toggle) — unchanged from before.

```bash
cd app && npx astro dev stop
```

- [ ] **Step 3: Run the Astro/style gates**

```bash
cd /home/user/dart-analytics
bash scripts/check-astro-conventions.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-style-tokens.sh
```

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/layout/games/setup/TuodSetupForm.astro
git commit -m "$(cat <<'EOF'
feat(tuod): editable duration field in solo setup

Solo setup now shows the same Input + clamp-notice pattern Score
Training's setup form has, instead of a locked preset pick. Toggle
labels changed from preset names to mode names to match.
EOF
)"
```

---

### Task 5: Play again carries the custom duration

**Files:**

- Modify: `app/src/lib/game/tuod-play.data.ts:578-653`
- Test: `app/tests/lib/game/tuod-play.data.test.ts`

**Interfaces:**

- Consumes: `config.durationValue` off the live `configSnapshot` (already in scope inside `playAgain()`)
- Produces: `playAgain()`'s `createSession` payload now carries `config.overrides.duration_value` — no other task depends on this

- [ ] **Step 1: Write the failing tests**

In `app/tests/lib/game/tuod-play.data.test.ts`, inside `describe("Completion sequence", ...)`, replace the existing `"ST4: playAgain reuses the original template, no overrides"` test (starting at line 655) with:

```ts
    it("ST4: playAgain reuses the original template with the session's own duration as an override", async () => {
      const play = makePlay({
        idempotencyKey: "old-key",
        timerRemainingMs: 1000,
        timerExpired: true,
      });
      play.completionStatus = "succeeded";
      play.finished = true;
      play.resultsSnapshot = {
        target: 51,
        attempts: 1,
        successes: 1,
        failures: 0,
        winningSideKey: null,
        status: "COMPLETE",
      };
      const { seats: _priorSeats, ...priorRulesetConfig } =
        play.$store.game.configSnapshot!;

      vi.mocked(createSession).mockResolvedValue({
        sessionId: "new-session",
        participants: [
          {
            ref: "new-participant",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
        ],
      } as Awaited<ReturnType<typeof createSession>>);

      await play.playAgain();

      expect(createSession).toHaveBeenCalledWith({
        gameTypeKey: "TUOD",
        rulesetVersionKey: "TUOD_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
        config: {
          source: "template",
          templateRef: "tpl-1",
          overrides: { duration_value: 20 },
        },
      });
      expect(play.$store.game.sessionId).toBe("new-session");
      expect(play.$store.game.turns).toEqual([]);
      expect(play.$store.game.idempotencyKey).toBeNull();
      expect(play.$store.game.timerExpired).toBe(false);
      const { seats: _nextSeats, ...nextRulesetConfig } =
        play.$store.game.configSnapshot!;
      expect(nextRulesetConfig).toEqual(priorRulesetConfig);
      expect(play.finished).toBe(false);
      expect(play.completionStatus).toBe("pending");
      expect(play.resultsSnapshot).toBeNull();
      expect(play.hasActiveSession).toBe(true);
    });

    it("replays with the session's own round count, not the template default", async () => {
      const play = makePlay({ configSnapshot: rounds(25) });

      vi.mocked(createSession).mockResolvedValue({
        sessionId: "new-session",
        participants: [
          {
            ref: "new-participant",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
        ],
      } as Awaited<ReturnType<typeof createSession>>);

      await play.playAgain();

      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          config: {
            source: "template",
            templateRef: "tpl-1",
            overrides: { duration_value: 25 },
          },
        }),
      );
    });

    it("replays with the session's own minute count, not the template default", async () => {
      const play = makePlay({ configSnapshot: minutes(12) });

      vi.mocked(createSession).mockResolvedValue({
        sessionId: "new-session",
        participants: [
          {
            ref: "new-participant",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
        ],
      } as Awaited<ReturnType<typeof createSession>>);

      await play.playAgain();

      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          config: {
            source: "template",
            templateRef: "tpl-1",
            overrides: { duration_value: 12 },
          },
        }),
      );
    });
```

`makePlay`'s default `configSnapshot` is `rounds(20)` (see the `describe("Completion sequence", ...)` setup at line 543), which is why the rewritten ST4 test expects `duration_value: 20`.

- [ ] **Step 2: Run and confirm the new/changed tests fail**

```bash
cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts -t "playAgain"
```

Expected: FAIL — today's `playAgain()` sends `config: { source: "template", templateRef }` with no `overrides` key at all, so every assertion expecting `overrides: { duration_value: ... }` fails.

- [ ] **Step 3: Fix `playAgain()`**

In `app/src/lib/game/tuod-play.data.ts`, replace the `playAgain()` doc comment and its `createSession` call (lines 578-614):

```ts
    /**
     * Replays with the session's own duration as an override — the same
     * carry-over `score-training-play.data.ts`'s `playAgain()` does. Without
     * it, a replayed custom-duration session would silently persist the
     * template's default `duration_value` instead of the value actually
     * played.
     */
    async playAgain(this: TuodPlayContext) {
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
            config: {
              source: "template",
              templateRef,
              overrides: { duration_value: config.durationValue },
            },
            participants: participantsFromSeats(config.seats),
          });
        } catch {
          this.playAgainError = "Could not start a new session. Try again.";
          return;
        }
```

Everything below this point in `playAgain()` (from `const seatedSnapshot = reseatSnapshot(...)` onward) is unchanged.

- [ ] **Step 4: Run and confirm the tests pass**

```bash
cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts
```

Expected: PASS, full file (not just the `-t "playAgain"` filter) — confirms nothing else in the 1300+-line suite regressed.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/tuod-play.data.ts app/tests/lib/game/tuod-play.data.test.ts
git commit -m "$(cat <<'EOF'
fix(tuod): playAgain carries the session's own duration

Replaying a custom-duration TUOD session previously persisted the
template's default duration_value instead of the value actually
played, the same bug Score Training's own playAgain() already had
fixed. Mirrors that fix exactly.
EOF
)"
```

---

### Task 6: Game-rules doc + full validation

**Files:**

- Modify: `docs/game-rules/rulesets/ten-up-one-down.md`

**Interfaces:**

- Consumes: nothing — documentation only
- Produces: nothing other tasks depend on

- [ ] **Step 1: Update the Config & presets table**

In `docs/game-rules/rulesets/ten-up-one-down.md`, replace the `## Config & presets (V1)` section's table (currently reading "Session length | 10 rounds *or* 10 minutes | Preset choice"):

```markdown
## Config & presets (V1)

Before play, a **config screen** shows the session config. Setup radios select the **mode** (Rounds / Time), not preset names.

| Setting           | V1 default          | On config screen (V1) |
| ----------------- | -------------------- | ---------------------- |
| Players           | Single player        | Shown, locked          |
| Start target      | 41                    | Shown, locked           |
| Darts per attempt | 3 (one visit)         | Shown, locked           |
| Out               | Double out            | Shown, locked           |
| On success        | +10 to next target    | Shown, locked           |
| On failure        | −1 to next target     | Shown, locked           |
| Mode              | Rounds or Time        | Toggle                  |
| Rounds (N)        | Default **10** (min **1**, max **100**) | Editable when Rounds |
| Minutes           | Default **10** (min **3**, max **30**)  | Editable when Time   |
```

- [ ] **Step 2: Update the Objective section's 1v1 note**

Replace the existing sentence in `## Objective` (currently: "The round count is player-configurable (1–100) rather than fixed at the 10-round preset. `<!-- 2026-08-26 -->`") to also reflect that solo mode is now editable too — add one sentence before it, keeping the existing 1v1 sentence and its date comment as-is:

```markdown
- **1v1:** ROUNDS mode only. Both seats play the full round budget; highest target reached wins (score-compare, ties possible). <!-- 2026-08-22 --> The round count is player-configurable (1–100) rather than fixed at the 10-round preset. <!-- 2026-08-26 --> Solo play is configurable the same way: either mode's `duration_value` is player-typed (ROUNDS 1–100, MINUTES 3–30), not a locked preset pick. <!-- 2026-08-29 -->
```

- [ ] **Step 3: Run the doc gates**

```bash
cd /home/user/dart-analytics
bash scripts/check-doc-links.sh
bash scripts/check-context-map.sh
```

Expected: both PASS (this doc lives outside `docs/architecture/`, so these gates are a formality here — confirming they still pass after the edit, not that they specifically cover this file).

- [ ] **Step 4: Full validation for every touched area**

```bash
cd app
npm test
npx astro check
cd /home/user/dart-analytics
bash scripts/check-refinement-coverage.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-style-tokens.sh
bash scripts/check-no-inline-comments.sh
bash scripts/check-type-barrels.sh
bash scripts/check-file-locations.sh
bash scripts/check-test-coverage.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-map.sh
```

Expected: all green. This list matches what the plan touches — three modified `.ts` lib files plus one modified type file (`check-no-inline-comments.sh`, `check-type-barrels.sh`, `check-file-locations.sh`, `check-test-coverage.sh`), one `.astro` file (conventions, class composition, style tokens), a new refinement contract entry (`check-refinement-coverage.sh`), and a doc edit (`check-doc-links.sh`, `check-context-map.sh`). The `run-all-gates` skill dispatches this same set by changed area and is the preferred way to run it. If the DB env is ready, `npm run validate:app` from `app/` covers the Vitest + `astro check` portion in one call.

- [ ] **Step 5: Commit**

```bash
git add docs/game-rules/rulesets/ten-up-one-down.md
git commit -m "$(cat <<'EOF'
docs(game-rules): TUOD solo duration is now editable

EOF
)"
```

- [ ] **Step 6: Before claiming done**

Run the `context-maintenance` skill. What it needs to cover here:

- `DECISIONS.md` row (routed to `decisions/game-engine.md`) for the durable decision: TUOD solo setup's duration is now player-typed within bounds, not a locked preset pick, matching Score Training — supersedes nothing (this is TUOD's first duration-editability decision; Score Training's own 07-31 decision is a separate row).
- Confirm no context-map file-inventory row needs a new entry — every file this plan touched already exists in the inventory (no new files were created).
- Refresh the knowledge graph (`bash scripts/refresh-graph.sh` or let CI's `graph.yml` do it on merge, per `app/CLAUDE.md`'s Knowledge Graph section).
- Confirm `FINDINGS.md` has no new entries required — this plan's scope covers everything the spec identified; nothing was noticed and deferred.

Then offer `finishing-a-development-branch`.

---

## Spec coverage checklist

| Spec requirement | Task |
| ----------------- | ---- |
| `TuodConfig` `superRefine`, ROUNDS 1–100 / MINUTES 3–30 | 1 |
| Refinement contract entry + named coverage test | 1 |
| Validator bound coverage | 1 |
| Type-aware duration helper (`tuodDurationBounds`/`clampTuodDuration`/`tuodDurationClampNotice`) | 2 |
| `selectMode` + `$watch("durationType", ...)` in setup factory | 3 |
| `start()` always clamps + overrides `duration_value` (solo and 1v1 alike) | 3 |
| `FALLBACK_DURATION` keeps TUOD's own 10/10 defaults | 3 |
| Solo setup form gains `Input` + label + clamp notice; mode-only Toggle labels | 4 |
| `playAgain()` sends `overrides: { duration_value }` | 5 |
| Game-rules doc reflects editable value + bounds | 6 |
| 1v1 behavior untouched | 3 (verified via unchanged guest-path tests) |
| No new ruleset version, no migration, no seed change | Global Constraints (no task modifies `database/`) |
