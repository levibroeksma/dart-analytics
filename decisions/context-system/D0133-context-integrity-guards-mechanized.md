---
id: D0133
status: accepted
date: 2026-07-23
origin: contemporaneous
original-date:
tags: [context-system, docs, context map, CLAUDE.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Context-integrity guards mechanized

## Context and Problem Statement
Linking staleness and budget drift both slipped past every existing check — mechanize them per the D105/D110/D127 precedent, and stop the always-loaded router paying for redundancy

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Context-integrity guards mechanized: `scripts/check-doc-links.sh` validates every markdown link + path-like backtick reference across the canonical doc set (alias/base-aware, bare-identifier-skipping, `DECISIONS.md` history-refs and `docs/superpowers/` excluded), and `scripts/check-context-budget.sh` fails when the Context Map's per-file `~tokens` (strict) or per-pack `~Budget` (best-effort sum) drift >20%/>30% from a chars/4 estimate. Both added to Context-Maintenance step 5 and `checks.yml`. Same audit corrected two stale references (Alpine-Patterns `Timer`→`SegmentTimer`, Shared-Conventions barrel examples) and de-duplicated the always-loaded root `CLAUDE.md` (Forbidden Actions no longer restates Hard Invariants)", because Linking staleness and budget drift both slipped past every existing check — mechanize them per the D105/D110/D127 precedent, and stop the always-loaded router paying for redundancy.

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
Decided: 2026-07-23
