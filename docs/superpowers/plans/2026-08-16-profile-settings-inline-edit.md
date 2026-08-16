# Profile Settings Inline-Edit Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regroup the profile page's display-name/darts/weight/handedness fields into one plain-heading "Player settings" card, with each value shown as text + pencil-edit button instead of an always-visible input.

**Architecture:** A new generic `SettingRow.astro` (label + text-or-input + pencil `Button`) replaces the three separate always-open forms. A new `PlayerSettingsCard.astro` composes three `SettingRow`s plus the (now un-wrapped) `HandednessForm` inside one bordered card, reusing `InfoSection`'s card CSS classes directly rather than the component. `profile/index.astro` drops its `h1`-only header for `h1` + plain `h2` "Player settings" + the new card, then the unchanged `AppModeForm`.

**Tech Stack:** Astro, Alpine.js v3, Tailwind v4. No store/API/service/DB changes — `profile.store.ts`'s existing `save()` (PATCHes `displayName`/`dartsDescription`/`dartsWeightGrams` together) is reused as-is.

## Global Constraints

- Semantic tokens only; reuse `cn()` for class composition; forward leftover props as `{...props}`; never `font-medium`; Tailwind v4 `utility!` important suffix (not `!utility`).
- Reuse `components/forms/Button.astro` for the pencil action — never a raw `<button>`.
- No `x-init` anywhere; local view-only toggle state uses component-level `x-data="{ editing: false }"` (not an Alpine store).
- `.astro` markup/branching logic is not unit-tested in this project (D101) — verification is `astro check`, `npm run format`, the existing full regression suite (no `.ts` logic changed, so this is a no-op check), and a manual dev-server smoke test.
- Every task: end with `cd /home/user/dart-analytics/app && npm run format` and commit.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `app/src/icons/pencil.svg` (new) | Pencil/edit stroke icon, matching existing icon set style |
| `app/src/components/forms/SettingRow.astro` (new) | Generic label + text-value/pencil-button/input row; owns its own `editing` toggle |
| `app/src/components/forms/PlayerSettingsCard.astro` (new) | Bordered card wrapping 3× `SettingRow` + handedness row + shared error banner |
| `app/src/components/forms/HandednessForm.astro` (modify) | Strip `InfoSection` + outer `<section>`; keep only the radiogroup `<div>` |
| `app/src/pages/profile/index.astro` (modify) | New heading structure + renders `PlayerSettingsCard` instead of the three old forms |
| `app/src/components/forms/DisplayNameForm.astro` (delete) | Superseded by `SettingRow` usage in `PlayerSettingsCard` |
| `app/src/components/forms/DartsConfigForm.astro` (delete) | Superseded by `SettingRow` usage in `PlayerSettingsCard` |

---

### Task 1: Pencil icon

**Files:**
- Create: `app/src/icons/pencil.svg`

**Interfaces:**
- Produces: `@icons/pencil.svg` — importable Astro/Vite SVG component, same shape as `@icons/delete.svg` (`viewBox="0 0 24 24"`, default `width`/`height` `1em`, `currentColor` stroke).

- [ ] **Step 1: Write the icon file**

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
	<path d="M0 0h24v24H0z" fill="none" />
	<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 20h4L18.5 9.5a2.121 2.121 0 0 0-3-3L5 17v3M13.5 6.5l4 4" />
</svg>
```

- [ ] **Step 2: Verify it matches the existing icon set's conventions**

Run: `cat /home/user/dart-analytics/app/src/icons/delete.svg /home/user/dart-analytics/app/src/icons/pencil.svg`
Expected: both files share the same root `<svg>` attributes (`xmlns`, `width="1em"`, `height="1em"`, `viewBox="0 0 24 24"`) and the same `stroke`/`stroke-width`/`stroke-linecap`/`stroke-linejoin`/`fill="none"` pattern on the visible path.

- [ ] **Step 3: Commit**

```bash
cd /home/user/dart-analytics && git add app/src/icons/pencil.svg
git commit -m "Add pencil icon for inline-edit rows"
```

---

### Task 2: `SettingRow.astro` component

**Files:**
- Create: `app/src/components/forms/SettingRow.astro`

**Interfaces:**
- Consumes: `Input` (`@components/forms/Input.astro`, props `id?`, `type?`, `placeholder?`, `required?`, arbitrary `[key: string]: unknown` forwarded via `{...props}` including Alpine `x-model`/`x-model.number`/`:disabled`/`@blur`/`@keydown.enter.prevent`); `Button` (`@components/forms/Button.astro`, props `icon`, `variant`, `ariaLabel`, arbitrary forwarded props including `x-show`/`x-cloak`/`@click`/`:disabled`); `cn` (`@client/cn`); `@icons/pencil.svg` (Task 1).
- Produces: `SettingRow.astro` accepting props `id: string`, `label: string`, `valueExpr: string`, `modelExpr: string`, `saveExpr: string`, `placeholder?: string`, `emptyText?: string`, `numeric?: boolean`, `inputmode?: "numeric"`, `required?: boolean`, `disabledExpr?: string` (default `"false"`), `class?: string`. Renders a label, a view-mode `<span x-text>` (or the input in edit mode), and a pencil `Button` that flips local `editing` state. Used by `PlayerSettingsCard.astro` (Task 4).

- [ ] **Step 1: Write the component**

```astro
---
/**
 * Label + text-or-input row with a pencil edit button. View mode shows
 * `valueExpr` as text (falling back to `emptyText` when empty); clicking the
 * pencil swaps to an input bound to `modelExpr`, which runs `saveExpr` and
 * flips back to view mode on blur or Enter.
 * @param {string} id
 * @param {string} label
 * @param {string} valueExpr Alpine expression for the displayed value
 * @param {string} modelExpr Alpine `x-model` target for the input
 * @param {string} saveExpr Alpine call fired on blur/Enter
 * @param {string} [placeholder]
 * @param {string} [emptyText] Shown in place of an empty `valueExpr`
 * @param {boolean} [numeric] Use `x-model.number` instead of `x-model`
 * @param {"numeric"} [inputmode] Passed through to the input
 * @param {boolean} [required]
 * @param {string} [disabledExpr] Alpine expression; defaults to `"false"`
 * @param {string} [class] Extra classes
 */
interface Props {
  id: string;
  label: string;
  valueExpr: string;
  modelExpr: string;
  saveExpr: string;
  placeholder?: string;
  emptyText?: string;
  numeric?: boolean;
  inputmode?: "numeric";
  required?: boolean;
  disabledExpr?: string;
  class?: string;
  [key: string]: unknown;
}

// Props
const {
  id,
  label,
  valueExpr,
  modelExpr,
  saveExpr,
  placeholder,
  emptyText,
  numeric = false,
  inputmode,
  required = false,
  disabledExpr = "false",
  class: classNameProp = "",
  ...props
}: Props = Astro.props;

// Components
import Input from "@components/forms/Input.astro";
import Button from "@components/forms/Button.astro";

// Lib
import { cn } from "@client/cn";

// Icons
import PencilIcon from "@icons/pencil.svg";

// Styles
const className = cn("flex items-center justify-between gap-3 py-2", classNameProp);
const labelClass = "text-xs text-muted-foreground italic";
const displayExpr = emptyText
  ? `(${valueExpr}) || ${JSON.stringify(emptyText)}`
  : valueExpr;
const commitExpr = `${saveExpr}; editing = false`;
const modelDirective = numeric
  ? { "x-model.number": modelExpr }
  : { "x-model": modelExpr };
---

<div
  x-data="{ editing: false }"
  class={className}
  {...props}
>
  <div class="min-w-0 flex-1">
    <label
      for={id}
      class={labelClass}
    >
      {label}
    </label>
    <div>
      <span
        x-show="!editing"
        x-cloak
        x-text={displayExpr}
        class="block truncate text-sm text-foreground"
      ></span>
      <Input
        id={id}
        name={id}
        type="text"
        inputmode={inputmode}
        placeholder={placeholder}
        required={required}
        x-show="editing"
        x-cloak
        x-ref="input"
        {...modelDirective}
        :disabled={disabledExpr}
        @blur={commitExpr}
        @keydown.enter.prevent={commitExpr}
      />
    </div>
  </div>
  <Button
    icon
    variant="ghost"
    ariaLabel={`Edit ${label}`}
    x-show="!editing"
    x-cloak
    :disabled={disabledExpr}
    @click="editing = true; $nextTick(() => $refs.input.focus())"
  >
    <PencilIcon
      slot="iconBefore"
      x-cloak
      class="size-4"
    />
  </Button>
</div>
```

- [ ] **Step 2: Type-check**

Run: `cd /home/user/dart-analytics/app && npx astro check`
Expected: 0 errors (existing warnings, if any, unrelated to this file).

- [ ] **Step 3: Format**

Run: `cd /home/user/dart-analytics/app && npm run format`
Expected: `SettingRow.astro` reformatted to the single-attribute-per-line style (or already compliant, no diff).

- [ ] **Step 4: Commit**

```bash
cd /home/user/dart-analytics && git add app/src/components/forms/SettingRow.astro
git commit -m "Add SettingRow inline-edit component"
```

---

### Task 3: Strip `HandednessForm.astro`'s `InfoSection` wrapper

**Files:**
- Modify: `app/src/components/forms/HandednessForm.astro` (full file)

**Interfaces:**
- Consumes: `cn` (`@client/cn`), `@icons/check.svg` — both already imported; drops the `InfoSection` import.
- Produces: `HandednessForm.astro` now renders only the `role="radiogroup"` `<div>` (no outer `<section>`, no heading). Accepts `class?: string` forwarded to that `<div>` via `cn()`. Labeled via `aria-label="Throwing hand"` directly (previously `aria-labelledby` pointing at the removed `InfoSection` heading's id) since nothing outside the component currently supplies a heading id — `PlayerSettingsCard.astro` (Task 4) does not pass one. Consumed by `PlayerSettingsCard.astro` (Task 4).

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `app/src/components/forms/HandednessForm.astro` with:

```astro
---
/**
 * Throwing-hand picker, read by `boardInputData()` (`board-input.data.ts`) to
 * keep the visual-board magnifier off the throwing hand's side. Writes
 * directly to the `boardInput` Alpine store — a local `$persist` preference,
 * never a `player_settings` round trip, since this is a per-device rendering
 * choice rather than gameplay data. Roving-tabindex radiogroup, mirroring
 * `AppModeForm`'s pattern.
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
const className = cn("flex gap-2", classNameProp);
const optionClass =
  "flex-1 rounded-lg border px-4 py-3 text-left transition-colors duration-150";
const checkClass =
  "size-5 shrink-0 text-accent transition-opacity duration-150";
---

<div
  class={className}
  role="radiogroup"
  aria-label="Throwing hand"
  x-data="{
    select(handedness, ref) {
      $store.boardInput.handedness = handedness;
      $nextTick(() => $refs[ref].focus());
    },
  }"
  {...props}
>
  <button
    type="button"
    role="radio"
    x-ref="rightOption"
    class={optionClass}
    :class="$store.boardInput.handedness === 'RIGHT' ? 'border-accent bg-accent-muted' : 'border-border'"
    :aria-checked="$store.boardInput.handedness === 'RIGHT'"
    :tabindex="$store.boardInput.handedness === 'LEFT' ? -1 : 0"
    @click="select('RIGHT', 'rightOption')"
    @keydown.arrow-left.prevent="select('LEFT', 'leftOption')"
    @keydown.arrow-up.prevent="select('LEFT', 'leftOption')"
    @keydown.arrow-right.prevent="select('LEFT', 'leftOption')"
    @keydown.arrow-down.prevent="select('LEFT', 'leftOption')"
  >
    <span class="flex items-center justify-between gap-3">
      <span class="block text-sm font-semibold text-foreground"
        >Right-handed</span
      >
      <CheckIcon
        class={checkClass}
        :class="$store.boardInput.handedness === 'RIGHT' ? 'opacity-100' : 'opacity-0'"
        aria-hidden="true"
      />
    </span>
  </button>

  <button
    type="button"
    role="radio"
    x-ref="leftOption"
    class={optionClass}
    :class="$store.boardInput.handedness === 'LEFT' ? 'border-accent bg-accent-muted' : 'border-border'"
    :aria-checked="$store.boardInput.handedness === 'LEFT'"
    :tabindex="$store.boardInput.handedness === 'LEFT' ? 0 : -1"
    @click="select('LEFT', 'leftOption')"
    @keydown.arrow-left.prevent="select('RIGHT', 'rightOption')"
    @keydown.arrow-up.prevent="select('RIGHT', 'rightOption')"
    @keydown.arrow-right.prevent="select('RIGHT', 'rightOption')"
    @keydown.arrow-down.prevent="select('RIGHT', 'rightOption')"
  >
    <span class="flex items-center justify-between gap-3">
      <span class="block text-sm font-semibold text-foreground"
        >Left-handed</span
      >
      <CheckIcon
        class={checkClass}
        :class="$store.boardInput.handedness === 'LEFT' ? 'opacity-100' : 'opacity-0'"
        aria-hidden="true"
      />
    </span>
  </button>
</div>
```

- [ ] **Step 2: Confirm no other file references the removed `InfoSection` usage or the old `aria-labelledby` id**

Run: `cd /home/user/dart-analytics && grep -rn "handedness-heading" app/src`
Expected: no matches.

- [ ] **Step 3: Type-check**

Run: `cd /home/user/dart-analytics/app && npx astro check`
Expected: 0 errors.

- [ ] **Step 4: Format**

Run: `cd /home/user/dart-analytics/app && npm run format`
Expected: no diff or auto-formatted cleanly.

- [ ] **Step 5: Commit**

```bash
cd /home/user/dart-analytics && git add app/src/components/forms/HandednessForm.astro
git commit -m "Strip InfoSection wrapper from HandednessForm"
```

---

### Task 4: `PlayerSettingsCard.astro`

**Files:**
- Create: `app/src/components/forms/PlayerSettingsCard.astro`

**Interfaces:**
- Consumes: `SettingRow` (Task 2, props as declared there); `HandednessForm` (Task 3, prop `class?: string`); `cn` (`@client/cn`); `$store.profile.{displayName,dartsDescription,dartsWeightGrams,loading,error,save()}` (`app/src/stores/profile.store.ts` — unchanged).
- Produces: `PlayerSettingsCard.astro` accepting `class?: string`, rendering the full settings list (display name, darts, weight, handedness, error banner) inside one bordered card. Consumed by `app/src/pages/profile/index.astro` (Task 5).

- [ ] **Step 1: Write the component**

```astro
---
/**
 * Player settings list: display name, darts, weight, and throwing hand in
 * one bordered card. Reuses `InfoSection`'s own card classes directly (not
 * the component) — this card has no collapsible heading of its own, only
 * rows.
 * @param {string} [class] Extra classes
 */
interface Props {
  class?: string;
  [key: string]: unknown;
}

// Props
const { class: classNameProp = "", ...props }: Props = Astro.props;

// Components
import SettingRow from "@components/forms/SettingRow.astro";
import HandednessForm from "@components/forms/HandednessForm.astro";

// Lib
import { cn } from "@client/cn";

// Styles
const className = cn(
  "bg-tab-card border-tab-border rounded-3xl border p-3",
  classNameProp,
);
const handedLabelClass = "text-xs text-muted-foreground italic";
---

<div
  class={className}
  {...props}
>
  <div class="divide-tab-border divide-y">
    <SettingRow
      id="displayName"
      label="Display name"
      valueExpr="$store.profile.displayName"
      modelExpr="$store.profile.displayName"
      saveExpr="$store.profile.save()"
      placeholder="Display name"
      required
      disabledExpr="$store.profile.loading"
    />
    <SettingRow
      id="dartsDescription"
      label="Darts"
      valueExpr="$store.profile.dartsDescription"
      modelExpr="$store.profile.dartsDescription"
      saveExpr="$store.profile.save()"
      placeholder="e.g. Winmau Pro-Series 23g"
      emptyText="Not set"
      disabledExpr="$store.profile.loading"
    />
    <SettingRow
      id="dartsWeightGrams"
      label="Weight (g)"
      valueExpr="$store.profile.dartsWeightGrams"
      modelExpr="$store.profile.dartsWeightGrams"
      saveExpr="$store.profile.save()"
      placeholder="Weight in grams"
      emptyText="Not set"
      numeric
      inputmode="numeric"
      disabledExpr="$store.profile.loading"
    />
    <div class="py-2">
      <span
        id="handedness-label"
        class={handedLabelClass}
      >
        Handed
      </span>
      <HandednessForm class="mt-1" />
    </div>
  </div>

  <p
    class="alert alert-error mt-3 rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
    role="alert"
    x-show="$store.profile.error"
    x-text="$store.profile.error"
    x-cloak
  >
  </p>
</div>
```

- [ ] **Step 2: Type-check**

Run: `cd /home/user/dart-analytics/app && npx astro check`
Expected: 0 errors.

- [ ] **Step 3: Format**

Run: `cd /home/user/dart-analytics/app && npm run format`
Expected: no diff or auto-formatted cleanly.

- [ ] **Step 4: Commit**

```bash
cd /home/user/dart-analytics && git add app/src/components/forms/PlayerSettingsCard.astro
git commit -m "Add PlayerSettingsCard grouping profile settings"
```

---

### Task 5: Restructure `profile/index.astro`; delete superseded forms

**Files:**
- Modify: `app/src/pages/profile/index.astro` (full file)
- Delete: `app/src/components/forms/DisplayNameForm.astro`
- Delete: `app/src/components/forms/DartsConfigForm.astro`

**Interfaces:**
- Consumes: `AppLayout` (`@layouts/AppLayout.astro`, unchanged), `AppModeForm` (`@components/forms/AppModeForm.astro`, unchanged), `PlayerSettingsCard` (Task 4).

- [ ] **Step 1: Rewrite the page**

Replace the full contents of `app/src/pages/profile/index.astro` with:

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import AppModeForm from "@components/forms/AppModeForm.astro";
import PlayerSettingsCard from "@components/forms/PlayerSettingsCard.astro";
---

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

- [ ] **Step 2: Delete the superseded forms**

```bash
cd /home/user/dart-analytics && git rm app/src/components/forms/DisplayNameForm.astro app/src/components/forms/DartsConfigForm.astro
```

- [ ] **Step 3: Confirm nothing else imports the deleted files**

Run: `cd /home/user/dart-analytics && grep -rn "DisplayNameForm\|DartsConfigForm" app/src`
Expected: no matches.

- [ ] **Step 4: Run full validation**

Run: `cd /home/user/dart-analytics/app && npm run validate:app`
Expected: all checks pass (format, `astro check`, existing Vitest suite — no `.ts` logic changed, so this is a pure regression check).

- [ ] **Step 5: Manual dev-server smoke test**

Run: `cd /home/user/dart-analytics/app && astro dev --background`, then load `/profile` in the browser.
Expected: "Profile" `h1`, then plain "Player settings" `h2` (no info/description panel), then the card with display name / darts / weight shown as text + pencil buttons, then the handedness picker (unchanged two-button control, no heading text of its own visible besides "Handed" label), then the unchanged "App mode" `InfoSection`. Clicking a pencil button turns that row into a focused input; blurring or pressing Enter saves it (network tab shows a `PATCH` to `/api/players/me/settings`) and reverts to text. An invalid save (e.g. clear the required display name and blur) shows the shared error banner below the handedness row.
Then: `cd /home/user/dart-analytics/app && astro dev stop`

- [ ] **Step 6: Commit**

```bash
cd /home/user/dart-analytics && git add app/src/pages/profile/index.astro
git commit -m "Regroup profile page settings under Player settings card"
```

---

## Self-Review Notes

- **Spec coverage:** Problem/Scope → Tasks 1–5 (grouping, plain `h2`, pencil-edit rows, handedness relocated + un-wrapped, `AppModeForm` untouched). Components section → Tasks 1 (icon), 2 (`SettingRow`), 3 (`HandednessForm` strip), 4 (`PlayerSettingsCard`), 5 (page + deletions). Save behavior → `SettingRow.saveExpr="$store.profile.save()"` in Task 4, unchanged `profile.store.ts`. Empty-value display → `emptyText` prop + `displayExpr` fallback in Task 2, applied to darts/weight (not display name) in Task 4. Testing section → Task 5 Steps 4–5 (`validate:app` regression run + manual smoke test), no unit tests added per D101.
- **Placeholder scan:** none found — every step has literal file contents or an exact command with expected output.
- **Type consistency:** `SettingRow` props (`id`, `label`, `valueExpr`, `modelExpr`, `saveExpr`, `placeholder`, `emptyText`, `numeric`, `inputmode`, `required`, `disabledExpr`, `class`) declared in Task 2 match every call site in Task 4 exactly (same prop names, `numeric`/`inputmode` only passed for the weight row). `HandednessForm`'s only prop (`class`) matches its Task 4 call site (`<HandednessForm class="mt-1" />`).
