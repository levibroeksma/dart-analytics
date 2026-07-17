# Radio Card — Design

> **Date:** 2026-07-17
> **Status:** approved (brainstorming consensus)
> **Scope:** Presentational `RadioCard.astro` form control, shared `.radio-card` / `.radio-card-selected` primitives, Score Training setup preset list adoption.
> **Out of scope:** Native `<input type="radio">` inside the card, roving `tabindex` keyboard grid, portable `modules/ui` pairing, unit tests for `.astro` markup (D101).

---

## Context

Score Training setup (`app/src/pages/games/score-training/setup/index.astro`) selects a configuration preset with a plain radio + label. That control should become a tappable card: title + optional description, stronger selected surface (`bg-accent-muted` + accent border), caller-owned Alpine selection.

Decisions locked in brainstorming:

| Topic | Choice |
| ----- | ------ |
| Content | Title + optional description (prop and/or named slots) |
| Selection binding | Presentational only — caller wires `:class` / `@click` |
| Selected look | Accent muted fill + accent border |
| Home | `components/forms/` + `@layer components` primitives (Approach 1) |

Authority: `07-Frontend/07-Style-Guide.md`, `05-Astro-Components.md`, Emil design-eng motion rules (transform/opacity only, ease-out, press scale `0.97`, no `scale(0)`).

---

## Scope

In scope:

- `app/src/components/forms/RadioCard.astro`
- `.radio-card` and `.radio-card-selected` in `app/src/styles/global.css` `@layer components`
- Reduced-motion coverage for `.radio-card` (match `.btn` / `.input`)
- Wire setup page preset list to `RadioCard` with `role="radiogroup"` / `role="radio"`
- Style guide primitives table row for the new classes
- `DECISIONS.md` one-liner for the presentational radio-card form pattern

Out of scope:

- Embedding a native radio input (caller owns selection state)
- Arrow-key roving tabindex beyond basic `role="radio"` + click / focus-visible
- `components/ui` + `modules/ui` portable kit pairing (app tokens; form control, not kit primitive)
- Vitest for Astro markup (D101 — variant logic stays in component frontmatter)

---

## Design

### `RadioCard.astro`

Frontmatter order per `05-Astro-Components.md`: `Props` → destructure → `cn` import → `// Styles`.

```astro
---
interface Props {
  title?: string;
  description?: string;
  class?: string;
  [key: string]: unknown;
}

const {
  title,
  description,
  class: classNameProp,
  ...rest
}: Props = Astro.props;

import { cn } from '@client/cn';

const className = cn('radio-card', classNameProp);
---

<button type="button" class={className} {...rest}>
  <span class="block font-mono font-semibold text-fg">
    {title ?? <slot name="title" />}
  </span>
  <span class="mt-0.5 block text-sm text-fg-muted">
    {description ?? <slot name="description" />}
  </span>
  <slot />
</button>
```

Notes:

- Root is `<button type="button">` so press feedback and keyboard activation work without a hidden input.
- `title` / `description` are optional so Alpine `x-for` lists can fill named slots with `x-text` (Astro props are build-time only).
- Render the description row only when `description` is set **or** `Astro.slots.has('description')`. Alpine lists put `x-show` on the slotted span so empty descriptions collapse at runtime.
- Rest attrs forward Alpine bindings (`@click`, `:class`, `role`, `aria-*`, `disabled`).
- Default slot is for rare extra markup under the description.

### CSS primitives (`global.css`)

```css
.radio-card {
  /* surface base + full-width control chrome */
  @apply surface w-full min-h-11 p-4 text-left;
  transition:
    transform var(--duration-fast) var(--ease-out),
    background-color var(--duration-normal) var(--ease-out),
    border-color var(--duration-normal) var(--ease-out);
}

.radio-card:active {
  transform: scale(0.97);
}

.radio-card:focus-visible {
  @apply outline-none ring-2 ring-accent-500/25 border-accent-500;
}

.radio-card-selected {
  @apply border-accent bg-accent-muted;
}

@media (hover: hover) and (pointer: fine) {
  .radio-card:hover:not(.radio-card-selected) {
    @apply bg-bg-muted;
  }
}
```

Add `.radio-card` to the existing `prefers-reduced-motion: reduce` block (zero transitions; disable `:active` scale), same as `.btn`.

Do **not** nest `.surface` inside another `.surface`. `.radio-card` *is* the surface.

### Setup page adoption

Replace the plain radio labels with:

```astro
<div class="mt-4 flex flex-col gap-2" role="radiogroup" aria-label="Preset">
  <template x-for="preset in presets" :key="preset.configurationTemplateId">
    <RadioCard
      role="radio"
      :aria-checked="selectedTemplateId === preset.configurationTemplateId"
      :class="selectedTemplateId === preset.configurationTemplateId && 'radio-card-selected'"
      @click="selectedTemplateId = preset.configurationTemplateId"
    >
      <span slot="title" x-text="preset.name"></span>
      <span
        slot="description"
        x-show="preset.description"
        x-text="preset.description"
      ></span>
    </RadioCard>
  </template>
</div>
```

No changes to `scoreTrainingSetup()` / stores / API. Presets already expose nullable `description`.

### Docs / decisions

| File | Change |
| ---- | ------ |
| `07-Frontend/07-Style-Guide.md` | Add `.radio-card` / `.radio-card-selected` to Primitives table |
| `DECISIONS.md` | One line: presentational radio cards live in `forms/`, selection via caller Alpine, selected chrome is accent-muted surface |

No context-map path moves. Run context checkers + graph refresh at task completion per root `CLAUDE.md`.

---

## Error Handling

N/A — presentational control; selection errors remain the setup factory’s `error` string.

---

## Testing / verification

- No new Vitest files for the `.astro` component (D101).
- Manual: setup page — select presets, confirm selected chrome, Start still uses `selectedTemplateId`.
- `npm run validate:app` before claiming done (app change).

---

## Open questions

None — all brainstorming choices approved 2026-07-17.
