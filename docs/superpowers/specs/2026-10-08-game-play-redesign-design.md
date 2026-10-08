# Game play redesign — design

**Date:** 2026-10-08 · **Status:** approved · **Branch:** `feat/game-play-redesign` · **Decision:** D432 (`decisions/frontend/style.md`; D431 is reserved by the open login PR #836, so renumber with `scripts/renumber-decision.sh` if that changes)

Source design: Claude Design project `cdea52ee-4746-4efb-b646-81448a40c033`:
- `Game Play Recreational.dc.html`: screens `p-501` … `p-tactics`
- `Game Play Analytics.dc.html`: screens `b-*`, the `b-501-press` press state, and turn `8a`

This is spec 2 of 3 (login → game play → statistics).

## Goal

Restyle every game play screen (`app/src/pages/games/*/play/`) to match the design, in both Recreational (tap and keypad input) and Analytics (visual board) mode.

- The shared shells and input panels change in place, so all 11 games inherit the result.
- Each play data factory gains a tested `subtitle()` plus the few getters the design needs.
- No engine, config or API change.

## Decisions taken in brainstorming (user)

1. **Keypad in Analytics mode:** none. D201 already shows the board alone in visual sessions. The Style Guide line that says otherwise is stale (#837).
2. **Magnifier:** it keeps following the finger, with the existing placement rules. Only its look changes: the read moves *inside* the circle as a pill, which supersedes D204's above-the-circle label.
3. **Board:** the existing SVG `DartBoard.astro`. The design's `dartboard.png` is not imported.
4. **Multi-seat:** every game with a second seat uses the stacked layout, an active card above an idle row.
5. **Timer:** a pill on the right of the header. The paused state keeps `CountdownResumePrompt`, restyled.
6. **Cricket and Tactics ring:** an S key that clears D/T. S lights up when neither D nor T is on. No new ring state.
7. **Values:** the design's numbers and labels are samples. Every subtitle and stat comes from engine or config data, using the existing setup wording (Shanghai "OF 20", Doubles "LOW → HIGH").
8. **Tactics:** the 14…1 targets stay available once D or T is armed.
9. **Training:** routine exercise panels, routine play and Quick Subtract inherit the shared restyle. Their gaps are filed as discovered work, not fixed here.
10. **Leg bars:** one bar per leg to win, up to 5. Above 5, a mono `won/target` counter replaces the bars.

## Scope

**In:**
- `GameLayout` header
- `SinglePlayerDisplay`, `SplitScoreboard`, `SplitScoreboardHalf`
- `VisitPreview`
- `InputButton`, `ScoreInput`, `SinglesRecreationalInput`, `DoublesPathRecreationalInput`, `CricketRecreationalInput`, `TacticsRecreationalInput`
- `BoardInputPanel`, `BoardMagnifier`
- `CountdownPauseControl`, `CountdownResumePrompt`
- the 11 `interfaces/<Game>.astro` files, the play pages' title props, and the play data factories (new getters only)
- tokens and utilities, docs, and the decision

**Out:**
- results modals, `CheckoutConfirm`, `ExitModal` (already sheets, D429), `NoSessionPanel`, `ReconciliationBlocked`
- any engine, ruleset, config or API change
- the training-only components (`ExerciseBoardInputPanel` and the panels): they inherit only through shared parts

**Icons:** no new files. `exit`, `pause`, `undo`, `delete`, `check` and `cross` come from `@icons/*` through `currentColor`.

## Units

### 1. `GameLayout.astro`: header

- **Bar:** a 56px `glass` pill (`rounded-full`) with 6px inner padding and a row of `gap-2`. The play area below it has padding `6px 16px 30px` and a column with `gap-2`.
- **Left:** exit, a 44px round `inset-well-muted` button holding `exit.svg` at 18px in `text-muted-foreground`, with `aria-label="Exit game"`. It still sets `showExitModal`.
- **Centre:**
  - **Title:** `font-display` 14px, tracking .06em, normal case, truncated with an ellipsis. It replaces the uppercase mono `h1`.
  - **Subtitle:** a new optional prop `gameSubtitleExpr` (an Alpine `x-text` expression) renders a mono `text-eyebrow` line in `text-muted-foreground`.
- **Right:** a new named slot, `header-end`. When it is empty, a 44px spacer keeps the title centred.
- **Titles** (static `gameTitle`; 501 drops `gameTitleExpr="matchTitle()"`): `501`, `121`, `Around the Clock`, `Bob's 27`, `Doubles`, `Score training`, `Shanghai`, `Singles`, `Ten Up One Down`, `Cricket`, `Tactics`.

### 2. Timer: `CountdownPauseControl.astro` / `CountdownResumePrompt.astro`

- **Pause control:** it moves into `GameLayout`'s `header-end` slot on the four countdown games (121, Around the Clock, Score training, TUOD).
  - Look: a 44px pill on `inset-well`, padding 0 12px, holding `pause.svg` at 12px plus `remainingLabel()` in mono 13px medium.
  - Behaviour: it calls `togglePause()` and keeps `aria-label="Pause timer"`.
  - The visibility rule is unchanged: `durationType === 'MINUTES'` and not paused.
- **Resume prompt:** unchanged behaviour. Its button is restyled with `glass-button` and an accent play icon.
  - The paused state has no design, so it is filed as discovered work.

### 3. `SinglePlayerDisplay.astro`: solo scoreboard

- **Card:** a `glass` card, `rounded-3xl` (Tailwind's default 24px), 20px padding. It sits in the D327 40% band, which is about 300px at 844px, so the existing `pinnedHeight` behaviour stays.
- **Grid:** `1.3fr / 1fr`.
  - **Left column**, centred:
    - **Big value:** Michroma, line-height 1, tracking -.02em, `text-shadow-glow`. The size steps by character length: up to 2 characters is 84px, 3 is 64px, 4 or more is 46px. The step comes from a tested pure helper, `bigValueSize(text)` in `lib/ui/play-display.ts`, applied as a `:class`. The existing `fluid` path is replaced by this helper.
    - **Caption:** an optional mono eyebrow (the `caption` prop, e.g. "DARTS USED").
    - **Route chips:** an optional `route` slot holding a 28px `inset-well` pill. The parts are mono 13px in `text-soft-foreground`, separated by 3px dots.
  - **Right column:** a 1px `border-white/8` divider on the left, then the default slot. It holds up to 3 `PlayStatTile`s, or the mark rows.
- **New `PlayStatTile.astro`** (`components/layout/games/`): a 76px `inset-well`, `rounded-2xl` (16px). The value is mono 17px medium, white. The label is mono 9px semibold caps, tracking .1em, in `text-muted`. Props: `label`, and `valueExpr` (`x-text`).
- **Existing props:** `size`, `activeExpr`, the `above` slot and the `progress` slot are kept where callers still use them. A slot or prop with no remaining caller is removed, because fallow fails on dead props.

### 4. `SplitScoreboard.astro` / `SplitScoreboardHalf.astro`: stacked seats

- **Band:** `SplitScoreboard` keeps the 40% band, as a column with `gap-2`. Each half renders both of its states and toggles between them by `isActiveSeat`:
  - **Active card:** `flex-1`, `rounded-[22px]`, padding 16px 18px, on the 1.3fr / 1fr grid. The background is the new `glass-active-seat` utility: an accent 18%→4% vertical tint over the glass wash, `border-y` white/25, and a `0 0 18px 2px` accent/30 glow.
    - Left: the name (sans 14px semibold, `text-accent-bright`), the `LegBars` and the 64px Michroma score with the glow, then the route chips.
    - Right: after the divider, up to 3 compact 44px `inset-well` `rounded-[14px]` rows, label left (mono 9px) and value right (mono 14px).
  - **Idle row:** 64px, `glass`, `rounded-[22px]`, padding `0 10px 0 16px`.
    - Left: the name (14px semibold, `text-muted`) over the `LegBars`.
    - Right side: the score (Michroma 24px, muted, `ml-auto`), then an 80×44 `inset-well` tile holding the game's first stat value (mono 13px) and its label (mono 9px).
  - **Inputs:** `idleStatExpr` and `idleStatLabel` are new props, and a call site passes the game's first stat. Stat rows still come through the existing slot.
- **New `LegBars.astro`:** a 56px-wide 3-column grid of 4px pills.
  - A won leg is accent. An open leg is `inset-well` black/45 with an inset shadow.
  - Rule: bars only while `legsToWin <= 5`. Above that, a mono 10px `won/target` counter shows instead (user decision).
  - A pure helper, `legBarStates(won, toWin)`, returns `('won'|'open')[] | null`, where `null` means "use the counter".
  - The `legsExpr` badge and the dot pager in `SplitScoreboardHalf` are removed. `legsToWinExpr` is now wired by 501.
- **Seats:** 2 maximum, as today. Cricket and Tactics stay solo.

### 5. `VisitPreview.astro`

- **Strip:** a `glass` strip, `rounded-[22px]`, padding 12px 18px, as a 3-column grid with `gap-2`.
- **Each column**, top to bottom:
  - an 18px header row: a hit shows `check.svg` at 14px in accent plus "HIT" in accent; a miss shows `cross.svg` at 12px plus "MISS" in `text-muted`; an empty dart shows "DART n", in `text-soft-foreground` for the next dart and `text-faint-foreground` for the rest
  - a 6px bar: accent for a hit, white/22 for a miss, `inset-well` for empty; the next dart gets the `next-dart-ring` utility (an accent/70 inset ring and an accent/30 glow)
- **Logic:** the next dart is the first empty one, decided by a tested `previewColumnState(segments)` in `lib/ui/play-display.ts`.

### 6. Input panels

- **Shared well** (new `@utility input-well`): `glass`, `rounded-board`, 10px padding, `gap-2`, `flex-1 min-h-0`.
- **`InputButton.astro`:** `inset-well`, `rounded-key`, mono 26px medium, white.
  - A new `muted` variant uses `inset-well-muted` and is for icon keys.
  - Press feedback is the new `@utility key-press`: on `:active`, an inset 1px accent/60 ring plus the well shadow, with a 120ms box-shadow transition. There is no scale animation.
  - `disabled` dims the key to 35%.
- **`ScoreInput.astro`:**
  - An entry row on `inset-well`, `rounded-[22px]`, padding `5px 5px 5px 20px`. The value is mono 30px medium, `text-placeholder` while empty or "0", otherwise white.
  - Submit is `Button variant="sheet-raised"`, sized 110×48 with `rounded-[17px]`.
  - Then a 1px white/8 hairline, then the 3×4 grid: 1–9, then undo (muted, `UndoIcon`, `aria-label="Undo last visit"`), 0, delete (muted, `DeleteIcon`, `aria-label="Delete last digit"`).
- **`SinglesRecreationalInput.astro`:** two equal rows.
  - Row 1: the S/D/T keys with their existing labels (S7/D7/T7, or BULL/BULLSEYE).
  - Row 2: undo (muted) and MISS (mono 22px, tracking .08em, `text-soft-foreground`).
- **`DoublesPathRecreationalInput.astro`:** one row of three keys: undo (muted), MISS, and the target (mono 26px with an accent ring, `next-dart-ring` without the glow). The label changes from "MIS" to "MISS".
- **`CricketRecreationalInput.astro` / `TacticsRecreationalInput.astro`:**
  - **Row 1** (flex 1): undo (muted), then S, D, T. A selected ring key uses `glass-blue`; the others use `inset-well`.
  - **S key:** calls the existing `setRing('SINGLE')`. A pure helper, `ringKeyActive(ring, key)` in `lib/ui/play-display.ts`, marks S active when the ring is SINGLE.
  - **Row 2** (flex 2): the targets, then MISS, in a 4-column grid. Labels are mono 24px.
    - BULL is at 35% and disabled while T is armed (the existing rule).
    - MISS uses `text-soft-foreground`.
    - Tactics only: once D or T is armed, the existing `tapTargets()` list renders 7 columns, with MISS last.
  - "MIS" becomes "MISS", and the MIS key leaves row 1.
- **Undo** stays `UndoIcon` with an `aria-label` everywhere (Style Guide rule).

### 7. `BoardInputPanel.astro` / `BoardMagnifier.astro` (Analytics)

- **Panel:** the `input-well`.
  - The board area is `flex-1 min-h-0`. `DartBoard.astro` is fitted square (`h-full max-w-full aspect-square`).
  - Below it, a 56px row of two equal columns: undo (muted, `UndoIcon`, `aria-label="Undo dart"`), and "Bounce out" on `inset-well` (sans 15px medium, white).
- **Markers:** 12px accent dots with a 2px `--surface` rim, replacing `size-3 bg-accent`.
- **Press state:**
  - While pressing, the board takes the new `board-dim` utility (`filter: saturate(.55) brightness(.75)`, 150ms).
  - A 44px press ring shows at the pointer: white/12 with a 1px white/25 ring, `aria-hidden`.
- **Magnifier:** placement is unchanged (`magnifierPlacement`, D199 and later). Look:
  - a 2px accent border on a `--surface` fill, with the `0 8px 24px` black/60 shadow
  - a white 1×16 and 16×1 crosshair
  - the read is a pill *inside* the circle, `bottom-2`, centred: mono 11px semibold, white on black/60, `rounded-full`, `px-2 py-0.5`
- **D204's `magnifierLabelStyle`** (`lib/game/board-input.data.ts:45`, and the factory method at `:228`) has no caller once the read sits inside the circle. The function, the method and its tests (`board-input.data.test.ts:424-430`) are removed.
  - That counts as a subject removed, not a test re-pointed. The removal is recorded in D432.

### 8. Interfaces: per-game wiring

Each `interfaces/<Game>.astro` passes the title (via its page), `gameSubtitleExpr="subtitle()"`, the big value, any caption or route chips, the tiles (solo), the active rows plus the idle stat (split), and the input panel.

| Game | Subtitle (`subtitle()`) | Big value | Tiles (solo) / idle stat |
|---|---|---|---|
| 501 | `LEG {stages.length} · FIRST TO {legsToWin}` | `remainingScore()`, route chips from `checkoutHint()` | Avg `average()` · Prev `previousScore()` · Darts `dartsThrownThisLeg()`; idle: Avg |
| 121 | `ATTEMPT {attemptsCompleted+1} · 9 DARTS` | `remainingInAttempt()`, route chips | Target `currentTargetLabel()` · Visit `n / 3` · Darts `dartsThisAttempt()` (new); idle: Target |
| Around the Clock | `LAP {laps()+1} · {first} → {last}`, where `last` is the target before BULL | `currentTargetLabel()` | Turns · Accuracy · This visit `hitsToGo()` (new, "n to hit", blank on EASY); idle: Turns |
| Bob's 27 | `ROUND {targetIndex+1} OF {path.length}` | `currentScore()` | Target; idle: Target |
| Doubles | the order-mode setup label (`LOW → HIGH` / `HIGH → LOW` / `RANDOM`) | `currentTargetLabel()` | Hits · Misses; idle: Hits |
| Score training | `ROUND {turnCount+1} OF {durationValue}`; MINUTES: `ROUND {n}` | total, `toLocaleString('en-US')` | Avg · Darts · Prev; idle: Avg |
| Shanghai | `ROUND {targetIndex+1} OF 20` | `currentScore()` | Round · Target; idle: Target |
| Singles | the order-mode setup label (plus `ORDER` for Random, i.e. `RANDOM ORDER`) | `currentPoints()` | Target · Misses · `S · D · T` (`s · d · t` counts); idle: Target |
| TUOD | `ATTEMPT {attempts+1}` | `remainingInAttempt()`, route chips | Target · Attempts (`seat.attempts`) · `Successes · Failures` (`seat.successes · seat.failures`); idle: Target |
| Cricket | `SOLO · {objectives} OBJECTIVES` | `dartsThrown()` + caption "DARTS USED" | mark rows |
| Tactics | `SOLO · {objectives} OBJECTIVES` | `dartsThrown()` + caption "DARTS USED" | mark rows (incl. Doubles, Triples) |

- **Subtitle helpers:** the shared pure helpers `joinSubtitle(parts: string[])` (filters empty parts, joins with " · ") and `orderModeLabel(mode)` live in `lib/game/play-subtitle.ts`. `ORDER_MODE_LABELS` (`Low → High`, `High → Low`, `Random`) moves into `play-subtitle.ts`. The three setup forms that inline it today (`AroundTheClockSetupForm`, `DoublesTrainingSetupForm`, `SinglesTrainingSetupForm`) import it instead, which is a one-line adjacent edit each and is needed to avoid a second copy. The subtitle uppercases the label.
- **Mark rows** (Cricket and Tactics, the right column):
  - each row: the label (sans 13px medium) on the left and 3 × 10px pips on the right
  - a pip is accent with a `0 0 6px` accent/40 glow when marked, `inset-well` black/45 otherwise
  - a closed row is at 50% opacity, with `aria-label="{label}: {n} of 3 marks"`
- **Multi-seat getters:** where a getter has no per-seat (`For`) variant, the `For` variant is added with a test.

## Tokens and utilities (`global.css`)

New, all pinned in `app/tests/lib/ui/brand-tokens.test.ts`:
- `glass-active-seat`: the active seat card's accent tint, glass wash and glow
- `input-well`: the input container
- `key-press`: the `:active` accent inset ring
- `next-dart-ring`: the accent ring and glow on the next dart's bar and on the doubles target key
- `board-dim`: the filter while pressing
- `--shadow-magnifier: 0 8px 24px oklch(0% 0 0 / 0.6)`
- Radii: `rounded-3xl` is Tailwind's default (24px). The 22px, 17px and 14px radii are arbitrary values (`rounded-[22px]` etc.), as no token covers them.

Reused: `glass`, `glass-blue`, `glass-button`, `inset-well`, `inset-well-muted`, `text-shadow-glow`, `rounded-key`, `rounded-board`, the accent family.

## Testing

TDD, red → green → refactor (`app/CLAUDE.md`).
- `app/tests/lib/ui/play-display.test.ts`:
  - `bigValueSize` at 1, 2, 3, 4 and 5 characters
  - `legBarStates`: 0/3, 2/3, 3/3, 5/5, 6 → `null`
  - `previewColumnState`: only the first empty dart is next; hit and miss columns
  - `ringKeyActive`: SINGLE → S; DOUBLE → D; TREBLE → T
- `app/tests/lib/game/play-subtitle.test.ts`: `joinSubtitle` drops empty parts; `orderModeLabel` maps every mode.
- **Per-factory `subtitle()` tests**, in each existing `*-play.data` test file:
  - every row of the table above
  - the edge states: before config loads (empty string, no crash), the last round, MINUTES vs ROUNDS, and the BULL end of the path
- **New getters:** `dartsThisAttempt`, `hitsToGo`, `legsToWin`, plus any new `For` variants.
- **CSS:** the new utilities and tokens in `brand-tokens.test.ts`.
- **Removal:** `magnifierLabelStyle`'s tests are deleted along with it (root CLAUDE.md test-removal rule).
- **Markup is not unit-tested (D101).** It is verified by:
  - `validate:app`
  - `check-astro-conventions.sh`, `check-style-tokens.sh`, `check-astro-class-composition.sh`
  - `format:check`
  - a visual check of the design screens at 390×844, in both modes, for one keypad game, one tap game, one doubles-path game, Cricket, and 501 with a bot

## Docs

- `07-Style-Guide.md`:
  - the new utilities and tokens
  - the Buttons section: keys use `key-press`, not scale
  - the play header, and the D327 band note (the stacked seats live inside it)
  - leave the stale D199 a11y line to #837
- `08-Component-Inventory.md`:
  - rows for `PlayStatTile` and `LegBars`
  - updated rows for `GameLayout`, `SinglePlayerDisplay`, `SplitScoreboard(Half)`, `VisitPreview`, `InputButton`, the input panels, `BoardInputPanel`, `BoardMagnifier` and the Countdown controls
- `decisions/frontend/style.md`: D432, the game play restyle.
  - Records items 1–10 above.
  - Records that the magnifier read moves inside the circle (supersedes D204's placement).
  - Records the removal of the legs badge and dot pager.
- File Inventory rows for the new files; a Context Map History entry.

## Discovered work (GitHub issues, filed during implementation)

- The paused state (`CountdownResumePrompt`) has no design.
- The results modals are not in the design and keep their current look.
- Any layout gaps in the training screens that inherit the shared restyle (routine panels, routine play, Quick Subtract).
- #837 (already filed): the stale Style Guide a11y line about the keypad.
