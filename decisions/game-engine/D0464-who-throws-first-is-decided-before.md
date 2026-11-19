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

# Who throws first is decided before the session and stored only as seat order

## Context and Problem Statement
array order is already seat order end to end (server keeps request order into `configuration.seats`, reload reads the persisted snapshot, owner views filter `player_id`, bot/undo lookups go by participant type), so seat order expresses the starter with no migration. The darts thrown to decide it belong to no leg (501.md).

## Decision Drivers
* The spec bars a schema change or new column for the starter, so seat order must express it.
* The spec treats bull-off distances and the coin result as irrelevant to persist.
* The darts thrown to decide the starter belong to no leg.

## Considered Options
* Express the starter in seat order, decided before `createSession` (chosen).
* Store a starter field in the config snapshot the client already sends (the spec's named fallback if seat order cannot carry it).

## Decision Outcome
Chosen option: "every session with an opponent (guest or Dartbot) opens a who-throws-first step before `createSession` — and again before every rematch: bull-off (default, last choice remembered per device) or coin toss. The winner is seated first via `starterFirst()`, which also re-letters `sideKey` by position (starter `A`). Bull-off distances, Dartbot's bull throw and the coin are never persisted. A QUICK_SCORE bot fold now also returns its thrown darts (`BotQuickScoreFold.darts`) so the board can replay the visit before the total is recorded; they never reach the fact log.".

### Consequences
the owner can be seat 1 / side `B`; nothing positional depends on the owner being first (121's ROUNDS/MINUTES `seats[0]` reads are solo-only). `08-DartBot.md` §The Play Loop allows the fold's darts to be read for presentation. Leg 1's starter comment in `seat-rota.module.ts` and `501.md` updated.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Seat order
* Good, because it needs no migration, no new column and no stored toss or bull-off data.

### Starter field in the config snapshot
* Neutral, because the spec makes it the fallback only if seat order breaks the owner-is-seat-0 assumption, and says the choice returns to the owner before implementation.

## Evidence / More Information
Decided: 2026-10-16

* `docs/superpowers/specs/2026-10-16-match-motion-and-starter-design.md` (Non-goals, Anti-goals, Part 3 Persistence): rebuilt Decision Drivers, Considered Options, Pros and Cons.
* Commit `a712563d` (2026-10-17, "D463 match motion, D464 starter as seat order"): the adding commit.
