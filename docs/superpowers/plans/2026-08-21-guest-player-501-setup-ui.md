# Guest-Player 501 Setup UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an add-guest control to the 501 setup screen — a dashed circle button that opens a name-entry modal, turns into a removable guest avatar on submit, and composes into `POST /api/sessions`' `participants` array.

**Architecture:** Guest state (`guests`, `showAddGuestModal`, `newGuestName`) and two actions (`addGuest`/`removeGuest`) are added to the existing `fiveOhOneSetup()` Alpine data factory. Three new `.astro` components render the button, the name-entry modal, and the runtime guest list (`x-for`, since guests are only known client-side); `UserSection.astro` grows an `allowGuests` prop that is `false` (today's exact markup, unchanged) for every other setup screen and `true` only for `FiveOhOneSetupForm.astro`.

**Tech Stack:** Astro.js, TypeScript, Alpine.js v3, Vitest.

## Global Constraints

- 501 only. `services/session-seats.service.ts`'s `rejectSeatRequest` 400s more than one seat unless `rulesetVersionKey === "501_V1"` — do not touch the other 8 setup screens or their controllers.
- Guest count capped at 3 client-side (`AddGuestButton`'s `x-show="guests.length < 3"`) — 3 guests + 1 owner = server's `MAX_SEATS = 4`.
- `.astro` files get no unit test (D101) — there is no Astro-component test runner in this project. Their "test cycle" is `npm run check` (0 errors/warnings/hints) plus a manual dev-server check in the final task.
- Every `x-show` must be paired with `x-cloak` (`docs/architecture/07-Frontend/03-Alpine-Patterns.md`).
- **Reuse `components/forms/Button.astro` for every standalone clickable action** — never a raw `<button>` with hand-composed classes (`app/CLAUDE.md` style non-negotiables). Override its baked-in look with `class="...!"` (important-suffixed utilities), the same way `SetupShell.astro`'s submit button and `ContinueSessionModal.astro`'s footer buttons already do.
- Alpine directives written directly inside a `{}` Astro JS expression (a `.map()`/ternary callback body) must use `x-on:click` instead of `@click` — the repo's linter rejects bare `@` there (`07-Frontend/03-Alpine-Patterns.md`, "Astro exception"). Directives written in a component's own top-level markup (including inside a plain `<template x-for>`, which is not a JS expression) use the normal `@event`/`:attr` shorthand. This is why the guest list is its own component (`GuestSection.astro`) rather than inlined into a ternary inside `UserSection.astro`.
- No new `.ts` files, no new registry entries — this is additive markup + two edits to an existing `.data.ts`/`types.ts` pair. `scripts/check-game-wiring.sh` and `scripts/check-file-locations.sh` are unaffected.
- `scripts/check-test-coverage.sh` (D224) requires a covering test for the `five-oh-one-setup.data.ts` edit — `five-oh-one-setup.data.test.ts` must be touched in the same commit. `types.ts`'s edit is type-only (exempt).
- Run `cd app && npm run format` before the final commit; confirm `npm run format:check` is clean (`app/CLAUDE.md`).

---

### Task 1: Guest state, actions, and session-create composition

**Files:**
- Modify: `app/src/lib/game/five-oh-one-setup.data.ts`
- Modify: `app/src/lib/types.ts:347-381` (`FiveOhOneSetupContext`)
- Test: `app/tests/lib/game/five-oh-one-setup.data.test.ts`

**Interfaces:**
- Produces: `guests: {displayName: string}[]`, `showAddGuestModal: boolean`, `newGuestName: string`, `addGuest(this: FiveOhOneSetupContext): void`, `removeGuest(this: FiveOhOneSetupContext, index: number): void` — every later task's markup reads/writes these exact names on the Alpine scope.
- Consumes: `createSession` from `@client/api/sessions` (already imported), `CreateSessionRequestInput`'s `participants?: {participantTypeKey: "PLAYER"|"GUEST"; displayName?: string; sideKey: string}[]` (`app/src/pages/api/sessions/types.ts`).

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/lib/game/five-oh-one-setup.data.test.ts`, as a new `describe` block after the closing of the existing `describe("fiveOhOneSetup", ...)` — actually add it *inside* the existing `describe("fiveOhOneSetup", ...)` block, right after the `basePreset` tests (after the `it("falls back to the first preset when none declares legs_to_win = 1", ...)` block, before the `it("creates a session overriding legs_to_win and starting_score...")` block):

```ts
  it("addGuest trims the name, pushes the guest, clears the field, and closes the modal", () => {
    const setup = createSetup({
      showAddGuestModal: true,
      newGuestName: "  Alex  ",
    });

    setup.addGuest();

    expect(setup.guests).toEqual([{ displayName: "Alex" }]);
    expect(setup.newGuestName).toBe("");
    expect(setup.showAddGuestModal).toBe(false);
  });

  it("addGuest ignores blank or whitespace-only input", () => {
    const setup = createSetup({
      showAddGuestModal: true,
      newGuestName: "   ",
    });

    setup.addGuest();

    expect(setup.guests).toEqual([]);
    expect(setup.showAddGuestModal).toBe(true);
  });

  it("removeGuest splices the correct entry", () => {
    const setup = createSetup({
      guests: [
        { displayName: "Alex" },
        { displayName: "Sam" },
        { displayName: "Jo" },
      ],
    });

    setup.removeGuest(1);

    expect(setup.guests).toEqual([
      { displayName: "Alex" },
      { displayName: "Jo" },
    ]);
  });
```

Then extend the two existing `start()` tests' `createSession` assertions. Change the "creates a session overriding legs_to_win and starting_score with the chosen values and redirects" test's assertion from:

```ts
    expect(sessionsApi.createSession).toHaveBeenCalledWith({
      gameTypeKey: "501",
      rulesetVersionKey: "501_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
      config: {
        source: "template",
        templateRef: "tmpl-quick",
        overrides: { legs_to_win: 5, starting_score: 301 },
      },
    });
```

to:

```ts
    expect(sessionsApi.createSession).toHaveBeenCalledWith({
      gameTypeKey: "501",
      rulesetVersionKey: "501_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
      config: {
        source: "template",
        templateRef: "tmpl-quick",
        overrides: { legs_to_win: 5, starting_score: 301 },
      },
      participants: undefined,
    });
```

(this is the regression guard: the solo path must still send `participants: undefined` — Vitest's `toHaveBeenCalledWith` treats a present `undefined`-valued key the same as an absent one, so this only documents the shape, it does not change what passed before.)

Then add two new `it` blocks directly after that same test:

```ts
  it("sends the PLAYER seat plus every guest as participants, sides B/C/D in push order", async () => {
    const setup = createSetup({
      presets: [QUICK_PLAY_PRESET, BEST_OF_5_PRESET],
      legsToWin: 5,
      startingScoreOption: "301",
      guests: [{ displayName: "Alex" }, { displayName: "Sam" }],
    });
    vi.mocked(sessionsApi.createSession).mockResolvedValue({
      sessionId: "new-session-id",
      participants: [
        { ref: "p1", displayName: "Player", participantTypeKey: "PLAYER" },
        { ref: "p2", displayName: "Alex", participantTypeKey: "GUEST" },
        { ref: "p3", displayName: "Sam", participantTypeKey: "GUEST" },
      ],
    } as any);
    vi.stubGlobal("location", { href: "" });

    await setup.start();

    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: [
          { participantTypeKey: "PLAYER", sideKey: "A" },
          { participantTypeKey: "GUEST", displayName: "Alex", sideKey: "B" },
          { participantTypeKey: "GUEST", displayName: "Sam", sideKey: "C" },
        ],
      }),
    );
  });

  it("keeps guests across a rejected start() so the player does not retype them", async () => {
    const setup = createSetup({
      presets: [],
      legsToWin: 3,
      guests: [{ displayName: "Alex" }],
    });

    await setup.start();

    expect(setup.error).toBe("Could not find a preset for 501.");
    expect(setup.guests).toEqual([{ displayName: "Alex" }]);
  });
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-setup.data.test.ts`
Expected: FAIL — `setup.addGuest is not a function` / `setup.removeGuest is not a function` / the two `participants`-asserting tests fail because `createSession` is called without a `participants` key at all.

- [ ] **Step 3: Add the guest fields to `FiveOhOneSetupContext`**

In `app/src/lib/types.ts`, replace the `FiveOhOneSetupContext` type (lines 347-381):

```ts
export type FiveOhOneSetupContext = {
  presets: ConfigurationPresetData[];
  startingScoreOption: FiveOhOneStartingScoreOption;
  startingScoreValue: number | string | null;
  scoreClampNotice: string;
  legsToWin: number | string | null;
  legsClampNotice: string;
  guests: { displayName: string }[];
  showAddGuestModal: boolean;
  newGuestName: string;
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
    settings: {
      captureModeKey: string;
      inputModeKey: string;
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
  addGuest(this: FiveOhOneSetupContext): void;
  removeGuest(this: FiveOhOneSetupContext, index: number): void;
  start(this: FiveOhOneSetupContext): Promise<void>;
};
```

- [ ] **Step 4: Add guest state and actions to `fiveOhOneSetup()`**

In `app/src/lib/game/five-oh-one-setup.data.ts`, insert after `legsClampNotice: "",` (before `loading: false,`):

```ts
    guests: [] as { displayName: string }[],
    showAddGuestModal: false,
    newGuestName: "",
```

Then insert a new method after `basePreset(...) { ... },` (before `async reconcile(...)`):

```ts
    addGuest(this: FiveOhOneSetupContext) {
      const name = this.newGuestName.trim();
      if (!name) return;
      this.guests.push({ displayName: name });
      this.newGuestName = "";
      this.showAddGuestModal = false;
    },

    removeGuest(this: FiveOhOneSetupContext, index: number) {
      this.guests.splice(index, 1);
    },
```

- [ ] **Step 5: Compose `participants` into `start()`**

In the same file, inside `start()`, replace:

```ts
      this.loading = true;
      this.error = "";
      try {
        const wire = {
          ...(preset.configuration as Record<string, unknown>),
          legs_to_win: legsValue,
          starting_score: startingScore,
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
              legs_to_win: legsValue,
              starting_score: startingScore,
            },
          },
        });
```

with:

```ts
      this.loading = true;
      this.error = "";
      try {
        const wire = {
          ...(preset.configuration as Record<string, unknown>),
          legs_to_win: legsValue,
          starting_score: startingScore,
        };
        const configSnapshot = toSnapshot(RULESET_VERSION_KEY, wire);
        const modePair = resolveSessionModePair(
          RULESET_VERSION_KEY,
          this.$store.settings,
        );
        const participants = this.guests.length
          ? [
              { participantTypeKey: "PLAYER" as const, sideKey: "A" },
              ...this.guests.map((g, i) => ({
                participantTypeKey: "GUEST" as const,
                displayName: g.displayName,
                sideKey: String.fromCharCode(66 + i),
              })),
            ]
          : undefined;
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
            overrides: {
              legs_to_win: legsValue,
              starting_score: startingScore,
            },
          },
          participants,
        });
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-setup.data.test.ts`
Expected: PASS — all tests, including the 5 new/changed ones.

- [ ] **Step 7: Type-check and run the full unit suite**

Run: `cd app && npm run check && npm test`
Expected: `check` reports 0 errors/warnings/hints; `npm test` passes (this file's changes cannot affect other suites, but `validate:app`'s "full-suite-always-runs" policy applies).

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/game/five-oh-one-setup.data.ts app/src/lib/types.ts app/tests/lib/game/five-oh-one-setup.data.test.ts
git commit -m "feat(501): add guest state and participants composition to setup"
```

---

### Task 2: Plus icon and `AddGuestButton.astro`

**Files:**
- Create: `app/src/icons/plus.svg`
- Create: `app/src/components/layout/games/setup/AddGuestButton.astro`

**Interfaces:**
- Consumes: Alpine scope fields from Task 1 — `guests` (read, for `x-show`), `showAddGuestModal` (written on click).
- Produces: `<AddGuestButton />` — no props. Renders a `flex flex-col items-center` shell (top-aligned with `UserIconDisplay`'s own shell) around a dashed circle button; hidden once 3 guests exist.

- [ ] **Step 1: Create the icon**

`app/src/icons/plus.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16">
	<path d="M0 0h16v16H0z" fill="none" />
	<path fill="currentColor" d="M7 1h2v6h6v2h-6v6h-2v-6h-6v-2h6z" />
</svg>
```

(2-unit-wide bars in the 16×16 grid — heavier than `cross.svg`'s ~1-unit diagonal stroke, matching the "thick plus" requirement.)

- [ ] **Step 2: Create `AddGuestButton.astro`**

`app/src/components/layout/games/setup/AddGuestButton.astro`:

```astro
---
// Components
import Button from "@components/forms/Button.astro";

// Icons
import PlusIcon from "@icons/plus.svg";
---

<div
  class="flex flex-col gap-1 items-center justify-center"
  x-show="guests.length < 3"
  x-cloak
>
  <Button
    type="button"
    variant="ghost"
    icon
    ariaLabel="Add guest"
    @click="showAddGuestModal = true"
    class="w-fit! p-3! rounded-full! border-2! border-dashed! border-tab-border!"
  >
    <PlusIcon
      class="size-8 text-muted-foreground"
      slot="iconBefore"
    />
  </Button>
  <span
    class="text-sm invisible"
    aria-hidden="true"
  >
    &nbsp;
  </span>
</div>
```

(The `Button` primitive is reused per `app/CLAUDE.md`'s style rule rather than a raw `<button>`; its baked-in `rounded-md`/`p-2.5`/`border-transparent` are overridden with `!`-suffixed utilities the same way `SetupShell.astro`'s submit button overrides `Button`'s primary look. The invisible `&nbsp;` span mirrors `UserIconDisplay`'s name label so the button's circle top-aligns with the row instead of sitting lower once a labelled icon is beside it.)

- [ ] **Step 3: Type-check**

Run: `cd app && npm run check`
Expected: 0 errors, 0 warnings, 0 hints. (No unit test — `.astro` markup is exempt per D101; this component has no branching logic to extract and test.)

- [ ] **Step 4: Commit**

```bash
git add app/src/icons/plus.svg app/src/components/layout/games/setup/AddGuestButton.astro
git commit -m "feat(501): add plus icon and AddGuestButton"
```

---

### Task 3: `GuestNameModal.astro`

**Files:**
- Create: `app/src/components/layout/games/setup/GuestNameModal.astro`

**Interfaces:**
- Consumes: `newGuestName` (`x-model`), `showAddGuestModal` (cleared on cancel/dismiss), `addGuest()` (Task 1).
- Produces: `<GuestNameModal />` — no props. Caller wraps it in `<template x-if="showAddGuestModal">` (Task 4) — this component does not own its own visibility.

- [ ] **Step 1: Create the file**

`app/src/components/layout/games/setup/GuestNameModal.astro`:

```astro
---
/**
 * Presentational — parent (`GuestSection.astro`) owns `showAddGuestModal`
 * (`x-if`), mirroring `ContinueSessionModal.astro`'s ownership split.
 */

// Components
import Modal from "@components/ui/Modal.astro";
import Input from "@components/forms/Input.astro";
import Button from "@components/forms/Button.astro";
---

<Modal
  titleId="guest-name-title"
  onDismiss="showAddGuestModal = false; newGuestName = ''"
>
  <h2
    id="guest-name-title"
    class="text-lg font-semibold text-foreground"
  >
    Add Guest
  </h2>
  <Input
    id="guestName"
    name="guestName"
    type="text"
    placeholder="Guest name"
    x-model="newGuestName"
    maxlength="24"
    class="mt-4"
  />

  <div
    slot="footer"
    class="mt-6 flex gap-3"
  >
    <Button
      type="button"
      variant="secondary"
      class="flex-1"
      title="Cancel"
      @click="showAddGuestModal = false; newGuestName = ''"
    />
    <Button
      type="button"
      class="flex-1"
      title="Add"
      @click="addGuest()"
      :disabled="!newGuestName.trim()"
    />
  </div>
</Modal>
```

- [ ] **Step 2: Type-check**

Run: `cd app && npm run check`
Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/setup/GuestNameModal.astro
git commit -m "feat(501): add GuestNameModal"
```

---

### Task 4: `GuestSection.astro` — the runtime guest list

**Files:**
- Create: `app/src/components/layout/games/setup/GuestSection.astro`

**Interfaces:**
- Consumes: `guests` (`x-for`), `removeGuest(i)` (Task 1), `showAddGuestModal` (`x-if`), `<AddGuestButton />` (Task 2), `<GuestNameModal />` (Task 3).
- Produces: `<GuestSection />` — no props. Renders zero or more guest avatars (each with a remove badge), the add-guest button, and the name modal, as siblings — meant to sit beside the owner's `UserIconDisplay` inside a flex row (Task 5).

This is a separate component (not markup inlined into `UserSection.astro`'s conditional) specifically so its `x-for`/`@click`/`:aria-label` directives are ordinary top-level markup rather than content generated inside a `{}` Astro JS expression — see Global Constraints.

- [ ] **Step 1: Create the file**

`app/src/components/layout/games/setup/GuestSection.astro`:

```astro
---
// Components
import AddGuestButton from "./AddGuestButton.astro";
import GuestNameModal from "./GuestNameModal.astro";
import Button from "@components/forms/Button.astro";

// Icons
import UserIcon from "@icons/user.svg";
import CrossIcon from "@icons/cross.svg";
---

<template
  x-for="(g, i) in guests"
  :key="i"
>
  <div class="relative">
    <div class="flex flex-col gap-1 items-center justify-center">
      <div class="p-3 border-x border-t w-fit border-sky-500/70 rounded-full bg-tab-active">
        <UserIcon class="size-8 drop-shadow-lg drop-shadow-sky-700/40 text-sky-500" />
      </div>
      <span
        class="text-sm text-accent font-semibold"
        x-text="g.displayName"
      ></span>
    </div>
    <Button
      type="button"
      variant="ghost"
      icon
      :aria-label="`Remove ${g.displayName}`"
      @click="removeGuest(i)"
      class="absolute -top-1 -right-1 size-4! p-0! rounded-full! bg-tab-card! text-accent!"
    >
      <CrossIcon
        class="size-2.5"
        slot="iconBefore"
      />
    </Button>
  </div>
</template>

<AddGuestButton />

<template x-if="showAddGuestModal">
  <GuestNameModal />
</template>
```

(The avatar markup is inlined from `UserIconDisplay.astro` rather than invoking that Astro component per iteration: `UserIconDisplay` renders once at build/SSR time, but `guests` only exists at Alpine runtime — `<template x-for>` clones plain DOM per entry, the same way `VisitPreview.astro` inlines its per-dart markup instead of invoking a subcomponent inside its own `x-for`. The `:aria-label`/`@click` bindings pass through `Button`'s `{...props}` catch-all exactly the way `ContinueSessionModal.astro`'s footer buttons pass `:disabled="loading"` through the same mechanism.)

- [ ] **Step 2: Type-check**

Run: `cd app && npm run check`
Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/setup/GuestSection.astro
git commit -m "feat(501): add GuestSection guest list"
```

---

### Task 5: Wire `UserSection` and `FiveOhOneSetupForm`, verify end to end

**Files:**
- Modify: `app/src/components/layout/games/setup/UserSection.astro`
- Modify: `app/src/components/layout/games/setup/FiveOhOneSetupForm.astro`

**Interfaces:**
- Consumes: `<GuestSection />` (Task 4).
- Produces: `UserSection`'s new `allowGuests?: boolean = false` prop — every other setup form (`Bobs27SetupForm.astro`, `ShanghaiSetupForm.astro`, etc.) calls `<UserSection />` with no prop and gets exactly today's markup back, unchanged.

- [ ] **Step 1: Add the `allowGuests` prop to `UserSection.astro`**

Replace the full contents of `app/src/components/layout/games/setup/UserSection.astro`:

```astro
---
/**
 * @param {boolean} [allowGuests=false] 501 only — renders `GuestSection`
 * (add-guest button, guest avatars, name modal) beside the owner icon.
 * Every other setup screen's ruleset 400s a second seat
 * (`services/session-seats.service.ts`'s `rejectSeatRequest`), so this
 * defaults to false and those callers are unchanged.
 */
interface Props {
  allowGuests?: boolean;
}

// Props
const { allowGuests = false }: Props = Astro.props;

// Components
import UserIconDisplay from "./UserIconDisplay.astro";
import GuestSection from "./GuestSection.astro";
---

<div
  class="bg-tab-card border-tab-border rounded-3xl p-4 border flex flex-col items-start justify-start gap-4"
>
  <h2 class="text-base text-center w-full">Players</h2>
  {
    allowGuests ? (
      <div class="flex flex-row items-start gap-4">
        <UserIconDisplay
          name="User"
          nameExpr="$store.profile.displayName || 'User'"
        />
        <GuestSection />
      </div>
    ) : (
      <UserIconDisplay
        name="User"
        nameExpr="$store.profile.displayName || 'User'"
      />
    )
  }
</div>
```

- [ ] **Step 2: Pass `allowGuests` from `FiveOhOneSetupForm.astro`**

In `app/src/components/layout/games/setup/FiveOhOneSetupForm.astro`, change:

```astro
<SetupShell title="501">
  <UserSection />
```

to:

```astro
<SetupShell title="501">
  <UserSection allowGuests />
```

- [ ] **Step 3: Type-check and run the full validation chain**

Run: `cd app && npm run check && npm test`
Expected: 0 errors/warnings/hints; full suite passes (Task 1's tests plus everything else, unaffected).

- [ ] **Step 4: Manual verification in the dev server**

Run: `cd app && astro dev --background`, then:
1. Open `/games/501/setup`. Confirm the dashed circle button renders beside the owner icon, top-aligned, no label.
2. Click it — the `GuestNameModal` opens; "Add" is disabled until text is entered; type a name and submit.
3. Confirm the button is replaced inline by a guest avatar (same sky-ring style as the owner) with the guest's name below it, and a small remove badge (cross icon, card-background circle, accent-colored icon) in its top-right corner.
4. Add guests until 3 are present — confirm the add button disappears (`x-show="guests.length < 3"`).
5. Click a remove badge — confirm that guest disappears and the add button reappears.
6. Open another setup screen (e.g. `/games/121/setup`) — confirm it renders exactly as before (no add-guest button, no layout change).
7. Stop the server: `cd app && astro dev stop`.

- [ ] **Step 5: Format**

Run: `cd app && npm run format && npm run format:check`
Expected: `format:check` clean (no diff from `format`).

- [ ] **Step 6: Commit**

```bash
git add app/src/components/layout/games/setup/UserSection.astro app/src/components/layout/games/setup/FiveOhOneSetupForm.astro
git commit -m "feat(501): wire guest section into UserSection and 501 setup form"
```

- [ ] **Step 7: Context maintenance**

Run the `context-maintenance` skill (root `CLAUDE.md` mandates this before any task is claimed done) and the `run-all-gates` skill (touches `app/`) before reporting completion.
