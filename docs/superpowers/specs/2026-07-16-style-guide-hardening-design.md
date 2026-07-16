# Style Guide Hardening — Design

> **Date:** 2026-07-16
> **Status:** approved (brainstorming consensus)
> **Scope:** Introduce a canonical style-guide doc (`docs/architecture/07-Frontend/07-Style-Guide.md`) codifying the dark-only, mobile-first token/primitive/typography/motion conventions the user supplied as a concept — most of which `global.css` already implements. Audit `global.css` and all five existing components against that concept; fix the violations found (font-weight, a missing accent-muted token, one manual class-merge). Register the doc in the Context Maintenance system (Context Map, Handbook Index, Frontend Agent Guide, Decisions Ledger).
> **Out of scope:** Building the not-yet-implemented portable UI kit members (toast, modal, chart) — the doc documents their *conventions in advance* but does not scaffold the files; those are separate future tasks per `04-Modules-And-OOP.md`'s existing "Portable UI Kit" section. Any change to `05-Astro-Components.md`'s frontmatter/class-composition mechanics (unaffected — this doc is additive, not a replacement). Renumbering or restructuring existing `07-Frontend/00`–`06` docs.

---

## Context

The user supplied a style-guide concept (dark-only theme, semantic tokens, primitive class contracts, typography/spacing/motion/a11y rules) and asked for it to be introduced as UI hardening. Auditing the current codebase against it found:

- `app/src/styles/global.css` already implements nearly the entire concept: the full semantic token set (`bg-*`, `fg-*`, `border-*`, `accent-*`, states, radius, motion), and every listed primitive class (`.surface`, `.surface-elevated`, `.btn` + variants, `.input`, `.badge` + variants, `.nav-item`/`-active`, `.app-shell`/`.app-main`/`.app-nav`). Dark-forced `color-scheme`, tap-highlight-off, `touch-action: manipulation`, `prefers-reduced-motion` handling, and `x-cloak` are all already present.
- No canonical doc describes any of this — it exists only as tribal knowledge inside a CSS file, unregistered in `00-Context-Map.md` and absent from the Frontend handbook (`07-Frontend/00`–`06`).
- Three concrete violations of the concept's own rules exist in that same CSS: `.btn`, `.badge`, `.nav-item` all use `font-medium`, which the concept explicitly forbids ("Avoid `font-medium` (poor cross-browser support)").
- `.badge-accent` reuses `bg-success-muted` for an accent-colored chip — visually coincidental (both map to teal in this palette) rather than semantically correct, and there's no `--color-accent-muted` token to reach for instead.
- `app/src/components/layout/NavBtn.astro` builds its class string with `.filter(Boolean).join(" ")` instead of `cn()` — an existing, already-documented anti-pattern in `05-Astro-Components.md` ("Manual `[...].filter(Boolean).join(" ")` class merge | No Tailwind conflict resolution — use `cn()`") that this audit surfaced but that predates this task.
- The other four components (`Button.astro`, `Input.astro`, `BottomNav.astro`, `LogoutButton.astro`) already comply with both the existing component-authoring doc and the new concept — no changes needed.

---

## Design

### 1. New doc: `07-Frontend/07-Style-Guide.md`

Numbered after `06-Test-Strategy.md`, before `10-Frontend-Agent-Guide.md` — next slot in the existing sequence.

**Authority split** (stated explicitly in the doc's own header, mirroring how `00-Overview.md` disambiguates itself from `01`–`05`): this doc owns the *visual contract* — which semantic tokens and primitive classes exist, and the typography/spacing/motion/a11y rules governing their use. `05-Astro-Components.md` continues to own *how* a component wires classes together (frontmatter order, `cn()`, the class-placement decision table). Neither document repeats the other; `07-Style-Guide.md` cross-references `05`'s class-placement table rather than restating it.

**Content**, adapted from the user's concept into this project's actual token/class names (already implemented, not proposed):

1. **Theme** — dark-only forced via `color-scheme: dark only` even under OS light preference; mobile-first shell (`max-w-lg`, `h-dvh`, safe-area padding); tap-highlight off, `touch-action: manipulation`. Cites the existing `@layer base` block.
2. **Tokens** — the semantic token table (backgrounds, text, borders, accent, states, radius) exactly as implemented in `@theme` in `global.css`, with the rule "never raw palette utilities (`bg-teal-500`, `text-zinc-*`)." Includes the new `--color-accent-muted` (added by §3 below).
3. **Primitives** — the class-contract table (`.surface`/`.surface-elevated`, `.btn` + variants, `.input`, `.badge` + variants, `.nav-item`/`-active`, `.app-shell`/`.app-main`/`.app-nav`), each with its one-line role and the underlying Tailwind composition, plus "implement once, reuse — do not reinvent per screen" and the `.btn:active` press-scale rule.
4. **Typography** — family-by-context table (body/description/buttons → `font-sans`; titles/tags/labels → `font-mono` OK; large numeric displays → `font-mono font-bold tabular-nums`), the case rule (no `uppercase` on body/description/button text), and the weight rule (`font-normal`/`font-semibold`/`font-bold`; never `font-medium`) — this is the rule §3 below brings the codebase into compliance with.
5. **Spacing & layout** — the padding/gap/tap-target/shell-width table from the concept, matching current usage (`min-h-11` on `.btn`/`.input`/`.nav-item`).
6. **Buttons** — variant-to-class mapping (already matches `Button.astro`'s `VARIANT_CLASS` map), `type="button"` default rule (already matches), icon-only `aria-label` rule, disabled-state utility, "no `rounded-full` on primary" (already true — `.btn` base sets `rounded-md`), and the not-yet-built modal action-row convention (cancel left / confirm right / `justify-end` / `~w-1/3` buttons) stated as forward guidance for whoever builds the modal primitive.
7. **Surfaces & nesting** — one intentional surface level per block; `.surface-elevated` for inner wells; never nest `.surface` in `.surface`.
8. **Motion** — do/don't table (transform/opacity only, no `transition: all`, `ease-out` for UI, ≤300ms, gate hover behind `@media (hover: hover) and (pointer: fine)`, respect `prefers-reduced-motion` — all already implemented) plus forward guidance for the not-yet-built modal (150–200ms opacity fade, `scale-95` entry, never `scale(0)`).
9. **Interactivity** — cross-references `03-Alpine-Patterns.md` for the mechanics (factory, `$persist`); states the UI-specific rules only: state on smallest owner, `x-cloak` for unready UI, Escape/backdrop-dismiss for future dialogs, declarative bindings.
10. **Accessibility** — icon-only `aria-label`, dialog `role`/`aria-modal`/labelling (forward guidance), semantic HTML preference, no hover-only critical affordances.
11. **Anti-patterns** — condensed table mirroring the concept's, each row naming the actual token/class this codebase uses.

### 2. Font-weight fix (`global.css`)

`font-medium` → `font-semibold` in three primitives:

| Class | Line (current) | Change |
| ----- | --------------- | ------ |
| `.btn` | `app/src/styles/global.css:122` | `font-medium` → `font-semibold` |
| `.badge` | `app/src/styles/global.css:170` | `font-medium` → `font-semibold` |
| `.nav-item` | `app/src/styles/global.css:182` | `font-medium` → `font-semibold` |

`font-semibold` (not `font-normal`) is chosen because these are emphasis contexts (buttons, chips, active-state nav labels) where the concept's weight guidance ("prefer `font-normal`, `font-semibold`, `font-bold`") still calls for visual weight — dropping to `font-normal` would flatten the button/badge/nav hierarchy the current design relies on.

### 3. New `--color-accent-muted` token (`global.css`)

Added to `@theme` alongside the existing `destructive-muted`/`success-muted`/`warning-muted` tokens, same `color-mix` pattern:

```css
--color-accent-muted: color-mix(in oklab, var(--color-teal-500) 12%, transparent);
```

`.badge-accent` changes from `bg-success-muted text-accent-300` to `bg-accent-muted text-accent-300` — the badge is accent-colored, and it should reach for the accent token, not the (currently visually-identical-by-coincidence) success token. This keeps a future rebrand of either color independent instead of accidentally coupled.

### 4. `NavBtn.astro` class-merge fix

Replace the manual `.filter(Boolean).join(" ")` with `cn()`, matching every other component in the tree (`Button.astro`, `Input.astro`):

```diff
+ import { cn } from '@client/cn';
- const className = [
-   "nav-item focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 [&_svg]:size-6",
-   active ? "nav-item-active" : "",
-   classNameProp,
- ]
-   .filter(Boolean)
-   .join(" ");
+ const className = cn(
+   "nav-item focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 [&_svg]:size-6",
+   active ? "nav-item-active" : "",
+   classNameProp,
+ );
```

Also brings the frontmatter into the documented section order (`// Props` / `// Lib` / `// Styles` headers currently missing).

### 5. No changes needed

`Button.astro`, `Input.astro`, `BottomNav.astro`, `LogoutButton.astro` — audited against every rule in the new doc (token usage, typography, `cn()` composition, `aria`/semantic HTML, surface nesting) and already compliant.

---

## Decisions Ledger

One new entry appended to `DECISIONS.md`'s main table:

- **D108** — Canonical style guide introduced (`07-Frontend/07-Style-Guide.md`) documenting the dark-only token/primitive/typography/motion contract already implemented in `global.css`; audit fixed three `font-medium` violations (`.btn`/`.badge`/`.nav-item` → `font-semibold`), added `--color-accent-muted` (was missing; `.badge-accent` had been borrowing `success-muted`), and replaced `NavBtn.astro`'s manual class-merge with `cn()`. — Rationale: the token/primitive system existed only as unregistered tribal knowledge inside one CSS file; codifying it as a canonical doc closes that gap and the audit needed to write it surfaced concrete, fixable drift.

---

## Testing

No new Vitest coverage — this is a CSS/markup styling change, not a behavior change. Per D101/`app/CLAUDE.md`, `.astro` variant/branching logic (including class composition) is verified via `astro check`, not unit tests; `NavBtn.astro`'s `cn()` swap produces the identical class output as the manual join (same three inputs, same order), so no test would exercise new behavior. Verification is: `astro check` passes, and a manual visual check in the browser (bottom nav active/inactive states, a button, a badge) confirms no visual regression from the font-weight and token changes.

---

## Context Maintenance

Per the root `CLAUDE.md` mandatory protocol:

- **`00-Context-Map.md`**: add a File Inventory row for `07-Style-Guide.md` (Foundation → API/Frontend table); add it to the "Frontend page / component work," "Frontend gameplay / session features," and "New portable UI primitive" Context Packs rows (styling rules apply to every component and are load-bearing for anyone building a new primitive); bump the Frontend docs line in "Current Implementation State"; version bump to 1.6.4, dated 2026-07-16.
- **`07-Frontend/00-Overview.md`**: add `07-Style-Guide.md` row to the Handbook Index table and Related Documents.
- **`07-Frontend/10-Frontend-Agent-Guide.md`**: add to the Load Packs table ("Page / component work" row); add Related Documents row; add one line under Non-Negotiable Rules (new §12 "Styling") pointing at the doc and stating the two headline rules (semantic tokens only, never raw palette; no `font-medium`).
- **`DECISIONS.md`**: D108 as above.
- `scripts/check-context-map.sh` and `scripts/check-file-locations.sh` must both pass.
- `bash scripts/refresh-graph.sh`, stage `graphify-out/graph.json`.
- New branch `frontend/style-guide-hardening`, checked out directly (no worktree per root `CLAUDE.md`); PR to `main` at completion.
