---
id: D0393
status: accepted
date: 2026-10-03
origin: contemporaneous
original-date:
tags: [context-system, gate, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `check-context-map.sh` requires one `03-Migrations.md` section per migration file

## Context and Problem Statement
the gate only checked the quoted `0001`–NNNN range, so the section list fell 12 behind (#288) with every gate green. The first run of the new check found `0046` undocumented; its section is added in the same change.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`scripts/check-context-map.sh` §2b compares the `## NNNN_name.sql` headings in `03-Migrations.md`'s "Migration Execution Order" part with `database/migrations/` and fails on a file with no section and on a section with no file. The "Seed Files" part is not read. Closes #491.".

### Consequences
a new migration now needs its `03-Migrations.md` section in the same PR or the structure job fails. Seeds are not covered; that is #490's subject.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-03
