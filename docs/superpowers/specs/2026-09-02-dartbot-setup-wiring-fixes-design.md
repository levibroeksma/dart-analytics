# Design: DartBot & 1v1 setup-wiring fixes

> status: historical record once implemented — specs are never rewritten
> (`docs/CLAUDE.md`)

Closes FINDINGS.md F54, F45, F55, F56, F57. All five touch participant/seat
wiring around DartBot and 1v1 setup, and share code paths
(`session-mode-resolution.ts`, `session-seats.service.ts`,
`setup-controller.ts`), so they're bundled into one spec as five independent
tasks — split at review/PR time if that reads better than one branch.

## Task 1 — F54: 501 setup can't seat a DartBot

`FiveOhOneSetupContext`/`fiveOhOneSetup()` never received the
`bot`/`addBot`/`removeBot`/`showOpponentChooser` state `PresetSetupContext`
already carries (`app/src/lib/game/setup-controller.ts:44-141`). 501 doesn't
route through `createPresetSetupController` — it hand-rolls `start()` for its
legs/starting-score overrides — so it never picked the fields up.

Fix:

- Add `bot: { level: number } | null`, `showOpponentChooser: boolean`,
  `addBot()`, `removeBot()` to `fiveOhOneSetup()` and `FiveOhOneSetupContext`
  (`app/src/lib/game/types.ts`), mirroring `setup-controller.ts`.
- `addBot()` delegates to `addBotOpponent(this)` (`@lib/game/guest-list`),
  same as the preset controller.
- `start()`'s `participantsFromGuests(this.guests)` becomes
  `participantsFromGuests(this.guests, this.bot)`.

## Task 2 — F45: 121 and Singles Training can't start a 1v1

Both hardcode a `_V2` ruleset key regardless of guest count.
`session-seats.service.ts`'s `SEAT_CAPS` grants a 2-seat cap only to
`121_V1`/`SINGLES_V1` — any `_V2` request with 2 participants is rejected
(`"{key} supports at most 1 seat."`).

Fix, per game:

**121** (`app/src/lib/game/one-twenty-one-setup.data.ts`): resolve the
ruleset key from `this.guests.length` at `start()` time — `121_V1` when
guested, `121_V2` solo. `121_V1`'s seeded preset config carries no
`duration_type` key at all (an empty `{}` schema — `one-twenty-one.engine.
module.ts:44-54`), so `presetForMode()` never matches it today; the guested
branch must resolve the `121_V1` preset directly (by ruleset/template
identity, not by `duration_type`) and omit duration overrides entirely. This
is consistent with `forceTargetIfGuested()`'s existing assumption that a
guested 121 session has no duration concept — it already forces `durationType
= "TARGET"` on guest add; it just never followed through to the ruleset key.

**Singles Training** (`app/src/lib/game/singles-training-setup.data.ts`):
resolve `SINGLES_V1` when guested, `SINGLES_V2` solo. Both versions'
config schemas (`SinglesConfig`/`SinglesV2Config`,
`app/src/lib/game/rulesets/types.ts:72-121`) share every field and the same
seeded preset row (`0013_singles_training_v2_game_engine_reference.sql`'s
own note: no second preset was seeded specifically to avoid ambiguity), so no
preset-resolution change is needed. `SINGLES_V1`'s `difficulty` enum is
`["EASY"]` only (V2 adds `HARD`/`EXTREME`), so adding a guest must force
`difficulty` back to `"EASY"` if a harder one was selected — mirroring 121's
guest-forces-a-narrower-mode pattern.

## Task 3 — F55: QUICK_SCORE bot-visit fold records the wrong turn

`playFoldBotQuickScoreVisit`'s loop (`app/src/lib/game/play-lifecycle.
ts:311`) runs `for (i = 0; i < dartsPerVisit && !scratch.isComplete(); i++)`.
`isComplete()` only reports whole-match completion. A 501 bust or checkout
before the third dart closes the *current visit*
(`FiveOhOneEngine.recordDart`/`settleVisit`) and, on a non-final checkout,
opens a new leg stage — neither flips `isComplete()`. The loop's next
iteration then finds no open visit, calls `openNewVisit()`, and the function
returns that fabricated turn instead of the bot's real one.

Fix: stop the loop as soon as the visit it just recorded into closes —
check the scratch engine's own last turn for `completedAt !== null` (or
equivalent: no open visit) after each `record()` call, in addition to the
existing `isComplete()` check.

## Task 4 — F56: seat-fact fallbacks mislabel a bare DARTBOT seat

`toSeatFacts` (`app/src/lib/game/session-mode-resolution.ts:58`) and
`composeSeatFacts` (`app/src/services/session-seats.service.ts:102`) both
guard their DARTBOT branch on `participantTypeKey/Id === DARTBOT &&
<dartbot payload present>`, falling through to a PLAYER/GUEST branch when the
payload is absent instead of erroring — the "two collapses point in opposite
directions" anti-pattern `08-DartBot.md` names as actively dangerous
(client-side PLAYER, server-side GUEST, for the same seat). Unreachable
today — `buildSeatPlan` (`app/src/services/session.service.ts:251-291`)
always attaches `dartbot` when constructing a DARTBOT seat — but nothing
enforces the invariant.

Fix: narrow both conditions to the type discriminant alone
(`participantTypeKey === "DARTBOT"` / `participantTypeId ===
DARTBOT_PARTICIPANT_TYPE_ID`) and throw when `dartbot` is unexpectedly absent
in that branch, rather than falling through to a different participant type.

## Task 5 — F57: scatter ellipse doesn't rotate to the aim angle

`scatterOffset` (`app/src/modules/dartbot/throw-engine.module.ts:17-26`)
rotates the along/across offset only by `profile.covarianceRotationDegrees`
— a per-level constant, `0` for all 15 rows of `LEVEL_SKILL_TABLE`
(`skill-profile.module.ts`) pending D-E's population fit. It never reads
`resolveAimPoint`'s own polar angle, so the rotation is board-relative (or,
once D-E lands, level-relative), not target-relative. `08-DartBot.md`'s own
illustration — "a strong player's misses stay on the 20 wire (T5/T1)" — reads
as target-relative rotation, which the current model cannot produce for an
arbitrary target.

Latent, not observable today (constant is `0` for every level), so this is a
decision rather than a bug fix:

- **(a)** Derive rotation from the aim point's own polar angle, in addition
  to or instead of the level constant.
- **(b)** Reword `08-DartBot.md` to describe `covarianceRotationDegrees` as a
  fixed per-player technique bias, not a wire-relative rotation.

**Decision: (b).** A one-line doc edit; keeps the model as currently fitted;
defers the real target-relative-rotation question to when D-E actually
populates non-zero values, where it can be designed against real production
data instead of a guess. No code change.

## Testing

- Tasks 1–2: extend `five-oh-one-setup.data.test.ts` /
  `one-twenty-one-setup.data.test.ts` / `singles-training-setup.data.test.ts`
  for the new/changed paths (bot seating; guested ruleset-key selection);
  live-verify a 1v1 start on `/games/501/setup`,
  `/games/121/setup`, `/games/singles-training/setup`.
- Task 3: add a `play-lifecycle.test.ts` case using a 501-shaped scratch
  factory that busts or checks out before the third dart — the file's
  existing coverage only uses Score Training's fixed-3-dart factory, which
  can't exercise this path.
- Task 4: one test per function asserting the throw when `dartbot` is absent
  on a DARTBOT-typed input.
- Task 5: none — doc-only.

## Non-goals

No change to `SEAT_CAPS`, `RULESET_CAPABILITIES`, or any engine module's
gameplay rules. No change to the D-E fitting pipeline.
