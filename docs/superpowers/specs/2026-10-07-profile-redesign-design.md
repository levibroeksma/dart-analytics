# Profile redesign (static pass) — design

**Date:** 2026-10-07 · **Status:** implemented · **Branch:** `feat/profile-redesign` · **Decision:** D426 (`decisions/frontend/style.md`)

Source design: Claude Design project `cdea52ee-4746-4efb-b646-81448a40c033`,
`Profile.dc.html`, frames `profile` (view) and `profile-edit` (display
name open, input focused).

## Goal

Restyle `app/src/pages/profile/index.astro` to match the design pixel for
pixel at 390px. Existing behaviour is kept. The stats line under the name
shows fixture values; a later data pass swaps them without touching
markup. Shared design primitives land in `global.css` so later phases
reuse them; other pages picking up changed tokens is accepted.

## Scope

- In: profile page, `SettingRow`, `PlayerSettingsCard`, `HandednessForm`,
  `AppModeForm`, `LogoutButton` restyle, new `ProfileIdentity`, a
  `profileSnapshot()` fixture factory, the tokens/classes the design needs.
- Out: real stats (API/view work), `BottomNav`, any API or schema change.

## Behaviour kept

- `$store.profile` load/save; `SettingRow` commit rules (no-op when
  unchanged, required-empty reverts) and save on blur/Enter.
- Handedness stays a local `$persist` in `$store.boardInput`.
- App mode saves via `$store.settings.save(capture, input)`; the
  Quick-score-holds-tab-stop fallback stays.
- Both pickers stay roving-tabindex `radiogroup`s with `aria-checked`.
- Loading skeleton and `ErrorAlert`s stay.

## Units

### 1. `profileSnapshot()` — fixture factory

- `app/src/lib/profile/profile-snapshot.data.ts`, registered with the
  other route data factories (`register-route-data.ts`).
- Returns `{ games: 412, darts: 18342, minutes: 3680 }` and `statsLine`
  built by pure exported `formatStatsLine({ games, darts, minutes })` →
  `412 games · 18,342 darts · 61h 20m` (`en-US` grouping; `Xh Ym`).
- Pure exported `initials(name)`: first letter of the first two
  whitespace-separated words, upper-case; one word → one letter
  (`Levi` → `L`, `Levi Broeksma` → `LB`); blank → `""`. The design's
  `LB` assumes a full name; only the display name exists.
- No fetch. The data pass replaces the constant; the shape is the
  contract.

### 2. Page composition

`profile/index.astro` (still `prerender = true`), `AppLayout`
`backdrop="home"`:

- Wrapper: `flex flex-col gap-3 px-4 pt-2`, as home (the frame's 58px
  top pad is its 54px fake status bar + 4px; the app shell owns the
  safe area).
- Header row: `px-1 pt-5 pb-3`, flex between: "Profile" (Michroma 26px,
  `tracking-[0.02em]`, regular) and `LogoutButton`.
- `ProfileIdentity`, `PlayerSettingsCard`, `AppModeForm`.

### 3. Components

| Component | Design |
| --------- | ------ |
| `LogoutButton` | 44px round `glass-button`, 20px white logout icon, `aria-label="Log out"` |
| `ProfileIdentity` (new, `components/layout/profile/`) | `px-1 pt-1 pb-2`, gap 14px. 56px `accent-orb` avatar with initials (Michroma 18px) from `$store.profile.displayName`; name (Michroma 18px) + stats line (Montserrat 500 13px, `oklch(86% 0 0)`) from `profileSnapshot()` |
| `PlayerSettingsCard` | `profile-card`: title "Player settings" (Michroma 13px, `.06em`), rows gap 16px; no dividers |
| `SettingRow` | Column gap 8px: eyebrow label; view = `field-inset` button (value Montserrat 500 15px, truncate; 16px muted pencil), whole field opens edit; edit = `field-inset` input with focus ring, label turns accent, hint `n / max · saves when you leave the field` (Montserrat 12px, `oklch(55% 0 0)`) when `maxlength` given. Display name `maxlength=24`. Weight view shows `23 g` |
| `HandednessForm` | eyebrow "HANDED" + `segmented` Right/Left |
| `AppModeForm` | `profile-card`: title "App mode" + body copy (Montserrat 12px/1.5, `oklch(55% 0 0)`) gap 8px; eyebrow "MODE" + `segmented` Quick score/Analytics. Checkmarks removed (state = fill + text colour, plus `aria-checked`) |

### 4. Tokens and classes (`global.css`)

- `--background-image-accent-orb`:
  `linear-gradient(138deg, oklch(47% 0.13 238 / 0.95) 22%, oklch(18% 0.06 245 / 0.95) 82%)`.
- `.accent-orb`: that gradient + `inset 0 1px 0 white/10`,
  `0 0 20px 3px accent/12`, `inset 0 0 0 1px white/6`. Avatar adds
  `0 0 40px 20px accent/8`.
- `.profile-card`: 20px radius, 16px pad, flex column gap 16px; radial
  `white/5 → white/10 85%`, `border-y white/25`, blur 8px, no shadow
  (the existing `glass` adds `shadow-sm`; the design has none).
- `.field-inset`: 52px h, 16px radius, `0 16px` pad, `black/35` bg,
  `inset 0 1px 2px black/40`, blur 8px. `:focus-visible`/focus adds
  `inset 0 0 0 1px accent` and `0 0 0 3px accent/25`; caret accent.
- `.segmented` (pill, 2 equal columns, 4px pad/gap, inset bg like
  `.field-inset`) and `.segmented-option` (40px pill, Montserrat 600
  13px, `oklch(70% 0 0)`); on state uses `.accent-orb` and white text.
- `.eyebrow-label`: JetBrains Mono 600 10px, `.12em`, `oklch(70% 0 0)`,
  `px-0.5`; accent variant `oklch(80% 0.13 237)`.
- Raw oklch lives only in `global.css`, never in components.

### 5. Icons

Existing `logout.svg` and `pencil.svg` (`currentColor`) are used with
text classes; the design's `logout-white`/`pencil-muted` are compared
shape-for-shape first. If they differ, the design path replaces the
existing icon (C2PA metadata stripped, `currentColor`).

## Testing

- `app/tests/lib/profile/profile-snapshot.data.test.ts`:
  `formatStatsLine` (grouping, `h`/`m`, zero minutes), `initials` (one
  word, two words, extra spaces, empty), snapshot shape.
- Markup verified by `npm run validate:app`,
  `scripts/check-astro-conventions.sh`, and a visual check of the
  running app at 390px against both frames.

## Docs

- Component Inventory (`07-Frontend/08-Component-Inventory.md`): add
  `ProfileIdentity`, update the five restyled rows.
- D426 in `decisions/frontend/style.md`: profile static fixture seam and
  the shared field/segmented/card primitives.
- Context-maintenance skill run before completion.

## Implementation notes (2026-10-07)

- `.profile-card` and `.eyebrow-label` were not added: cards use `glass shadow-none rounded-2xl p-4`, eyebrows use utilities.
- Weight-500 text renders at 400 (`font-medium` is banned repo-wide).
- `LogoutButton` keeps its spinner while signing out.
