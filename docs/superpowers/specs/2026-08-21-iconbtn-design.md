# IconBtn.astro design

Status: approved · Date: 2026-08-21

## Purpose

A dedicated icon-only button primitive. Replaces the pattern of reaching for
`Button.astro`'s `icon` prop plus manual `rounded-full`/border overrides at
the call site (e.g. `AddGuestButton.astro` composes `variant="dashed" icon
class="rounded-full p-3 border-4"` today). `IconBtn.astro` bakes the
icon-only shape in: always a perfect circle, zero built-in padding, one
slot, no text.

Scope: create the new component only. Migrating existing icon-only
`Button.astro` call sites (`AddGuestButton.astro`, `GameLayout.astro`'s exit
button, `BoardInputPanel.astro`'s undo/bounce-out, `LogoutButton.astro`,
`GuestSection.astro`'s remove badge, etc.) to `IconBtn.astro` is explicitly
out of scope — a separate, larger follow-up task, owner decision.

## Location

`app/src/components/forms/IconBtn.astro`, alongside `Button.astro`.

## Props

- `type?: "button" | "submit" | "reset"` = `"button"`
- `variant?: "primary" | "secondary" | "ghost" | "error" | "dashed"` =
  `"primary"` — the same five variants `Button.astro` exposes today
- `disabled?: boolean`
- `ariaLabel: string` — **required**, not optional. `Button.astro` can fall
  back to its visible `title` text for an accessible name; `IconBtn.astro`
  never renders text, so there is no fallback and omitting it would ship an
  unlabeled control.
- `class?: string` — extra classes. This is where a caller supplies padding
  and/or an explicit size (e.g. `class="p-3 size-11"`); the component itself
  applies none.
- `[key: string]: unknown` — forwarded via `{...props}` so Alpine
  directives (`@click`, `:disabled`, `x-show`, …) keep working, matching
  `Button.astro`'s own leftover-attribute forwarding.

No `loadingExpr`/spinner, no `title`, no `iconBefore`/`iconAfter` slots —
none of that was asked for and the component has exactly one job (YAGNI).

## Slot

One default (unnamed) slot for the icon.

## Markup

```astro
<button
  type={type}
  disabled={disabled}
  aria-label={ariaLabel}
  class={className}
  {...props}
>
  <slot />
</button>
```

## Classes

```ts
const className = cn(base, variantClasses, classNameProp);
```

- `base`: `"btn flex items-center justify-center aspect-square rounded-full border-3 transition-[transform,color,background-color,border-color,box-shadow] duration-150"`.
  - No padding, no text-size classes — those are the caller's job via
    `class`.
  - `aspect-square` guarantees the button is always a true circle
    regardless of what padding class the caller passes or how large the
    inserted icon is; `rounded-full` alone is not sufficient on its own
    once width and height can differ.
  - `border-3` is the base border **width**, applied to every variant
    (not just `dashed`) — wider than `Button.astro`'s default `border`
    (1px), per explicit instruction.
- `variantClasses`: same color scheme as `Button.astro`, reusing the
  existing `.btn-primary` / `.btn-secondary` / `.btn-ghost` / `.btn-error`
  hover/active rules already defined in `global.css` (no new CSS rules
  needed) — only the Tailwind-side border/background/text classes are
  redeclared per variant:
  - `primary`: `border-transparent bg-white text-black btn-primary`
  - `secondary`: `border-border text-foreground btn-secondary`
  - `ghost`: `border-transparent text-muted-foreground btn-ghost`
  - `error`: `border-transparent bg-error text-error-foreground btn-error`
  - `dashed`: `border-accent border-dashed bg-transparent text-muted-foreground`

  (Every variant declares its own `border-{color}` explicitly, since the
  shared `border-3` in `base` only sets the width — Tailwind's `border-{color}`
  utilities are what set the color, and leaving a variant without one would
  leave the border color at its browser default.)

## Testing

Markup-only `.astro` component with no branching logic beyond variant
class lookup — exempt from unit tests per D101, same precedent as
`Button.astro` and `SinglePlayerDisplay.astro`. Verified visually via a
throwaway dev-server route (never committed) plus a Playwright screenshot,
the same method used for the split-scoreboard fixes earlier this session —
confirming all five variants render, the shape stays circular at different
caller-supplied paddings, and `disabled`/`aria-label` come through.

## Docs

New row in `docs/architecture/07-Frontend/08-Component-Inventory.md` under
`components/forms/`, next to `Button.astro`.

## Out of scope

- Migrating any existing `Button.astro icon` call site to `IconBtn.astro`.
- A `loadingExpr` spinner state.
- Text/title rendering of any kind.
