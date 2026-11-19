---
id: D0439
status: accepted
date: 2026-10-09
origin: contemporaneous
original-date:
tags: [api, contract, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# X01 checkout folds count undecodable-snapshot sessions in `skippedSessions`

## Context and Problem Statement
a ruleset schema change that invalidated stored configs would zero those sections for the affected sessions with no signal, while every `stepsLoad` section already reports the skip (#855).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`sessionCheckoutVisits` marks each session `undecodable` when its stored snapshot exists but `snapshotOf` cannot decode it. `foldLoad` returns `{ sessions, skippedSessions }`, and a `foldHandler` threads the count into the response for `ladder-progress`, `checkout-rate`, `double-performance`, `checkout-path`, `bust-rate` and `leg-stats`. A session with no stored snapshot is not counted.", because a ruleset schema change that invalidated stored configs would zero those sections for the affected sessions with no signal, while every `stepsLoad` section already reports the skip (#855).

### Consequences
no schema or contract change; `skippedSessions` was already optional on these responses. `SessionCheckoutVisits` gains a required `undecodable` boolean. The statistics cards for these sections do not yet show a notice.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-09
Supersedes: none (extends D370).
