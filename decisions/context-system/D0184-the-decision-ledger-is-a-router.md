---
id: D0184
status: superseded
date: 2026-11-19
origin: contemporaneous
original-date:
tags: [context-system, format]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0564
---
<!-- backfill: pending -->

# The decision ledger is a router plus domain files, not one document

## Context and Problem Statement
At 163 decisions / 65 KB the single file cost every task the entire project history; a frontend task loaded 27 API and 14 database decisions it never read.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`DECISIONS.md` holds only front-matter, the authority note, the Source key, a routing table, the Deferred list, and the rules for adding a decision. All decisions live in `decisions/**`, one file per ownership domain, each carrying `load-when` / `depends-on` / `related` front-matter.", because At 163 decisions / 65 KB the single file cost every task the entire project history; a frontend task loaded 27 API and 14 database decisions it never read.

### Consequences
Decision IDs stay frozen (`D01`–`D183`) because ~180 citations reference them by ID, not location, so the split required no citation edits. Decisions from D184 on use a block format with Reason/Consequences; the 163 migrated rows keep their original terse table form permanently, since back-filling rationale nobody recorded would mean inventing it. `scripts/check-decision-ids.sh` enforces uniqueness, no-disappearance, `Supersedes:` resolution, and a row-free router.

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
