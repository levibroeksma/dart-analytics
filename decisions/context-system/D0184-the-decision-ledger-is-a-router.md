---
id: D0184
status: superseded
date: 2026-11-18
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

# The decision ledger is a router plus domain files, not one document

## Context and Problem Statement
At 163 decisions / 65 KB the single file cost every task the entire project history; a frontend task loaded 27 API and 14 database decisions it never read.

## Decision Drivers
* A single 65 KB file makes every task pay for the whole project history (spec Problem).
* IDs are cited about 180 times, by ID and never by location, so IDs must stay frozen (spec Constraints).
* The context map already routes every other doc type by task; the ledger is the last monolith (spec Problem).

## Considered Options
* Router plus domain files, 11 files, 1 nested directory for frontend (chosen; spec Structure).
* A researched `D-001` ID reformat (spec Constraints rules it out).
* A `knowledge/` tree for durable facts (spec Constraints, rejected).
* A researched tree of about 25 files (spec Structure, rejected).
* Keep the single `DECISIONS.md` file (status quo; spec Problem).

## Decision Outcome
Chosen option: "`DECISIONS.md` holds only front-matter, the authority note, the Source key, a routing table, the Deferred list, and the rules for adding a decision. All decisions live in `decisions/**`, one file per ownership domain, each carrying `load-when` / `depends-on` / `related` front-matter.", because At 163 decisions / 65 KB the single file cost every task the entire project history; a frontend task loaded 27 API and 14 database decisions it never read.

### Consequences
Decision IDs stay frozen (`D01`–`D183`) because ~180 citations reference them by ID, not location, so the split required no citation edits. Decisions from D184 on use a block format with Reason/Consequences; the 163 migrated rows keep their original terse table form permanently, since back-filling rationale nobody recorded would mean inventing it. `scripts/check-decision-ids.sh` enforces uniqueness, no-disappearance, `Supersedes:` resolution, and a row-free router.

* Good, because a task loads only the decisions that bear on it (spec Goal).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-decision-ids.sh` runs from `quality.yml` and enforces ID uniqueness, no-disappearance and `Supersedes:` resolution.

## Pros and Cons of the Options
### Router plus domain files
* Good, because the split needs zero citation updates when IDs stay frozen (spec Constraints).

### `D-001` ID reformat
* Bad, because it would break all ~180 references for cosmetic gain (spec Constraints).

### `knowledge/` tree
* Bad, because `docs/architecture/` already holds the facts, so a tree creates a third competing home for them (spec Constraints).

### Tree of about 25 files
* Bad, because most files stay empty or near-empty and a frontend task opens 3–4 files instead of 1 (spec Structure).

### Single `DECISIONS.md` file
* Bad, because every task loads the entire project history (spec Problem).

## Evidence / More Information
Decided: 2026-08-02

* `docs/superpowers/specs/2026-08-02-decision-ledger-split-design.md` (Problem, Goal, Constraints, Structure): rebuilt Decision Drivers, Considered Options, Consequences, Pros and Cons.
* Commit `9aba1c7f` (PR #67, 2026-08-03; adds `decisions/context-system.md` and the router): rebuilt Confirmation.
