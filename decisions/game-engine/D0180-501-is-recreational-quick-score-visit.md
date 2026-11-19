---
id: D0180
status: accepted
date: 2026-08-02
origin: contemporaneous
original-date:
tags: [game-engine, checkout, 501, leg, visit, bust]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# 501 is RECREATIONAL + QUICK_SCORE (visit totals only, no per-dart rows), so when an

## Context and Problem Statement
Matches `docs/game-rules/rulesets/501.md`'s Finishing section: the finishing dart, not the visit, must be a double, and the app has no per-dart fact to check that against

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "501 is RECREATIONAL + QUICK_SCORE (visit totals only, no per-dart rows), so when an entered visit score would bring the leg's remaining total to exactly 0 the client cannot tell a legal double-out checkout from a bust from the number alone; `five-oh-one-play.data.ts`'s `submitVisit` gates behind a "Finished on a double?" confirm (`showDoubleConfirm`/`confirmDouble`/`denyDouble`) before recording anything", because Matches `docs/game-rules/rulesets/501.md`'s Finishing section: the finishing dart, not the visit, must be a double, and the app has no per-dart fact to check that against.

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
