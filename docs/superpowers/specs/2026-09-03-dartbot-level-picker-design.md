# Design: DartBot level picker

> status: historical record once implemented — specs are never rewritten
> (`docs/CLAUDE.md`)

## Problem

`08-DartBot.md`'s skill model (`level`, 1–15, D-D's public knob → `SkillProfile`
via `LEVEL_SKILL_TABLE`) is wired end to end: `ParticipantInput.level` on the
wire contract, `SeatFact.dartbot.level` in the configuration snapshot,
`skillProfileForLevel()` in `skill-profile.module.ts`, and both directions of
Play Again (`participantsFromGuests`/`participantsFromSeats` in
`session-mode-resolution.ts` already thread `level` through). The one missing
piece is client-side: `addBotOpponent()` (`app/src/lib/game/guest-list.ts:38`)
hardcodes `DEFAULT_BOT_LEVEL` (8) — a deliberate phase-4 deferral ("no level
picker", per the function's own doc comment and `08-DartBot.md` §Delivery
Phases), not a bug. Every DartBot-enabled setup screen — currently Around the
Clock, Bob's 27, Doubles Training, 501 (`RULESET_DARTBOT`,
`app/src/lib/game/rulesets/capabilities.ts:112`) — shares the same
`GuestSection`/`OpponentChooserModal`/`addBot()` composition, so seats a bot
at a fixed level with no way to choose one.

D-K (auto level, mirroring the player's own fitted profile) is explicitly out
of scope — it is blocked on the D-E population-fit aggregate a human must run
against production data, and this design adds nothing toward it. This is the
manual level picker D-D always assumed would eventually exist.

## Flow

`OpponentChooserModal.astro` gains a second internal body/footer state.
Today: title "Add Opponent" + two footer buttons (Guest, DartBot); choosing
DartBot seats it immediately at level 8. New:

1. **Choice step** (unchanged): Guest / DartBot buttons.
   - Guest → falls through to the existing `GuestNameModal` flow, untouched.
   - DartBot → `showBotLevelPicker = true`, same modal swaps its body.
2. **Level step** (new): a labeled range slider, 1–15, default 8
   (`DEFAULT_BOT_LEVEL`), bound to `pendingBotLevel`. Footer: Cancel / Add
   DartBot.
   - Cancel → closes the whole chooser and resets `showBotLevelPicker` and
     `pendingBotLevel`, mirroring `GuestNameModal`'s Cancel behaviour.
   - Add DartBot → calls `addBot()`, which seats the bot at the chosen level
     and closes/resets the same state.

No post-seat editing: once seated, the bot is a pill in `GuestSection` with
only a remove (X) affordance, exactly like a guest today. Changing the level
means removing and re-adding.

## Slider presentation

Plain 1–15 integer control, no tier names or named bands — D-D closed that
question ("No ladder... because an average band cannot be claimed before D-E
fits the level curve"), and this control must not reopen it.

- **Ticks.** Four labeled marks at the real domain bounds and midpoints: 1,
  5, 10, 15. No 0 — level 0 is never a valid value. Positioned by percentage
  along the track: `(value − 1) / 14 × 100%`, so 1 → 0%, 5 → 28.57%,
  10 → 64.29%, 15 → 100%.
- **Drag tooltip.** A small floating readout above the thumb while the user
  is actively dragging, styled like `BoardMagnifier.astro`'s resolved-read
  bubble (`glass rounded-md px-2 py-1 text-center text-xs font-semibold
  text-foreground`) — reusing that visual language, not that component: the
  magnifier duplicates a zoomed board and does viewport-fixed positioning for
  a full-screen drag gesture, neither of which applies to a slider confined
  to one modal. The tooltip here is positioned `absolute` within a
  `relative`-wrapped track (same percentage formula as the ticks), shown only
  while a pointer is down on the thumb (`@pointerdown` on the input sets a
  transient dragging flag, cleared on `@pointerup.window`/
  `@touchend.window`, matching `BoardMagnifier`'s `board.active` show/hide
  pattern), and reads `Level {n}`.
- **Widget.** Native `<input type="range" min="1" max="15" step="1">` — no
  slider primitive exists in the repo yet and none of the existing form
  primitives (`Toggle`, `Input`) fit a continuous 1–15 drag. Styled with
  `accent-*` semantic tokens for the thumb/track fill only — no raw palette
  utilities, per `07-Frontend/07-Style-Guide.md`.

## State

Two new optional fields, added everywhere `GuestListContext` is currently
typed and initialized — `GuestListContext` itself
(`app/src/lib/game/types.ts:1310`), `PresetSetupContext`
(`setup-controller.ts`'s initial state object), and `FiveOhOneSetupContext`
(`five-oh-one-setup.data.ts`'s initial state object):

- `pendingBotLevel?: number` — the slider's bound value; initialized and
  reset to `DEFAULT_BOT_LEVEL`.
- `showBotLevelPicker?: boolean` — which modal body renders; initialized
  `false`.

Both stay optional for the same reason `bot`/`showOpponentChooser` already
are: only the DartBot-enabled setup screens populate them, and the
guest-only screens read them as `undefined`/falsy with no behaviour change.

## Logic changes

- **`guest-list.ts`'s `addBotOpponent(context)`**: reads
  `context.pendingBotLevel ?? DEFAULT_BOT_LEVEL` instead of the hardcoded
  constant, and additionally resets `showBotLevelPicker` and
  `pendingBotLevel` to their initial values on success, alongside its
  existing `showOpponentChooser = false`.
- **`setup-controller.ts` / `five-oh-one-setup.data.ts`**: add the two new
  initial-state fields. `addBot(this: Ctx) { addBotOpponent(this); }` bodies
  are unchanged — the function reads state off `this`, not new arguments.
- **`OpponentChooserModal.astro`**: add the level step (slider, ticks,
  tooltip, Cancel/Add-DartBot footer), gated on `showBotLevelPicker`.

No change to `guest-list.ts`'s `addTypedGuest`, to any wire type, to
`session-mode-resolution.ts`, or to `session.service.ts`'s server-side
`buildSeatPlan` fallback — all of that already reads/writes `level`
correctly; only the client never offered a way to set it to anything but the
default.

## Testing

Per D224 (`app/CLAUDE.md`), every touched runtime `.ts` file needs a
covering test:

- `app/tests/lib/game/guest-list.test.ts` — `addBotOpponent` now reads
  `pendingBotLevel` when present, falls back to `DEFAULT_BOT_LEVEL` when
  absent/undefined, and resets both new fields on success.
- `app/tests/lib/game/setup-controller.test.ts` — new initial-state fields
  present and correctly defaulted.
- `app/tests/lib/game/five-oh-one-setup.data.test.ts` — same, for the 501
  hand-rolled setup context.

`.astro` markup (the modal's slider/ticks/tooltip markup and interaction
wiring) is exempt from the unit-test requirement — no component test runner
exists in this project (D101) — verified instead by running the app and
exercising the picker on each of the four DartBot-enabled setup screens
(`/games/around-the-clock/setup`, `/games/bobs-27/setup`,
`/games/doubles-training/setup`, `/games/501/setup`).

## Non-goals

- D-K (auto level) — untouched, still blocked on the D-E population fit.
- Post-seat level editing — remove-and-re-add only, matching the existing
  guest pattern.
- Play-loop/ghost-mode wiring for Around the Clock or Doubles Training
  (phase 8, not yet shipped) — this design only affects session creation,
  which already accepts a bot seat for those rulesets today regardless of
  whether the play loop is wired.
- No change to `RULESET_DARTBOT`, `SEAT_CAPS`, or any engine module's
  gameplay rules.
