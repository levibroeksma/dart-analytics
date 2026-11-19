---
id: D0149
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [api, batch, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Column CHECK constraints are mirrored once, in the shared batch request schema

## Context and Problem Statement
A value the database rejects reached `insertBatchRecords` and aborted the transaction, losing the whole session upload behind a 500; the bound is ruleset-independent, so five copies would drift exactly as the Singles `chk_dart_target_consistency` case did (review I-batch-bounds)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Column CHECK constraints are mirrored once, in the shared batch request schema (`app/src/pages/api/sessions/types.ts`) — dart/turn/stage `sequence` positive, dart `score` non-negative, intended/hit target numbers 1..25, the intention pair, and no self-parenting stage — not restated per ruleset validator; per-ruleset validators keep only ruleset rules".

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
Decided: 2026-07-26
