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
<!-- backfill: pending -->

# Seatless 121 and TUOD sessions fold with a synthetic solo seat

## Context and Problem Statement
a routine GAME step stores its step configuration with no `seats` (`startGameStep`), so every routine 121 and TUOD session was dropped from every server fold (`ladder-progress`, `checkout-rate`, `double-performance`, `bust-rate`, `checkout-path`). The 121 personal best finish read 123 while a routine game had reached target 125. The fold is per seat over the owner's own turns, so no other seat can change it.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`visitsForSession` (`x01-checkout-sessions.module.ts`) no longer skips a 121 or TUOD session whose stored snapshot names no `seats`. It folds with one synthetic solo seat for the owner (`participantRef` = the owner's participant, `sideKey` `"A"`), the same stand-in `derived-aims.module.ts` uses (D370). A missing or undecodable snapshot still skips the session.".

### Consequences
no schema change. Historical seatless sessions now count too; an already-cached closed bucket of a bucketed server section keeps its old figure until its section `version` is bumped; the all-time personal best request is never closed, so it refetches. Existing tests that pinned the skip now pin the fold.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-04
Supersedes: none (extends D370).
