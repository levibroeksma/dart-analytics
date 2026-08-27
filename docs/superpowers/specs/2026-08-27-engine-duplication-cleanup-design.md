# Engine Duplication Cleanup

## Purpose

An audit of all 9 `*.engine.module.ts` files against Pattern 18 and the
already-extracted shared modules (`turn-log.module.ts`, `seat-state.module.ts`,
`match-outcome.module.ts`, `checkout-darts.module.ts`) found two remaining
pockets of duplication worth extracting, plus stale `docs/game-rules/`
raw-notes discovered while comparing engine behavior to its source material.
Everything else audited (seat-rota, turn-log, match-outcome usage; Pattern
18-21 doc accuracy) was already consistent — not in scope here.

Explicitly deferred (raised, not pursued this pass): the `isDartObservation`
guard duplicated 3x, the six identical literal `STAGE` constants, the two
different "state before this visit" techniques (501 sums manually; 121/TUOD
slice-and-refold), and why `fallow`'s duplication gate didn't flag any of
this. None of these block F1/F2 below; each can become its own small task
later.

## Scope

1. **F1 — double-out bust/checkout rule**, hand-duplicated across 501, 121,
   and TUOD.
2. **F2 — `otherSeatsComplete` generalization** so TUOD and Score Training
   stop reimplementing it inline. (Numbered F2 here; was "F3" in the earlier
   audit pass — F1's sibling "isDartObservation" finding was dropped from
   scope, see Explicitly deferred above.)
3. **Doc corrections** — `docs/game-rules/rulesets/*.md` entries that no
   longer match shipped engine behavior, found while checking F1/F2 against
   their source material.

## F1 — `checkout-bust.module.ts`

### Problem

The bust/checkout rule — *overshoot busts; leaving exactly 1 busts (D1 = 2,
can't finish 1 on a double); reaching exactly 0 without a double busts* — is
hand-written five times:

| File | Site | Shape |
| --- | --- | --- |
| `five-oh-one.engine.module.ts` | `resolveFiveOhOneVisit` | keypad total |
| `five-oh-one.engine.module.ts` | `FiveOhOneEngine.settleVisit` | dart-by-dart |
| `one-twenty-one.engine.module.ts` | `resolveOneTwentyOneVisit` | keypad total |
| `one-twenty-one.engine.module.ts` | `OneTwentyOneEngine.settleVisit` | dart-by-dart |
| `tuod.engine.module.ts` | `visitOutcome` | dart-by-dart |

121's and TUOD's own doc comments already say "mirrors 501's bust matrix" —
the duplication was noticed and copied anyway. Three more sites reimplement
just the `checkedOut` half for `wouldComplete()`: 501's
`dartChecksOutFinalLeg`, 121's `wouldCompleteDart`, and TUOD's
`wouldCompleteDart` (which already reuses its own `visitOutcome`, so only
501 and 121 need this half fixed too).

### Design

New sibling module next to `checkout-darts.module.ts` and
`checkout-path.module.ts`:

```
modules/game/checkout-bust.module.ts

resolveCheckoutAttempt(remainingBefore: number, scored: number, endedOnDouble: boolean)
  → { remainingAfter: number; checkedOut: boolean; busted: boolean }
```

Pure, no ruleset content — exactly the bar D232 already set for
`turn-log.module.ts`/`seat-state.module.ts`. It does **not** absorb either
engine-specific extra condition:

- 121's `finalVisitHasNoFinishLeft` (the attempt's 3rd visit closes early
  once no double-out route is reachable with the darts left) stays local and
  ORs into `busted`/resolution after the shared call.
- TUOD's odd-remainder-with-one-dart-left early bust stays local, same way.

Both are ruleset-specific escalations of the same base rule, not instances
of it — folding them into the shared function would make it TUOD/121-shaped
instead of universal, which is the over-engineering this audit is trying to
avoid, not add.

Call-site changes (5 mutating sites + 2 `wouldComplete` sites, all
behavior-preserving — no engine's `state()`/`facts()` output changes):

- `resolveFiveOhOneVisit`, `FiveOhOneEngine.settleVisit`,
  `resolveOneTwentyOneVisit`, `OneTwentyOneEngine.settleVisit` call
  `resolveCheckoutAttempt` directly and map its result onto their own return
  shape (`FiveOhOneVisitOutcome` / `OneTwentyOneVisitOutcome` keep their own
  field names — `wonLeg` vs `checkedOut` — the shared function does not
  dictate the caller's vocabulary).
- `TuodEngine`'s `visitOutcome` calls it, then ORs its own odd-remainder
  condition into `busted`.
- 501's `dartChecksOutFinalLeg` and 121's `wouldCompleteDart` call it and
  read `.checkedOut` instead of hand-rolling the same zone/remainder check.

### Non-goals

- Not touching the write path's stage-opening logic (leg/round push) — only
  the bust/checkout boolean, not when a new `LEG`/`ROUND` stage opens.
- Not touching `remainingBeforeVisit`/`seatBeforeVisit`/`targetBeforeVisit`
  (the "state before this visit" helpers) — that's the deferred F5-style
  inconsistency, out of scope.

## F2 — `otherSeatsComplete` generalization

### Problem

`seat-state.module.ts`'s `otherSeatsComplete(seats, participantRef)` is
hardcoded to `seat.status === "COMPLETE"`. TUOD's seat state and Score
Training's seat state carry no `status` field (completion is duration-based:
`durationSeatComplete(config, unitCount, timerExpired)`), so they can't call
it and reimplement the same `filter().every()` inline instead — twice in
TUOD (`wouldCompleteDart`, `wouldComplete`), once in Score Training
(`wouldComplete`).

### Design

Add a predicate parameter, mirroring the injection idiom this file already
uses for `activeSeat()`'s 4th argument and `completedByIndex()`:

```
otherSeatsComplete<TSeat extends SeatState>(
  seats: readonly TSeat[],
  participantRef: string,
  isComplete: (seat: TSeat) => boolean,
): boolean
```

Call-site changes:

- **Existing 3 callers** (`AroundTheClockEngine`, `SinglesTrainingEngine`,
  `DoublesTrainingEngine`) add one argument:
  `(seat) => seat.status === "COMPLETE"` — no behavior change.
- **TUOD** (2 sites) passes
  `(seat) => durationSeatComplete(this.config, seat.attempts, this.timerExpired)`,
  replacing its inline filter+every block in both `wouldCompleteDart` and
  `wouldComplete`.
- **Score Training** (1 site) passes
  `(seat) => durationSeatComplete(this.config, seat.turnCount, this.timerExpired)`,
  replacing its inline block in `wouldComplete`.

### Rejected alternative

A second function `otherSeatsBudgetComplete` for the duration case, leaving
the 3 existing callers untouched. Rejected: two functions doing the same
job under different names is the same drift this task exists to remove,
just with a smaller footprint.

## Doc corrections (`docs/game-rules/rulesets/`)

These files are non-canonical, pre-spec raw notes (per
`docs/game-rules/README.md`) — not authoritative, not covered by
`check-context-map.sh`. But the Context Map's "New game engine" pack tells
a future agent to check the matching file before touching a game engine, so
a stale one actively misleads. Found while checking F1/F2's three engines
against their source material; the staleness turned out to be systemic
across all 9.

1. **Stale "Multiplayer: TBD."** 1v1 shipped 2026-08-22 for 121, TUOD,
   Score Training, Bob's 27, Around the Clock, Shanghai, Singles Training,
   Doubles Training (confirmed in the engine code: all build multi-seat
   state via `foldSeatStates`/`scoreCompareOutcome`/`raceWinner`/
   `eliminationWinner`). Only `501.md`'s Features table reflects it
   (`Multiplayer (1-4 seats, one per side) | V1`). Fix: update the
   Features-table `Multiplayer` row in the other 8 files to `V1`, with a
   one-line seat-count/win-condition note matching 501.md's style.
2. **Singles Training / Doubles Training misclassify shipped work as
   future.** Their 1v1 description sits under "Later versions (V2+) →
   Variants — Multiplayer (1v1)" instead of the Objective section every
   other game uses for its shipped 1v1 line. Fix: move that content up into
   Objective, phrased like the other 6 games' "**1v1:** ..." bullet.
3. **`501.md`'s Known-limitations/Open-questions are resolved but not
   marked so.** They read bust rate as "not computable at all," recovery as
   requiring a future "DETAILED_DARTS capture for 501." The engine already
   implements a dart-by-dart (VISUAL_BOARD) capture path where a busted
   visit keeps its real dart rows precisely so bust rate is computable
   (`FiveOhOneEngine`'s own doc comment: "that divergence is the fact that
   makes bust rate computable"). Fix: add a resolution note mirroring
   `ten-up-one-down.md`'s existing "Retired for ANALYTICS + VISUAL_BOARD
   sessions" section — QUICK_SCORE keeps the known limitation, VISUAL_BOARD
   doesn't have it.
4. **`121.md` is missing a Capture section** (every other implemented
   ruleset doc has one) and doesn't document the final-visit
   early-bust-on-unreachable-remainder rule (`finalVisitHasNoFinishLeft`) —
   the same kind of rule TUOD's doc documents for itself under "Early bust
   on an unfinishable odd remainder." Fix: add a Capture section mirroring
   501's/TUOD's, and a Bust-section note for the final-visit rule, timed
   with the F1 module touching that exact code.

## Testing

- New `app/tests/modules/game/checkout-bust.module.test.ts` covering
  `resolveCheckoutAttempt` directly: overshoot, exactly-1, exactly-0 with/
  without double, ordinary in-range score.
- `otherSeatsComplete`'s existing test coverage (in
  `seat-state.module.test.ts`) gains a case exercising the new predicate
  parameter; TUOD's and Score Training's existing engine tests are the
  regression check for their inline-block removal — both refactors are
  behavior-preserving, so no existing test's expected output changes.
- `npm run validate:app` (includes `fallow`, the full Vitest suite, and
  `astro check` at the zero-hint bar) before considering either module done,
  per `app/CLAUDE.md`.
- Doc corrections are Markdown-only edits to non-canonical files — no gate
  in `validate:app` covers them (`check-context-map.sh` doesn't scan
  `docs/game-rules/`), so no automated check confirms them; review by eye
  against the engine code cited above is the verification.

## Open questions

None — F1 and F2 are pure, behavior-preserving refactors of existing,
tested logic; the doc corrections are additive/corrective edits to
non-canonical notes with no schema or contract implications.
