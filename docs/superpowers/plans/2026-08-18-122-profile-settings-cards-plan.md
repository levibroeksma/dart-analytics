# Profile/settings page card cleanup (issue #122) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five `/profile` polish issues: title-inside-card, label→value spacing, handedness button copy, app-mode card wrapper, and shortened app-mode description.

**Architecture:** Pure markup/copy edits across five existing `.astro` files — no new components, no store/API/engine change. `AppModeForm.astro` stops using the shared `InfoSection` (collapsible card) primitive in favor of an inline plain heading + description, so its whole content (heading, description, radiogroup) shares one outer card instead of nesting two card surfaces.

**Tech Stack:** Astro.js, Tailwind v4 (semantic tokens), `cn()` from `@client/cn`.

## Global Constraints

- Semantic tokens only — never raw palette utilities, never legacy `bg-bg*`/`text-fg*` (`07-Style-Guide.md`).
- Class composition via `cn()` only — never `class:list` (mechanically enforced by `scripts/check-astro-class-composition.sh`).
- Never `font-medium` — use `font-normal` / `font-semibold` / `font-bold` (`07-Style-Guide.md`).
- Every `x-show` element must also carry `x-cloak` (`10-Frontend-Agent-Guide.md`) — no `x-show` is added or removed here, only reparented; pairing must stay intact.
- Forward leftover attributes as `{...props}` — never `{...rest}` (`AppModeForm.astro` already does this correctly; do not regress it while editing).
- Frontmatter order: `interface Props` → `// Props` → imports (`// Layouts` · `// Components` · `// Icons` · `// Lib`) → `// Data` → `// Styles` (`05-Astro-Components.md`).
- Template comments `{/* ... */}` only — never `<!-- -->`.
- `.astro` markup/branching logic stays untested (D101) — no Astro-component test runner exists in this project.
- One surface level per visual block — do not nest two `bg-tab-card` cards inside each other (`07-Style-Guide.md` anti-pattern table).
- No engine/schema/API/store change — pure display layer.

---

### Task 1: Title inside `PlayerSettingsCard`, spacing widened

**Files:**
- Modify: `app/src/pages/profile/index.astro`
- Modify: `app/src/components/forms/PlayerSettingsCard.astro`
- Modify: `app/src/components/forms/SettingRow.astro`

**Interfaces:** none — no prop/type changes, pure markup edits within existing components.

- [ ] **Step 1: Move the "Player settings" heading into the card**

In `app/src/pages/profile/index.astro`, replace:

```astro
<AppLayout title="Profile">
  <div class="p-4 space-y-6">
    <h1 class="text-xl font-semibold text-foreground">Profile</h1>
    <div class="space-y-3">
      <h2 class="text-lg font-semibold text-foreground">Player settings</h2>
      <PlayerSettingsCard />
    </div>
    <AppModeForm />
  </div>
</AppLayout>
```

with:

```astro
<AppLayout title="Profile">
  <div class="p-4 space-y-6">
    <h1 class="text-xl font-semibold text-foreground">Profile</h1>
    <PlayerSettingsCard />
    <AppModeForm />
  </div>
</AppLayout>
```

In `app/src/components/forms/PlayerSettingsCard.astro`, add the heading as the first child inside the card `<div>`:

```astro
<div
  class={className}
  {...props}
>
  <h2 class="mb-3 text-lg font-semibold text-foreground">Player settings</h2>
  <div class="divide-tab-border divide-y">
    <SettingRow
```

(Everything from `<SettingRow id="displayName" ...>` down through the closing `</div>` of the card and the error `<p>` is unchanged.)

- [ ] **Step 2: Widen label→value/input spacing in `SettingRow.astro`**

Find:

```astro
    <div>
      <span
        x-show="!editing"
        x-cloak
        x-text={displayExpr}
        class="block truncate text-sm text-foreground"
      ></span>
```

Replace the wrapping `<div>` with:

```astro
    <div class="mt-1.5">
      <span
        x-show="!editing"
        x-cloak
        x-text={displayExpr}
        class="block truncate text-sm text-foreground"
      ></span>
```

- [ ] **Step 3: Widen label→toggle spacing on the Handed row**

In `PlayerSettingsCard.astro`, find:

```astro
      <HandednessForm class="mt-1" />
```

Replace with:

```astro
      <HandednessForm class="mt-1.5" />
```

- [ ] **Step 4: Format check**

Run: `cd app && npm run format:check`
Expected: clean. If it reports these files, run `npm run format` and re-check.

- [ ] **Step 5: Type-check**

Run: `cd app && npx astro check`
Expected: `0 errors`.

- [ ] **Step 6: Commit**

```bash
cd app && git add src/pages/profile/index.astro src/components/forms/PlayerSettingsCard.astro src/components/forms/SettingRow.astro
git commit -m "Move player-settings title into its card, widen label spacing"
```

---

### Task 2: Shorten handedness button copy

**Files:**
- Modify: `app/src/components/forms/HandednessForm.astro`

**Interfaces:** none — text-only change.

- [ ] **Step 1: Rename the button labels**

Find:

```astro
      <span class="block text-sm font-semibold text-foreground"
        >Right-handed</span
      >
```

Replace with:

```astro
      <span class="block text-sm font-semibold text-foreground">Right</span>
```

Find:

```astro
      <span class="block text-sm font-semibold text-foreground"
        >Left-handed</span
      >
```

Replace with:

```astro
      <span class="block text-sm font-semibold text-foreground">Left</span>
```

- [ ] **Step 2: Format check**

Run: `cd app && npm run format:check`
Expected: clean (Prettier's `singleAttributePerLine` may reformat the collapsed single-line span — if it reports this file, run `npm run format` and use its output as the final form).

- [ ] **Step 3: Type-check**

Run: `cd app && npx astro check`
Expected: `0 errors`.

- [ ] **Step 4: Commit**

```bash
cd app && git add src/components/forms/HandednessForm.astro
git commit -m "Shorten handedness button labels to Right/Left"
```

---

### Task 3: Wrap `AppModeForm` in a card, shorten its description

**Files:**
- Modify: `app/src/components/forms/AppModeForm.astro`

**Interfaces:**
- Consumes: none new. Stops consuming `components/ui/InfoSection.astro`.

- [ ] **Step 1: Drop the `InfoSection` import, add the card class, inline the heading+description**

Replace the full frontmatter block:

```astro
---
/**
 * App-mode picker. Reads and writes the `settings` Alpine store, which loads
 * itself in `init()`; each choice persists on click and the store keeps the
 * previous pair when a save fails. Roving-tabindex radiogroup: the selected
 * option is the group's only tab stop, arrow keys move + persist selection
 * and follow it with focus, and the checkmark supplements colour as the
 * selected-state cue. Quick score holds the tab stop whenever the stored mode
 * is neither of the two offered here — `PATCH` accepts pairs this form does
 * not show (RECREATIONAL + DETAILED_DARTS), and without the fallback both
 * options would be tabindex -1 and the group unreachable by keyboard.
 * @param {string} [class] Extra classes
 */
interface Props {
  class?: string;
  [key: string]: unknown;
}

// Props
const { class: classNameProp, ...props }: Props = Astro.props;

// Components
import InfoSection from "@components/ui/InfoSection.astro";

// Lib
import { cn } from "@client/cn";

// Icons
import CheckIcon from "@icons/check.svg";

// Styles
const className = cn("space-y-4", classNameProp);
const optionClass =
  "w-full rounded-lg border px-4 py-3 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40";
const checkClass =
  "size-5 shrink-0 text-accent transition-opacity duration-150";
---
```

with:

```astro
---
/**
 * App-mode picker. Reads and writes the `settings` Alpine store, which loads
 * itself in `init()`; each choice persists on click and the store keeps the
 * previous pair when a save fails. Roving-tabindex radiogroup: the selected
 * option is the group's only tab stop, arrow keys move + persist selection
 * and follow it with focus, and the checkmark supplements colour as the
 * selected-state cue. Quick score holds the tab stop whenever the stored mode
 * is neither of the two offered here — `PATCH` accepts pairs this form does
 * not show (RECREATIONAL + DETAILED_DARTS), and without the fallback both
 * options would be tabindex -1 and the group unreachable by keyboard.
 * @param {string} [class] Extra classes
 */
interface Props {
  class?: string;
  [key: string]: unknown;
}

// Props
const { class: classNameProp, ...props }: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Icons
import CheckIcon from "@icons/check.svg";

// Styles
const className = cn(
  "bg-tab-card border-tab-border rounded-3xl border p-3 space-y-4",
  classNameProp,
);
const optionClass =
  "w-full rounded-lg border px-4 py-3 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40";
const checkClass =
  "size-5 shrink-0 text-accent transition-opacity duration-150";
---
```

- [ ] **Step 2: Replace the `InfoSection` call with an inline heading + description**

Find:

```astro
<section
  class={className}
  aria-labelledby="app-mode-heading"
  {...props}
>
  <InfoSection
    id="app-mode-heading"
    title="App mode"
    description="Your preferred way to score. Only games that support the mode you pick are shown. Analytics captures each dart on a board, so you can see where your throws land; recreational records a visit total. The keypad stays available either way. Changing this affects new sessions — a game already in progress keeps the mode it started in."
  />

  <div
    x-show="!$store.settings.loading"
    x-cloak
  >
```

Replace with:

```astro
<section
  class={className}
  aria-labelledby="app-mode-heading"
  {...props}
>
  <div>
    <h2
      id="app-mode-heading"
      class="text-lg font-semibold text-foreground"
    >
      App mode
    </h2>
    <p class="mt-1.5 text-xs text-muted-foreground italic">
      Analytics tracks every dart for in-depth statistics and focused
      improvements to your game. Recreational just logs a visit total.
    </p>
  </div>

  <div
    x-show="!$store.settings.loading"
    x-cloak
  >
```

(Everything from the inner `role="radiogroup"` div down through the closing `</section>` — the two option buttons, the loading skeleton, and the error `<p>` — is unchanged.)

- [ ] **Step 3: Format check**

Run: `cd app && npm run format:check`
Expected: clean. If it reports this file, run `npm run format` and re-check.

- [ ] **Step 4: Astro conventions gate**

Run: `bash scripts/check-astro-conventions.sh` (from repo root)
Expected: passes — confirms `x-show`/`x-cloak` pairing survived the reparenting.

- [ ] **Step 5: Astro class composition gate**

Run: `bash scripts/check-astro-class-composition.sh` (from repo root)
Expected: passes.

- [ ] **Step 6: Type-check**

Run: `cd app && npx astro check`
Expected: `0 errors`. Confirms the dropped `InfoSection` import doesn't leave an unused-import warning and no other file still expects `AppModeForm` to render `InfoSection`.

- [ ] **Step 7: Manual browser verification**

Run: `cd app && astro dev --background`, then open `/profile`.

Confirm:
1. "Player settings" heading renders inside the bordered card, with visible gaps above each row's value/input and above the Handed toggle.
2. Handedness buttons read "Right"/"Left" on one line each, no wrapping.
3. "App mode" renders as one bordered card (heading, short static description, then the two options) — no separate collapsible panel, no nested double border.
4. Toggle app mode between Quick score and Analytics — selection, checkmark, and keyboard arrow navigation still work.
5. Loading skeleton (visible only during the store's `init()` fetch) and the error alert (trigger by temporarily forcing `$store.settings.error` in devtools, or skip if not easily reproducible) still render inside the same card.

Stop the dev server when done: `astro dev stop`.

- [ ] **Step 8: Commit**

```bash
cd app && git add src/components/forms/AppModeForm.astro
git commit -m "Wrap AppModeForm in a card, shorten its description"
```

---

### Task 4: Context maintenance

**Files:**
- Possibly modify: `docs/architecture/00-Context-Map.md` (File Inventory + version history entry), per root `CLAUDE.md`'s mandatory Context Maintenance protocol.

- [ ] **Step 1: Run the context-maintenance skill**

Invoke the `context-maintenance` skill. It determines whether this spec/plan need registering in `00-Context-Map.md`'s File Inventory and whether a version-history line is needed, and applies those edits itself.

- [ ] **Step 2: Run the full gate suite**

Invoke the `run-all-gates` skill (covers changed areas — here, `app/` frontend — dispatching the relevant `check-*.sh` scripts and `validate:app`).

- [ ] **Step 3: Commit any context-maintenance edits**

```bash
git add -A
git commit -m "Context maintenance for issue #122 profile settings cards"
```

(Skip this step if the context-maintenance skill made no file changes.)

---

## Notes for the implementer

- Five files touched total (`pages/profile/index.astro`, `PlayerSettingsCard.astro`, `SettingRow.astro`, `HandednessForm.astro`, `AppModeForm.astro`) plus whatever context-maintenance requires — no database, API, engine, or store work.
- No `decisions/**` entry expected: reuse of the already-decided `bg-tab-card` card treatment and existing store wiring, no new architectural pattern.
- `InfoSection.astro` itself is not modified — `SettingSectionShell.astro` and the game setup forms keep using it unchanged.
- Do not add a `.test.ts` for any of these files — `.astro` markup has no test runner in this project (D101).
