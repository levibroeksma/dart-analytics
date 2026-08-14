# Training Order Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an editable target-order setting (Low→High / High→Low / Random) to Singles Training and Doubles Training setup, identical in both games, resolved once at session creation and frozen for the life of the session (undo/resume never reshuffles).

**Architecture:** A shared `target-order.ts` helper resolves an `order_mode` choice into a concrete 21-value `target_order` array (1–20 plus `25` as the BULL sentinel) at session creation. `target_order` is added to both games' Zod config schemas and threaded through `board-progression.module.ts`'s path builders and both engines' reducers, replacing their hardcoded ascending paths. Both engines' completion checks move from "is this target BULL" to "is this the last target in the path" — index-based, since BULL can now lead (High→Low) or sit anywhere (Random). Setup UI reuses the existing `Toggle` primitive (501's precedent); Play Again gains a generic `buildOverrides` hook so a fresh shuffle is minted per session, never reused.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Zod, Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-14-training-order-mode-design.md`.
- BULL sentinel value is `25` (`BULL_TARGET_NUMBER` in `board-progression.module.ts`) — reuse it, never invent a new constant.
- On High→Low, BULL leads (`BULL, 20, 19, …1`) for **both** games — not "ends on bull" as Doubles Training's pre-existing non-canonical doc says; that doc is corrected in Task 12.
- On Random, all 21 targets (1–20 + BULL) shuffle together — BULL can land anywhere.
- Play Again always mints a fresh `target_order` for the new session; never reuses the just-finished session's array.
- `order_mode`/`target_order` live in config (session-scoped, immutable snapshot), never in the fact log (`DartFact`/`TurnFact` gain no new fields).
- TDD throughout: `app/tests/` mirrors `app/src/`'s structure, never colocated.
- `npm test` (run from `app/`) must pass after every task. `npm run format` before any commit touching `.astro`/`.ts` under `app/`.
- No `//`/`/* */` comments inside TypeScript function bodies (`app/src/**/*.ts`) — JSDoc above the declaration only. Test files (`app/tests/`) are exempt.
- Alpine v3 shorthand (`:model`, `@click`), never `x-bind:`/`x-on:` except the documented Astro `{}` escape hatch.
- Bob's 27 must not change behaviorally — it shares `board-progression.module.ts` but not the config shape; its two `doublesPath()` call sites keep calling with zero arguments.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `app/src/lib/game/target-order.ts` (new) | Resolves an order mode into a concrete 21-value array; shared by both games' setup and play-again flows |
| `app/src/lib/game/rulesets/types.ts` (edit) | `SinglesConfig`/`DoublesTrainingConfig` widened; `target_order` added and validated |
| `app/src/lib/game/rulesets/refinement-contract.ts` (edit) | Accept/reject boundary probes for the new `target_order` refinements |
| `app/src/modules/game/board-progression.module.ts` (edit) | `numbersPath()`/`doublesPath()` build from an explicit order, defaulting to today's fixed ascending array |
| `app/src/modules/game/singles-training.engine.module.ts` (edit) | Path/completion now config-driven |
| `app/src/modules/game/doubles-training.engine.module.ts` (edit) | Path/completion now config-driven; config retained in the constructor |
| `app/src/lib/game/singles-training-play.data.ts` (edit) | Path lookups thread `configSnapshot.targetOrder`; `playAgain` supplies a fresh shuffle |
| `app/src/lib/game/doubles-training-play.data.ts` (edit) | Same |
| `app/src/lib/game/play-lifecycle.ts` (edit) | `runPlayAgain` gains an optional `buildOverrides` hook |
| `app/src/lib/game/types.ts` (edit) | `PlayAgainOverrides<TConfig>` type; setup contexts gain `orderMode` |
| `app/src/lib/game/singles-training-setup.data.ts` / `doubles-training-setup.data.ts` (edit) | `orderMode` field; `start()` sends the resolved order as a config override |
| `app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro` / `DoublesTrainingSetupForm.astro` (edit) | Order-mode `Toggle`, identical in both |
| `database/seeds/0002_default_templates.sql` / `0003_game_engine_reference.sql` (edit) | Seeded presets gain `target_order` |
| `docs/game-rules/rulesets/singles-training.md` / `doubles-training.md` (edit) | Order versioned to v1; Doubles' bull-placement description corrected |

---

### Task 1: Shared target-order helper

**Files:**
- Create: `app/src/lib/game/target-order.ts`
- Test: `app/tests/lib/game/target-order.test.ts`

**Interfaces:**
- Produces: `TargetOrderMode = "LOW_TO_HIGH" | "HIGH_TO_LOW" | "RANDOM"`; `ascendingTargetOrder(): number[]`; `descendingTargetOrder(): number[]`; `randomTargetOrder(): number[]`; `targetOrderFor(mode: TargetOrderMode): number[]` — every later task that resolves a concrete order imports from here.

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/lib/game/target-order.test.ts
import { describe, expect, it, vi } from "vitest";
import {
  ascendingTargetOrder,
  descendingTargetOrder,
  randomTargetOrder,
  targetOrderFor,
} from "@lib/game/target-order";

const ASCENDING = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];
const DESCENDING = [
  25, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1,
];

describe("ascendingTargetOrder", () => {
  it("is 1..20 then BULL (25)", () => {
    expect(ascendingTargetOrder()).toEqual(ASCENDING);
  });
});

describe("descendingTargetOrder", () => {
  it("leads with BULL (25), then 20 down to 1", () => {
    expect(descendingTargetOrder()).toEqual(DESCENDING);
  });
});

describe("randomTargetOrder", () => {
  it("is a permutation of the same 21 values every time", () => {
    for (let i = 0; i < 10; i++) {
      const order = randomTargetOrder();
      expect(order).toHaveLength(21);
      expect(new Set(order)).toEqual(new Set(ASCENDING));
    }
  });

  it("does not always return the ascending order", () => {
    const results = Array.from({ length: 20 }, () => randomTargetOrder());
    expect(results.some((order) => order.join(",") !== ASCENDING.join(","))).toBe(
      true,
    );
  });
});

describe("targetOrderFor", () => {
  it("dispatches LOW_TO_HIGH to ascendingTargetOrder", () => {
    expect(targetOrderFor("LOW_TO_HIGH")).toEqual(ASCENDING);
  });

  it("dispatches HIGH_TO_LOW to descendingTargetOrder", () => {
    expect(targetOrderFor("HIGH_TO_LOW")).toEqual(DESCENDING);
  });

  it("dispatches RANDOM to a shuffled permutation", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    try {
      const order = targetOrderFor("RANDOM");
      expect(new Set(order)).toEqual(new Set(ASCENDING));
    } finally {
      spy.mockRestore();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/target-order.test.ts`
Expected: FAIL — `Cannot find module '@lib/game/target-order'` (or similar resolution error), since the file does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// app/src/lib/game/target-order.ts
import { BULL_TARGET_NUMBER } from "@modules/game/board-progression.module";

export type TargetOrderMode = "LOW_TO_HIGH" | "HIGH_TO_LOW" | "RANDOM";

/**
 * The default V1 order: 1..20, then BULL. Also the shape `target_order`
 * takes in every seeded preset.
 */
export function ascendingTargetOrder(): number[] {
  return [...Array.from({ length: 20 }, (_, i) => i + 1), BULL_TARGET_NUMBER];
}

/**
 * BULL leads, then 20 down to 1 — the reverse of `ascendingTargetOrder`
 * with BULL moved to the front rather than staying last.
 */
export function descendingTargetOrder(): number[] {
  return [
    BULL_TARGET_NUMBER,
    ...Array.from({ length: 20 }, (_, i) => 20 - i),
  ];
}

/**
 * Fisher–Yates shuffle of all 21 targets (1..20 + BULL) — BULL can land
 * anywhere in the result, including mid-session. `Math.random()` is
 * sufficient: this orders dart-practice targets, not a security-sensitive
 * value.
 */
export function randomTargetOrder(): number[] {
  const order = ascendingTargetOrder();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }
  return order;
}

export function targetOrderFor(mode: TargetOrderMode): number[] {
  if (mode === "HIGH_TO_LOW") return descendingTargetOrder();
  if (mode === "RANDOM") return randomTargetOrder();
  return ascendingTargetOrder();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/target-order.test.ts`
Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/target-order.ts app/tests/lib/game/target-order.test.ts
git commit -m "Add shared target-order helper for training order modes"
```

---

### Task 2: Widen the Singles/Doubles config schema

This is the largest task: widening a shared Zod schema breaks every pre-existing fixture that constructs a `SinglesConfig`/`DoublesTrainingConfig`-shaped object without the new required `target_order` field. All of them are fixed here so `npm test` stays green in one commit — do not split this across tasks; a half-fixed suite is not a state anyone should review.

**Files:**
- Modify: `app/src/lib/game/rulesets/types.ts`
- Modify: `app/src/lib/game/rulesets/refinement-contract.ts`
- Modify (fixtures, add `target_order`/`targetOrder`): `app/tests/modules/game/singles-training.engine.module.test.ts`, `app/tests/modules/game/doubles-training.engine.module.test.ts`, `app/tests/services/rulesets/singles-training/singles-training.validator.test.ts`, `app/tests/services/rulesets/doubles-training/doubles-training.validator.test.ts`, `app/tests/lib/game/singles-training-setup.data.test.ts`, `app/tests/lib/game/doubles-training-setup.data.test.ts`, `app/tests/lib/game/singles-training-play.data.test.ts`, `app/tests/lib/game/doubles-training-play.data.test.ts`, `app/tests/services/session.service.test.ts`, `app/tests/lib/game/rulesets/seeded-presets.test.ts`, `app/tests/modules/game/dart-fact-target-consistency.test.ts`, `app/tests/modules/game/engine-reference-isolation.test.ts`
- Modify (stale test intent, not a fixture fix): `app/tests/lib/game/rulesets/config-codec.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SinglesConfigData["target_order"]` / `DoublesTrainingConfigData["target_order"]`: `number[]`, length 21, a permutation of `1..20` and `25`. `SinglesSnapshot.targetOrder` / `DoublesTrainingSnapshot.targetOrder`: `number[]` (camelCase, via the existing generic `config-codec.ts` mapping — no codec change needed). Both `order_mode`/`orderMode` widen to `"LOW_TO_HIGH" | "HIGH_TO_LOW" | "RANDOM"`. Every later task reads `config.targetOrder`.

- [ ] **Step 1: Widen the schemas in `types.ts`**

Read the file first to confirm line numbers still match (Task 1 did not touch it). Replace:

```ts
export const SinglesConfig = z
  .object({
    order_mode: z.enum(["LOW_TO_HIGH"]),
    difficulty: z.enum(["EASY"]),
    points_single: z.number().int().default(1),
    points_double: z.number().int().default(2),
    points_treble: z.number().int().default(3),
  })
  .strict();

export const DoublesTrainingConfig = z
  .object({
    mode: z.enum(["EASY"]),
    order_mode: z.enum(["LOW_TO_HIGH"]),
  })
  .strict();
```

with:

```ts
/**
 * `target_order` is the concrete, already-resolved 21-target sequence a
 * Singles/Doubles Training session actually plays — a permutation of the 20
 * numbered targets (1..20) and BULL (25, the same sentinel
 * `board-progression.module.ts` uses for the bull target). `order_mode`
 * only describes how it was produced (ascending, descending, or shuffled);
 * the array is what the engine reads. Resolved once client-side at session
 * creation (`lib/game/target-order.ts`) and copied into the immutable
 * config snapshot, so undo/resume can never reshuffle mid-session.
 *
 * The `.superRefine` validating it is declared inline on each exported
 * config schema, not factored into a shared sub-schema — mechanically
 * required, not a style choice: `scripts/check-refinement-coverage.sh`
 * attributes a `.superRefine(`/`.refine(` call to the nearest preceding
 * `export const NAME =`, so a refinement living on a non-exported helper
 * const would be silently misattributed to whatever export happens to
 * precede it in the file.
 */
const TARGET_ORDER_VALUES = new Set<number>([
  ...Array.from({ length: 20 }, (_, i) => i + 1),
  25,
]);

function isValidTargetOrder(value: number[]): boolean {
  if (value.length !== 21) return false;
  const seen = new Set(value);
  if (seen.size !== 21) return false;
  return value.every((n) => TARGET_ORDER_VALUES.has(n));
}

export const SinglesConfig = z
  .object({
    order_mode: z.enum(["LOW_TO_HIGH", "HIGH_TO_LOW", "RANDOM"]),
    target_order: z.array(z.number().int()).length(21),
    difficulty: z.enum(["EASY"]),
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

export const DoublesTrainingConfig = z
  .object({
    mode: z.enum(["EASY"]),
    order_mode: z.enum(["LOW_TO_HIGH", "HIGH_TO_LOW", "RANDOM"]),
    target_order: z.array(z.number().int()).length(21),
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

Then update the snapshot types further down the same file. Replace:

```ts
export type SinglesSnapshot = {
  orderMode: SinglesConfigData["order_mode"];
  difficulty: SinglesConfigData["difficulty"];
  pointsSingle: SinglesConfigData["points_single"];
  pointsDouble: SinglesConfigData["points_double"];
  pointsTreble: SinglesConfigData["points_treble"];
};
```

with:

```ts
export type SinglesSnapshot = {
  orderMode: SinglesConfigData["order_mode"];
  targetOrder: SinglesConfigData["target_order"];
  difficulty: SinglesConfigData["difficulty"];
  pointsSingle: SinglesConfigData["points_single"];
  pointsDouble: SinglesConfigData["points_double"];
  pointsTreble: SinglesConfigData["points_treble"];
};
```

Replace:

```ts
export type DoublesTrainingSnapshot = {
  mode: DoublesTrainingConfigData["mode"];
  orderMode: DoublesTrainingConfigData["order_mode"];
};
```

with:

```ts
export type DoublesTrainingSnapshot = {
  mode: DoublesTrainingConfigData["mode"];
  orderMode: DoublesTrainingConfigData["order_mode"];
  targetOrder: DoublesTrainingConfigData["target_order"];
};
```

- [ ] **Step 2: Confirm the refinement-coverage gate fails (red)**

Run: `bash scripts/check-refinement-coverage.sh`
Expected: FAIL, reporting `SinglesConfig has a superRefine/refine in ... but no entry in ...` and the same for `DoublesTrainingConfig`.

- [ ] **Step 3: Declare the refinement contracts**

In `app/src/lib/game/rulesets/refinement-contract.ts`, add the imports and two new contracts, and register them. Replace:

```ts
import { z } from "zod";
import { ScoreTrainingConfig } from "./types";
import type { SchemaRefinementContract } from "./types";
```

with:

```ts
import { z } from "zod";
import { DoublesTrainingConfig, ScoreTrainingConfig, SinglesConfig } from "./types";
import type { SchemaRefinementContract } from "./types";
```

Then, right before the final `export const REFINEMENT_CONTRACTS` block, insert:

```ts
type SinglesInput = z.input<typeof SinglesConfig>;
type DoublesTrainingInput = z.input<typeof DoublesTrainingConfig>;

const ASCENDING_TARGET_ORDER = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
];

const singlesBase = {
  order_mode: "LOW_TO_HIGH",
  difficulty: "EASY",
  points_single: 1,
  points_double: 2,
  points_treble: 3,
} satisfies Omit<SinglesInput, "target_order">;

/**
 * The "wrong length" reject probe is not superRefine-exclusive — the
 * field-level `.length(21)` already rejects it on its own, same blind spot
 * `scoreTrainingContract`'s own comment documents for its ROUNDS floor. The
 * "duplicate value" probe is the load-bearing one: it is exactly length 21,
 * so only the superRefine's uniqueness check can reject it.
 */
const singlesTrainingContract: SchemaRefinementContract<SinglesInput> = {
  schemaName: "SinglesConfig",
  schema: SinglesConfig,
  fields: [
    {
      field: "target_order",
      accept: [
        {
          label: "a valid permutation of 1..20 and 25",
          config: { ...singlesBase, target_order: ASCENDING_TARGET_ORDER },
        },
      ],
      reject: [
        {
          label: "a duplicate value (two 1s, missing 2) — load-bearing, length stays 21",
          config: {
            ...singlesBase,
            target_order: [
              1, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
              19, 20, 25,
            ],
          },
        },
        {
          label: "wrong length (20 entries, missing BULL)",
          config: {
            ...singlesBase,
            target_order: [
              1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
              19, 20,
            ],
          },
        },
      ],
    },
  ],
};

const doublesBase = {
  mode: "EASY",
  order_mode: "LOW_TO_HIGH",
} satisfies Omit<DoublesTrainingInput, "target_order">;

const doublesTrainingContract: SchemaRefinementContract<DoublesTrainingInput> = {
  schemaName: "DoublesTrainingConfig",
  schema: DoublesTrainingConfig,
  fields: [
    {
      field: "target_order",
      accept: [
        {
          label: "a valid permutation of 1..20 and 25",
          config: { ...doublesBase, target_order: ASCENDING_TARGET_ORDER },
        },
      ],
      reject: [
        {
          label: "a duplicate value (two 1s, missing 2) — load-bearing, length stays 21",
          config: {
            ...doublesBase,
            target_order: [
              1, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
              19, 20, 25,
            ],
          },
        },
        {
          label: "wrong length (20 entries, missing BULL)",
          config: {
            ...doublesBase,
            target_order: [
              1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
              19, 20,
            ],
          },
        },
      ],
    },
  ],
};
```

Replace the final export:

```ts
export const REFINEMENT_CONTRACTS: readonly SchemaRefinementContract[] = [
  scoreTrainingContract,
];
```

with:

```ts
export const REFINEMENT_CONTRACTS: readonly SchemaRefinementContract[] = [
  scoreTrainingContract,
  singlesTrainingContract,
  doublesTrainingContract,
];
```

- [ ] **Step 4: Confirm the refinement-coverage gate and contract test pass**

Run: `bash scripts/check-refinement-coverage.sh`
Expected: `OK: 3 refined schema(s) ...` listing `DoublesTrainingConfig, ScoreTrainingConfig, SinglesConfig`.

Run: `cd app && npx vitest run tests/lib/game/rulesets/refinement-contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite to see it red**

Run: `cd app && npm test`
Expected: FAIL — TypeScript/runtime errors in every file listed under "Modify (fixtures...)" above, each missing the now-required `target_order`/`targetOrder` field.

- [ ] **Step 6: Fix every fixture**

For each file below, add `target_order` (wire/snake_case fixtures) or `targetOrder` (snapshot/camelCase fixtures) using the ascending array `[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25]` unless noted otherwise.

`app/tests/modules/game/singles-training.engine.module.test.ts` — replace:

```ts
const config: SinglesSnapshot = {
  orderMode: "LOW_TO_HIGH",
  difficulty: "EASY",
  pointsSingle: 1,
  pointsDouble: 2,
  pointsTreble: 3,
};
```

with:

```ts
const config: SinglesSnapshot = {
  orderMode: "LOW_TO_HIGH",
  targetOrder: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
  ],
  difficulty: "EASY",
  pointsSingle: 1,
  pointsDouble: 2,
  pointsTreble: 3,
};
```

`app/tests/modules/game/doubles-training.engine.module.test.ts` — replace:

```ts
const config: DoublesTrainingSnapshot = {
  mode: "EASY",
  orderMode: "LOW_TO_HIGH",
};
```

with:

```ts
const config: DoublesTrainingSnapshot = {
  mode: "EASY",
  orderMode: "LOW_TO_HIGH",
  targetOrder: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
  ],
};
```

`app/tests/services/rulesets/singles-training/singles-training.validator.test.ts` — replace:

```ts
const validConfig = {
  order_mode: "LOW_TO_HIGH",
  difficulty: "EASY",
  points_single: 1,
  points_double: 2,
  points_treble: 3,
};
```

with:

```ts
const validConfig = {
  order_mode: "LOW_TO_HIGH",
  target_order: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
  ],
  difficulty: "EASY",
  points_single: 1,
  points_double: 2,
  points_treble: 3,
};
```

`app/tests/services/rulesets/doubles-training/doubles-training.validator.test.ts` — replace:

```ts
const validConfig = {
  mode: "EASY",
  order_mode: "LOW_TO_HIGH",
};
```

with:

```ts
const validConfig = {
  mode: "EASY",
  order_mode: "LOW_TO_HIGH",
  target_order: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
  ],
};
```

`app/tests/lib/game/singles-training-setup.data.test.ts` — replace the `STANDARD_PRESET.configuration` block:

```ts
  configuration: {
    order_mode: "LOW_TO_HIGH",
    difficulty: "EASY",
  },
```

with:

```ts
  configuration: {
    order_mode: "LOW_TO_HIGH",
    target_order: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      25,
    ],
    difficulty: "EASY",
  },
```

`app/tests/lib/game/doubles-training-setup.data.test.ts` — replace:

```ts
  configuration: {
    mode: "EASY",
    order_mode: "LOW_TO_HIGH",
  },
```

with:

```ts
  configuration: {
    mode: "EASY",
    order_mode: "LOW_TO_HIGH",
    target_order: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      25,
    ],
  },
```

`app/tests/lib/game/singles-training-play.data.test.ts` — replace:

```ts
function defaultConfig(): SinglesSnapshot {
  return {
    orderMode: "LOW_TO_HIGH",
    difficulty: "EASY",
    pointsSingle: 1,
    pointsDouble: 2,
    pointsTreble: 3,
  };
}
```

with:

```ts
function defaultConfig(): SinglesSnapshot {
  return {
    orderMode: "LOW_TO_HIGH",
    targetOrder: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      25,
    ],
    difficulty: "EASY",
    pointsSingle: 1,
    pointsDouble: 2,
    pointsTreble: 3,
  };
}
```

`app/tests/lib/game/doubles-training-play.data.test.ts` — replace:

```ts
function defaultConfig(): DoublesTrainingSnapshot {
  return { mode: "EASY", orderMode: "LOW_TO_HIGH" };
}
```

with:

```ts
function defaultConfig(): DoublesTrainingSnapshot {
  return {
    mode: "EASY",
    orderMode: "LOW_TO_HIGH",
    targetOrder: [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      25,
    ],
  };
}
```

`app/tests/services/session.service.test.ts` — replace:

```ts
      config: {
        source: "inline",
        config: { order_mode: "LOW_TO_HIGH", difficulty: "EASY" },
      },
```

with:

```ts
      config: {
        source: "inline",
        config: {
          order_mode: "LOW_TO_HIGH",
          target_order: [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
            20, 25,
          ],
          difficulty: "EASY",
        },
      },
```

`app/tests/lib/game/rulesets/seeded-presets.test.ts` — these fixtures are documented as "copied verbatim" from the seed files; keep them in exact sync with Task 11's seed edit. Replace:

```ts
  {
    name: "Singles — Low to High, Easy",
    rulesetVersionKey: "SINGLES_V1",
    configuration: {
      order_mode: "LOW_TO_HIGH",
      difficulty: "EASY",
    },
  },
```

with:

```ts
  {
    name: "Singles — Low to High, Easy",
    rulesetVersionKey: "SINGLES_V1",
    configuration: {
      order_mode: "LOW_TO_HIGH",
      difficulty: "EASY",
      target_order: [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        25,
      ],
    },
  },
```

and replace:

```ts
  {
    name: "Doubles Training — Easy, Low to High",
    rulesetVersionKey: "DOUBLES_TRAINING_V1",
    configuration: {
      mode: "EASY",
      order_mode: "LOW_TO_HIGH",
    },
  },
```

with:

```ts
  {
    name: "Doubles Training — Easy, Low to High",
    rulesetVersionKey: "DOUBLES_TRAINING_V1",
    configuration: {
      mode: "EASY",
      order_mode: "LOW_TO_HIGH",
      target_order: [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        25,
      ],
    },
  },
```

`app/tests/modules/game/dart-fact-target-consistency.test.ts` — replace:

```ts
const doublesConfig: DoublesTrainingSnapshot = {
  mode: "EASY",
  orderMode: "LOW_TO_HIGH",
};
```

with:

```ts
const doublesConfig: DoublesTrainingSnapshot = {
  mode: "EASY",
  orderMode: "LOW_TO_HIGH",
  targetOrder: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
  ],
};
```

and replace:

```ts
const singlesConfig: SinglesSnapshot = {
  orderMode: "LOW_TO_HIGH",
  difficulty: "EASY",
  pointsSingle: 1,
  pointsDouble: 2,
  pointsTreble: 3,
};
```

with:

```ts
const singlesConfig: SinglesSnapshot = {
  orderMode: "LOW_TO_HIGH",
  targetOrder: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25,
  ],
  difficulty: "EASY",
  pointsSingle: 1,
  pointsDouble: 2,
  pointsTreble: 3,
};
```

`app/tests/modules/game/engine-reference-isolation.test.ts` — replace:

```ts
      const engine = singlesTrainingEngineFactory.create({
        orderMode: "LOW_TO_HIGH",
        difficulty: "EASY",
        pointsSingle: 1,
        pointsDouble: 2,
        pointsTreble: 3,
      });
```

with:

```ts
      const engine = singlesTrainingEngineFactory.create({
        orderMode: "LOW_TO_HIGH",
        targetOrder: [
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
          20, 25,
        ],
        difficulty: "EASY",
        pointsSingle: 1,
        pointsDouble: 2,
        pointsTreble: 3,
      });
```

and replace:

```ts
      const engine = doublesTrainingEngineFactory.create({
        mode: "EASY",
        orderMode: "LOW_TO_HIGH",
      });
```

with:

```ts
      const engine = doublesTrainingEngineFactory.create({
        mode: "EASY",
        orderMode: "LOW_TO_HIGH",
        targetOrder: [
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
          20, 25,
        ],
      });
```

- [ ] **Step 7: Fix the now-stale "V2+" test title in `config-codec.test.ts`**

`order_mode: "RANDOM"` is no longer a V2+-only value, so this test's premise is wrong even though it still happens to pass (rejected for the unrelated `difficulty: "HARD"` and the missing `target_order`). Replace:

```ts
  it("rejects V2+ values the V1 rulesets do not support", () => {
    expect(() =>
      toSnapshot("SINGLES_V1", { order_mode: "RANDOM", difficulty: "HARD" }),
    ).toThrow();
  });
```

with:

```ts
  it("rejects values no V1 ruleset supports", () => {
    expect(() =>
      toSnapshot("SINGLES_V1", { order_mode: "SIDEWAYS", difficulty: "HARD" }),
    ).toThrow();
  });
```

- [ ] **Step 8: Run the full suite to confirm green**

Run: `cd app && npm test`
Expected: PASS, 0 failures.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/game/rulesets/types.ts app/src/lib/game/rulesets/refinement-contract.ts \
  app/tests/modules/game/singles-training.engine.module.test.ts \
  app/tests/modules/game/doubles-training.engine.module.test.ts \
  app/tests/services/rulesets/singles-training/singles-training.validator.test.ts \
  app/tests/services/rulesets/doubles-training/doubles-training.validator.test.ts \
  app/tests/lib/game/singles-training-setup.data.test.ts \
  app/tests/lib/game/doubles-training-setup.data.test.ts \
  app/tests/lib/game/singles-training-play.data.test.ts \
  app/tests/lib/game/doubles-training-play.data.test.ts \
  app/tests/services/session.service.test.ts \
  app/tests/lib/game/rulesets/seeded-presets.test.ts \
  app/tests/modules/game/dart-fact-target-consistency.test.ts \
  app/tests/modules/game/engine-reference-isolation.test.ts \
  app/tests/lib/game/rulesets/config-codec.test.ts
git commit -m "Widen Singles/Doubles Training config schema with target_order"
```

---

### Task 3: `board-progression.module.ts` — order-aware paths

**Files:**
- Modify: `app/src/modules/game/board-progression.module.ts`
- Test: `app/tests/modules/game/board-progression.module.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `numbersPath(order?: readonly number[])` / `doublesPath(order?: readonly number[])` — when `order` is given, build the 21-target path from it (BULL wherever `25` sits); when omitted, return today's fixed ascending path unchanged. Tasks 4–7 call these with `config.targetOrder`.

- [ ] **Step 1: Write the failing test**

Append to `app/tests/modules/game/board-progression.module.test.ts`:

```ts
describe("numbersPath / doublesPath with an explicit order", () => {
  it("builds a NUMBER path from a given order, BULL wherever the sentinel sits", () => {
    const path = numbersPath([25, 3, 1]);
    expect(path).toEqual([
      { kind: "BULL" },
      { kind: "NUMBER", number: 3 },
      { kind: "NUMBER", number: 1 },
    ]);
  });

  it("builds a DOUBLE path from a given order, BULL wherever the sentinel sits", () => {
    const path = doublesPath([3, 25, 1]);
    expect(path).toEqual([
      { kind: "DOUBLE", number: 3 },
      { kind: "BULL" },
      { kind: "DOUBLE", number: 1 },
    ]);
  });

  it("falls back to the fixed ascending path when no order is given", () => {
    const ascending = [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      25,
    ];
    expect(numbersPath()).toEqual(numbersPath(ascending));
    expect(doublesPath()).toEqual(doublesPath(ascending));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/board-progression.module.test.ts`
Expected: FAIL — `numbersPath`/`doublesPath` currently take no parameters, so passing one is a type error under `astro check` and the shuffled-order assertions fail at runtime (both calls return the same fixed ascending path regardless of the argument).

- [ ] **Step 3: Implement**

Replace:

```ts
export function doublesPath(): readonly BoardTarget[] {
  return DOUBLES_PATH;
}

export function numbersPath(): readonly BoardTarget[] {
  return NUMBERS_PATH;
}
```

with:

```ts
/**
 * Builds a 21-target path from an explicit order array (a permutation of
 * 1..20 and `BULL_TARGET_NUMBER`) — used when a session's `target_order`
 * config differs from the default ascending order (Singles/Doubles
 * Training's High→Low and Random order modes).
 */
function pathFromOrder(
  order: readonly number[],
  kind: "NUMBER" | "DOUBLE",
): readonly BoardTarget[] {
  return order.map((n): BoardTarget =>
    n === BULL_TARGET_NUMBER ? { kind: "BULL" } : { kind, number: n },
  );
}

export function doublesPath(
  order?: readonly number[],
): readonly BoardTarget[] {
  return order ? pathFromOrder(order, "DOUBLE") : DOUBLES_PATH;
}

export function numbersPath(
  order?: readonly number[],
): readonly BoardTarget[] {
  return order ? pathFromOrder(order, "NUMBER") : NUMBERS_PATH;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/board-progression.module.test.ts`
Expected: PASS — all cases, including the pre-existing no-arg ones, green.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/board-progression.module.ts app/tests/modules/game/board-progression.module.test.ts
git commit -m "Make numbersPath/doublesPath build from an explicit target order"
```

---

### Task 4: Singles engine — config-driven path and index-based completion

**Files:**
- Modify: `app/src/modules/game/singles-training.engine.module.ts`
- Test: `app/tests/modules/game/singles-training.engine.module.test.ts`

**Interfaces:**
- Consumes: `numbersPath(order?)` (Task 3); `SinglesSnapshot.targetOrder` (Task 2).
- Produces: `applySinglesTrainingDart`'s completion rule is now "the 21st (index-20) target resolved", not "target.kind === BULL" — Task 6 relies on this for `isBullVisit`/`currentTargetLabel` staying correct regardless of where BULL sits.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/modules/game/singles-training.engine.module.test.ts`:

```ts
describe("applySinglesTrainingDart — order-dependent completion", () => {
  it("does not complete on the first (bull) visit under a HIGH_TO_LOW order", () => {
    const highToLowConfig: SinglesSnapshot = {
      ...config,
      orderMode: "HIGH_TO_LOW",
      targetOrder: [
        25, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
        2, 1,
      ],
    };
    let state = initialSinglesTrainingState();
    for (let dart = 0; dart < 3; dart++) {
      state = applySinglesTrainingDart(highToLowConfig, state, {
        hitTargetNumber: 25,
        hitZoneKey: "OUTER_BULL",
        locationX: null,
        locationY: null,
      });
    }
    expect(state.status).toBe("IN_PROGRESS");
    expect(state.targetIndex).toBe(1);
  });

  it("completes on the last target of a RANDOM order even though it is not BULL", () => {
    const randomConfig: SinglesSnapshot = {
      ...config,
      orderMode: "RANDOM",
      targetOrder: [
        25, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        20,
      ],
    };
    const twoDartsIn: SinglesTrainingState = {
      targetIndex: 20,
      totalPoints: 0,
      dartsThisVisit: 2,
      status: "IN_PROGRESS",
    };
    const next = applySinglesTrainingDart(randomConfig, twoDartsIn, {
      hitTargetNumber: 20,
      hitZoneKey: "SINGLE",
      locationX: null,
      locationY: null,
    });
    expect(next.status).toBe("COMPLETE");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: FAIL — the first case completes after 3 darts (current code completes on any `target.kind === "BULL"` visit, and BULL is `targetIndex` 0 under this order); the second case never completes (index 20 with a NUMBER 20 target does not satisfy `target.kind === "BULL"` under current code).

- [ ] **Step 3: Implement**

Replace:

```ts
  const target = targetAt(numbersPath(), state.targetIndex);
  const totalPoints =
    state.totalPoints + trainingPointsFor(target, config, observation);
  const dartsThisVisit = state.dartsThisVisit + 1;

  if (dartsThisVisit < 3) {
    return { ...state, totalPoints, dartsThisVisit };
  }

  if (target.kind === "BULL") {
    return { ...state, totalPoints, dartsThisVisit: 0, status: "COMPLETE" };
  }
  return {
    ...state,
    totalPoints,
    dartsThisVisit: 0,
    targetIndex: state.targetIndex + 1,
  };
```

with:

```ts
  const target = targetAt(numbersPath(config.targetOrder), state.targetIndex);
  const totalPoints =
    state.totalPoints + trainingPointsFor(target, config, observation);
  const dartsThisVisit = state.dartsThisVisit + 1;

  if (dartsThisVisit < 3) {
    return { ...state, totalPoints, dartsThisVisit };
  }

  if (state.targetIndex === 20) {
    return { ...state, totalPoints, dartsThisVisit: 0, status: "COMPLETE" };
  }
  return {
    ...state,
    totalPoints,
    dartsThisVisit: 0,
    targetIndex: state.targetIndex + 1,
  };
```

Update the doc comment directly above `applySinglesTrainingDart` — replace:

```ts
/**
 * Pure reducer: folds one dart observation onto a `SinglesTrainingState`.
 * Training points are ring quality relative to the current target — a hit
 * on any other number scores zero regardless of ring, and BULL only ever
 * awards its single/double points, never treble. A visit resolves on its
 * 3rd dart: BULL completes the session, any other target advances to the
 * next one on the path.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
```

with:

```ts
/**
 * Pure reducer: folds one dart observation onto a `SinglesTrainingState`.
 * Training points are ring quality relative to the current target — a hit
 * on any other number scores zero regardless of ring, and BULL only ever
 * awards its single/double points, never treble. A visit resolves on its
 * 3rd dart: resolving the 21st (last) target in `config.targetOrder`
 * completes the session — not necessarily a BULL visit, since High→Low and
 * Random order modes can put BULL anywhere in the path; any other target
 * advances to the next one in the order.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/singles-training.engine.module.test.ts`
Expected: PASS — new cases green, and every pre-existing test in this file still green (they all use the ascending `config` from Task 2, where BULL still sits at index 20, so behavior is unchanged for them).

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/singles-training.engine.module.ts app/tests/modules/game/singles-training.engine.module.test.ts
git commit -m "Make Singles Training completion index-based, not BULL-kind-based"
```

---

### Task 5: Doubles engine — config-driven path and retained config

**Files:**
- Modify: `app/src/modules/game/doubles-training.engine.module.ts`
- Test: `app/tests/modules/game/doubles-training.engine.module.test.ts`

**Interfaces:**
- Consumes: `doublesPath(order?)` (Task 3); `DoublesTrainingSnapshot.targetOrder` (Task 2).
- Produces: `applyDoublesTrainingDart(config, state, observation)` — gains a required `config` first parameter (was `(state, observation)`). `DoublesTrainingEngine`'s constructor now retains `config` as a field (previously discarded).

- [ ] **Step 1: Update the test file's call sites and config-carrying literals to match the new signature**

`applyDoublesTrainingDart` is about to require `config` as its first argument. Every existing call in this test file passes only `(state, observation)`; insert `config` as the new first argument at every call site with:

```bash
cd app
sed -i 's/applyDoublesTrainingDart(/applyDoublesTrainingDart(config, /g' tests/modules/game/doubles-training.engine.module.test.ts
```

This is safe here: the only occurrences of the literal substring `applyDoublesTrainingDart(` in this file are calls (the import statement reads `applyDoublesTrainingDart,` with a comma, never followed by an open paren).

- [ ] **Step 2: Write the new failing tests**

Append:

```ts
describe("applyDoublesTrainingDart — order-dependent completion", () => {
  it("does not complete on the first (bull) visit under a HIGH_TO_LOW order", () => {
    const highToLowConfig: DoublesTrainingSnapshot = {
      ...config,
      orderMode: "HIGH_TO_LOW",
      targetOrder: [
        25, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
        2, 1,
      ],
    };
    const state = initialDoublesTrainingState();
    const next = applyDoublesTrainingDart(highToLowConfig, state, {
      hitTargetNumber: 25,
      hitZoneKey: "INNER_BULL",
      locationX: null,
      locationY: null,
    });
    expect(next.status).toBe("IN_PROGRESS");
    expect(next.targetIndex).toBe(1);
  });

  it("completes on the last target of a RANDOM order even though it is not BULL", () => {
    const randomConfig: DoublesTrainingSnapshot = {
      ...config,
      orderMode: "RANDOM",
      targetOrder: [
        25, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
        20,
      ],
    };
    const state: DoublesTrainingState = {
      targetIndex: 20,
      dartsThisVisit: 0,
      outcomes: [],
      status: "IN_PROGRESS",
    };
    const next = applyDoublesTrainingDart(randomConfig, state, {
      hitTargetNumber: 20,
      hitZoneKey: "DOUBLE",
      locationX: null,
      locationY: null,
    });
    expect(next.status).toBe("COMPLETE");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts`
Expected: FAIL — `applyDoublesTrainingDart` does not yet accept a `config` argument at all (compile error), and once compiling, the two new cases fail against the still-fixed-ascending-path implementation.

- [ ] **Step 4: Implement**

Replace the reducer signature and target lookup:

```ts
export function applyDoublesTrainingDart(
  state: DoublesTrainingState,
  observation: DartObservation,
): DoublesTrainingState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session is complete; undo first to correct it.",
    );
  }

  const target = targetAt(doublesPath(), state.targetIndex);
```

with:

```ts
export function applyDoublesTrainingDart(
  config: DoublesTrainingSnapshot,
  state: DoublesTrainingState,
  observation: DartObservation,
): DoublesTrainingState {
  if (state.status !== "IN_PROGRESS") {
    throw new Error(
      "Cannot record a dart once the session is complete; undo first to correct it.",
    );
  }

  const target = targetAt(doublesPath(config.targetOrder), state.targetIndex);
```

Update the doc comment above it — replace:

```ts
/**
 * Pure reducer: folds one dart observation onto a `DoublesTrainingState`.
 * Unlike Bob's 27 or Singles Training, a visit here resolves the instant any
 * dart hits its double (or `INNER_BULL` on the final target) — the 2nd and
 * 3rd darts are never thrown in that case. A full miss still resolves on the
 * 3rd dart. Either way the visit's outcome is folded into `outcomes` and the
 * path advances; the final (BULL) target's resolution completes the session.
 * Doubles Training's `mode`/`orderMode` snapshot has no effect on this
 * reducer today — both fields carry exactly one valid value in
 * `DOUBLES_TRAINING_V1` — so it is threaded through the engine's constructor
 * for factory-contract parity and future config-driven variations, not into
 * this pure function.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
```

with:

```ts
/**
 * Pure reducer: folds one dart observation onto a `DoublesTrainingState`.
 * Unlike Bob's 27 or Singles Training, a visit here resolves the instant any
 * dart hits its double (or `INNER_BULL` on the final target) — the 2nd and
 * 3rd darts are never thrown in that case. A full miss still resolves on the
 * 3rd dart. Either way the visit's outcome is folded into `outcomes` and the
 * path advances; resolving the 21st (last) target in `config.targetOrder`
 * completes the session — not necessarily a BULL visit, since High→Low and
 * Random order modes can put BULL anywhere in the path.
 * `config.mode` still carries exactly one valid value in
 * `DOUBLES_TRAINING_V1` and has no effect on this reducer; only
 * `config.targetOrder` (derived from `order_mode` at session creation) does.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
```

`resolveVisit`'s `state.targetIndex === 20` check is unchanged — it was already index-based.

Now thread `config` through the class. Replace the constructor and its doc comment:

```ts
  /**
   * The config snapshot is accepted positionally for `GameEngineFactory`
   * parity, so a future `DOUBLES_TRAINING_V1` mode/order variant can drive
   * behavior without a signature change. It is deliberately not retained as
   * a field: `DoublesTrainingConfig` locks `mode` to `EASY` and `order_mode`
   * to `LOW_TO_HIGH` (single-value `.strict()` enums in
   * `lib/game/rulesets/types.ts`), so Zod already guarantees the only values
   * V1 can carry and nothing here would read them. Storing it instead left
   * an unread private property — `ts(6138)` in `astro check`, and a false
   * claim that this engine is config-driven when the other five genuinely
   * are.
   */
  constructor(_config: DoublesTrainingSnapshot, prior?: EngineFacts) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }
```

with:

```ts
  constructor(
    private readonly config: DoublesTrainingSnapshot,
    prior?: EngineFacts,
  ) {
    this.turns = prior ? cloneTurns(prior.turns) : [];
  }
```

Replace `deriveState()`'s reducer call:

```ts
        state = applyDoublesTrainingDart(state, {
          hitTargetNumber: dart.hitTargetNumber,
          hitZoneKey: dart.hitZoneKey,
          locationX: dart.locationX,
          locationY: dart.locationY,
        });
```

with:

```ts
        state = applyDoublesTrainingDart(this.config, state, {
          hitTargetNumber: dart.hitTargetNumber,
          hitZoneKey: dart.hitZoneKey,
          locationX: dart.locationX,
          locationY: dart.locationY,
        });
```

Replace `record()`'s target lookup and reducer call:

```ts
  record(observation: DartObservation): DoublesTrainingState {
    const before = this.deriveState();
    const target = targetAt(doublesPath(), before.targetIndex);
    const after = applyDoublesTrainingDart(before, observation);
```

with:

```ts
  record(observation: DartObservation): DoublesTrainingState {
    const before = this.deriveState();
    const target = targetAt(
      doublesPath(this.config.targetOrder),
      before.targetIndex,
    );
    const after = applyDoublesTrainingDart(this.config, before, observation);
```

Replace `wouldComplete()`'s reducer call:

```ts
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;

    const after = applyDoublesTrainingDart(before, observation);
    return after.status !== "IN_PROGRESS";
  }
```

with:

```ts
  wouldComplete(observation: DartObservation): boolean {
    const before = this.deriveState();
    if (before.status !== "IN_PROGRESS") return false;

    const after = applyDoublesTrainingDart(this.config, before, observation);
    return after.status !== "IN_PROGRESS";
  }
```

Finally, update the class-level doc comment — replace:

```ts
/**
 * Doubles Training: a fixed path of 21 targets (D1..D20, then BULL), each
 * visit ending the instant a dart hits its double — the 2nd and 3rd darts of
 * that visit are never thrown — or after 3 misses. The engine owns the fact
 * log — `state()` derives the current target, in-visit dart count and
 * completion by folding `facts()` through `applyDoublesTrainingDart`; the
 * per-visit `outcomes` (which dart hit, or none) are likewise derived, never
 * stored.
 */
```

with:

```ts
/**
 * Doubles Training: a 21-target path (the 20 doubles and BULL, in the
 * session's configured `target_order`), each visit ending the instant a dart
 * hits its double — the 2nd and 3rd darts of that visit are never thrown —
 * or after 3 misses. The engine owns the fact log — `state()` derives the
 * current target, in-visit dart count and completion by folding `facts()`
 * through `applyDoublesTrainingDart`; the per-visit `outcomes` (which dart
 * hit, or none) are likewise derived, never stored.
 */
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/doubles-training.engine.module.test.ts`
Expected: PASS — new cases and every sed-updated pre-existing case green.

- [ ] **Step 6: Commit**

```bash
git add app/src/modules/game/doubles-training.engine.module.ts app/tests/modules/game/doubles-training.engine.module.test.ts
git commit -m "Thread config.targetOrder through Doubles Training's reducer and engine"
```

---

### Task 6: Singles play-data — config-aware path lookups

**Files:**
- Modify: `app/src/lib/game/singles-training-play.data.ts`
- Test: `app/tests/lib/game/singles-training-play.data.test.ts`

**Interfaces:**
- Consumes: `numbersPath(order?)` (Task 3); `configSnapshot.targetOrder` via `this.$store.game.configSnapshot` (Task 2).
- Produces: no new exports — `currentTargetLabel`, `isBullVisit`, `recordTap`, and the module-level `previewSegmentsFor` now read the session's own order instead of the fixed default.

- [ ] **Step 1: Write the failing test**

Append to the `describe("currentTargetLabel / currentPoints / isBullVisit", ...)` block in `app/tests/lib/game/singles-training-play.data.test.ts`:

```ts
  it("shows BULL first under a HIGH_TO_LOW order, not target 1", async () => {
    const play = makePlay({
      configSnapshot: {
        ...defaultConfig(),
        orderMode: "HIGH_TO_LOW",
        targetOrder: [
          25, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
          2, 1,
        ],
      },
    });
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("BULL");
    expect(play.isBullVisit.call(play)).toBe(true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts -t "shows BULL first"`
Expected: FAIL — `currentTargetLabel`/`isBullVisit` still read the fixed ascending `numbersPath()`, so target 1 (not BULL) is current.

- [ ] **Step 3: Implement**

Replace the module-level `previewSegmentsFor`'s target lookup:

```ts
  const target = targetAt(numbersPath(), turns.length - 1);
```

with:

```ts
  const target = targetAt(numbersPath(config.targetOrder), turns.length - 1);
```

(`config` is already the function's non-null-checked parameter at this point in the file.)

Replace:

```ts
    currentTargetLabel(this: SinglesTrainingPlayContext): string {
      if (!this.engine) return "";
      const target = targetAt(numbersPath(), this.engine.state().targetIndex);
      return target.kind === "BULL" ? "BULL" : String(target.number);
    },
```

with:

```ts
    currentTargetLabel(this: SinglesTrainingPlayContext): string {
      const config = this.$store.game.configSnapshot;
      if (!this.engine || !config) return "";
      const target = targetAt(
        numbersPath(config.targetOrder),
        this.engine.state().targetIndex,
      );
      return target.kind === "BULL" ? "BULL" : String(target.number);
    },
```

Replace:

```ts
    isBullVisit(this: SinglesTrainingPlayContext): boolean {
      if (!this.engine) return false;
      return (
        targetAt(numbersPath(), this.engine.state().targetIndex).kind === "BULL"
      );
    },
```

with:

```ts
    isBullVisit(this: SinglesTrainingPlayContext): boolean {
      const config = this.$store.game.configSnapshot;
      if (!this.engine || !config) return false;
      return (
        targetAt(numbersPath(config.targetOrder), this.engine.state().targetIndex)
          .kind === "BULL"
      );
    },
```

Replace:

```ts
    async recordTap(
      this: SinglesTrainingPlayContext,
      ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
    ) {
      if (!this.engine || this.finished) return;
      const target = targetAt(numbersPath(), this.engine.state().targetIndex);
```

with:

```ts
    async recordTap(
      this: SinglesTrainingPlayContext,
      ring: "SINGLE" | "DOUBLE" | "TREBLE" | "MISS",
    ) {
      const config = this.$store.game.configSnapshot;
      if (!this.engine || !config || this.finished) return;
      const target = targetAt(
        numbersPath(config.targetOrder),
        this.engine.state().targetIndex,
      );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts`
Expected: PASS — new case and the full file (every pre-existing test uses the ascending `defaultConfig()`, unaffected).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/singles-training-play.data.ts app/tests/lib/game/singles-training-play.data.test.ts
git commit -m "Read Singles Training's target order from the session config"
```

---

### Task 7: Doubles play-data — config-aware path lookups

**Files:**
- Modify: `app/src/lib/game/doubles-training-play.data.ts`
- Test: `app/tests/lib/game/doubles-training-play.data.test.ts`

**Interfaces:**
- Consumes: `doublesPath(order?)` (Task 3); `configSnapshot.targetOrder` (Task 2).
- Produces: `currentTargetLabel`/`recordTap` now read the session's own order.

- [ ] **Step 1: Write the failing test**

Append to the `describe("currentTargetLabel", ...)` block in `app/tests/lib/game/doubles-training-play.data.test.ts`:

```ts
  it("shows BULL first under a HIGH_TO_LOW order, not D1", async () => {
    const play = makePlay({
      configSnapshot: {
        ...defaultConfig(),
        orderMode: "HIGH_TO_LOW",
        targetOrder: [
          25, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
          2, 1,
        ],
      },
    });
    await play.init.call(play);
    expect(play.currentTargetLabel.call(play)).toBe("BULL");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts -t "shows BULL first"`
Expected: FAIL — `currentTargetLabel` still reads the fixed ascending `doublesPath()`, so D1 (not BULL) is current.

- [ ] **Step 3: Implement**

Replace:

```ts
    currentTargetLabel(this: DoublesTrainingPlayContext): string {
      if (!this.engine) return "";
      return doublesPathTargetLabel(
        targetAt(doublesPath(), this.engine.state().targetIndex),
      );
    },
```

with:

```ts
    currentTargetLabel(this: DoublesTrainingPlayContext): string {
      const config = this.$store.game.configSnapshot;
      if (!this.engine || !config) return "";
      return doublesPathTargetLabel(
        targetAt(
          doublesPath(config.targetOrder),
          this.engine.state().targetIndex,
        ),
      );
    },
```

Replace:

```ts
    async recordTap(this: DoublesTrainingPlayContext, hit: boolean) {
      if (!this.engine || this.finished) return;
      const target = targetAt(doublesPath(), this.engine.state().targetIndex);
      await this.commitDart(doublesPathObservation(target, hit));
    },
```

with:

```ts
    async recordTap(this: DoublesTrainingPlayContext, hit: boolean) {
      const config = this.$store.game.configSnapshot;
      if (!this.engine || !config || this.finished) return;
      const target = targetAt(
        doublesPath(config.targetOrder),
        this.engine.state().targetIndex,
      );
      await this.commitDart(doublesPathObservation(target, hit));
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/doubles-training-play.data.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/doubles-training-play.data.ts app/tests/lib/game/doubles-training-play.data.test.ts
git commit -m "Read Doubles Training's target order from the session config"
```

---

### Task 8: `runPlayAgain` gains an optional override hook

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts`
- Modify: `app/src/lib/game/types.ts`
- Test: `app/tests/lib/game/play-lifecycle.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `export type PlayAgainOverrides<TConfig> = { snapshot: TConfig; wire: Record<string, unknown> }` (in `types.ts`). `runPlayAgain(context, gameTypeKey, rulesetVersionKey, narrowEngine, buildOverrides?: (priorConfig: TConfig) => PlayAgainOverrides<TConfig>)` — when `buildOverrides` is omitted, behavior is byte-for-byte unchanged (today's only two callers, pre-Task-10, still pass nothing). Task 10 supplies `buildOverrides` from both training games' play-data.

- [ ] **Step 1: Write the failing tests**

In `app/tests/lib/game/play-lifecycle.test.ts`, add inside `describe("runPlayAgain", ...)`, after the existing two `it`s:

```ts
  it("sends overrides and adopts the new snapshot when buildOverrides is supplied", async () => {
    const context = makeContext({
      finished: true,
      completionStatus: "succeeded",
    });
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

    await runPlayAgain(
      context,
      GAME_TYPE_KEY,
      RULESET_VERSION_KEY,
      (engine) => (engine instanceof FakeEngine ? engine : null),
      () => ({
        snapshot: { label: "fresh" },
        wire: { some_key: "value" },
      }),
    );

    expect(createSession).toHaveBeenCalledWith({
      gameTypeKey: GAME_TYPE_KEY,
      rulesetVersionKey: RULESET_VERSION_KEY,
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
      config: {
        source: "template",
        templateRef: "tpl-1",
        overrides: { some_key: "value" },
      },
    });
    expect(context.$store.game.configSnapshot).toEqual({ label: "fresh" });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts -t "sends overrides"`
Expected: FAIL — `runPlayAgain` does not yet accept a 5th argument (type error), and `createSession` is called without `overrides`.

- [ ] **Step 3: Implement**

In `app/src/lib/game/types.ts`, immediately after the closing `};` of `PlayLifecycleContext`, insert:

```ts
/**
 * What `runPlayAgain`'s optional `buildOverrides` callback returns: the
 * locally-merged config snapshot for the new session (config-shaped,
 * camelCase) plus the wire-shaped (snake_case) `overrides` sent to
 * `POST /api/sessions`. Both are ruleset-specific, so the caller — not
 * `play-lifecycle.ts` — builds them; this keeps `runPlayAgain` itself
 * generic over `TConfig`.
 */
export type PlayAgainOverrides<TConfig> = {
  snapshot: TConfig;
  wire: Record<string, unknown>;
};
```

In `app/src/lib/game/play-lifecycle.ts`, replace the import of `PlayLifecycleContext`/`PlayStoreContext`:

```ts
import type { PlayLifecycleContext, PlayStoreContext } from "./types";
```

with:

```ts
import type {
  PlayAgainOverrides,
  PlayLifecycleContext,
  PlayStoreContext,
} from "./types";
```

Replace the whole `runPlayAgain` function:

```ts
export async function runPlayAgain<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  gameTypeKey: string,
  rulesetVersionKey: RulesetVersionKey,
  narrowEngine: (engine: GameEngine<unknown, unknown>) => TEngine | null,
): Promise<void> {
  const config = context.$store.game.configSnapshot;
  const templateRef = context.$store.game.templateRef;
  if (!config || !templateRef || context.playAgainLoading) return;
  const factory = getEngineFactory(rulesetVersionKey);
  if (!factory) return;

  context.playAgainLoading = true;
  context.playAgainError = "";

  const modePair = resolveSessionModePair(
    rulesetVersionKey,
    context.$store.settings,
  );

  try {
    let session;
    try {
      session = await createSession({
        gameTypeKey,
        rulesetVersionKey,
        captureModeKey: modePair.captureModeKey,
        inputModeKey: modePair.inputModeKey,
        config: { source: "template", templateRef },
      });
    } catch {
      context.playAgainError = "Could not start a new session. Try again.";
      return;
    }

    context.$store.game.sessionId = session.sessionId;
    context.$store.game.participantRef = session.participants[0].ref;
    context.$store.game.idempotencyKey = null;
    context.$store.game.setSessionModes(modePair);

    context.finished = false;
    context.completionStatus = "pending";
    context.completionError = "";
    context.resultsSnapshot = null;
    context.hiddenTurnKey = null;
    context.error = "";
    context.hasActiveSession = true;

    const engine = narrowEngine(factory.create(config));
    if (!engine) return;
    context.engine = engine;
    context.$store.game.recordFacts(engine.facts());
  } finally {
    context.playAgainLoading = false;
  }
}
```

with:

```ts
export async function runPlayAgain<
  TConfig,
  TEngine extends GameEngine<DartObservation, unknown>,
  TResults,
>(
  context: PlayLifecycleContext<TConfig, TEngine, TResults>,
  gameTypeKey: string,
  rulesetVersionKey: RulesetVersionKey,
  narrowEngine: (engine: GameEngine<unknown, unknown>) => TEngine | null,
  buildOverrides?: (priorConfig: TConfig) => PlayAgainOverrides<TConfig>,
): Promise<void> {
  const config = context.$store.game.configSnapshot;
  const templateRef = context.$store.game.templateRef;
  if (!config || !templateRef || context.playAgainLoading) return;
  const factory = getEngineFactory(rulesetVersionKey);
  if (!factory) return;

  context.playAgainLoading = true;
  context.playAgainError = "";

  const modePair = resolveSessionModePair(
    rulesetVersionKey,
    context.$store.settings,
  );
  const overrides = buildOverrides ? buildOverrides(config) : null;
  const nextConfigSnapshot = overrides ? overrides.snapshot : config;

  try {
    let session;
    try {
      session = await createSession({
        gameTypeKey,
        rulesetVersionKey,
        captureModeKey: modePair.captureModeKey,
        inputModeKey: modePair.inputModeKey,
        config: overrides
          ? { source: "template", templateRef, overrides: overrides.wire }
          : { source: "template", templateRef },
      });
    } catch {
      context.playAgainError = "Could not start a new session. Try again.";
      return;
    }

    context.$store.game.sessionId = session.sessionId;
    context.$store.game.participantRef = session.participants[0].ref;
    context.$store.game.idempotencyKey = null;
    context.$store.game.configSnapshot = nextConfigSnapshot;
    context.$store.game.setSessionModes(modePair);

    context.finished = false;
    context.completionStatus = "pending";
    context.completionError = "";
    context.resultsSnapshot = null;
    context.hiddenTurnKey = null;
    context.error = "";
    context.hasActiveSession = true;

    const engine = narrowEngine(factory.create(nextConfigSnapshot));
    if (!engine) return;
    context.engine = engine;
    context.$store.game.recordFacts(engine.facts());
  } finally {
    context.playAgainLoading = false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts`
Expected: PASS — new case and the two pre-existing `runPlayAgain` cases (which call it without a 5th argument, so `overrides` stays `null` and behavior is identical to before).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/play-lifecycle.ts app/src/lib/game/types.ts app/tests/lib/game/play-lifecycle.test.ts
git commit -m "Let runPlayAgain accept a config-overrides hook"
```

---

### Task 9: Setup UI — order-mode Toggle on both games

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/singles-training-setup.data.ts`
- Modify: `app/src/lib/game/doubles-training-setup.data.ts`
- Modify: `app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/DoublesTrainingSetupForm.astro`
- Test: `app/tests/lib/game/singles-training-setup.data.test.ts`
- Test: `app/tests/lib/game/doubles-training-setup.data.test.ts`

**Interfaces:**
- Consumes: `targetOrderFor` (Task 1); `SinglesTrainingSetupContext`/`DoublesTrainingSetupContext` (extended here).
- Produces: both setup contexts gain `orderMode: TargetOrderMode` (default `"LOW_TO_HIGH"`); `start()` on both sends `config.overrides = { order_mode, target_order }` and folds the same into the local `configSnapshot`.

- [ ] **Step 1: Add `orderMode` to both setup context types**

In `app/src/lib/game/types.ts`, add the import (alongside the existing `@lib/game/...`-relative imports at the top of the file — insert a new import line):

```ts
import type { TargetOrderMode } from "./target-order";
```

Replace, in `SinglesTrainingSetupContext`:

```ts
export type SinglesTrainingSetupContext = {
  presets: ConfigurationPresetData[];
  loading: boolean;
```

with:

```ts
export type SinglesTrainingSetupContext = {
  presets: ConfigurationPresetData[];
  orderMode: TargetOrderMode;
  loading: boolean;
```

Replace, in `DoublesTrainingSetupContext`:

```ts
export type DoublesTrainingSetupContext = {
  presets: ConfigurationPresetData[];
  loading: boolean;
```

with:

```ts
export type DoublesTrainingSetupContext = {
  presets: ConfigurationPresetData[];
  orderMode: TargetOrderMode;
  loading: boolean;
```

- [ ] **Step 2: Write the failing setup-data tests**

In `app/tests/lib/game/singles-training-setup.data.test.ts`, replace the first `it` in `describe("start", ...)`:

```ts
    it("creates a session from the seeded preset with no overrides and redirects", async () => {
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
        gameTypeKey: "SINGLES_TRAINING",
        rulesetVersionKey: "SINGLES_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
        config: {
          source: "template",
          templateRef: "tmpl-singles-standard",
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-singles-standard",
          configSnapshot: expect.objectContaining({
            orderMode: "LOW_TO_HIGH",
            difficulty: "EASY",
            pointsSingle: 1,
            pointsDouble: 2,
            pointsTreble: 3,
          }),
        }),
      );
      expect(locationSpy.href).toBe("/games/singles-training/play");
    });
```

with:

```ts
    it("creates a session with the default order mode override and redirects", async () => {
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

      const ascending = [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        25,
      ];
      expect(sessionsApi.createSession).toHaveBeenCalledWith({
        gameTypeKey: "SINGLES_TRAINING",
        rulesetVersionKey: "SINGLES_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
        config: {
          source: "template",
          templateRef: "tmpl-singles-standard",
          overrides: { order_mode: "LOW_TO_HIGH", target_order: ascending },
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-singles-standard",
          configSnapshot: expect.objectContaining({
            orderMode: "LOW_TO_HIGH",
            targetOrder: ascending,
            difficulty: "EASY",
            pointsSingle: 1,
            pointsDouble: 2,
            pointsTreble: 3,
          }),
        }),
      );
      expect(locationSpy.href).toBe("/games/singles-training/play");
    });

    it("sends the selected order mode and its resolved target order", async () => {
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        orderMode: "HIGH_TO_LOW",
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

      const descending = [
        25, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
        2, 1,
      ];
      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            overrides: { order_mode: "HIGH_TO_LOW", target_order: descending },
          }),
        }),
      );
    });
```

Replace the "rejects a preset whose configuration fails schema validation" test's fixture (its `order_mode: "SIDEWAYS"` premise no longer holds — `start()` now always overrides `order_mode`/`target_order`, so an invalid `order_mode` on the preset alone can never reach validation):

```ts
    it("rejects a preset whose configuration fails schema validation, before creating a session", async () => {
      const setup = createSetup({
        presets: [
          {
            ...STANDARD_PRESET,
            configuration: { order_mode: "SIDEWAYS" },
          },
        ],
      });
```

with:

```ts
    it("rejects a preset whose configuration fails schema validation, before creating a session", async () => {
      const setup = createSetup({
        presets: [
          {
            ...STANDARD_PRESET,
            configuration: { ...STANDARD_PRESET.configuration, difficulty: "SIDEWAYS" },
          },
        ],
      });
```

Apply the equivalent changes to `app/tests/lib/game/doubles-training-setup.data.test.ts`. Replace its first `it` in `describe("start", ...)`:

```ts
    it("creates a session from the seeded preset with no overrides and redirects", async () => {
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
        gameTypeKey: "DOUBLES_TRAINING",
        rulesetVersionKey: "DOUBLES_TRAINING_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
        config: {
          source: "template",
          templateRef: "tmpl-doubles-standard",
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-doubles-standard",
          configSnapshot: expect.objectContaining({
            mode: "EASY",
            orderMode: "LOW_TO_HIGH",
          }),
        }),
      );
      expect(locationSpy.href).toBe("/games/doubles-training/play");
    });
```

with:

```ts
    it("creates a session with the default order mode override and redirects", async () => {
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

      const ascending = [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        25,
      ];
      expect(sessionsApi.createSession).toHaveBeenCalledWith({
        gameTypeKey: "DOUBLES_TRAINING",
        rulesetVersionKey: "DOUBLES_TRAINING_V1",
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
        config: {
          source: "template",
          templateRef: "tmpl-doubles-standard",
          overrides: { order_mode: "LOW_TO_HIGH", target_order: ascending },
        },
      });
      expect(store.game.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          templateRef: "tmpl-doubles-standard",
          configSnapshot: expect.objectContaining({
            mode: "EASY",
            orderMode: "LOW_TO_HIGH",
            targetOrder: ascending,
          }),
        }),
      );
      expect(locationSpy.href).toBe("/games/doubles-training/play");
    });

    it("sends the selected order mode and its resolved target order", async () => {
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        orderMode: "HIGH_TO_LOW",
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

      const descending = [
        25, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
        2, 1,
      ];
      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            overrides: { order_mode: "HIGH_TO_LOW", target_order: descending },
          }),
        }),
      );
    });
```

(Doubles Training's "rejects a preset whose configuration fails schema validation" test already fails on `mode: "HARD"`, a field `start()` never overrides — no change needed there.)

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/singles-training-setup.data.test.ts tests/lib/game/doubles-training-setup.data.test.ts`
Expected: FAIL — `start()` does not yet read `this.orderMode` or send `overrides`.

- [ ] **Step 4: Implement — `singles-training-setup.data.ts`**

Add the import:

```ts
import { targetOrderFor } from "@lib/game/target-order";
```

Add the `orderMode` field to the returned object, right after `presets`:

```ts
export function singlesTrainingSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    orderMode: "LOW_TO_HIGH" as SinglesTrainingSetupContext["orderMode"],
    loading: false,
```

Replace the body of `start()`:

```ts
    async start(this: SinglesTrainingSetupContext) {
      const preset = this.presets[0];
      if (!preset) {
        this.error = "Could not find a preset for Singles Training.";
        return;
      }

      this.loading = true;
      this.error = "";
      try {
        const configSnapshot = toSnapshot(
          RULESET_VERSION_KEY,
          preset.configuration,
        );
        const modePair = resolveSessionModePair(
          RULESET_VERSION_KEY,
          this.$store.settings,
        );
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
          },
        });
```

with:

```ts
    async start(this: SinglesTrainingSetupContext) {
      const preset = this.presets[0];
      if (!preset) {
        this.error = "Could not find a preset for Singles Training.";
        return;
      }

      const targetOrder = targetOrderFor(this.orderMode);

      this.loading = true;
      this.error = "";
      try {
        const wire = {
          ...(preset.configuration as Record<string, unknown>),
          order_mode: this.orderMode,
          target_order: targetOrder,
        };
        const configSnapshot = toSnapshot(RULESET_VERSION_KEY, wire);
        const modePair = resolveSessionModePair(
          RULESET_VERSION_KEY,
          this.$store.settings,
        );
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
            overrides: {
              order_mode: this.orderMode,
              target_order: targetOrder,
            },
          },
        });
```

The rest of `start()` (`this.$store.game.startSession(...)` onward) is unchanged.

- [ ] **Step 5: Implement — `doubles-training-setup.data.ts`**

Apply the same shape of change. Add the import:

```ts
import { targetOrderFor } from "@lib/game/target-order";
```

Add the `orderMode` field:

```ts
export function doublesTrainingSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    orderMode: "LOW_TO_HIGH" as DoublesTrainingSetupContext["orderMode"],
    loading: false,
```

Replace the body of `start()`:

```ts
    async start(this: DoublesTrainingSetupContext) {
      const preset = this.presets[0];
      if (!preset) {
        this.error = "Could not find a preset for Doubles Training.";
        return;
      }

      this.loading = true;
      this.error = "";
      try {
        const configSnapshot = toSnapshot(
          RULESET_VERSION_KEY,
          preset.configuration,
        );
        const modePair = resolveSessionModePair(
          RULESET_VERSION_KEY,
          this.$store.settings,
        );
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
          },
        });
```

with:

```ts
    async start(this: DoublesTrainingSetupContext) {
      const preset = this.presets[0];
      if (!preset) {
        this.error = "Could not find a preset for Doubles Training.";
        return;
      }

      const targetOrder = targetOrderFor(this.orderMode);

      this.loading = true;
      this.error = "";
      try {
        const wire = {
          ...(preset.configuration as Record<string, unknown>),
          order_mode: this.orderMode,
          target_order: targetOrder,
        };
        const configSnapshot = toSnapshot(RULESET_VERSION_KEY, wire);
        const modePair = resolveSessionModePair(
          RULESET_VERSION_KEY,
          this.$store.settings,
        );
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
            overrides: {
              order_mode: this.orderMode,
              target_order: targetOrder,
            },
          },
        });
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/singles-training-setup.data.test.ts tests/lib/game/doubles-training-setup.data.test.ts`
Expected: PASS.

- [ ] **Step 7: Add the Toggle to both setup forms**

`app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro` — replace:

```astro
---
// Components
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import UserSection from "./UserSection.astro";

// Data
const infoSection = {
  title: "Singles training rules",
  description:
    "One target at a time, three darts each: 1 through 20, then bull, low to high. Single = 1 point, double = 2, treble = 3 — only on the current target. On the bull, outer = 1 point, inner = 2, no treble. Misses score 0. The session ends once every target has been visited once.",
};
---

<SetupShell title="Singles training">
  <UserSection />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />

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

with:

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
  title: "Singles training rules",
  description:
    "One target at a time, three darts each: 1 through 20 and bull, in the order you choose below. Single = 1 point, double = 2, treble = 3 — only on the current target. On the bull, outer = 1 point, inner = 2, no treble. Misses score 0. The session ends once every target has been visited once.",
};

const orderModeOpts = [
  { value: "LOW_TO_HIGH", label: "Low → High" },
  { value: "HIGH_TO_LOW", label: "High → Low" },
  { value: "RANDOM", label: "Random" },
];
---

<SetupShell title="Singles training">
  <UserSection />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />
  <SettingSectionShell>
    <Toggle
      orientation="horizontal"
      options={orderModeOpts}
      x-model="orderMode"
      class="w-full"
    />
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

`app/src/components/layout/games/setup/DoublesTrainingSetupForm.astro` — replace:

```astro
---
// Components
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import UserSection from "./UserSection.astro";

// Data
const infoSection = {
  title: "Doubles training rules",
  description:
    "Work through every double, D1 to D20, then the bull. Three darts per target — hit the double and move on immediately; miss all three and you still move on. On the bull, only the inner bull (double bull) counts.",
};
---

<SetupShell title="Doubles training">
  <UserSection />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />

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

with:

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
  title: "Doubles training rules",
  description:
    "Work through every double and the bull, in the order you choose below. Three darts per target — hit the double and move on immediately; miss all three and you still move on. On the bull, only the inner bull (double bull) counts.",
};

const orderModeOpts = [
  { value: "LOW_TO_HIGH", label: "Low → High" },
  { value: "HIGH_TO_LOW", label: "High → Low" },
  { value: "RANDOM", label: "Random" },
];
---

<SetupShell title="Doubles training">
  <UserSection />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />
  <SettingSectionShell>
    <Toggle
      orientation="horizontal"
      options={orderModeOpts}
      x-model="orderMode"
      class="w-full"
    />
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

- [ ] **Step 8: Run the full suite and the Astro-conventions gate**

Run: `cd app && npm test`
Expected: PASS.

Run: `bash scripts/check-astro-conventions.sh`
Expected: PASS (no output beyond a success line, or silent zero exit).

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/singles-training-setup.data.ts \
  app/src/lib/game/doubles-training-setup.data.ts \
  app/src/components/layout/games/setup/SinglesTrainingSetupForm.astro \
  app/src/components/layout/games/setup/DoublesTrainingSetupForm.astro \
  app/tests/lib/game/singles-training-setup.data.test.ts \
  app/tests/lib/game/doubles-training-setup.data.test.ts
git commit -m "Add order-mode Toggle to Singles/Doubles Training setup"
```

---

### Task 10: Play Again — fresh reshuffle per session

**Files:**
- Modify: `app/src/lib/game/singles-training-play.data.ts`
- Modify: `app/src/lib/game/doubles-training-play.data.ts`
- Test: `app/tests/lib/game/singles-training-play.data.test.ts`
- Test: `app/tests/lib/game/doubles-training-play.data.test.ts`

**Interfaces:**
- Consumes: `targetOrderFor` (Task 1); `runPlayAgain`'s `buildOverrides` parameter (Task 8).
- Produces: no new exports — `playAgain()` on both now resolves a fresh `target_order` from the outgoing session's `orderMode` on every call.

- [ ] **Step 1: Write the failing tests**

In `app/tests/lib/game/singles-training-play.data.test.ts`, replace the first `it` inside `describe("playAgain", ...)`:

```ts
  it("starts a fresh session under the player's current mode pair with no overrides", async () => {
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

    expect(createSession).toHaveBeenCalledWith({
      gameTypeKey: "SINGLES_TRAINING",
      rulesetVersionKey: "SINGLES_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
      config: { source: "template", templateRef: "tpl-1" },
    });
    expect(play.$store.game.sessionId).toBe("new-session");
    expect(play.$store.game.turns).toEqual([]);
    expect(play.finished).toBe(false);
    expect(play.completionStatus).toBe("pending");
    expect(play.resultsSnapshot).toBeNull();
    expect(play.hasActiveSession).toBe(true);
  });
```

with:

```ts
  it("starts a fresh session with the same order mode's resolved target order", async () => {
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

    const ascending = [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      25,
    ];
    expect(createSession).toHaveBeenCalledWith({
      gameTypeKey: "SINGLES_TRAINING",
      rulesetVersionKey: "SINGLES_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "DETAILED_DARTS",
      config: {
        source: "template",
        templateRef: "tpl-1",
        overrides: { order_mode: "LOW_TO_HIGH", target_order: ascending },
      },
    });
    expect(play.$store.game.sessionId).toBe("new-session");
    expect(play.$store.game.turns).toEqual([]);
    expect(play.finished).toBe(false);
    expect(play.completionStatus).toBe("pending");
    expect(play.resultsSnapshot).toBeNull();
    expect(play.hasActiveSession).toBe(true);
  });

  it("mints a fresh shuffle for a RANDOM order mode, not the just-finished session's order", async () => {
    const play = makePlay({
      turns: priorTurnsThroughNumber(20),
      configSnapshot: {
        ...defaultConfig(),
        orderMode: "RANDOM",
        targetOrder: [
          25, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
          19, 20,
        ],
      },
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

    const call = vi.mocked(createSession).mock.calls[0][0] as {
      config: { overrides: Record<string, unknown> };
    };
    expect(call.config.overrides.order_mode).toBe("RANDOM");
    const sentOrder = call.config.overrides.target_order as number[];
    expect(new Set(sentOrder)).toEqual(
      new Set([
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        25,
      ]),
    );
  });
```

Apply the equivalent change to `app/tests/lib/game/doubles-training-play.data.test.ts`'s `describe("playAgain", ...)` block — same pattern, swapping game type/ruleset keys and `defaultConfig()`'s doubles shape (`{ mode: "EASY", orderMode, targetOrder }`).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/singles-training-play.data.test.ts tests/lib/game/doubles-training-play.data.test.ts -t "playAgain"`
Expected: FAIL — `playAgain()` still calls `runPlayAgain` with no `buildOverrides`, so `createSession` receives no `overrides`.

- [ ] **Step 3: Implement — `singles-training-play.data.ts`**

Add the import:

```ts
import { targetOrderFor } from "@lib/game/target-order";
```

Replace:

```ts
    playAgain(this: SinglesTrainingPlayContext) {
      return runPlayAgain(this, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
        engine instanceof SinglesTrainingEngine ? engine : null,
      );
    },
```

with:

```ts
    playAgain(this: SinglesTrainingPlayContext) {
      return runPlayAgain(
        this,
        GAME_TYPE_KEY,
        RULESET_VERSION_KEY,
        (engine) => (engine instanceof SinglesTrainingEngine ? engine : null),
        (priorConfig) => {
          const targetOrder = targetOrderFor(priorConfig.orderMode);
          return {
            snapshot: { ...priorConfig, targetOrder },
            wire: {
              order_mode: priorConfig.orderMode,
              target_order: targetOrder,
            },
          };
        },
      );
    },
```

- [ ] **Step 4: Implement — `doubles-training-play.data.ts`**

Add the import:

```ts
import { targetOrderFor } from "@lib/game/target-order";
```

Replace:

```ts
    playAgain(this: DoublesTrainingPlayContext) {
      return runPlayAgain(this, GAME_TYPE_KEY, RULESET_VERSION_KEY, (engine) =>
        engine instanceof DoublesTrainingEngine ? engine : null,
      );
    },
```

with:

```ts
    playAgain(this: DoublesTrainingPlayContext) {
      return runPlayAgain(
        this,
        GAME_TYPE_KEY,
        RULESET_VERSION_KEY,
        (engine) => (engine instanceof DoublesTrainingEngine ? engine : null),
        (priorConfig) => {
          const targetOrder = targetOrderFor(priorConfig.orderMode);
          return {
            snapshot: { ...priorConfig, targetOrder },
            wire: {
              order_mode: priorConfig.orderMode,
              target_order: targetOrder,
            },
          };
        },
      );
    },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npm test`
Expected: PASS, full suite green.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/singles-training-play.data.ts app/src/lib/game/doubles-training-play.data.ts \
  app/tests/lib/game/singles-training-play.data.test.ts \
  app/tests/lib/game/doubles-training-play.data.test.ts
git commit -m "Reshuffle Random order fresh on every Play Again"
```

---

### Task 11: Seed data — `target_order` on both presets

No tests: seed SQL has no local database to run against in this container (D193/D24 — documented precedent throughout `docs/architecture/00-Context-Map.md`'s changelog). Correctness is enforced by `app/tests/lib/game/rulesets/seeded-presets.test.ts`, already updated in Task 2 to expect the identical `target_order` array added here.

**Files:**
- Modify: `database/seeds/0002_default_templates.sql`
- Modify: `database/seeds/0003_game_engine_reference.sql`

- [ ] **Step 1: Singles Training preset (`0002_default_templates.sql`)**

Replace:

```sql
        '{
            "order_mode": "LOW_TO_HIGH",
            "difficulty": "EASY"
        }'::jsonb,
```

with:

```sql
        '{
            "order_mode": "LOW_TO_HIGH",
            "difficulty": "EASY",
            "target_order": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25]
        }'::jsonb,
```

This row already uses `ON CONFLICT (id) DO UPDATE SET configuration = EXCLUDED.configuration, updated_at = now()` (fixed by a prior task, per this file's own comment history) — no conflict-clause change needed; a re-seed of an existing database picks up the new key.

- [ ] **Step 2: Doubles Training preset (`0003_game_engine_reference.sql`)**

This preset currently shares one `INSERT ... VALUES (...), (...) ON CONFLICT (id) DO NOTHING` statement with the Bob's 27 preset — `DO NOTHING` means a database already seeded with the old shape would silently keep it on re-seed. Bob's 27 is out of scope and must keep its `DO NOTHING` behavior unchanged, so split the statement in two rather than changing the conflict clause for both rows.

Replace:

```sql
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
        '0198f300-0000-7000-8000-000000000009',
        '0198f000-0000-7000-8000-000000000005',
        NULL,
        'Bob''s 27 — Standard',
        'Traditional Bob''s 27: start at 27, standard bull scoring.',
        '{
            "start_score": 27,
            "bull_hit_value": 50,
            "miss_penalty_multiplier": 1
        }'::jsonb,
        TRUE,
        now(),
        now()
    ),
    (
        '0198f300-0000-7000-8000-000000000010',
        '0198f000-0000-7000-8000-000000000006',
        NULL,
        'Doubles Training — Easy, Low to High',
        'Easy mode, doubles low to high ending on the bull.',
        '{
            "mode": "EASY",
            "order_mode": "LOW_TO_HIGH"
        }'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
```

with:

```sql
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
        '0198f300-0000-7000-8000-000000000009',
        '0198f000-0000-7000-8000-000000000005',
        NULL,
        'Bob''s 27 — Standard',
        'Traditional Bob''s 27: start at 27, standard bull scoring.',
        '{
            "start_score": 27,
            "bull_hit_value": 50,
            "miss_penalty_multiplier": 1
        }'::jsonb,
        TRUE,
        now(),
        now()
    ) ON CONFLICT (id) DO NOTHING;
-- Doubles Training's preset uses DO UPDATE, not DO NOTHING: its
-- configuration shape changed (target_order added below) after this row
-- may already exist in a seeded database, and Singles Training's own
-- preset above already established DO UPDATE as the correct pattern for
-- exactly this situation. Split into its own statement so Bob's 27's row
-- above keeps its original DO NOTHING behavior unchanged.
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
        '0198f300-0000-7000-8000-000000000010',
        '0198f000-0000-7000-8000-000000000006',
        NULL,
        'Doubles Training — Easy, Low to High',
        'Easy mode, doubles low to high, ending on the bull unless the player later switches this preset''s order mode at setup.',
        '{
            "mode": "EASY",
            "order_mode": "LOW_TO_HIGH",
            "target_order": [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,25]
        }'::jsonb,
        TRUE,
        now(),
        now()
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    configuration = EXCLUDED.configuration,
    updated_at = now();
```

- [ ] **Step 3: Run the seeded-presets regression test**

Run: `cd app && npx vitest run tests/lib/game/rulesets/seeded-presets.test.ts`
Expected: PASS — confirms the JSON just written above still matches Task 2's fixture byte-for-byte in the keys that matter (`toSnapshot` doesn't care about JSON key order).

- [ ] **Step 4: Commit**

```bash
git add database/seeds/0002_default_templates.sql database/seeds/0003_game_engine_reference.sql
git commit -m "Add target_order to seeded Singles/Doubles Training presets"
```

---

### Task 12: Non-canonical rule docs — order versioned to v1

No tests — markdown only. `docs/game-rules/README.md` already states these files are non-canonical, pre-spec source material; the design spec (`docs/superpowers/specs/2026-08-14-training-order-mode-design.md`) is what future context-map/decision-ledger work cites as canonical.

**Files:**
- Modify: `docs/game-rules/rulesets/singles-training.md`
- Modify: `docs/game-rules/rulesets/doubles-training.md`

- [ ] **Step 1: `singles-training.md` — Features, Config, Variants, Glossary**

Replace:

```
| Order: low → high (1…20, bull)                | v1      |
| Order: high → low (bull…1)                    | v1      |
| Order: randomized (each target once)          | TBD     |
```

with:

```
| Order: low → high (1…20, bull)                | v1      |
| Order: high → low (bull…1)                    | v1      |
| Order: randomized (each target once)          | v1      |
```

Replace:

```
| Order      | Low → high (1…20, then bull)                                    | Shown, locked         |
```

with:

```
| Order      | Low → high, high → low, or randomized — player's choice         | Editable              |
```

Replace:

```
### Variants

- Order: **high → low**, **randomized** (every target once, shuffled each session)
- **Hard:** at least 1 dart must hit the target each visit
```

with:

```
### Variants

- **Hard:** at least 1 dart must hit the target each visit
```

Replace, in the Glossary table:

```
| **High → low**      | V2+     | Bull, 20, 19, … 1.                                                              |
| **Random**          | V2+     | All targets once, shuffled per session.                                         |
```

with:

```
| **High → low**      | V1      | Bull, 20, 19, … 1.                                                              |
| **Random**          | V1      | All 21 targets (1–20 and bull) shuffled together per session; bull can land anywhere. |
```

- [ ] **Step 2: `doubles-training.md` — Features, Config, correct the bull-placement claim, Variants, Glossary**

Replace:

```
| Order: low → high (ending on bull)                           | v1      |
| Order: high → low (ending on bull)                           | TBD     |
| Order: randomized                                            | TBD     |
```

with:

```
| Order: low → high (ending on bull)                           | v1      |
| Order: high → low (bull leads)                                | v1      |
| Order: randomized                                            | v1      |
```

Replace:

```
| Order   | Low → high (ending on bull) | Shown, locked         |
```

with:

```
| Order   | Low → high, high → low, or randomized — player's choice | Editable |
```

Replace, in "### Progress":

```
Order: **D1 → D2 → … → D20 → bull**. Complete the path once.
```

with:

```
Order: **D1 → D2 → … → D20 → bull** by default (low → high). High → low
reverses it with bull leading — **bull → D20 → … → D1** — matching Singles
Training's convention rather than "ending on bull." Randomized shuffles all
21 targets (the 20 doubles and bull) together; bull can land anywhere.
Complete the path once, in whichever order the player chose at setup.
```

Replace:

```
### Config (all modes, when unlocked)

- Order: low → high (end bull), high → low (end bull), randomized
```

with:

```
### Config

- Order (v1): low → high, high → low (bull leads), randomized (bull shuffled in with the 20 doubles)
```

Replace the Glossary table:

```
| Term          | Version | Meaning                                                |
| ------------- | ------- | ------------------------------------------------------ |
| **Easy**      | V1      | One visit per double; advance even after three misses. |
| **Hard**      | V2+     | Remain on a double until hit.                          |
| **Challenge** | V2+     | Three misses → previous double; D1 wipe → game over.   |
| **Hit**       | V1      | Dart in the required double; on the bull target, the inner bull only. |
```

with:

```
| Term          | Version | Meaning                                                |
| ------------- | ------- | ------------------------------------------------------ |
| **Easy**      | V1      | One visit per double; advance even after three misses. |
| **Hard**      | V2+     | Remain on a double until hit.                          |
| **Challenge** | V2+     | Three misses → previous double; D1 wipe → game over.   |
| **Hit**       | V1      | Dart in the required double; on the bull target, the inner bull only. |
| **Low → high**  | V1    | D1, D2, … D20, bull.                                   |
| **High → low**  | V1    | Bull, D20, D19, … D1.                                  |
| **Random**      | V1    | All 21 targets (the 20 doubles and bull) shuffled together per session; bull can land anywhere. |
```

- [ ] **Step 3: Commit**

```bash
git add docs/game-rules/rulesets/singles-training.md docs/game-rules/rulesets/doubles-training.md
git commit -m "Version Singles/Doubles Training order modes to v1 in the rule docs"
```

---

## Self-Review Notes

- **Spec coverage:** schema/config (Task 2), shared helper (Task 1), path builders (Task 3), both engines' config-driven completion (Tasks 4–5), both play pages reading the session's own order (Tasks 6–7), Play Again reshuffle (Tasks 8, 10), setup UI (Task 9), seed data (Task 11), docs (Task 12) — every spec section has a task.
- **Placeholder scan:** no TBD/TODO; every step carries complete code or an exact command.
- **Type consistency:** `TargetOrderMode` (Task 1) is the single source for the order-mode union, reused in `SinglesTrainingSetupContext.orderMode`/`DoublesTrainingSetupContext.orderMode` (Task 9) and read back via `priorConfig.orderMode` in Task 10 — never redefined. `PlayAgainOverrides<TConfig>` (Task 8) is produced once and consumed identically by both training games in Task 10. `numbersPath`/`doublesPath`'s new optional parameter (Task 3) is consumed identically by both engines (Tasks 4–5) and both play-data files (Tasks 6–7).
- **Scope check:** single cohesive feature, no decomposition needed — every task depends only on earlier tasks in this same plan.
