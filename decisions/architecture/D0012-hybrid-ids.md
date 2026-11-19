---
id: D0012
status: accepted
date:
origin: contemporaneous
original-date:
tags: [architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Hybrid IDs

## Context and Problem Statement
Sortable ids, deterministic seeds, no DB id coupling

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Hybrid IDs: UUIDv7 app/Worker-generated for domain entities, SMALLINT seeded for lookups; DB never generates ids", because Sortable ids, deterministic seeds, no DB id coupling.

### Consequences
Rationale unknown — no source found.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Source: P59–63

* Commit `8b23f90e` (2026-07-11; adds `architecture/DECISIONS.md` ledger row D12): source of Context and Decision Outcome.
