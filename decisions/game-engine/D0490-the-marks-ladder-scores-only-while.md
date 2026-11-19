---
id: D0490
status: accepted
date: 2026-10-24
origin: contemporaneous
original-date:
tags: [game-engine, scoring]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The marks ladder scores only while the bot does not lead on points

## Context and Problem Statement
D489's strict ladder let the bot score without end on numbers it owned against a passive opponent, so that game never finished. A lead needs no more points, only the closes that end the game.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`MarksView` gains `ownPoints` and `opponentPoints`. In `marks.strategy.module.ts` the score tier applies only when `ownPoints <= opponentPoints`; block, close and the treble-20 fallback are unchanged. A bot that leads on points skips scoring and closes its remaining numbers, and resumes scoring if the opponent catches up.", because D489's strict ladder let the bot score without end on numbers it owned against a passive opponent, so that game never finished. A lead needs no more points, only the closes that end the game.

### Consequences
a passive human now loses: the bot builds a lead, then closes. Levels still change aim noise only. No migration. Rules and architecture: `docs/architecture/08-DartBot.md` 0.8.14.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-24
Supersedes: D489 (score tier only; the rest of D489 stands).
