---
id: D0304
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [testing, test, mock, fixture, suite]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# A store the routine wraps is tested through the real store, never only through a double

## Context and Problem Statement
every Finishing-step defect so far (#216, #357, #370) has lived in that seam, and the suite could not distinguish "the routine advances" from "the routine can be reached at all". The one test file that owned the step replaced `tuodPlay` with a hand-written object whose `uploadAndCompleteSession` just set `completionStatus`, so the sequence that actually hangs — the store raising `showFinishConfirm` and waiting for a dialog — executed nowhere. A double asserts the arguments the wrapper passes; it cannot assert that the inner store ever reaches the wrapper's override. Deleting the gate's `return` in `tuod-play.data.ts` fails three of the five new cases and none of the old ones, which is the gap stated as a measurement.

## Decision Drivers
* Every Finishing-step defect so far (#216, #357, #370) lives in the seam between the routine and the store it wraps.
* The suite cannot tell "the routine advances" from "the routine can be reached at all".

## Considered Options
* Test the wrapper only against a hand-written double of the inner store (the existing test).
* Add a seam test over the real inner store, and keep the double-based test (chosen).

## Decision Outcome
Chosen option: "`app/tests/lib/training/finishing-step-seam.test.ts` drives the Finishing step over a real `tuodPlay()` — real engine, real `recordDart`/`wouldComplete`/`confirmFinish`, only `@client/api/sessions` and `SegmentTimer` mocked — and asserts the whole path a player takes to complete the step, including that the finish confirm is raised without advancing, that confirming advances exactly once, that a failed upload holds the routine in place, and that `resultsSnapshot` is populated for the summary to read. The existing `finishing-step.data.test.ts` keeps its `vi.mock` of `tuodPlay`: it pins the wrapper's own contract cheaply and independently of TUOD's rules. The rule generalises past this file — wherever one store wraps another and overrides part of its behaviour, the seam between them is covered against the real inner store, not only against a double.".

### Consequences
the seam test carries a `$store` stub of the same shape `tuod-play.data.test.ts` maintains, so a change to the game store's fields now lands in two fixtures rather than one. That duplication is accepted over extracting a shared fixture, because the two files deliberately stub different sessions — the standalone game's and the routine's timer-expired MINUTES step — and a shared builder would hide which fields each case depends on. The test is bounded to the Finishing step: the Switching and Doubles steps drive engines directly rather than wrapping a play store, so they have no equivalent seam. It proves the store reaches the routine's advance; it proves nothing about the page markup that renders the dialogs, which `app/tests/pages/training/finishing-step-gates.test.ts` owns.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The commit proved the seam test non-vacuous by mutation. Deleting the gate's `return` in `tuod-play.data.ts` fails 3 of the 5 new cases and none of the old ones. Removing the `completionStatus` guard in `finishing-step.data.ts` fails a fourth.

## Pros and Cons of the Options
### Double-based test only
* Good, because it pins the wrapper's contract cheaply and independently of TUOD's rules.
* Bad, because a double asserts the arguments the wrapper passes. It cannot show that the inner store reaches the wrapper's override.

### Seam test over the real store
* Good, because it runs the whole path a player takes to complete the step.
* Bad, because the `$store` stub now lives in 2 fixtures. The commit and record accept that over a shared builder.

## Evidence / More Information
Decided: 2026-09-17

* Commit `272844cb` (PR #415, 2026-09-17; message and the D304 row): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
