# Style Guide Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a canonical style-guide doc (`07-Frontend/07-Style-Guide.md`) codifying the dark-only token/primitive/typography/motion contract already mostly implemented in `global.css`, fix the concrete violations the audit found, and register the doc in the Context Maintenance system.

**Architecture:** Pure documentation + small CSS/markup fixes — no new runtime logic, no new dependencies. `global.css` gets three `font-medium` → `font-semibold` swaps and one new semantic token (`--color-accent-muted`); `NavBtn.astro` gets its manual class-merge replaced with the existing `cn()` helper; a new frontend-handbook doc is written and registered in `00-Context-Map.md`, `00-Overview.md`, `10-Frontend-Agent-Guide.md`, and `DECISIONS.md`.

**Tech Stack:** Astro.js, Tailwind CSS v4 (`@theme`/`@layer` CSS), Alpine.js, `clsx` + `tailwind-merge` (via existing `cn()` at `app/src/lib/client/cn.ts`).

## Global Constraints

- Dark-only, mobile-first: no light-mode branch, no new breakpoints introduced.
- Semantic tokens only — never raw Tailwind palette utilities (`bg-teal-500`, `text-zinc-*`) in any changed file.
- No `font-medium` anywhere in `global.css` after this plan — `font-normal` / `font-semibold` / `font-bold` only.
- No new npm dependencies.
- No new Vitest coverage required — per `app/CLAUDE.md`/D101, `.astro` markup and CSS styling are not unit-tested in this project; verification is `npm run check` (astro check) + a manual browser check.
- Every doc edited must carry an updated `updated:` front-matter date (`2026-07-16`) and a version bump per this repo's doc convention.
- New branch `frontend/style-guide-hardening`, checked out directly in the main working copy — never under `.worktrees/` (root `CLAUDE.md`).
- Do not commit unless explicitly instructed to in a step below — every commit step in this plan is an explicit instruction.

---

### Task 1: Branch + `global.css` token and font-weight fixes

**Files:**
- Modify: `app/src/styles/global.css:41-58` (add `--color-accent-muted` token)
- Modify: `app/src/styles/global.css:122` (`.btn`)
- Modify: `app/src/styles/global.css:170` (`.badge`)
- Modify: `app/src/styles/global.css:173-175` (`.badge-accent`)
- Modify: `app/src/styles/global.css:182` (`.nav-item`)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `--color-accent-muted` CSS custom property (consumed by Task 3's doc content as a documented token, and already consumed live by `.badge-accent`). `.btn`/`.badge`/`.nav-item` continue to be consumed by `Button.astro`, `NavBtn.astro`, `LogoutButton.astro` unchanged (visual weight only, no class-name change).

- [ ] **Step 1: Create and check out the task branch**

```bash
cd /Users/levi/Development/dart-analytics
git checkout -b frontend/style-guide-hardening
```

Expected: `Switched to a new branch 'frontend/style-guide-hardening'`

- [ ] **Step 2: Add the `--color-accent-muted` token**

In `app/src/styles/global.css`, in the `@theme` block, immediately after the `--color-destructive-muted` block and before `--color-success`, insert:

```css
  --color-accent-muted: color-mix(in oklab, var(--color-teal-500) 12%, transparent);
```

So the surrounding block reads:

```css
  /* ── Semantic states ── */
  --color-destructive: var(--color-red-400);
  --color-destructive-muted: color-mix(
    in oklab,
    var(--color-red-500) 15%,
    transparent
  );
  --color-accent-muted: color-mix(in oklab, var(--color-teal-500) 12%, transparent);
  --color-success: var(--color-teal-400);
```

- [ ] **Step 3: Fix `.btn` font weight**

Change:

```css
  .btn {
    @apply inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium;
```

to:

```css
  .btn {
    @apply inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold;
```

- [ ] **Step 4: Fix `.badge` font weight and `.badge-accent` token**

Change:

```css
  .badge {
    @apply inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium;
  }

  .badge-accent {
    @apply bg-success-muted text-accent-300;
  }
```

to:

```css
  .badge {
    @apply inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold;
  }

  .badge-accent {
    @apply bg-accent-muted text-accent-300;
  }
```

- [ ] **Step 5: Fix `.nav-item` font weight**

Change:

```css
  .nav-item {
    @apply flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md px-3 text-[10px] font-medium text-fg-subtle;
```

to:

```css
  .nav-item {
    @apply flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md px-3 text-[10px] font-semibold text-fg-subtle;
```

- [ ] **Step 6: Verify no `font-medium` remains and the build type-checks**

```bash
cd /Users/levi/Development/dart-analytics
grep -n "font-medium" app/src/styles/global.css
```

Expected: no output (exit code 1, no matches).

```bash
cd app && npm run check
```

Expected: `astro check` completes with 0 errors (Tailwind `@theme`/`@apply` are not type-checked by `astro check`, but this confirms nothing else broke).

- [ ] **Step 7: Manual visual check**

```bash
cd app && astro dev --background
```

Open the app in a browser, navigate to any page with the bottom nav visible, and confirm: nav labels, any visible button, and any visible badge still render with clearly legible weight (not thin/`font-normal`-looking) and no visual regression. Stop the dev server when done:

```bash
astro dev stop
```

- [ ] **Step 8: Commit**

```bash
cd /Users/levi/Development/dart-analytics
git add app/src/styles/global.css
git commit -m "fix(styles): replace font-medium with font-semibold, add accent-muted token"
```

---

### Task 2: `NavBtn.astro` — replace manual class merge with `cn()`

**Files:**
- Modify: `app/src/components/layout/NavBtn.astro`

**Interfaces:**
- Consumes: `cn` from `@client/cn` (existing helper, already used by `Button.astro`/`Input.astro` — signature `cn(...inputs: ClassValue[]) => string`).
- Produces: no change to `NavBtn`'s public `Props` interface (`href`, `label`, `matchPrefix?`, `class?`) or rendered class output — same three inputs, same order, same result string.

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `app/src/components/layout/NavBtn.astro` with:

```astro
---
interface Props {
  href: string;
  label: string;
  matchPrefix?: string;
  class?: string;
}

// Props
const { href, label, matchPrefix, class: classNameProp }: Props = Astro.props;

// Lib
import { cn } from "@client/cn";
import { isNavActive } from "@lib/utils/is-nav-active";

// Styles
const active = isNavActive(Astro.url.pathname, href, matchPrefix);
const className = cn(
  "nav-item focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 [&_svg]:size-6",
  active ? "nav-item-active" : "",
  classNameProp,
);
---

<a href={href} class={className} aria-current={active ? "page" : undefined}>
  <slot />
  <span>{label}</span>
</a>
```

This moves `active` below the imports so it can use `isNavActive` (frontmatter order per `05-Astro-Components.md`: Props → imports → Data → Styles; `active` and `className` are both derived/build-time values, so both live under `// Styles`).

- [ ] **Step 2: Verify the diff is class-composition-only**

```bash
cd /Users/levi/Development/dart-analytics
git diff app/src/components/layout/NavBtn.astro
```

Expected: the `Props` interface, `href`/`label`/`matchPrefix`/`aria-current` logic, and rendered markup are unchanged — only the class-building mechanism and import/section ordering changed.

- [ ] **Step 3: Type-check**

```bash
cd app && npm run check
```

Expected: 0 errors.

- [ ] **Step 4: Manual visual check**

```bash
cd app && astro dev --background
```

Open the app, confirm the bottom nav's active-page item still shows the `nav-item-active` accent color and the other three items show the inactive state — identical to before the change. Stop the server:

```bash
astro dev stop
```

- [ ] **Step 5: Commit**

```bash
cd /Users/levi/Development/dart-analytics
git add app/src/components/layout/NavBtn.astro
git commit -m "refactor(nav): use cn() for class composition instead of manual join"
```

---

### Task 3: Write `07-Frontend/07-Style-Guide.md`

**Files:**
- Create: `docs/architecture/07-Frontend/07-Style-Guide.md`

**Interfaces:**
- Consumes: token/primitive names from `app/src/styles/global.css` as fixed by Task 1 (`--color-accent-muted`, `.btn`/`.badge`/`.nav-item` at `font-semibold`); class-placement rules from `05-Astro-Components.md` (cross-referenced, not restated).
- Produces: the canonical doc path `07-Frontend/07-Style-Guide.md`, referenced by Task 4 (`00-Overview.md`, `10-Frontend-Agent-Guide.md`) and Task 5 (`00-Context-Map.md`).

- [ ] **Step 1: Create the doc**

Write the full file `docs/architecture/07-Frontend/07-Style-Guide.md`:

```markdown
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
```

- [ ] **Step 2: Confirm the doc has a valid canonical front-matter header**

```bash
cd /Users/levi/Development/dart-analytics
head -6 docs/architecture/07-Frontend/07-Style-Guide.md
```

Expected: the `<!-- status: canonical ... -->` block is present (required by `check-context-map.sh`'s rule 3 — "a canonical doc under `docs/architecture/` lacks a status front-matter header" is a failure condition).

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/07-Frontend/07-Style-Guide.md
git commit -m "docs(frontend): add canonical style guide (tokens, primitives, typography, motion, a11y)"
```

---

### Task 4: Register the doc in the Frontend handbook

**Files:**
- Modify: `docs/architecture/07-Frontend/00-Overview.md`
- Modify: `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md`

**Interfaces:**
- Consumes: `07-Frontend/07-Style-Guide.md` (Task 3).
- Produces: nothing new consumed by later tasks — this task only adds cross-references.

- [ ] **Step 1: Add the doc to `00-Overview.md`'s Handbook Index**

In `docs/architecture/07-Frontend/00-Overview.md`, change:

```markdown
| `05-Astro-Components.md` | `.astro` authoring: frontmatter, props, class composition, slots |
| `10-Frontend-Agent-Guide.md` | Condensed agent rules |
```

to:

```markdown
| `05-Astro-Components.md` | `.astro` authoring: frontmatter, props, class composition, slots |
| `07-Style-Guide.md` | Tokens, primitives, typography, motion, accessibility |
| `10-Frontend-Agent-Guide.md` | Condensed agent rules |
```

- [ ] **Step 2: Add the doc to `00-Overview.md`'s Related Documents table**

Change:

```markdown
| `05-Astro-Components.md` | `.astro` authoring conventions |
| `10-Frontend-Agent-Guide.md` | Condensed agent rules |
```

to:

```markdown
| `05-Astro-Components.md` | `.astro` authoring conventions |
| `07-Style-Guide.md` | Tokens, primitives, typography, motion, accessibility |
| `10-Frontend-Agent-Guide.md` | Condensed agent rules |
```

- [ ] **Step 3: Bump `00-Overview.md`'s version line**

Change:

```markdown
> **Version:** 0.3.2 (centralized error mapping, types/ relocation, 2026-07-16)
```

to:

```markdown
> **Version:** 0.3.3 (style guide doc reference added, 2026-07-16)
```

- [ ] **Step 4: Add the doc to `10-Frontend-Agent-Guide.md`'s Load Packs table**

Change:

```markdown
| Page / component work | This file + `00-Overview.md` + `app/CLAUDE.md` |
```

to:

```markdown
| Page / component work | This file + `00-Overview.md` + `07-Style-Guide.md` + `app/CLAUDE.md` |
```

- [ ] **Step 5: Add a new "12. Styling" section to `10-Frontend-Agent-Guide.md`**

Immediately after the existing "## 11. Test-driven development" section (ending `...06-Test-Strategy.md`.`) and before the `---\n\n# Forbidden` divider, insert:

```markdown
## 12. Styling

Semantic tokens only (`bg-*`, `fg-*`, `border-*`, `accent-*`, states) — never raw palette utilities (`bg-teal-500`, `text-zinc-*`). Primitive classes (`.btn`, `.input`, `.badge`, `.surface`, `.nav-item`, `.app-*`) are implemented once in `global.css` — reuse, never reinvent per screen. Never `font-medium` — prefer `font-normal` / `font-semibold` / `font-bold`. Full rules: `07-Style-Guide.md`.
```

- [ ] **Step 6: Add a Pre-Completion Checklist line**

In `10-Frontend-Agent-Guide.md`'s "# Pre-Completion Checklist" list, after the line `- [ ] Component frontmatter follows the \`05\` order; classes composed via \`cn()\`` insert:

```markdown
- [ ] Styling uses semantic tokens/primitives only; no `font-medium`, no raw palette utilities
```

- [ ] **Step 7: Add the doc to `10-Frontend-Agent-Guide.md`'s Related Documents table**

Change:

```markdown
| `04-Modules-And-OOP.md` | Modules, portable UI |
| `06-Test-Strategy.md` | Shared mocks, full-suite policy |
```

to:

```markdown
| `04-Modules-And-OOP.md` | Modules, portable UI |
| `06-Test-Strategy.md` | Shared mocks, full-suite policy |
| `07-Style-Guide.md` | Tokens, primitives, typography, motion, a11y |
```

- [ ] **Step 8: Bump `10-Frontend-Agent-Guide.md`'s version line**

Change:

```markdown
> **Version:** 0.1.0
```

to:

```markdown
> **Version:** 0.1.1 (style guide section added, 2026-07-16)
```

- [ ] **Step 9: Verify both diffs**

```bash
cd /Users/levi/Development/dart-analytics
git diff docs/architecture/07-Frontend/00-Overview.md docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md
```

Expected: only the additions/version bumps above — no unrelated lines touched.

- [ ] **Step 10: Commit**

```bash
git add docs/architecture/07-Frontend/00-Overview.md docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md
git commit -m "docs(frontend): register style guide in handbook index and agent guide"
```

---

### Task 5: Register the doc in `00-Context-Map.md`

**Files:**
- Modify: `docs/architecture/00-Context-Map.md`

**Interfaces:**
- Consumes: `07-Frontend/07-Style-Guide.md` (Task 3).
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Add File Inventory row**

Change:

```markdown
| `07-Frontend/06-Test-Strategy.md` | Shared-mock promotion rule, full-suite-always-runs policy (2026-07-16) | canonical | ~1k |
| `07-Frontend/10-Frontend-Agent-Guide.md` | Condensed frontend agent rules | canonical | ~2k |
```

to:

```markdown
| `07-Frontend/06-Test-Strategy.md` | Shared-mock promotion rule, full-suite-always-runs policy (2026-07-16) | canonical | ~1k |
| `07-Frontend/07-Style-Guide.md` | Tokens, primitives, typography, motion, accessibility conventions (2026-07-16) | canonical | ~2.5k |
| `07-Frontend/10-Frontend-Agent-Guide.md` | Condensed frontend agent rules | canonical | ~2k |
```

- [ ] **Step 2: Add the doc to three Context Packs rows**

Change:

```markdown
| Frontend page / component work | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/00-Overview.md`, `07-Frontend/05-Astro-Components.md`, `app/CLAUDE.md` | ~5.5k |
```

to:

```markdown
| Frontend page / component work | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/00-Overview.md`, `07-Frontend/05-Astro-Components.md`, `07-Frontend/07-Style-Guide.md`, `app/CLAUDE.md` | ~7.5k |
```

Change:

```markdown
| Frontend gameplay / session features | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/00-Overview.md`, `07-Frontend/03-Alpine-Patterns.md`, `07-Frontend/04-Modules-And-OOP.md`, `app/CLAUDE.md` | ~6k |
```

to:

```markdown
| Frontend gameplay / session features | `07-Frontend/10-Frontend-Agent-Guide.md`, `07-Frontend/00-Overview.md`, `07-Frontend/03-Alpine-Patterns.md`, `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/07-Style-Guide.md`, `app/CLAUDE.md` | ~8k |
```

Change:

```markdown
| New portable UI primitive | `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/03-Alpine-Patterns.md`, `app/CLAUDE.md` | ~4k |
```

to:

```markdown
| New portable UI primitive | `07-Frontend/04-Modules-And-OOP.md`, `07-Frontend/03-Alpine-Patterns.md`, `07-Frontend/07-Style-Guide.md`, `app/CLAUDE.md` | ~6.5k |
```

- [ ] **Step 3: Update the Frontend docs line in "Current Implementation State"**

Find the table row starting `| Frontend docs |` and append, right before the closing `|` at the end of that cell's text:

```
; new `07-Style-Guide.md` 0.1.0 — dark-only token/primitive/typography/motion contract, previously undocumented (D108, 2026-07-16)
```

So the full cell reads (only the new clause is added — everything before it is unchanged):

```markdown
| Frontend docs | Handbook `02`→0.2.1, `04`→0.1.1, `10`→0.1.1, `00`→0.3.3 — prerender-default, Alpine factory, client auth gate (D98), auto-cleanup recovery, completed-batch outbox + `_v` store guard, `.astro` authoring conventions; prerendered protected shells decided public-by-design, JWT-gated API is the real boundary (D97, 2026-07-15); tests live under `app/tests/` (never colocated), `.astro` variant logic stays inline in frontmatter (D101, 2026-07-15); type/interface barrel-raising universal, no `.ts` outside `lib/`/`pages/api/`, centralized error mapping, self-learning gate (D103–D107, 2026-07-16); new `07-Style-Guide.md` 0.1.0 — dark-only token/primitive/typography/motion contract, previously undocumented (D108, 2026-07-16) |
```

- [ ] **Step 4: Bump the Context Map's own version line and date**

Change:

```markdown
> **Version:** 1.6.3 (2026-07-15 — Alpine v3 shorthand D100)
```

to:

```markdown
> **Version:** 1.6.4 (2026-07-16 — style guide doc D108)
```

Change the front-matter comment's `updated:` line from `2026-07-15` to `2026-07-16`.

- [ ] **Step 5: Run the context-map checker**

```bash
cd /Users/levi/Development/dart-analytics
bash scripts/check-context-map.sh
```

Expected: exits 0, no `FAIL:` lines. If it fails on a reference or a missing status header, fix the specific line it names before proceeding — do not skip the check.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/00-Context-Map.md
git commit -m "docs(context-map): register 07-Style-Guide.md in file inventory and context packs"
```

---

### Task 6: `DECISIONS.md` entry and final validation

**Files:**
- Modify: `DECISIONS.md`

**Interfaces:**
- Consumes: everything from Tasks 1–5 (this is the closing task).
- Produces: nothing (terminal task).

- [ ] **Step 1: Append the D108 entry**

In `DECISIONS.md`'s main decisions table, immediately after the `D107` row, insert:

```markdown
| D108 | 2026-07-16 | Canonical style guide introduced (`07-Frontend/07-Style-Guide.md`) documenting the dark-only token/primitive/typography/motion contract already implemented in `global.css`; audit fixed three `font-medium` violations (`.btn`/`.badge`/`.nav-item` → `font-semibold`), added `--color-accent-muted` (`.badge-accent` had been borrowing `success-muted`), and replaced `NavBtn.astro`'s manual class-merge with `cn()` | Token/primitive system existed only as unregistered tribal knowledge in one CSS file; writing the canonical doc surfaced concrete, fixable drift |
```

- [ ] **Step 2: Run the file-location gate**

```bash
cd /Users/levi/Development/dart-analytics
bash scripts/check-file-locations.sh
```

Expected: `OK: no stray .ts files under components/ or pages/ (excluding pages/api/).` — this plan touches no `.ts` files, so this should already pass; it's a regression guard.

- [ ] **Step 3: Re-run the context-map checker (final confirmation)**

```bash
bash scripts/check-context-map.sh
```

Expected: exits 0.

- [ ] **Step 4: Refresh the knowledge graph**

```bash
bash scripts/refresh-graph.sh
```

Expected: completes (warns instead of failing if the `graphify` CLI isn't installed in this environment — if it warns, note that explicitly in the final completion report per `app/CLAUDE.md`).

```bash
git status --short graphify-out/graph.json
```

If it shows as modified, stage it in Step 6 below.

- [ ] **Step 5: Full app validation**

```bash
cd app && npm run check && npm test
```

Expected: `astro check` — 0 errors. `npm test` (Vitest) — full suite passes; this change touches no `.ts` logic, so the pass count should be identical to the pre-change baseline.

- [ ] **Step 6: Commit**

```bash
cd /Users/levi/Development/dart-analytics
git add DECISIONS.md
git add graphify-out/graph.json 2>/dev/null || true
git commit -m "docs(decisions): log D108 style guide hardening"
```

- [ ] **Step 7: Confirm branch state**

```bash
git log --oneline main..frontend/style-guide-hardening
git status --short
```

Expected: six commits ahead of `main` (one per task's commit step, Tasks 1–6), clean working tree. Branch is ready for a PR into `main` (root `CLAUDE.md`: every task branch lands via PR promptly; do not merge directly).
