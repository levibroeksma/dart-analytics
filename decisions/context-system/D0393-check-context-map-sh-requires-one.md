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

# `check-context-map.sh` requires one `03-Migrations.md` section per migration file

## Context and Problem Statement
the gate only checked the quoted `0001`–NNNN range, so the section list fell 12 behind (#288) with every gate green. The first run of the new check found `0046` undocumented; its section is added in the same change.

## Decision Drivers
* The gate only checked the quoted `0001`–NNNN range.
* The section list in `03-Migrations.md` fell 12 behind (#288) with every gate green.

## Considered Options
* Check only the quoted migration range (the prior state).
* Compare the `## NNNN_name.sql` headings with the files in `database/migrations/` (chosen).

## Decision Outcome
Chosen option: "`scripts/check-context-map.sh` §2b compares the `## NNNN_name.sql` headings in `03-Migrations.md`'s "Migration Execution Order" part with `database/migrations/` and fails on a file with no section and on a section with no file. The "Seed Files" part is not read. Closes #491.".

### Consequences
a new migration now needs its `03-Migrations.md` section in the same PR or the structure job fails. Seeds are not covered; that is #490's subject.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-context-map.sh` §2b reads the "Migration Execution Order" part of `docs/architecture/05-Database/03-Migrations.md`. It errors on a migration file with no section and on a section with no file.

## Pros and Cons of the Options
### Check only the quoted range
* Bad, because the section list fell 12 behind (#288) with every gate green.

### Compare section headings with migration files
* Good, because its first run found `0046` undocumented.
* Bad, because seeds are not covered; that is #490's subject.

## Evidence / More Information
Decided: 2026-10-03

* Commit `bd0586a8` (PR #725, adds the D393 row and §2b of `scripts/check-context-map.sh`; closes #491): rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation.
