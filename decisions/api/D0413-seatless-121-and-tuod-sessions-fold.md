---
id: D0413
status: accepted
date: 2026-10-04
origin: contemporaneous
original-date:
tags: [api, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Seatless 121 and TUOD sessions fold with a synthetic solo seat

## Context and Problem Statement
a routine GAME step stores its step configuration with no `seats` (`startGameStep`), so every routine 121 and TUOD session was dropped from every server fold (`ladder-progress`, `checkout-rate`, `double-performance`, `bust-rate`, `checkout-path`). The 121 personal best finish read 123 while a routine game had reached target 125. The fold is per seat over the owner's own turns, so no other seat can change it.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Skip a 121 or TUOD session whose snapshot names no `seats` (the behaviour before this record).
* Fold it with one synthetic solo seat for the owner (chosen).

## Decision Outcome
Chosen option: "`visitsForSession` (`x01-checkout-sessions.module.ts`) no longer skips a 121 or TUOD session whose stored snapshot names no `seats`. It folds with one synthetic solo seat for the owner (`participantRef` = the owner's participant, `sideKey` `"A"`), the same stand-in `derived-aims.module.ts` uses (D370). A missing or undecodable snapshot still skips the session.".

### Consequences
no schema change. Historical seatless sessions now count too; an already-cached closed bucket of a bucketed server section keeps its old figure until its section `version` is bumped; the all-time personal best request is never closed, so it refetches. Existing tests that pinned the skip now pin the fold.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/stats/x01-checkout-sessions.module.test.ts` covers a 121 session whose configuration names no seats, folded with a synthetic solo seat, and a seatless routine 121 ladder climb.

## Pros and Cons of the Options
### Skip seatless sessions
* Bad, because every routine 121 and TUOD session drops out of every server fold. The 121 personal best read 123 while a routine game had reached target 125.

### Synthetic solo seat
* Good, because historical seatless sessions count too.

## Evidence / More Information
Decided: 2026-10-04
Supersedes: none (extends D370).

* Commit `d209d42c` (PR #780, 2026-10-05; adds the D413 row and the fold tests): rebuilt Considered Options, Confirmation and Pros and Cons.
