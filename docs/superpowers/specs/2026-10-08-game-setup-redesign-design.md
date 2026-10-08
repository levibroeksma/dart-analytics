# Game setup redesign — design

**Date:** 2026-10-08 · **Status:** approved · **Branch:** `feat/game-setup-redesign` · **Decision:** D430 (`decisions/frontend/style.md`)

Source design: Claude Design project `cdea52ee-4746-4efb-b646-81448a40c033`,
`Game Setup.dc.html`:
- setup screens `s-501`, `s-121`, `s-atc`, `s-bobs`, `s-doubles`, `s-score`, `s-shanghai`, `s-singles`, `s-tuod`
- slider `6a`
- slide-to-start `4d`/`4e`

## Goal

Restyle every game setup page (`app/src/pages/games/*/setup/`) to match the design.

- The shared shell and section components change once, so all 11 setup pages inherit it. That includes Cricket and Tactics, which are not in the design.
- Three new portable primitives replace the free numeric inputs and the Start button.
- Setup data factories, `setup-controller.ts` and every `start()` stay unchanged. This is a markup and style pass.

## Scope

**In:**
- The shared setup components: `SetupShell`, `UserSection`, the avatars, `AddGuestButton`, `InfoSection`, `SettingSectionShell`.
- Restyling `Toggle` and `Switch`.
- A new `SettingLabel`.
- New `Stepper`, `RangeSlider` and `SlideToStart`.
- The markup of all 9 designed setup forms.
- The tokens the design needs.
- Docs and the decision.

**Out:**
- Any domain, config or API change.
- 501 "Best of" and "Sets" behaviour: the controls render locked (static), and the behaviour is tracked as discovered work.
- Moving the inline DartBot level slider in `OpponentChooserModal` onto `RangeSlider`: discovered work.
- `BaseLayout` background and `BottomNav`: both already match the design.

**Icons:** no new files.

- **Reused:** `@icons/chevron-down.svg` (back, stepper, rules chevron), `@icons/plus.svg` and `@icons/play-rounded.svg`.
- **Colour:** all three use `currentColor`, so the design's `-white`, `-muted` and `-accent` variants are text-colour classes, not files.
- **Background:** `bg-dartboard.svg` is already used by `BaseLayout`.

## Units

### 1. `SetupShell.astro`

- **Header:** a 3-column grid (40px / 1fr / 40px).
  - Back: a 40px round glass button (`glass-button`), `chevron-down` rotated 90°, `text-muted-foreground`, `aria-label="Back to games"`, linking to `/games`.
  - Title: `font-display` 18px, white, centred. It replaces the `h2.text-accent`.
- **Body:** the cards stack with a 12px gap. Bottom padding clears the fixed start bar (≈190px, per the design).
- **Start:** the `Button type="submit"` is replaced by `SlideToStart`, which sits inside the `<form>`.
  - It is fixed at `bottom` just above `BottomNav` (design: 104px from the bottom), inset 16px.
  - A full-width fade to black sits behind it: 200px high, `pointer-events:none`.
  - `ErrorAlert` stays in the flow above the cards' end.
  - It is disabled while `loading || loadingReconciliation`.

### 2. Players — `UserSection`, `UserIconDisplay`, `GuestSection`, `AddGuestButton`

- **Card:** the `glass` card (radius 20px, padding 16px).
  - Header row: "Players" in `font-display` 13px on the left; on the right, the mono caps count `N PLAYER` / `N PLAYERS`, derived from the seated user + guests + bot.
- **Avatars:** 52px circles with the selected-pill gradient, Michroma initials and a 12px semibold name below. The row gap is 18px. Guest and bot remove behaviour is unchanged.
- **Add:** a 52px dashed circle (1.5px, white/35) holding `plus`, with the muted 12px label "Add opponent". It opens the same `OpponentChooserModal` / `GuestNameModal` flow.

### 3. Rules — `InfoSection.astro`

- **Card:** accent-tinted (accent/8 background, accent/45 top border, accent/25 bottom border), radius 20px, padding 14px 16px.
- **Title row:** the title in accent-light at 13px semibold, with `chevron-down` (18px) on the right. The info icon is dropped.
- **Collapsed:** the description shows as a 2-line clamp, muted 12px, line-height 1.55. It is no longer hidden or italic.
- **Expanded:** a tap toggles to the full text and the chevron rotates 180°. The `x-collapse` animation is kept.
- **New prop `open?: boolean`:** always expanded, no chevron, not a button. Used by Bob's 27, Cricket and Tactics, which have no settings.

### 4. Settings — `SettingSectionShell.astro` and new `SettingLabel.astro`

- **`SettingSectionShell`:** a `glass` card with the heading "Settings" in `font-display` 13px and a 16px gap between fields.
- **`SettingLabel`:** the field label in mono 10px semibold caps, letter-spacing .12em, `text-muted-foreground`.
  - Props: `text` and `badge?: string`.
  - The badge is a mono 9px chip in accent-light on accent/15, radius 6px. The forms use it as `ANALYTICS`.
- **Hints:** muted 12px under the control.

### 5. `Toggle.astro` (restyle only)

- **Track:** the inset well (black/35 with an inset shadow), padding 4px, gap 4px.
  - Horizontal: the track is a full pill.
  - Vertical: the track has radius 26px.
- **Options:** 40px high (44px when vertical), 13px semibold.
  - Unselected: muted-70.
  - Selected: the gradient pill (the same gradient as the avatar) with an inset highlight and a faint accent glow.
- **New `disabled` per option:** an optional `disabled?: boolean` in `options`. A disabled option is dimmed, cannot be clicked, and carries `aria-disabled`. It is used for 501's Best of and Sets.
- The props, `x-modelable` and the pill animation are unchanged.

### 6. `Switch.astro` (restyle only)

- **Size:** 38×22, with an 18px white knob.
- **Colour:** accent when on, white/12 when off.
- **Label:** 14px semibold. The optional `hint` renders as muted 12px under the label (ATC "Odds first").

### 7. New `Stepper.astro` + `app/src/lib/ui/stepper.data.ts`

- **Look:** a vertical glass capsule, 64px wide.
  - Top: an up button (`chevron-down` rotated 180°, 44×32).
  - Middle: the value in mono 32px.
  - Bottom: a down button.
- **API:** props `min`, `max`, `ariaLabel`. The value is bound with `x-model` through `x-modelable="value"`.
- **Accessibility:**
  - The value element has `role="spinbutton"` with `aria-valuemin`, `aria-valuemax` and `aria-valuenow`.
  - Arrow Up/Down step the value.
  - Each button is disabled at its bound.
- **Pure helpers:** `stepValue(value, delta, min, max)` clamps and coerces a non-numeric value to `min`.

### 8. New `RangeSlider.astro` + `app/src/lib/ui/range-slider.data.ts`

- **Input:** a native `input[type=range]` (opacity 0, full hit area) drives everything. Keyboard, a11y and touch come with it.
  - Props: `min`, `max`, `step=1`, `label` (rendered through `SettingLabel`), `hint?`, `ariaLabel`.
  - The value is bound with `x-model` through `x-modelable="value"`.
- **Visuals (design 6a):**
  - Track: an 8px inset well, inset 12px each side.
  - Fill: a gradient from accent/30 to accent.
  - Thumb: a white 36×22 capsule with an accent/35 ring.
  - Value bubble: above the thumb, tinted accent glass, mono 14px.
  - Ticks: minor ticks below, with a major tick every 5th.
  - Labels: min and max in mono 11px, muted.
- **Pure helpers:**
  - `valueToFraction(value, min, max)`, which gives the thumb, bubble and fill position as `calc(12px + (100% - 24px) * f)`.
  - `tickFractions(min, max, count)`, which returns `{ fraction, major }[]`. Ticks are capped at about 25, so 1–100 stays readable.
- **Bounds come from the domain** (user decision), never from the design's 5–30. Each form passes bounds from its `*-duration.ts` helper:

  | Form | Rounds | Minutes |
  |---|---|---|
  | 121 | 1–50 | 3–30 |
  | Score training / TUOD | 1–100 | 3–30 |
  | ATC | — | 3–30 |

  The forms read the bounds from `oneTwentyOneDurationBounds`, `scoreTrainingDurationBounds`, `tuodDurationBounds` and `aroundTheClockDurationBounds`, so nothing is duplicated. The 501 `Stepper` reads `FIVE_OH_ONE_LEGS_MIN` and `FIVE_OH_ONE_LEGS_MAX`; the latter must be exported from `five-oh-one-legs.ts`, an adjacent edit that changes no value.

### 9. New `SlideToStart.astro` + `app/src/lib/ui/slide-to-start.data.ts`

- **Look (design 4d/4e):**
  - Track: a 60px glass pill with "Slide to start" (14px semibold, muted-82) centred.
  - Thumb: a 50px accent-gradient circle at `left:5px` holding `play-rounded` (white, 20px), with an accent glow.
  - While dragging (4e): an accent gradient fill trails the thumb, and the thumb scales to 1.06 with a stronger glow.
- **Behaviour:**
  - Pointer events with pointer capture move the thumb along the track.
  - Releasing at or past 85% of the travel calls `$el.closest('form').requestSubmit()`, and the thumb stays at the end.
  - Releasing earlier snaps the thumb back with a 200ms ease.
  - A tap alone does nothing.
- **Keyboard:** the root has `role="button"`, `tabindex=0` and `aria-label="Slide to start game"`. Enter or Space submits.
- **Props:** `disabledExpr` (an Alpine expression; while true it sets `aria-disabled`, dims, and ignores input) and `label` (default "Slide to start").
- **Reset:** if submit returns with an error (the `start()` failure path), the thumb resets when `loading` turns false.
- **Reduced motion:** under `prefers-reduced-motion`, the snap is instant and the glow is static.
- **Pure helpers:** `dragFraction(dx, travel)`, clamped to 0–1, and `shouldFire(fraction)` with `SLIDE_THRESHOLD = 0.85`.

## Per-form mapping

Data factories are untouched. Only markup changes, plus removal of the clamp notices the primitives make unreachable. The `*-duration.ts` / `five-oh-one-legs.ts` clamps stay as the guard inside `start()`.

| Form | Settings card |
|---|---|
| 501 | `STARTING SCORE`: Toggle 301 / 501 / 701 / Custom. Custom still reveals the existing `Input`, and its clamp notice stays.<br>`MATCH FORMAT`: a grid `1fr 72px 1fr` holding a vertical Toggle First to / Best of (Best of disabled), a `Stepper` bound to `legsToWin` (1–20), and a vertical Toggle Legs / Sets (Sets disabled). The legs clamp notice is removed.<br>Checkout `Switch`. |
| 121 | Solo: `FORMAT` Toggle 170 / Rounds / Time. A `RangeSlider` follows unless 170 is picked: `ROUNDS` 1–50 or `MINUTES` 3–30, with the hint "Rounds and Time are solo only — with a guest or bot, check out 170 to win."<br>Guest or bot: the existing muted note, as today.<br>Checkout `Switch`. |
| Around the Clock | `DIRECTION` Toggle Low → High / High → Low.<br>`Switch` "Odds first", hint "Play every odd number before the evens".<br>`DIFFICULTY` Toggle ×4.<br>`SEGMENT` with the `ANALYTICS` badge (ANALYTICS mode only, as today).<br>Solo: `DURATION` Toggle Untimed / Timed, then a `RangeSlider` `MINUTES` 3–30 with the hint "3–30 minutes. Solo only."<br>The bot-hides-all rule is unchanged. |
| Score training | Solo: `FORMAT` Toggle Rounds / Time, plus a `RangeSlider` (`ROUNDS` 1–100 or `MINUTES` 3–30) with the hint "Time is solo only — with a guest or bot, play by rounds."<br>Guest or bot: a `ROUNDS` `RangeSlider` 1–100. |
| Ten Up One Down | As Score training, plus the checkout `Switch`. |
| Doubles training | `TARGET ORDER` Toggle Low → High / High → Low / Random. |
| Shanghai | `DIFFICULTY` Toggle Normal / Hard, with the Hard hint under it ("Just like normal, but miss a target completely and your score is halved."). |
| Singles training | `TARGET ORDER` Toggle ×3, `DIFFICULTY` Toggle Easy / Hard / Extreme, and `SCORING` with the `ANALYTICS` badge (ANALYTICS mode only). |
| Bob's 27, Cricket, Tactics | Players plus `InfoSection open`. No Settings card. |

## Styling

- Existing glass utilities and tokens come first: `glass`, `glass-button`, `glass-info`, `inset-well` and the accent family.
- Values no token covers go into `app/src/styles/global.css` as tokens or `@layer components` classes:
  - the selected-pill gradient
  - the accent-tinted rules card
  - the slider thumb ring
  - the slide-to-start thumb gradient and glow
  - the start-bar fade

  Components use no raw oklch and no palette utilities.
- Typography follows the Style Guide: Michroma for titles and values, `font-mono` only for labels, counts and numeric values, and never `font-medium`.

## Testing

TDD, red → green → refactor, per `app/CLAUDE.md`.

- `app/tests/lib/ui/stepper.data.test.ts`:
  - clamps at min and max
  - coerces a non-numeric value to min
  - ArrowUp and ArrowDown step the value
- `app/tests/lib/ui/range-slider.data.test.ts`:
  - `valueToFraction` at min, mid and max, and out of range
  - `tickFractions` count cap and major ticks
- `app/tests/lib/ui/slide-to-start.data.test.ts`:
  - `dragFraction` clamps
  - `shouldFire` at 0.84 and 0.85
  - releasing below the threshold resets to 0
  - firing calls `requestSubmit` once
  - a disabled control ignores input
  - Enter and Space submit
- Existing setup data tests stay green unchanged. If one fails, the markup broke a contract, not the test.
- Markup is not unit-tested (D101). It is verified by:
  - `npm run validate:app`
  - `scripts/check-astro-conventions.sh`
  - a visual pass at 390px on all 11 setup pages, against the design screens, in solo, guest and bot states

## Docs and discovered work

- **Component Inventory** (`07-Frontend/08-Component-Inventory.md`):
  - add `Stepper`, `RangeSlider`, `SlideToStart` and `SettingLabel`
  - update `SetupShell`, `InfoSection` (the `open` prop), `Toggle` (disabled options) and `Switch`
- **Style Guide** (`07-Frontend/07-Style-Guide.md`): the new tokens and classes.
- **Decision D430:** setup controls are bounded primitives, never free numeric inputs. Slider bounds come from the domain clamp helpers. Start is a slide gesture with a keyboard path.
- **Discovered-work issues:**
  1. 501 "Best of" match format.
  2. 501 "Sets".
  3. Move the DartBot level slider onto `RangeSlider`.
- Run the `context-maintenance` skill before completion.
