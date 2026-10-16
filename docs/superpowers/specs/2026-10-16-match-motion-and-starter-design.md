# Match motion + "who throws first" step

## Intent

Bring the Claude Design motion studies into the app. Source of truth:
`Animations.dc.html` in design project `cdea52ee-4746-4efb-b646-81448a40c033`
(claude.ai/design). Motion explains a state change and never decorates (brand
guide §06). Three parts, each its own branch from `main` and its own PR, in
this order:

1. **Card stack** — Home in-progress deck.
2. **Turn switch + Dartbot turn** — 1v1 play screen.
3. **Starter step** — new step between setup and play for every 1v1 match:
   bull-off (default) or coin toss.

## Goals

- Every timing and easing comes from a named token in `app/src/styles/global.css`
  (`@theme`), using the brand-guide names below. No raw durations in components.
- Every animation has a reduced-motion path (`motion-reduce:` → opacity-only
  fade or instant), matching the existing `deck-fade-*` pattern.
- Icons come from `app/src/icons` (`@icons/*.svg`): `dart`, `dartboard`,
  `play-rounded`. No inline SVG copies of icons that exist there.

## Non-goals

- Team v team. No game supports it; `guest-list.ts` caps a session at one
  opponent. The starter step's layout takes two sides; that is enough.
- Persisting the bull-off distances or coin result. Irrelevant (user).
- Solo games (Cricket, Tactics, any session without an opponent): no starter
  step, no turn switch.
- A starter step per leg. It runs once per match; later legs keep the existing
  rotation from whoever started.

## Anti-goals

- A schema change or new column for the starter. The starter is expressed by
  seat order (see Part 3).
- Changing how a Dartbot visit is recorded. Quick-score still records one visit
  total; the animation is presentation only.
- Slowing bot play. Visual-board pacing stays as it is today.

## Motion tokens (brand guide §06.1)

Add/replace in `@theme`. Values are the user's, except the deck rows, which the
user corrected to the study's timings (the brand-guide deck values were a
mistake).

| Token | Value |
| --- | --- |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` (exists) |
| `--animate-sheet-in` | 200ms ease-out · rise 1.5rem + fade (exists) |
| `--animate-deck-out` | 440ms `cubic-bezier(.55,0,.75,.35)` · translateX(-130%) rotate(-6deg); opacity → 0 over 300ms ease-in, 140ms delay |
| `--animate-deck-rise` | 460ms `cubic-bezier(.2,.8,.2,1)`, 60ms delay · from the next depth slot to front; tint fades with it |
| `--animate-deck-return` | 500ms `cubic-bezier(.2,.8,.2,1)` · old top card slides from translateX(-130%) into the back slot; opacity 250ms ease (**new**) |
| `--animate-deck-fade-out` / `-fade-rise` / `-fade-in` (+ `-fade-return`) | 150ms linear · opacity only (reduced motion) |
| `--animate-coin-flip` | 1500ms `cubic-bezier(0.2,0.55,0.35,1)` · rotateX +5 turns (+180° for tails) |
| `--animate-coin-rise` | 750ms `cubic-bezier(0.2,0.7,0.4,1)` · translateY(-6rem) scale(1.18) |
| `--animate-coin-fall` | 750ms `cubic-bezier(0.6,0,0.85,0.45)` · back to translateY(0) scale(1) |
| `--animate-coin-shadow` | 750ms · scale(0.45) opacity .35 at peak, paired with rise/fall |
| `--animate-dart-fly` | 240ms `cubic-bezier(0.55,0,0.9,0.55)` · from 125% below at scale(2.6) to the hit |
| `--animate-dart-stick` | 300ms `cubic-bezier(0.3,1.6,0.5,1)` · scale(1.3) → 1 |
| `--animate-dart-ripple` | 500ms ease-out · ring scale(.5) → 3.2, opacity .9 → 0 |
| `--animate-reticle-aim` | 600ms `cubic-bezier(0.3,1.4,0.5,1)` · scale(1.6) → 1 on the target |
| `--animate-bull-ring` | 700ms `cubic-bezier(0.2,0.8,0.2,1)` · ring 0 → distance; second ring +250ms |
| `--animate-starter-win` | 400ms ease · winner card tint, ring and name colour |
| Turn switch (**new**, name is builder's call, e.g. `--dur-turn`) | 500ms `cubic-bezier(.65,0,.35,1)` for height/position/size; panel details fade out over 30% of it; incoming details fade in over 50% after a 55% delay |

## Part 1 — Card stack (Home)

Today: `ResumeSessionDeck.astro` + `CardStack.astro` draw one real card over
0–2 decorative slabs; `resume-deck.data.ts` runs `out → rise → idle` /
`in` phases with a 600ms settle fallback.

Target (study §01):

- Up to three **real** cards stacked, each with its stats already rendered.
  Depth slots: front `translateY(0) scale(1)`; second `translateY(0.5rem)
  scale(.933)` under a tint overlay at opacity .6; third `translateY(1rem)
  scale(.866)`, tint .8. `transform-origin: 50% 100%`. Tint is a solid
  `oklch(24% 0.06 241)` layer over the card. Decks of more than three show
  three; the rest are not rendered.
- **Next** (pager › or swipe left): top card flies off left (`deck-out`); the
  card below grows into the front slot as its tint fades (`deck-rise`); the old
  top card snaps (no transition) to off-left at back-slot scale, then slides
  into the back slot (`deck-return`). Study timing: snap at 480ms, return at
  520ms, idle at 1040ms.
- **Previous** (pager ‹ or swipe right): the exact reverse — the back card
  slides out left and flies back in on top; the others step back one slot.
- More than three sessions: the visible three are always the next three of the
  rotated list. On Next the hidden fourth card enters the back slot with the
  `deck-return` motion while the old top flies off and leaves the visible set;
  Previous mirrors it. With exactly three, the entering card is the old top.
- Only the front card is interactive; input ignored while animating (existing
  `phase === 'idle'` guard). One card: no pager, no change.
- Keep the settle fallback timer (scaled to the new length) so a missed
  `animationend` never strands the deck.
- The design project is not edited from this repo; the corrected deck values
  are recorded in a decision (see Constraints).

## Part 2 — Turn switch + Dartbot turn (1v1 play)

### Turn switch

Applies wherever `SeatedPlayScreen` renders `SplitScoreboard` (501, 121, TUOD,
Score Training, Singles, Doubles, Shanghai, ATC, Bob's 27). Today the active
seat swaps by instant `x-show` + flex `order`.

Target (study §02): the two seats keep their DOM position; the active seat's
height grows to the full panel while the other shrinks to the 64px bar.
Name+legs and score are **shared elements** that glide and resize between the
panel and bar positions (score 64px ↔ 24px, colour white ↔ muted, glow on/off).
Panel-only content (route chips, stat tiles) fades out first; the bar-only AVG
tile fades in late. Glow layer and active-seat shadow cross-fade. Timing per the
turn-switch token row. Reduced motion: instant swap.

Builder decides how to map the study's absolute positions onto the existing
flex layout (40% height scoreboard, `$seatValueSize`); the visual end states
must match today's active/idle seat exactly — only the transition is new.

### Dartbot turn

Applies to every game where Dartbot can be the opponent
(`RULESET_DARTBOT` in `rulesets/capabilities.ts`).

**Visual board** (`playRunBotVisualBoardVisit`): per dart —

1. Reticle appears on the bot's *aim* target (`reticle-aim`).
2. Dart enters large from below the board and flies to the *hit* point
   (`dart-fly`); reticle shrinks.
3. Dart sticks (`dart-stick`) with a ripple ring (`dart-ripple`); its slot in
   the three-slot strip above the board fills with the hit label (e.g. `T20`).
4. After the third dart, the seat score counts down (≈700ms ease-out cubic,
   rAF) to the new value.

Fits inside the existing `preThrowMs`/`postThrowMs` pacing; commit order and
guards in `play-lifecycle.ts` are unchanged. The aim target comes from the
bot engine (`modules/dartbot/` aim resolver); if a game's bot path doesn't
expose it, use the hit point and skip the reticle travel.

**Quick score** (`playFoldBotQuickScoreVisit`): while Dartbot throws, a
dartboard panel temporarily replaces the keypad, the same three-dart animation
plays from the scratch engine's darts, the score counts down, then the keypad
returns for the human. The visit is still recorded as one total; it is
recorded when the animation finishes (or immediately, with the animation as
replay — builder's call, but undo must never see a half-shown visit).

Reduced motion: darts appear at the hit with no flight/ripple; score updates
without counting.

## Part 3 — Starter step ("who throws first")

### When

After the setup form's SlideToStart fires, for any session with an opponent
(guest or Dartbot) — i.e. every two-seat session in the games listed in Part 2.
Solo sessions go straight to play as today. Once per match.

**Play Again runs the step again** (user). Today `runPlayAgain`
(`play-lifecycle.ts`) creates the rematch straight from the results modal with
the previous seat order; it must instead show the starter step and create the
session with the new winner in seat 0. The step component is therefore
mountable both in `SetupShell` and from the results modal.

### Screen

One glass card (study §04/§05 layout): header `WHO THROWS FIRST` / `BULL-OFF`,
two side cards with `VS` between, the method area, prompt text, action buttons.

- **Toggle** at the top: Bull-off | Coin toss (existing segmented control).
  Default bull-off; remembers the last choice on the device (localStorage).
  Switching method resets the step.
- **Bull-off vs Dartbot**: cropped board (out to the trebles, circular). Player
  taps where their dart landed (tap again to adjust), confirms. Dartbot then
  throws at the bull: reticle on bull, dart flies in from below, sticks with
  ripple. Both distances open as dashed rings from the bull centre
  (`bull-ring`, second +250ms). Closest wins (`starter-win`): tag
  `CLOSEST · n MM`. A tap outside the crop is clamped to its edge (as in the
  study), so a dart beyond the trebles counts as the crop radius. Within 1mm → "Too close", throw again. Bot dart: random
  distance biased toward the bull, as in the study (builder may use the bot
  engine instead; either way not saved).
- **Bull-off vs guest**: same screen, two inputs in turn — player taps +
  confirms, then guest taps + confirms. No animated throw. Rings + result as
  above.
- **Coin toss**: player (seat A) calls heads/tails; coin rises, flips, falls
  (`coin-flip`/`-rise`/`-fall`/`-shadow`), lands on the result; winner card
  lights up (`starter-win`). Status: `HEADS · CALLED IT` / `WRONG CALL`. Coin
  faces use `@icons/dartboard.svg` (heads) and `@icons/dart.svg` (tails).
- **Result**: primary button `<name> throws first` (`@icons/play-rounded.svg`)
  starts the match; secondary `Toss again` / `Bull again`.
- Leaving the step (back) returns to the setup form with its values intact; no
  session has been created yet.

### Persistence

The step runs **before** `createSession`, so the winner can be expressed in the
seat order the session is created with: the starter takes seat 0, and the
existing `startingSeatFor` rotation does the rest. No migration, no new column,
no stored toss/bull-off data.

**Builder must verify first** (stop and report if any fails):
`participantsFromGuests` documents "the owning player is always seat 0 on side
A". Find everything that relies on that (server `buildSeatPlan`, side keys,
views, stats attribution, resume/rehydration of seat order, Play Again
reseating) and confirm the opponent can legally take seat 0. If seat order
cannot carry the starter without breaking the owner-is-seat-0 assumption,
the fallback is a starter field inside the config snapshot the client
already sends — still no schema change — but that choice comes back to the
user before implementation.

**Scoreboard order follows the starter** (user): the starter's seat renders
first (top) for the whole match and never reorders on a leg or set change —
only the active-seat expansion moves. This is today's seat-index layout, so no
identity-based remapping is needed.

Applies to both setup-controller families: `createPresetSetupController`
(`setup-controller.ts`) and the hand-written 501/121/TUOD/score-training
controllers. One shared step component + one shared Alpine data module, wired
into `SetupShell.astro`, not per game.

### Rules docs

`docs/game-rules/rulesets/501.md` (and `seat-rota.module.ts`'s comment) say
leg 1's starter is seat order and a bull-off is deferred. Update them to
describe the starter step. Other two-seat rulesets that state a starter rule get
the same targeted edit.

## Constraints

- Astro + Alpine.js + Tailwind v4; keyframes and tokens in `global.css`.
- TDD per `app/CLAUDE.md` for all logic: deck phase machine, starter-step state
  machine (pick/flip/result, enter/throw/measure/result, tie), seat reordering,
  bot animation sequencing. Animations themselves are verified in the running
  app.
- Hard invariants in `CLAUDE.md` hold: no stats persisted, no migration edits,
  completed gameplay immutable.
- Per part: `context-maintenance` + `run-all-gates` before PR; one decision
  entry per part in the right `decisions/**` domain file (the deck token
  correction, the turn-switch motion, the starter-step-as-seat-order choice).

## Left to the builder

- Component split and file names.
- How to animate the turn switch inside the existing flex layout.
- Whether quick-score records before or after its animation (undo-safe either
  way).
- Bot bull-off throw source (random as in study vs bot engine).

## Calls I made (not user-confirmed)

- Deck shows at most three real cards.
- A new `deck-return` token and a turn-switch token are added, since the
  study needs them and §06.1 has none.
- Toggle choice remembered per device, not per account.
- Starter step lives in the setup page flow, before `createSession`.
- Seat A always calls the coin.
- Decks over three: the hidden fourth card enters the back slot.
- Bull-off taps beyond the crop clamp to its edge.
