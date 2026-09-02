# Design: TUOD hardening (F10, F18, F21)

> status: historical record once implemented — specs are never rewritten
> (`docs/CLAUDE.md`)

Closes FINDINGS.md F10, F18, F21. Three independent TUOD items, bundled as
one spec — split at review/PR time if that reads better than one branch.

## Task 1 — F10: the checkout ladder has no ceiling on success

`applyTuodAttempt` (`app/src/modules/game/tuod.engine.module.ts:148-165`)
floors the target at `MIN_FINISHABLE_TARGET` (2) on a miss but has no
matching ceiling on a success — the success branch is
`state.currentTarget + config.finishBonus`, unbounded. A long run of
checkouts can walk the ladder past 170, the highest three-dart double-out
total that exists on a standard board; `checkoutPathFor` returns null for
every target above it (and for the bogey numbers on the way).

Verified unreachable today: `tuod.validator.ts`'s own `maxTurnScore`
computes the real ceiling for the seeded ROUNDS preset as
`starting_target + finish_bonus * (duration_value - 1)` = 131, well below
170. It becomes reachable only once `duration_value` or `finish_bonus`
is exposed as user-editable — neither is today (`TuodSetupForm.astro` and
`tuod-setup.data.ts` carry no such field).

Landing on a bogey number already self-heals: `submitVisit` skips the
checkout dialog when the chart has no route, so the target drops by
`missPenalty` each attempt until it re-enters the chart (matches 501's
bogey-number behaviour, D217) — this holds whether the bogey is below or
above 170. So the only real gap is the ladder being able to climb to a
target strictly above 170, which the finding's own first option closes
most simply.

Fix: cap the success branch at 170, mirroring `MIN_FINISHABLE_TARGET`'s
existing floor:

```ts
/**
 * The ladder ceiling: the highest three-dart double-out total that exists
 * on a standard board (T20 T20 D25). A success climbs the ladder by
 * `finishBonus` with no cap of its own; clamping here keeps it from
 * walking onto a target no double can ever finish. Duplicated from
 * `tuod.validator.ts`'s own `MAX_THREE_DART_CHECKOUT` rather than shared
 * across the services/engine layer boundary — same value, same reasoning,
 * independently arrived at there already.
 */
const MAX_FINISHABLE_TARGET = 170;
```

```ts
currentTarget: succeeded
  ? Math.min(MAX_FINISHABLE_TARGET, state.currentTarget + config.finishBonus)
  : Math.max(
      MIN_FINISHABLE_TARGET,
      state.currentTarget - config.missPenalty,
    ),
```

A target that lands exactly on 170 or on a bogey below it is unaffected —
this only changes the case that previously exceeded 170.

## Task 2 — F18: already resolved, close the finding

F18 claimed `TenUpOneDownResults.astro`'s live-stats `<dl>` block showed
combined-seat data (unfiltered `turns.length`/`currentTargetLabel()`)
during the post-match save window. That block no longer exists: commit
`21f2a04` ("Result modal consolidation: shared summary components, 1v1
stats data-layer fix, title extraction (#211)", 2026-08-30 — after F18 was
filed 2026-08-22) replaced it with `SinglePlayerSummary`/`ComparisonSummary`,
whose `pending`/`saving` state now renders `StatRowSkeleton` placeholders
(`bg-muted-foreground/80 animate-pulse`) instead of reading any seat data
at all. Nothing is shown, correct or otherwise, during that window — the
finding's own concern cannot occur under the current markup.

Fix: no code change. Remove the F18 entry from `FINDINGS.md` (delete on
resolution, per root `CLAUDE.md`).

## Task 3 — F21: a solo MINUTES TUOD session can get permanently stuck once the timer expires mid-session

`TuodEngine.rejectionReason`, `recordDart`, `wouldCompleteDart`, and
`wouldComplete` (`app/src/modules/game/tuod.engine.module.ts:293-530`) all
throw or answer `false` whenever `this.isComplete()` is already `true` —
with no carve-out for solo sessions. For a MINUTES session,
`durationSeatComplete` reads `timerExpired && unitCount >= 1`, so a solo
session's `isComplete()` goes `true` the instant the timer expires, as
long as one attempt already exists — ahead of whatever attempt the player
is mid-way through when the clock runs out. From that point,
`wouldCompleteDart`/`wouldComplete` both answer `false` (never `true`, so
`showFinishConfirm` never opens), and the fallback `engine.record(input)`
throws — on every subsequent attempt, with no path back to a finished,
uploadable session.

`ScoreTrainingEngine` had the identical shape and was already fixed by
D229: its `record()`/`wouldComplete()` guard against `isMatchDecided()`
(`score-training.engine.module.ts:166-169`) — `state.seats.length > 1 &&
state.status !== "IN_PROGRESS"` — deliberately narrower than
`isComplete()`, which stays available for `score-training-play.data.ts`'s
own `submitVisit` to consult directly. A solo session is exempt from
`isMatchDecided()` by construction, so its last MINUTES attempt is never
blocked from being recorded; `isComplete()` remains the play layer's own
signal for when to stop offering more input, unrelated to what `record()`
itself will accept.

Fix: give `TuodEngine` the same `isMatchDecided()` guard, and swap it in
everywhere the four methods currently call `this.isComplete()`:

```ts
/**
 * Whether the WHOLE (2-seat) session's score-compare outcome is already
 * settled. Deliberately narrower than `isComplete()`, mirroring
 * `ScoreTrainingEngine.isMatchDecided()` (D229): a solo session is exempt
 * here because MINUTES completion there is driven by `timerExpired`, an
 * external signal `expireTimer()` can set mid-attempt — `isComplete()` can
 * already read true before the one finishing attempt still needs to be
 * recorded, so a solo session's own boundary is that attempt-count-based
 * `isComplete()` reading, left to `tuod-play.data.ts` to consult directly,
 * never enforced here. A 1v1 match carries no such risk: it is
 * ROUNDS-only, so `status` only turns terminal as the direct result of
 * the very record call that reaches the last seat's budget.
 */
private isMatchDecided(): boolean {
  const state = this.deriveState();
  return state.seats.length > 1 && state.status !== "IN_PROGRESS";
}
```

- `rejectionReason` (line 297): `this.isComplete()` → `this.isMatchDecided()`.
- `recordDart` (line 375): same swap.
- `wouldCompleteDart` (line 455): same swap.
- `wouldComplete`'s non-dart branch (line 513) carries no direct
  `isComplete()` call of its own — it already defers to `rejectionReason`
  (`if (this.rejectionReason(activeSeatState, input) !== null) return
  false;`), so fixing `rejectionReason` fixes this branch too; no separate
  edit needed here.

`isComplete()` itself is unchanged — `tuod-play.data.ts` keeps consulting
it exactly as it does today (mirrors `score-training-play.data.ts`'s own
`submitVisit`, per that file's comment at lines 428-432).

## Testing

- Task 1: add a case to `app/tests/modules/game/tuod.engine.module.test.ts`
  driving a ROUNDS config with a `finish_bonus`/`duration_value` combination
  whose ladder ceiling would exceed 170 on an all-success run, asserting
  `currentTarget` never exceeds 170.
- Task 2: doc-only; no test file (`scripts/check-test-coverage.sh` only
  gates `app/src/`/`app/scripts/` runtime files).
- Task 3: add the regression case the finding's own evidence names —
  `app/tests/lib/game/tuod-play.data.test.ts`, recording one MINUTES
  attempt, expiring the timer, then completing via a second attempt,
  mirroring `score-training-play.data.test.ts`'s "drives a MINUTES session
  to completion once the timer expires". Also add a direct unit case to
  `app/tests/modules/game/tuod.engine.module.test.ts` covering the same
  sequence against `TuodEngine` directly (matching how the finding's own
  ad hoc reproduction was framed), plus a 1v1 case confirming
  `isMatchDecided()` still blocks a `record()` call after a 2-seat match's
  outcome is settled (no regression on the existing multi-seat guard).

## Non-goals

No change to `checkout-path.module.ts` or `checkoutPathFor`'s bogey-number
behaviour (Task 1 relies on it unchanged). No change to
`ScoreTrainingEngine` (already correct, used only as the reference
pattern). No change to `tuod-setup.data.ts`/`TuodSetupForm.astro` to
expose `finish_bonus`/`duration_value` as editable — Task 1 only closes
the gap those fields would otherwise open. No change to MINUTES TUOD's
solo-only capture restriction (out of scope, per the engine module's own
existing comment on 1v1 MINUTES being a separate deferred problem).
