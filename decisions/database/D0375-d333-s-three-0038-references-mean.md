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

# D333's three `0038` references mean `0039`, the X01 checkout-darts view swap

## Context and Problem Statement
issue #528. D333 was written on branch `fix/x01-checkout-percentage` while that branch's migration was still numbered `0038`. `main` then landed `0038_custom_routines.sql` and the branch's migration was renumbered `0039`; D333 is append-only, so its old number stayed and now reads as a reference to custom routines.

## Decision Drivers
* D333 is append-only, so its text cannot be corrected.
* The renumbering left D333's `0038` reading as a reference to `0038_custom_routines.sql` (issue #528).

## Considered Options
* Record a clarification in a new block and leave D333's text as written (chosen).

## Decision Outcome
Chosen option: "in D333, every bare `0038` names the migration now numbered `0039` (`0039_x01_checkout_darts_view.sql`, the `v_double_out_checkout_darts` → `v_x01_checkout_darts` swap), not `0038_custom_routines.sql`. D333's text stays as written; read its `0038` as `0039`.".

### Consequences
none for the schema or `db:drift`. A reader of D333 resolves `0038` through this block; `03-Migrations.md` carries the `0039` section.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Record a clarification and leave D333 as written
* Good, because D333 stays append-only while readers resolve `0038` through this block, and `03-Migrations.md` carries the `0039` section.

## Evidence / More Information
Decided: 2026-09-30

* Commit `56a09f8e` (2026-09-30, issue #528, PR #671; the row and `03-Migrations.md`): rebuilt Decision Drivers, Considered Options and Pros and Cons.
