---
id: D0052
status: accepted
date: 2026-07-11
origin: contemporaneous
original-date:
tags: [context-system, CLAUDE.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Context routing system

## Context and Problem Statement
Token efficiency + guaranteed context completeness

Commit `8b23f90e` distils prompts 1-85 plus dated sessions into the ledger. It validated that the master context and canonical docs cover the raw logs before removing them.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Context routing system: root `CLAUDE.md` router + `00-Context-Map.md` packs; spec split into `06-Spec/` chapters; raw conversation logs removed after distillation into this ledger; mandatory Context Maintenance protocol for every agent", because Token efficiency + guaranteed context completeness.

### Consequences
* Neutral, because the removal takes ~1.3MB of markdown (`conversations/`, `original-conversation/`) out of the active search surface. It stays retrievable from git history.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-11

* Commit `8b23f90e` (2026-07-11; adds the D52 row): rebuilt Context and Consequences.
* Applied in: `docs/superpowers/specs/2026-07-14-mainline-reconciliation-design.md` (cites D52 as the choice of the ledger over a planned ADR directory), `docs/superpowers/plans/2026-07-14-mainline-governance.md`.
