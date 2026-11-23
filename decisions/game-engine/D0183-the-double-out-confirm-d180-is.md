---
id: D0183
status: accepted
date: 2026-08-02
origin: contemporaneous
original-date:
tags: [game-engine, engine, checkout, leg, visit, bust]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The double-out confirm (D180) is now three actions

## Context and Problem Statement
The prior two-button gate had no way to back out of a mistyped score, and clicking "Yes" on a match-winning visit recorded and uploaded immediately with no way back — a fat-finger there could not be undone. User-approved redesign from the final whole-branch review, approved 2026-08-02

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Keep the two-button gate (Yes / Bust-miss) that D180 introduced.
* Three actions: Cancel, Bust/miss, Yes (chosen).

## Decision Outcome
Chosen option: "The double-out confirm (D180) is now three actions — Cancel (`cancelCheckout`, restores the score to the keypad, records nothing), Bust/miss (`denyDouble`, unchanged), Yes (`confirmDouble`) — instead of two, and `submitVisit`'s gate now also requires `checkoutPathFor(remaining) !== null` so the seven bogey numbers and 171-180 skip the dialog entirely and record straight as a bust. "Yes" no longer always records immediately: it calls the pure `engine.wouldComplete({ scoreAttempted, finishedOnDouble: true })` (D181's match-win, not leg-win, predicate) and only records right away when the checkout merely wins a leg; when it would end the match, it opens a second confirm (`showMatchFinishConfirm`/`confirmMatchFinish`/`cancelMatchFinish`) and defers recording until the player confirms, since `recordVisit` uploads and `PATCH COMPLETED`s the session as soon as it sees a match win, and `undoVisit` is guarded off once `finished` is set".

### Consequences
* Good, because the seven bogey numbers and 171-180 record straight as a bust without a dialog that has no legal "yes" answer.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/five-oh-one-play.data.test.ts` covers the 7 scenarios the plan lists: unfinishable-remainder bypass, dialog opens, Cancel, Bust/miss, leg win, match-win second confirm, cancel of the second confirm.

## Pros and Cons of the Options
### Keep the two-button gate
* Bad, because it had no way to back out of a mistyped score.
* Bad, because "Yes" on a match-winning visit recorded and uploaded at once, with no way back.

### Three actions: Cancel, Bust/miss, Yes
* Good, because Cancel restores the score to the keypad and records nothing.
* Good, because a match-ending checkout opens a second confirm and defers recording and upload until the player confirms.

## Evidence / More Information
Decided: 2026-08-02

* `docs/superpowers/plans/2026-08-01-501-recreational-v1.md` (the redesign note in the play-page task): rebuilt Considered Options, Pros and Cons, Consequences and Confirmation. It says the human approved the redesign on 2026-08-02.
* Commit `c40fb8ec` (PR #66, 2026-08-02; adds the D183 row).
