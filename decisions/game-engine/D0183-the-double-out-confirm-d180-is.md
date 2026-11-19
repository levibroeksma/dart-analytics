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
<!-- backfill: pending -->

# The double-out confirm (D180) is now three actions

## Context and Problem Statement
The prior two-button gate had no way to back out of a mistyped score, and clicking "Yes" on a match-winning visit recorded and uploaded immediately with no way back — a fat-finger there could not be undone. User-approved redesign from the final whole-branch review, approved 2026-08-02

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "The double-out confirm (D180) is now three actions — Cancel (`cancelCheckout`, restores the score to the keypad, records nothing), Bust/miss (`denyDouble`, unchanged), Yes (`confirmDouble`) — instead of two, and `submitVisit`'s gate now also requires `checkoutPathFor(remaining) !== null` so the seven bogey numbers and 171-180 skip the dialog entirely and record straight as a bust. "Yes" no longer always records immediately: it calls the pure `engine.wouldComplete({ scoreAttempted, finishedOnDouble: true })` (D181's match-win, not leg-win, predicate) and only records right away when the checkout merely wins a leg; when it would end the match, it opens a second confirm (`showMatchFinishConfirm`/`confirmMatchFinish`/`cancelMatchFinish`) and defers recording until the player confirms, since `recordVisit` uploads and `PATCH COMPLETED`s the session as soon as it sees a match win, and `undoVisit` is guarded off once `finished` is set".

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-02
