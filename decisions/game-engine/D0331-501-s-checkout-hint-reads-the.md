---
id: D0331
status: accepted
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [game-engine, engine, checkout, 501, leg, visit, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# 501's checkout hint reads the darts left too, and one shared helper computes them

## Context and Problem Statement
Issue #498. D330 fixed 121 and TUOD, but 501 — the game the hint is used most on — never had a darts-left input at all: with two darts thrown and 100 left it still read "T20 D20". TUOD's private copy of the helper was the only thing standing between 501 and the same fix, and duplicating it a third time to close #498 would have been the wrong trade.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`dartsLeftForSeat(turns, seatRef, maxDartsPerTurn)` moves out of `tuod-play.data.ts` into `play-visit-stats.ts` as a shared export; 501's `checkoutHintFor` computes darts left from the open visit in the current leg and renders `checkoutPathWithin` (D330), and `checkoutHint` collapses to `checkoutHintFor(activeParticipantRef)` rather than repeating the body. A seat with no open visit reads the full `maxDartsPerTurn` budget, so an idle seat in a 1v1 still shows the conventional route.".

### Consequences
501's hint now blanks mid-visit when nothing fits (121 remaining with one dart left, say) where it used to show an unthrowable route — fewer hints, all of them true. `checkoutHint` gains 121's and TUOD's null-state guard, so it reads "" before the engine folds a state instead of hinting off a 0 remaining. `dartsLeftForSeat`'s parameter widens to `VisitLike & { participantRef?: string }` to sit in `play-visit-stats.ts`, whose other helpers are deliberately turn-shape-agnostic. 121's `dartsLeftInOpenVisit` stays private and seat-agnostic — its open visit is always the active seat's.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-19
