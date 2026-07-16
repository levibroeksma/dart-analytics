<!--
status: canonical
scope: frontend/style-guide
read-when: any UI/component work — tokens, primitives, typography, motion, accessibility
updated: 2026-07-16
-->

# Frontend Style Guide

> **Version:** 0.1.0
>
> Dark-only, mobile-first UI conventions: semantic tokens, primitive class contracts, typography, spacing, motion, accessibility.
>
> **Authority split:** this doc owns the *visual contract* — which semantic tokens and primitive classes exist, and the rules governing their use. `05-Astro-Components.md` owns *how* a component composes classes (frontmatter order, `cn()`, the class-placement decision table) — cross-referenced below, not repeated.

---

# Purpose

Every screen in this app draws from one fixed set of semantic tokens and primitive classes, defined once in `app/src/styles/global.css`. This doc is the reference for what exists and when to reach for it, so no component invents a one-off color, button, or card style.

---

# Theme

- **Dark only.** `html { color-scheme: dark only; }`, forced even when the OS prefers light (`@media (prefers-color-scheme: light)` re-asserts dark). No theme toggle exists or is planned for v1.
- **Mobile-first shell.** Content column capped at `max-w-lg`; full viewport height via `h-dvh max-h-dvh overflow-hidden` on `html`/`body`; bottom chrome pads for the safe area (`pb-[env(safe-area-inset-bottom)]` on `.app-nav`).
- **Touch ergonomics.** `-webkit-tap-highlight-color: transparent` and `touch-action: manipulation` on `html`.

---

# Tokens

Use semantic tokens only. Never raw Tailwind palette utilities (`bg-teal-500`, `text-zinc-*`, etc.) in component markup or frontmatter — if a color is needed that isn't below, add a token to `@theme` in `global.css` first.

| Role | Classes |
| --- | --- |
| Backgrounds | `bg-bg`, `bg-bg-subtle`, `bg-bg-muted`, `bg-bg-emphasis` |
| Text | `text-fg`, `text-fg-muted`, `text-fg-subtle`, `text-fg-faint` |
| Borders | `border-border`, `border-border-strong` |
| Accent | `bg-accent`, `text-accent`, `text-accent-foreground`, `bg-accent-muted`, `accent-{50..950}` scale |
| States | `destructive` / `success` / `warning`, each with a `-muted` variant (`bg-destructive-muted`, etc.) |
| Radius | `rounded-md` (controls), `rounded-lg` (cards/surfaces) |
| Focus ring | `ring-ring` (`--color-ring`, mapped to `teal-500`) |

Motion tokens (custom properties, not Tailwind classes): `--ease-out`, `--ease-in-out`, `--duration-fast` (140ms), `--duration-normal` (200ms).

All tokens are defined once, in `app/src/styles/global.css`'s `@theme` block — that file is the source of truth if this table and the CSS ever disagree.

---

# Primitives

Implement a reusable class contract once, in `global.css`'s `@layer components`, and reuse it everywhere. Never reinvent one of these per screen.

| Class | Role |
| --- | --- |
| `.surface` | Cards, panels, primary containers — `rounded-lg border border-border bg-bg-subtle` |
| `.surface-elevated` | Nested wells inside a surface — `rounded-lg border border-border bg-bg-muted` |
| `.btn` + `.btn-primary` / `.btn-secondary` / `.btn-ghost` | All buttons |
| `.input` | Text fields |
| `.badge` + `.badge-accent` / `.badge-muted` | Status chips |
| `.nav-item` / `.nav-item-active` | Bottom navigation items |
| `.app-shell` / `.app-main` / `.app-nav` | Page chrome: column, scrolling main, fixed bottom nav |

Press feedback is built into `.btn:active` (`transform: scale(0.97)`) — do not add a second press animation anywhere else.

---

# Typography

| Context | Rules |
| --- | --- |
| Body / description / buttons | `font-sans` (the `body` default) — never `font-mono` |
| Titles, tags, labels (headers) | `font-mono` is allowed |
| Large numeric displays (scores, targets) | `font-mono font-bold tabular-nums` |
| Case | No `uppercase` on body, description, or button text. Scope `uppercase` to the specific title element only — never a parent wrapping a modal or body region |
| Weight | `font-normal`, `font-semibold`, `font-bold` only. **Never `font-medium`** — poor cross-browser rendering. `.btn`, `.badge`, and `.nav-item` all use `font-semibold` for exactly this reason |

When a parent element uses `font-mono` or `uppercase`, reset children that should not inherit it (`font-sans`, `normal-case`).

---

# Spacing & layout

| Pattern | Value |
| --- | --- |
| Page / section padding | `p-3` or `px-4 py-5` |
| Between sections | `gap-3` / `mb-6` |
| Tight control / button groups | `gap-2` |
| Tap targets | `min-h-11` by default (`.btn`, `.input`, `.nav-item` all use it); compact UI may use `min-h-9` / `min-h-10` |
| Shell width | `max-w-lg` (`.app-shell`) |

Prefer `flex flex-1` over fixed fractions (`h-1/2`) when siblings share vertical space.

---

# Buttons

- Primary action: `btn btn-primary`
- Secondary / keypad keys: `btn btn-secondary`
- Text-only / cancel: `btn btn-ghost` (no border)
- Always set `type="button"` unless the button submits a form — `Button.astro` already defaults `type` to `"button"`, so only override it for submit buttons
- Icon-only buttons need `aria-label`; icons are typically `size-6 text-fg-subtle`
- Disabled state: `disabled:opacity-40 disabled:pointer-events-none`
- Never `rounded-full` on a primary button — `.btn`'s base `rounded-md` is the ceiling

**Modal action row** (forward guidance — no modal primitive exists yet; apply this when one is built): cancel button on the left, confirm on the right, row `justify-end`, buttons roughly `w-1/3` each.

---

# Surfaces & nesting

- One intentional surface level per visual block.
- Never nest `.surface` inside `.surface`. An inner well inside a surface uses `.surface-elevated` instead.

---

# Motion

| Do | Don't |
| --- | --- |
| Animate `transform` / `opacity` only | `transition: all` |
| `ease-out` (`--ease-out`) for UI motion | `ease-in` on UI |
| Keep UI motion at or under 300ms (`--duration-fast` / `--duration-normal`) | Long decorative delays on frequent actions |
| Rely on `.btn:active`'s built-in press scale | A second press animation on high-frequency input (e.g. a numeric keypad) |
| Gate hover behind `@media (hover: hover) and (pointer: fine)` (see `.nav-item:hover` in `global.css`) | Hover-only critical feedback on a touch target |
| Respect `prefers-reduced-motion` (`global.css`'s `@media (prefers-reduced-motion: reduce)` block already zeroes `.btn`/`.input`/`.nav-item` transitions) | Ignore reduced-motion preference |

**Modals** (forward guidance): opacity fade 150–200ms `ease-out`. If scaling on enter, start from `scale-95` plus opacity — never `scale(0)`.

---

# Interactivity

Mechanics (Alpine factory, stores, `$persist`) are owned by `03-Alpine-Patterns.md` — this section states UI-specific rules only:

- Put UI state on the smallest owner that needs it; keep interactive children inside that owner.
- Cloak unready UI with `x-cloak` (`[x-cloak] { display: none !important; }` is already global).
- Dialogs (forward guidance, once a modal primitive exists): Escape closes, backdrop click dismisses.
- Prefer declarative Alpine v3 shorthand bindings (`:class`, `:disabled`, `@click`) over imperative DOM manipulation — full rules in `03-Alpine-Patterns.md` / `05-Astro-Components.md`.

---

# Accessibility

- Icon-only controls always get `aria-label`.
- Dialogs (forward guidance): `role="dialog"`, `aria-modal="true"`, labelled and described.
- Prefer semantic HTML (`button`, `a`, headings) over `div` + handlers.
- No hover-only critical affordances on a touch target — anything essential must also work on tap/focus.

---

# Anti-patterns

| Avoid | Prefer |
| --- | --- |
| Raw palette colors (`teal-*`, `zinc-*`) | Semantic tokens (`accent`, `bg-*`, `fg-*`) |
| `font-medium` | `font-normal` / `font-semibold` / `font-bold` |
| `font-mono` on body or buttons | `font-sans` |
| A parent `uppercase` wrapping a modal or body region | `uppercase` scoped to the title element only |
| Nested `.surface` | `.surface` + `.surface-elevated` |
| Ad-hoc button CSS | `.btn` + a variant class |
| A second press/tap animation on top of `.btn:active` | Instant state update + the shared press scale |
| Manual `[...].filter(Boolean).join(" ")` class merge | `cn()` (`05-Astro-Components.md`) |

---

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `00-Overview.md` | Client integration, state ownership, handbook index |
| `03-Alpine-Patterns.md` | Alpine factory, stores, `$persist` — interactivity mechanics |
| `04-Modules-And-OOP.md` | Portable UI kit (timer, toast, modal, chart) — where the forward-guidance sections above will apply once built |
| `05-Astro-Components.md` | `.astro` authoring: frontmatter order, `cn()`, class-placement decision table |
| `10-Frontend-Agent-Guide.md` | Condensed agent rules |
