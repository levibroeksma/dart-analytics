---
id: D0464
status: accepted
date: 2026-10-16
origin: contemporaneous
original-date:
tags: [game-engine, fact log, 501, undo, leg, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Who throws first is decided before the session and stored only as seat order

## Context and Problem Statement
array order is already seat order end to end (server keeps request order into `configuration.seats`, reload reads the persisted snapshot, owner views filter `player_id`, bot/undo lookups go by participant type), so seat order expresses the starter with no migration. The darts thrown to decide it belong to no leg (501.md).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "every session with an opponent (guest or Dartbot) opens a who-throws-first step before `createSession` — and again before every rematch: bull-off (default, last choice remembered per device) or coin toss. The winner is seated first via `starterFirst()`, which also re-letters `sideKey` by position (starter `A`). Bull-off distances, Dartbot's bull throw and the coin are never persisted. A QUICK_SCORE bot fold now also returns its thrown darts (`BotQuickScoreFold.darts`) so the board can replay the visit before the total is recorded; they never reach the fact log.".

### Consequences
the owner can be seat 1 / side `B`; nothing positional depends on the owner being first (121's ROUNDS/MINUTES `seats[0]` reads are solo-only). `08-DartBot.md` §The Play Loop allows the fold's darts to be read for presentation. Leg 1's starter comment in `seat-rota.module.ts` and `501.md` updated.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-16
