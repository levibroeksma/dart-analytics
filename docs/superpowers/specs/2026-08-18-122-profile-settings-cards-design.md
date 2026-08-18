<!--
status: canonical
scope: profile page settings cards
read-when: implementing issue #122
updated: 2026-08-18
-->

# Design: Profile/settings page card cleanup (issue #122)

## Problem

`/profile` has five polish issues raised by the owner:

1. The "Player settings" `<h2>` sits outside `PlayerSettingsCard`'s bordered card, not inside it.
2. Gap between each row's label and its value/input is effectively zero.
3. `HandednessForm`'s two buttons read "Right-handed"/"Left-handed" — the "-handed" suffix is redundant (the section label already reads "Handed") and risks the label wrapping inside the narrow button.
4. The app-mode picker (`AppModeForm`) isn't inside a card at all — only the individual radio buttons have borders — while `PlayerSettingsCard` above it is.
5. `AppModeForm`'s explanatory text is long or verbose; needs shortening to the essentials: analytics gives per-dart tracking for in-depth stats and focused improvement, recreational just logs a visit total.

## Scope

- `app/src/pages/profile/index.astro` — drop the now-redundant wrapping title/div around `PlayerSettingsCard`.
- `app/src/components/forms/PlayerSettingsCard.astro` — title moves inside the card; label→value spacing widened.
- `app/src/components/forms/SettingRow.astro` — label→value/input spacing widened.
- `app/src/components/forms/HandednessForm.astro` — button copy shortened.
- `app/src/components/forms/AppModeForm.astro` — wrapped in the same card treatment as `PlayerSettingsCard`; description shortened and de-collapsed.

No engine/schema/API change — pure display-layer, no new `decisions/**` entry (straightforward reuse of the already-decided `bg-tab-card border-tab-border rounded-3xl border p-3` card treatment, already duplicated across `PlayerSettingsCard.astro`/`InfoSection.astro`/`SettingSectionShell.astro`/`UserSection.astro` — this task adds a fifth literal user of that same pattern rather than extracting a shared primitive, consistent with the existing precedent).

## Design

### 1. Title inside the card

`pages/profile/index.astro` currently wraps the card in an outer `<div class="space-y-3">` with a sibling `<h2>`:

```astro
<div class="space-y-3">
  <h2 class="text-lg font-semibold text-foreground">Player settings</h2>
  <PlayerSettingsCard />
</div>
```

Move the `<h2>` into `PlayerSettingsCard.astro` itself, as the first child of the card `<div>`, and drop the now-single-child wrapper on the page:

```astro
<!-- pages/profile/index.astro -->
<h1 class="text-xl font-semibold text-foreground">Profile</h1>
<PlayerSettingsCard />
<AppModeForm />
```

```astro
<!-- PlayerSettingsCard.astro -->
<div class={className} {...props}>
  <h2 class="mb-3 text-lg font-semibold text-foreground">Player settings</h2>
  <div class="divide-tab-border divide-y">
    ...unchanged rows...
```

### 2. Label→value/input spacing

`SettingRow.astro`'s value/input wrapper `<div>` currently has no top margin against the label above it. Add `mt-1.5`:

```astro
<div class="min-w-0 flex-1">
  <label for={id} class={labelClass}>{label}</label>
  <div class="mt-1.5">
    <span ...>
    <Input ... />
  </div>
</div>
```

`PlayerSettingsCard.astro`'s Handed row uses the same `text-xs text-muted-foreground italic` label pattern but isn't a `SettingRow` (it wraps `HandednessForm` instead of an input); bump its existing `mt-1` to `mt-1.5` to match:

```astro
<HandednessForm class="mt-1.5" />
```

### 3. Handedness button copy

`HandednessForm.astro`: `Right-handed` → `Right`, `Left-handed` → `Left`. No structural change — same `<span class="block text-sm font-semibold text-foreground">` wrapper, just shorter text, which keeps it on one line inside the `flex-1` button.

### 4 + 5. AppModeForm: card wrapper + shortened, non-collapsible description

`AppModeForm.astro` currently uses `InfoSection` (a *separate* collapsible card: icon + title button that expands a description) above the (uncarded) radiogroup. Wrapping the whole section in a second `bg-tab-card` card around `InfoSection`'s own `bg-tab-card` card would nest two identically-styled cards inside each other — the style guide's explicit anti-pattern ("Nested competing glass/raised stacks ... One surface level + overlay well when needed", `07-Style-Guide.md`).

Since the new copy is short enough that a collapse/expand affordance no longer earns its keep, stop using `InfoSection` in `AppModeForm.astro` and inline a plain heading + static description as the first block inside one outer card — the same shape `PlayerSettingsCard` now has (title, then content, one surface level):

```astro
---
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
    <!-- unchanged radiogroup markup -->
  </div>

  <div
    class="space-y-2"
    x-show="$store.settings.loading"
    x-cloak
    aria-hidden="true"
  >
    <!-- unchanged skeleton markup -->
  </div>

  <p
    class="alert alert-error rounded-md border border-error/40 px-4 py-3 text-sm text-error-foreground"
    role="alert"
    x-show="$store.settings.error"
    x-text="$store.settings.error"
    x-cloak
  >
  </p>
</section>
```

Drop the `import InfoSection from "@components/ui/InfoSection.astro";` line — no other change to the radiogroup/skeleton/error markup or the `x-data`/`selectOther`/`save` wiring. `InfoSection.astro` itself is untouched (still used by `SettingSectionShell.astro` and the setup forms).

`aria-labelledby="app-mode-heading"` on the outer `<section>` and the inner `role="radiogroup"` both keep pointing at the same id, now on a plain `<h2>` instead of `InfoSection`'s internal `<h4>` — no accessibility regression, still one heading naming the whole section.

## Testing

No new `.ts` logic — every change here is markup/copy in `.astro` files, which stays untested per `app/CLAUDE.md`/D101 (no Astro-component test runner in this project). Verification is `astro check` (0 errors) + manual/browser confirmation on `/profile`:

1. "Player settings" heading renders inside the bordered card, above the rows.
2. Visible gap between each row's label and its value/input, and between "Handed" and the toggle.
3. Handedness buttons read "Right"/"Left" on one line each.
4. "App mode" now renders as one bordered card (heading + short description + the two options), matching `PlayerSettingsCard`'s visual weight — no separate collapsible panel.
5. Description text is short and non-collapsible; loading skeleton and error states still render correctly inside the same card.

## Out of scope

- No change to `HandednessForm`'s `boardInput` store wiring, `AppModeForm`'s `settings` store wiring, or `SettingRow`'s save/edit behavior.
- No change to `InfoSection.astro` itself — still used elsewhere unmodified.
- No shared `Card.astro` primitive extraction — the `bg-tab-card border-tab-border rounded-3xl border p-3` literal is copy-pasted a fifth time here, consistent with the existing four call sites; extracting a shared primitive is a separate concern not raised by this issue.
