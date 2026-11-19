---
id: D0375
status: accepted
date: 2026-09-30
origin: contemporaneous
original-date:
tags: [database, schema, migration, view]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# D333's three `0038` references mean `0039`, the X01 checkout-darts view swap

## Context and Problem Statement
issue #528. D333 was written on branch `fix/x01-checkout-percentage` while that branch's migration was still numbered `0038`. `main` then landed `0038_custom_routines.sql` and the branch's migration was renumbered `0039`; D333 is append-only, so its old number stayed and now reads as a reference to custom routines.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "in D333, every bare `0038` names the migration now numbered `0039` (`0039_x01_checkout_darts_view.sql`, the `v_double_out_checkout_darts` → `v_x01_checkout_darts` swap), not `0038_custom_routines.sql`. D333's text stays as written; read its `0038` as `0039`.".

### Consequences
none for the schema or `db:drift`. A reader of D333 resolves `0038` through this block; `03-Migrations.md` carries the `0039` section.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-30
