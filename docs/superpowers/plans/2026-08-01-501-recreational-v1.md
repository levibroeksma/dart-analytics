# 501 Recreational V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a playable v1 of 501 (recreational, `501_V1` ruleset) with the same score-input UX as Score Training, plus an optimal-finish-path hint and leg-scoped progress stats (darts thrown, 3-dart average, previous score) on the play card.

**Architecture:** Frontend-only. The `FiveOhOneEngine` (`app/src/modules/game/five-oh-one.engine.module.ts`) and all DB seeds already exist and are unmodified. This plan adds: a pure checkout-path lookup module, a legs clamp helper, two small shared-component reuse fixes, new Alpine context types, new setup/play `.data.ts` factories, and new setup/play pages + interface/results components — mirroring the existing Score Training flow file-for-file.

**Tech Stack:** Astro.js, TypeScript, Alpine.js, Vitest.

## Global Constraints

- `GAME_TYPE_KEY = "501"`, `RULESET_VERSION_KEY = "501_V1"` (seeded `implementation_key` values — `database/seeds/0001_reference_data.sql`).
- No changes to `app/src/modules/game/five-oh-one.engine.module.ts`, `app/src/services/rulesets/five-oh-one/five-oh-one.validator.ts`, or any DB migration/seed file.
- **V1 game rules and config screen come from `docs/game-rules/rulesets/501.md`**: open in, double out, first-to-N legs, visit = up to 3 darts, bust restores the pre-visit score. Config screen shows Players / Start score / In / Out **locked** and **Legs (N) editable, default 1, min 1, max 20** — matching `FiveOhOneConfig.legs_to_win`'s `.min(1).max(20)`.
- A checkout is decided by the **final** dart: a visit that reaches exactly 0 without its last dart in a double is a bust, not a win (`501.md` §Finishing). This is why the exact-zero path asks before recording.
- Alpine v3 shorthand only (`:attr`, `@event`); no `x-init`; always `x-data="factory()"`; every `x-show` carries `x-cloak`.
- `.ts` files never live directly under `components/` or `pages/`. Suffixes: `.data.ts` (Alpine.data factory, no `$persist`), `.module.ts` (portable pure/OOP code, no `$persist`, no Alpine import, no `@client/api`).
- Semantic Tailwind tokens only (`surface`/`foreground`/`muted*`/`accent*`/`error*`/`success*`); no `font-medium`; build-time classes via `cn()` only.
- Tests live under `app/tests/`, mirroring `app/src/`'s tree — never colocated. Vitest. TDD red→green→refactor for every `.ts` file. `.astro` markup/branching stays untested inline (D101) — verify those manually via `npm run dev`.
- `npm run validate:app` (from `app/`) must pass before the plan is considered done.
- Design reference: `docs/superpowers/specs/2026-08-01-501-recreational-v1-design.md`.

---

### Task 1: Checkout-path lookup module

**Files:**
- Create: `app/src/modules/game/checkout-path.module.ts`
- Test: `app/tests/modules/game/checkout-path.module.test.ts`

**Interfaces:**
- Produces: `checkoutPathFor(remainingScore: number): readonly string[] | null` — every later task that needs the finish hint imports this from `@modules/game/checkout-path.module`.

- [ ] **Step 1: Write the failing test**

```typescript
// app/tests/modules/game/checkout-path.module.test.ts
import { describe, expect, it } from "vitest";
import { checkoutPathFor } from "@modules/game/checkout-path.module";

describe("checkoutPathFor", () => {
  it("returns the highest possible finish for 170", () => {
    expect(checkoutPathFor(170)).toEqual(["T20", "T20", "BULL"]);
  });

  it("returns null for every bogey number", () => {
    for (const bogey of [169, 168, 166, 165, 163, 162, 159]) {
      expect(checkoutPathFor(bogey)).toBeNull();
    }
  });

  it("returns a two-dart finish for 160", () => {
    expect(checkoutPathFor(160)).toEqual(["T20", "T20", "D20"]);
  });

  it("returns the classic two-dart 100 finish", () => {
    expect(checkoutPathFor(100)).toEqual(["T20", "D20"]);
  });

  it("returns a single-dart double for 40", () => {
    expect(checkoutPathFor(40)).toEqual(["D20"]);
  });

  it("returns a single-dart double for the lowest finish, 2", () => {
    expect(checkoutPathFor(2)).toEqual(["D1"]);
  });

  it("returns null for 1 — no double can ever land on it", () => {
    expect(checkoutPathFor(1)).toBeNull();
  });

  it("returns null for 0", () => {
    expect(checkoutPathFor(0)).toBeNull();
  });

  it("returns null above the maximum checkout of 170", () => {
    expect(checkoutPathFor(171)).toBeNull();
  });

  it("returns null for a non-integer score", () => {
    expect(checkoutPathFor(40.5)).toBeNull();
  });

  it("returns null for a negative score", () => {
    expect(checkoutPathFor(-5)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/game/checkout-path.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/game/checkout-path.module'`

- [ ] **Step 3: Write the implementation**

```typescript
// app/src/modules/game/checkout-path.module.ts

/**
 * Standard 501 double-out checkout chart, 2-170. Absent keys (the seven bogey
 * numbers — 169, 168, 166, 165, 163, 162, 159 — plus 1, which no double can
 * ever land on) are deliberately not entries; `checkoutPathFor` reads that
 * absence as "no finish route" rather than tracking a separate bogey list.
 * Labels: a plain number is a single ("20"), "T"-prefixed is a treble,
 * "D"-prefixed is a double, "BULL" is the inner bull (50, always the last
 * dart of a route that uses it).
 *
 * Every route sums exactly to its key, ends on a double or BULL, and uses at
 * most three darts — enforced for the whole table by the invariant test in
 * `app/tests/modules/game/checkout-path.module.test.ts`, not by spot checks.
 * Add or edit an entry only with that test green.
 */
const CHECKOUT_PATHS: Readonly<Record<number, readonly string[]>> = {
  170: ["T20", "T20", "BULL"],
  167: ["T20", "T19", "BULL"],
  164: ["T19", "T19", "BULL"],
  161: ["T20", "T17", "BULL"],
  160: ["T20", "T20", "D20"],
  158: ["T20", "T20", "D19"],
  157: ["T19", "T20", "D20"],
  156: ["T20", "T20", "D18"],
  155: ["T20", "T19", "D19"],
  154: ["T20", "T18", "D20"],
  153: ["T20", "T19", "D18"],
  152: ["T20", "T20", "D16"],
  151: ["T20", "T17", "D20"],
  150: ["T20", "T18", "D18"],
  149: ["T20", "T19", "D16"],
  148: ["T20", "T20", "D14"],
  147: ["T20", "T17", "D18"],
  146: ["T20", "T18", "D16"],
  145: ["T20", "T15", "D20"],
  144: ["T20", "T20", "D12"],
  143: ["T20", "T17", "D16"],
  142: ["T20", "T14", "D20"],
  141: ["T20", "T15", "D18"],
  140: ["T20", "T16", "D16"],
  139: ["T20", "T13", "D20"],
  138: ["T20", "T16", "D15"],
  137: ["T18", "T17", "D16"],
  136: ["T20", "T20", "D8"],
  135: ["T20", "T13", "D18"],
  134: ["T20", "T14", "D16"],
  133: ["T20", "T19", "D8"],
  132: ["T20", "T16", "D12"],
  131: ["T20", "T13", "D16"],
  130: ["T20", "T18", "D8"],
  129: ["T19", "T16", "D12"],
  128: ["T20", "T20", "D4"],
  127: ["T20", "T17", "D8"],
  126: ["T19", "19", "BULL"],
  125: ["T20", "T19", "D4"],
  124: ["T20", "T16", "D8"],
  123: ["T20", "T13", "D12"],
  122: ["T18", "18", "BULL"],
  121: ["T19", "14", "BULL"],
  120: ["T20", "20", "D20"],
  119: ["T20", "19", "D20"],
  118: ["T20", "18", "D20"],
  117: ["T20", "17", "D20"],
  116: ["T20", "16", "D20"],
  115: ["T20", "15", "D20"],
  114: ["T20", "14", "D20"],
  113: ["T20", "13", "D20"],
  112: ["T20", "12", "D20"],
  111: ["T20", "19", "D16"],
  110: ["T20", "10", "D20"],
  109: ["T19", "12", "D20"],
  108: ["T20", "16", "D16"],
  107: ["T19", "10", "D20"],
  106: ["T20", "10", "D18"],
  105: ["T20", "13", "D16"],
  104: ["T20", "12", "D16"],
  103: ["T19", "10", "D18"],
  102: ["T20", "10", "D16"],
  101: ["T17", "10", "D20"],
  100: ["T20", "D20"],
  99: ["T19", "10", "D16"],
  98: ["T20", "D19"],
  97: ["T19", "D20"],
  96: ["T20", "D18"],
  95: ["T19", "D19"],
  94: ["T18", "D20"],
  93: ["T19", "D18"],
  92: ["T20", "D16"],
  91: ["T17", "D20"],
  90: ["T18", "D18"],
  89: ["T19", "D16"],
  88: ["T16", "D20"],
  87: ["T17", "D18"],
  86: ["T18", "D16"],
  85: ["T15", "D20"],
  84: ["T16", "D18"],
  83: ["T17", "D16"],
  82: ["T14", "D20"],
  81: ["T15", "D18"],
  80: ["T16", "D16"],
  79: ["T13", "D20"],
  78: ["T18", "D12"],
  77: ["T15", "D16"],
  76: ["T20", "D8"],
  75: ["T13", "D18"],
  74: ["T14", "D16"],
  73: ["T19", "D8"],
  72: ["T16", "D12"],
  71: ["T13", "D16"],
  70: ["T18", "D8"],
  69: ["19", "BULL"],
  68: ["T20", "D4"],
  67: ["T17", "D8"],
  66: ["T10", "D18"],
  65: ["T19", "D4"],
  64: ["T16", "D8"],
  63: ["T13", "D12"],
  62: ["T10", "D16"],
  61: ["T15", "D8"],
  60: ["20", "D20"],
  59: ["19", "D20"],
  58: ["18", "D20"],
  57: ["17", "D20"],
  56: ["16", "D20"],
  55: ["15", "D20"],
  54: ["14", "D20"],
  53: ["13", "D20"],
  52: ["12", "D20"],
  51: ["19", "D16"],
  50: ["10", "D20"],
  49: ["17", "D16"],
  48: ["16", "D16"],
  47: ["15", "D16"],
  46: ["6", "D20"],
  45: ["13", "D16"],
  44: ["12", "D16"],
  43: ["3", "D20"],
  42: ["10", "D16"],
  41: ["9", "D16"],
  40: ["D20"],
  39: ["7", "D16"],
  38: ["D19"],
  37: ["5", "D16"],
  36: ["D18"],
  35: ["3", "D16"],
  34: ["D17"],
  33: ["1", "D16"],
  32: ["D16"],
  31: ["15", "D8"],
  30: ["D15"],
  29: ["13", "D8"],
  28: ["D14"],
  27: ["11", "D8"],
  26: ["D13"],
  25: ["9", "D8"],
  24: ["D12"],
  23: ["7", "D8"],
  22: ["D11"],
  21: ["5", "D8"],
  20: ["D10"],
  19: ["3", "D8"],
  18: ["D9"],
  17: ["1", "D8"],
  16: ["D8"],
  15: ["7", "D4"],
  14: ["D7"],
  13: ["5", "D4"],
  12: ["D6"],
  11: ["3", "D4"],
  10: ["D5"],
  9: ["1", "D4"],
  8: ["D4"],
  7: ["3", "D2"],
  6: ["D3"],
  5: ["1", "D2"],
  4: ["D2"],
  3: ["1", "D1"],
  2: ["D1"],
};

/**
 * The optimal three-dart-or-fewer double-out route for a remaining score, or
 * `null` when no route exists — every bogey number, 1, 0, anything above 170,
 * or a non-integer input.
 */
export function checkoutPathFor(remainingScore: number): readonly string[] | null {
  if (!Number.isInteger(remainingScore)) return null;
  return CHECKOUT_PATHS[remainingScore] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/game/checkout-path.module.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/game/checkout-path.module.ts app/tests/modules/game/checkout-path.module.test.ts
git commit -m "Add checkout-path lookup module for 501 finish hints"
```

---

### Task 2: Generalize shared session components for reuse

`ContinueSessionModal.astro` and `NoSessionPanel.astro` hardcode Score Training. Both get a prop with the Score Training value as the default, so `score-training/setup/index.astro` and `score-training/play/index.astro` (which call them with no props) are unaffected.

**Files:**
- Modify: `app/src/components/layout/games/ContinueSessionModal.astro`
- Modify: `app/src/components/layout/games/NoSessionPanel.astro`

**Interfaces:**
- Produces: `<ContinueSessionModal gameTitle?: string />` (default `"Score Training"`), `<NoSessionPanel href?: string />` (default `"/games/score-training/setup"`) — Task 6 (setup) and Task 8 (play) pass `"501"` / `"/games/501/setup"`.

- [ ] **Step 1: Add the `gameTitle` prop to `ContinueSessionModal.astro`**

Modify `app/src/components/layout/games/ContinueSessionModal.astro`:

```astro
---
/**
 * Presentational — parent setup page owns showActiveSessionModal (x-if).
 * Custom two-action footer (not cancel/confirm) on Modal shell.
 */
interface Props {
  gameTitle?: string;
}

// Props
const { gameTitle = "Score Training" }: Props = Astro.props;

// Components
import Modal from "@components/ui/Modal.astro";
import Button from "@components/forms/Button.astro";
---

<Modal
  titleId="continue-session-title"
  descriptionId="continue-session-desc"
  dismissible={false}
>
  <h2
    id="continue-session-title"
    class="text-lg font-semibold text-foreground"
  >
    Active Session
  </h2>
  <p
    id="continue-session-desc"
    class="mt-2 text-sm text-muted-foreground"
  >
    You have an active {gameTitle} session. Continue playing or start a new
    one?
  </p>
  <p
    class="mt-3 text-sm text-error"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

  <div
    slot="footer"
    class="mt-6 flex gap-3"
  >
    <Button
      type="button"
      variant="secondary"
      class="flex-1"
      title="Start New"
      @click="abandonSession()"
      :disabled="loading"
    />
    <Button
      type="button"
      class="flex-1"
      title="Continue"
      @click="continueSession()"
      :disabled="loading"
    />
  </div>
</Modal>
```

- [ ] **Step 2: Add the `href` prop to `NoSessionPanel.astro`**

Modify `app/src/components/layout/games/NoSessionPanel.astro`:

```astro
---
interface Props {
  href?: string;
}

const { href = "/games/score-training/setup" }: Props = Astro.props;

import Link from "@components/ui/Link.astro";
---

<div
  x-show="!finished && !hasActiveSession && !reconciliationFailed && !loadingReconciliation"
  x-cloak
  class="glass rounded-lg p-3"
>
  <h3 class="text-foreground font-semibold">No active session</h3>
  <p class="text-muted-foreground">Start a new session to continue.</p>

  <Link
    href={href}
    variant="primary"
    class="mt-4"
  >
    Configure new session
  </Link>
</div>
```

- [ ] **Step 3: Verify Score Training is unaffected**

Run: `cd app && npm run dev -- --background` then open `/games/score-training/setup` and `/games/score-training/play` in a browser (or `astro dev status`/`astro dev logs` if already running in the background). Confirm the "No active session" link still points at `/games/score-training/setup` and, if you have a lingering active session to test with, the modal still reads "You have an active Score Training session." Stop the dev server when done (`astro dev stop`) if you started it just for this check.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/layout/games/ContinueSessionModal.astro app/src/components/layout/games/NoSessionPanel.astro
git commit -m "Generalize ContinueSessionModal and NoSessionPanel for reuse by 501"
```

---

### Task 3: 501 Alpine context types

**Files:**
- Modify: `app/src/lib/game/types.ts`

**Interfaces:**
- Consumes: `ConfigurationPresetData` (`@client/api/configuration-templates`), `SessionActiveData` (`@client/api/types`), `ScoreInputBuffer` (`@modules/game/score-input.module`), `FiveOhOneEngine` (`@modules/game/five-oh-one.engine.module`), `EngineFacts`, `StageFact`, `TurnFact` (`@modules/types`), `RulesetVersionKey`, `FiveOhOneSnapshot` (`./rulesets/types`).
- Produces: `FiveOhOneSetupContext`, `FiveOhOnePlayContext` — every task from here on imports these from `@lib/types`.

- [ ] **Step 1: Add the types**

Modify `app/src/lib/game/types.ts` — add these imports and type exports (leave every existing export in the file untouched):

```typescript
import type { FiveOhOneEngine } from "@modules/game/five-oh-one.engine.module";
import type { FiveOhOneSnapshot } from "./rulesets/types";
```

Add near the bottom of the file, after `ScoreTrainingSetupContext`:

```typescript
export type FiveOhOneSetupContext = {
  presets: ConfigurationPresetData[];
  legsToWin: number | string | null;
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
  init(this: FiveOhOneSetupContext): Promise<void>;
  reconcile(
    this: FiveOhOneSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: FiveOhOneSetupContext): Promise<void>;
  continueSession(this: FiveOhOneSetupContext): void;
  abandonSession(this: FiveOhOneSetupContext): Promise<void>;
  basePreset(this: FiveOhOneSetupContext): ConfigurationPresetData | undefined;
  start(this: FiveOhOneSetupContext): Promise<void>;
};

export type FiveOhOnePlayContext = {
  scoreInput: ScoreInputBuffer;
  loading: boolean;
  error: string;
  finished: boolean;
  hasActiveSession: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  completionStatus: "pending" | "saving" | "succeeded" | "failed";
  completionError: string;
  playAgainError: string;
  playAgainLoading: boolean;
  resultsSnapshot: { total: number; legs: number; average: number } | null;
  pendingCheckoutScore: number | null;
  showDoubleConfirm: boolean;
  $store: {
    game: {
      rulesetVersionKey: RulesetVersionKey | null;
      sessionId: string | null;
      participantRef: string | null;
      templateRef: string | null;
      configSnapshot: FiveOhOneSnapshot | null;
      stages: StageFact[];
      turns: TurnFact[];
      idempotencyKey?: string | null;
      loading: boolean;
      recordFacts(facts: EngineFacts): void;
      reset(): void;
    };
  };
  engine: FiveOhOneEngine | null;
  turnsInCurrentLeg(this: FiveOhOnePlayContext): TurnFact[];
  remainingScore(this: FiveOhOnePlayContext): number;
  checkoutHint(this: FiveOhOnePlayContext): string;
  dartsThrownThisLeg(this: FiveOhOnePlayContext): number;
  averageThisLeg(this: FiveOhOnePlayContext): string;
  previousScoreThisLeg(this: FiveOhOnePlayContext): string;
  init(this: FiveOhOnePlayContext): Promise<void>;
  retryReconciliation(this: FiveOhOnePlayContext): Promise<void>;
  submitVisit(this: FiveOhOnePlayContext): Promise<void>;
  confirmDouble(this: FiveOhOnePlayContext): Promise<void>;
  denyDouble(this: FiveOhOnePlayContext): Promise<void>;
  recordVisit(
    this: FiveOhOnePlayContext,
    score: number,
    finishedOnDouble: boolean,
  ): Promise<void>;
  undoVisit(this: FiveOhOnePlayContext): void;
  uploadAndCompleteSession(this: FiveOhOnePlayContext): Promise<void>;
  back(this: FiveOhOnePlayContext): Promise<void>;
  playAgain(this: FiveOhOnePlayContext): Promise<void>;
  abandonAndExit(this: FiveOhOnePlayContext): Promise<void>;
};
```

`ConfigurationPresetData` and `SessionActiveData` are already imported at the top of this file for `ScoreTrainingSetupContext`'s use — reuse the existing import lines rather than duplicating them.

- [ ] **Step 2: Typecheck**

Run: `cd app && npx astro check`
Expected: no new errors (the two new types are structural additions; nothing consumes `FiveOhOneEngine`/`five-oh-one.engine.module` yet outside this file, so this only proves the type definitions themselves are well-formed).

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/game/types.ts
git commit -m "Add FiveOhOneSetupContext and FiveOhOnePlayContext Alpine types"
```

---

### Task 4: Legs clamp helper + `five-oh-one-setup.data.ts`

**Requirement source:** `docs/game-rules/rulesets/501.md` §"Config & presets (V1)" specifies the config screen shows Players / Start score / In / Out as **locked** values and **Legs (N) as editable, default 1, min 1, max 20** — not a choice between two fixed presets. `FiveOhOneConfig.legs_to_win` in `app/src/lib/game/rulesets/types.ts` carries exactly that `.min(1).max(20)` bound. Session creation therefore follows Score Training's established shape: pick the base template, pass the chosen N as an `overrides` value.

**Files:**
- Create: `app/src/lib/game/five-oh-one-legs.ts`
- Create: `app/src/lib/game/five-oh-one-setup.data.ts`
- Test: `app/tests/lib/game/five-oh-one-legs.test.ts`
- Test: `app/tests/lib/game/five-oh-one-setup.data.test.ts`

**Interfaces:**
- Consumes: `fetchConfigurationPresets`, `createSession`, `fetchActiveSessions`, `completeSession` (`@client/api/*`), `reconcileActiveSession` (`@lib/game/session-recovery`), `toSnapshot` (`@lib/game/rulesets/config-codec`), `FiveOhOneSetupContext` (`@lib/types`, from Task 3).
- Produces: `clampFiveOhOneLegs(value: unknown): { value: number; clamped: boolean }`, `FIVE_OH_ONE_LEGS_NOTICE: string`, `fiveOhOneSetup(): FiveOhOneSetupContext` (minus `$store`) — Task 5 wires the factory into `register-route-data.ts` and the setup page.

- [ ] **Step 1: Write the failing clamp tests**

```typescript
// app/tests/lib/game/five-oh-one-legs.test.ts
import { describe, expect, it } from "vitest";
import {
  clampFiveOhOneLegs,
  FIVE_OH_ONE_LEGS_NOTICE,
} from "@lib/game/five-oh-one-legs";

describe("clampFiveOhOneLegs", () => {
  it("passes an in-range value through unclamped", () => {
    expect(clampFiveOhOneLegs(3)).toEqual({ value: 3, clamped: false });
  });

  it("accepts both bounds", () => {
    expect(clampFiveOhOneLegs(1)).toEqual({ value: 1, clamped: false });
    expect(clampFiveOhOneLegs(20)).toEqual({ value: 20, clamped: false });
  });

  it("clamps above the maximum of 20", () => {
    expect(clampFiveOhOneLegs(50)).toEqual({ value: 20, clamped: true });
  });

  it("clamps below the minimum of 1", () => {
    expect(clampFiveOhOneLegs(0)).toEqual({ value: 1, clamped: true });
    expect(clampFiveOhOneLegs(-4)).toEqual({ value: 1, clamped: true });
  });

  it("floors a fractional value", () => {
    expect(clampFiveOhOneLegs(3.7)).toEqual({ value: 3, clamped: true });
  });

  it("clamps a blank or non-numeric input to the minimum", () => {
    expect(clampFiveOhOneLegs(null)).toEqual({ value: 1, clamped: true });
    expect(clampFiveOhOneLegs("")).toEqual({ value: 1, clamped: true });
    expect(clampFiveOhOneLegs(Number.NaN)).toEqual({ value: 1, clamped: true });
  });

  it("states the allowed range in its notice", () => {
    expect(FIVE_OH_ONE_LEGS_NOTICE).toBe("Allowed range: 1–20 legs");
  });
});
```

- [ ] **Step 2: Run the clamp tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-legs.test.ts`
Expected: FAIL — `Cannot find module '@lib/game/five-oh-one-legs'`

- [ ] **Step 3: Write the clamp module**

Mirrors `score-training-duration.ts`, with one fixed bound pair instead of a per-mode pair.

```typescript
// app/src/lib/game/five-oh-one-legs.ts

/**
 * `legs_to_win` bounds, matching `FiveOhOneConfig`'s `.min(1).max(20)` and the
 * V1 config screen in `docs/game-rules/rulesets/501.md`.
 */
export const FIVE_OH_ONE_LEGS_MIN = 1;
export const FIVE_OH_ONE_LEGS_MAX = 20;

export const FIVE_OH_ONE_LEGS_NOTICE = "Allowed range: 1–20 legs";

/**
 * Floors finite numbers, then clamps into the inclusive legs bounds.
 * Non-finite / non-number inputs clamp to the minimum, so a blank field
 * submits a playable single-leg match rather than failing validation.
 */
export function clampFiveOhOneLegs(value: unknown): {
  value: number;
  clamped: boolean;
} {
  const numeric = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return { value: FIVE_OH_ONE_LEGS_MIN, clamped: true };
  }
  const floored = Math.floor(numeric);
  const clampedValue = Math.min(
    FIVE_OH_ONE_LEGS_MAX,
    Math.max(FIVE_OH_ONE_LEGS_MIN, floored),
  );
  return { value: clampedValue, clamped: clampedValue !== numeric };
}
```

- [ ] **Step 4: Run the clamp tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-legs.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Write the failing setup-factory tests**

```typescript
// app/tests/lib/game/five-oh-one-setup.data.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fiveOhOneSetup } from "@lib/game/five-oh-one-setup.data";
import type { FiveOhOneSetupContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as presetsApi from "@client/api/configuration-templates";

vi.mock("@client/api/sessions");
vi.mock("@client/api/configuration-templates");

const QUICK_PLAY_PRESET = {
  configurationTemplateId: "tmpl-quick",
  name: "501 — Quick Play",
  configuration: {
    starting_score: 501,
    legs_to_win: 1,
    check_in: "STRAIGHT_IN",
    check_out: "DOUBLE_OUT",
    max_darts_per_turn: 3,
    max_visit_score: 180,
  },
} as any;

const BEST_OF_5_PRESET = {
  configurationTemplateId: "tmpl-best-of-5",
  name: "501 — Best of 5 Legs",
  configuration: {
    starting_score: 501,
    legs_to_win: 3,
    check_in: "STRAIGHT_IN",
    check_out: "DOUBLE_OUT",
    max_darts_per_turn: 3,
    max_visit_score: 180,
  },
} as any;

describe("fiveOhOneSetup", () => {
  let store: FiveOhOneSetupContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = {
      game: {
        sessionId: null,
        reset: vi.fn(),
        startSession: vi.fn(),
      },
    };
  });

  function createSetup(
    overrides: Partial<FiveOhOneSetupContext> = {},
  ): FiveOhOneSetupContext {
    return { ...fiveOhOneSetup(), $store: store, ...overrides };
  }

  it("defaults legsToWin to the base preset's value and loads the presets", async () => {
    const setup = createSetup();
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
      QUICK_PLAY_PRESET,
      BEST_OF_5_PRESET,
    ]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

    await setup.init();

    expect(presetsApi.fetchConfigurationPresets).toHaveBeenCalledWith("501");
    expect(setup.legsToWin).toBe(1);
    expect(setup.clampNotice).toBe("");
    expect(setup.presets).toHaveLength(2);
  });

  it("falls back to 1 leg when no preset declares legs_to_win", async () => {
    const setup = createSetup();
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([
      { configurationTemplateId: "t", name: "odd", configuration: {} } as any,
    ]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);

    await setup.init();

    expect(setup.legsToWin).toBe(1);
  });

  it('shows the active-session modal on "match"', async () => {
    const setup = createSetup();
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      { sessionId: "match-id", gameTypeKey: "501" } as any,
    ]);
    store.game.sessionId = "match-id";

    await setup.init();

    expect(setup.showActiveSessionModal).toBe(true);
    expect(setup.activeSession).toEqual({
      sessionId: "match-id",
      gameTypeKey: "501",
    });
  });

  it('blocks with reconciliationFailed on "abandon_failed"', async () => {
    const setup = createSetup();
    vi.mocked(presetsApi.fetchConfigurationPresets).mockResolvedValue([]);
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      { sessionId: "server-id", gameTypeKey: "501" } as any,
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

  it("continueSession navigates to the play page", () => {
    const setup = createSetup({
      activeSession: { sessionId: "match-id", gameTypeKey: "501" } as any,
    });
    const locationSpy = { href: "/games/501/setup" };
    vi.stubGlobal("location", locationSpy);

    setup.continueSession();

    expect(locationSpy.href).toBe("/games/501/play");
  });

  it("basePreset picks the single-leg template as the override base", () => {
    const setup = createSetup({
      presets: [BEST_OF_5_PRESET, QUICK_PLAY_PRESET],
    });
    expect(setup.basePreset()).toBe(QUICK_PLAY_PRESET);
  });

  it("falls back to the first preset when none declares legs_to_win = 1", () => {
    const setup = createSetup({ presets: [BEST_OF_5_PRESET] });
    expect(setup.basePreset()).toBe(BEST_OF_5_PRESET);
  });

  it("creates a session overriding legs_to_win with the chosen value and redirects", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 5,
    });
    vi.mocked(sessionsApi.createSession).mockResolvedValue({
      sessionId: "new-session-id",
      participants: [
        { ref: "participant-1", displayName: "Player", participantTypeKey: "PLAYER" },
      ],
    } as any);
    const locationSpy = { href: "" };
    vi.stubGlobal("location", locationSpy);

    await setup.start();

    expect(sessionsApi.createSession).toHaveBeenCalledWith({
      gameTypeKey: "501",
      rulesetVersionKey: "501_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
      config: {
        source: "template",
        templateRef: "tmpl-quick",
        overrides: { legs_to_win: 5 },
      },
    });
    expect(store.game.startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        gameTypeKey: "501",
        rulesetVersionKey: "501_V1",
        templateRef: "tmpl-quick",
        configSnapshot: expect.objectContaining({
          startingScore: 501,
          legsToWin: 5,
          checkIn: "STRAIGHT_IN",
          checkOut: "DOUBLE_OUT",
        }),
      }),
    );
    expect(locationSpy.href).toBe("/games/501/play");
  });

  it("clamps an out-of-range legs value, sets the notice, and still creates", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 99,
    });
    vi.mocked(sessionsApi.createSession).mockResolvedValue({
      sessionId: "new-session-id",
      participants: [
        { ref: "participant-1", displayName: "Player", participantTypeKey: "PLAYER" },
      ],
    } as any);
    vi.stubGlobal("location", { href: "" });

    await setup.start();

    expect(setup.legsToWin).toBe(20);
    expect(setup.clampNotice).toBe("Allowed range: 1–20 legs");
    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ overrides: { legs_to_win: 20 } }),
      }),
    );
  });

  it("clamps a blank field to a single leg", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: null,
    });
    vi.mocked(sessionsApi.createSession).mockResolvedValue({
      sessionId: "new-session-id",
      participants: [
        { ref: "participant-1", displayName: "Player", participantTypeKey: "PLAYER" },
      ],
    } as any);
    vi.stubGlobal("location", { href: "" });

    await setup.start();

    expect(setup.legsToWin).toBe(1);
    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ overrides: { legs_to_win: 1 } }),
      }),
    );
  });

  it("errors when no preset is available at all", async () => {
    const setup = createSetup({ presets: [], legsToWin: 3 });
    await setup.start();
    expect(sessionsApi.createSession).not.toHaveBeenCalled();
    expect(setup.error).toBe("Could not find a preset for 501.");
  });

  it("rejects a preset whose configuration fails schema validation, before creating a session", async () => {
    const setup = createSetup({
      presets: [
        {
          configurationTemplateId: "template-1",
          name: "Broken",
          configuration: { starting_score: 501 },
        } as any,
      ],
      legsToWin: 3,
    });

    await setup.start();

    expect(sessionsApi.createSession).not.toHaveBeenCalled();
    expect(store.game.startSession).not.toHaveBeenCalled();
    expect(setup.error).toMatch(/Could not start the session/);
    expect(setup.loading).toBe(false);
  });

  it("re-reconciles into the active-session modal when create reports SESSION_ALREADY_ACTIVE", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 1,
    });
    vi.mocked(sessionsApi.createSession).mockRejectedValue(
      Object.assign(new Error("already active"), {
        code: "SESSION_ALREADY_ACTIVE",
      }),
    );
    vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([
      { sessionId: "active-1", gameTypeKey: "501" } as any,
    ]);
    store.game.sessionId = "active-1";

    await setup.start();

    expect(setup.showActiveSessionModal).toBe(true);
    expect(setup.activeSession).toMatchObject({ sessionId: "active-1" });
    expect(setup.loading).toBe(false);
  });
});
```

- [ ] **Step 6: Run the setup tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-setup.data.test.ts`
Expected: FAIL — `Cannot find module '@lib/game/five-oh-one-setup.data'`

- [ ] **Step 7: Write the setup implementation**

```typescript
// app/src/lib/game/five-oh-one-setup.data.ts
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
import {
  clampFiveOhOneLegs,
  FIVE_OH_ONE_LEGS_MIN,
  FIVE_OH_ONE_LEGS_NOTICE,
} from "@lib/game/five-oh-one-legs";
import type { FiveOhOneSetupContext } from "./types";

const GAME_TYPE_KEY = "501";
const RULESET_VERSION_KEY = "501_V1";

/**
 * Reads `legs_to_win` off a preset's `configuration`, which the API types as
 * `Record<string, unknown>`.
 */
function presetLegsToWin(
  preset: ConfigurationPresetData | undefined,
): number | undefined {
  const raw = preset?.configuration?.legs_to_win;
  return typeof raw === "number" ? raw : undefined;
}

export function fiveOhOneSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    legsToWin: FIVE_OH_ONE_LEGS_MIN as number | string | null,
    clampNotice: "",
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,

    async init(this: FiveOhOneSetupContext) {
      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(GAME_TYPE_KEY),
          fetchActiveSessions(),
        ]);
        this.presets = presets;
        this.legsToWin =
          presetLegsToWin(this.basePreset()) ?? FIVE_OH_ONE_LEGS_MIN;
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

    /**
     * The template whose configuration is copied, with `legs_to_win`
     * overridden by the player's chosen value. The single-leg preset is
     * preferred so the override is the only difference from a seeded default;
     * any preset will do when that one is absent, since every 501 preset
     * shares the same locked V1 values for every other key.
     */
    basePreset(this: FiveOhOneSetupContext) {
      return (
        this.presets.find((p) => presetLegsToWin(p) === FIVE_OH_ONE_LEGS_MIN) ??
        this.presets[0]
      );
    },

    async reconcile(
      this: FiveOhOneSetupContext,
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

    async retryReconciliation(this: FiveOhOneSetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: FiveOhOneSetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/501/play";
    },

    async abandonSession(this: FiveOhOneSetupContext) {
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

    async start(this: FiveOhOneSetupContext) {
      const preset = this.basePreset();
      if (!preset) {
        this.error = "Could not find a preset for 501.";
        return;
      }
      const { value, clamped } = clampFiveOhOneLegs(this.legsToWin);
      this.legsToWin = value;
      this.clampNotice = clamped ? FIVE_OH_ONE_LEGS_NOTICE : "";

      this.loading = true;
      this.error = "";
      try {
        const wire = {
          ...(preset.configuration as Record<string, unknown>),
          legs_to_win: value,
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
            overrides: { legs_to_win: value },
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
        globalThis.location.href = "/games/501/play";
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

- [ ] **Step 8: Run the setup tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-setup.data.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/game/five-oh-one-legs.ts app/src/lib/game/five-oh-one-setup.data.ts app/tests/lib/game/five-oh-one-legs.test.ts app/tests/lib/game/five-oh-one-setup.data.test.ts
git commit -m "Add 501 legs clamp helper and fiveOhOneSetup data factory"
```

---

### Task 5: 501 setup page

**Files:**
- Create: `app/src/components/layout/games/FiveOhOneSetupForm.astro`
- Create: `app/src/pages/games/501/setup/index.astro`
- Modify: `app/src/lib/client/alpine/register-route-data.ts`

**Interfaces:**
- Consumes: `fiveOhOneSetup` (Task 4), `ContinueSessionModal`/`NoSessionPanel` (Task 2), `Button`/`Input` (existing), `ReconciliationBlocked`/`IsLoading` (existing, unchanged).

- [ ] **Step 1: Create the setup form**

Per `docs/game-rules/rulesets/501.md` §"Config & presets (V1)": Players / Start score / In / Out are **shown, locked**; Legs (N) is **editable**, default 1, min 1, max 20. The locked rows are static markup — they are V1 constants, not state, so they carry no Alpine binding.

```astro
---
// app/src/components/layout/games/FiveOhOneSetupForm.astro
interface Props {
  title: string;
  description: string;
}

// Props
const { title, description }: Props = Astro.props;

// Components
import Button from "@components/forms/Button.astro";
import Input from "@components/forms/Input.astro";

// Data
const lockedSettings = [
  { label: "Players", value: "Single player" },
  { label: "Start score", value: "501" },
  { label: "In", value: "Open in" },
  { label: "Out", value: "Double out" },
];
---

<div>
  <h1 class="text-xl font-semibold text-foreground">{title}</h1>
  <p class="text-sm text-muted-foreground">{description}</p>

  <div class="mt-4 flex flex-col gap-3">
    {/* V1 locked settings — shown for confirmation, not editable */}
    <dl
      class="glass rounded-lg border border-border bg-surface-raised px-4 py-3 space-y-1"
    >
      {
        lockedSettings.map((setting) => (
          <div class="flex items-center justify-between">
            <dt class="text-sm text-muted-foreground">{setting.label}</dt>
            <dd class="text-sm text-foreground">{setting.value}</dd>
          </div>
        ))
      }
    </dl>

    <div class="flex flex-col gap-1">
      <label
        for="legsToWin"
        class="text-sm text-muted-foreground"
      >
        Legs to win
      </label>
      <Input
        id="legsToWin"
        name="legsToWin"
        type="text"
        inputmode="numeric"
        {...{
          "x-model.number": "legsToWin",
          "x-on:input": "clampNotice = ''",
        }}
      />
      <p
        class="text-sm text-muted-foreground"
        role="status"
        x-show="clampNotice"
        x-text="clampNotice"
        x-cloak
      >
      </p>
    </div>
  </div>

  <p
    class="alert alert-error mt-2 rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
    role="alert"
    x-show="error"
    x-text="error"
    x-cloak
  >
  </p>

  <div class="mt-4">
    <Button
      type="button"
      :disabled="loading"
      @click="start()"
      title="Let's play"
    />
  </div>
</div>
```

- [ ] **Step 2: Create the setup page**

```astro
---
// app/src/pages/games/501/setup/index.astro
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import Button from "@components/forms/Button.astro";
import ContinueSessionModal from "@components/layout/games/ContinueSessionModal.astro";
import FiveOhOneSetupForm from "@components/layout/games/FiveOhOneSetupForm.astro";
import IsLoading from "@components/ui/IsLoading.astro";
---

<AppLayout title="501 — Setup">
  <div
    class="p-4"
    x-data="fiveOhOneSetup()"
  >
    <template x-if="showActiveSessionModal && activeSession">
      <ContinueSessionModal gameTitle="501" />
    </template>

    <template x-if="reconciliationFailed && !loadingReconciliation">
      <div
        class="alert alert-error mt-2 rounded-md border border-error/40 px-4 py-3 text-center text-sm text-error-foreground"
        role="alert"
      >
        <p>Could not clean up a previous session. Retry to continue.</p>
        <Button
          class="mt-4"
          @click="retryReconciliation()"
          title="Retry"
        />
      </div>
    </template>

    <template
      x-if="!showActiveSessionModal && !reconciliationFailed && !loadingReconciliation"
    >
      <FiveOhOneSetupForm
        title="501"
        description="Confirm the format and set your legs, then let's play."
      />
    </template>

    <template x-if="loadingReconciliation">
      <IsLoading title="Configuring your session..." />
    </template>
  </div>
</AppLayout>
```

This mirrors `score-training/setup/index.astro` exactly, aside from the swapped data factory, form component, and `gameTitle`.

- [ ] **Step 3: Register the Alpine data factory**

Modify `app/src/lib/client/alpine/register-route-data.ts`:

```typescript
import type { Alpine } from "alpinejs";
import { loginForm } from "@auth/login.data";
import { scoreTrainingSetup } from "@lib/game/score-training-setup.data";
import { scoreTrainingPlay } from "@lib/game/score-training-play.data";
import { fiveOhOneSetup } from "@lib/game/five-oh-one-setup.data";

export function registerRouteData(Alpine: Alpine) {
  Alpine.data("loginForm", loginForm);
  Alpine.data("scoreTrainingSetup", scoreTrainingSetup);
  Alpine.data("scoreTrainingPlay", scoreTrainingPlay);
  Alpine.data("fiveOhOneSetup", fiveOhOneSetup);
}
```

- [ ] **Step 4: Manual verification**

Run: `cd app && npm run dev -- --background`, then visit `/games/501/setup`. Confirm: the four locked rows read Single player / 501 / Open in / Double out; "Legs to win" defaults to `1`; typing `99` and clicking "Let's play" clamps the field to `20`, shows "Allowed range: 1–20 legs", and still creates the session and redirects to `/games/501/play` (a 404 there is expected until Task 8 — this task only proves setup → session-create works). Stop the dev server afterward (`astro dev stop`).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/layout/games/FiveOhOneSetupForm.astro app/src/pages/games/501/setup/index.astro app/src/lib/client/alpine/register-route-data.ts
git commit -m "Add 501 setup page"
```

---

### Task 6: `five-oh-one-play.data.ts` — visit recording, double-confirm gate, leg-scoped stats

This is the core gameplay logic. Completion/upload/abandon/playAgain are deferred to Task 7 so this task's diff stays reviewable on its own.

**Files:**
- Create: `app/src/lib/game/five-oh-one-play.data.ts`
- Test: `app/tests/lib/game/five-oh-one-play.data.test.ts`

**Interfaces:**
- Consumes: `ScoreInputBuffer` (`@modules/game/score-input.module`), `getEngineFactory` (`@modules/game/engine.registry`), `FiveOhOneEngine`, `applyFiveOhOneVisit`, `initialFiveOhOneState` (`@modules/game/five-oh-one.engine.module`), `checkoutPathFor` (`@modules/game/checkout-path.module`, Task 1), `fetchActiveSessions` (`@client/api/sessions`), `reconcileActiveSession` (`@lib/game/session-recovery`), `FiveOhOnePlayContext` (`@lib/types`, Task 3), `EngineFacts`, `TurnFact`, `FiveOhOneState` (`@modules/types`), `FiveOhOneSnapshot` (`@lib/types`).
- Produces: `fiveOhOnePlay()` object with `init`, `retryReconciliation`, `submitVisit`, `confirmDouble`, `denyDouble`, `recordVisit`, `undoVisit`, `remainingScore`, `checkoutHint`, `dartsThrownThisLeg`, `averageThisLeg`, `previousScoreThisLeg` fully implemented; `uploadAndCompleteSession`, `back`, `playAgain`, `abandonAndExit` are stubbed as no-op `async () => {}` placeholders in this task (Task 7 replaces the stubs) so the object satisfies `FiveOhOnePlayContext`'s shape and `recordVisit` can call `this.uploadAndCompleteSession()` without a type error.

- [ ] **Step 1: Write the failing tests**

```typescript
// app/tests/lib/game/five-oh-one-play.data.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// `init()` calls `fetchActiveSessions()` directly, and `reconcileActiveSession`
// (real, unmocked) calls `completeSession` internally on a mismatch — both
// must be mocked from the start, even though this task's tests only exercise
// the "match" path. `appendBatch`/`createSession` are mocked here too so
// Task 7 can extend this same file without re-declaring the mock.
vi.mock("@client/api/sessions", () => ({
  appendBatch: vi.fn(),
  completeSession: vi.fn(),
  fetchActiveSessions: vi.fn(),
  createSession: vi.fn(),
}));

import { fetchActiveSessions } from "@client/api/sessions";
import {
  registerEngineFactory,
  resetEngineRegistry,
} from "@modules/game/engine.registry";
import { fiveOhOneEngineFactory } from "@modules/game/five-oh-one.engine.module";
import { fiveOhOnePlay } from "@lib/game/five-oh-one-play.data";
import type { FiveOhOnePlayContext } from "@lib/types";
import type { EngineFacts, StageFact, TurnFact } from "@modules/types";
import type { FiveOhOneSnapshot } from "@lib/types";

const ACTIVE_SESSION = {
  sessionId: "s1",
  gameTypeKey: "501",
  gameTypeName: "501",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "QUICK_SCORE",
  rulesetVersionKey: "501_V1",
  startedAt: "now",
} as const;

const LEG_1: StageFact = {
  clientKey: "leg-1",
  stageTypeKey: "LEG",
  parentClientKey: null,
  sequence: 1,
};

function turnFact(
  clientKey: string,
  stageClientKey: string,
  sequence: number,
  totalScore: number,
): TurnFact {
  return {
    clientKey,
    stageClientKey,
    sequence,
    completedAt: "2026-08-01T10:00:00.000Z",
    totalScore,
    darts: [],
  };
}

function quickPlayConfig(): FiveOhOneSnapshot {
  return {
    startingScore: 501,
    legsToWin: 1,
    checkIn: "STRAIGHT_IN",
    checkOut: "DOUBLE_OUT",
    maxDartsPerTurn: 3,
    maxVisitScore: 180,
  };
}

function bestOf5Config(): FiveOhOneSnapshot {
  return { ...quickPlayConfig(), legsToWin: 3 };
}

type GameStub = FiveOhOnePlayContext["$store"]["game"];

function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    rulesetVersionKey: "501_V1",
    sessionId: "s1",
    participantRef: "p1",
    templateRef: "tpl-1",
    configSnapshot: quickPlayConfig(),
    stages: [LEG_1],
    turns: [],
    idempotencyKey: null,
    loading: false,
    recordFacts: vi.fn(function (this: GameStub, facts: EngineFacts) {
      this.stages = [...facts.stages];
      this.turns = [...facts.turns];
    }),
    reset: vi.fn(function (this: GameStub) {
      this.loading = false;
    }),
    ...overrides,
  };
}

function makePlay(gameOverrides: Partial<GameStub> = {}) {
  return {
    ...fiveOhOnePlay(),
    $store: { game: gameStub(gameOverrides) },
  } as FiveOhOnePlayContext;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetEngineRegistry();
  registerEngineFactory(fiveOhOneEngineFactory);
  vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
});

describe("init", () => {
  it("resumes the engine and mirrors its facts into the store", async () => {
    const play = makePlay();
    await play.init.call(play);
    expect(play.hasActiveSession).toBe(true);
    expect(play.engine).not.toBeNull();
  });
});

describe("submitVisit — plain reduction", () => {
  it("records a visit that does not reach zero without opening the double confirm", async () => {
    const play = makePlay();
    await play.init.call(play);
    play.scoreInput.setValue("100");

    await play.submitVisit.call(play);

    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].totalScore).toBe(100);
    expect(play.showDoubleConfirm).toBe(false);
  });

  it("surfaces the engine's range error and leaves scoreInput untouched", async () => {
    const play = makePlay();
    await play.init.call(play);
    play.scoreInput.setValue("999");

    await play.submitVisit.call(play);

    expect(play.error).toBe("Enter a score between 0 and 180.");
    expect(play.scoreInput.value).toBe("999");
    expect(play.$store.game.turns).toHaveLength(0);
  });
});

describe("submitVisit — exact-zero opens the double confirm", () => {
  it("opens showDoubleConfirm instead of recording immediately", async () => {
    const play = makePlay({
      turns: [turnFact("t1", "leg-1", 1, 461)], // remaining 40
    });
    await play.init.call(play);
    play.scoreInput.setValue("40");

    await play.submitVisit.call(play);

    expect(play.showDoubleConfirm).toBe(true);
    expect(play.pendingCheckoutScore).toBe(40);
    expect(play.$store.game.turns).toHaveLength(1); // nothing recorded yet
    expect(play.scoreInput.value).toBe("");
  });

  it("does not open the double confirm when the entered score exceeds maxVisitScore even if it would zero out a large remainder", async () => {
    const play = makePlay(); // remaining 501, config maxVisitScore 180
    await play.init.call(play);
    play.scoreInput.setValue("501");

    await play.submitVisit.call(play);

    expect(play.showDoubleConfirm).toBe(false);
    expect(play.error).toBe("Enter a score between 0 and 180.");
  });

  it("confirmDouble records a checkout and wins the leg", async () => {
    const play = makePlay({
      turns: [turnFact("t1", "leg-1", 1, 461)], // remaining 40
    });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);

    await play.confirmDouble.call(play);

    expect(play.showDoubleConfirm).toBe(false);
    expect(play.pendingCheckoutScore).toBeNull();
    expect(play.$store.game.turns).toHaveLength(2);
    expect(play.$store.game.turns[1].totalScore).toBe(40);
    expect(play.finished).toBe(true); // Quick Play: legsToWin 1, this checkout wins the match
  });

  it("denyDouble records a bust — score 0, remaining unchanged", async () => {
    const play = makePlay({
      turns: [turnFact("t1", "leg-1", 1, 461)], // remaining 40
    });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);

    await play.denyDouble.call(play);

    expect(play.showDoubleConfirm).toBe(false);
    expect(play.$store.game.turns).toHaveLength(2);
    expect(play.$store.game.turns[1].totalScore).toBe(0);
    expect(play.remainingScore.call(play)).toBe(40); // unchanged by the bust
    expect(play.finished).toBe(false);
  });

  it("a leg win that does not complete the match leaves finished false and opens the next leg", async () => {
    const play = makePlay({
      configSnapshot: bestOf5Config(),
      turns: [turnFact("t1", "leg-1", 1, 461)], // remaining 40
    });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);

    await play.confirmDouble.call(play);

    expect(play.finished).toBe(false);
    expect(play.$store.game.stages).toHaveLength(2); // leg 2 opened
    expect(play.remainingScore.call(play)).toBe(501); // fresh leg
  });
});

describe("undoVisit", () => {
  it("pops the last visit and mirrors the engine log back into the store", async () => {
    const play = makePlay();
    await play.init.call(play);
    play.scoreInput.setValue("100");
    await play.submitVisit.call(play);
    expect(play.$store.game.turns).toHaveLength(1);

    play.undoVisit.call(play);

    expect(play.$store.game.turns).toHaveLength(0);
    expect(play.error).toBe("");
  });

  it("is a no-op while the double confirm is open", async () => {
    const play = makePlay({
      turns: [turnFact("t1", "leg-1", 1, 461)],
    });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);
    expect(play.showDoubleConfirm).toBe(true);

    play.undoVisit.call(play);

    expect(play.$store.game.turns).toHaveLength(1);
  });
});

describe("leg-scoped progress stats", () => {
  it("computes darts thrown, average, and previous score for the current leg only", async () => {
    const play = makePlay({
      turns: [
        turnFact("t1", "leg-1", 1, 60),
        turnFact("t2", "leg-1", 2, 45),
      ],
    });
    await play.init.call(play);

    expect(play.dartsThrownThisLeg.call(play)).toBe(6);
    expect(play.averageThisLeg.call(play)).toBe("52.5");
    expect(play.previousScoreThisLeg.call(play)).toBe("45");
  });

  it('shows "—" for previous score when the current leg has no turns yet', async () => {
    const play = makePlay();
    await play.init.call(play);

    expect(play.dartsThrownThisLeg.call(play)).toBe(0);
    expect(play.averageThisLeg.call(play)).toBe("0.0");
    expect(play.previousScoreThisLeg.call(play)).toBe("—");
  });

  it("resets to the new leg's turns only after a leg win", async () => {
    const play = makePlay({
      configSnapshot: bestOf5Config(),
      turns: [
        turnFact("t1", "leg-1", 1, 60),
        turnFact("t2", "leg-1", 2, 401), // remaining 40
      ],
    });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);
    await play.confirmDouble.call(play);

    expect(play.previousScoreThisLeg.call(play)).toBe("—");
    expect(play.dartsThrownThisLeg.call(play)).toBe(0);
  });
});

describe("checkoutHint", () => {
  it("shows the finish route once the remaining score is checkoutable", async () => {
    const play = makePlay({
      turns: [turnFact("t1", "leg-1", 1, 461)], // remaining 40
    });
    await play.init.call(play);

    expect(play.checkoutHint.call(play)).toBe("D20");
  });

  it("is empty above 170 or on a bogey number", async () => {
    const play = makePlay(); // remaining 501
    await play.init.call(play);
    expect(play.checkoutHint.call(play)).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts`
Expected: FAIL — `Cannot find module '@lib/game/five-oh-one-play.data'`

- [ ] **Step 3: Write the implementation**

```typescript
// app/src/lib/game/five-oh-one-play.data.ts
import { ScoreInputBuffer } from "@modules/game/score-input.module";
import { getEngineFactory } from "@modules/game/engine.registry";
import {
  applyFiveOhOneVisit,
  initialFiveOhOneState,
} from "@modules/game/five-oh-one.engine.module";
import { checkoutPathFor } from "@modules/game/checkout-path.module";
import { fetchActiveSessions } from "@client/api/sessions";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import type { RulesetVersionKey, FiveOhOneSnapshot } from "@lib/types";
import type { EngineFacts, FiveOhOneState, TurnFact } from "@modules/types";
import type { FiveOhOnePlayContext } from "./types";

// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// fiveOhOneEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY.
import { FiveOhOneEngine } from "@modules/game/five-oh-one.engine.module";

const GAME_TYPE_KEY = "501";
const RULESET_VERSION_KEY: RulesetVersionKey = "501_V1";

/**
 * Rebuilds the engine for the persisted session, replaying the store's fact
 * log so a reload restores the game exactly. Only this page's own ruleset is
 * ever resolved — mirrors `score-training-play.data.ts`'s `resumeEngine`.
 */
function resumeEngine(
  game: FiveOhOnePlayContext["$store"]["game"],
): FiveOhOneEngine | null {
  const { configSnapshot, rulesetVersionKey } = game;
  if (!configSnapshot || rulesetVersionKey !== RULESET_VERSION_KEY) return null;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return null;
  const engine = factory.create(configSnapshot, {
    stages: game.stages,
    turns: game.turns,
  });
  return engine instanceof FiveOhOneEngine ? engine : null;
}

/**
 * Folds a leg's turns into a `FiveOhOneState`, exactly like the engine's own
 * private replay, but reading only from the reactive `$store.game` fields —
 * never `engine.state()` — so every Alpine display expression that calls
 * this (directly or through `remainingScore`/`checkoutHint`/the stat
 * methods) re-renders when `recordFacts` writes a new turn. `engine` is a
 * plain class instance; its own internal mutations carry no Alpine
 * reactivity, so display must never depend on them (see
 * `07-Frontend/03-Alpine-Patterns.md`'s reactive-store convention, already
 * followed by `ScoreTrainingResults.astro`).
 */
function foldLegState(
  turns: TurnFact[],
  config: FiveOhOneSnapshot,
): FiveOhOneState {
  return turns.reduce(
    (state, turn) =>
      applyFiveOhOneVisit(
        state,
        { scoreAttempted: turn.totalScore, finishedOnDouble: true },
        config,
      ),
    initialFiveOhOneState(config),
  );
}

export function fiveOhOnePlay() {
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
      total: number;
      legs: number;
      average: number;
    } | null,
    pendingCheckoutScore: null as number | null,
    showDoubleConfirm: false,
    engine: null as FiveOhOneEngine | null,

    turnsInCurrentLeg(this: FiveOhOnePlayContext): TurnFact[] {
      const openLeg = this.$store.game.stages.at(-1);
      if (!openLeg) return [];
      return this.$store.game.turns.filter(
        (turn) => turn.stageClientKey === openLeg.clientKey,
      );
    },

    remainingScore(this: FiveOhOnePlayContext): number {
      const config = this.$store.game.configSnapshot;
      if (!config) return 0;
      return foldLegState(this.turnsInCurrentLeg(), config).remainingScore;
    },

    checkoutHint(this: FiveOhOnePlayContext): string {
      const path = checkoutPathFor(this.remainingScore());
      return path ? path.join(" ") : "";
    },

    dartsThrownThisLeg(this: FiveOhOnePlayContext): number {
      const maxDartsPerTurn = this.$store.game.configSnapshot?.maxDartsPerTurn ?? 3;
      return this.turnsInCurrentLeg().length * maxDartsPerTurn;
    },

    averageThisLeg(this: FiveOhOnePlayContext): string {
      const turns = this.turnsInCurrentLeg();
      const dartsThrown = this.dartsThrownThisLeg();
      if (dartsThrown === 0) return "0.0";
      const total = turns.reduce((sum, turn) => sum + turn.totalScore, 0);
      return ((total / dartsThrown) * 3).toFixed(1);
    },

    previousScoreThisLeg(this: FiveOhOnePlayContext): string {
      const last = this.turnsInCurrentLeg().at(-1);
      return last ? String(last.totalScore) : "—";
    },

    async init(this: FiveOhOnePlayContext) {
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

        if (result.action === "no_active") {
          this.hasActiveSession = false;
          return;
        }

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

    async retryReconciliation(this: FiveOhOnePlayContext) {
      await this.init();
    },

    /**
     * Folds one visit into the engine's fact log, then checks for a match
     * win. Shared by the plain-reduction path (`submitVisit`) and both
     * double-confirm resolutions (`confirmDouble`/`denyDouble`) so the
     * record → mirror → complete sequence exists exactly once.
     */
    async recordVisit(
      this: FiveOhOnePlayContext,
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
     * 501 is double-out but this app only captures a visit's total, not
     * individual darts — so when the entered score would bring the leg's
     * remaining total to exactly 0, the app cannot know from the number
     * alone whether the last dart was a double (a win) or not (a bust).
     * `isCheckoutAttempt` gates a "Finished on a double?" confirm before
     * anything is recorded; every other visit records immediately.
     */
    async submitVisit(this: FiveOhOnePlayContext) {
      if (!this.engine || this.finished || this.showDoubleConfirm) return;
      this.loading = true;

      const score = Number(this.scoreInput.value);
      const config = this.$store.game.configSnapshot;
      const remaining = this.remainingScore();
      const isCheckoutAttempt =
        !!config && remaining - score === 0 && score <= config.maxVisitScore;

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

    async confirmDouble(this: FiveOhOnePlayContext) {
      if (!this.engine || this.finished || !this.showDoubleConfirm) return;
      if (this.pendingCheckoutScore == null) return;
      const score = this.pendingCheckoutScore;
      this.pendingCheckoutScore = null;
      this.showDoubleConfirm = false;
      await this.recordVisit(score, true);
    },

    async denyDouble(this: FiveOhOnePlayContext) {
      if (!this.showDoubleConfirm || this.pendingCheckoutScore == null) return;
      const score = this.pendingCheckoutScore;
      this.pendingCheckoutScore = null;
      this.showDoubleConfirm = false;
      await this.recordVisit(score, false);
    },

    undoVisit(this: FiveOhOnePlayContext) {
      if (this.finished || this.showDoubleConfirm) return;
      if (!this.engine || !this.engine.undo()) return;

      this.$store.game.recordFacts(this.engine.facts());
      this.scoreInput.clear();
      this.error = "";
    },

    /** Implemented in Task 7 — completion upload, navigation, and replay. */
    async uploadAndCompleteSession(this: FiveOhOnePlayContext): Promise<void> {},
    async back(this: FiveOhOnePlayContext): Promise<void> {},
    async playAgain(this: FiveOhOnePlayContext): Promise<void> {},
    async abandonAndExit(this: FiveOhOnePlayContext): Promise<void> {},
  };
}
```

**Note on the comment form:** `/** */` (JSDoc), never `//`. `scripts/check-no-inline-comments.sh` treats the whole `fiveOhOnePlay()` body — including the object literal it returns — as a function body, so a `//` comment here fails the gate; JSDoc is exempt (verified against the guard).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/five-oh-one-play.data.ts app/tests/lib/game/five-oh-one-play.data.test.ts
git commit -m "Add fiveOhOnePlay visit recording, double-confirm gate, and leg-scoped stats"
```

---

### Task 7: `five-oh-one-play.data.ts` — completion, abandon, and play again

Replaces the four stub methods from Task 6 with the real implementations, mirroring `score-training-play.data.ts`'s completion/abandon/playAgain (no timer to manage — 501 has none).

**Files:**
- Modify: `app/src/lib/game/five-oh-one-play.data.ts`
- Modify: `app/tests/lib/game/five-oh-one-play.data.test.ts`

**Interfaces:**
- Consumes: `appendBatch`, `completeSession`, `createSession` (`@client/api/sessions`), `buildEventsBatch` (`@modules/game/events.payload.module`).
- Produces: fully implemented `uploadAndCompleteSession`, `back`, `playAgain`, `abandonAndExit` — Task 8's play page and results modal call these directly.

- [ ] **Step 1: Add the failing tests**

`@client/api/sessions` is already mocked at the top of `app/tests/lib/game/five-oh-one-play.data.test.ts` (Task 6 declared the full `vi.mock` up front for exactly this reason). Change the existing import line

```typescript
import { fetchActiveSessions } from "@client/api/sessions";
```

to pull in the three additional functions this task's tests need:

```typescript
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
```

Add these test blocks at the end of the file, before the final closing of the file (i.e. as new top-level `describe` blocks):

```typescript
describe("uploadAndCompleteSession", () => {
  it("uploads the batch, completes the session, and snapshots match-wide results", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      turns: [turnFact("t1", "leg-1", 1, 461), turnFact("t2", "leg-1", 2, 40)],
    });

    await play.uploadAndCompleteSession.call(play);

    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
    expect(play.completionStatus).toBe("succeeded");
    expect(play.resultsSnapshot).toEqual({ total: 501, legs: 1, average: 250.5 });
  });

  it("reports legs WON, not legs played, when a Best-of-5 is won 3-1", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 4, turns: 4, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    // Four legs played (three won, one lost) — stages.length is 4, legsToWin is 3.
    const play = makePlay({
      configSnapshot: bestOf5Config(),
      stages: [
        LEG_1,
        { ...LEG_1, clientKey: "leg-2", sequence: 2 },
        { ...LEG_1, clientKey: "leg-3", sequence: 3 },
        { ...LEG_1, clientKey: "leg-4", sequence: 4 },
      ],
      turns: [
        turnFact("t1", "leg-1", 1, 501),
        turnFact("t2", "leg-2", 1, 501),
        turnFact("t3", "leg-3", 1, 200),
        turnFact("t4", "leg-4", 1, 501),
      ],
    });

    await play.uploadAndCompleteSession.call(play);

    expect(play.resultsSnapshot?.legs).toBe(3);
  });

  it('treats SESSION_ALREADY_COMPLETED as success', async () => {
    const error = new Error("SESSION_ALREADY_COMPLETED");
    (error as { code?: string }).code = "SESSION_ALREADY_COMPLETED";
    vi.mocked(completeSession).mockRejectedValue(error);
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 0 },
    });
    const play = makePlay({ turns: [turnFact("t1", "leg-1", 1, 501)] });

    await play.uploadAndCompleteSession.call(play);

    expect(play.completionError).toBe("");
    expect(play.completionStatus).toBe("succeeded");
  });

  it('sets completionStatus "failed" on upload error', async () => {
    vi.mocked(appendBatch).mockRejectedValue(new Error("Network error"));
    const play = makePlay({ turns: [turnFact("t1", "leg-1", 1, 501)] });

    await play.uploadAndCompleteSession.call(play);

    expect(play.completionError).toContain("connection");
    expect(play.completionStatus).toBe("failed");
  });
});

describe("full checkout flow drives completion", () => {
  it("confirmDouble on the match-winning leg uploads and completes the session", async () => {
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 2, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "COMPLETED",
      completedAt: "now",
    });
    const play = makePlay({
      turns: [turnFact("t1", "leg-1", 1, 461)], // remaining 40
    });
    await play.init.call(play);
    play.scoreInput.setValue("40");
    await play.submitVisit.call(play);

    await play.confirmDouble.call(play);

    expect(play.finished).toBe(true);
    expect(play.completionStatus).toBe("succeeded");
    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "COMPLETED");
  });
});

describe("back", () => {
  it("resets the store and navigates to /games", async () => {
    const locationSpy = { href: "" };
    vi.stubGlobal("location", locationSpy);
    const play = makePlay();

    await play.back.call(play);

    expect(play.$store.game.reset).toHaveBeenCalled();
    expect(locationSpy.href).toBe("/games");
  });
});

describe("abandonAndExit", () => {
  it("with turns: appendBatch then completeSession ABANDONED, reset, navigate", async () => {
    const locationSpy = { href: "" };
    vi.stubGlobal("location", locationSpy);
    vi.mocked(appendBatch).mockResolvedValue({
      created: { stages: 1, turns: 1, darts: 0 },
    });
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "ABANDONED",
      completedAt: "now",
    });
    const play = makePlay({ turns: [turnFact("t1", "leg-1", 1, 60)] });

    await play.abandonAndExit.call(play);

    expect(appendBatch).toHaveBeenCalledTimes(1);
    expect(completeSession).toHaveBeenCalledWith("s1", "ABANDONED");
    expect(play.$store.game.reset).toHaveBeenCalled();
    expect(locationSpy.href).toBe("/games");
  });

  it("with zero turns: skips the batch call entirely", async () => {
    const locationSpy = { href: "" };
    vi.stubGlobal("location", locationSpy);
    vi.mocked(completeSession).mockResolvedValue({
      sessionId: "s1",
      statusKey: "ABANDONED",
      completedAt: "now",
    });
    const play = makePlay({ turns: [] });

    await play.abandonAndExit.call(play);

    expect(appendBatch).not.toHaveBeenCalled();
    expect(completeSession).toHaveBeenCalledWith("s1", "ABANDONED");
  });
});

describe("playAgain", () => {
  it("replays the same template and starts a fresh engine at sequence 1", async () => {
    const play = makePlay({
      turns: [turnFact("t1", "leg-1", 1, 461), turnFact("t2", "leg-1", 2, 40)],
    });
    play.completionStatus = "succeeded";
    play.finished = true;

    vi.mocked(createSession).mockResolvedValue({
      sessionId: "new-session",
      participants: [
        { ref: "new-participant", displayName: "Player", participantTypeKey: "PLAYER" },
      ],
    } as any);

    await play.playAgain.call(play);

    expect(createSession).toHaveBeenCalledWith({
      gameTypeKey: "501",
      rulesetVersionKey: "501_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
      config: { source: "template", templateRef: "tpl-1" },
    });
    expect(play.$store.game.sessionId).toBe("new-session");
    expect(play.$store.game.turns).toEqual([]);
    expect(play.finished).toBe(false);
    expect(play.completionStatus).toBe("pending");
    expect(play.resultsSnapshot).toBeNull();
    expect(play.hasActiveSession).toBe(true);

    play.scoreInput.setValue("100");
    await play.submitVisit.call(play);
    expect(play.$store.game.turns).toHaveLength(1);
    expect(play.$store.game.turns[0].sequence).toBe(1);
  });

  it("sets playAgainError and leaves completionStatus untouched on failure", async () => {
    const play = makePlay();
    play.completionStatus = "succeeded";
    vi.mocked(createSession).mockRejectedValue(new Error("Network error"));

    await play.playAgain.call(play);

    expect(play.playAgainError).toBeTruthy();
    expect(play.completionStatus).toBe("succeeded");
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts`
Expected: the pre-existing Task 6 tests still PASS; the new completion/abandon/playAgain tests FAIL (the stub methods are no-ops).

- [ ] **Step 3: Implement the four methods**

In `app/src/lib/game/five-oh-one-play.data.ts`:

Add these imports alongside the existing ones:

```typescript
import {
  appendBatch,
  completeSession,
  createSession,
  fetchActiveSessions,
} from "@client/api/sessions";
import { buildEventsBatch } from "@modules/game/events.payload.module";
```

Add this module-level helper next to `foldLegState`:

```typescript
/**
 * The engine owns the fact log while a session is live; the store mirrors
 * it. Upload paths that can run without a live engine (a completion retry
 * driven straight from the results modal) fall back to the persisted
 * mirror — mirrors `score-training-play.data.ts`'s `currentFacts`.
 */
function currentFacts(context: FiveOhOnePlayContext): EngineFacts {
  return (
    context.engine?.facts() ?? {
      stages: context.$store.game.stages,
      turns: context.$store.game.turns,
    }
  );
}

/**
 * Match-wide summary for the results modal.
 *
 * `legsWon` is the caller's `config.legsToWin`, never `stages.length`: a stage
 * exists per leg *played*, and a Best-of-5 won 3-1 played four legs while
 * winning three. This function only ever runs on the completion path, which
 * `record()` reaches exactly when `legsWon` hits `legsToWin` — so the
 * configured target is the legs actually won, by definition.
 *
 * `average` is per-visit, matching Score Training. For 501 that equals the
 * 3-dart average for every full visit; the checkout visit may have used fewer
 * than three darts, which this slightly under-weights. Recovering it needs
 * per-dart capture, which 501 does not have (`06-Spec/04-Runtime-Layer.md`).
 */
function computeStats(
  turns: TurnFact[],
  legsWon: number,
): { total: number; legs: number; average: number } {
  const total = turns.reduce((sum, turn) => sum + turn.totalScore, 0);
  return {
    total,
    legs: legsWon,
    average: turns.length === 0 ? 0 : total / turns.length,
  };
}
```

Replace the four stub methods at the bottom of the returned object with:

```typescript
/**
 * Uploads the fact log, then marks the session COMPLETED. On this path
 * only, SESSION_ALREADY_COMPLETED counts as success. Stats are copied into
 * `resultsSnapshot` before any store mutation so the results modal never
 * depends on `$store.game.turns` surviving a later reset.
 */
async uploadAndCompleteSession(this: FiveOhOnePlayContext): Promise<void> {
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

  this.resultsSnapshot = computeStats(
    this.$store.game.turns,
    this.$store.game.configSnapshot!.legsToWin,
  );
  this.completionStatus = "succeeded";
},

async back(this: FiveOhOnePlayContext) {
  this.$store.game.reset();
  globalThis.location.href = "/games";
},

async abandonAndExit(this: FiveOhOnePlayContext) {
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
 * Replays the same configuration template the first session used. Store
 * and UI are mutated only once the new session exists: on failure the
 * modal stays open with the results visible and the buttons enabled,
 * since the prior session is already COMPLETED.
 */
async playAgain(this: FiveOhOnePlayContext) {
  const config = this.$store.game.configSnapshot;
  const templateRef = this.$store.game.templateRef;
  if (!config || !templateRef || this.playAgainLoading) return;
  const factory = getEngineFactory(RULESET_VERSION_KEY);
  if (!factory) return;

  this.playAgainLoading = true;
  this.playAgainError = "";

  try {
    let session;
    try {
      session = await createSession({
        gameTypeKey: GAME_TYPE_KEY,
        rulesetVersionKey: RULESET_VERSION_KEY,
        captureModeKey: "RECREATIONAL",
        inputModeKey: "QUICK_SCORE",
        config: { source: "template", templateRef },
      });
    } catch {
      this.playAgainError = "Could not start a new session. Try again.";
      return;
    }

    this.$store.game.sessionId = session.sessionId;
    this.$store.game.participantRef = session.participants[0].ref;
    this.$store.game.idempotencyKey = null;

    this.finished = false;
    this.completionStatus = "pending";
    this.completionError = "";
    this.resultsSnapshot = null;
    this.pendingCheckoutScore = null;
    this.showDoubleConfirm = false;
    this.scoreInput.clear();
    this.error = "";
    this.hasActiveSession = true;

    const engine = factory.create(config);
    if (!(engine instanceof FiveOhOneEngine)) return;
    this.engine = engine;
    this.$store.game.recordFacts(engine.facts());
  } finally {
    this.playAgainLoading = false;
  }
},
```

Remove the now-superseded stub block (`// Implemented in Task 7 …` and its four one-line stubs) — the methods above replace it in place.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts`
Expected: PASS (all tests from Task 6 + Task 7 — 22 total)

- [ ] **Step 5: Typecheck**

Run: `cd app && npx astro check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/five-oh-one-play.data.ts app/tests/lib/game/five-oh-one-play.data.test.ts
git commit -m "Implement fiveOhOnePlay completion, abandon, and play-again"
```

---

### Task 8: 501 play page — interface, results modal, and wiring

**Files:**
- Create: `app/src/components/layout/games/interfaces/FiveOhOne.astro`
- Create: `app/src/components/layout/games/result-modals/FiveOhOneResults.astro`
- Create: `app/src/pages/games/501/play/index.astro`
- Modify: `app/src/lib/client/alpine/register-route-data.ts`
- Modify: `app/src/components/layout/games/SinglePlayerDisplay.astro` (retire two resolved TODOs)

**Interfaces:**
- Consumes: `fiveOhOnePlay` (Task 6/7), `SinglePlayerDisplay`, `ScoreInput`, `StatRow` (existing, unchanged), `ContinueSessionModal`/`NoSessionPanel` (Task 2), `ConfirmDialog`, `GameLayout` (existing, unchanged).

- [ ] **Step 1: Create the interface component**

```astro
---
// app/src/components/layout/games/interfaces/FiveOhOne.astro
interface Props {
  [key: string]: unknown;
}

// Props
const { ...props }: Props = Astro.props;

// Components
import SinglePlayerDisplay from "@components/layout/games/SinglePlayerDisplay.astro";
import ScoreInput from "@components/layout/games/ScoreInput.astro";
import StatRow from "@components/layout/games/StatRow.astro";
---

<div
  class="flex flex-col flex-1 min-h-0 gap-3"
  {...props}
>
  <SinglePlayerDisplay
    isTarget={true}
    target="remainingScore()"
    class="max-h-2/5"
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
          label="Darts"
          value="dartsThrownThisLeg()"
        />
        <StatRow
          label="Average"
          value="averageThisLeg()"
        />
        <StatRow
          label="Previous"
          value="previousScoreThisLeg()"
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
    submitDisabled="!scoreInput.value || showDoubleConfirm || finished"
    padDisabled="showDoubleConfirm || finished"
    undoClick="undoVisit()"
    undoDisabled="!$store.game.turns.length || showDoubleConfirm || finished"
  />
</div>
```

- [ ] **Step 2: Create the results modal**

```astro
---
// app/src/components/layout/games/result-modals/FiveOhOneResults.astro
import Button from "@components/forms/Button.astro";
import StatRow from "@components/layout/games/StatRow.astro";
import IsLoading from "@components/ui/IsLoading.astro";
---

<div
  class="fixed inset-0 flex items-center justify-center bg-black/50 z-50 w-full"
  x-show="finished"
  x-cloak
>
  <div
    class="glass rounded-lg border border-border bg-surface-raised p-6 shadow-lg max-w-sm"
  >
    <h2 class="font-display text-lg font-semibold text-foreground">
      Match Summary
    </h2>

    {/* Stats: live from store while saving, snapshot once succeeded */}
    <dl
      class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
      x-show="completionStatus !== 'succeeded'"
      x-cloak
    >
      <StatRow
        label="Total"
        value="$store.game.turns.reduce((sum, t) => sum + t.totalScore, 0)"
      />
      <StatRow
        label="Legs"
        value="$store.game.stages.length"
      />
      <StatRow
        label="Average"
        value="($store.game.turns.reduce((sum, t) => sum + t.totalScore, 0) / Math.max($store.game.turns.length, 1)).toFixed(1)"
      />
    </dl>
    <dl
      class="mt-4 space-y-2 text-sm text-muted-foreground flex flex-col"
      x-show="completionStatus === 'succeeded' && resultsSnapshot"
      x-cloak
    >
      <StatRow
        label="Total"
        value="resultsSnapshot?.total"
      />
      <StatRow
        label="Legs"
        value="resultsSnapshot?.legs"
      />
      <StatRow
        label="Average"
        value="resultsSnapshot?.average.toFixed(1)"
      />
    </dl>

    {/* Completion status */}
    <div class="mt-4">
      <IsLoading
        title="Saving..."
        x-show="completionStatus === 'pending' || completionStatus === 'saving'"
        x-cloak
      />
      <div
        x-show="completionStatus === 'failed'"
        x-cloak
      >
        <p
          class="alert alert-error rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
          role="alert"
          x-text="completionError"
        >
        </p>
        <Button
          class="mt-2"
          @click="uploadAndCompleteSession()"
          title="Retry"
        />
      </div>
      <p
        class="text-sm text-success"
        x-show="completionStatus === 'succeeded'"
        x-cloak
      >
        Saved!
      </p>
    </div>

    {
      /* Play-again failure: separate from completion status, buttons stay enabled */
    }
    <p
      class="alert alert-error mt-2 rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
      role="alert"
      x-text="playAgainError"
      x-show="playAgainError"
      x-cloak
    >
    </p>

    {/* Action buttons: enabled only when completionStatus === 'succeeded' */}
    <div class="mt-6 flex justify-end gap-3">
      <Button
        variant="secondary"
        @click="back()"
        :disabled="completionStatus !== 'succeeded'"
        title="Back to games"
      />
      <Button
        @click="playAgain()"
        :disabled="completionStatus !== 'succeeded' || playAgainLoading"
        title="Play again"
      />
    </div>
  </div>
</div>
```

- [ ] **Step 3: Create the play page**

```astro
---
// app/src/pages/games/501/play/index.astro
export const prerender = true;
import GameLayout from "@layouts/GameLayout.astro";
import FiveOhOne from "@components/layout/games/interfaces/FiveOhOne.astro";
import ConfirmDialog from "@components/ui/ConfirmDialog.astro";
import FiveOhOneResults from "@components/layout/games/result-modals/FiveOhOneResults.astro";
import NoSessionPanel from "@components/layout/games/NoSessionPanel.astro";
import ReconciliationBlocked from "@components/layout/games/ReconciliationBlocked.astro";
---

<GameLayout
  title="501 — Play"
  gameTitle="501"
>
  <div
    class="flex flex-col flex-1 min-h-0 p-3"
    x-data="fiveOhOnePlay()"
    @confirm-exit.window="abandonAndExit()"
  >
    {/* Loading / reconciliation-blocked */}
    <ReconciliationBlocked />

    {/* No active session view */}
    <NoSessionPanel href="/games/501/setup" />

    {/* Gameplay view */}
    <FiveOhOne
      x-show="!finished && hasActiveSession"
      x-cloak
    />

    {/* Double-out confirm — 501 can only know a checkout from a bust by asking */}
    <div
      x-show="showDoubleConfirm"
      x-cloak
    >
      <ConfirmDialog
        titleId="double-confirm-title"
        title="Finished on a double?"
        description="Confirm the last dart landed in a double, or the visit is recorded as a bust."
        cancelLabel="No — bust"
        confirmLabel="Yes"
        onCancel="denyDouble()"
        onConfirm="confirmDouble()"
        dismissible={false}
      />
    </div>

    {/* Results modal (overlay) */}
    <FiveOhOneResults />
  </div>
</GameLayout>
```

- [ ] **Step 4: Register the Alpine data factory**

Modify `app/src/lib/client/alpine/register-route-data.ts`:

```typescript
import type { Alpine } from "alpinejs";
import { loginForm } from "@auth/login.data";
import { scoreTrainingSetup } from "@lib/game/score-training-setup.data";
import { scoreTrainingPlay } from "@lib/game/score-training-play.data";
import { fiveOhOneSetup } from "@lib/game/five-oh-one-setup.data";
import { fiveOhOnePlay } from "@lib/game/five-oh-one-play.data";

export function registerRouteData(Alpine: Alpine) {
  Alpine.data("loginForm", loginForm);
  Alpine.data("scoreTrainingSetup", scoreTrainingSetup);
  Alpine.data("scoreTrainingPlay", scoreTrainingPlay);
  Alpine.data("fiveOhOneSetup", fiveOhOneSetup);
  Alpine.data("fiveOhOnePlay", fiveOhOnePlay);
}
```

- [ ] **Step 5: Retire the two resolved TODOs in `SinglePlayerDisplay.astro`**

That component currently carries two `{/* TODO */}` blocks this task resolves — one reserving checkout route tips, one reserving the darts/average/previous progress slot as "out of scope for Score Training play UI". Both are now implemented by `FiveOhOne.astro` through the existing `progress` slot. Leaving them would tell the next reader the capability is still missing.

Delete the TODO block above the root `<div>` entirely, and replace the TODO block above `<slot name="progress" />` with a plain description of the slot's contract. The component's markup and props are otherwise unchanged — no behavioral edit:

```astro
---
/**
 * Single-player score/target display with Alpine live binding.
 * @param {string} [score] Alpine expression for score text
 * @param {string} [target] Alpine expression for target text
 * @param {boolean} [isTarget] Show target vs score
 * @param {string} [class] Extra classes
 */
interface Props {
  score?: string;
  target?: string;
  isTarget?: boolean;
  class?: string;
}

// Props
const {
  score,
  target,
  isTarget = true,
  class: classNameProp = "",
}: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Styles
const className = cn("flex-1 min-h-0 glass rounded-lg", classNameProp);
---

<div class={className}>
  <div
    class="rounded-lg border border-border bg-surface-raised h-full p-3 mx-auto flex flex-col items-center justify-center"
  >
    <h1
      class="text-7xl font-mono font-bold tabular-nums"
      x-text={isTarget ? target : score}
    >
    </h1>
    <span class="text-sm text-muted-foreground uppercase">
      {isTarget ? "Target" : "Score"}
    </span>
    {
      /* Per-game progress region — e.g. 501's checkout route plus its
      darts/average/previous stats. Games with nothing to add pass no slot
      content and the region collapses. */
    }
    <slot name="progress" />
  </div>
</div>
```

- [ ] **Step 6: Manual end-to-end verification**

Run: `cd app && npm run dev -- --background`, then in a browser:

1. Visit `/games/501/setup`, leave "Legs to win" at `1`, click "Let's play" — lands on `/games/501/play` with the target showing 501.
2. Enter a score that doesn't reach 0 (e.g. `100`) — remaining drops to 401, no confirm dialog, "Previous" stat shows `100`.
3. Manually drive the remaining score down to exactly 40 (e.g. enter `180`, `180`, `41`), then enter `40` — the "Finished on a double?" dialog appears. Click "No — bust" — remaining stays at 40, "Previous" shows `0`.
4. Enter `40` again, click "Yes" — a 1-leg match shows the Match Summary modal with Total/Legs/Average, saves, "Play again" and "Back to games" both work.
5. Check that when remaining is 121 the checkout hint under the target reads `T19 14 BULL`, and that it disappears when remaining is a bogey number (e.g. drive to 169 if practical, or trust Task 1's unit coverage) or above 170.
6. Confirm undo removes the last visit and the exit (top-left) button abandons correctly.
7. **Layout check:** the target card is capped at `max-h-2/5` (copied from Score Training), and 501 now puts a checkout line *plus* three stat rows in its `progress` slot. Confirm nothing clips or overflows at a phone viewport (~390×844 in devtools) with a long hint like `T19 14 BULL` showing. If it clips, raise the cap on the `class` prop passed from `FiveOhOne.astro` — do not restructure `SinglePlayerDisplay`.
8. Load `/games/score-training/play` once more and confirm its display is visually unchanged by the Step 5 edit (it passes no `progress` slot content, so the region should collapse to nothing).

Stop the dev server afterward (`astro dev stop`).

- [ ] **Step 7: Commit**

```bash
git add app/src/components/layout/games/interfaces/FiveOhOne.astro app/src/components/layout/games/result-modals/FiveOhOneResults.astro app/src/pages/games/501/play/index.astro app/src/lib/client/alpine/register-route-data.ts app/src/components/layout/games/SinglePlayerDisplay.astro
git commit -m "Add 501 play page: interface, results modal, and double-confirm wiring"
```

---

### Task 9: Link 501 from the games list

**Files:**
- Modify: `app/src/pages/games/index.astro`

- [ ] **Step 1: Add the GameCard**

```astro
---
export const prerender = true;

import AppLayout from "@layouts/AppLayout.astro";
import GameCard from "@components/layout/games/GameCard.astro";
---

<AppLayout title="Games">
  <div class="p-4 space-y-4">
    <h1 class="text-xl font-semibold text-foreground">Games</h1>
    <GameCard
      href="/games/score-training/setup"
      title="Score training"
      caption="Exercise your scoring abilities."
    />
    <GameCard
      href="/games/501/setup"
      title="501"
      caption="Classic double-out darts."
    />
  </div>
</AppLayout>
```

- [ ] **Step 2: Manual verification**

Run: `cd app && npm run dev -- --background`, visit `/games`, confirm both cards render and the 501 card navigates to `/games/501/setup`. Stop the dev server afterward (`astro dev stop`).

- [ ] **Step 3: Commit**

```bash
git add app/src/pages/games/index.astro
git commit -m "Link 501 from the games list"
```

---

### Task 10: Full validation pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `cd app && npm test`
Expected: all tests pass, including every test added in Tasks 1, 4, 6, and 7.

- [ ] **Step 2: Run the project's validation sequence**

Run: `cd app && npm run validate:app`
Expected: passes (db:status, db:migrate, db:introspect, fallow, tests, `astro check`, graph refresh — per the `validate-app` skill). No DB/migration files changed in this plan, so this should be a clean pass with no drift to reconcile.

- [ ] **Step 3: Run the mechanical guards touched by this plan's file additions**

Run: `bash scripts/check-file-locations.sh && bash scripts/check-astro-conventions.sh && bash scripts/check-astro-class-composition.sh && bash scripts/check-style-tokens.sh && bash scripts/check-no-inline-comments.sh && bash scripts/check-type-barrels.sh`
Expected: all pass. (`check-game-engines.sh` / `check-refinement-coverage.sh` are unaffected since no engine or ruleset schema file changed, but running them costs nothing: `bash scripts/check-game-engines.sh && bash scripts/check-refinement-coverage.sh`.)

- [ ] **Step 4: Format check**

Run: `cd app && npm run format:check`
Expected: clean. If not, run `npm run format`, review the diff, and commit it separately.

- [ ] **Step 5: Register this task's docs and new module in the Context Map**

Root `CLAUDE.md` requires every new doc to be registered in `docs/architecture/00-Context-Map.md` **in the same change**. Three concrete edits — do these explicitly rather than assuming the skill infers them:

1. In the `## Context & history (repo root, `docs/`)` table, add two rows alongside the existing `docs/superpowers/**` entries (every prior spec and plan has its own row — match that form):

```markdown
| `docs/superpowers/specs/2026-08-01-501-recreational-v1-design.md` | 501 recreational v1 design: setup/play flow mirroring Score Training, double-out confirm gate, checkout-path lookup, leg-scoped progress stats (2026-08-01) | historical |
| `docs/superpowers/plans/2026-08-01-501-recreational-v1.md` | The 10-task plan implementing that spec: checkout-path module, shared-component reuse fixes, setup/play data factories, play UI, validation pass (2026-08-01) | historical |
```

2. In the `## Game engine code + mechanical guards` table, register the new module for discoverability beside `board-progression.module.ts`:

```markdown
| `app/src/modules/game/checkout-path.module.ts` | Standard 2-170 double-out checkout chart; `null` for bogey numbers (2026-08-01) | canonical |
```

3. Bump this file's `> **Version:**` line at the top, following the existing convention of naming the change and keeping the prior note. Current value is `1.7.7`; make it `1.7.8` with a `2026-08-01 — 501 recreational v1 spec/plan + checkout-path module registered` note and demote the existing `1.7.7` note to the "prior" clause.

**Pre-existing drift, do not fix here:** `docs/superpowers/specs/2026-07-31-score-training-configurable-duration-design.md` and `docs/superpowers/plans/2026-08-01-score-training-configurable-duration.md` are both already merged to `main` and are **absent** from the Context Map inventory. `scripts/check-context-map.sh` does not enforce `docs/superpowers/**` registration, which is how they slipped through. That gap is not this task's to close — raise it separately rather than expanding this diff. Register only this task's two docs.

- [ ] **Step 6: Run the context-integrity guards**

Run: `bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh`
Expected: all three pass. `check-context-budget.sh` is the one most likely to complain — it compares each file's `~Nk` estimate against a chars/4 estimate, and the three rows above lengthen `00-Context-Map.md`. If it fails, update this file's own `~5.5k` estimate in its File Inventory row to the value the script reports.

- [ ] **Step 7: Context maintenance skill**

Invoke the `context-maintenance` skill per root `CLAUDE.md` for the remaining gate items it owns (CLAUDE.md/AGENT.md mirror sync, `DECISIONS.md` consideration, knowledge-graph refresh, branch/PR check, self-learning gate). No `DECISIONS.md` entry is expected: this task adds no new architectural decision — it implements an existing engine behind the established Score Training page pattern. If the skill's review disagrees, follow the skill.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "Register 501 v1 docs and checkout-path module in the context map"
```
