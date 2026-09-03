# DartBot Level Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player choose DartBot's level (1–15) when adding it as an opponent, instead of every DartBot seat being fixed at `DEFAULT_BOT_LEVEL` (8).

**Architecture:** The skill model (`SkillProfile`, `LEVEL_SKILL_TABLE`, the wire contract, Play Again's round-trip) already threads `level` end to end. Only the client never offered a way to set it. `OpponentChooserModal.astro` gains a second body/footer state: choosing "DartBot" reveals a 1–15 range slider (default 8) instead of seating the bot immediately; a new "Add DartBot" button reads the chosen value and seats it. `addBotOpponent()` (`app/src/lib/game/guest-list.ts`) reads that value instead of the hardcoded constant.

**Tech Stack:** Astro components, Alpine.js (`x-model`, `x-show`, `x-text`), TypeScript, Vitest.

## Global Constraints

- Plain 1–15 integer, no tier names, no stated average (D-D, closed decision in `08-DartBot.md`).
- No post-seat editing: changing the level means removing the bot and re-adding it (matches the existing guest pattern).
- Semantic tokens only (`accent-*`, `text-foreground`, `text-muted-foreground`, `glass`) — never raw palette utilities (`app/CLAUDE.md`).
- Every touched runtime `.ts` file needs a covering test (D224) — `.astro` markup is exempt, no component test runner exists (D101).
- Never `//` or `/* */` comments inside a `.ts` function/method body; put necessary detail in a JSDoc block above the declaration (`app/CLAUDE.md`).
- Alpine v3 shorthand only (`:attr`, `@event`), no `x-init`, `x-data="factory()"` at the root only — this plan adds no new `x-data` root, it extends the existing one four setup screens already share.
- Out of scope: D-K (auto level), any change to `RULESET_DARTBOT`/`SEAT_CAPS`, engine gameplay rules, or the play-loop/ghost-mode wiring for Around the Clock and Doubles Training.

Spec: `docs/superpowers/specs/2026-09-03-dartbot-level-picker-design.md`

---

### Task 1: `addBotOpponent` reads a chosen level

**Files:**
- Modify: `app/src/lib/game/types.ts` (`GuestListContext`, ~line 1300–1316)
- Modify: `app/src/lib/game/guest-list.ts` (`addBotOpponent`, ~line 29–43)
- Modify: `app/src/lib/game/rulesets/capabilities.ts` (`DEFAULT_BOT_LEVEL`'s doc comment, ~line 126–133)
- Test: `app/tests/lib/game/guest-list.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_BOT_LEVEL` (`@lib/game/rulesets/capabilities`, already imported in `guest-list.ts`) — unchanged, still `8`.
- Produces: `GuestListContext` gains two new optional fields — `pendingBotLevel?: number` and `showBotLevelPicker?: boolean` — that Task 2 (the two setup contexts) and Task 3 (the modal markup) both read/write by these exact names.

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/lib/game/guest-list.test.ts`, inside the existing `describe("addBotOpponent", ...)` block (after the existing three `it` cases, before the closing `});`):

```ts
  it("seats the bot at the picker's chosen level", () => {
    const state = context({ pendingBotLevel: 12 });

    expect(addBotOpponent(state)).toBe(true);
    expect(state.bot).toEqual({ level: 12 });
  });

  it("falls back to DEFAULT_BOT_LEVEL when no level was picked", () => {
    const state = context({ pendingBotLevel: undefined });

    expect(addBotOpponent(state)).toBe(true);
    expect(state.bot).toEqual({ level: 8 });
  });

  it("resets the picker state on success", () => {
    const state = context({ pendingBotLevel: 12, showBotLevelPicker: true });

    addBotOpponent(state);

    expect(state.showBotLevelPicker).toBe(false);
    expect(state.pendingBotLevel).toBe(8);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/guest-list.test.ts`
Expected: FAIL — `state.bot` is `{ level: 8 }` for the first new test (chosen level ignored), and `state.showBotLevelPicker`/`state.pendingBotLevel` are `undefined` for the third (properties don't exist on `GuestListContext` yet — this is also a TypeScript compile error at this point, which vitest will surface as a failure).

- [ ] **Step 3: Widen `GuestListContext`**

In `app/src/lib/game/types.ts`, replace the `GuestListContext` type (~line 1300–1316):

```ts
/**
 * The opponent-slot state a setup screen's guest/DartBot modal drives.
 * `bot` and a guest are mutually exclusive. `pendingBotLevel` is the
 * chooser's slider value; `showBotLevelPicker` selects which step of the
 * chooser is shown. All four fields are optional — only DartBot-enabled
 * screens set them.
 */
export type GuestListContext = {
  guests: { displayName: string }[];
  newGuestName: string;
  showAddGuestModal: boolean;
  bot?: { level: number } | null;
  showOpponentChooser?: boolean;
  pendingBotLevel?: number;
  showBotLevelPicker?: boolean;
};
```

- [ ] **Step 4: Update `addBotOpponent`**

In `app/src/lib/game/guest-list.ts`, replace the whole file's DartBot-seating function and its doc comment (~line 29–43):

```ts
/**
 * Seats a DartBot at `context.pendingBotLevel`, falling back to
 * `DEFAULT_BOT_LEVEL` when unset. Refuses when a guest or another bot
 * already occupies the opponent slot.
 * @returns whether a bot was actually seated.
 */
export function addBotOpponent(context: GuestListContext): boolean {
  if (context.guests.length >= 1 || context.bot) return false;
  context.bot = { level: context.pendingBotLevel ?? DEFAULT_BOT_LEVEL };
  context.showOpponentChooser = false;
  context.showBotLevelPicker = false;
  context.pendingBotLevel = DEFAULT_BOT_LEVEL;
  return true;
}
```

- [ ] **Step 5: Update `DEFAULT_BOT_LEVEL`'s doc comment**

In `app/src/lib/game/rulesets/capabilities.ts`, replace the comment above `DEFAULT_BOT_LEVEL` (~line 126–133) — the constant itself (`export const DEFAULT_BOT_LEVEL = 8;`) is unchanged:

```ts
/** Default DartBot level (1–15) used when no level was picked. */
export const DEFAULT_BOT_LEVEL = 8;
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/guest-list.test.ts`
Expected: PASS — all tests in the file, including the three new ones and the pre-existing `"seats a level-8 DartBot and closes the chooser"` case (still passes: its `context()` helper never sets `pendingBotLevel`, so the `?? DEFAULT_BOT_LEVEL` fallback still yields `8`).

- [ ] **Step 7: Type-check and commit**

Run: `cd app && npx astro check`
Expected: 0 errors, 0 warnings, 0 hints.

```bash
git add app/src/lib/game/types.ts app/src/lib/game/guest-list.ts app/src/lib/game/rulesets/capabilities.ts app/tests/lib/game/guest-list.test.ts
git commit -m "feat: addBotOpponent reads the chooser's picked level"
```

---

### Task 2: Wire `pendingBotLevel`/`showBotLevelPicker` into both setup contexts

**Files:**
- Modify: `app/src/lib/game/types.ts` (`PresetSetupContext`, ~line 566–603; `FiveOhOneSetupContext`, ~line 502–545)
- Modify: `app/src/lib/game/setup-controller.ts` (initial state, ~line 42–55)
- Modify: `app/src/lib/game/five-oh-one-setup.data.ts` (initial state, ~line 48–67)
- Test: `app/tests/lib/game/setup-controller.test.ts`
- Test: `app/tests/lib/game/five-oh-one-setup.data.test.ts`

**Interfaces:**
- Consumes: `GuestListContext`'s `pendingBotLevel?: number` / `showBotLevelPicker?: boolean` (Task 1) and `DEFAULT_BOT_LEVEL` (`@lib/game/rulesets/capabilities`).
- Produces: `PresetSetupContext.pendingBotLevel: number`, `PresetSetupContext.showBotLevelPicker: boolean`, and the same two fields (non-optional) on `FiveOhOneSetupContext` — both always initialized to `DEFAULT_BOT_LEVEL`/`false`. Task 3's modal markup binds directly to these on whichever setup screen is mounted.

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/lib/game/setup-controller.test.ts`, inside the existing `describe("bot wiring", ...)` block (after the last `it`, before the closing `});`):

```ts
    it("initializes the level picker to DEFAULT_BOT_LEVEL and no picker shown", () => {
      const setup = bobs27();

      expect(setup.pendingBotLevel).toBe(8);
      expect(setup.showBotLevelPicker).toBe(false);
    });
```

Add to `app/tests/lib/game/five-oh-one-setup.data.test.ts`, as a new top-level `it` inside `describe("fiveOhOneSetup", ...)` (any position — matching the file's existing flat structure, no nested `describe` blocks for bot state):

```ts
  it("initializes the level picker to DEFAULT_BOT_LEVEL and no picker shown", () => {
    const setup = createSetup();

    expect(setup.pendingBotLevel).toBe(8);
    expect(setup.showBotLevelPicker).toBe(false);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/setup-controller.test.ts tests/lib/game/five-oh-one-setup.data.test.ts`
Expected: FAIL — both new assertions read `undefined`, and TypeScript reports `pendingBotLevel`/`showBotLevelPicker` as not existing on `PresetSetupContext`/`FiveOhOneSetupContext`.

- [ ] **Step 3: Widen `PresetSetupContext`**

In `app/src/lib/game/types.ts`, in the `PresetSetupContext` type (~line 566–603), add two fields after `showOpponentChooser: boolean;`:

```ts
  bot: { level: number } | null;
  showOpponentChooser: boolean;
  pendingBotLevel: number;
  showBotLevelPicker: boolean;
```

- [ ] **Step 4: Widen `FiveOhOneSetupContext`**

In the same file, in the `FiveOhOneSetupContext` type (~line 502–545), make the identical addition after its own `showOpponentChooser: boolean;`:

```ts
  bot: { level: number } | null;
  showOpponentChooser: boolean;
  pendingBotLevel: number;
  showBotLevelPicker: boolean;
```

- [ ] **Step 5: Initialize the fields in `setup-controller.ts`**

In `app/src/lib/game/setup-controller.ts`, `DEFAULT_BOT_LEVEL` is exported from `@lib/game/rulesets/capabilities` — add it as a new import alongside the existing `guest-list` one:

```ts
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
import { DEFAULT_BOT_LEVEL } from "@lib/game/rulesets/capabilities";
```

Then, in the returned object's initial state (~line 42–55), add the two fields right after `showOpponentChooser: false,`:

```ts
    bot: null as { level: number } | null,
    showOpponentChooser: false,
    pendingBotLevel: DEFAULT_BOT_LEVEL as number,
    showBotLevelPicker: false,
```

- [ ] **Step 6: Initialize the fields in `five-oh-one-setup.data.ts`**

In `app/src/lib/game/five-oh-one-setup.data.ts`, add the import:

```ts
import { DEFAULT_BOT_LEVEL } from "@lib/game/rulesets/capabilities";
```

Then, in `fiveOhOneSetup()`'s returned object (~line 48–67), add the two fields right after `showOpponentChooser: false,`:

```ts
    bot: null as { level: number } | null,
    showOpponentChooser: false,
    pendingBotLevel: DEFAULT_BOT_LEVEL as number,
    showBotLevelPicker: false,
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/setup-controller.test.ts tests/lib/game/five-oh-one-setup.data.test.ts`
Expected: PASS — both new tests, and every pre-existing test in both files (the two new fields don't change any existing behavior).

- [ ] **Step 8: Run the full test suite and type-check**

Run: `cd app && npx vitest run && npx astro check`
Expected: full suite PASS; `astro check` reports 0 errors, 0 warnings, 0 hints. (Confirms no other file destructures `PresetSetupContext`/`FiveOhOneSetupContext` in a way the two new required fields would break — e.g. a test building either context by hand without spreading the factory's return value.)

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/setup-controller.ts app/src/lib/game/five-oh-one-setup.data.ts app/tests/lib/game/setup-controller.test.ts app/tests/lib/game/five-oh-one-setup.data.test.ts
git commit -m "feat: initialize the DartBot level-picker state on both setup contexts"
```

---

### Task 3: The level slider in `OpponentChooserModal`

**Files:**
- Modify: `app/src/components/layout/games/setup/OpponentChooserModal.astro`

**Interfaces:**
- Consumes: `showOpponentChooser`, `showBotLevelPicker`, `pendingBotLevel`, `showAddGuestModal`, `addBot()` — all already present on whichever setup context (`PresetSetupContext`/`FiveOhOneSetupContext`) is mounted as the page's Alpine root, after Tasks 1–2.
- Produces: nothing new for other files — this is the leaf UI consumer.

No test file: `.astro` markup carries its variant/branching logic inline and is not unit-tested in this project (D101, `app/CLAUDE.md`). Verified by running the app (Step 3 below).

- [ ] **Step 1: Replace the whole file**

Replace `app/src/components/layout/games/setup/OpponentChooserModal.astro` in full:

```astro
---
/**
 * Guest/DartBot opponent chooser. Choosing DartBot swaps the body to a
 * level step (1–15 slider bound to `pendingBotLevel`) instead of seating
 * immediately; `addBot()` seats at the chosen level. One `x-text`-bound
 * `<h2>` covers both steps to avoid a duplicate `titleId`.
 */

// Components
import Modal from "@components/ui/Modal.astro";
import Button from "@components/forms/Button.astro";
---

<Modal
  titleId="opponent-chooser-title"
  onDismiss="showOpponentChooser = false; showBotLevelPicker = false; pendingBotLevel = 8"
>
  <h2
    id="opponent-chooser-title"
    class="text-lg font-semibold text-foreground"
    x-text="showBotLevelPicker ? 'DartBot level' : 'Add Opponent'"
  ></h2>

  <div
    class="relative mt-6"
    x-show="showBotLevelPicker"
    x-cloak
  >
    <input
      type="range"
      id="botLevel"
      name="botLevel"
      min="1"
      max="15"
      step="1"
      value="8"
      list="botLevelTicks"
      aria-label="DartBot level, 1 to 15"
      x-model.number="pendingBotLevel"
      class="peer w-full accent-accent"
    />
    <datalist id="botLevelTicks">
      <option value="1"></option>
      <option value="5"></option>
      <option value="10"></option>
      <option value="15"></option>
    </datalist>
    <div class="relative mt-1 h-4 text-xs text-muted-foreground">
      <span class="absolute left-0">1</span>
      <span class="absolute left-[28.5714%] -translate-x-1/2">5</span>
      <span class="absolute left-[64.2857%] -translate-x-1/2">10</span>
      <span class="absolute right-0">15</span>
    </div>
    <p
      class="glass pointer-events-none absolute -top-9 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1 text-center text-xs font-semibold text-foreground opacity-0 transition-opacity peer-active:opacity-100"
      :style="`left: ${(pendingBotLevel - 1) / 14 * 100}%`"
      x-text="`Level ${pendingBotLevel}`"
    ></p>
  </div>

  <div
    slot="footer"
    class="mt-6 flex gap-3"
    x-show="!showBotLevelPicker"
  >
    <Button
      type="button"
      variant="secondary"
      class="flex-1"
      title="Guest"
      @click="showOpponentChooser = false; showAddGuestModal = true"
    />
    <Button
      type="button"
      class="flex-1"
      title="DartBot"
      @click="showBotLevelPicker = true"
    />
  </div>

  <div
    slot="footer"
    class="mt-6 flex gap-3"
    x-show="showBotLevelPicker"
    x-cloak
  >
    <Button
      type="button"
      variant="secondary"
      class="flex-1"
      title="Cancel"
      @click="showOpponentChooser = false; showBotLevelPicker = false; pendingBotLevel = 8"
    />
    <Button
      type="button"
      class="flex-1"
      title="Add DartBot"
      @click="addBot()"
    />
  </div>
</Modal>
```

- [ ] **Step 2: Type-check**

Run: `cd app && npx astro check`
Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 3: Run the app and verify the picker on all four DartBot-enabled setup screens**

Run: `cd app && astro dev --background`

For each of `/games/around-the-clock/setup`, `/games/bobs-27/setup`, `/games/doubles-training/setup`, `/games/501/setup`:

1. Tap the add-opponent button → "Add Opponent" modal with Guest/DartBot buttons appears.
2. Tap "DartBot" → title changes to "DartBot level", a slider (default centered at 8) with tick labels 1/5/10/15 appears, footer becomes Cancel/Add DartBot.
3. Drag the slider → a "Level N" bubble tracks the thumb while dragging.
4. Tap "Cancel" → modal closes with no opponent seated; add-opponent button still shows.
5. Reopen, choose DartBot, drag to a different level (e.g. 3), tap "Add DartBot" → modal closes, a DartBot pill appears in the opponent slot.
6. Tap the pill's remove (X) → opponent slot empties; reopening the chooser and re-adding DartBot shows the slider reset to 8 (not the previously chosen 3).
7. Confirm "Guest" still opens the existing guest-name modal unchanged.

Stop the dev server: `astro dev stop`

- [ ] **Step 4: Format and commit**

```bash
cd app && npm run format
git add app/src/components/layout/games/setup/OpponentChooserModal.astro
git commit -m "feat: add a 1-15 level slider to the DartBot chooser"
```

---

### Task 4: Full validation

**Files:** none (verification only)

- [ ] **Step 1: Run the full validation chain**

Run: `npm run validate:app` (from `app/`, per `app/CLAUDE.md`'s Validation Standard Procedure)
Expected: every step exits zero; the type gate reports 0 errors, 0 warnings, 0 hints.

- [ ] **Step 2: Confirm formatting is clean**

Run: `cd app && npm run format:check`
Expected: clean — no diffs. (Required before any PR per `app/CLAUDE.md`.)

- [ ] **Step 3: Run context maintenance**

Follow the `context-maintenance` skill's procedure (CLAUDE.md sync, context-map registration if any new file needs one, findings gate, branch/PR check) before claiming the task done, per the root `CLAUDE.md`'s mandatory Context Maintenance section. This task adds no new files outside what's already tracked (no new doc, no new decision — the design was already speculative-not-decided in `08-DartBot.md`'s D-D and this plan doesn't reverse or add a decision), so this step is expected to be a clean pass with nothing further to register.
