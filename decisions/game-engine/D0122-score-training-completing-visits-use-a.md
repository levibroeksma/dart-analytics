---
id: D0122
status: accepted
date: 2026-07-21
origin: contemporaneous
original-date:
tags: [game-engine, engine, Score Training, undo]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Score Training completing visits use a client-side `pendingFinishScore` + finish-confirm

## Context and Problem Statement
Lets players correct the last score before irreversible completion upload

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Score Training completing visits use a client-side `pendingFinishScore` + finish-confirm modal before results/upload; Cancel restores the score into `visitInput` without committing; Confirm commits then reuses the D119 hard-gate. In-play undo pops the last committed turn (store + engine; resume-safe engine rebuild when the instance has no local visits).", because Lets players correct the last score before irreversible completion upload.

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
Decided: 2026-07-21
