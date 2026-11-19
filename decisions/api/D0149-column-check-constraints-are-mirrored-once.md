---
id: D0149
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [api, batch, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Column CHECK constraints are mirrored once, in the shared batch request schema

## Context and Problem Statement
A value the database rejects reached `insertBatchRecords` and aborted the transaction, losing the whole session upload behind a 500; the bound is ruleset-independent, so five copies would drift exactly as the Singles `chk_dart_target_consistency` case did (review I-batch-bounds)

## Decision Drivers
* A value the database rejects reached `insertBatchRecords` and aborted the transaction, losing the whole session upload behind a 500.
* The bound is ruleset-independent.

## Considered Options
* Mirror each bound once in the shared batch request schema (chosen).
* Restate each bound in every ruleset validator (5 copies).

## Decision Outcome
Chosen option: "Column CHECK constraints are mirrored once, in the shared batch request schema (`app/src/pages/api/sessions/types.ts`) — dart/turn/stage `sequence` positive, dart `score` non-negative, intended/hit target numbers 1..25, the intention pair, and no self-parenting stage — not restated per ruleset validator; per-ruleset validators keep only ruleset rules".

### Consequences
* Good, because a bad value now gets `VALIDATION_FAILED` naming the offending dart instead of aborting the insert transaction behind a 500.
* Good, because there is 1 declaration, not 5 validator copies.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-constraint-mirror.sh` requires a `// MIRRORS: chk_x` anchor in `app/src/pages/api/sessions/types.ts` for every live CHECK constraint on `exercise_stages`, `turns` and `darts`. `app/tests/pages/api/sessions/constraint-mirror.test.ts` runs the bound agreement.

## Pros and Cons of the Options
### Mirror once in the shared batch request schema
* Good, because the bound is declared in 1 place.

### Restate in each ruleset validator
* Bad, because 5 copies would drift, as the Singles `chk_dart_target_consistency` case did.

## Evidence / More Information
Decided: 2026-07-26

* Commit `51d99be8` (2026-07-26, adds the D149 row): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons from the commit message and the ledger row.
* `docs/superpowers/specs/2026-07-28-claude-md-skills-automation-design.md` (§ 5.2): rebuilt Confirmation. Section 5.2 names `check-constraint-mirror.sh` as closing D149.
* `docs/superpowers/plans/2026-07-28-claude-md-skills-automation.md` (Task 4): applies the rule.
