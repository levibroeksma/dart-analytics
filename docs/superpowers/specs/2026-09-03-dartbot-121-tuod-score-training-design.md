# Design: DartBot opponent for 121, TUOD, Score Training

> status: historical record once implemented — specs are never rewritten
> (`docs/CLAUDE.md`)

Closes the gap `08-DartBot.md`'s own Strategy Layer table names: `121_V1`,
`TUOD_V1` and `SCORE_TRAINING_V1` are the only three rulesets `RULESET_DARTBOT`
does not yet admit. All three setup forms currently offer guest only — no
`allowDartbot` is wired at all, so the opponent chooser never renders.

Three independent tasks, bundled for one branch, split at review/PR time if
that reads better — mirrors `2026-09-02-dartbot-setup-wiring-fixes-design.md`.

## Strategy layer

**121 and TUOD — reuse `x01.strategy.module.ts` unchanged.** Both are
checkout-ladder games: aim at a target number, finish it on a double. The
decision shape (`X01View { remaining, checkoutPath }` + `decisionQuality`) is
identical to 501's; no new strategy module is needed, only a per-game
`X01View` adapter in each play-data file:

- 121: `remaining = seat.remainingInAttempt`, `checkoutPath =
checkoutPathFor(remaining)`.
- TUOD: `remaining = seat.currentTarget`, `checkoutPath =
checkoutPathFor(remaining)` (TUOD's play-data already imports
`checkoutPathFor` for its own UI checkout dialog).

**Score Training — new `scoring.strategy.module.ts`.** `ScoreTrainingInput`
is a plain number; there is no checkout, no double, no decision to route.
`08-DartBot.md`'s guiding principle already states a bot never optimizes a
score — "a weak bot still aims at T20 like everyone else." The new module:

```ts
// app/src/modules/dartbot/strategy/scoring.strategy.module.ts
export function chooseTarget(): ThrowIntent {
  return { targetNumber: 20, zoneKey: "TREBLE" };
}
```

No `GameView` needed — the function takes no argument. D-G's full scope (also
extracting 501's own scoring fallback out of `x01.strategy.module.ts` into
this module) is **not** taken here: 501 is shipped and working, and folding it
in is a pure refactor with no behavior change and real regression risk for a
task about three other games. `x01.strategy.module.ts` keeps its own local
`SCORING_TARGET` constant, now duplicated once (identical value) rather than
shared — an acceptable, explicitly-decided duplication, not an oversight.

## Play-loop wiring

Each of `one-twenty-one-play.data.ts`, `tuod-play.data.ts`,
`score-training-play.data.ts` gains the same shape `bobs27-play.data.ts` /
`shanghai-play.data.ts` already carry:

- `type DartbotSeat`, `findBotSeat`, `botDartIndex` — copied verbatim from
  the existing precedent (same shape every wired play-data file already has).
- `throwOneDart(remaining/target, botSeat, dartIndex)` — profile, seeded rng,
  `chooseTarget`, `botThrowDart`, mapped to a `DartObservation`. 121/TUOD call
  the reused `x01.strategy.module.ts`; Score Training calls the new
  `scoring.strategy.module.ts` (no `remaining` argument needed).
- `throwBotDart(context, botSeat)` — VISUAL_BOARD: reads the real engine's
  live `state()`.
- `throwBotQuickScoreDart(state, botSeat, dartIndex)` — QUICK_SCORE: reads
  the scratch engine's own live `state()` (never the real engine's).
- `maybeRunBotVisit()` — branches on `this.$store.game.inputModeKey`:
  - `QUICK_SCORE`: `playFoldBotQuickScoreVisit(factory, configSnapshot,
engine.facts(), throwBotQuickScoreDart, DARTS_PER_VISIT)`, then records the
    fold's `totalScore` through the ruleset's own visit-input path —
    `recordVisit(score, finishedOnDouble)` for 121 (mirrors `five-oh-one-play.
data.ts`), `recordAttempt({ checkedOut, finishedOnDouble })` for TUOD,
    `recordVisit(score)` for Score Training (no double concept). No
    `dartsUsed`/`dartsAtDouble` supplied — same as a human's non-dialog
    quick-score entry.
  - `VISUAL_BOARD`: `playRunBotVisualBoardVisit(this, botSeat.
participantRef, () => throwBotDart(this, botSeat))`.
  - Hooked onto `init` (after reconciliation), the tail of the human's own
    `recordVisit`/`recordAttempt`/`recordDart` paths, and `undoVisit`.
- `undoVisit()` — branches to `undoToActiveSeat(this, humanSeat.
participantRef)` when a bot seat exists, else the existing plain
  `engine.undo()` path; mirrors `five-oh-one-play.data.ts`.

## Setup UI + seat admission

- `app/src/lib/game/rulesets/capabilities.ts`: `RULESET_DARTBOT` gains
  `"121_V1": true, "TUOD_V1": true, "SCORE_TRAINING_V1": true`.
- `OneTwentyOneSetupForm.astro` / `TuodSetupForm.astro` /
  `ScoreTrainingSetupForm.astro`: `<UserSection allowGuests
allowDartbot={supportsDartbot("121_V1" | "TUOD_V1" | "SCORE_TRAINING_V1")}
/>`.
- `app/src/lib/game/types.ts`: `OneTwentyOneSetupContext` /
  `TuodSetupContext` / `ScoreTrainingSetupContext` each gain
  `pendingBotLevel: number`, `showBotLevelPicker: boolean`, `addBot(): void`,
  `removeBot(): void` — `bot`/`showOpponentChooser` already exist on all
  three (added when the guest-add crash was fixed). Mirrors
  `FiveOhOneSetupContext`'s full field set.
- Each of the three setup-data files gains a local `guested(ctx)` helper —
  `ctx.guests.length > 0 || ctx.bot !== null` — mirroring
  `singles-training-setup.data.ts`'s own precedent, replacing every existing
  `this.guests.length > 0` read in `start()`'s ruleset-key resolution and in
  `forceTargetIfGuested()` (121) / `forceRoundsIfGuested()` (Score Training,
  TUOD).
- `addBot(this) { addBotOpponent(this); }` / `removeBot(this) { this.bot =
null; }`, plus `guested(this)`-triggered follow-up
  (`forceTargetIfGuested`/`forceRoundsIfGuested`) — mirrors
  `five-oh-one-setup.data.ts`'s `addBot`/`removeBot`.
- `start()`'s `participantsFromGuests(this.guests)` →
  `participantsFromGuests(this.guests, this.bot)` in all three.

## Non-goals

No ghost mode. No change to `SEAT_CAPS` or any engine's gameplay rules. No
501 refactor (D-G's full scope, explicitly declined above). No auto-level
(D-K, still open). No change to `x01.strategy.module.ts`'s existing behavior.

## Testing

- New: `scoring.strategy.module.test.ts` — asserts `chooseTarget()` always
  returns treble 20, independent of any input (there is none).
- Extend `one-twenty-one-setup.data.test.ts` / `tuod-setup.data.test.ts` /
  `score-training-setup.data.test.ts`: bot seating (`addBot`/`removeBot`,
  mutual exclusion with a guest — already proven generically by
  `addBotOpponent`'s own tests, so only the wiring is asserted here), and
  that adding a bot triggers the same `forceTargetIfGuested`/
  `forceRoundsIfGuested` a guest does.
- Extend `one-twenty-one-play.data.test.ts` / `tuod-play.data.test.ts` /
  `score-training-play.data.test.ts`: a bot visit/attempt records under both
  capture modes, `undoVisit` returns to the human across a bot turn and
  across consecutive bot turns — mirrors the existing
  `five-oh-one-play.data.test.ts` / `shanghai-play.data.test.ts` bot suites.
- Live-verify: `/games/121/setup` → play, `/games/tuod/setup` → play,
  `/games/score-training/setup` → play, each with a seated DartBot.
