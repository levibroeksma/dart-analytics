# Checkout Hints Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a setup-page toggle that controls whether 501, 121, and TUOD show a suggested checkout route during play (issue #203).

**Architecture:** A client-only `$persist` Alpine store (`checkoutHints`, one boolean field `enabled`, default `true`) backs a new `Switch.astro` toggle rendered on all three games' setup screens. The three play-data files gate their existing (501/121) or newly added (TUOD) `checkoutHint()`/`checkoutHintFor(seatRef)` getters on that store's value. No backend, no migration, no session-config change — see `docs/superpowers/specs/2026-08-31-checkout-hints-toggle-design.md` for the rejected alternatives and why.

**Tech Stack:** Astro, Alpine.js (`$persist` via `@alpinejs/persist`), TypeScript, Vitest.

## Global Constraints

- Client-only preference, no backend/API/migration change.
- One shared boolean for all three games, not per-game-type.
- Default `true` (preserves 501/121's current unconditional display).
- Semantic tokens only — no raw Tailwind palette utilities, no `font-medium`, no important modifier (`app/CLAUDE.md`).
- `$persist` only inside `*.store.ts`; a fresh `persist()` closure per field (D120) — never reuse one across fields.
- Never `//`/`/* */` comments inside TS function bodies in `app/src/**/*.ts` — JSDoc above the declaration instead.
- TDD: a failing test before the implementation, for every runtime `.ts` change (`app/CLAUDE.md`, D224). `.astro` markup has no test runner (D101) — verified by reading the diff and, where practical, the dev server instead.
- Place new/edited tests under `app/tests/`, mirroring `app/src/`'s structure — never colocated.
- Run `cd app && npm run format` before considering any task's formatting final.

---

### Task 1: `checkoutHintsStore` — client-only persisted preference

**Files:**
- Create: `app/src/stores/checkout-hints.store.ts`
- Modify: `app/src/lib/client/alpine/register-stores.ts`
- Test: `app/tests/stores/checkout-hints.store.test.ts`

**Interfaces:**
- Consumes: `PersistFactory` from `@alpinejs/persist` (`() => Persist`, already used by `boardInputStore`/`gameStore`).
- Produces: `checkoutHintsStore(persist: PersistFactory): { enabled: boolean }`, registered as `Alpine.store("checkoutHints", ...)`. Later tasks read it as `this.$store.checkoutHints?.enabled`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/stores/checkout-hints.store.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Persist } from "@alpinejs/persist";
import { checkoutHintsStore } from "@stores/checkout-hints.store";

function stubPersistFactory(): () => Persist {
  return () => ((initial: unknown) => ({ as: () => initial })) as Persist;
}

function rehydratingPersistFactory(
  stored: Record<string, unknown>,
): () => Persist {
  return () =>
    ((initial: unknown) => ({
      as: (alias: string) => (alias in stored ? stored[alias] : initial),
    })) as Persist;
}

describe("checkoutHintsStore", () => {
  it("defaults to enabled with no persisted value", () => {
    const store = checkoutHintsStore(stubPersistFactory());

    expect(store.enabled).toBe(true);
  });

  it("rehydrates a persisted false value", () => {
    const store = checkoutHintsStore(
      rehydratingPersistFactory({ "checkoutHints.enabled": false }),
    );

    expect(store.enabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/stores/checkout-hints.store.test.ts`
Expected: FAIL — `Cannot find module '@stores/checkout-hints.store'` (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `app/src/stores/checkout-hints.store.ts`:

```ts
import type { PersistFactory } from "@alpinejs/persist";

/**
 * Whether the play interface shows a suggested checkout route (501, 121,
 * TUOD). A per-device display preference, not gameplay data, so it stays in
 * $persist rather than round-tripping through player_settings — the same
 * reasoning `boardInputStore`'s handedness field documents.
 *
 * @param persist - Must return a fresh Alpine `$persist` instance per call
 *   (D120).
 */
export function checkoutHintsStore(persist: PersistFactory) {
  return {
    enabled: persist<boolean>(true).as("checkoutHints.enabled"),
  };
}
```

Modify `app/src/lib/client/alpine/register-stores.ts` — add the import and registration:

```ts
import type { Alpine } from "alpinejs";
import type { Persist } from "@alpinejs/persist";
import { authStore } from "@stores/auth.store";
import { boardInputStore } from "@stores/board-input.store";
import { checkoutHintsStore } from "@stores/checkout-hints.store";
import { gameStore } from "@stores/game.store";
import { profileStore } from "@stores/profile.store";
import { settingsStore } from "@stores/settings.store";

export function registerStores(Alpine: Alpine) {
  Alpine.store("auth", authStore());
  Alpine.store("settings", settingsStore());
  Alpine.store("profile", profileStore());
  /**
   * Alpine's `$persist` getter returns a fresh persist() per access —
   * required so each store field gets its own `.as()` alias closure.
   */
  const persist = () => (Alpine as unknown as { $persist: Persist }).$persist;
  Alpine.store("game", gameStore(persist));
  Alpine.store("boardInput", boardInputStore(persist));
  Alpine.store("checkoutHints", checkoutHintsStore(persist));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/stores/checkout-hints.store.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
cd app && npm run format
git add app/src/stores/checkout-hints.store.ts app/src/lib/client/alpine/register-stores.ts app/tests/stores/checkout-hints.store.test.ts
git commit -m "Add checkoutHints persisted store"
```

---

### Task 2: Shared type widening — `lib/game/types.ts`

**Files:**
- Modify: `app/src/lib/game/types.ts:158` (before `PlayStoreContext`), `:357`, `:620`, `:709`, and the block at `:362-365` (TUOD method signatures)

**Interfaces:**
- Consumes: nothing new.
- Produces: `CheckoutHintsStoreContext = { enabled: boolean }`; `FiveOhOnePlayContext["$store"]`, `OneTwentyOnePlayContext["$store"]`, `TuodPlayContext["$store"]` each widen to `PlayStoreContext<...> & { checkoutHints?: CheckoutHintsStoreContext }`; `TuodPlayContext` gains `checkoutHintFor(this: TuodPlayContext, seatRef: string): string` and `checkoutHint(this: TuodPlayContext): string`. Tasks 4-6 implement these; Task 7 does not touch this file.

This task is type-only — exempt from `scripts/check-test-coverage.sh` (`app/CLAUDE.md`, D224) — so its own verification is a clean type-check, not a new test file.

- [ ] **Step 1: Add `CheckoutHintsStoreContext` and widen `$store` on the three target types**

In `app/src/lib/game/types.ts`, immediately before the `PlayStoreContext` JSDoc comment (currently starting at line 145), add:

```ts
/**
 * Optional because only 501, 121, and TUOD read it — every other ruleset's
 * `$store` simply omits the field rather than declaring it always-present.
 * A per-device display preference (`checkoutHintsStore`), not gameplay data.
 */
export type CheckoutHintsStoreContext = {
  enabled: boolean;
};

```

Change (TUOD, currently line 357):

```ts
  $store: PlayStoreContext<TuodSnapshot>;
```

to:

```ts
  $store: PlayStoreContext<TuodSnapshot> & {
    checkoutHints?: CheckoutHintsStoreContext;
  };
```

Change (501, currently line 620):

```ts
  $store: PlayStoreContext<FiveOhOneSnapshot>;
```

to:

```ts
  $store: PlayStoreContext<FiveOhOneSnapshot> & {
    checkoutHints?: CheckoutHintsStoreContext;
  };
```

Change (121, currently line 709):

```ts
  $store: PlayStoreContext<OneTwentyOneSnapshot | OneTwentyOneV2Snapshot>;
```

to:

```ts
  $store: PlayStoreContext<OneTwentyOneSnapshot | OneTwentyOneV2Snapshot> & {
    checkoutHints?: CheckoutHintsStoreContext;
  };
```

- [ ] **Step 2: Add the two new TUOD method signatures**

In `TuodPlayContext` (currently lines 362-365), change:

```ts
  visitMarkers(this: TuodPlayContext): BoardMarker[];
  state(this: TuodPlayContext): TuodState | null;
  currentTargetLabelFor(this: TuodPlayContext, seatRef: string): string;
  currentTargetLabel(this: TuodPlayContext): string;
```

to:

```ts
  visitMarkers(this: TuodPlayContext): BoardMarker[];
  state(this: TuodPlayContext): TuodState | null;
  currentTargetLabelFor(this: TuodPlayContext, seatRef: string): string;
  currentTargetLabel(this: TuodPlayContext): string;
  checkoutHintFor(this: TuodPlayContext, seatRef: string): string;
  checkoutHint(this: TuodPlayContext): string;
```

- [ ] **Step 3: Verify the project still type-checks**

Run: `cd app && npx astro check`
Expected: `0 errors, 0 warnings, 0 hints` (Tasks 4-6 haven't implemented the two new TUOD methods on the object yet, but the type file alone has no implementation to check against — `types.ts` only declares shapes, so this passes immediately. If it doesn't, a call site elsewhere already relies on the narrower pre-existing type; re-read the error and fix the type edit, not the call site.)

- [ ] **Step 4: Commit**

```bash
cd app && npm run format
git add app/src/lib/game/types.ts
git commit -m "Widen 501/121/TUOD play-context types for the checkout-hints toggle"
```

---

### Task 3: `Switch.astro` component

**Files:**
- Create: `app/src/components/forms/Switch.astro`

**Interfaces:**
- Consumes: `cn` from `@client/cn` (existing helper).
- Produces: `<Switch label={string} hint?={string} class?={string} {...rest} />` — a `<label>` wrapping a visually-hidden `<input type="checkbox" class="sr-only peer">` (rest props, e.g. `x-model`, forward onto it) plus a styled track `<div>`. Task 6 consumes this as `<Switch label="Show checkout hints" x-model="$store.checkoutHints.enabled" />`.

No test: `.astro` markup has no test runner in this project (D101) — verified visually in Task 6's manual check once it's wired into a real setup page.

- [ ] **Step 1: Write the component**

Create `app/src/components/forms/Switch.astro`:

```astro
---
/**
 * Boolean switch: a sliding track+thumb rather than a checkbox glyph. Wraps
 * a visually-hidden `<input type="checkbox">` so screen readers and
 * keyboard users get native checkbox semantics — rest props (`x-model`,
 * `:disabled`, `id`, `name`, …) forward onto that input, the same way
 * `Input.astro` forwards onto its own native element.
 * @param {string} label Visible label text
 * @param {string} [hint] Optional italic caption after the label
 * @param {string} [class] Extra classes on the wrapping `<label>`
 */
interface Props {
  label: string;
  hint?: string;
  class?: string;
  [key: string]: unknown;
}

// Props
const { label, hint, class: classNameProp, ...props }: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Styles
const className = cn(
  "inline-flex items-center cursor-pointer",
  classNameProp,
);
const trackClass =
  "relative w-9 h-5 shrink-0 rounded-full bg-surface-overlay transition-colors duration-150 peer-checked:bg-accent peer-focus-visible:ring-4 peer-focus-visible:ring-accent-muted after:content-[''] after:absolute after:top-0.5 after:start-0.5 after:size-4 after:rounded-full after:bg-foreground after:transition-transform after:duration-150 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full";
---

<label class={className}>
  <input
    type="checkbox"
    class="sr-only peer"
    {...props}
  />
  <div class={trackClass}></div>
  <span class="select-none ms-3 text-sm font-semibold text-foreground">
    {label}
  </span>
  {
    hint && (
      <span class="ms-2 text-xs text-muted-foreground italic">{hint}</span>
    )
  }
</label>
```

- [ ] **Step 2: Verify it compiles**

Run: `cd app && npx astro check`
Expected: `0 errors, 0 warnings, 0 hints`

- [ ] **Step 3: Commit**

```bash
cd app && npm run format
git add app/src/components/forms/Switch.astro
git commit -m "Add Switch.astro boolean toggle component"
```

---

### Task 4: Gate 501's checkout hint

**Files:**
- Modify: `app/src/lib/game/five-oh-one-play.data.ts` (the `checkoutHintFor`/`checkoutHint` methods)
- Test: `app/tests/lib/game/five-oh-one-play.data.test.ts` (extends the existing `describe("checkoutHint", ...)` block)

**Interfaces:**
- Consumes: `CheckoutHintsStoreContext` (Task 2, via `FiveOhOnePlayContext["$store"]["checkoutHints"]`).
- Produces: unchanged signatures `checkoutHintFor(this: FiveOhOnePlayContext, seatRef: string): string` / `checkoutHint(this: FiveOhOnePlayContext): string` — same return type and existing "" fallback, now additionally "" whenever `this.$store.checkoutHints?.enabled === false`.

- [ ] **Step 1: Write the failing tests**

In `app/tests/lib/game/five-oh-one-play.data.test.ts`, inside the existing `describe("checkoutHint", ...)` block (currently two `it`s: "shows the finish route once the remaining score is checkoutable" and "is empty above 170 or on a bogey number"), add:

```ts
  it("is empty when checkout hints are disabled, even with a valid route", async () => {
    const play = makePlay({
      turns: turnsReaching(40), // remaining 40
    });
    play.$store.checkoutHints = { enabled: false };
    await play.init.call(play);

    expect(play.checkoutHint.call(play)).toBe("");
  });

  it("checkoutHintFor is also empty when checkout hints are disabled", async () => {
    const play = makePlay({
      turns: turnsReaching(40), // remaining 40
    });
    play.$store.checkoutHints = { enabled: false };
    await play.init.call(play);

    expect(play.checkoutHintFor.call(play, "participant-1")).toBe("");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts -t "checkout hints are disabled"`
Expected: FAIL — both assertions currently receive `"D20"` instead of `""`.

- [ ] **Step 3: Write minimal implementation**

In `app/src/lib/game/five-oh-one-play.data.ts`, change:

```ts
    checkoutHintFor(this: FiveOhOnePlayContext, seatRef: string): string {
      const path = checkoutPathFor(this.remainingScoreFor(seatRef));
      return path ? path.join(" ") : "";
    },

    checkoutHint(this: FiveOhOnePlayContext): string {
      const path = checkoutPathFor(this.remainingScore());
      return path ? path.join(" ") : "";
    },
```

to:

```ts
    checkoutHintFor(this: FiveOhOnePlayContext, seatRef: string): string {
      if (this.$store.checkoutHints?.enabled === false) return "";
      const path = checkoutPathFor(this.remainingScoreFor(seatRef));
      return path ? path.join(" ") : "";
    },

    checkoutHint(this: FiveOhOnePlayContext): string {
      if (this.$store.checkoutHints?.enabled === false) return "";
      const path = checkoutPathFor(this.remainingScore());
      return path ? path.join(" ") : "";
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-play.data.test.ts`
Expected: PASS (all tests in the file, including the 2 new ones)

- [ ] **Step 5: Commit**

```bash
cd app && npm run format
git add app/src/lib/game/five-oh-one-play.data.ts app/tests/lib/game/five-oh-one-play.data.test.ts
git commit -m "Gate 501's checkout hint behind the checkoutHints toggle"
```

---

### Task 5: Gate 121's checkout hint

**Files:**
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts` (the `checkoutHint` method)
- Test: `app/tests/lib/game/one-twenty-one-play.data.test.ts` (extends the existing `describe("checkoutHint", ...)` block, around line 304)

**Interfaces:**
- Consumes: `CheckoutHintsStoreContext` (Task 2).
- Produces: unchanged signature `checkoutHint(this: OneTwentyOnePlayContext): string` — now additionally "" whenever `this.$store.checkoutHints?.enabled === false`. 121 has no `checkoutHintFor`/split-view hint today and this task does not add one (out of scope — see the design spec's "Out of scope" section).

- [ ] **Step 1: Write the failing test**

In `app/tests/lib/game/one-twenty-one-play.data.test.ts`, inside the existing `describe("checkoutHint", ...)` block, add:

```ts
    it("is empty when checkout hints are disabled, even with a valid route", () => {
      const play = createPlay({
        $store: { ...store, checkoutHints: { enabled: false } },
      });
      play.engine = oneTwentyOneEngineFactory.create(config) as any;

      expect(play.checkoutHint.call(play)).toBe("");
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts -t "checkout hints are disabled"`
Expected: FAIL — receives `"T20 T11 D14"` instead of `""`.

- [ ] **Step 3: Write minimal implementation**

In `app/src/lib/game/one-twenty-one-play.data.ts`, change:

```ts
    checkoutHint(this: OneTwentyOnePlayContext): string {
      const remaining = this.remainingInAttempt();
      const dartsLeft = dartsLeftInOpenVisit(this.$store.game.turns);
      return isCheckoutReachable(remaining, dartsLeft)
        ? checkoutPathFor(remaining)!.join(" ")
        : "";
    },
```

to:

```ts
    checkoutHint(this: OneTwentyOnePlayContext): string {
      if (this.$store.checkoutHints?.enabled === false) return "";
      const remaining = this.remainingInAttempt();
      const dartsLeft = dartsLeftInOpenVisit(this.$store.game.turns);
      return isCheckoutReachable(remaining, dartsLeft)
        ? checkoutPathFor(remaining)!.join(" ")
        : "";
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts`
Expected: PASS (all tests in the file, including the new one)

- [ ] **Step 5: Commit**

```bash
cd app && npm run format
git add app/src/lib/game/one-twenty-one-play.data.ts app/tests/lib/game/one-twenty-one-play.data.test.ts
git commit -m "Gate 121's checkout hint behind the checkoutHints toggle"
```

---

### Task 6: Add TUOD's checkout hint (net new) behind the toggle

**Files:**
- Modify: `app/src/lib/game/tuod-play.data.ts` (add `checkoutHintFor`/`checkoutHint`, right after `currentTargetLabel`)
- Test: `app/tests/lib/game/tuod-play.data.test.ts` (new `describe("checkoutHint", ...)` block)

**Interfaces:**
- Consumes: `CheckoutHintsStoreContext` (Task 2); `checkoutPathFor` from `@modules/game/checkout-path.module` (already imported in this file); `TuodState["seats"][number].currentTarget` (existing field, already read by `currentTargetLabelFor`).
- Produces: `checkoutHintFor(this: TuodPlayContext, seatRef: string): string`, `checkoutHint(this: TuodPlayContext): string` — same shape as 501's, gated the same way, keyed off `currentTarget` instead of `remainingScore`. Task 7's `TenUpOneDown.astro` wiring is the consumer.

- [ ] **Step 1: Write the failing tests**

In `app/tests/lib/game/tuod-play.data.test.ts`, add a new `describe` block (place it after the existing top-level `describe("tuodPlay", ...)` block closes, alongside the file's other top-level `describe`s):

```ts
describe("tuodPlay — checkoutHint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    segmentTimerInstances.length = 0;
    vi.mocked(fetchActiveSessions).mockResolvedValue([{ ...ACTIVE_SESSION }]);
  });

  it("shows the finish route for the current target", async () => {
    const store = gameStub({ configSnapshot: rounds(3) }); // startingTarget 41
    const component = {
      ...tuodPlay(),
      $store: { game: store, settings: settingsStub() },
    };
    await component.init.call(component);

    expect(component.checkoutHint.call(component)).toBe("9 D16");
    expect(component.checkoutHintFor.call(component, "participant-1")).toBe(
      "9 D16",
    );
  });

  it("is empty when checkout hints are disabled", async () => {
    const store = gameStub({ configSnapshot: rounds(3) });
    const component = {
      ...tuodPlay(),
      $store: {
        game: store,
        settings: settingsStub(),
        checkoutHints: { enabled: false },
      },
    };
    await component.init.call(component);

    expect(component.checkoutHint.call(component)).toBe("");
    expect(component.checkoutHintFor.call(component, "participant-1")).toBe(
      "",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts -t "checkoutHint"`
Expected: FAIL — `component.checkoutHint is not a function` (method does not exist yet).

- [ ] **Step 3: Write minimal implementation**

In `app/src/lib/game/tuod-play.data.ts`, change:

```ts
    currentTargetLabel(this: TuodPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    remainingLabel(this: TuodPlayContext): string {
```

to:

```ts
    currentTargetLabel(this: TuodPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.currentTargetLabelFor(state.activeParticipantRef);
    },

    checkoutHintFor(this: TuodPlayContext, seatRef: string): string {
      if (this.$store.checkoutHints?.enabled === false) return "";
      const seat = this.state()?.seats.find(
        (candidate) => candidate.participantRef === seatRef,
      );
      const path = seat ? checkoutPathFor(seat.currentTarget) : null;
      return path ? path.join(" ") : "";
    },

    checkoutHint(this: TuodPlayContext): string {
      const state = this.state();
      if (!state) return "";
      return this.checkoutHintFor(state.activeParticipantRef);
    },

    remainingLabel(this: TuodPlayContext): string {
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts`
Expected: PASS (all tests in the file, including the 2 new ones)

- [ ] **Step 5: Commit**

```bash
cd app && npm run format
git add app/src/lib/game/tuod-play.data.ts app/tests/lib/game/tuod-play.data.test.ts
git commit -m "Add TUOD checkout hint, gated by the checkoutHints toggle"
```

---

### Task 7: Wire the toggle into the three setup forms

**Files:**
- Modify: `app/src/components/layout/games/setup/FiveOhOneSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/OneTwentyOneSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/TuodSetupForm.astro`

**Interfaces:**
- Consumes: `Switch.astro` (Task 3); `Alpine.store("checkoutHints")` (Task 1), read/written via `x-model="$store.checkoutHints.enabled"`.
- Produces: nothing new for later tasks — this is a leaf UI wiring task.

No test: `.astro` markup has no test runner (D101). Verified via the dev server in Step 3.

- [ ] **Step 1: Add the Switch to `FiveOhOneSetupForm.astro`**

Add the import alongside the existing ones:

```astro
import Toggle from "./Toggle.astro";
import Switch from "@components/forms/Switch.astro";
```

(insert the `Switch` import line directly after the `Toggle` import line)

Then, inside `<SettingSectionShell>`, change the end of the block from:

```astro
    <p
      class="text-sm text-muted-foreground px-4 py-0"
      role="status"
      x-show="legsClampNotice"
      x-text="legsClampNotice"
      x-cloak
    >
    </p>
  </SettingSectionShell>
```

to:

```astro
    <p
      class="text-sm text-muted-foreground px-4 py-0"
      role="status"
      x-show="legsClampNotice"
      x-text="legsClampNotice"
      x-cloak
    >
    </p>
    <Switch
      label="Show checkout hints"
      x-model="$store.checkoutHints.enabled"
      class="mt-4"
    />
  </SettingSectionShell>
```

- [ ] **Step 2: Add the Switch to `OneTwentyOneSetupForm.astro`**

Add the import:

```astro
import Toggle from "./Toggle.astro";
import Switch from "@components/forms/Switch.astro";
```

Then, inside `<SettingSectionShell>`, change the end of the block from:

```astro
    <template x-if="guests.length > 0">
      <p class="text-sm text-muted-foreground px-4 py-0">
        Check out 170 to win — Rounds and Time modes are solo only.
      </p>
    </template>
  </SettingSectionShell>
```

to:

```astro
    <template x-if="guests.length > 0">
      <p class="text-sm text-muted-foreground px-4 py-0">
        Check out 170 to win — Rounds and Time modes are solo only.
      </p>
    </template>
    <Switch
      label="Show checkout hints"
      x-model="$store.checkoutHints.enabled"
      class="mt-4"
    />
  </SettingSectionShell>
```

- [ ] **Step 3: Add the Switch to `TuodSetupForm.astro`, then verify manually**

Add the import:

```astro
import Toggle from "./Toggle.astro";
import Switch from "@components/forms/Switch.astro";
```

Then, inside `<SettingSectionShell>`, change the end of the block from:

```astro
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
```

to:

```astro
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
    <Switch
      label="Show checkout hints"
      x-model="$store.checkoutHints.enabled"
      class="mt-4"
    />
  </SettingSectionShell>
```

Then verify manually:

Run: `cd app && astro dev --background`, then open `/games/501/setup`, `/games/121/setup`, and `/games/tuod/setup` in a browser.
Expected: each setup screen shows a "Show checkout hints" switch at the bottom of the Settings card, defaulting on; toggling it off on one game's setup screen and reloading any of the three shows it still off (shared, persisted preference).
Run `astro dev stop` when done.

- [ ] **Step 4: Commit**

```bash
cd app && npm run format
git add app/src/components/layout/games/setup/FiveOhOneSetupForm.astro app/src/components/layout/games/setup/OneTwentyOneSetupForm.astro app/src/components/layout/games/setup/TuodSetupForm.astro
git commit -m "Wire the checkout-hints Switch into the 501/121/TUOD setup screens"
```

---

### Task 8: Display TUOD's checkout hint in the play interface

**Files:**
- Modify: `app/src/components/layout/games/interfaces/TenUpOneDown.astro`

**Interfaces:**
- Consumes: `checkoutHint()`/`checkoutHintFor(seatRef)` (Task 6); `SplitScoreboardHalf`'s existing `checkoutExpr` prop (already supports this, used by `FiveOhOne.astro`).
- Produces: nothing new for later tasks — leaf UI wiring.

No test: `.astro` markup has no test runner (D101). Verified via the dev server in Step 2.

- [ ] **Step 1: Add the hint to the single-player and split-scoreboard views**

Change the single-player progress slot from:

```astro
      <div
        slot="progress"
        class="mt-2 flex w-full flex-col items-center gap-2 px-4"
      >
        <dl class="w-full space-y-1">
          <StatRow
            label="Attempts"
            value="$store.game.turns.length"
          />
```

to:

```astro
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
            label="Attempts"
            value="$store.game.turns.length"
          />
```

Change the `SplitScoreboard` seat props from:

```astro
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "currentTargetLabelFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "currentTargetLabelFor(state()?.seats[1]?.participantRef)",
      }}
      isTarget={true}
      class="h-2/5"
    >
```

to:

```astro
    <SplitScoreboard
      seatA={{
        nameExpr: "$store.game.seats[0]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[0]?.participantRef",
        scoreExpr: "currentTargetLabelFor(state()?.seats[0]?.participantRef)",
        checkoutExpr: "checkoutHintFor(state()?.seats[0]?.participantRef)",
      }}
      seatB={{
        nameExpr: "$store.game.seats[1]?.displayName",
        activeExpr:
          "state()?.activeParticipantRef === state()?.seats[1]?.participantRef",
        scoreExpr: "currentTargetLabelFor(state()?.seats[1]?.participantRef)",
        checkoutExpr: "checkoutHintFor(state()?.seats[1]?.participantRef)",
      }}
      isTarget={true}
      class="h-2/5"
    >
```

- [ ] **Step 2: Verify manually**

Run: `cd app && astro dev --background`, open `/games/tuod/setup`, start a solo session, and reach `/games/tuod/play`.
Expected: with the toggle on (default), a route (e.g. "9 D16" at target 41) shows above the stats; toggling it off on the setup screen (start a new session) hides it. Repeat with a guest added for the 1v1 split-scoreboard view, confirming both seats' chips show/hide together.
Run `astro dev stop` when done.

- [ ] **Step 3: Commit**

```bash
cd app && npm run format
git add app/src/components/layout/games/interfaces/TenUpOneDown.astro
git commit -m "Display TUOD's checkout hint in the play interface"
```

---

### Task 9: Component inventory + full validation

**Files:**
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — final documentation + gate task.

- [ ] **Step 1: Register `Switch.astro` in the component inventory**

In `docs/architecture/07-Frontend/08-Component-Inventory.md`, in the `## components/forms/` table, add a row (keep the table's alphabetical-by-component ordering — it belongs after `PlayerSettingsCard.astro` and before `SettingRow.astro`):

```markdown
| `Switch.astro` | Boolean switch (track + thumb), not a checkbox glyph | `label`, `hint`, rest props forward onto the native `<input type="checkbox">` |
```

Update the file's `updated:` front-matter date to today's date.

- [ ] **Step 2: Run the context-maintenance skill**

Invoke the `context-maintenance` skill and follow its steps (context-map registration check, decisions/** entry if this counts as a real architectural decision, gate scripts, branch/PR check, findings gate). The design spec already documents the storage-location decision; add a `decisions/**` entry only if the skill's own criteria call for one.

- [ ] **Step 3: Run the full validation suite**

Run: `cd app && npm run validate:app`
Expected: every step exits 0, `npx fallow` included, and the type-check step reports `0 errors, 0 warnings, 0 hints`.

Run: `bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh && bash scripts/check-findings-log.sh`
Expected: all pass. (`check-findings-log.sh` should pass with F46 present from the design phase.)

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/07-Frontend/08-Component-Inventory.md
git commit -m "Register Switch.astro in the component inventory"
```
