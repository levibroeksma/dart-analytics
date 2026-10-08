# Login redesign — design

**Date:** 2026-10-08 · **Status:** approved · **Branch:** `feat/login-redesign` · **Decision:** D431 (`decisions/frontend/style.md`, written at implementation)

Source design: Claude Design project `cdea52ee-4746-4efb-b646-81448a40c033`,
`Login.dc.html`, screens `login` (default), `login-focus`, `login-error`.

Spec 1 of 3 in the restyle. Game play and statistics each get their own spec, plan and PR.

## Goal

Restyle `app/src/pages/login/index.astro` to match the design. This is a markup and style pass only. `lib/auth/login.data.ts` does not change.

## Scope

**In:**
- the markup of the login page
- one new token (`--shadow-card`)
- one new component class (`.field-inset-error`)
- docs and the decision

**Out:**
- any change to auth, login data or the API
- the `Input.astro` API (its existing `class` prop is enough)

**Icons and assets:** no new files. `@assets/logo-lockup.svg` and `bg-dartboard.svg` are already in the repo.

## Layout

- **Background:** `BaseLayout backdrop="home"`, which puts the board top-right with the left-edge shade, as on the home page. Today the login page uses the default backdrop.
- **Container:** the existing column, `max-w-lg` and vertically centred. Padding becomes 16px on the sides, matching the design.

## Card

- **Surface:** `glass`, with `rounded-board` (28px), padding `28px 20px 20px` and a `gap-2` (8px) column.
- **Shadow:** a new token, `--shadow-card: 0 24px 60px oklch(0% 0 0 / 0.4)`, exposed as `shadow-card`.
- **Removed:** `rounded-lg border border-border bg-surface-raised`, the `space-y-12` spacing and `max-w-md`.

## Logo

The existing `LogoLockup` import, sized 230×80 (`w-[230px] h-20`) and centred. Its `role="img"` and `aria-label="Darts Analytics"` stay.

## Form

- **Shell:** the `<form>` is a column with `gap-2`. It keeps `x-data="loginForm()"` and `@submit.prevent="submit"`.
- **Labels:** each field is a `<label for>` that wraps an eyebrow `<span>` and the `Input`, in a column with `gap-2`.
  - **Eyebrow:** `EMAIL` / `PASSWORD` as `px-0.5 font-mono font-semibold uppercase text-eyebrow text-muted-foreground`.
  - **Focus:** while the field inside has focus, the eyebrow turns `text-accent-bright` (via `has-[:focus]:` on the label).
- **Ids:** `login-email` and `login-password`, each matching its label's `for`. Rewriting the markup this way also fixes today's mismatched `for="e-mail"`.
- **Fields:** `Input` with classes composed through `cn()` in frontmatter:
  - the `field-inset` surface: inset well, with the accent focus ring and 3px halo that already exist
  - `h-13` (52px), `rounded-xl` (16px), `px-4`, `border-0`, `text-[15px] font-medium`
  - placeholders `example@email.com` and `••••••••`
- **Error rings:** new `.field-inset-error` in `@layer components`:
  `box-shadow: inset 0 1px 2px oklch(0% 0 0 / 0.4), inset 0 0 0 1px var(--error)`.
  - Both fields bind `:class="error && 'field-inset-error'"`, so the rings show for **any** error, matching the error text (user decision).
  - Under focus, the existing accent focus ring wins.
- **Error text:** `<p role="alert" x-show x-cloak x-text="error">` styled `-mt-2 px-0.5 text-[13px] font-medium italic text-error`. The message stays dynamic from `getErrorMessage`.
- **Submit:** `Button type="submit" variant="sheet-raised"`, which is raised glass, 52px and `text-button`. It is overridden to `rounded-xl` with `w-full mt-2`. The title is "Sign in", and it gets `:disabled="loading"`.

## Styling rules

- Semantic tokens and primitives only: no raw oklch in markup, no palette utilities.
- `font-mono` only on the eyebrows. The button and body text use `font-sans`.
- Weights are `font-medium` (the field text) and `font-semibold` (the eyebrows and button), per D428.

## Testing

- Markup only, with no branching logic in frontmatter, so no new unit test (D101). `login.data.ts` tests stay green and unchanged.
- Verified by:
  - `npm run validate:app` (fallow, tests, `astro check`)
  - `bash scripts/check-astro-conventions.sh`, `scripts/check-style-tokens.sh` and `scripts/check-astro-class-composition.sh`
  - `npm run format:check`
  - a visual check of the default, focus and error states against the design at 390×844

## Docs

- `07-Frontend/07-Style-Guide.md`: add the `shadow-card` token and the `.field-inset-error` primitive row.
- `07-Frontend/08-Component-Inventory.md`: no new component, so no change unless the login page entry describes its styling.
- `decisions/frontend/style.md`: D431, the login restyle to the design: home backdrop, inset fields, raised submit, error rings on any error.

## Discovered work (GitHub issues, not fixed here)

- `BaseLayout.astro` loads the Inter font, which no token or class uses.
