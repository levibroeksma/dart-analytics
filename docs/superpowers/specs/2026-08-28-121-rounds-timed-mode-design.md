# 121 V2 — Rounds / Time Stop Conditions

Status: approved (brainstorming), ready for `writing-plans`
Issue: levibroeksma/dart-analytics#165 — "121 now has to be played until 170 or abandoned. It should have round settings and a timed game mode version as well."

## Problem

121 v1 has exactly one end condition: check out the cap target (170). A player who
wants to stop sooner has no way to end the session as a completed game — the only
exit is "Leave game", which records the session as `ABANDONED`. This spec adds two
more end conditions, so stopping is a normal way for a 121 session to finish.

## Scope

In scope: a `duration_type` setting with three values — `TARGET` (today's climb-to-170,
unchanged), `ROUNDS` (stop after N attempts), `MINUTES` (stop after N minutes).

Out of scope (tracked in the ruleset doc's "Later versions" section, not touched here):
dart-budget selection (3/6/9), hard/extreme fail rules, safehouse. 121's dart budget
stays fixed at 9 (three visits) and its fail rule stays fixed at easy/stay, in every
`duration_type`.

## Decisions

- **All three end conditions coexist** as a `duration_type` setting; `TARGET` is not
  replaced.
- **A "round" = one attempt** at the current target (up to 3 visits / 9 darts) — the
  same unit the engine already opens one `ROUND` stage per, under the existing
  `roundStage()` naming. Not a visit.
- **Time cutoff lets the in-flight attempt finish.** When the clock reaches 0 mid-attempt,
  the session does not end immediately — the current attempt (however many of its
  visits remain) plays out to its normal resolution (checkout, bust, or exhausted
  budget) before the session completes. No attempt is ever cut off mid-throw.
- **`ROUNDS` and `MINUTES` are solo-only.** 1v1 keeps today's `TARGET` race-to-170
  as its only mode — same restriction Score Training's `MINUTES` and TUOD already
  carry, for the same reason: a wall-clock timer or a fixed round budget through
  alternating turns has no established win-condition shape in this codebase yet, and
  building one is unwarranted scope for what issue #165 asks for.
- **New ruleset version `121_V2`**, not an in-place edit of `121_V1`. `121_V1`'s
  config schema is `{}` (nothing configurable, cap fixed at 170) and is already live
  against real session data. Changing its schema would reinterpret every existing
  `121_V1` config snapshot's meaning after the fact. `121_V2` is a new, independent
  contract; `121_V1` stays exactly as shipped, forever replayable.

## Config schema (`121_V2`)

Flat `.strict()` Zod object with a `superRefine`, same shape convention as
`ScoreTrainingConfig`:

```ts
export const OneTwentyOneV2Config = z
  .object({
    duration_type: z.enum(["TARGET", "ROUNDS", "MINUTES"]),
    duration_value: z.number().int().optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.duration_type === "TARGET") {
      if (val.duration_value !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["duration_value"],
          message: "duration_value must be omitted for TARGET",
        });
      }
      return;
    }
    const [min, max] = val.duration_type === "ROUNDS" ? [1, 50] : [3, 30];
    if (
      val.duration_value === undefined ||
      val.duration_value < min ||
      val.duration_value > max
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["duration_value"],
        message: `duration_value must be between ${min} and ${max} for ${val.duration_type}`,
      });
    }
  });
```

`duration_value` is omitted entirely for `TARGET` (the cap is fixed at 170, not
player-chosen) — this is a difference from `ScoreTrainingConfig`, which always
carries a `duration_value`. Ranges (1–50 rounds, 3–30 minutes) mirror Score
Training's own clamps and are tunable at seed time without a spec change.

Registered in `services/rulesets/registry.ts` as `"121_V2": oneTwentyOneValidator`
(same validator function, now dispatching on capture mode exactly as it does today —
config parsing changes, mode-pair matrix does not).

## Engine

One `OneTwentyOneEngine` class continues to serve both `121_V1` and `121_V2` —
registered under both keys via two factory objects. `121_V1`'s factory always
constructs the engine with an internal `durationType: "TARGET"`, `duration_value`
ignored, regardless of what (empty) config it's handed — behavior is provably
identical to today, byte for byte.

Additions to `OneTwentyOneSeatState`:

- `attemptsCompleted: number` — incremented in `applyOneTwentyOneVisit`'s three
  resolution branches (checkout-climb, checkout-at-cap/WON, 3rd-visit fail-stay).
  Purely derived from folding the fact log, same as every other seat field; never
  persisted as its own value.

Additions to `OneTwentyOneEngine`:

- `expireTimer()` — sets an internal `timerExpired` flag, mirrors
  `ScoreTrainingEngine.expireTimer()`. No-op in effect unless `durationType ===
  "MINUTES"` (nothing reads the flag otherwise).
- `foldOneTwentyOneState(facts, config, timerExpired)` — gains the third parameter
  (mirrors `foldScoreTrainingState`), threaded through the derived
  `activeParticipantRef`/`status` computation.

`isComplete()` / `wouldComplete(input)` branch on `config.durationType`:

| `durationType` | Completion condition |
| --------------- | --------------------- |
| `TARGET` | Unchanged: `status === "WON"` (checkout at cap 170). |
| `ROUNDS` | `attemptsCompleted >= duration_value`. |
| `MINUTES` | `timerExpired && attemptsCompleted >= 1`. |

The `MINUTES` condition is what gives "finish the current attempt, then stop":
`attemptsCompleted` only increments when an attempt fully resolves, so
`isComplete()` reads false throughout an in-flight attempt no matter how long the
clock has been at zero, and flips true the moment that attempt's last visit closes.
This is the same mechanism Score Training's `durationSeatComplete` already uses for
its own `MINUTES` mode (`timerExpired && unitCount >= 1`) — 121 counts attempts
where Score Training counts visits, otherwise identical.

`wouldComplete(input)` gets the matching per-`durationType` branch so the play
page's existing finish-confirm gate (`showSessionFinishConfirm` /
`showDoubleConfirm`) fires before the completing visit or dart is recorded, exactly
as it already does for `TARGET`.

No other engine method changes. Bust matrix, checkout/double-out rule, fail-rule
(easy/stay), and dart budget (9) are untouched in every `durationType`.

## Capture / persistence shape

Unchanged from `121_V1` — this is a completion-condition change, not a capture
change:

- **Capture / input mode:** RECREATIONAL + QUICK_SCORE (one visit total per turn,
  no dart rows) and ANALYTICS + VISUAL_BOARD (one dart at a time), same matrix as
  today.
- **Stage type:** one `ROUND` per attempt, root stage (`parentClientKey: null`),
  exactly as today. A `ROUNDS`/`MINUTES` session simply stops opening new `ROUND`
  stages once `isComplete()` reads true, instead of stopping only at the cap.
- **Derived, never stored:** ladder position (`currentTarget`), live countdown
  within the open attempt (`remainingInAttempt`), visit counts, and the new
  `attemptsCompleted` — all folded from turn totals, none of them written as a
  fact.

## Frontend — setup

121's setup page currently uses the locked `createPresetSetupController` (single
seeded preset, nothing editable — matches v1's "config screen shown, locked"
spec). `121_V2` needs a real picker, so `oneTwentyOneSetup()` opts out of the
factory the same way `scoreTrainingSetup()` already does: a hand-written
controller with

- `durationType: "TARGET" | "ROUNDS" | "MINUTES"` radio, defaulting to `TARGET`
  (preserves today's experience as the default choice).
- a `duration_value` field, shown only for `ROUNDS`/`MINUTES`, seeded from that
  mode's own preset and clamped the same way `clampScoreTrainingDuration` clamps
  Score Training's.
- `forceTargetIfGuested()` — adding a guest locks `durationType` back to `TARGET`,
  mirroring `forceRoundsIfGuested()`'s reasoning: 1v1 has no established win
  condition for `ROUNDS`/`MINUTES` (see Decisions), so guest presence and those two
  modes are mutually exclusive at the UI level, not just the config layer.

Three seeded `configuration_templates` presets under `121_V2`: `121 — 170`
(`duration_type: TARGET`), `121 — 10 Rounds` (`duration_type: ROUNDS,
duration_value: 10`), `121 — 5 Minutes` (`duration_type: MINUTES,
duration_value: 5`) — mirrors TUOD's two-preset, player-picks pattern, extended to
three.

## Frontend — play

`/games/121/play` is shared by both ruleset versions (same route, same game type;
only the ruleset version differs) — the page must resume either:

- `resumeEngine` accepts a stored `rulesetVersionKey` of either `"121_V1"` or
  `"121_V2"` (both build the same `OneTwentyOneEngine` class) instead of checking
  against one hardcoded constant.
- `playAgain` creates its new session against whichever `rulesetVersionKey` the
  session being replayed actually used, not a hardcoded module constant — so
  replaying a `121_V1` session stays on `121_V1`, and a `121_V2` session stays on
  its own `duration_type`/`duration_value`.
- `state()`'s call to `foldOneTwentyOneState` passes `$store.game.timerExpired`
  as the new third argument.

New display, `durationType`-gated:

- `ROUNDS`: an attempt counter ("Attempt 3 of 10"), read off
  `attemptsCompleted`/`duration_value`.
- `MINUTES`: a countdown label, built the same way Score Training's is —
  `SegmentTimer` driving `$store.game.timerRemainingMs` /
  `timerStartedAt` / `timerExpired`, which are already general-purpose store
  fields (no store changes needed). `engine.expireTimer()` is called from the
  timer's `onComplete`, exactly as `score-training-play.data.ts`'s
  `startCountdown` does.

`computeStats`'s hardcoded `target: 170` generalizes to "ladder reached"
(`seat.currentTarget`) — still reads 170 for a `TARGET` session that actually won,
since that is where a won ladder ends; for `ROUNDS`/`MINUTES` it reports wherever
the ladder stood when the session completed.

Existing "Leave game" (`abandonAndExit`, records `ABANDONED`) is unchanged and
stays available in every mode — it remains the way to quit *before* the configured
rounds/time budget is reached. The feature this spec adds is that reaching the
budget is now itself a normal `COMPLETED` ending, not a forced abandon.

## Database

Following `05-Database/10-Database-Agent-Guide.md` §"Add a new game type" (steps
1–5 are the only DB work; this is a same-game_type new-ruleset-version case, so
step 1 — the `game_types` row — is skipped, `ONE_TWENTY_ONE` already exists):

1. New `ruleset_versions` row: `121_V2`, same `game_types` row as `121_V1`.
2. `configuration_templates`: three presets (see Frontend — setup above).
3. `game_type_features` / `exercise_templates`: none needed — no new feature flags
   introduced by this change.
4. New seed file, next unused number, `00NN_one_twenty_one_v2_game_engine_reference.sql`.
5. Verification script `00NN_one_twenty_one_v2_capability_checks.sql`.

No new migration — no schema change, only new seed rows and a new capability row
in the existing `0007_ruleset_version_capabilities.sql` shape.

## Testing

- `modules/game/one-twenty-one.engine.module.test.ts`: extend for `attemptsCompleted`
  folding and the three `isComplete()`/`wouldComplete()` branches, including the
  mid-attempt-timer-expiry-does-not-complete case and the `121_V1` factory's
  behavior staying `TARGET`-only regardless of a (still-empty) config.
- `services/rulesets/one-twenty-one/one-twenty-one.validator.test.ts`: extend for
  `OneTwentyOneV2Config`'s `superRefine` (omitted `duration_value` on `TARGET`,
  range checks on `ROUNDS`/`MINUTES`).
- `lib/game/one-twenty-one-setup.data.test.ts`: new/expanded — mirrors
  `score-training-setup.data.test.ts` for the `durationType` picker and
  guest-forces-`TARGET` behavior.
- `lib/game/one-twenty-one-play.data.test.ts`: extend for resuming either ruleset
  key, the round counter, and the countdown/`expireTimer` wiring.
- Shared gates: `app/tests/lib/game/rulesets/capabilities.test.ts` and
  `games-visibility.test.ts` pick up the new key automatically per existing
  patterns; `scripts/check-game-engines.sh` / `check-game-wiring.sh` must stay
  green.

## Open questions

- Exact default `duration_value`s for the seeded `ROUNDS`/`MINUTES` presets (10
  rounds / 5 minutes proposed above, matching TUOD's and Score Training's own
  defaults) — tunable at seed-review time, not a design blocker.
