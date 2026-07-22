<!--
status: canonical
scope: frontend/style-guide
read-when: any UI/component work — tokens, primitives, typography, motion, accessibility
updated: 2026-07-22
-->

# Frontend Style Guide

> **Version:** 0.2.0
>
> Dark-only, mobile-first UI conventions: sky accent, glass/surface tokens, primitive class contracts, typography, spacing, motion, accessibility.
>
> **Authority split:** this doc owns the *visual contract* — which semantic tokens and primitive classes exist, and the rules governing their use. `05-Astro-Components.md` owns *how* a component composes classes (frontmatter order, `cn()`, the class-placement decision table) — cross-referenced below, not repeated.
>
> **Runtime authority:** tokens and primitives are defined in `app/src/styles/global.css`. If this doc and CSS disagree after landing, `global.css` wins — update this doc to match.

---

# Purpose

Every screen draws from one fixed set of semantic tokens and primitive classes, defined once in `app/src/styles/global.css`. This doc is the reference for what exists and when to reach for it, so no component invents a one-off color, button, or card style.

Class *composition* (`cn()`, frontmatter `// Styles`, prop/`class` placement) lives in `05-Astro-Components.md`. Do not duplicate those rules here.

---

# Theme

- **Dark only.** `html { color-scheme: dark only; }`, forced even when the OS prefers light (`@media (prefers-color-scheme: light)` re-asserts dark). No theme toggle exists or is planned for v1.
- **Ambient backdrop.** `body::before` paints fixed radial gradients (soft top wash + sky `--accent-glow` corner bloom) over `--surface`. `body::after` adds a bottom vignette. Both layers are `pointer-events: none` and sit behind content (`z-index: -2` / `-1`).
- **Mobile-first shell.** Content column capped at `max-w-lg` (`AppLayout`, `GameLayout`, bottom nav). Full viewport height via `h-dvh max-h-dvh overflow-hidden` on `html`/`body`.
- **Touch ergonomics.** `-webkit-tap-highlight-color: transparent` and `touch-action: manipulation` on `html`.

---

# Tokens

Use semantic tokens only. Never raw Tailwind palette utilities (`bg-sky-500`, `text-zinc-*`, `bg-teal-*`, etc.) in component markup or frontmatter — if a color is needed that isn't below, add a token to `:root` / `@theme` in `global.css` first.

| Role | Classes / tokens |
| ---- | ---------------- |
| Surfaces | `bg-surface`, `bg-surface-raised`, `bg-surface-overlay`, `glass`, `glass-strong` |
| Text | `text-foreground`, `text-muted-foreground`, `text-muted` |
| Borders | `border-border`, `border-border-strong` |
| Accent | `accent`, `accent-hover`, `accent-muted`, `accent-foreground`, `accent-glow` (sky) |
| States | `error` / `error-muted` / `error-foreground`, `success` / `success-muted` |
| Radius | `rounded-sm` … `rounded-2xl` per `@theme` |
| Fonts | `font-sans` (Montserrat), `font-display` (Michroma), `font-mono` (JetBrains Mono) |
| Motion | `--ease-out`; keep UI ≤ ~300ms; transform/opacity only |

Radius scale (from `@theme`):

| Token | Size | Typical use |
| ----- | ---- | ----------- |
| `rounded-sm` | 6px | Nav pills / compact chips |
| `rounded-md` | 8px | Buttons, inputs, tabs track |
| `rounded-lg` | 12px | Compact panels, modals |
| `rounded-xl` | 16px | Nav shell |
| `rounded-2xl` | 20px | Cards |

Accent is Tailwind sky (`sky-400` / `sky-500` / `sky-600` mapped into `--accent*` OKLCH values). Selection uses `accent-muted` background.

---

# Primitives

Implement a reusable class contract once in `global.css` (`@utility` / `@layer components`) and reuse it everywhere. Prefer shared Astro wrappers (`Button.astro`, `Input.astro`, `Modal.astro`, …) that already apply these classes via `cn()`.

| Class / contract | Role |
| ---------------- | ---- |
| `.btn` + `btn-primary` / `btn-secondary` / `btn-ghost` / `btn-error` | All buttons (`Button.astro` variants) |
| `.input` / `.input-error` | Text fields; error border + focus ring |
| `.control` | Checkbox / radio appearance (`Checkbox.astro`, `Radio.astro`) |
| `.tab` | Segmented tab buttons inside a glass track (`Tabs.astro`) |
| `.alert` / `.alert-error` / `.alert-success` | Inline status banners (`Alert.astro`) |
| `.nav-pill` | Compact nav / filter chips (`NavPill.astro`) |
| `.gradient-card` | Elevated solid card with soft top light |
| `.link-card` | Community / outbound link cards |
| `.card-wrapper` | Tintable tool/extension cards (`--card-tint`, default accent) |
| `@utility glass` / `glass-strong` | Frosted panels — blur, inset highlight, border |

**Dialogs** are component contracts, not CSS class primitives: use `Modal.astro` and `ConfirmDialog.astro`. Panels typically combine `bg-surface-raised` + `glass` + `rounded-lg border border-border`.

Press feedback is built into `.btn:active:not(:disabled)` (`transform: scale(0.98)`) — do not add a second press animation elsewhere.

---

# Typography

| Context | Rules |
| ------- | ----- |
| Headings (`h1`–`h4`) | `font-display` (Michroma), `font-normal`, wide tracking — set in `@layer base` |
| Eyebrow / section tag (`h5`) | `font-mono font-semibold uppercase tracking-widest text-muted` |
| Body / description / buttons | `font-sans` (Montserrat) — never `font-mono` on body or buttons |
| Large numeric displays (scores, targets) | `font-mono font-bold tabular-nums` |
| Case | No `uppercase` on body, description, or button text. Scope `uppercase` to the specific title/eyebrow element only — never a parent wrapping a modal or body region |
| Weight | `font-normal`, `font-semibold`, `font-bold` only. **Never `font-medium`** — poor cross-browser rendering. Buttons use `font-semibold` |

When a parent uses `font-mono` or `uppercase`, reset children that should not inherit it (`font-sans`, `normal-case`).

---

# Spacing & layout

| Pattern | Value |
| ------- | ----- |
| Page / section padding | `p-3` or `px-4 py-5` |
| Between sections | `gap-3` / `mb-6` |
| Tight control / button groups | `gap-2` |
| Tap targets | Prefer comfortable padding (`px-4 py-2.5` on `.btn`); icon-only uses equal padding (`p-2.5`) |
| Shell width | `max-w-lg` on layout content columns and bottom nav |

Prefer `flex flex-1` over fixed fractions (`h-1/2`) when siblings share vertical space.

---

# Buttons

- Primary action: `btn btn-primary` (white fill + soft glow via `Button.astro` `variant="primary"`)
- Secondary / keypad keys: `btn btn-secondary`
- Text-only / cancel: `btn btn-ghost` (no border)
- Destructive: `btn btn-error`
- Always set `type="button"` unless the button submits a form — `Button.astro` defaults `type` to `"button"`
- Icon-only buttons need `aria-label`; icons typically `size-6 text-muted-foreground`
- Disabled: `.btn:disabled` applies `opacity-40` + `cursor-not-allowed`
- Never `rounded-full` on a primary button — `.btn`'s `rounded-md` is the ceiling

**ConfirmDialog action row:** cancel on the left (`variant="ghost"`), confirm on the right, row `justify-end gap-3`, buttons roughly `w-1/3` each (`ConfirmDialog.astro`).

---

# Surfaces & nesting

| Need | Reach for |
| ---- | --------- |
| Page chrome / body | `bg-surface` (default on `body`) |
| Raised panel / modal shell | `bg-surface-raised` and/or `glass` |
| Nested well / inset | `bg-surface-overlay` |
| Stronger frosted panel | `glass-strong` |
| Marketing / tinted card | `.gradient-card`, `.link-card`, or `.card-wrapper` |

One intentional surface level per visual block. Do not stack competing glass/raised treatments without a clear hierarchy (e.g. modal over page glass, not glass-in-glass).

---

# Motion

| Do | Don't |
| -- | ----- |
| Animate `transform` / `opacity` only | `transition: all` |
| `ease-out` via `--ease-out` for UI motion | `ease-in` on UI |
| Keep UI motion at or under ~300ms (`duration-150` is the common default) | Long decorative delays on frequent actions |
| Rely on `.btn:active`'s built-in press scale | A second press animation on high-frequency input (e.g. a numeric keypad) |
| Gate hover behind `@media (hover: hover) and (pointer: fine)` (see `.btn-*`, `.nav-pill`, `.tab`, `.link-card`, `.card-wrapper` in `global.css`) | Hover-only critical feedback on a touch target |
| Respect `prefers-reduced-motion` where the CSS already scopes it | Ignore reduced-motion preference |

**Modals:** opacity fade 150–200ms `ease-out`. If scaling on enter, start from `scale-95` plus opacity — never `scale(0)`.

---

# Interactivity

Mechanics (Alpine factory, stores, `$persist`) are owned by `03-Alpine-Patterns.md` — this section states UI-specific rules only:

- Put UI state on the smallest owner that needs it; keep interactive children inside that owner.
- **`x-show` + `x-cloak`:** every `x-show` element must also have `x-cloak` (`[x-cloak] { display: none !important; }` is already global).
- Dialogs: Escape closes and backdrop click dismisses when `dismissible` — see `Modal.astro` / `ConfirmDialog.astro`.
- Prefer declarative Alpine v3 shorthand bindings (`:class`, `:disabled`, `@click`) over imperative DOM manipulation — full rules in `03-Alpine-Patterns.md` / `05-Astro-Components.md`. Use `x-on:` / `x-bind:` only where Astro `{}` linter escape requires it (D100).

---

# Accessibility

- Icon-only controls always get `aria-label`.
- Dialogs: `role="dialog"`, `aria-modal="true"`, labelled and described (`Modal.astro` wires `aria-labelledby` / `aria-describedby`).
- Prefer semantic HTML (`button`, `a`, headings) over `div` + handlers.
- No hover-only critical affordances on a touch target — anything essential must also work on tap/focus.
- Focus-visible rings on `.control` use accent outline (`outline: 2px solid var(--accent)`).

---

# Anti-patterns

| Avoid | Prefer |
| ----- | ------ |
| Legacy backgrounds `bg-bg`, `bg-bg-subtle`, `bg-bg-muted`, `bg-bg-emphasis` | `bg-surface`, `bg-surface-raised`, `bg-surface-overlay` |
| Legacy text `text-fg`, `text-fg-muted`, `text-fg-subtle`, `text-fg-faint` | `text-foreground`, `text-muted-foreground`, `text-muted` |
| Old CSS primitives `.surface`, `.surface-elevated`, `.nav-item` / `.nav-item-active`, `.badge` / `.badge-accent` / `.badge-muted` (as formerly documented) | `glass` / raised/overlay tokens; `NavPill` / `.nav-pill`; `Badge.astro` with semantic tokens |
| Raw palette colors (`sky-*`, `teal-*`, `zinc-*` as paint) | Semantic tokens (`accent*`, `surface*`, `foreground`, `muted*`) |
| `font-medium` | `font-normal` / `font-semibold` / `font-bold` |
| `font-mono` on body or buttons | `font-sans` |
| A parent `uppercase` wrapping a modal or body region | `uppercase` scoped to the title/eyebrow only |
| Nested competing glass/raised stacks | One surface level + overlay well when needed |
| Ad-hoc button CSS | `.btn` + a variant class / `Button.astro` |
| A second press/tap animation on top of `.btn:active` | Instant state update + the shared press scale |
| Astro `class:list` or manual `[...].filter(Boolean).join(" ")` for build-time classes | `cn()` (`05-Astro-Components.md`; gated by `scripts/check-astro-class-composition.sh`) |

---

# Related Documents

| Document | Purpose |
| -------- | ------- |
| `00-Overview.md` | Client integration, state ownership, handbook index |
| `03-Alpine-Patterns.md` | Alpine factory, stores, `$persist` — interactivity mechanics |
| `04-Modules-And-OOP.md` | Portable UI kit (timer, toast, modal, chart) |
| `05-Astro-Components.md` | `.astro` authoring: frontmatter order, `cn()`, class-placement decision table |
| `10-Frontend-Agent-Guide.md` | Condensed agent rules |
| `app/src/styles/global.css` | Runtime token + primitive definitions |
