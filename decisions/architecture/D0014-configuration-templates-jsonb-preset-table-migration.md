---
id: D0014
status: accepted
date:
origin: contemporaneous
original-date:
tags: [architecture, ruleset, snapshot]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `configuration_templates` = JSONB preset table (migration `0010`)

## Context and Problem Statement
Written once, read for replay, never queried relationally

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`configuration_templates` = JSONB preset table (migration `0010`); JSONB for preset + snapshot, application-validated, structure defined by ruleset version", because Written once, read for replay, never queried relationally.

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
Source: Cont. session

* Commit `8b23f90e` (2026-07-11; adds `architecture/DECISIONS.md` ledger row D14): source of Context and Decision Outcome.
* Applied in: `docs/superpowers/specs/2026-07-25-game-engine-review-design.md` (§ 1 C1 cites D13/D14 and the template-to-snapshot chain `configuration_templates → exercise_configurations → session`; § 5 finds "Not met" for new rule options without engine surgery, since no engine reads a config snapshot). Migration `0010_configuration_templates.sql` exists in `database/migrations/`.
