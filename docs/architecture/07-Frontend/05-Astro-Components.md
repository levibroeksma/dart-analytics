<!--
status: canonical
scope: frontend/astro-components
read-when: authoring or reviewing .astro components
updated: 2026-07-15
-->

# Frontend Astro Components

> **Version:** 0.1.0
>
> Authoring conventions for `.astro` components: frontmatter order, props, class composition, slots, categories.
>
> Component *locations* and suffixes: `02-Folder-Structure.md`. Alpine wiring (`x-data`, data components): `03-Alpine-Patterns.md`. `components/ui` ↔ `modules/ui` pairing: `04-Modules-And-OOP.md`.

---

# Purpose

This document defines how a single `.astro` component is written so every component reads the same way. It governs the component's own markup and frontmatter — not where it lives or how Alpine/modules attach to it (those are `02`/`03`/`04`).

Goal: **one canonical shape**, minimum variation. Where a choice exists, the rule is decided by an objective trigger, not per-author taste.

---

# Frontmatter Structure

Frontmatter sections appear in this fixed order; omit any that do not apply.

```
1. interface Props { … }        // omit when the component takes no props
2. // Props     → const { … }: Props = Astro.props
3. imports, grouped in order:   // Layouts · // Components · // Icons · // Lib
4. // Data      → local static config (arrays/objects consumed by the markup)
5. // Styles    → cn() class composition and derived display values
```

`NavBtn.astro` exercises §1–§3, §5; `BottomNav.astro` exercises §3–§4. Neither is reordered — they are two projections of this one order.

**Import group headers** use exactly this vocabulary (`// Layouts`, `// Components`, `// Icons`, `// Lib`) and only for groups that are present.

---

# Props

- Every component with inputs declares an explicit `interface Props` — never inline `Astro.props` access untyped.
- Destructure once under `// Props`; rename reserved words (`class` → `classNameProp`).
- Optional props get defaults at destructure: `const { size = "md" } = Astro.props`.
- A component that forwards styling accepts an optional `class?: string` and merges it last (see Class Composition).

```astro
---
interface Props {
  href: string;
  matchPrefix?: string;
  class?: string;
}

// Props
const { href, matchPrefix, class: classNameProp }: Props = Astro.props;
---
```

---

# Class Composition

The trigger decides where a class lives — **not** author preference. This is the whole consistency rule:

| A class that… | Lives in | Form |
| ------------- | -------- | ---- |
| never changes | markup | literal `class="flex items-center gap-2"` |
| changes at **build time** (from props / URL) | frontmatter `// Styles` | `const className = cn(...)`, applied `class={className}` |
| changes at **runtime** (Alpine state) | markup | `:class` binding; static classes stay in `class` |
| recurs across components (a named pattern) | `global.css @layer components` | semantic class, e.g. `.btn-press`, `.card`, `.icon-btn-hover` |

**`cn()` is the only class-composition helper.** It is `twMerge(clsx(...))`, so a caller-passed `class` correctly overrides a conflicting base utility (a manual `[...].join(" ")` cannot). Use it for every conditional or passed-through class; never hand-roll composition.

```astro
---
// Styles
const className = cn(
  "icon-btn-hover btn-press inline-flex items-center justify-center rounded-md p-2",
  isNavActive(Astro.url.pathname, href, matchPrefix) ? "text-primary" : "nav-link-inactive",
  classNameProp,               // caller override wins
);
---
<a href={href} class={className}><slot /></a>
```

Runtime example (Alpine v3): static classes in `class`, reactive bind in `:class`, listeners as `@event`:

```astro
<button
  type="button"
  class="btn rounded-full px-4"
  :class="active ? 'text-accent' : 'text-fg-muted'"
  @click="toggle()"
>
```

Do **not** use `x-bind:class` or `x-on:click` on native elements. Exception: inside Astro `{}` prop/spread expressions where `@` triggers a linter error, use `x-on:click` for that attribute only (`03-Alpine-Patterns.md`).

Rules:

- Recurring visual patterns become a named class in `global.css @layer components` — do not copy a long utility string into three components.
- Never compute classes in both frontmatter and `:class` for the same element; pick the tier by the trigger above.
- Never put runtime-reactive logic in frontmatter (it is build-time only).

---

# Slots

- Default `<slot />` for a component's single content region.
- Named slots (`<slot name="header" />`) for multi-region layout components; document each in a comment.
- Provide fallback content inside the slot only when a sensible default exists.
- Prefer a slot over a `content`/`label` string prop when the caller may pass markup.

---

# Component Categories & When to Extract

Categories map to the folders in `02-Folder-Structure.md`:

| Folder | Holds | Example |
| ------ | ----- | ------- |
| `components/ui/` | portable, app-agnostic primitives (paired with `modules/ui/`) | `Toast.astro`, `Modal.astro` |
| `components/layout/` | app chrome and structure | `BottomNav.astro`, `NavBtn.astro` |
| `components/game/` | gameplay-specific presentation | `Scoreboard.astro` |
| `components/forms/` | form field / control components | `TemplateSelect.astro` |

**Extract a component when** markup repeats in 2+ places, a region exceeds ~50 lines, or a block has a single clear name and responsibility. **Do not extract** a one-use wrapper that only forwards a slot — inline it. Portability constraints for `components/ui/` are owned by `04-Modules-And-OOP.md` (no `@stores`/`@client/api` imports).

---

# Naming & File Conventions

- Component files are `PascalCase.astro`; the default export name matches the file.
- One component per file; co-locate a component-only `*.data.ts` beside it when static data grows past ~10 lines (`03-Alpine-Patterns.md` data pattern).
- Icons are imported as components under `// Icons` (`import DartIcon from "@icons/dart.svg"`), sized with utility classes, and given `aria-label` when they carry meaning.
- Layout components render structure only; they do not fetch data (skeleton-first hydration lives in pages — `00-Overview.md`).

---

# Anti-Patterns

| Anti-pattern | Reason |
| ------------ | ------ |
| Long-form `x-bind:*` / `x-on:*` when `:attr` / `@event` works | Alpine v3 shorthand required — see `03-Alpine-Patterns.md` |
| Untyped `Astro.props` access | Props contract must be explicit |
| Manual `[...].filter(Boolean).join(" ")` class merge | No Tailwind conflict resolution — use `cn()` |
| Same element styled in both frontmatter and `:class` | Two sources of truth for one class list |
| Runtime-conditional classes in frontmatter | Frontmatter is build-time only |
| Long utility strings duplicated across components | Promote to a `@layer components` class |
| One-use pass-through wrapper component | Inline it — needless indirection |
| Data fetching inside a component | Pages own hydration |

---

# Implementation-phase note (deferred)

`cn()` requires `clsx` + `tailwind-merge` (neither is in `app/package.json` yet). When the first component needs composition, add both and create the helper at `src/lib/client/cn.ts` (or the utils location in `02-Folder-Structure.md`):

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

---

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `02-Folder-Structure.md` | Component folders, suffixes, aliases |
| `03-Alpine-Patterns.md` | `x-data`, data components, `$persist` |
| `04-Modules-And-OOP.md` | Portable UI kit, `components/ui` ↔ `modules/ui` |
| `00-Overview.md` | Client integration, skeleton-first hydration |
| `10-Frontend-Agent-Guide.md` | Condensed agent rules |
