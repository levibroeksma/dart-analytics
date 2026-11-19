---
id: D0194
status: accepted
date: 2026-08-08
origin: contemporaneous
original-date:
tags: [context-system, docs, gate, CI, branch, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A gate that can silently find nothing is not a gate

## Context and Problem Statement
the range pattern matches a U+2013 en-dash. Under the POSIX/C locale that character is three bytes, its continuation bytes consume the pattern's `.?` slots, and every range stops matching — so the check passed by finding nothing rather than by finding nothing wrong. CI runs in a UTF-8 locale and did match, which is how six stale ranges reached PR #73 after the gate had been reported green locally on every run of the branch. A checker whose failure mode is silence is worse than no checker: it converts an unverified claim into a reported pass.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`scripts/check-context-map.sh` pins `LC_ALL` to an available UTF-8 locale before its migration-range check, and warns loudly when none exists. That check is also narrowed: `decisions/**` is excluded from it entirely, and lines naming seeds are skipped.".

### Consequences
the exclusions resolve a real contradiction between two gates. `check-decision-ids.sh` hashes every migrated decision row so it can never be edited, while this check demanded that D21's `chain 0001–0016` follow the chain forward — both could not hold, and the ledger is the side that must not move, because a decision records what was true when it was made. Seed ranges are skipped because seeds carry their own numbering that the migration chain max says nothing about; `docs/architecture/README.md`'s `seeds 0001–0006` was being reported as a stale migration range. Any future gate whose matching depends on non-ASCII text must pin its locale the same way, or it inherits this failure mode.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-08
