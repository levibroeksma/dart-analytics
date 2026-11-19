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

# The marks ladder scores only while the bot does not lead on points

## Context and Problem Statement
D489's strict ladder let the bot score without end on numbers it owned against a passive opponent, so that game never finished. A lead needs no more points, only the closes that end the game.

## Decision Drivers
* A bot with a points lead needs only the closes that end the game, not more points (row Reason).
* Against a passive opponent, D489's strict ladder let the bot score without end, so that game never finished (row Reason).

## Considered Options
* Score tier applies only while `ownPoints <= opponentPoints` (chosen).
* Keep D489's strict ladder, where the bot scores on every number it owns that the opponent has open (the state before this record).

## Decision Outcome
Chosen option: "`MarksView` gains `ownPoints` and `opponentPoints`. In `marks.strategy.module.ts` the score tier applies only when `ownPoints <= opponentPoints`; block, close and the treble-20 fallback are unchanged. A bot that leads on points skips scoring and closes its remaining numbers, and resumes scoring if the opponent catches up.", because D489's strict ladder let the bot score without end on numbers it owned against a passive opponent, so that game never finished. A lead needs no more points, only the closes that end the game.

### Consequences
a passive human now loses: the bot builds a lead, then closes. Levels still change aim noise only. No migration. Rules and architecture: `docs/architecture/08-DartBot.md` 0.8.14.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/dartbot/strategy/marks.strategy.module.test.ts` and `app/tests/lib/game/cricket-play.data.test.ts` reference `ownPoints`.

## Pros and Cons of the Options
### Score tier only while not leading
* Good, because a bot that leads closes its remaining numbers, so the game can finish.
* Good, because the bot resumes scoring if the opponent catches up.

### D489's strict ladder
* Bad, because the bot scores without end against a passive opponent, so the game never finishes.

## Evidence / More Information
Decided: 2026-10-24
Supersedes: D489 (score tier only; the rest of D489 stands).

* Commit `baa67e82` (2026-10-24, adds the D490 row): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons from the row's Reason and Decision. It also updated `docs/architecture/08-DartBot.md` to version 0.8.14.
