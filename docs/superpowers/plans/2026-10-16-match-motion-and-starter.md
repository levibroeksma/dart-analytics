# Match Motion + Starter Step Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three Animations.dc.html studies — card stack, turn switch + Dartbot turn, and a "who throws first" step (bull-off / coin toss) before every 1v1 match.

**Architecture:** Pure state machines and geometry live in `app/src/modules/` / `app/src/lib/` and are unit-tested; Astro components bind them with Alpine and Tailwind classes backed by new `@theme` motion tokens in `global.css`. The starter is expressed only by participant order at `createSession` — no schema change.

**Tech Stack:** Astro, Alpine.js v3, TypeScript, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-16-match-motion-and-starter-design.md`

## Global Constraints

- Every duration/easing is a named token in `app/src/styles/global.css` `@theme` (spec §Motion tokens table, values verbatim). No raw ms in components.
- No Tailwind arbitrary values (D451): stock step → `@theme` token → `@utility`.
- Every animation has a `motion-reduce:` path (opacity-only or instant).
- No `//` or `/* */` inside function bodies; JSDoc above declarations only.
- Every `x-show` has `x-cloak`; no `x-init`; buttons via `components/forms/Button.astro`.
- Icons from `@icons/*.svg` only: `dart`, `dartboard`, `play-rounded`.
- Tests under `app/tests/` mirroring `app/src/`. TDD: red, then green.
- No migration, no new column; bull-off distances and coin result are never persisted.
- One branch (`feat/match-motion-and-starter`), one PR at the end (user, 2026-10-16) — supersedes the spec's "one PR per part".

## Review Focus

1. Rapid double-tap on deck pager / swipe during an animation → input ignored, deck never desyncs (Task 1 test `ignores next while animating`).
2. Undo pressed while a Dartbot dart is mid-flight → flight overlay clears, no dart committed (Task 4 test `clears flight when the active seat moves away`).
3. Quick-score bot visit when the page is paused/finished mid-animation → visit not recorded twice, keypad returns (Task 5 test `records once and clears flight`).
4. Bull-off tap outside the crop / both darts clamped → clamped distance, tie → throw again (Task 6 tests `clamps to the crop radius`, `ties within 1mm`).
5. Back out of the starter step → setup values intact, no session created (Task 8 test `cancel leaves no session`).

---

## Part 1 — Card stack

### Task 1: Deck slot machine + tokens

**Files:**
- Modify: `app/src/lib/game/resume-deck.data.ts`
- Modify: `app/src/lib/game/types.ts` (`ResumeDeckPhase`, `ResumeDeckContext`, new `DeckSlot`)
- Modify: `app/src/styles/global.css` (deck tokens)
- Test: `app/tests/lib/game/resume-deck.data.test.ts`

**Interfaces:**
- Produces: `type ResumeDeckPhase = "idle" | "go" | "snap" | "back"`; `type DeckDirection = "next" | "prev"`; `type DeckSlot = { card: ResumeCard; depth: 0 | 1 | 2; state: "rest" | "leaving" | "parked" | "entering" }`; `deckSlots(this): DeckSlot[]` on the deck (max 3, front first); `DECK_TIMINGS = { snapMs: 480, backMs: 520, idleMs: 1040 }`.
- Removes `layers()`, `settle()`, `settleTimer`, `armSettleFallback` (timers replace `animationend`; fallback no longer needed because timers always fire).

- [ ] **Step 1: Write failing tests** in `resume-deck.data.test.ts` (fake timers):
  - `deckSlots shows at most three cards front-first` — 5 cards, index 0 → depths `[0,1,2]` for cards 0,1,2.
  - `next sends the top card leaving and advances the index` — after `next()`: `phase === "go"`, `index === 1`, slot for card 0 has `state "leaving"`.
  - `next parks then returns the old top into the back slot with three cards` — advance 480ms → card 0 `parked`, depth 2; advance 40ms → `phase "back"`, card 0 `entering`; advance to 1040ms → `phase "idle"`, all `rest`.
  - `next with more than three cards enters the hidden fourth card` — 5 cards: during `back`, entering card is card 3 at depth 2; card 0 absent.
  - `prev reverses: back card leaves, then enters on top` — 3 cards index 0 → after `prev()` index 2; card 2 `leaving` from depth 2, then `entering` at depth 0 by `back`.
  - `ignores next while animating` — `next(); next();` → index 1.
  - `single card never animates` — 1 card: `next()` leaves `phase "idle"`.
  - Keep existing swipe/resume/toResumeCards tests; delete `layers`/`settle` tests (subject removed).
- [ ] **Step 2: Run** `cd app && npx vitest run tests/lib/game/resume-deck.data.test.ts` — expect new tests FAIL (`deckSlots is not a function`).
- [ ] **Step 3: Implement** `next()`/`prev()` as `phase: go → snap (480ms) → back (520ms) → idle (1040ms)` via one `setTimeout` chain stored on `animTimer`; `deckSlots()` derives slots from `index`, `cards.length`, `phase`, `from` (index leaving) and `direction`.
- [ ] **Step 4: Tokens** — in `global.css` `@theme`, replace the six `--animate-deck-*` keyframe tokens with transition tokens:
  `--deck-out-duration: 440ms; --deck-out-ease: cubic-bezier(.55,0,.75,.35); --deck-rise-duration: 460ms; --deck-rise-delay: 60ms; --deck-ease: cubic-bezier(.2,.8,.2,1); --deck-return-duration: 500ms; --deck-fade-duration: 150ms;` plus `@utility deck-depth-0|1|2` (transforms `translateY(0) scale(1)` / `translateY(0.5rem) scale(.933)` / `translateY(1rem) scale(.866)`, origin `50% 100%`), `@utility deck-leaving` (`translateX(-130%) rotate(-6deg)`, opacity 0, out timing, opacity `300ms ease-in 140ms`), `@utility deck-parked` (`translateX(-130%) translateY(1rem) scale(.866)`, opacity 0, `transition: none`), `@utility deck-tint-1|2` (tint opacity .6/.8) and a `motion-reduce` variant that sets `transition: opacity var(--deck-fade-duration) linear`, no transform transition. Delete the `deck-*` keyframes.
- [ ] **Step 5: Run** the test file — PASS.
- [ ] **Step 6: Commit** `feat(home): resume deck runs the three-card slot machine`.

### Task 2: Render three real cards

**Files:**
- Modify: `app/src/components/layout/sessions/ResumeSessionDeck.astro`
- Delete: `app/src/components/ui/CardStack.astro` if no other caller (`grep -rn CardStack app/src`); else leave.
- Modify: `app/src/styles/global.css` (remove `stack-slab-*` only if unused)

**Interfaces:** Consumes `deckSlots()`, `DeckSlot` from Task 1.

- [ ] **Step 1:** Replace the single card with a `display:grid` wrapper (`pb-4`) and `<template x-for="slot in deckSlots()" :key="slot.card.sessionId">`; each card is `grid-area 1/1` (`col-start-1 row-start-1`), `:class` maps `slot.depth` → `deck-depth-n`, `slot.state` → `deck-leaving`/`deck-parked`, z-index by depth (`z-30/z-20/z-10`, leaving `z-40`, parked `z-0`). A tint layer (`absolute inset-0 rounded-2xl bg-…` token `--color-deck-tint: oklch(24% 0.06 241)`) gets `deck-tint-1/2` by depth, opacity 0 at depth 0. Card body binds `slot.card` (not `top()`); pointer/swipe/pager/resume only on depth 0 (`pointer-events-none` otherwise, `inert` on non-front).
- [ ] **Step 2:** `npm run dev` in background (`astro dev --background`), open Home with ≥3 and with 1 in-progress session; verify fly-off / rise / return and reduced-motion (DevTools emulate) — note result.
- [ ] **Step 3: Run** `cd app && npx astro check` — 0 errors/warnings/hints.
- [ ] **Step 4: Commit** `feat(home): resume deck renders three real cards`.

---

## Part 2 — Turn switch + Dartbot turn

### Task 3: Turn-switch seat morph

**Files:**
- Modify: `app/src/components/layout/games/SplitScoreboardHalf.astro`
- Modify: `app/src/components/layout/games/SplitScoreboard.astro` (doc only: seats keep order)
- Modify: `app/src/styles/global.css` (turn tokens + utilities)

**Interfaces:** none new (same props).

- [ ] **Step 1: Tokens** — `--turn-duration: 500ms; --turn-ease: cubic-bezier(.65,0,.35,1);` plus `@utility seat-morph` (`transition: flex-grow, height, box-shadow` at turn timing), `@utility seat-detail-in` (`opacity` over `calc(var(--turn-duration) * .5)` with delay `calc(var(--turn-duration) * .55)`), `@utility seat-detail-out` (`opacity` over `calc(var(--turn-duration) * .3)`), `@utility seat-glide` (`transition: font-size, color, text-shadow, transform` at turn timing).
- [ ] **Step 2:** Restructure the half into ONE always-present card: wrapper drops `order-first`; card height is `grow` when active, `grow-0 basis-16` otherwise, with `seat-morph`; both the panel detail block (route chips, slot tiles, hairline column) and the bar AVG tile stay mounted and cross-fade via `opacity-100/0` + `seat-detail-in`/`seat-detail-out` (`aria-hidden` + `inert` when hidden), replacing the two `x-show` blocks. Name+LegBars and score are single elements; score swaps between `$seatValueSize(...)` and `text-2xl text-muted` classes with `seat-glide`; glow layer = `glass-active-seat` look on an absolute layer whose opacity cross-fades. End states must match today's active card and 64px row pixel-for-pixel at rest. `motion-reduce:transition-none` on all four utilities.
- [ ] **Step 3:** Verify in dev server: 501 vs guest, enter visits, watch switches; check reduced motion; check a game without legs (Bob's 27) and with route chips (501 ≤170).
- [ ] **Step 4:** `npx astro check` clean. **Commit** `feat(play): seats morph on turn switch`.

### Task 4: Dartbot flight on the visual board

**Files:**
- Create: `app/src/lib/game/bot-flight.ts`
- Modify: `app/src/lib/game/play-lifecycle.ts` (`playRunBotVisualBoardVisit`)
- Modify: `app/src/lib/game/types.ts` (`BotFlight`, `PlayLifecycleContext.botFlight`)
- Create: `app/src/components/layout/games/BotDartFlight.astro`
- Modify: `app/src/components/layout/games/BoardInputPanel.astro` (mount overlay in `DartBoard` slot)
- Modify: every play data factory with `botThrowing` (`*-play.data.ts` for 501, 121, TUOD, score-training, singles, doubles, shanghai, ATC, bobs27): add `botFlight: null`.
- Modify: `app/src/styles/global.css` (dart tokens + keyframes)
- Test: `app/tests/lib/game/bot-flight.test.ts`, `app/tests/lib/game/play-lifecycle.test.ts`

**Interfaces:**
- Produces: `type BotFlightPhase = "aim" | "fly" | "hit" | "land"`; `type BotFlight = { dartIndex: 0 | 1 | 2; phase: BotFlightPhase; leftPercent: number; topPercent: number; landed: { leftPercent: number; topPercent: number; label: string }[] }`; `botFlightSchedule(preThrowMs: number): { aimMs: number; flyMs: number; hitMs: number }` (aim = `preThrowMs - 240 - 70`, floored at 0; fly 240; hit 70); `observationPercent(obs: DartObservation): { leftPercent: number; topPercent: number } | null` (same math as `markersForTurns`); `dartLabel(obs): string` (`T20`, `S5`, `D16`, `SB`, `DB`, `M`).
- `playRunBotVisualBoardVisit` sets `context.botFlight` through aim → fly → hit inside the existing `preThrowMs` wait (split into the three schedule waits), commits, sets `land`, waits `postThrowMs`; clears `botFlight = null` when the loop exits for any reason (finally).

- [ ] **Step 1: Failing tests** — `bot-flight.test.ts`: `schedule splits 900ms into 590/240/70`, `schedule floors aim at 0 for short pacing`, `observationPercent matches markersForTurns for the board centre and T20`, `dartLabel names zones`. `play-lifecycle.test.ts`: `sets aim, fly, hit, land per dart then clears`, `clears flight when the active seat moves away` (undo during aim → no commit, `botFlight === null`), `total wait per dart still equals preThrowMs + postThrowMs`.
- [ ] **Step 2: Run** both — FAIL.
- [ ] **Step 3: Implement** `bot-flight.ts` and the loop change; keep both re-entrancy guards; the active-seat re-check runs after the last schedule wait, before commit.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Tokens/keyframes** — `--animate-reticle-aim: reticle-aim 600ms cubic-bezier(0.3,1.4,0.5,1)`, `--animate-dart-fly: dart-fly 240ms cubic-bezier(0.55,0,0.9,0.55) forwards`, `--animate-dart-stick: dart-stick 300ms cubic-bezier(0.3,1.6,0.5,1)`, `--animate-dart-ripple: dart-ripple 500ms ease-out forwards`, keyframes per spec table (fly from `translate(-50%, 125%) scale(2.6)` relative to the board box to `translate(-50%,-50%) scale(1)`, with shadow `0 12px 20px` → `0 1px 2px`).
- [ ] **Step 6: `BotDartFlight.astro`** — reads `botFlight`; reticle (56px ring, accent) at the hit point during `aim`/`fly`; flying dart (12px accent dot, `border-surface`) with `animate-dart-fly` on `fly`, `animate-dart-stick` on `land`; ripple ring `animate-dart-ripple` on `land`; already-landed darts as static markers; 3-slot strip above the board (label `DART n` → hit label, bar fills accent) reusing `VisitPreview`/`GamePreviewSegment` styling if it fits, else new markup. `motion-reduce:animate-none`. Mount it inside `BoardInputPanel`'s `DartBoard` slot, shown while `botFlight`.
- [ ] **Step 7:** Wire `botFlight: null` into the nine factories + their context types; `npx vitest run` full suite green; dev-server check 501 VISUAL_BOARD vs Dartbot.
- [ ] **Step 8: Commit** `feat(play): Dartbot darts fly onto the board`.

### Task 5: Quick-score Dartbot animation + score countdown

**Files:**
- Modify: `app/src/lib/game/play-lifecycle.ts` (`playFoldBotQuickScoreVisit` returns darts; new `playAnimateBotDarts`)
- Modify: `app/src/lib/game/types.ts` (`BotQuickScoreFold.darts: DartObservation[]`)
- Create: `app/src/components/layout/games/BotBoardPanel.astro`
- Modify: `app/src/components/layout/games/SeatedPlayScreen.astro` (mount `BotBoardPanel`; hide default input slot while it shows)
- Modify: QUICK_SCORE branch of `maybeRunBotVisit` in the nine `*-play.data.ts`
- Create: `app/src/lib/ui/score-tween.data.ts`
- Modify: `app/src/components/layout/games/SplitScoreboardHalf.astro` (score via tween)
- Modify: `docs/architecture/08-DartBot.md` §The Play Loop rule line 275 (scratch darts may be read for presentation; still never uploaded) + version header
- Test: `app/tests/lib/game/play-lifecycle.test.ts`, `app/tests/lib/ui/score-tween.data.test.ts`, one play-data test per game touched (existing files), asserting record-after-animation.

**Interfaces:**
- Produces: `playAnimateBotDarts(context, botParticipantRef, darts: DartObservation[], wait = defaultBotWait, pacing = { preThrowMs: 900, postThrowMs: 250 }): Promise<boolean>` — runs Task 4's flight per dart; returns `false` (and clears flight) if finished/paused/active seat moved, so the caller skips recording. `scoreTween(valueExpr)` Alpine factory: `display` follows the value; a decrease tweens over 700ms ease-out cubic via rAF; reduced motion or increase → instant.

- [ ] **Step 1: Failing tests** — `fold returns the scratch darts`, `fold darts never reach buildEventsBatch` (existing contract test kept), `playAnimateBotDarts animates three darts and returns true`, `returns false and clears flight when paused mid-visit`, `records once and clears flight` (501 play test: QUICK_SCORE bot visit → `recordVisit` called once after animation), `scoreTween counts down over 700ms`, `scoreTween jumps on increase`, `scoreTween jumps under reduced motion`.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement**; in each game's QUICK_SCORE branch: `const ok = await playAnimateBotDarts(this, botSeat.participantRef, fold.darts); if (!ok) return;` before its existing record call.
- [ ] **Step 4:** `BotBoardPanel.astro` — `input-well` board panel (reuse `DartBoard` + `BotDartFlight`), shown when `botFlight && $store.game.inputModeKey === 'QUICK_SCORE'`; `SeatedPlayScreen` wraps the default slot in a `x-show="!(botFlight && …)"` + `x-cloak` div.
- [ ] **Step 5:** Score countdown: `SplitScoreboardHalf` score element gets `x-data="scoreTween(() => <scoreExpr>)"` and `x-text="display"`.
- [ ] **Step 6: Run** full suite — PASS; dev-server check 501 QUICK_SCORE vs Dartbot.
- [ ] **Step 7: Commit** `feat(play): quick-score Dartbot visits animate on a board`.

---

## Part 3 — Starter step

### Task 6: Bull-off + coin rules module

**Files:**
- Create: `app/src/modules/game/starter.module.ts`
- Modify: `app/src/modules/types.ts`
- Test: `app/tests/modules/game/starter.module.test.ts`

**Interfaces:**
- Produces: `BULL_OFF_CROP_MM = 115`; `type BoardPointMm = { x: number; y: number }`; `clampToCrop(p: BoardPointMm): BoardPointMm` (radius `BULL_OFF_CROP_MM - 4`); `bullDistanceMm(p): number`; `bullOffResult(a: BoardPointMm, b: BoardPointMm): 0 | 1 | "tie"` (tie when `|da - db| < 1`); `type CoinFace = "heads" | "tails"`; `tossCoin(random: () => number): CoinFace` (`< 0.5` heads); `coinWinner(call: CoinFace, outcome: CoinFace): 0 | 1` (caller is side 0); `coinRotation(prevDeg: number, outcome: CoinFace): number` (`prev - prev % 360 + 1800 + (tails ? 180 : 0)`); `botBullThrow(random): BoardPointMm` (`r = 3 + random()^1.4 * 34`, angle `random() * 2π`).

- [ ] **Step 1: Failing tests** — `clamps to the crop radius`, `distance from bull`, `closer dart wins`, `ties within 1mm`, `both clamped darts tie`, `tossCoin splits at 0.5`, `caller wins on a correct call`, `rotation lands on tails with +180`, `bot throw stays within 37mm`.
- [ ] **Step 2–4:** run FAIL → implement → run PASS.
- [ ] **Step 5: Commit** `feat(game): starter rules — bull-off and coin toss`.

### Task 7: Participant order for the starter

**Files:**
- Modify: `app/src/lib/game/session-mode-resolution.ts`
- Modify: server/rehydration files named by the seat-order audit (see "Seat-order audit" below)
- Test: `app/tests/lib/game/session-mode-resolution.test.ts` (+ audit-named tests)

**Interfaces:**
- Produces: `starterFirst<T>(participants: readonly T[] | undefined, starterIndex: 0 | 1): T[] | undefined` — returns the list with the starter first, side keys re-lettered by position (`A`, `B`).

- [ ] **Step 1: Failing tests** — `starterFirst keeps order for 0`, `moves the opponent first for 1 and re-letters sides`, `undefined stays undefined`, plus audit-named round-trip test.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(game): sessions can seat the starter first`.

### Task 8: Starter step state machine

**Files:**
- Create: `app/src/lib/game/starter-step.data.ts`
- Modify: `app/src/lib/game/types.ts` (`StarterStepContext`, `StarterMethod`)
- Test: `app/tests/lib/game/starter-step.data.test.ts`

**Interfaces:**
- Produces: `starterStep(options: { sides: [string, string]; opponentIsBot: boolean; onResolve(starterIndex: 0 | 1): void; onCancel(): void; random?: () => number; wait?: (ms: number) => Promise<void>; storage?: Pick<Storage, "getItem" | "setItem"> })` Alpine factory. State: `method: "bull" | "coin"` (default `"bull"`, persisted under `localStorage["starter-method"]`); bull phases `enter` → (bot: `wait` 500 → `aim` 750 → `fly` 240 → `hit` 70 → `land` 600 → `measure` 1000 → `result`; guest: `enter` side 0 → `enter` side 1 → `measure` → `result`); coin phases `pick` → `flip` (rise at 0, fall at 750ms, result at 1580ms) → `result`. Methods: `setMethod(m)`, `tap(event)` (maps a click on the crop box to `BoardPointMm` and clamps), `confirm()`, `call(face)`, `again()`, `start()` (calls `onResolve(winner)`), `cancel()`. Getters for the view: `winner(): 0 | 1 | null`, `tie()`, `status()`, `prompt()`, `cta()` (`"<name> throws first"`), `ringPercent(side)`.

- [ ] **Step 1: Failing tests** — `defaults to bull-off`, `remembers the last method`, `switching method resets`, `bot bull-off runs the phase sequence and picks the closer dart`, `guest bull-off takes two inputs in turn`, `tie offers throw again`, `coin toss resolves the caller win`, `start resolves with the winner index`, `cancel leaves no session` (onCancel called, onResolve not).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(game): starter step state machine`.

### Task 9: Starter step view + tokens

**Files:**
- Create: `app/src/components/layout/games/StarterStep.astro`
- Modify: `app/src/styles/global.css` (coin, bull-ring, starter-win tokens + keyframes; `--color-coin-*` tokens for the coin faces)

- [ ] **Step 1: Tokens** per spec table: `--animate-coin-flip` (transition token `--coin-flip-duration: 1500ms; --coin-flip-ease: cubic-bezier(0.2,0.55,0.35,1)`), `--coin-rise-*`/`--coin-fall-*` 750ms with their curves, `--bull-ring-duration: 700ms; --bull-ring-ease: cubic-bezier(0.2,0.8,0.2,1); --bull-ring-stagger: 250ms`, `--starter-win-duration: 400ms`.
- [ ] **Step 2: View** — full-screen overlay (`fixed inset-0 z-50`, glass card, `animate-sheet-in`), study §04/§05 layout: header eyebrow (`WHO THROWS FIRST` / `BULL-OFF`) + status; segmented toggle Bull-off | Coin toss (raw `role="radio"` roving-tabindex precedent, `AppModeForm.astro`); two side cards with `VS` (winner tint/ring via `starter-win` transition); bull-off crop (circle, `dartboard.png` scaled 191.3% centred, rings, reticle, darts via Task 4's `BotDartFlight` styles); coin (3D flip, faces with `@icons/dartboard.svg` heads / `@icons/dart.svg` tails, shadow); prompt; `Button` primary `<name> throws first` with `@icons/play-rounded.svg`; secondary `Toss again`/`Bull again`/`Throw again`; back control calls `cancel()`. Reduced motion: coin and rings jump to end state.
- [ ] **Step 3:** `npx astro check` clean. **Commit** `feat(game): starter step view`.

### Task 10: Wire into setup and Play Again

**Files:**
- Modify: `app/src/lib/game/setup-session.ts` (`starterOpen`, `starterIndex`, `beginStart()`)
- Modify: `app/src/components/layout/games/setup/SetupShell.astro` (submit → `beginStart()`; mount `StarterStep`)
- Modify: `app/src/lib/game/setup-controller.ts`, `five-oh-one-setup.data.ts`, `one-twenty-one-setup.data.ts`, `tuod-setup.data.ts`, `score-training-setup.data.ts` (`starterFirst(participantsFromGuests(...), this.starterIndex)`)
- Modify: `app/src/lib/game/play-lifecycle.ts` (`runPlayAgain` gains `starterIndex: 0 | 1 = 0`, applied to `participantsFromSeats(config.seats)` before `createSession`, and to the reseated snapshot order)
- Modify: `app/src/components/layout/games/ResultsModalShell.astro` (Play again opens `StarterStep` when two seats; resolves into `playAgain(starterIndex)`)
- Modify: the nine two-seat `*-play.data.ts` `playAgain(starterIndex?)` signatures
- Modify: `docs/game-rules/rulesets/501.md` (+ any ruleset stating a leg-1 starter rule), `app/src/modules/game/seat-rota.module.ts` JSDoc
- Test: `app/tests/lib/game/setup-controller.test.ts`, `setup-session` test, `play-lifecycle.test.ts`, the four hand-written setup tests

**Interfaces:**
- Consumes: `starterFirst` (Task 7), `starterStep` (Task 8), `StarterStep.astro` (Task 9).
- Produces: `beginStart(this)`: solo → `start()`; with opponent → `starterOpen = true`. Step `onResolve(i)` → `starterIndex = i; starterOpen = false; start()`. `onCancel` → `starterOpen = false`.

- [ ] **Step 1: Failing tests** — `beginStart starts straight away when solo`, `beginStart opens the step with an opponent`, `start seats the opponent first when it won` (preset controller + 501 controller: `createSession` called with opponent first), `runPlayAgain seats the new starter first`, `play again on two seats opens the starter step` (one play-data test).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** Dev-server walk: 501 vs Dartbot bull-off → match starts with winner first and top seat; 501 vs guest coin toss; Bob's 27 vs guest; solo Cricket unaffected; Play Again shows step.
- [ ] **Step 6: Commit** `feat(game): who-throws-first step before every 1v1 match`.

### Task 11: Context maintenance + gates + PR

- [ ] Decisions (append-only, domain files per `DECISIONS.md`): deck timings supersede the brand-guide deck tokens; turn-switch motion; starter-as-participant-order (no schema); quick-score scratch darts readable for presentation.
- [ ] `context-maintenance` skill; `run-all-gates` skill; `cd app && npm run format` + `format:check`; `npm run validate:app` (0/0/0).
- [ ] `finishing-a-dart-branch` → push, open PR to `main` listing #971 and any discovered-work issues.

## Seat-order audit

Verdict SAFE (audit 2026-10-16). Array order is seat order end to end: server `rejectSeatRequest` finds the PLAYER by type, `buildSeatPlan`/`createSession` keep order into `configuration.seats` (JSONB), reload reads the `$persist` snapshot, another device cannot resume, owner views filter `player_id`, undo/bot lookups go by `participantTypeKey`. Only position reads: `SeatedPlayScreen` `seatCall(0/1)` (wanted: starter on top), `ComparisonSummary`, `FiveOhOneResults` (consistent), and 121's ROUNDS/MINUTES `seats[0]` reads (`one-twenty-one.engine.module.ts:580,702`, `one-twenty-one-play.data.ts:294`) — Task 7 checks whether 1v1 ROUNDS/MINUTES is reachable.

`toSeatFacts` reassigns `sideKey` by index, so `starterFirst` must re-letter positionally (starter `A`) so server and client snapshots agree. Task 7 interface becomes: `starterFirst(participants, starterIndex)` reorders AND re-letters `A`, `B`. Callers: `setup-controller.ts:97`, `five-oh-one-setup.data.ts:231`, `one-twenty-one-setup.data.ts:190`, `score-training-setup.data.ts:152`, `tuod-setup.data.ts:136`; tests `session-mode-resolution.test.ts:268-296`. No server, validator, DB or view change.
