# Score Training Configurable Duration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score Training setup lets the user pick Rounds vs Timed and type a duration value; sessions create via template + `duration_value` override; bounds become ROUNDS 1–100 / MINUTES 3–30; minutes preset defaults to 5. Play again carries the custom duration.

**Architecture:** Keep `SCORE_TRAINING_V1`. Pure clamp helpers live beside the setup factory. Setup radios bind `durationType`; an `Input.astro` field binds `durationValue` with `x-model.number`. `start()` resolves the seeded preset by `duration_type`, clamps, then `POST`s `source: "template"` with `overrides: { duration_value }`, merging the override into the client `configSnapshot` before `toSnapshot`. `playAgain()` sends the same override from the live snapshot. Schema `superRefine` + refinement contract + seed `0002`/`0004` + the seed runner + the seeded-preset mirror test move in lockstep.

**Revised 2026-07-31** after validating the spec against the codebase; the spec's Revision log lists the eight corrections this plan now carries.

**Tech Stack:** Astro, Alpine.js, Zod (`ScoreTrainingConfig`), Vitest, PostgreSQL seeds (dbmate), existing `createSession` / `ConfigInput.overrides`.

**Spec:** `docs/superpowers/specs/2026-07-31-score-training-configurable-duration-design.md`

## Global Constraints

- Score Training only — do not change TUOD duration bounds or TUOD setup
- Ruleset key stays `SCORE_TRAINING_V1` (no V2 ruleset)
- Session create: `source: "template"` + `overrides: { duration_value }` only (not full inline config)
- Bounds: ROUNDS **1–100**, MINUTES **3–30**
- Mode switch resets value to that mode’s preset default (fallback 10 / 5); clears `clampNotice`
- Invalid input: clamp then start; notice only when a clamp occurred
- Clamp notice copy: `Allowed range: 1–100 rounds` / `Allowed range: 3–30 minutes`
- Missing mode preset error: `Could not find a preset for this mode.`
- Clear `clampNotice` with `@input` on the field — **never** an Alpine `$watch` on `durationValue`; `start()` writes the clamped value back before setting the notice, and a `$watch` fires after that mutation and would blank it
- Duration field uses `Input.astro`, never a raw `<input class="input">` (07-Style-Guide.md; bare `.input` lacks border/padding/sizing)
- `durationValue` is typed `number | string | null` — `x-model.number` yields `null` for an empty field and the raw string for unparseable text
- No `$persist` of mode/value; no engine changes; no new API routes
- Play page changes are limited to `playAgain()`'s create payload — no play UI, no engine, no timer changes
- Worktrees forbidden — dedicated branch in the main working copy
- Do not commit unless the user asks (plan steps still list commit commands for when they do)
- Tests under `app/tests/` only; no colocated tests; no re-pointing bound tests at unrelated inputs (D148)
- No inline `//` comments inside `app/src/**/*.ts` function bodies — the `// …` lines inside code snippets below are **plan annotations only**; do not copy them into source (`scripts/check-no-inline-comments.sh` fails on them)

## File Structure

| File                                                                          | Responsibility                                                  |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `app/src/lib/game/rulesets/types.ts`                                          | `ScoreTrainingConfig` duration bounds in `superRefine`          |
| `app/src/lib/game/rulesets/refinement-contract.ts`                            | Accept/reject probes for new floors/ceilings + blind-spot JSDoc |
| `scripts/check-refinement-coverage.sh`                                        | Header comment: MINUTES floor now load-bearing                  |
| `app/tests/lib/game/rulesets/types.test.ts`                                   | Direct schema bound tests                                       |
| `app/tests/services/rulesets/score-training/score-training.validator.test.ts` | Validator validateConfig bound tests                            |
| `app/tests/services/session.service.test.ts`                                  | createSession inline bound tests                                |
| `app/src/lib/game/score-training-duration.ts`                                 | Pure bounds + clamp + notice helpers                            |
| `app/tests/lib/game/score-training-duration.test.ts`                          | Clamp helper unit tests                                         |
| `app/src/lib/game/score-training-setup.data.ts`                               | Mode/value state + start with overrides                         |
| `app/src/lib/game/types.ts`                                                   | `ScoreTrainingDurationType` + `ScoreTrainingSetupContext` shape |
| `app/tests/lib/game/score-training-setup.data.test.ts`                        | Setup factory behavior                                          |
| `app/src/lib/game/score-training-play.data.ts`                                | `playAgain()` sends `duration_value` override                   |
| `app/tests/lib/game/score-training-play.data.test.ts`                         | Play-again override coverage                                    |
| `app/src/components/layout/games/SetupSessionForm.astro`                      | Mode radios + `Input.astro` duration field + clamp notice       |
| `database/seeds/0002_default_templates.sql`                                   | Minutes preset → 5 on fresh seed                                |
| `database/seeds/0004_score_training_minutes_preset.sql`                       | UPDATE existing minutes preset row                              |
| `app/scripts/seed.ts`                                                         | Repair stale seed paths; register `0003` + `0004`               |
| `app/tests/lib/game/rulesets/seeded-presets.test.ts`                          | Mirror of seeded presets — MINUTES entry → 5                    |
| `database/README.md`                                                          | Register seed `0004` in apply order                             |
| `docs/architecture/05-Database/10-Database-Agent-Guide.md`                    | “Current seeds” list + Seed Checklist idempotency wording       |
| `docs/architecture/00-Context-Map.md`                                         | Seed inventory rows gain `0004`                                 |
| `docs/game-rules/rulesets/score-training.md`                                  | Non-canonical rules note for timed + bounds                     |

---

### Task 1: Score Training duration bounds (schema + probes + tests)

**Files:**

- Modify: `app/src/lib/game/rulesets/types.ts` (ScoreTrainingConfig `superRefine`)
- Modify: `app/src/lib/game/rulesets/refinement-contract.ts`
- Modify: `scripts/check-refinement-coverage.sh` (header comment only)
- Modify: `app/tests/lib/game/rulesets/types.test.ts`
- Modify: `app/tests/services/rulesets/score-training/score-training.validator.test.ts`
- Modify: `app/tests/services/session.service.test.ts`

**Interfaces:**

- Consumes: existing `ScoreTrainingConfig` / `scoreTrainingValidator.validateConfig` / `createSession`
- Produces: ROUNDS accept 1..100, reject 0 and 101; MINUTES accept 3..30, reject 2 and 31 (and keep reject 0 / above-max as today)

- [ ] **Step 0: Branch**

```bash
cd /Users/levi/Development/dart-analytics
git checkout main
git pull
git checkout -b feature/score-training-configurable-duration
```

If already on a clean dedicated branch for this work, skip.

- [ ] **Step 1: Retarget failing schema tests first (RED)**

In `app/tests/lib/game/rulesets/types.test.ts`, replace the Score Training bounds describe body with:

```ts
describe("ScoreTrainingConfig duration_value bounds", () => {
  it("rejects duration_value: 0 for ROUNDS, one below the floor", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "ROUNDS",
      duration_value: 0,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(false);
  });

  it("accepts duration_value: 1 for ROUNDS, the floor", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "ROUNDS",
      duration_value: 1,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts duration_value: 100 for ROUNDS, the ceiling", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "ROUNDS",
      duration_value: 100,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects duration_value: 101 for ROUNDS, one past the ceiling", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "ROUNDS",
      duration_value: 101,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(false);
  });

  it("rejects duration_value: 2 for MINUTES, one below the floor", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "MINUTES",
      duration_value: 2,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(false);
  });

  it("accepts duration_value: 3 for MINUTES, the floor", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "MINUTES",
      duration_value: 3,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts duration_value: 30 for MINUTES, the ceiling", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "MINUTES",
      duration_value: 30,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(true);
  });

  it("rejects duration_value: 31 for MINUTES, one past the ceiling", () => {
    const result = ScoreTrainingConfig.safeParse({
      duration_type: "MINUTES",
      duration_value: 31,
      max_darts_per_turn: 3,
    });
    expect(result.success).toBe(false);
  });
});
```

Also update the parallel cases in:

- `app/tests/services/rulesets/score-training/score-training.validator.test.ts` (same numbers via `validateConfig`)
- `app/tests/services/session.service.test.ts` (inline createSession accept/reject cases currently using 50/51/180/181 → 100/101/30/31; add or retarget a MINUTES floor reject at 2 / accept at 3 if those tests only cover ceilings)

- [ ] **Step 2: Run tests — expect RED on new ceilings/floors**

```bash
cd /Users/levi/Development/dart-analytics/app
npx vitest run tests/lib/game/rulesets/types.test.ts tests/services/rulesets/score-training/score-training.validator.test.ts tests/services/session.service.test.ts
```

Expected: FAIL — e.g. `duration_value: 100` rejected and/or `duration_value: 50` still treated as ceiling in old probes if any remain; `180` still accepted until schema changes (tests that expect 100/30/reject 2 should fail against old schema).

- [ ] **Step 3: Update schema + refinement contract (GREEN)**

In `app/src/lib/game/rulesets/types.ts`, change the JSDoc and `superRefine` to:

```ts
/**
 * `duration_value` is bounded by `duration_type`: a ROUNDS session tops out
 * at 100 rounds, a MINUTES session at 30 minutes (floor 3). The bound is
 * conditional so it cannot be expressed with `.min()`/`.max()` on the field
 * alone — it needs a whole-object refinement that reads `duration_type`
 * alongside `duration_value`.
 */
export const ScoreTrainingConfig = z
  .object({
    duration_type: z.enum(["ROUNDS", "MINUTES"]),
    duration_value: z.number().int().min(1),
    max_darts_per_turn: z.number().int().min(1).max(3),
    max_visit_score: z.number().int().default(180),
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

In `refinement-contract.ts`, update the comment (`ROUNDS 1..100, MINUTES 3..30`) and probes:

```ts
accept: [
  { label: "duration_value 1 for ROUNDS, the floor", config: { ...scoreTrainingRoundsBase, duration_value: 1 } },
  { label: "duration_value 100 for ROUNDS, the ceiling", config: { ...scoreTrainingRoundsBase, duration_value: 100 } },
],
reject: [
  { label: "duration_value 0 for ROUNDS, one below the floor", config: { ...scoreTrainingRoundsBase, duration_value: 0 } },
  { label: "duration_value 101 for ROUNDS, one past the ceiling", config: { ...scoreTrainingRoundsBase, duration_value: 101 } },
],
// MINUTES:
accept: [
  { label: "duration_value 3 for MINUTES, the floor", config: { ...scoreTrainingMinutesBase, duration_value: 3 } },
  { label: "duration_value 30 for MINUTES, the ceiling", config: { ...scoreTrainingMinutesBase, duration_value: 30 } },
],
reject: [
  { label: "duration_value 2 for MINUTES, one below the floor", config: { ...scoreTrainingMinutesBase, duration_value: 2 } },
  { label: "duration_value 31 for MINUTES, one past the ceiling", config: { ...scoreTrainingMinutesBase, duration_value: 31 } },
],
```

Keep `scoreTrainingMinutesBase.duration_value` at a valid in-range default when spreading (e.g. set base `duration_value: 5` for minutes base, or always override in each probe).

- [ ] **Step 3b: Correct both blind-spot notes (the MINUTES floor is now load-bearing)**

The JSDoc above `scoreTrainingContract` in `refinement-contract.ts` and the header comment in `scripts/check-refinement-coverage.sh` both state that floor probes prove nothing, because the field-level `.min(1)` rejects `duration_value: 0` whether or not the refinement's floor survives — so only ceiling probes pin the refinement.

With a MINUTES floor of **3** that stops being true for MINUTES: `duration_value: 2` clears `.min(1)` and is rejected **only** by the `superRefine`, making the new `duration_value 2 for MINUTES` reject probe the first load-bearing floor probe in the contract. ROUNDS keeps floor 1 and stays redundant.

Rewrite both notes to say exactly that — ROUNDS floor still unprotected, MINUTES floor now covered on both sides. Do not delete the blind-spot sections; they remain true for ROUNDS, and understating coverage is as stale as overstating it.

- [ ] **Step 4: Re-run tests + refinement coverage**

```bash
cd /Users/levi/Development/dart-analytics/app
npx vitest run tests/lib/game/rulesets/types.test.ts tests/services/rulesets/score-training/score-training.validator.test.ts tests/services/session.service.test.ts
cd /Users/levi/Development/dart-analytics
bash scripts/check-refinement-coverage.sh
```

Expected: all PASS / exit 0.

- [ ] **Step 5: Commit** (only if user asked to commit)

```bash
git add app/src/lib/game/rulesets/types.ts app/src/lib/game/rulesets/refinement-contract.ts \
  scripts/check-refinement-coverage.sh \
  app/tests/lib/game/rulesets/types.test.ts \
  app/tests/services/rulesets/score-training/score-training.validator.test.ts \
  app/tests/services/session.service.test.ts
git commit -m "$(cat <<'EOF'
fix(score-training): bound duration_value to 1–100 rounds / 3–30 minutes

EOF
)"
```

---

### Task 2: Pure duration clamp helpers

**Files:**

- Modify: `app/src/lib/game/types.ts` (declare `ScoreTrainingDurationType`)
- Create: `app/src/lib/game/score-training-duration.ts`
- Create: `app/tests/lib/game/score-training-duration.test.ts`

**Interfaces:**

- Consumes: `ScoreTrainingDurationType` from `./types`
- Produces:
  - `export type ScoreTrainingDurationType = "ROUNDS" | "MINUTES"` — **declared in `app/src/lib/game/types.ts`, not in the helper file**
  - `export function scoreTrainingDurationBounds(type: ScoreTrainingDurationType): { min: number; max: number }`
  - `export function clampScoreTrainingDuration(type: ScoreTrainingDurationType, value: unknown): { value: number; clamped: boolean }`
  - `export function scoreTrainingDurationClampNotice(type: ScoreTrainingDurationType): string`

**Type-barrel rule (`scripts/check-type-barrels.sh`, rule 1).** An `export type` may never sit in an implementation file — it belongs in that folder's `types.ts`. So `ScoreTrainingDurationType` is declared in `app/src/lib/game/types.ts` and imported into the helper with `import type { ScoreTrainingDurationType } from "./types";`. Consumers take the **functions** from `@lib/game/score-training-duration` directly (value imports are exempt from rules 3 and 4) and the **type** from a barrel: `./types` for files already inside `app/src/lib/game/` — which is every consumer here, matching the existing `import type { ScoreTrainingSetupContext } from "./types";` — or `@lib/types` from outside the area. Never `@lib/game/types`, which is a deep aliased type import.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  clampScoreTrainingDuration,
  scoreTrainingDurationBounds,
  scoreTrainingDurationClampNotice,
} from "@lib/game/score-training-duration";

describe("scoreTrainingDurationBounds", () => {
  it("returns 1–100 for ROUNDS", () => {
    expect(scoreTrainingDurationBounds("ROUNDS")).toEqual({ min: 1, max: 100 });
  });
  it("returns 3–30 for MINUTES", () => {
    expect(scoreTrainingDurationBounds("MINUTES")).toEqual({ min: 3, max: 30 });
  });
});

describe("clampScoreTrainingDuration", () => {
  it("leaves an in-range integer unchanged", () => {
    expect(clampScoreTrainingDuration("ROUNDS", 10)).toEqual({
      value: 10,
      clamped: false,
    });
  });
  it("floors a non-integer then clamps", () => {
    expect(clampScoreTrainingDuration("ROUNDS", 10.9)).toEqual({
      value: 10,
      clamped: true,
    });
  });
  it("clamps above max", () => {
    expect(clampScoreTrainingDuration("MINUTES", 45)).toEqual({
      value: 30,
      clamped: true,
    });
  });
  it("clamps below min, NaN, and non-finite to min", () => {
    expect(clampScoreTrainingDuration("MINUTES", 1)).toEqual({
      value: 3,
      clamped: true,
    });
    expect(clampScoreTrainingDuration("ROUNDS", Number.NaN)).toEqual({
      value: 1,
      clamped: true,
    });
    expect(
      clampScoreTrainingDuration("ROUNDS", Number.POSITIVE_INFINITY),
    ).toEqual({
      value: 1,
      clamped: true,
    });
  });

  it("clamps what x-model.number actually produces for a blank or unparseable field", () => {
    expect(clampScoreTrainingDuration("MINUTES", null)).toEqual({
      value: 3,
      clamped: true,
    });
    expect(clampScoreTrainingDuration("ROUNDS", "abc")).toEqual({
      value: 1,
      clamped: true,
    });
    expect(clampScoreTrainingDuration("ROUNDS", undefined)).toEqual({
      value: 1,
      clamped: true,
    });
  });
});

describe("scoreTrainingDurationClampNotice", () => {
  it("returns the allowed-range copy per mode", () => {
    expect(scoreTrainingDurationClampNotice("ROUNDS")).toBe(
      "Allowed range: 1–100 rounds",
    );
    expect(scoreTrainingDurationClampNotice("MINUTES")).toBe(
      "Allowed range: 3–30 minutes",
    );
  });
});
```

- [ ] **Step 2: Run — expect RED**

```bash
cd /Users/levi/Development/dart-analytics/app
npx vitest run tests/lib/game/score-training-duration.test.ts
```

Expected: FAIL — module not found / exports missing.

- [ ] **Step 3: Implement helpers**

First add to `app/src/lib/game/types.ts`:

```ts
export type ScoreTrainingDurationType = "ROUNDS" | "MINUTES";
```

Then `app/src/lib/game/score-training-duration.ts`:

```ts
import type { ScoreTrainingDurationType } from "./types";

export function scoreTrainingDurationBounds(type: ScoreTrainingDurationType): {
  min: number;
  max: number;
} {
  return type === "ROUNDS" ? { min: 1, max: 100 } : { min: 3, max: 30 };
}

/**
 * Floors finite numbers, then clamps into the mode's inclusive bounds.
 * Non-finite / non-number inputs clamp to the mode minimum.
 */
export function clampScoreTrainingDuration(
  type: ScoreTrainingDurationType,
  value: unknown,
): { value: number; clamped: boolean } {
  const { min, max } = scoreTrainingDurationBounds(type);
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

export function scoreTrainingDurationClampNotice(
  type: ScoreTrainingDurationType,
): string {
  return type === "ROUNDS"
    ? "Allowed range: 1–100 rounds"
    : "Allowed range: 3–30 minutes";
}
```

Notes:

- `clamped: clampedValue !== numeric` marks floor-only changes (10.9 → 10) as clamped, matching the spec table.
- `value: unknown` is deliberate and load-bearing, not defensive typing. Alpine's `x-model.number` returns the parsed number only when `parseFloat` succeeds: a blank field yields `null` and unparseable text yields the raw **string**, so `durationValue` genuinely is not always a number. The `typeof value === "number"` narrowing is what turns both into the mode minimum.

- [ ] **Step 4: Run — expect GREEN**

```bash
cd /Users/levi/Development/dart-analytics/app
npx vitest run tests/lib/game/score-training-duration.test.ts
```

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add app/src/lib/game/score-training-duration.ts app/tests/lib/game/score-training-duration.test.ts
git commit -m "$(cat <<'EOF'
feat(score-training): add duration clamp helpers for setup

EOF
)"
```

---

### Task 3: Setup factory — mode, clamp, template overrides

**Files:**

- Modify: `app/src/lib/game/types.ts` (`ScoreTrainingSetupContext`)
- Modify: `app/src/lib/game/score-training-setup.data.ts`
- Modify: `app/tests/lib/game/score-training-setup.data.test.ts`

**Interfaces:**

- Consumes: `clampScoreTrainingDuration`, `scoreTrainingDurationClampNotice`, `ScoreTrainingDurationType`; `createSession`; `toSnapshot`
- Produces: factory fields `durationType`, `durationValue`, `clampNotice`; methods `selectMode(type)`, `presetForMode(type)`, updated `start()` / `init()`

- [ ] **Step 1: Update context type**

Replace `ScoreTrainingSetupContext` fields in `app/src/lib/game/types.ts`:

```ts
export type ScoreTrainingSetupContext = {
  presets: ConfigurationPresetData[];
  durationType: ScoreTrainingDurationType;
  durationValue: number | string | null;
  clampNotice: string;
  loading: boolean;
  error: string;
  activeSession: SessionActiveData | null;
  showActiveSessionModal: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  $store: {
    game: {
      sessionId: string | null;
      startSession(input: unknown): void;
      reset(): void;
    };
  };
  init(this: ScoreTrainingSetupContext): Promise<void>;
  reconcile(
    this: ScoreTrainingSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: ScoreTrainingSetupContext): Promise<void>;
  continueSession(this: ScoreTrainingSetupContext): void;
  abandonSession(this: ScoreTrainingSetupContext): Promise<void>;
  selectMode(
    this: ScoreTrainingSetupContext,
    type: ScoreTrainingDurationType,
  ): void;
  presetForMode(
    this: ScoreTrainingSetupContext,
    type: ScoreTrainingDurationType,
  ): ConfigurationPresetData | undefined;
  start(this: ScoreTrainingSetupContext): Promise<void>;
};
```

Import `ConfigurationPresetData` if not already imported in that types file (it already uses it via presets). `ScoreTrainingDurationType` is declared in this same file by Task 2, so it needs no import here.

`durationValue` is `number | string | null`, not `number`: `x-model.number` hands back `null` for an empty field and the raw string for unparseable text. Typing it `number` would be a lie the clamp helper then has to work around. No `$watch` member is added — see Step 4.

- [ ] **Step 2: Write / rewrite failing setup tests**

Add a shared presets fixture and replace the `session creation` describe + add new describes. Key cases:

```ts
const ROUND_PRESET = {
  configurationTemplateId: "tmpl-rounds",
  name: "Score Training — 10 Rounds",
  configuration: {
    duration_type: "ROUNDS",
    duration_value: 10,
    max_darts_per_turn: 3,
  },
} as any;

const MINUTES_PRESET = {
  configurationTemplateId: "tmpl-minutes",
  name: "Score Training — 5 Minutes",
  configuration: {
    duration_type: "MINUTES",
    duration_value: 5,
    max_darts_per_turn: 3,
  },
} as any;

describe("init duration defaults", () => {
  it("defaults to ROUNDS and the rounds preset duration_value", async () => {
    const setup = createSetup();
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
      ROUND_PRESET,
      MINUTES_PRESET,
    ]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
    await setup.init();
    expect(setup.durationType).toBe("ROUNDS");
    expect(setup.durationValue).toBe(10);
    expect(setup.clampNotice).toBe("");
  });
});

describe("selectMode", () => {
  it("resets durationValue to the mode preset default and clears clampNotice", () => {
    const setup = createSetup({
      presets: [ROUND_PRESET, MINUTES_PRESET],
      durationType: "ROUNDS",
      durationValue: 20,
      clampNotice: "Allowed range: 1–100 rounds",
    });
    setup.selectMode("MINUTES");
    expect(setup.durationType).toBe("MINUTES");
    expect(setup.durationValue).toBe(5);
    expect(setup.clampNotice).toBe("");
  });
});

describe("session creation", () => {
  it("creates with template + duration_value override after clamp", async () => {
    const setup = createSetup({
      presets: [ROUND_PRESET, MINUTES_PRESET],
      durationType: "ROUNDS",
      durationValue: 20,
      clampNotice: "",
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
      gameTypeKey: "SCORE_TRAINING",
      rulesetVersionKey: "SCORE_TRAINING_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
      config: {
        source: "template",
        templateRef: "tmpl-rounds",
        overrides: { duration_value: 20 },
      },
    });
    expect(store.game.startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        templateRef: "tmpl-rounds",
        configSnapshot: expect.objectContaining({
          durationType: "ROUNDS",
          durationValue: 20,
          maxDartsPerTurn: 3,
        }),
      }),
    );
    expect(locationSpy.href).toBe("/games/score-training/play");
  });

  it("clamps out-of-range values, sets clampNotice, and still creates", async () => {
    const setup = createSetup({
      presets: [ROUND_PRESET, MINUTES_PRESET],
      durationType: "ROUNDS",
      durationValue: 250,
      clampNotice: "",
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

    expect(setup.durationValue).toBe(100);
    expect(setup.clampNotice).toBe("Allowed range: 1–100 rounds");
    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          overrides: { duration_value: 100 },
        }),
      }),
    );
  });

  it("clamps a blank field to the mode minimum", async () => {
    const setup = createSetup({
      presets: [ROUND_PRESET, MINUTES_PRESET],
      durationType: "MINUTES",
      durationValue: null,
      clampNotice: "",
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

    expect(setup.durationValue).toBe(3);
    expect(setup.clampNotice).toBe("Allowed range: 3–30 minutes");
    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          overrides: { duration_value: 3 },
        }),
      }),
    );
  });

  it("errors when no preset matches the mode", async () => {
    const setup = createSetup({
      presets: [ROUND_PRESET],
      durationType: "MINUTES",
      durationValue: 5,
    });
    await setup.start();
    expect(sessionsApi.createSession).not.toHaveBeenCalled();
    expect(setup.error).toBe("Could not find a preset for this mode.");
  });

  // Keep SESSION_ALREADY_ACTIVE + broken-schema cases, but drive them via
  // durationType + matching preset instead of selectedTemplateId.
});
```

Remove every reference to `selectedTemplateId` in this test file.

**Watch the broken-schema case (D148).** It currently uses `configuration: { duration_type: "ROUNDS", duration_value: 0 }` and asserts `start()` refuses to create. Under the new `start()`, `duration_value` is _overwritten_ by the clamped field value before `toSnapshot`, so the `0` stops being what fails — the parse now throws only because the fixture omits the required `max_darts_per_turn`. The test would keep passing for a reason its name no longer describes.

Keep the guarantee (an unparseable merged config blocks session create) and make the fixture say so: drop `duration_value` from the fixture entirely, leaving `{ duration_type: "ROUNDS" }` with `max_darts_per_turn` still absent, and rename to `"rejects a preset whose configuration is missing required fields, before creating a session"`. Do not leave a `duration_value: 0` that the override silently repairs.

- [ ] **Step 3: Run — expect RED**

```bash
cd /Users/levi/Development/dart-analytics/app
npx vitest run tests/lib/game/score-training-setup.data.test.ts
```

- [ ] **Step 4: Implement factory**

Rewrite `scoreTrainingSetup()` state + helpers. Core pieces:

```ts
import {
  clampScoreTrainingDuration,
  scoreTrainingDurationClampNotice,
} from "@lib/game/score-training-duration";
import type { ScoreTrainingDurationType } from "./types";

const FALLBACK_DURATION: Record<ScoreTrainingDurationType, number> = {
  ROUNDS: 10,
  MINUTES: 5,
};

/**
 * Reads `duration_value` off a preset's `configuration`, which the API types
 * as `Record<string, unknown>`. Returns undefined when the key is absent or
 * not a number, so callers fall back to `FALLBACK_DURATION`.
 */
function durationValueOf(preset: ConfigurationPresetData | undefined) {
  const raw = preset?.configuration?.duration_value;
  return typeof raw === "number" ? raw : undefined;
}

export function scoreTrainingSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    durationType: "ROUNDS" as ScoreTrainingDurationType,
    durationValue: 10 as number | string | null,
    clampNotice: "",

    async init(this: ScoreTrainingSetupContext) {
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

    presetForMode(
      this: ScoreTrainingSetupContext,
      type: ScoreTrainingDurationType,
    ) {
      return this.presets.find((p) => {
        const cfg = p.configuration as { duration_type?: string } | null;
        return cfg?.duration_type === type;
      });
    },

    selectMode(
      this: ScoreTrainingSetupContext,
      type: ScoreTrainingDurationType,
    ) {
      this.durationType = type;
      this.durationValue =
        durationValueOf(this.presetForMode(type)) ?? FALLBACK_DURATION[type];
      this.clampNotice = "";
    },

    async start(this: ScoreTrainingSetupContext) {
      const preset = this.presetForMode(this.durationType);
      if (!preset) {
        this.error = "Could not find a preset for this mode.";
        return;
      }
      const { value, clamped } = clampScoreTrainingDuration(
        this.durationType,
        this.durationValue,
      );
      this.durationValue = value;
      this.clampNotice = clamped
        ? scoreTrainingDurationClampNotice(this.durationType)
        : "";

      this.loading = true;
      this.error = "";
      try {
        const wire = {
          ...(preset.configuration as Record<string, unknown>),
          duration_value: value,
        };
        const configSnapshot = toSnapshot(RULESET_VERSION_KEY, wire);
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          captureModeKey: "RECREATIONAL",
          inputModeKey: "QUICK_SCORE",
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
            overrides: { duration_value: value },
          },
        });
        this.$store.game.startSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          sessionId: session.sessionId,
          participantRef: session.participants[0].ref,
          templateRef: preset.configurationTemplateId,
          configSnapshot,
        });
        globalThis.location.href = "/games/score-training/play";
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

`start()` sets `this.error = ""` before creating, which today's implementation does not. Intentional: a stale “Could not find a preset for this mode.” must not survive a later successful attempt.

Note the ordering inside `start()`: `this.durationValue = value` **then** `this.clampNotice = …`. Both are plain synchronous assignments, so the notice survives — which is precisely what an Alpine `$watch("durationValue")` would have destroyed, since it fires asynchronously after the write-back. The notice is cleared by `@input` on the field instead (Task 4).

`configuration` is typed `Record<string, unknown>` by the API contract, so `durationValueOf` does the narrowing once instead of scattering casts. If `toSnapshot` throws on invalid merged wire, the existing “Could not start the session” path catches it.

**No `$watch`.** The earlier draft cleared `clampNotice` via `this.$watch("durationValue", …)`. That is a defect, not a style preference: `start()` writes the clamped value to `durationValue` and then sets `clampNotice`; Alpine's `$watch` runs through the reactive scheduler _after_ that mutation, so it would blank the notice before the user could read it — deleting the one piece of feedback the clamp behaviour exists to give. It would also be dead weight in tests (the factory has no Alpine instance, so any guard makes it permanently unexercised), and no `$watch` appears anywhere else in this codebase. Clearing on real user edits belongs on the field's `@input` handler in Task 4.

- [ ] **Step 5: Run — expect GREEN**

```bash
cd /Users/levi/Development/dart-analytics/app
npx vitest run tests/lib/game/score-training-setup.data.test.ts
```

- [ ] **Step 6: Commit** (only if user asked)

```bash
git add app/src/lib/game/types.ts app/src/lib/game/score-training-setup.data.ts \
  app/tests/lib/game/score-training-setup.data.test.ts
git commit -m "$(cat <<'EOF'
feat(score-training): setup mode + duration override on session create

EOF
)"
```

---

### Task 4: SetupSessionForm UI

**Files:**

- Modify: `app/src/components/layout/games/SetupSessionForm.astro`

**Interfaces:**

- Consumes: parent `scoreTrainingSetup()` scope — `durationType`, `durationValue`, `clampNotice`, `selectMode`, `error`, `loading`, `start`; `Input.astro`
- Produces: mode radios + labeled `Input.astro` field + clamp notice markup

- [ ] **Step 1: Replace preset radios with mode + value UI**

Replace the preset `x-for` block in `SetupSessionForm.astro` with:

```astro
<div class="mt-4 flex flex-col gap-3">
  <div class="flex flex-col gap-2">
    <label class="flex items-center gap-2">
      <input
        type="radio"
        class="control"
        name="durationType"
        value="ROUNDS"
        x-model="durationType"
        @change="selectMode('ROUNDS')"
      />
      <span>Rounds</span>
    </label>
    <label class="flex items-center gap-2">
      <input
        type="radio"
        class="control"
        name="durationType"
        value="MINUTES"
        x-model="durationType"
        @change="selectMode('MINUTES')"
      />
      <span>Timed</span>
    </label>
  </div>

  <div class="flex flex-col gap-1">
    <label
      for="durationValue"
      class="text-sm text-muted-foreground"
      x-text="durationType === 'ROUNDS' ? 'Rounds' : 'Minutes'"
    ></label>
    <Input
      id="durationValue"
      name="durationValue"
      type="text"
      inputmode="numeric"
      {...{
        "x-model.number": "durationValue",
        "x-on:input": "clampNotice = ''",
      }}
    />
    <p
      class="text-sm text-muted-foreground"
      role="status"
      x-show="clampNotice"
      x-text="clampNotice"
      x-cloak
    ></p>
  </div>
</div>
```

Add `import Input from "@components/forms/Input.astro";` to the frontmatter alongside the existing `Button` import.

Keep the existing error alert and Let’s play button. Do **not** list presets.

Notes:

- **`Input.astro`, not a raw `<input class="input">`.** `07-Frontend/07-Style-Guide.md` requires the shared wrapper, and `.input` in `global.css` carries only background, inset shadow and transition timing — the border, radius, padding and text sizing come from `Input.astro`'s `cn()` composition. A raw element with `class="input"` renders visibly unstyled next to every other field in the app.
- **Alpine bindings go through the `{}` escape hatch.** `03-Alpine-Patterns.md` prefers `@`/`:` shorthand on native elements but mandates `x-on:` inside an Astro `{}` expression on a component prop. `Input.astro` spreads unknown props onto the underlying `<input>`, so both bindings land on the real element.
- **`x-on:input`, not a `$watch`.** This is the sole mechanism that clears `clampNotice` on user editing. It fires only on genuine keystrokes, so the notice `start()` sets survives until the user actually changes something — the exact behaviour a `$watch` on `durationValue` would have broken.
- `@change="selectMode(...)"` on the radios ensures a mode switch resets the value even if `x-model` alone would leave a stale number. Radios still bind `durationType`, and `@` shorthand is correct there because they are native elements.

- [ ] **Step 2: Convention checks**

```bash
cd /Users/levi/Development/dart-analytics
bash scripts/check-astro-conventions.sh
bash scripts/check-style-tokens.sh
bash scripts/check-astro-class-composition.sh
cd app && npm run format:check
```

Expected: PASS (format if needed with `npm run format`). The clamp-notice `<p>` carries both `x-show` and `x-cloak`, which is what `check-astro-conventions.sh` enforces.

- [ ] **Step 3: Commit** (only if user asked)

```bash
git add app/src/components/layout/games/SetupSessionForm.astro
git commit -m "$(cat <<'EOF'
feat(score-training): mode radios and duration input on setup

EOF
)"
```

---

### Task 5: Play again carries the custom duration

**Files:**

- Modify: `app/src/lib/game/score-training-play.data.ts` (`playAgain()`)
- Modify: `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**

- Consumes: existing `$store.game.configSnapshot` / `templateRef`; `createSession`
- Produces: `playAgain()` POSTs `overrides: { duration_value }` matching the session it replays

**Why this task exists:** `playAgain()` currently posts `config: { source: "template", templateRef }` with no overrides, then builds the engine and countdown from the client `configSnapshot`. While every session equalled its template that was harmless. Once duration is configurable it is not: replaying a 25-round session persists a **10-round** configuration server-side while the player plays 25, and a custom timed session persists 5 minutes while the countdown runs the real value. The stored configuration would contradict the session it describes — a direct hit on “Store what happened” and on the immutability intent behind configuration snapshots. The design spec previously claimed play-again already carried the value; it does not, and this task is the correction.

- [ ] **Step 1a: Update the existing ST4 assertion (it will break)**

`ST4: playAgain reuses the original template so provenance matches the first play` already asserts the exact create payload:

```ts
expect(createSession).toHaveBeenCalledWith({
  gameTypeKey: "SCORE_TRAINING",
  rulesetVersionKey: "SCORE_TRAINING_V1",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "QUICK_SCORE",
  config: { source: "template", templateRef: "tpl-1" },
});
```

`toHaveBeenCalledWith` is exact, so adding `overrides` fails it. `makePlay()` defaults to `configSnapshot: rounds(20)`, so the `config` line becomes:

```ts
  config: {
    source: "template",
    templateRef: "tpl-1",
    overrides: { duration_value: 20 },
  },
```

This is a D148-compliant update, not a re-point: ST4's guarantee is _provenance_ — the replay reuses the original `templateRef` — and that assertion stays intact and unweakened. Only the payload shape around it grows. Leave the rest of ST4 alone.

- [ ] **Step 1b: New failing tests**

In the same play-again `describe`, using the file's existing `makePlay` / `gameStub` / `rounds` / `minutes` helpers:

```ts
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
```

Add the MINUTES twin with `configSnapshot: minutes(12)`, asserting `overrides: { duration_value: 12 }`.

- [ ] **Step 2: Run — expect RED**

```bash
cd /Users/levi/Development/dart-analytics/app
npx vitest run tests/lib/game/score-training-play.data.test.ts
```

Expected: FAIL — the two new tests find no `overrides` key, and ST4 now fails too (its updated assertion expects one). All three go green together in Step 3.

- [ ] **Step 3: Send the override**

In `playAgain()`, the create call becomes:

```ts
session = await createSession({
  gameTypeKey: GAME_TYPE_KEY,
  rulesetVersionKey: RULESET_VERSION_KEY,
  captureModeKey: "RECREATIONAL",
  inputModeKey: "QUICK_SCORE",
  config: {
    source: "template",
    templateRef,
    overrides: { duration_value: config.durationValue },
  },
});
```

`config` is the `configSnapshot` already read and null-guarded at the top of the method, so there is no new state, no new fetch and no new failure mode. Everything below — engine construction, `recordFacts`, the `MINUTES` countdown — is untouched.

- [ ] **Step 4: Run — expect GREEN**

```bash
cd /Users/levi/Development/dart-analytics/app
npx vitest run tests/lib/game/score-training-play.data.test.ts
```

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add app/src/lib/game/score-training-play.data.ts \
  app/tests/lib/game/score-training-play.data.test.ts
git commit -m "$(cat <<'EOF'
fix(score-training): play again keeps the session's configured duration

EOF
)"
```

---

### Task 6: Seeds — minutes preset 5 + existing-DB UPDATE + runner repair

**Files:**

- Modify: `database/seeds/0002_default_templates.sql` (minutes preset row)
- Create: `database/seeds/0004_score_training_minutes_preset.sql`
- Modify: `app/scripts/seed.ts` (repair paths, register `0003` + `0004`)
- Modify: `app/tests/lib/game/rulesets/seeded-presets.test.ts` (mirror the new row)
- Modify: `database/README.md` (seed order)
- Modify: `docs/architecture/05-Database/10-Database-Agent-Guide.md` (current seeds + checklist wording)

**Interfaces:**

- Consumes: preset UUID `0198f300-0000-7000-8000-000000000008`
- Produces: fresh installs + already-seeded DBs both expose 5-minute Score Training preset, and `npm run db:seed` actually applies it

- [ ] **Step 1: Edit `0002` minutes preset**

Change the second Score Training configuration_templates VALUES block to:

```sql
    (
        '0198f300-0000-7000-8000-000000000008',
        '0198f000-0000-7000-8000-000000000004',
        NULL,
        'Score Training — 5 Minutes',
        'Five minutes of scoring practice.',
        '{
            "duration_type": "MINUTES",
            "duration_value": 5,
            "max_darts_per_turn": 3
        }'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
```

(Keep the rounds row and the shared `ON CONFLICT` placement consistent with the file’s current multi-row INSERT style.)

- [ ] **Step 2: Add `0004` UPDATE seed**

Create `database/seeds/0004_score_training_minutes_preset.sql`:

```sql
-- ============================================================
-- Seed: 0004_score_training_minutes_preset.sql
--
-- Purpose:
-- Align the already-seeded Score Training minutes preset to the
-- 5-minute product default.
--
-- 0002 inserts that row with ON CONFLICT (id) DO NOTHING, so any
-- database seeded before this change keeps duration_value 15 and
-- re-running 0002 will not correct it.
--
-- Idempotency deviates from the Seed Checklist's ON CONFLICT DO
-- NOTHING shape: a single-row UPDATE targeted by primary key is
-- idempotent by construction, and there is no row to insert.
-- ============================================================
BEGIN;
UPDATE configuration_templates
SET
    name = 'Score Training — 5 Minutes',
    description = 'Five minutes of scoring practice.',
    configuration = '{
        "duration_type": "MINUTES",
        "duration_value": 5,
        "max_darts_per_turn": 3
    }'::jsonb,
    updated_at = now()
WHERE id = '0198f300-0000-7000-8000-000000000008';
COMMIT;
```

`BEGIN`/`COMMIT` is required, not decorative: `10-Database-Agent-Guide.md` §6 says migrations omit them (dbmate wraps each section) but **seeds keep explicit `BEGIN`/`COMMIT`**, and `0002` and `0003` both do.

- [ ] **Step 2b: Repair the seed runner — `app/scripts/seed.ts`**

`database/README.md` documents the apply order; the **executable** order is the hardcoded `seedFiles` array in `app/scripts/seed.ts`. It is currently broken and stale:

```ts
const seedFiles = [
  "../architecture/docs/database/seeds/0001_reference_data.sql",
  "../architecture/docs/database/seeds/0002_default_templates.sql",
];
```

That directory does not exist in this repo — `npm run db:seed` throws ENOENT today — and `0003` was never registered. Registering `0004` in the README alone would be inert. Replace with:

```ts
const seedFiles = [
  "../database/seeds/0001_reference_data.sql",
  "../database/seeds/0002_default_templates.sql",
  "../database/seeds/0003_game_engine_reference.sql",
  "../database/seeds/0004_score_training_minutes_preset.sql",
];
```

Nothing else catches this: `db:seed` is not part of `validate:app`, so the repair must be verified by running it (Step 5).

- [ ] **Step 2c: Update the seeded-preset mirror test**

`app/tests/lib/game/rulesets/seeded-presets.test.ts` holds a hand-copied `SEEDED_PRESETS` list whose stated purpose is turning seed/schema divergence into a failing test. Update its Score Training MINUTES entry:

```ts
{
  name: "Score Training — 5 Minutes",
  rulesetVersionKey: "SCORE_TRAINING_V1",
  configuration: {
    duration_type: "MINUTES",
    duration_value: 5,
    max_darts_per_turn: 3,
  },
},
```

This will **not** fail if forgotten — 15 stays valid under 3–30, so the mirror would silently drift out of sync with the seed it exists to guard. Treat it as part of the seed edit, not as a check on it.

- [ ] **Step 3: Register in `database/README.md`**

Under Seed Order:

```markdown
1. `seeds/0001_reference_data.sql`
2. `seeds/0002_default_templates.sql`
3. `seeds/0003_game_engine_reference.sql`
4. `seeds/0004_score_training_minutes_preset.sql`
```

- [ ] **Step 4: Update `10-Database-Agent-Guide.md`**

Two edits:

- “Current seeds” list gains `0004_score_training_minutes_preset.sql — Score Training minutes preset realigned to 5 (2026-07-31)`.
- Seed Checklist idempotency line becomes idempotency-by-construction rather than one specific clause, so a targeted `UPDATE` seed is covered: `[ ] Idempotent (ON CONFLICT DO NOTHING for inserts; a primary-key-targeted UPDATE also qualifies)`.

- [ ] **Step 5: Apply locally (when DB available)**

```bash
cd /Users/levi/Development/dart-analytics/app
npm run db:seed
```

Expected: all four seeds apply, `0004` included, no error. This is the only check that the runner repair works — do not skip it and infer success from the README. Verify:

```sql
SELECT name, configuration->>'duration_value'
FROM configuration_templates
WHERE id = '0198f300-0000-7000-8000-000000000008';
```

Expected: `Score Training — 5 Minutes` / `5`.

- [ ] **Step 6: Commit** (only if user asked)

```bash
git add database/seeds/0002_default_templates.sql \
  database/seeds/0004_score_training_minutes_preset.sql \
  app/scripts/seed.ts \
  app/tests/lib/game/rulesets/seeded-presets.test.ts \
  database/README.md \
  docs/architecture/05-Database/10-Database-Agent-Guide.md
git commit -m "$(cat <<'EOF'
chore(seeds): Score Training minutes preset defaults to 5

EOF
)"
```

---

### Task 7: Game-rules note + context map + validate

**Files:**

- Modify: `docs/game-rules/rulesets/score-training.md`
- Modify: `docs/architecture/00-Context-Map.md` (seed inventory rows)
- Touch as needed for gates only (no architecture invent unless context-maintenance requires it at finish)

**Interfaces:**

- Consumes: approved spec bounds/defaults
- Produces: raw rules note aligned with product V2 setup

- [ ] **Step 1: Update `score-training.md`**

Update the feature table / Config & presets section to reflect:

- Fixed visits **or** timed minutes
- N editable (1–100); minutes editable (3–30); defaults 10 rounds / 5 minutes
- Setup radios select mode (Rounds / Timed), not preset names
- Leave multiplayer / challenge variants as later versions

Example config table replacement:

```markdown
| Setting    | Preset / default                        | On config screen     |
| ---------- | --------------------------------------- | -------------------- |
| Players    | Single player                           | Shown, locked        |
| Mode       | Rounds or Timed                         | Radios               |
| Visits (N) | Default **10** (min **1**, max **100**) | Editable when Rounds |
| Minutes    | Default **5** (min **3**, max **30**)   | Editable when Timed  |
| Scoring    | Full board, standard values             | Shown, locked        |
```

Also note timed session end in How to play / Later versions as appropriate (engine already supports MINUTES).

- [ ] **Step 1b: Register seed `0004` in `00-Context-Map.md`**

Three rows carry the seed inventory and all three go stale otherwise:

- the Context Packs row `New seed data` → `database/seeds/0001` or `0002` (match id ranges) — extend so `0004` is discoverable
- the file-inventory rows listing `seeds/0001`, `0002` and `0003`
- the Seeds summary row in the change-log table

Add `0004_score_training_minutes_preset.sql — Score Training minutes preset realigned to 5 (2026-07-31)`. Naming these explicitly is deliberate: a generic “run context-maintenance at the end” does not reliably surface three separate rows across two files.

- [ ] **Step 2: Full app validation for touched areas**

```bash
cd /Users/levi/Development/dart-analytics/app
npm test
npm run check
cd /Users/levi/Development/dart-analytics
bash scripts/check-refinement-coverage.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-style-tokens.sh
bash scripts/check-no-inline-comments.sh
bash scripts/check-type-barrels.sh
bash scripts/check-file-locations.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-map.sh
```

Expected: all green. The list matches what this plan actually touches — a new `.ts` lib file (`check-no-inline-comments.sh`, `check-type-barrels.sh`, `check-file-locations.sh`), `.astro` markup (conventions, class composition, style tokens), and doc edits (`check-doc-links.sh`, `check-context-map.sh`). The `run-all-gates` skill dispatches this set by changed area and is the preferred way to run it.

If `validate:app` is preferred and env is ready: `npm run validate:app`. Note it does **not** include `db:seed` — the seed runner repair is only proven by Task 6 Step 5.

- [ ] **Step 3: Commit** (only if user asked)

```bash
git add docs/game-rules/rulesets/score-training.md \
  docs/architecture/00-Context-Map.md
git commit -m "$(cat <<'EOF'
docs(game-rules): Score Training configurable duration notes

EOF
)"
```

- [ ] **Step 4: Before claiming done**

Run the `context-maintenance` skill. Seed `0004` and the DB agent guide are already handled in Task 6, and the context-map rows in Task 7 Step 1b — what remains for the skill:

- register `app/src/lib/game/score-training-duration.ts` in the context map inventory if the file-inventory rules require it
- `DECISIONS.md` rows for the two durable decisions here: the product bounds change (ROUNDS 1–100 / MINUTES 3–30, minutes default 5) and the play-again override fix, which changed persisted behaviour
- refresh the knowledge graph

Then offer `finishing-a-development-branch`.

---

## Spec coverage checklist

| Spec requirement                                                      | Task                  |
| --------------------------------------------------------------------- | --------------------- |
| Mode radios + labeled `x-model.number` field via `Input.astro`        | 4                     |
| Clamp notice cleared by `@input`, never `$watch`                      | 3, 4                  |
| Template-by-mode + `overrides.duration_value`                         | 3                     |
| Mode switch resets to preset default                                  | 3                     |
| Clamp then start + notice only on clamp                               | 2, 3                  |
| `durationValue` typed for Alpine's real output (`null` / string)      | 2, 3                  |
| Bounds 1–100 / 3–30 in ScoreTrainingConfig                            | 1                     |
| MINUTES floor now load-bearing — both blind-spot notes corrected      | 1                     |
| Play again carries the session's duration                             | 5                     |
| Existing `ST4` payload assertion updated, provenance kept             | 5                     |
| Broken-preset test no longer leans on an overwritten `duration_value` | 3                     |
| Minutes seed 5 + existing DB UPDATE (with `BEGIN`/`COMMIT`)           | 6                     |
| Seed runner repaired + `0003`/`0004` registered                       | 6                     |
| `seeded-presets.test.ts` mirror updated                               | 6                     |
| Seed inventory: README, DB agent guide, context map                   | 6, 7                  |
| game-rules note                                                       | 7                     |
| TUOD / engine / API / play UI unchanged                               | (negative — no tasks) |
| Persistence mapping unchanged                                         | (negative — no tasks) |
