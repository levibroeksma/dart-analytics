# Brand tokens — design

Date: 2026-10-08 · Branch: `feat/brand-tokens` · Source: claude.ai/design project `cdea52ee-…`, `Brand Style.dc.html`

## Goal

Align `app/src/styles/global.css` tokens with the Brand Style reference so later, phased UI work can compose screens from tokens alone. Visual shift now is accepted. No component restyling in this task.

## Decisions taken (user, 2026-10-08)

- Coral `oklch(68% 0.15 30)` replaces red as the error hue; `--missed` aliases it.
- Weight 500 (`font-medium`) is allowed; supersedes the style-guide ban.
- Keep current semantic names (`accent`, `muted`, …); retune values, add new tokens in the same style. No rename.

## Mapping

Already match (no change): `--surface` (ground), `--foreground` (ink), `--muted` 55% (body), `--muted-foreground` 70% (caption), `--accent` (sky), `--accent-bright` (sky light), `--border` 8% (hairline), `--success`, `glass-button` (raised glass), `.home-feature-card` (blue glass hero), radii 12/16/20 (`rounded-lg/xl/2xl`).

Skipped: Canvas `#0b0c0f` — docs-only backdrop, not app UI.

### Colour (`:root` + `@theme inline`)

| Token | Value | Use |
| ----- | ----- | --- |
| `--error` | `oklch(68% 0.15 30)` | retuned: coral |
| `--error-hover` | `oklch(63% 0.15 30)` | retuned |
| `--error-muted` | `oklch(68% 0.15 30 / 0.12)` | retuned |
| `--error-foreground` | `oklch(96% 0.01 30)` | retuned |
| `--missed` | `var(--error)` | new; missed session |
| `--placeholder` | `oklch(48% 0 0)` | new; empty-field text |
| `--accent-deep-blue` | `oklch(44.3% 0.11 240.79)` | new; chart bars, vignette (`body::after` reads it) |
| `--scrim` | `oklch(0% 0 0 / 0.6)` | new; modal backdrop |
| `--gradient-blue-glass` | `linear-gradient(138deg, oklch(47% 0.13 238 / 0.95) 22%, oklch(18% 0.06 245 / 0.95) 82%)` | new; `.accent-orb` and `glass-blue` read it |

Each colour gets a `--color-*` mapping in `@theme inline` (gradient as `--background-image-blue-glass`).

### Type scale (`@theme`)

| Token | Size | Line-height | Tracking |
| ----- | ---- | ----------- | -------- |
| `--text-hero` | 4.5rem (72) | 1 | -0.02em |
| `--text-title` | 1.625rem (26) | 1.2 | 0.02em |
| `--text-value` | 1.875rem (30) | 1 | 0 |
| `--text-tile` | 1.25rem (20) | 1.2 | 0 |
| `--text-card-title` | 0.8125rem (13) | 1.3 | 0.06em |
| `--text-button` | 0.9375rem (15) | 1.3 | 0 |
| `--text-eyebrow` | 0.625rem (10) | 1.2 | 0.12em |
| `--text-eyebrow-lg` | 0.75rem (12) | 1.2 | 0.14em |

Body 14 and caption 12 stay `text-sm` / `text-xs`. Families unchanged. Weights: display 400; sans 400/500/600/700; mono 500/600.

### Radius & spacing (`@theme`)

`--radius-row` 0.875rem (14, select rows) · `--radius-key` 1.375rem (22, keypad keys) · `--radius-switch` 1.625rem (26, vertical switch) · `--radius-board` 1.75rem (28, board container) · `--radius-sheet` 2rem (32, bottom sheets) · `--spacing-hit` 2.75rem (44, min hit target → `size-hit`).

### Surface utilities

| Utility | Contract |
| ------- | -------- |
| `glass` | retuned: drop `shadow-sm`; white 5→10% radial, `border-y` white 25%, blur 8px |
| `glass-blue` | new; `--gradient-blue-glass` + inset highlight + 12% accent glow (current `.accent-orb` look); selected pills, avatar |
| `glass-info` | new; accent 8% fill, top edge accent 45%, bottom 25%, blur 8px; rules/info cards |
| `inset-well` | new; black 35%, `inset 0 1px 2px` black 40%, blur 8px; tracks, fields |
| `inset-well-muted` | new; black 20%, `inset 0 1px 2px` black 30%; undo/delete keys, exit button |
| `glass-sheet` | new; glass fill, `border-y` 25%, blur 16px, `rounded-sheet`, `0 24px 60px` black 50%; bottom sheets |

`.field-inset` keeps its focus behaviour and applies `inset-well` for its rest state. `.accent-orb` reads `--gradient-blue-glass`.

## Assets

No new files. Design `icons/nav/<name>-<accent|white|muted>.svg` are colour variants of existing `currentColor` icons in `app/src/icons/`; colour comes from token text classes. `app/src/dartboard.png` → existing `app/src/assets/dartboard.svg`. `bg-dartboard.svg`, `logo-lockup.svg` already exist.

## Docs

- `docs/architecture/07-Frontend/07-Style-Guide.md`: token table rows, new type-scale + radius rows, surfaces table, typography weight rule, anti-pattern row for `font-medium` removed; version bump.
- `decisions/frontend/…`: one new decision (D428) — Brand Style as token source; coral = error; weight 500 allowed (supersedes the `font-medium` ban).
- `scripts/check-style-tokens.sh`: drop the `font-medium` ban (gate change follows the decision).
- Context maintenance per skill.

## Verification

No unit tests for CSS. Gates: `scripts/check-style-tokens.sh`, `npm run check` (astro check), `npm run build`, `validate-app` sequence, then visual check of Home, Profile, a play screen.

## Out of scope

Restyling components to use the new tokens; nav icon behaviour; Canvas colour.
